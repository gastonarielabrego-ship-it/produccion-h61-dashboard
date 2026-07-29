import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const TM_DDL = `
CREATE TABLE IF NOT EXISTS tiempos_muertos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha       INTEGER NOT NULL,
  turno       TEXT    NOT NULL,
  operario    TEXT    NOT NULL,
  nombre      TEXT    NOT NULL,
  estado      TEXT,
  motivo      INTEGER,
  minutos     INTEGER NOT NULL DEFAULT 0,
  observacion TEXT,
  usuario_alta TEXT
);
CREATE INDEX IF NOT EXISTS idx_tm_fecha ON tiempos_muertos(fecha);
CREATE INDEX IF NOT EXISTS idx_tm_operario ON tiempos_muertos(operario);
CREATE INDEX IF NOT EXISTS idx_tm_fecha_operario ON tiempos_muertos(fecha, operario);
`;

let _tableReady = false;
async function ensureTable() {
  if (_tableReady) return;
  const client = getClient();
  for (const stmt of TM_DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await client.execute(stmt);
  }
  _tableReady = true;
}

export async function GET() {
  try {
    await ensureTable();
    const client = getClient();
    const result = await client.execute("SELECT COUNT(*) as cnt FROM tiempos_muertos");
    return NextResponse.json({ ok: true, count: Number(result.rows[0]?.cnt ?? 0) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const t0 = Date.now();
  try {
    await ensureTable();

    const body = await request.json();
    const rows: (string | number | null | undefined)[][] = body.rows;

    if (!rows || rows.length < 2) {
      return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
    }

    const header = rows[0].map((c) => String(c ?? "").toUpperCase().trim());
    const colIdx: Record<string, number> = {};
    header.forEach((h, i) => { colIdx[h] = i; });

    const required = ["FECHA", "TURNO", "OPERARIO", "NOMBRE", "MINUTOS"];
    const missing = required.filter((r) => !(r in colIdx));
    if (missing.length > 0) {
      return NextResponse.json({
        error: `Faltan columnas: ${missing.join(", ")}. Encontradas: ${header.filter(Boolean).join(", ")}`
      }, { status: 400 });
    }

    const getVal = (row: (string | number | null | undefined)[], ci: number): number => {
      if (ci < 0 || ci >= row.length) return 0;
      const v = row[ci];
      return v === null || v === undefined ? 0 : Number(v) || 0;
    };
    const getStr = (row: (string | number | null | undefined)[], ci: number): string => {
      if (ci < 0 || ci >= row.length) return "";
      const v = row[ci];
      return v === null || v === undefined ? "" : String(v).trim();
    };

    const dataRows = rows.slice(1).filter((r) => getVal(r, colIdx["MINUTOS"]) > 0);

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "No hay filas con minutos > 0" }, { status: 400 });
    }

    const dateSet = new Set<number>();
    const allArgs: (string | number | null)[][] = [];

    for (const row of dataRows) {
      const fecha = getVal(row, colIdx["FECHA"]);
      dateSet.add(fecha);
      allArgs.push([
        fecha,
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

    const fileDates = [...dateSet].filter(Boolean);
    const client = getClient();

    await client.execute("BEGIN TRANSACTION");

    if (fileDates.length > 0) {
      const ph = fileDates.map((_, i) => `$d${i}`).join(",");
      const dp: Record<string, number> = {};
      fileDates.forEach((d, i) => { dp[`d${i}`] = d; });
      await client.execute({
        sql: `DELETE FROM tiempos_muertos WHERE fecha IN (${ph})`,
        args: dp,
      });
    }

    const cols = "fecha, turno, operario, nombre, estado, motivo, minutos, observacion, usuario_alta";
    const ph = "(?, ?, ?, ?, ?, ?, ?, ?, ?)";

    const BATCH = 200;
    for (let i = 0; i < allArgs.length; i += BATCH) {
      const batch = allArgs.slice(i, i + BATCH);
      const sql = `INSERT INTO tiempos_muertos (${cols}) VALUES ${batch.map(() => ph).join(", ")}`;
      await client.execute({ sql, args: batch.flat() });
    }

    await client.execute("COMMIT");

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    return NextResponse.json({
      message: `${allArgs.length.toLocaleString("es-AR")} tiempos muertos cargados en ${elapsed}s`,
      inserted: allArgs.length,
      dates: fileDates.sort(),
      elapsed: `${elapsed}s`,
    });
  } catch (error: any) {
    try { await getClient().execute("ROLLBACK"); } catch {}
    console.error("Upload TM error:", error);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    return NextResponse.json(
      { error: error.message || "Error al procesar", elapsed: `${elapsed}s` },
      { status: 500 }
    );
  }
}
