// Benchmark + correctness check: OLD (raw rows + nested scan) vs NEW (SQL GROUP BY + single pass)
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.neon-final');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { Pool } = require(path.join(__dirname, '..', 'node_modules', 'pg'));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Same calcHorasBrutas as the route
function calcHorasBrutas(hoursArr) {
  const n = hoursArr.length;
  if (n === 0) return 0;
  const sorted = hoursArr.slice().sort(function(a, b) { return a - b; });
  const uniq = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) { if (sorted[i] !== sorted[i - 1]) uniq.push(sorted[i]); }
  const u = uniq.length;
  if (u === 1) return 1;
  let maxGap = uniq[1] - uniq[0], maxGapIdx = 0;
  for (let i = 1; i < u - 1; i++) { const gap = uniq[i + 1] - uniq[i]; if (gap > maxGap) { maxGap = gap; maxGapIdx = i; } }
  const wrapGap = (24 - uniq[u - 1]) + uniq[0];
  if (wrapGap >= maxGap) return uniq[u - 1] - uniq[0] + 1;
  let newMin = 999, newMax = -1;
  for (let i = 0; i < u; i++) { let h = uniq[i]; if (h <= uniq[maxGapIdx]) h += 24; if (h < newMin) newMin = h; if (h > newMax) newMax = h; }
  return newMax - newMin + 1;
}

(async () => {
  // ── common: nomina ──
  const nom = await pool.query("SELECT usuario FROM nomina_eventuales ORDER BY nombre");
  const usuarios = nom.rows.map(r => String(r.usuario)).filter(Boolean);
  console.log('usuarios:', usuarios.length);

  // ══════════ OLD PATH: raw rows ══════════
  const t0 = Date.now();
  const raw = await pool.query(
    `SELECT fecha, operario, nombre, total, hora_00,hora_01,hora_02,hora_03,hora_04,hora_05,hora_06,hora_07,hora_08,hora_09,hora_10,hora_11,hora_12,hora_13,hora_14,hora_15,hora_16,hora_17,hora_18,hora_19,hora_20,hora_21,hora_22,hora_23
     FROM production_records WHERE operario = ANY($1)`, [usuarios]);
  const tRawFetch = Date.now() - t0;
  console.log(`\n[OLD] raw fetch: ${tRawFetch}ms, rows: ${raw.rows.length}, payload ~${(JSON.stringify(raw.rows).length / 1e6).toFixed(1)}MB`);

  // OLD single-pass bultos/activeHours (this part was always fast)
  const t1 = Date.now();
  const oldMap = {};
  for (const row of raw.rows) {
    const fecha = Number(row.fecha), operario = String(row.operario || '');
    if (fecha <= 0 || !operario) continue;
    const key = fecha + ':' + operario;
    if (!oldMap[key]) oldMap[key] = { bultos: 0, activeHours: [], hourly: null };
    oldMap[key].bultos += Number(row.total) || 0;
    for (let h = 0; h <= 23; h++) {
      if (Number(row['hora_' + String(h).padStart(2, '0')]) > 0) oldMap[key].activeHours.push(h);
    }
  }
  // OLD hourly: nested scan — measure on 150 keys and extrapolate
  const keysSample = Object.keys(oldMap).slice(0, 150);
  const t2 = Date.now();
  for (const key of keysSample) {
    const ci = key.indexOf(':');
    const fecha = Number(key.substring(0, ci)), operario = key.substring(ci + 1);
    const hourly = [];
    for (let h = 0; h <= 23; h++) {
      let qty = 0;
      for (let j = 0; j < raw.rows.length; j++) {
        const row = raw.rows[j];
        if (Number(row.fecha) === fecha && String(row.operario) === operario) {
          qty += Number(row['hora_' + String(h).padStart(2, '0')]) || 0;
        }
      }
      hourly.push(qty);
    }
    oldMap[key].hourly = hourly;
  }
  const msSample = Date.now() - t2;
  const totalKeys = Object.keys(oldMap).length;
  const oldHourlyProjected = Math.round(msSample * (totalKeys / keysSample.length) / 1000);
  console.log(`[OLD] bultos/activeHours pass: ${Date.now() - t1 - msSample}ms`);
  console.log(`[OLD] hourly nested scan: ${msSample}ms for 150 keys → projected ${oldHourlyProjected}s for all ${totalKeys} keys  ❌`);

  // ══════════ NEW PATH ══════════
  const hourAgg = [];
  for (let h = 0; h <= 23; h++) {
    const col = 'hora_' + String(h).padStart(2, '0');
    hourAgg.push(`SUM(${col}) AS ${col}, SUM(CASE WHEN ${col} > 0 THEN 1 ELSE 0 END) AS act_${col}`);
  }
  const t3 = Date.now();
  const [agg, tmRes] = await Promise.all([
    pool.query(
      `SELECT fecha, operario, MAX(nombre) AS nombre, SUM(total) AS total, ${hourAgg.join(', ')}
       FROM production_records WHERE operario = ANY($1) GROUP BY fecha, operario`, [usuarios]),
    pool.query(`SELECT fecha, operario, SUM(minutos) as total_minutos FROM tiempos_muertos WHERE operario = ANY($1) GROUP BY fecha, operario`, [usuarios]),
  ]);
  const tAggFetch = Date.now() - t3;
  console.log(`\n[NEW] SQL GROUP BY fetch (parallel with TM): ${tAggFetch}ms, rows: ${agg.rows.length}, payload ~${(JSON.stringify(agg.rows).length / 1e6).toFixed(1)}MB`);

  const t4 = Date.now();
  const newMap = {};
  for (const row of agg.rows) {
    const fecha = Number(row.fecha), operario = String(row.operario || '');
    if (fecha <= 0 || !operario) continue;
    const key = fecha + ':' + operario;
    const entry = newMap[key] = { bultos: 0, activeHours: [], hourly: new Array(24).fill(0) };
    entry.bultos += Number(row.total) || 0;
    for (let h = 0; h <= 23; h++) {
      const col = 'hora_' + String(h).padStart(2, '0');
      entry.hourly[h] += Number(row[col]) || 0;
      if (Number(row['act_' + col]) > 0) entry.activeHours.push(h);
    }
  }
  // build daily rows (calcHorasBrutas etc.) — the real post-processing cost
  let dailyBuilt = 0;
  for (const key of Object.keys(newMap)) {
    const entry = newMap[key];
    const hsBrutas = calcHorasBrutas(entry.activeHours);
    const tmHoras = 0; // not needed for compare
    dailyBuilt++;
  }
  const newJsTime = Date.now() - t4;
  console.log(`[NEW] JS single-pass + daily build: ${newJsTime}ms for ${dailyBuilt} person-days  ✅`);
  console.log(`\n=== TOTAL projected old pipeline: ~${(oldHourlyProjected + 1).toFixed(0)}s+ | new pipeline measured: ${(tAggFetch + newJsTime) / 1000}s (from this sandbox) ===`);

  // ══════════ CORRECTNESS: old vs new ══════════
  let mismatches = 0, checked = 0;
  const mismatchDetail = [];
  for (const key of Object.keys(oldMap)) {
    const o = oldMap[key], n = newMap[key];
    if (!n) { mismatches++; mismatchDetail.push(key + ' missing in NEW'); continue; }
    checked++;
    if (Math.abs(o.bultos - n.bultos) > 0.0001) { mismatches++; if (mismatchDetail.length < 5) mismatchDetail.push(key + ' bultos ' + o.bultos + ' vs ' + n.bultos); continue; }
    const oHs = calcHorasBrutas(o.activeHours), nHs = calcHorasBrutas(n.activeHours);
    if (oHs !== nHs) { mismatches++; if (mismatchDetail.length < 5) mismatchDetail.push(key + ' hs_brutas ' + oHs + ' vs ' + nHs); continue; }
    // hourly was only computed for the first 150 sampled keys (nested scan too slow for the rest)
    if (!o.hourly) continue;
    for (let h = 0; h < 24; h++) {
      if ((o.hourly[h] || 0) !== n.hourly[h]) { mismatches++; if (mismatchDetail.length < 5) mismatchDetail.push(key + ' hourly[' + h + '] ' + o.hourly[h] + ' vs ' + n.hourly[h]); break; }
    }
  }
  console.log(`\nCORRECTNESS: checked ${checked} person-days, mismatches: ${mismatches}`);
  if (mismatchDetail.length) console.log('details:', mismatchDetail.join(' | '));

  await pool.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
