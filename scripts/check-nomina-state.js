// Read-only: verify nomina_eventuales overwrite state in production
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.neon-final');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { Pool } = require(path.join(__dirname, '..', 'node_modules', 'pg'));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const total = await pool.query('SELECT COUNT(*)::int AS n FROM nomina_eventuales');
  console.log('total filas:', total.rows[0].n);
  const dupes = await pool.query('SELECT usuario, COUNT(*)::int AS n FROM nomina_eventuales GROUP BY usuario HAVING COUNT(*) > 1 LIMIT 5');
  console.log('usuarios duplicados:', dupes.rows.length === 0 ? 'NINGUNO (pisando OK)' : JSON.stringify(dupes.rows));
  const activos = await pool.query("SELECT COALESCE(NULLIF(activo,''),'(vacio)') AS a, COUNT(*)::int AS n FROM nomina_eventuales GROUP BY activo ORDER BY n DESC");
  console.log('por activo:', JSON.stringify(activos.rows));
  const idx = await pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename='nomina_eventuales'");
  console.log('índices:', JSON.stringify(idx.rows.map(r => r.indexname)));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
