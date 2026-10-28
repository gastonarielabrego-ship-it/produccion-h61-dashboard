// Check actual indexes on Neon production DB
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
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname`);
  let last = '';
  for (const row of r.rows) {
    if (row.tablename !== last) { console.log('\n== ' + row.tablename); last = row.tablename; }
    console.log('  ' + row.indexdef.replace(/CREATE (UNIQUE )?INDEX \S+ ON public\.\S+ /, ''));
  }
  // table sizes
  const sizes = await pool.query(`
    SELECT relname, n_live_tup::int as rows,
           pg_size_pretty(pg_total_relation_size(relid)) as size
    FROM pg_stat_user_tables ORDER BY n_live_tup DESC`);
  console.log('\n== table sizes ==');
  for (const s of sizes.rows) console.log(`  ${s.relname}: ~${s.rows} rows, ${s.size}`);
  await pool.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
