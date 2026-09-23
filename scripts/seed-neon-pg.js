/**
 * Seed Neon PostgreSQL with data from Excel files using pg driver
 * This replaces the Turso seed script for the Neon migration
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import pg from "pg";
import path from "path";
import fs from "fs";

const DATABASE_URL = "postgresql://neondb_owner:npg_1Pu5tKnkvcpD@ep-orange-pond-awso2777.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require";

const HORA_COLS = Array.from({ length: 24 }, (_, i) => `hora_${String(i).padStart(2, "0")}`);

async function seedProductionRecords(pool) {
  const filePath = path.join(process.cwd(), "upload", "h61 ver.xlsx");
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠️ No se encontró h61 ver.xlsx, saltando...");
    return 0;
  }

  console.log("📦 Seeding production_records...");
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets["Datos"];
  if (!sheet) {
    console.log("  ⚠️ No se encontró hoja 'Datos', saltando...");
    return 0;
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 12);
  console.log(`  ${dataRows.length} registros para insertar`);

  const client = await pool.connect();
  try {
    await client.query("DELETE FROM production_records");

    const BATCH_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const values = batch.map((row) => {
        const tarea = row[5] ?? "";
        const horas = HORA_COLS.map((_, idx) => Number(row[11 + idx]) || 0);
        return [
          String(row[0] ?? ""), String(row[1] ?? ""), Number(row[2]) || 0,
          String(row[3] ?? ""), String(row[4] ?? ""), tarea,
          String(row[6] ?? ""), String(row[7] ?? ""), Number(row[8]) || 0,
          String(row[9] ?? ""), Number(row[10]) || 0,
          ...horas, Number(row[35]) || 0,
        ];
      });

      const cols = [
        "funcion", "funcion_desc", "fecha", "turno", "turno_desc", "tarea",
        "operario", "nombre", "actividad", "circuito", "tiempo_mue",
        ...HORA_COLS, "total",
      ];

      const placeholders = values
        .map((_, rowIdx) =>
          `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`
        )
        .join(", ");

      const insertSQL = `INSERT INTO production_records (${cols.join(", ")}) VALUES ${placeholders}`;
      await client.query(insertSQL, values.flat());

      inserted += batch.length;
      process.stdout.write(`\r  Insertados: ${inserted}/${dataRows.length}`);
    }

    console.log(`\n  ✅ production_records: ${inserted} registros`);
    return inserted;
  } finally {
    client.release();
  }
}

async function seedClarkistas(pool) {
  const filePath = path.join(process.cwd(), "upload", "clarkistas.xlsx");
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠️ No se encontró clarkistas.xlsx, saltando...");
    return 0;
  }

  console.log("📦 Seeding clarkistas_records...");
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return 0;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 12);
  console.log(`  ${dataRows.length} registros para insertar`);

  const client = await pool.connect();
  try {
    await client.query("DELETE FROM clarkistas_records");

    const BATCH_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const values = batch.map((row) => {
        const tarea = row[5] ?? "";
        const horas = HORA_COLS.map((_, idx) => Number(row[11 + idx]) || 0);
        return [
          String(row[0] ?? ""), String(row[1] ?? ""), Number(row[2]) || 0,
          String(row[3] ?? ""), String(row[4] ?? ""), tarea,
          String(row[6] ?? ""), String(row[7] ?? ""), Number(row[8]) || 0,
          String(row[9] ?? ""), Number(row[10]) || 0,
          ...horas, Number(row[35]) || 0,
        ];
      });

      const cols = [
        "funcion", "funcion_desc", "fecha", "turno", "turno_desc", "tarea",
        "operario", "nombre", "actividad", "circuito", "tiempo_mue",
        ...HORA_COLS, "total",
      ];

      const placeholders = values
        .map((_, rowIdx) =>
          `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`
        )
        .join(", ");

      const insertSQL = `INSERT INTO clarkistas_records (${cols.join(", ")}) VALUES ${placeholders}`;
      await client.query(insertSQL, values.flat());

      inserted += batch.length;
      process.stdout.write(`\r  Insertados: ${inserted}/${dataRows.length}`);
    }

    console.log(`\n  ✅ clarkistas_records: ${inserted} registros`);
    return inserted;
  } finally {
    client.release();
  }
}

async function seedTiemposMuertos(pool) {
  const files = fs.readdirSync(path.join(process.cwd(), "upload"))
    .filter(f => f.startsWith("TM") && f.endsWith(".xlsx"));
  
  if (files.length === 0) {
    console.log("  ⚠️ No se encontró archivo de Tiempos Muertos, saltando...");
    return 0;
  }

  console.log("📦 Seeding tiempos_muertos...");
  const filePath = path.join(process.cwd(), "upload", files[0]);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return 0;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 5);
  console.log(`  ${dataRows.length} registros para insertar`);

  const client = await pool.connect();
  try {
    await client.query("DELETE FROM tiempos_muertos");

    const BATCH_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const values = batch.map((row) => [
        Number(row[0]) || 0, String(row[1] ?? ""), String(row[2] ?? ""),
        String(row[3] ?? ""), String(row[4] ?? ""), Number(row[5]) || null,
        Number(row[6]) || 0, String(row[7] ?? ""), String(row[8] ?? ""),
      ]);

      const cols = ["fecha", "turno", "operario", "nombre", "estado", "motivo", "minutos", "observacion", "usuario_alta"];
      const placeholders = values
        .map((_, rowIdx) =>
          `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`
        )
        .join(", ");

      const insertSQL = `INSERT INTO tiempos_muertos (${cols.join(", ")}) VALUES ${placeholders}`;
      await client.query(insertSQL, values.flat());

      inserted += batch.length;
      process.stdout.write(`\r  Insertados: ${inserted}/${dataRows.length}`);
    }

    console.log(`\n  ✅ tiempos_muertos: ${inserted} registros`);
    return inserted;
  } finally {
    client.release();
  }
}

async function seedErrores(pool) {
  const filePath = path.join(process.cwd(), "upload", "Errores de Preparacion.xlsx");
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠️ No se encontró archivo de Errores, saltando...");
    return 0;
  }

  console.log("📦 Seeding errores_records...");
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return 0;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 5);
  console.log(`  ${dataRows.length} registros para insertar`);

  const client = await pool.connect();
  try {
    await client.query("DELETE FROM errores_records");

    const BATCH_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const values = batch.map((row) => [
        Number(row[0]) || 0, Number(row[1]) || 0, String(row[2] ?? ""),
        String(row[3] ?? ""), String(row[4] ?? ""), String(row[5] ?? ""),
        String(row[6] ?? ""), Number(row[7]) || 1, String(row[8] ?? ""),
      ]);

      const cols = ["fecha_prep", "fecha_ctrl", "id_operario", "tipo_control", "controlador", "codigo_producto", "producto", "errores", "motivo"];
      const placeholders = values
        .map((_, rowIdx) =>
          `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`
        )
        .join(", ");

      const insertSQL = `INSERT INTO errores_records (${cols.join(", ")}) VALUES ${placeholders}`;
      await client.query(insertSQL, values.flat());

      inserted += batch.length;
      process.stdout.write(`\r  Insertados: ${inserted}/${dataRows.length}`);
    }

    console.log(`\n  ✅ errores_records: ${inserted} registros`);
    return inserted;
  } finally {
    client.release();
  }
}

async function seedRendimientos(pool) {
  const filePath = path.join(process.cwd(), "upload", "Rendimientos.xlsx");
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠️ No se encontró archivo de Rendimientos, saltando...");
    return 0;
  }

  console.log("📦 Seeding rendimientos_records...");
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return 0;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 5);
  console.log(`  ${dataRows.length} registros para insertar`);

  const client = await pool.connect();
  try {
    await client.query("DELETE FROM rendimientos_records");

    const BATCH_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const values = batch.map((row) => [
        String(row[0] ?? ""), String(row[1] ?? ""), Number(row[2]) || null,
        Number(row[3]) || 0, Number(row[4]) || 0, Number(row[5]) || 0,
        Number(row[6]) || 0, Number(row[7]) || 0, Number(row[8]) || 0,
        Number(row[9]) || 0,
      ]);

      const cols = ["nombre", "dia", "fecha", "bultos", "hs_brutas", "tm_hs", "hs_netas", "produccion", "bh_bruta", "bh_neta"];
      const placeholders = values
        .map((_, rowIdx) =>
          `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`
        )
        .join(", ");

      const insertSQL = `INSERT INTO rendimientos_records (${cols.join(", ")}) VALUES ${placeholders}`;
      await client.query(insertSQL, values.flat());

      inserted += batch.length;
      process.stdout.write(`\r  Insertados: ${inserted}/${dataRows.length}`);
    }

    console.log(`\n  ✅ rendimientos_records: ${inserted} registros`);
    return inserted;
  } finally {
    client.release();
  }
}

async function seedHorasExtras(pool) {
  const filePath = path.join(process.cwd(), "upload", "horas extras.xlsx");
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠️ No se encontró archivo de Horas Extras, saltando...");
    return 0;
  }

  console.log("📦 Seeding horas_extras_records...");
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return 0;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 5);
  console.log(`  ${dataRows.length} registros para insertar`);

  const client = await pool.connect();
  try {
    await client.query("DELETE FROM horas_extras_records");

    const BATCH_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const values = batch.map((row) => [
        Number(row[0]) || null, String(row[1] ?? ""), String(row[2] ?? ""),
        String(row[3] ?? ""), Number(row[4]) || null, String(row[5] ?? ""),
        Number(row[6]) || 0, Number(row[7]) || 0, Number(row[8]) || 0,
        Number(row[9]) || 0, Number(row[10]) || 0, String(row[11] ?? ""),
      ]);

      const cols = ["cod_empleado", "empresa", "nombre", "sector", "fecha", "dia", "hs_trabajadas", "hs_extras_50", "hs_extras_100", "hs_noct_100", "hs_noc_trab", "jornada"];
      const placeholders = values
        .map((_, rowIdx) =>
          `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`
        )
        .join(", ");

      const insertSQL = `INSERT INTO horas_extras_records (${cols.join(", ")}) VALUES ${placeholders}`;
      await client.query(insertSQL, values.flat());

      inserted += batch.length;
      process.stdout.write(`\r  Insertados: ${inserted}/${dataRows.length}`);
    }

    console.log(`\n  ✅ horas_extras_records: ${inserted} registros`);
    return inserted;
  } finally {
    client.release();
  }
}

async function main() {
  console.log("🚀 Seeding Neon PostgreSQL with data from Excel files...\n");
  
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  let total = 0;
  total += await seedProductionRecords(pool);
  console.log("");
  total += await seedClarkistas(pool);
  console.log("");
  total += await seedTiemposMuertos(pool);
  console.log("");
  total += await seedErrores(pool);
  console.log("");
  total += await seedRendimientos(pool);
  console.log("");
  total += await seedHorasExtras(pool);

  // Summary
  console.log("\n📊 Verifying row counts...");
  const client = await pool.connect();
  try {
    const tables = [
      "production_records", "clarkistas_records", "tiempos_muertos",
      "nomina_override", "errores_records", "rendimientos_records", "horas_extras_records",
    ];
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) as cnt FROM ${table}`);
      console.log(`  ${table}: ${result.rows[0]?.cnt || 0} rows`);
    }
  } finally {
    client.release();
  }

  await pool.end();
  console.log(`\n✅ Seed complete! Total: ${total} rows`);
}

main().catch(err => {
  console.error("❌ Fatal error:", err.message);
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
