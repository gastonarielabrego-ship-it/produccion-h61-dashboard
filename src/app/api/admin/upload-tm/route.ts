import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// ─── Chunked upload (same pattern) ───

const COLS = "fecha, turno, operario, nombre, estado, motivo, minutos, observacion, usuario_alta";
const PH = "(?, ?, ?, ?, ?, ?, ?, ?, ?)";

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

async function handleDelete(dates: number[]): Promise<{ message: string; deletedDates: number[] }> {
  const client = getClient();
  if (dates.length === 0) return { message: "Sin fechas para borrar", deletedDates: [] };

  const ph = dates.map((_, i) => `$d${i}`).join(",");
  const dp: Record<string, number> = {};
  dates.forEach((d, i) => { dp[`d${i}`] = d; });

  const result = await client.execute({
    sql: `DELETE FROM tiempos_muertos WHERE fecha IN (${ph})`,
    args: dp,
  });

  return { message: `${result.rowsAffected ?? "?"} registros previos eliminados`, deletedDates: dates };
}

async function handleInsert(rows: (string | number | null | undefined)[][]): Promise<{ inserted: number; elapsed: string }> {
  const t0 = Date.now();

  if (!rows || rows.length < 2) throw new Error("Datos insuficientes para insertar");

  const header = rows[0].map((c) => String(c ?? "").toUpperCase().trim());
  const colIdx: Record<string, number> = {};
  header.forEach((h, i) => { colIdx[h] = i; });

  const required = ["FECHA", "TURNO", "OPERARIO", "NOMBRE", "MINUTOS"];
  const missing = required.filter((r) => !(r in colIdx));
  if (missing.length > 0) {
    throw new Error(`Faltan columnas: ${missing.join(", ")}. Encontradas: ${header.filter(Boolean).join(", ")}`);
  }

  const allArgs: (string | number | null)[][] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (getVal(row, colIdx["MINUTOS"]) <= 0) continue;

    allArgs.push([
      getVal(row, colIdx["FECHA"]),
      getStr(row, colIdx["TURNO"]),
      getStr(row, colIdx["OPERARIO"]),
      getStr(row, colIdx["NOMBRE"]),
      getStr(row, colIdx["ESTADO"]) || null,
      getVal(row, colIdx["MOTIVO"]) || null,
      getVal(row, colIdx["MINUTOS"]),
      getStr(row, colIdx["OBSERVACION"]) || null,
      getStr(row, colIdx["USUARIO_ALTA"]) || null,
    ]);
  }

  if (allArgs.length === 0) throw new Error("No hay filas con minutos > 0 en este bloque");

  const client = getClient();
  const sql = `INSERT INTO tiempos_muertos (${COLS}) VALUES ${allArgs.map(() => PH).join(", ")}`;
  await client.execute({ sql, args: allArgs.flat() });

  return { inserted: allArgs.length, elapsed: `${((Date.now() - t0) / 1000).toFixed(1)}s` };
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
    console.error("Upload TM error:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar", elapsed: `${((Date.now() - t0) / 1000).toFixed(1)}s` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const client = getClient();
    const result = await client.execute("SELECT COUNT(*) as cnt FROM tiempos_muertos");
    return NextResponse.json({ ok: true, count: Number(result.rows[0]?.cnt ?? 0) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
