import { getClient } from "@/lib/neon";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// ─── Chunked upload for production_records (Neon PostgreSQL) ───

const COLS = "funcion, funcion_desc, fecha, turno, turno_desc, tarea, operario, nombre, actividad, circuito, tiempo_mue, total, hora_00, hora_01, hora_02, hora_03, hora_04, hora_05, hora_06, hora_07, hora_08, hora_09, hora_10, hora_11, hora_12, hora_13, hora_14, hora_15, hora_16, hora_17, hora_18, hora_19, hora_20, hora_21, hora_22, hora_23";
const NUM_COLS = 36; // number of columns in production_records

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

// Build PostgreSQL positional placeholders for batch insert
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

async function handleDelete(dates: number[]): Promise<{ message: string; deletedDates: number[] }> {
  const client = getClient();
  if (dates.length === 0) return { message: "Sin fechas para borrar", deletedDates: [] };

  // PostgreSQL positional params
  const placeholders = dates.map((_, i) => `$${i + 1}`).join(",");
  const result = await client.execute(
    `DELETE FROM production_records WHERE fecha IN (${placeholders})`,
    dates,
  );

  return { message: `${result.rowCount ?? "?"} registros previos eliminados`, deletedDates: dates };
}

async function handleInsert(rows: (string | number | null | undefined)[][]): Promise<{ inserted: number; elapsed: string }> {
  const t0 = Date.now();

  if (!rows || rows.length < 2) throw new Error("Datos insuficientes para insertar");

  const header = rows[0].map((c) => String(c ?? "").toUpperCase().trim());
  const colIdx = buildColIdx(header);

  const required = ["FUNCION", "FUNCION_DESC", "FECHA", "TURNO", "TURNO_DESC", "OPERARIO", "NOMBRE", "ACTIVIDAD", "CIRCUITO", "TIEMPO_MUE", "TOTAL"];
  const missing = required.filter((r) => !(r in colIdx));
  if (missing.length > 0) {
    throw new Error(`Faltan columnas: ${missing.join(", ")}. Encontradas: ${header.filter(Boolean).join(", ")}`);
  }

  const hourCols: number[] = [];
  for (let h = 0; h <= 23; h++) {
    hourCols.push(colIdx[`HORA_${String(h).padStart(2, "0")}`] ?? -1);
  }

  const tareaCol = colIdx["TAREA"];
  const allArgs: (string | number | null)[][] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const fecha = getVal(row, colIdx["FECHA"]);
    const operario = getStr(row, colIdx["OPERARIO"]);
    if (fecha <= 0 || operario.length === 0) continue;

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

  if (allArgs.length === 0) throw new Error("No hay filas válidas en este bloque");

  const client = getClient();
  const CHUNK = 200;
  let inserted = 0;

  for (let start = 0; start < allArgs.length; start += CHUNK) {
    const batch = allArgs.slice(start, start + CHUNK);
    const { sql: ph, params: flat } = buildBatchInsert(NUM_COLS, batch);
    await client.execute(
      `INSERT INTO production_records (${COLS}) VALUES ${ph}`,
      flat,
    );
    inserted += batch.length;
  }

  return { inserted, elapsed: `${((Date.now() - t0) / 1000).toFixed(1)}s` };
}

export async function POST(request: Request) {
  const t0 = Date.now();
  try {
    const body = await request.json();
    const action = body.action;

    if (action === "delete") {
      const dates: number[] = body.dates || [];
      const result = await handleDelete(dates);
      return NextResponse.json({ ...result, elapsed: `${((Date.now() - t0) / 1000).toFixed(1)}s` });
    }

    if (action === "insert") {
      const result = await handleInsert(body.rows);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Acción inválida. Usar: delete | insert" }, { status: 400 });
  } catch (error: any) {
    console.error("Upload production error:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar", elapsed: `${((Date.now() - t0) / 1000).toFixed(1)}s` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const client = getClient();
    const result = await client.execute("SELECT COUNT(*) as cnt FROM production_records");
    return NextResponse.json({ ok: true, count: Number(result.rows[0]?.cnt ?? 0) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
