/**
 * Load h61.xlsx into production_records table directly using the same logic
 * as the /api/admin/upload route.
 * 
 * Usage: node --import tsx scripts/load-production.ts
 */

import * as XLSX from "xlsx";
import pg from "pg";

const TABLE = "production_records";
const COLS = "funcion, funcion_desc, fecha, turno, turno_desc, tarea, operario, nombre, actividad, circuito, tiempo_mue, total, hora_00, hora_01, hora_02, hora_03, hora_04, hora_05, hora_06, hora_07, hora_08, hora_09, hora_10, hora_11, hora_12, hora_13, hora_14, hora_15, hora_16, hora_17, hora_18, hora_19, hora_20, hora_21, hora_22, hora_23";
const NUM_COLS = 36;
const FILE = "/home/z/my-project/upload/h61.xlsx";

const HEADER_FIXES: Record<string, string> = {
  NOIMBRE: "NOMBRE", NMBRE: "NOMBRE",
  "FUNCION_DESC": "FUNCION_DESC", "FUNCION DESCRIPCION": "FUNCION_DESC", FUNCIONDESC: "FUNCION_DESC",
  "TURNO_DESC": "TURNO_DESC", "TURNO DESCRIPCION": "TURNO_DESC", TURNODESC: "TURNO_DESC",
  "TIEMPO_MUE": "TIEMPO_MUE", "TIEMPO_MUESTRA": "TIEMPO_MUE", T_MUE: "TIEMPO_MUE",
};

function buildColIdx(header: string[]): Record<string, number> {
  const colIdx: Record<string, number> = {};
  header.forEach((h, i) => {
    const fixed = HEADER_FIXES[h] || h;
    colIdx[fixed] = i;
  });
  return colIdx;
}

function getVal(row: (string | number | null | undefined)[], ci: number): number {
  if (ci < 0 || ci >= row.length) return 0;
  const v = row[ci];
  return v === null || v === undefined ? 0 : Number(v) || 0;
}

function getStr(row: (string | number | null | undefined)[], ci: number): string {
  if (ci < 0 || ci >= row.length) return "";
  const v = row[ci];
  return v === null || v === undefined ? "" : String(v).trim();
}

function buildBatchInsert(cols: number, batch: (string | number | null)[][]): { sql: string; params: (string | number | null)[] } {
  const pgPhArr: string[] = [];
  const pgFlat: (string | number | null)[] = [];
  for (let j = 0; j < batch.length; j++) {
    const rowPh = batch[j].map((_, k) => `$${j * cols + k + 1}`).join(",");
    pgPhArr.push(`(${rowPh})`);
    for (let k = 0; k < batch[j].length; k++) pgFlat.push(batch[j][k]);
  }
  return { sql: pgPhArr.join(", "), params: pgFlat };
}

async function main() {
  const t0 = Date.now();
  console.log("Reading", FILE, "...");

  // Parse Excel
  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (allRows.length < 2) {
    console.error("File has insufficient data");
    process.exit(1);
  }

  const header = allRows[0].map((c) => String(c ?? "").toUpperCase().trim());
  const colIdx = buildColIdx(header);

  const required = ["FUNCION", "FUNCION_DESC", "FECHA", "TURNO", "TURNO_DESC", "OPERARIO", "NOMBRE", "ACTIVIDAD", "CIRCUITO", "TIEMPO_MUE", "TOTAL"];
  const missing = required.filter((r) => !(r in colIdx));
  if (missing.length > 0) {
    console.error("Missing columns:", missing.join(", "));
    console.error("Found:", header.filter(Boolean).join(", "));
    process.exit(1);
  }

  const hourCols: number[] = [];
  for (let h = 0; h <= 23; h++) {
    hourCols.push(colIdx[`HORA_${String(h).padStart(2, "0")}`] ?? -1);
  }

  const tareaCol = colIdx["TAREA"];
  const allArgs: (string | number | null)[][] = [];
  const dateSet = new Set<number>();

  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i];
    const fecha = getVal(row, colIdx["FECHA"]);
    const operario = getStr(row, colIdx["OPERARIO"]);
    if (fecha <= 0 || operario.length === 0) continue;

    dateSet.add(fecha);

    const args: (string | number | null)[] = [
      getStr(row, colIdx["FUNCION"]),
      getStr(row, colIdx["FUNCION_DESC"]),
      fecha,
      getStr(row, colIdx["TURNO"]),
      getStr(row, colIdx["TURNO_DESC"]),
      tareaCol !== undefined ? (getStr(row, tareaCol) || null) : null,
      getStr(row, colIdx["OPERARIO"]),
      getStr(row, colIdx["NOMBRE"]),
      getVal(row, colIdx["ACTIVIDAD"]),
      getStr(row, colIdx["CIRCUITO"]),
      getVal(row, colIdx["TIEMPO_MUE"]),
      getVal(row, colIdx["TOTAL"]),
    ];
    for (let h = 0; h <= 23; h++) args.push(getVal(row, hourCols[h]));
    allArgs.push(args);
  }

  console.log(`Parsed ${allArgs.length} valid rows across ${dateSet.size} dates`);

  // Connect to DB
  const url = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_1Pu5tKnkvcpD@ep-orange-pond-awso2777-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require";
  console.log("DB URL prefix:", url.substring(0, 30) + "...");
  if (!url) {
    console.error("Missing DATABASE_URL env var");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  try {
    // Delete existing records for these dates
    const dates = [...dateSet];
    console.log(`Deleting existing records for ${dates.length} dates...`);
    const placeholders = dates.map((_, i) => `$${i + 1}`).join(",");
    const delResult = await pool.query(
      `DELETE FROM ${TABLE} WHERE fecha IN (${placeholders})`,
      dates,
    );
    console.log(`Deleted ${delResult.rowCount ?? 0} existing records`);

    // Insert in chunks of 200
    const CHUNK = 200;
    let inserted = 0;

    for (let start = 0; start < allArgs.length; start += CHUNK) {
      const batch = allArgs.slice(start, start + CHUNK);
      const { sql: ph, params: flat } = buildBatchInsert(NUM_COLS, batch);
      await pool.query(
        `INSERT INTO ${TABLE} (${COLS}) VALUES ${ph}`,
        flat,
      );
      inserted += batch.length;
      console.log(`  Inserted ${inserted}/${allArgs.length}...`);
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`Done! ${inserted} records inserted in ${elapsed}s`);

    // Verify
    const countResult = await pool.query(`SELECT COUNT(*) as cnt FROM ${TABLE}`);
    console.log(`Total records in ${TABLE}: ${countResult.rows[0]?.cnt}`);

  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
