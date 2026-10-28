// Check PG column types for the tables we're writing SQL against
const fs = require('fs');
const path = require('path');
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.neon-final'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { Pool } = require(path.join(__dirname, '..', 'node_modules', 'pg'));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const r = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_name IN ('production_records','clarkistas_records','tiempos_muertos')
      AND column_name IN ('fecha','operario','nombre','total','turno','turno_desc','actividad','circuito','funcion','hora_00','hora_23','minutos')
    ORDER BY table_name, column_name`);
  let last = '';
  for (const row of r.rows) {
    if (row.table_name !== last) { console.log('== ' + row.table_name); last = row.table_name; }
    console.log(`   ${row.column_name}: ${row.data_type}`);
  }
  await pool.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
