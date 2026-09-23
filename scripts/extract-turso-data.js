/**
 * Extract all data from Turso database for migration to Neon Postgres
 * This script connects to Turso, reads all tables and their data,
 * and saves everything as JSON files for the migration.
 */
import { createClient } from "@libsql/client";
import { writeFileSync, mkdirSync } from "fs";

const TURSO_URL = "libsql://produccion-gastonarielabrego-ship-it.aws-us-east-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODM1NDg3MTEsImlkIjoiMDE5ZjQzYzktNzgwMS03M2MwLWE1NTctOTUxMjQ2MGVhMTI4Iiwia2lkIjoiSlczdWpYRzZweDhNVHo3UnNPWk16aGNSd0dPeEcydDJvS3E2UElVYkpFNCIsInJpZCI6IjFiNGEwNjY0LTM1MjItNDdjZC04MDQxLWE4ODc0NmE3ZTI5OCJ9.LdhOU2LfuHwLX-hxfk_9fmQLbcojqghaj9_RcAx4dLognv_5HI5856GvcaHqV5HK9UShT_Xj54xEe0sJqkPrCg";

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
const OUTPUT_DIR = "/home/z/my-project/scripts/turso-export";

mkdirSync(OUTPUT_DIR, { recursive: true });

// All known tables
const TABLES = [
  "production_records",
  "clarkistas_records",
  "tiempos_muertos",
  "nomina_override",
  "errores_records",
  "rendimientos_records",
  "horas_extras_records",
];

async function getSchema() {
  console.log("📊 Extracting schema information...");
  
  // Get all tables
  const tablesResult = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const existingTables = tablesResult.rows.map(r => r.name);
  console.log(`  Found tables: ${existingTables.join(", ")}`);

  // Get all indexes
  const indexesResult = await client.execute(
    "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  
  // Get CREATE TABLE statements
  const schemas = {};
  for (const table of existingTables) {
    const ddlResult = await client.execute(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name = '${table}'`
    );
    schemas[table] = ddlResult.rows[0]?.sql || "";
    console.log(`  Schema for ${table}: ${schemas[table]?.substring(0, 80)}...`);
  }

  // Get column info for each table
  const columnInfo = {};
  for (const table of existingTables) {
    const infoResult = await client.execute(`PRAGMA table_info(${table})`);
    columnInfo[table] = infoResult.rows.map(r => ({
      cid: r.cid,
      name: r.name,
      type: r.type,
      notnull: r.notnull,
      dflt_value: r.dflt_value,
      pk: r.pk,
    }));
  }

  const schemaData = {
    tables: existingTables,
    schemas,
    columnInfo,
    indexes: indexesResult.rows.map(r => ({ name: r.name, table: r.tbl_name, sql: r.sql })),
  };

  writeFileSync(`${OUTPUT_DIR}/schema.json`, JSON.stringify(schemaData, null, 2));
  console.log(`  ✅ Schema saved to ${OUTPUT_DIR}/schema.json`);
  return schemaData;
}

async function extractTableData(tableName) {
  console.log(`📦 Extracting data from ${tableName}...`);
  
  try {
    // Get count first
    const countResult = await client.execute(`SELECT COUNT(*) as cnt FROM ${tableName}`);
    const count = Number(countResult.rows[0]?.cnt || 0);
    console.log(`  Row count: ${count}`);

    if (count === 0) {
      writeFileSync(`${OUTPUT_DIR}/${tableName}.json`, JSON.stringify({ table: tableName, count: 0, rows: [] }, null, 2));
      console.log(`  ⚠️ Table is empty, saved empty file`);
      return { table: tableName, count: 0 };
    }

    // Extract all data in batches
    const BATCH_SIZE = 1000;
    const allRows = [];
    let offset = 0;

    while (offset < count) {
      const result = await client.execute({
        sql: `SELECT * FROM ${tableName} LIMIT ${BATCH_SIZE} OFFSET ${offset}`,
        args: [],
      });
      allRows.push(...result.rows);
      offset += BATCH_SIZE;
      console.log(`  Extracted ${Math.min(offset, count)}/${count} rows...`);
    }

    // Convert BigInt values to strings for JSON serialization
    const serializedRows = allRows.map(row => {
      const converted = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === "bigint") {
          converted[key] = Number(value);
        } else {
          converted[key] = value;
        }
      }
      return converted;
    });

    writeFileSync(
      `${OUTPUT_DIR}/${tableName}.json`,
      JSON.stringify({ table: tableName, count, rows: serializedRows }, null, 2)
    );
    console.log(`  ✅ Saved ${count} rows to ${OUTPUT_DIR}/${tableName}.json`);
    return { table: tableName, count };
  } catch (err) {
    console.error(`  ❌ Error extracting ${tableName}: ${err.message}`);
    writeFileSync(`${OUTPUT_DIR}/${tableName}.json`, JSON.stringify({ table: tableName, count: 0, rows: [], error: err.message }, null, 2));
    return { table: tableName, count: 0, error: err.message };
  }
}

async function main() {
  console.log("🚀 Starting Turso data extraction...\n");

  // Step 1: Get schema
  const schemaData = await getSchema();

  // Step 2: Extract data from all known tables
  const results = [];
  for (const table of [...new Set([...TABLES, ...schemaData.tables])]) {
    const result = await extractTableData(table);
    results.push(result);
  }

  // Step 3: Summary
  console.log("\n📋 Extraction Summary:");
  console.log("─".repeat(50));
  for (const r of results) {
    console.log(`  ${r.table}: ${r.count} rows${r.error ? ` (ERROR: ${r.error})` : ""}`);
  }
  console.log("─".repeat(50));
  
  const totalRows = results.reduce((sum, r) => sum + r.count, 0);
  console.log(`  Total: ${totalRows} rows across ${results.length} tables`);
  console.log("\n✅ Extraction complete! Files saved to:", OUTPUT_DIR);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
