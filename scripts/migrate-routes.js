/**
 * Script to migrate all Pattern B API routes from Turso (SQLite) to Neon (PostgreSQL)
 * This handles: import changes, SQL syntax conversions, and API interface changes
 */
import fs from 'fs';
import path from 'path';

const ROUTES_DIR = '/home/z/my-project/src/app/api';

const files = [
  'admin/download/route.ts',
  'admin/upload-errores/route.ts',
  'admin/upload-rendimientos/route.ts',
  'admin/nomina-override/route.ts',
  'admin/upload-clarkistas/route.ts',
  'admin/upload-tm/route.ts',
  'admin/upload-horas-extras/route.ts',
  'errores/route.ts',
  'errores/dates/route.ts',
  'horas-extras/route.ts',
];

for (const relPath of files) {
  const filePath = path.join(ROUTES_DIR, relPath);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // 1. Change import
  content = content.replace(/from ["']@\/lib\/turso["']/g, 'from "@/lib/neon"');
  
  // 2. Replace SUBSTR with SUBSTRING for PostgreSQL
  // SQLite: SUBSTR(operario, 2) → PostgreSQL: SUBSTRING(operario FROM 2)
  content = content.replace(/SUBSTR\((\w+),\s*(\d+)\)/g, 'SUBSTRING($1 FROM $2)');
  
  // 3. Replace INSERT OR REPLACE with INSERT ... ON CONFLICT DO UPDATE
  // For nomina_override: INSERT OR REPLACE INTO nomina_override → INSERT INTO nomina_override ... ON CONFLICT (operario) DO UPDATE SET nombre = EXCLUDED.nombre, fecha_alta = EXCLUDED.fecha_alta
  content = content.replace(
    /INSERT OR REPLACE INTO nomina_override\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/g,
    'INSERT INTO nomina_override ($1) VALUES ($2) ON CONFLICT (operario) DO UPDATE SET nombre = EXCLUDED.nombre, fecha_alta = EXCLUDED.fecha_alta'
  );
  
  // 4. Remove CREATE TABLE IF NOT EXISTS statements from batch calls
  // Remove entire { sql: `CREATE TABLE IF NOT EXISTS ...` } entries from batch arrays
  // This is complex - let me handle it more carefully
  
  // 5. Convert client.batch([{ sql: "..." }, ...]) to client.batch(["...", ...])
  // Pattern: { sql: `...` } → just the SQL string
  // First handle the simple cases in batch arrays
  content = content.replace(/\{\s*sql:\s*`([^`]*)`\s*\}/g, (match, sql) => {
    return '`' + sql + '`';
  });
  
  // 6. Convert client.execute({ sql: "...", args: ... }) to client.execute("...", [...])
  // Pattern: client.execute({ sql: `...`, args: xxx }) → client.execute(`...`, xxx)
  // Also handle: client.execute({ sql: "..." }) → client.execute("...")
  content = content.replace(
    /client\.execute\(\{\s*sql:\s*`([^`]*)`,?\s*args:\s*(\w+)\s*\}\)/g,
    'client.execute(`$1`, $2)'
  );
  content = content.replace(
    /client\.execute\(\{\s*sql:\s*"([^"]*)",?\s*args:\s*(\w+)\s*\}\)/g,
    'client.execute("$1", $2)'
  );
  // Handle cases with no args
  content = content.replace(
    /client\.execute\(\{\s*sql:\s*`([^`]*)`\s*\}\)/g,
    'client.execute(`$1`)'
  );
  content = content.replace(
    /client\.execute\(\{\s*sql:\s*"([^"]*)"\s*\}\)/g,
    'client.execute("$1")'
  );
  
  // 7. Remove CREATE TABLE and CREATE INDEX statements from batch arrays
  // These are now no-ops since tables are pre-created via migration
  // We need to be careful here - let's just remove the ensure* calls
  content = content.replace(/await ensure\w+Table\(\);\s*\n/g, '');
  content = content.replace(/await ensure\w+Table\(\);/g, '');
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated: ${relPath}`);
}

console.log('\nDone! All Pattern B routes updated.');
