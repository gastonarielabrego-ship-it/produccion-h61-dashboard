// Diagnostic: quantify RRHH API performance bottleneck
const fs = require('fs');
const path = require('path');

// Load .env.neon-final (production Neon PostgreSQL)
const envPath = path.join(__dirname, '..', '.env.neon-final');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { Pool } = require(path.join(__dirname, '..', 'node_modules', 'pg'));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const t0 = Date.now();

  const r1 = await pool.query("SELECT COUNT(*)::int as n, COUNT(DISTINCT operario)::int as ops, COUNT(DISTINCT fecha)::int as fechas FROM production_records");
  console.log('production_records total:', JSON.stringify(r1.rows[0]));

  const r2 = await pool.query("SELECT COUNT(*)::int as n FROM nomina_eventuales");
  console.log('nomina_eventuales:', JSON.stringify(r2.rows[0]));

  const r3 = await pool.query("SELECT MIN(fecha)::int as min, MAX(fecha)::int as max FROM production_records");
  console.log('fecha range:', JSON.stringify(r3.rows[0]));

  // Simulate the RRHH query: no date filter = ALL history for all nomina users
  const t1 = Date.now();
  const nom = await pool.query("SELECT usuario FROM nomina_eventuales");
  const usuarios = nom.rows.map(r => String(r.usuario)).filter(Boolean);
  const t2 = Date.now();
  console.log(`nomina fetch: ${t2 - t1}ms, usuarios: ${usuarios.length}`);

  const prod = await pool.query(
    `SELECT fecha, operario, nombre, total, hora_00,hora_01,hora_02,hora_03,hora_04,hora_05,hora_06,hora_07,hora_08,hora_09,hora_10,hora_11,hora_12,hora_13,hora_14,hora_15,hora_16,hora_17,hora_18,hora_19,hora_20,hora_21,hora_22,hora_23
     FROM production_records WHERE operario = ANY($1)`, [usuarios]);
  const t3 = Date.now();
  console.log(`production fetch: ${t3 - t2}ms, rows: ${prod.rows.length}`);

  const tm = await pool.query(
    `SELECT fecha, operario, SUM(minutos) as total_minutos FROM tiempos_muertos WHERE operario = ANY($1) GROUP BY fecha, operario`, [usuarios]);
  const t4 = Date.now();
  console.log(`tiempos_muertos fetch: ${t4 - t3}ms, rows: ${tm.rows.length}`);

  // Count unique fecha:operario keys (opKeys)
  const keySet = new Set();
  for (const row of prod.rows) keySet.add(Number(row.fecha) + ':' + String(row.operario));
  const opKeys = keySet.size;
  console.log(`unique fecha:operario combos (opKeys): ${opKeys}`);

  // ── THE BOTTLENECK: simulate O(opKeys × 24 × prodRows) nested loop ──
  const iteraciones = opKeys * 24 * prod.rows.length;
  console.log(`\n*** BOTTLENECK ESTIMATE ***`);
  console.log(`nested-loop iterations = opKeys(${opKeys}) × 24 × prodRows(${prod.rows.length}) = ${(iteraciones / 1e6).toFixed(0)} MILLION iterations`);
  console.log(`at ~50M simple ops/sec in Node => ~${(iteraciones / 50e6).toFixed(0)}s just for the hourly loop`);

  // Actually measure a scaled-down version
  const sampleRows = prod.rows.slice(0, 2000);
  const sampleKeys = Array.from(keySet).slice(0, 500);
  const tA = Date.now();
  for (const key of sampleKeys) {
    const ci = key.indexOf(':');
    const fecha = Number(key.substring(0, ci));
    const operario = key.substring(ci + 1);
    for (let h = 0; h <= 23; h++) {
      let qty = 0;
      for (let j = 0; j < sampleRows.length; j++) {
        const row = sampleRows[j];
        if (Number(row.fecha) === fecha && String(row.operario) === operario) {
          const col = 'hora_' + String(h).padStart(2, '0');
          qty += Number(row[col]) || 0;
        }
      }
    }
  }
  const tB = Date.now();
  const msForSample = tB - tA;
  // sample: 500 keys × 24 × 2000 rows
  const itersSample = 500 * 24 * 2000;
  const rate = itersSample / (msForSample / 1000); // iterations/sec
  console.log(`\nmeasured: 500 keys × 24h × 2000 rows took ${msForSample}ms => ${((rate / 1e6).toFixed(1))}M iter/s`);
  console.log(`projected FULL loop: ${(iteraciones / rate).toFixed(0)}s  <<< TIME RRHH SPENDS COMPUTING`);
  console.log(`\nfix reduces to O(prodRows × 24) = ${(prod.rows.length * 24 / rate).toFixed(3)}s`);

  await pool.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
