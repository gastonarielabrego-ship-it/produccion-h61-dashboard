// Verify rewritten endpoints produce the same results as production baselines
const fs = require('fs');

const BASE = '/tmp/baseline';
const BASE2 = '/tmp/baseline2';
const LOCAL = 'http://localhost:3210/api';

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}: ${await r.text()}`);
  return r.json();
}

function cmpNums(a, b, tol = 1e-6) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tol;
  return false;
}

function deepDiff(a, b, path, diffs, maxDiffs = 8) {
  if (diffs.length >= maxDiffs) return;
  if (typeof a === 'number' && typeof b === 'number') {
    if (!cmpNums(a, b)) diffs.push(`${path}: ${a} != ${b}`);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) diffs.push(`${path}: length ${a.length} != ${b.length}`);
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n && diffs.length < maxDiffs; i++) deepDiff(a[i], b[i], `${path}[${i}]`, diffs, maxDiffs);
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (diffs.length >= maxDiffs) return;
      if (!(k in a)) { diffs.push(`${path}.${k}: missing in NEW`); continue; }
      if (!(k in b)) { diffs.push(`${path}.${k}: missing in OLD`); continue; }
      deepDiff(a[k], b[k], `${path}.${k}`, diffs, maxDiffs);
    }
    return;
  }
  if (a !== b) diffs.push(`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}

(async () => {
  // 1. summary — identical except shiftData order (now deterministic: total desc)
  d = await get(`${LOCAL}/production/summary`);
  old = JSON.parse(fs.readFileSync(`${BASE2}/production_summary.json`, 'utf8'));
  const sortShift = (arr) => [...arr].sort((a, b) => a.turno < b.turno ? -1 : 1);
  old.shiftData = sortShift(old.shiftData); d.shiftData = sortShift(d.shiftData);
  diffs = [];
  deepDiff(old, d, 'summary', diffs);
  console.log('summary:', diffs.length === 0 ? 'IDENTICAL ✅ (shiftData order-normalized)' : 'DIFFS ❌'); diffs.slice(0, 8).forEach(x => console.log('   ', x));

  // 2. hourly-combined — expect identical
  d = await get(`${LOCAL}/production/hourly-combined`);
  old = JSON.parse(fs.readFileSync(`${BASE}/production_hourly-combined.json`, 'utf8'));
  diffs = [];
  deepDiff(old, d, 'hourly-combined', diffs);
  console.log('hourly-combined:', diffs.length === 0 ? 'IDENTICAL ✅' : 'DIFFS ❌'); diffs.slice(0, 8).forEach(x => console.log('   ', x));

  // 3. daily-combined — expect identical
  d = await get(`${LOCAL}/production/daily-combined`);
  old = JSON.parse(fs.readFileSync(`${BASE}/production_daily-combined.json`, 'utf8'));
  diffs = [];
  deepDiff(old, d, 'daily-combined', diffs);
  console.log('daily-combined:', diffs.length === 0 ? 'IDENTICAL ✅' : 'DIFFS ❌'); diffs.slice(0, 8).forEach(x => console.log('   ', x));

  // 4. by-shift — expect identical
  d = await get(`${LOCAL}/production/by-shift`);
  old = JSON.parse(fs.readFileSync(`${BASE}/production_by-shift.json`, 'utf8'));
  diffs = [];
  deepDiff(old, d, 'by-shift', diffs);
  console.log('by-shift:', diffs.length === 0 ? 'IDENTICAL ✅' : 'DIFFS ❌'); diffs.slice(0, 8).forEach(x => console.log('   ', x));

  // 5. time-window-operators — identical modulo tie-break order (now deterministic)
  d = await get(`${LOCAL}/production/time-window-operators`);
  old = JSON.parse(fs.readFileSync(`${BASE2}/production_time-window-operators.json`, 'utf8'));
  const normList = (arr) => [...arr].sort((a, b) => b.total - a.total || (a.operario < b.operario ? -1 : 1));
  for (const k of ['operators6', 'operators10', 'operators18']) { old[k] = normList(old[k]); d[k] = normList(d[k]); }
  diffs = [];
  deepDiff(old, d, 'time-window', diffs);
  console.log('time-window-operators:', diffs.length === 0 ? 'IDENTICAL ✅ (tie-break order-normalized)' : 'DIFFS ❌'); diffs.slice(0, 8).forEach(x => console.log('   ', x));

  // 6. citacion (week filter) — zero-days omitted by design; compare totals + non-zero day metrics
  d = await get(`${LOCAL}/production/citacion?dateFrom=20261001&dateTo=20261007`);
  old = JSON.parse(fs.readFileSync(`${BASE}/production_citacion_dateFrom_20261001_dateTo_20261007.json`, 'utf8'));
  let citDiffs = [];
  if (JSON.stringify(d.dates) !== JSON.stringify(old.dates)) citDiffs.push('dates differ');
  if (d.operators.length !== old.operators.length) citDiffs.push(`operators ${d.operators.length} != ${old.operators.length}`);
  const oldByOp = {}; for (const o of old.operators) oldByOp[o.operario] = o;
  let checked = 0;
  for (const op of d.operators) {
    const o = oldByOp[op.operario];
    if (!o) { citDiffs.push(`operator ${op.operario} missing in OLD`); continue; }
    for (const f of ['totalBultos', 'totalBrutas', 'totalTM', 'totalNetas', 'overallBH', 'nombre']) {
      if (!cmpNums(op[f], o[f])) citDiffs.push(`${op.operario}.${f}: ${op[f]} != ${o[f]}`);
    }
    const oldDays = {}; for (const dd of o.days) oldDays[dd.date] = dd;
    for (const dd of op.days) {
      const od = oldDays[dd.date];
      if (!od) { citDiffs.push(`${op.operario} day ${dd.date} missing in OLD`); continue; }
      checked++;
      for (const f of ['brutas', 'tmHoras', 'netas', 'bultos', 'bhNeta']) {
        if (!cmpNums(dd[f], od[f])) { citDiffs.push(`${op.operario} ${dd.date}.${f}: ${dd[f]} != ${od[f]}`); break; }
      }
    }
    // every OLD non-zero day must exist in NEW
    for (const od of o.days) {
      if (od.brutas > 0 || od.bultos > 0 || od.tmHoras !== 0) {
        if (!op.days.find(dd => dd.date === od.date)) citDiffs.push(`${op.operario} non-zero day ${od.date} omitted in NEW`);
      }
    }
  }
  console.log(`citacion: ${citDiffs.length === 0 ? 'MATCH ✅' : 'DIFFS ❌'} (checked ${checked} worked days)`); citDiffs.slice(0, 8).forEach(x => console.log('   ', x));

  // 7. summary-tables — identical (heByTurno order may differ: normalize by turno)
  d = await get(`${LOCAL}/production/summary-tables`);
  old = JSON.parse(fs.readFileSync(`${BASE2}/production_summary-tables.json`, 'utf8'));
  const normTurno = (arr) => [...arr].sort((a, b) => (a.turno < b.turno ? -1 : 1));
  old.heByTurno = normTurno(old.heByTurno); d.heByTurno = normTurno(d.heByTurno);
  diffs = [];
  deepDiff(old, d, 'summary-tables', diffs);
  console.log('summary-tables:', diffs.length === 0 ? 'IDENTICAL ✅ (heByTurno order-normalized)' : 'DIFFS ❌'); diffs.slice(0, 10).forEach(x => console.log('   ', x));

  // 8. monthly-summary — was 500 on prod (broken); just check it works now
  d = await get(`${LOCAL}/production/monthly-summary`);
  console.log('monthly-summary: HTTP OK ✅ months:', d.monthlyData.length, 'first:', JSON.stringify(d.monthlyData[0] || {}).slice(0, 150));

  // 9. rendimientos — compare numerics; ""-name bucket's operario label was
  // heap-order-dependent in old code (non-deterministic), so compare by nombre.
  d = await get(`${LOCAL}/rendimientos`);
  old = JSON.parse(fs.readFileSync(`${BASE2}/rendimientos.json`, 'utf8'));
  let renDiffs = [];
  for (const f of ['dates', 'totals']) {
    diffs = [];
    deepDiff(old[f], d[f], `rendimientos.${f}`, diffs);
    if (diffs.length) renDiffs.push(...diffs.slice(0, 4));
  }
  if (d.summary.length !== old.summary.length) renDiffs.push(`summary length ${d.summary.length} != ${old.summary.length}`);
  const oldSumByName = {}; for (const s of old.summary) oldSumByName[s.nombre] = s;
  let sChecked = 0;
  for (const s of d.summary) {
    const o = oldSumByName[s.nombre];
    if (!o) { renDiffs.push(`summary name ${JSON.stringify(s.nombre)} missing in OLD`); continue; }
    sChecked++;
    for (const f of ['total_bultos', 'total_hs_brutas', 'total_tm', 'total_hs_netas', 'avg_bh_bruta', 'avg_bh_neta', 'produccion', 'dias']) {
      if (!cmpNums(s[f], o[f])) { renDiffs.push(`summary ${JSON.stringify(s.nombre)}.${f}: ${s[f]} != ${o[f]}`); break; }
    }
    // operario label only meaningful for named rows
    if (s.nombre !== "" && s.operario !== o.operario) renDiffs.push(`summary ${JSON.stringify(s.nombre)}.operario: ${s.operario} != ${o.operario}`);
  }
  // daily: full multiset both directions (order may differ within empty-name ties)
  const oldDailyByKey = {}; for (const r of old.daily) oldDailyByKey[r.operario + ':' + r.fecha] = r;
  const newDailyByKey = {}; for (const r of d.daily) newDailyByKey[r.operario + ':' + r.fecha] = r;
  let dChecked = 0;
  for (const k of Object.keys(newDailyByKey)) {
    const r = newDailyByKey[k], o = oldDailyByKey[k];
    if (!o) { renDiffs.push(`daily ${k} missing in OLD`); continue; }
    dChecked++;
    for (const f of ['dia', 'nombre', 'bultos', 'hs_brutas', 'tm_hs', 'hs_netas', 'bh_bruta', 'bh_neta']) {
      if (!cmpNums(r[f], o[f])) { renDiffs.push(`daily ${k}.${f}: ${r[f]} != ${o[f]}`); break; }
    }
  }
  for (const k of Object.keys(oldDailyByKey)) {
    if (!newDailyByKey[k]) renDiffs.push(`daily ${k} missing in NEW`);
  }
  console.log(`rendimientos: ${renDiffs.length === 0 ? 'MATCH ✅' : 'DIFFS ❌'} (summary ${sChecked}, daily ${dChecked})`); renDiffs.slice(0, 8).forEach(x => console.log('   ', x));

  // 10. comparativo — same treatment: compare by nombre
  d = await get(`${LOCAL}/comparativo`);
  old = JSON.parse(fs.readFileSync(`${BASE2}/comparativo.json`, 'utf8'));
  let cmpDiffs = [];
  for (const f of ['globalAvg', 'stdDev', 'avgLow', 'avgHigh', 'totalPeople']) {
    if (!cmpNums(d[f], old[f])) cmpDiffs.push(`${f}: ${d[f]} != ${old[f]}`);
  }
  if (JSON.stringify(d.dates) !== JSON.stringify(old.dates)) cmpDiffs.push('dates differ');
  if (JSON.stringify(d.monthLabels) !== JSON.stringify(old.monthLabels)) cmpDiffs.push('monthLabels differ');
  if (d.ranking.length !== old.ranking.length) cmpDiffs.push(`ranking length ${d.ranking.length} != ${old.ranking.length}`);
  const oldRankByName = {}; for (const r of old.ranking) oldRankByName[r.nombre] = r;
  let rChecked = 0;
  for (const r of d.ranking) {
    const o = oldRankByName[r.nombre];
    if (!o) { cmpDiffs.push(`ranking name ${JSON.stringify(r.nombre)} missing in OLD`); continue; }
    rChecked++;
    for (const f of ['total_bultos', 'total_hs_brutas', 'total_hs_netas', 'total_tm', 'bh_bruta', 'bh_neta', 'produccion', 'dias', 'meses', 'category']) {
      if (!cmpNums(r[f], o[f])) { cmpDiffs.push(`ranking ${JSON.stringify(r.nombre)}.${f}: ${r[f]} != ${o[f]}`); break; }
    }
    if (r.nombre !== "" && r.operario !== o.operario) cmpDiffs.push(`ranking ${JSON.stringify(r.nombre)}.operario: ${r.operario} != ${o.operario}`);
  }
  for (const f of ['monthlyAvg', 'monthlyCategoryCounts', 'distribution']) {
    diffs = [];
    deepDiff(old[f], d[f], `comparativo.${f}`, diffs);
    if (diffs.length) cmpDiffs.push(...diffs.slice(0, 3));
  }
  console.log(`comparativo: ${cmpDiffs.length === 0 ? 'MATCH ✅' : 'DIFFS ❌'} (ranking ${rChecked} checked)`); cmpDiffs.slice(0, 8).forEach(x => console.log('   ', x));
})().catch(e => { console.error('VERIFY ERR:', e.message); process.exit(1); });
