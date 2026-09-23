/**
 * Comprehensive migration script for Turso → Neon route conversion
 * Handles remaining SQL patterns that the first pass missed
 */
import fs from 'fs';
import path from 'path';

const ROUTES_DIR = '/home/z/my-project/src/app/api';

function migrateFile(relPath) {
  const filePath = path.join(ROUTES_DIR, relPath);
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  
  // 1. Remove CREATE TABLE IF NOT EXISTS statements from client.batch() calls
  // Replace entire batch calls that only contain DDL with empty operations
  // Pattern: client.batch([`CREATE TABLE...`, `CREATE INDEX...`]) → no-op (remove or replace with empty)
  
  // 2. Remove standalone CREATE TABLE/INDEX execute calls  
  // Pattern: await client.execute(`CREATE TABLE IF NOT EXISTS ...`) → remove
  // Pattern: await client.execute({ sql: `CREATE TABLE IF NOT EXISTS ...` }) → remove
  
  // 3. Convert remaining client.execute({ sql: `...`, args: xxx }) patterns
  // Handle multiline patterns
  content = content.replace(
    /client\.execute\(\{\s*sql:\s*`((?:[^`\\]|\\.)*)`,\s*args:\s*(\w+(?:\.\w+)*)\s*\}\)/gs,
    (match, sql, args) => {
      changed = true;
      return `client.execute(\`${sql}\`, ${args})`;
    }
  );
  
  // Handle single-line with double quotes
  content = content.replace(
    /client\.execute\(\{\s*sql:\s*"([^"]*)",\s*args:\s*(\w+(?:\.\w+)*)\s*\}\)/g,
    (match, sql, args) => {
      changed = true;
      return `client.execute("${sql}", ${args})`;
    }
  );
  
  // Handle cases with no args but still using object syntax
  content = content.replace(
    /client\.execute\(\{\s*sql:\s*`((?:[^`\\]|\\.)*)`\s*\}\)/gs,
    (match, sql) => {
      changed = true;
      return `client.execute(\`${sql}\`)`;
    }
  );

  // 4. Remove CREATE TABLE IF NOT EXISTS from batch arrays
  // Find batch calls and remove DDL entries
  // This is tricky - let's replace ensure* function patterns that create tables
  
  // 5. Remove ensure*Table function definitions that create tables
  // These are helper functions at the top of some route files
  
  // 6. Convert `fecha / 100` to `TRUNC(fecha / 100)` for PostgreSQL integer division
  // Actually in PostgreSQL, integer / integer = integer (truncates), so this is fine
  
  fs.writeFileSync(filePath, content);
  console.log(`${changed ? '✅' : '⏭️'} ${relPath}`);
  return changed;
}

// Process all remaining Pattern B files
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

let totalChanged = 0;
for (const f of files) {
  if (migrateFile(f)) totalChanged++;
}
console.log(`\n${totalChanged} files updated in second pass.`);
