/**
 * Script para crear la DB en Turso y cargar datos desde el Excel.
 *
 * USO:
 *   1. Crear una DB en Turso:  turso db create produccion-h61
 *   2. Copiar las credenciales al .env.local:
 *      TURSO_DATABASE_URL=libsql://produccion-h61-tu-usuario.turso.io
 *      TURSO_AUTH_TOKEN=tu-token-aqui
 *   3. bun run scripts/seed-turso.ts
 *
 * El script:
 *   - Crea la tabla (si no existe) via schema.sql
 *   - Limpia datos existentes
 *   - Inserta todos los registros del Excel en batches
 */

import * as XLSX from "xlsx";
import { createClient } from "@libsql/client";
import * as path from "path";
import * as fs from "fs";
import { readFileSync } from "fs";

const HORA_COLS = Array.from({ length: 24 }, (_, i) => `hora_${String(i).padStart(2, "0")}`);

async function main() {
  const dbUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !authToken) {
    throw new Error(
      "Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en .env.local"
    );
  }

  console.log(" Conectando a Turso...");
  const client = createClient({ url: dbUrl, authToken });

  // Create schema
  console.log(" Creando tabla e índices...");
  const schemaSql = readFileSync(
    path.join(process.cwd(), "schema.sql"),
    "utf-8"
  );

  // Execute each statement separately
  const statements = schemaSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await client.execute(stmt);
  }
  console.log("   Tabla lista.");

  // Clear existing data
  console.log(" Limpiando datos existentes...");
  await client.execute("DELETE FROM production_records");

  // Read Excel
  console.log(" Leyendo archivo Excel...");
  const filePath = path.join(process.cwd(), "upload", "h61 ver.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets["Datos"];
  if (!sheet) {
    throw new Error('No se encontró la hoja "Datos" en el Excel');
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
  });

  // Skip header row
  const dataRows = rows.slice(1).filter((r) => r && r.length >= 12);
  console.log(`   ${dataRows.length} registros para insertar.`);

  // Insert in batches of 200
  const BATCH_SIZE = 200;
  let inserted = 0;

  for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
    const batch = dataRows.slice(i, i + BATCH_SIZE);
    const values = batch.map((row) => {
      const tarea = row[5] ?? null;
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

    // Build batch insert with numbered params
    const cols = [
      "funcion", "funcion_desc", "fecha", "turno", "turno_desc", "tarea",
      "operario", "nombre", "actividad", "circuito", "tiempo_mue",
      ...HORA_COLS,
      "total",
    ];
    const placeholders = values
      .map(
        (_, rowIdx) =>
          `(${cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(", ")})`
      )
      .join(", ");

    const sql = `INSERT INTO production_records (${cols.join(", ")}) VALUES ${placeholders}`;
    const args = values.flat();

    await client.execute({ sql, args });

    inserted += batch.length;
    process.stdout.write(`\r   Insertados: ${inserted}/${dataRows.length}`);
  }

  console.log(`\n\n Listo! ${inserted} registros en Turso.`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});