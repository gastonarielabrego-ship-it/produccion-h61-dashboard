/**
 * Seed Neon PostgreSQL with data from Excel files
 * This replaces the Turso seed script for the Neon migration
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import { neon } from "@neondatabase/serverless";
import path from "path";
import fs from "fs";

const DATABASE_URL = "postgresql://neondb_owner:npg_1Pu5tKnkvcpD@ep-orange-pond-awso2777-pooler.c-12.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

const HORA_COLS = Array.from({ length: 24 }, (_, i) => `hora_${String(i).padStart(2, "0")}`);

async function seedProductionRecords(sql) {
  const filePath = path.join(process.cwd(), "upload", "h61 ver.xlsx");
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠️ No se encontró h61 ver.xlsx, saltando...");
    return;
  }

  console.log("📦 Seeding production_records...");
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets["Datos"];
  if (!sheet) {
    console.log("  ⚠️ No se encontró hoja 'Datos', saltando...");
    return;
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 12);
  console.log(`  ${dataRows.length} registros para insertar`);

  // Clear existing data
  await sql`DELETE FROM production_records`;

  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
    const batch = dataRows.slice(i, i + BATCH_SIZE);
    const values = batch.map((row) => {
      const tarea = row[5] ?? "";
      const horas = HORA_COLS.map((_, idx) => Number(row[11 + idx]) || 0);
      return [
        String(row[0] ?? ""),         // funcion
        String(row[1] ?? ""),         // funcion_desc
        Number(row[2]) || 0,          // fecha
        String(row[3] ?? ""),         // turno
        String(row[4] ?? ""),         // turno_desc
        tarea,                        // tarea
        String(row[6] ?? ""),         // operario
        String(row[7] ?? ""),         // nombre
        Number(row[8]) || 0,          // actividad
        String(row[9] ?? ""),         // circuito
        Number(row[10]) || 0,         // tiempo_mue
        ...horas,                     // hora_00 .. hora_23
        Number(row[35]) || 0,         // total
      ];
    });

    // Build batch insert with positional params
    const cols = [
      "funcion", "funcion_desc", "fecha", "turno", "turno_desc", "tarea",
      "operario", "nombre", "actividad", "circuito", "tiempo_mue",
      ...HORA_COLS,
      "total",
    ];

    const placeholders = values
      .map((_, rowIdx) =>
        `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`
      )
      .join(", ");

    const insertSQL = `INSERT INTO production_records (${cols.join(", ")}) VALUES ${placeholders}`;
    const flatArgs = values.flat();

    await sql.unsafe(insertSQL, flatArgs);

    inserted += batch.length;
    process.stdout.write(`\r  Insertados: ${inserted}/${dataRows.length}`);
  }

  console.log(`\n  ✅ production_records: ${inserted} registros`);
}

async function seedClarkistas(sql) {
  const filePath = path.join(process.cwd(), "upload", "clarkistas.xlsx");
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠️ No se encontró clarkistas.xlsx, saltando...");
    return;
  }

  console.log("📦 Seeding clarkistas_records...");
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 12);
  console.log(`  ${dataRows.length} registros para insertar`);

  await sql`DELETE FROM clarkistas_records`;

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
    await sql.unsafe(insertSQL, values.flat());

    inserted += batch.length;
    process.stdout.write(`\r  Insertados: ${inserted}/${dataRows.length}`);
  }

  console.log(`\n  ✅ clarkistas_records: ${inserted} registros`);
}

async function seedTiemposMuertos(sql) {
  const filePath = path.join(process.cwd(), "upload", "TM -  01-07-26 al 14-07-26.xlsx");
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠️ No se encontró archivo de Tiempos Muertos, saltando...");
    return;
  }

  console.log("📦 Seeding tiempos_muertos...");
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 5);
  console.log(`  ${dataRows.length} registros para insertar`);

  await sql`DELETE FROM tiempos_muertos`;

  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
    const batch = dataRows.slice(i, i + BATCH_SIZE);
    const values = batch.map((row) => [
      Number(row[0]) || 0,   // fecha
      String(row[1] ?? ""),  // turno
      String(row[2] ?? ""),  // operario
      String(row[3] ?? ""),  // nombre
      String(row[4] ?? ""),  // estado
      Number(row[5]) || null, // motivo
      Number(row[6]) || 0,   // minutos
      String(row[7] ?? ""),  // observacion
      String(row[8] ?? ""),  // usuario_alta
    ]);

    const cols = ["fecha", "turno", "operario", "nombre", "estado", "motivo", "minutos", "observacion", "usuario_alta"];
    const placeholders = values
      .map((_, rowIdx) =>
        `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`
      )
      .join(", ");

    const insertSQL = `INSERT INTO tiempos_muertos (${cols.join(", ")}) VALUES ${placeholders}`;
    await sql.unsafe(insertSQL, values.flat());

    inserted += batch.length;
    process.stdout.write(`\r  Insertados: ${inserted}/${dataRows.length}`);
  }

  console.log(`\n  ✅ tiempos_muertos: ${inserted} registros`);
}

async function seedErrores(sql) {
  const filePath = path.join(process.cwd(), "upload", "Errores de Preparacion.xlsx");
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠️ No se encontró archivo de Errores, saltando...");
    return;
  }

  console.log("📦 Seeding errores_records...");
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 5);
  console.log(`  ${dataRows.length} registros para insertar`);

  await sql`DELETE FROM errores_records`;

  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
    const batch = dataRows.slice(i, i + BATCH_SIZE);
    const values = batch.map((row) => [
      Number(row[0]) || 0,       // fecha_prep
      Number(row[1]) || 0,       // fecha_ctrl
      String(row[2] ?? ""),      // id_operario
      String(row[3] ?? ""),      // tipo_control
      String(row[4] ?? ""),      // controlador
      String(row[5] ?? ""),      // codigo_producto
      String(row[6] ?? ""),      // producto
      Number(row[7]) || 1,       // errores
      String(row[8] ?? ""),      // motivo
    ]);

    const cols = ["fecha_prep", "fecha_ctrl", "id_operario", "tipo_control", "controlador", "codigo_producto", "producto", "errores", "motivo"];
    const placeholders = values
      .map((_, rowIdx) =>
        `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`
      )
      .join(", ");

    const insertSQL = `INSERT INTO errores_records (${cols.join(", ")}) VALUES ${placeholders}`;
    await sql.unsafe(insertSQL, values.flat());

    inserted += batch.length;
    process.stdout.write(`\r  Insertados: ${inserted}/${dataRows.length}`);
  }

  console.log(`\n  ✅ errores_records: ${inserted} registros`);
}

async function seedRendimientos(sql) {
  const filePath = path.join(process.cwd(), "upload", "Rendimientos.xlsx");
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠️ No se encontró archivo de Rendimientos, saltando...");
    return;
  }

  console.log("📦 Seeding rendimientos_records...");
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 5);
  console.log(`  ${dataRows.length} registros para insertar`);

  await sql`DELETE FROM rendimientos_records`;

  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
    const batch = dataRows.slice(i, i + BATCH_SIZE);
    const values = batch.map((row) => [
      String(row[0] ?? ""),      // nombre
      String(row[1] ?? ""),      // dia
      Number(row[2]) || null,    // fecha
      Number(row[3]) || 0,       // bultos
      Number(row[4]) || 0,       // hs_brutas
      Number(row[5]) || 0,       // tm_hs
      Number(row[6]) || 0,       // hs_netas
      Number(row[7]) || 0,       // produccion
      Number(row[8]) || 0,       // bh_bruta
      Number(row[9]) || 0,       // bh_neta
    ]);

    const cols = ["nombre", "dia", "fecha", "bultos", "hs_brutas", "tm_hs", "hs_netas", "produccion", "bh_bruta", "bh_neta"];
    const placeholders = values
      .map((_, rowIdx) =>
        `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`
      )
      .join(", ");

    const insertSQL = `INSERT INTO rendimientos_records (${cols.join(", ")}) VALUES ${placeholders}`;
    await sql.unsafe(insertSQL, values.flat());

    inserted += batch.length;
    process.stdout.write(`\r  Insertados: ${inserted}/${dataRows.length}`);
  }

  console.log(`\n  ✅ rendimientos_records: ${inserted} registros`);
}

async function seedHorasExtras(sql) {
  const filePath = path.join(process.cwd(), "upload", "horas extras.xlsx");
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠️ No se encontró archivo de Horas Extras, saltando...");
    return;
  }

  console.log("📦 Seeding horas_extras_records...");
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 5);
  console.log(`  ${dataRows.length} registros para insertar`);

  await sql`DELETE FROM horas_extras_records`;

  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
    const batch = dataRows.slice(i, i + BATCH_SIZE);
    const values = batch.map((row) => [
      Number(row[0]) || null,    // cod_empleado
      String(row[1] ?? ""),      // empresa
      String(row[2] ?? ""),      // nombre
      String(row[3] ?? ""),      // sector
      Number(row[4]) || null,    // fecha
      String(row[5] ?? ""),      // dia
      Number(row[6]) || 0,       // hs_trabajadas
      Number(row[7]) || 0,       // hs_extras_50
      Number(row[8]) || 0,       // hs_extras_100
      Number(row[9]) || 0,       // hs_noct_100
      Number(row[10]) || 0,      // hs_noc_trab
      String(row[11] ?? ""),     // jornada
    ]);

    const cols = ["cod_empleado", "empresa", "nombre", "sector", "fecha", "dia", "hs_trabajadas", "hs_extras_50", "hs_extras_100", "hs_noct_100", "hs_noc_trab", "jornada"];
    const placeholders = values
      .map((_, rowIdx) =>
        `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`
      )
      .join(", ");

    const insertSQL = `INSERT INTO horas_extras_record (${cols.join(", ")}) VALUES ${placeholders}`;
    await sql.unsafe(insertSQL, values.flat());

    inserted += batch.length;
    process.stdout.write(`\r  Insertados: ${inserted}/${dataRows.length}`);
  }

  console.log(`\n  ✅ horas_extras_records: ${inserted} registros`);
}

async function main() {
  console.log("🚀 Seeding Neon PostgreSQL with data from Excel files...\n");
  
  const sql = neon(DATABASE_URL);

  await seedProductionRecords(sql);
  console.log("");
  await seedClarkistas(sql);
  console.log("");
  await seedTiemposMuertos(sql);
  console.log("");
  await seedErrores(sql);
  console.log("");
  await seedRendimientos(sql);
  console.log("");
  await seedHorasExtras(sql);

  // Summary
  console.log("\n📊 Verifying row counts...");
  const tables = [
    "production_records",
    "clarkistas_records",
    "tiempos_muertos",
    "nomina_override",
    "errores_records",
    "rendimientos_records",
    "horas_extras_records",
  ];

  for (const table of tables) {
    const result = await sql.unsafe(`SELECT COUNT(*) as cnt FROM ${table}`);
    console.log(`  ${table}: ${result[0]?.cnt || 0} rows`);
  }

  console.log("\n✅ Seed complete!");
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
