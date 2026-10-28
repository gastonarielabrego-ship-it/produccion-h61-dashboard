// Apply performance indexes to Neon production DB
const fs = require('fs');
const path = require('path');
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.neon-final'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { Pool } = require(path.join(__dirname, '..', 'node_modules', 'pg'));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'perf-indexes.sql'), 'utf8');
  const t0 = Date.now();
  await pool.query(sql);
  console.log('indexes applied in', Date.now() - t0, 'ms');
  const r = await pool.query(`SELECT indexname FROM pg_indexes WHERE tablename IN ('clarkistas_records','tiempos_muertos') ORDER BY tablename, indexname`);
  console.log(r.rows.map(x => x.indexname).join('\n'));
  await pool.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
