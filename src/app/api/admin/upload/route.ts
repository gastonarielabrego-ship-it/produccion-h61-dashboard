import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const PRODUCTION_DDL = `
CREATE TABLE IF NOT EXISTS production_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  funcion     TEXT    NOT NULL,
  funcion_desc TEXT   NOT NULL,
  fecha       INTEGER NOT NULL,
  turno       TEXT    NOT NULL,
  turno_desc  TEXT    NOT NULL,
  operario    TEXT    NOT NULL,
  nombre      TEXT    NOT NULL,
  actividad   INTEGER NOT NULL DEFAULT 0,
  circuito    TEXT    NOT NULL,
  tiempo_mue  INTEGER NOT NULL DEFAULT 0,
  hora_00     INTEGER NOT NULL DEFAULT 0,
  hora_01     INTEGER NOT NULL DEFAULT 0,
  hora_02     INTEGER NOT NULL DEFAULT 0,
  hora_03     INTEGER NOT NULL DEFAULT 0,
  hora_04     INTEGER NOT NULL DEFAULT 0,
  hora_05     INTEGER NOT NULL DEFAULT 0,
  hora_06     INTEGER NOT NULL DEFAULT 0,
  hora_07     INTEGER NOT NULL DEFAULT 0,
  hora_08     INTEGER NOT NULL DEFAULT 0,
  hora_09     INTEGER NOT NULL DEFAULT 0,
  hora_10     INTEGER NOT NULL DEFAULT 0,
  hora_11     INTEGER NOT NULL DEFAULT 0,
  hora_12     INTEGER NOT NULL DEFAULT 0,
  hora_13     INTEGER NOT NULL DEFAULT 0,
  hora_14     INTEGER NOT NULL DEFAULT 0,
  hora_15     INTEGER NOT NULL DEFAULT 0,
  hora_16     INTEGER NOT NULL DEFAULT 0,
  hora_17     INTEGER NOT NULL DEFAULT 0,
  hora_18     INTEGER NOT NULL DEFAULT 0,
  hora_19     INTEGER NOT NULL DEFAULT 0,
  hora_20     INTEGER NOT NULL DEFAULT 0,
  hora_21     INTEGER NOT NULL DEFAULT 0,
  hora_22     INTEGER NOT NULL DEFAULT 0,
  hora_23     INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_prod_fecha ON production_records(fecha);
CREATE INDEX IF NOT EXISTS idx_prod_turno ON production_records(turno);
CREATE INDEX IF NOT EXISTS idx_prod_circuito ON production_records(circuito);
CREATE INDEX IF NOT EXISTS idx_prod_operario ON production_records(operario);
CREATE INDEX IF NOT EXISTS idx_prod_fecha_turno ON production_records(fecha, turno);
`;

let _tableReady = false;
async function ensureTable() {
  if (_tableReady) return;
  const client = getClient();
  for (const stmt of PRODUCTION_DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await client.execute(stmt);
  }
  _tableReady = true;
}

export async function GET() {
  try {
    await ensureTable();
    const client = getClient();
    const result = await client.execute("SELECT COUNT(*) as cnt FROM production_records");
    return NextResponse.json({ ok: true, count: Number(result.rows[0]?.cnt ?? 0) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// Ultra-optimized: client sends pre-parsed rows, server does minimal round-trips.
// Strategy: 1 transaction, 1 DELETE, 1-2 giant INSERTs. ~4 round-trips total.
export async function POST(request: Request) {
  const t0 = Date.now();
  try {
    await ensureTable();

    const body = await request.json();
    const rows: (string | number | null | undefined)[][] = body.rows;

    if (!rows || rows.length < 2) {
      return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
    }

    // Header mapping
    const header = rows[0].map((c) => String(c ?? "").toUpperCase().trim());
    const colIdx: Record<string, number> = {};
    header.forEach((h, i) => {
      if (h === "NOIMBRE" || h === "NMBRE") colIdx["NOMBRE"] = i;
      else if (h === "FUNCION_DESC" || h === "FUNCION DESCRIPCION" || h === "FUNCIONDESC") colIdx["FUNCION_DESC"] = i;
      else if (h === "TURNO_DESC" || h === "TURNO DESCRIPCION" || h === "TURNODESC") colIdx["TURNO_DESC"] = i;
      else if (h === "TIEMPO_MUE" || h === "TIEMPO_MUESTRA" || h === "T_MUE") colIdx["TIEMPO_MUE"] = i;
      else colIdx[h] = i;
    });

    const required = ["FUNCION","FUNCION_DESC","FECHA","TURNO","TURNO_DESC","OPERARIO","NOMBRE","ACTIVIDAD","CIRCUITO","TIEMPO_MUE","TOTAL"];
    const missing = required.filter((r) => !(r in colIdx));
    if (missing.length > 0) {
      return NextResponse.json({
        error: `Faltan columnas: ${missing.join(", ")}. Encontradas: ${header.filter(Boolean).join(", ")}`
      }, { status: 400 });
    }

    const hourCols: number[] = [];
    for (let h = 0; h <= 23; h++) {
      hourCols.push(colIdx[`HORA_${String(h).padStart(2, "0")}`] ?? -1);
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

    // Filter valid rows
    const dataRows = rows.slice(1).filter((r) => {
      const fecha = getVal(r, colIdx["FECHA"]);
      const operario = getStr(r, colIdx["OPERARIO"]);
      return fecha > 0 && operario.length > 0;
    });

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "No hay filas válidas (fecha y operario vacíos)" }, { status: 400 });
    }

    // Extract unique dates
    const dateSet = new Set<number>();
    const allArgs: (string | number)[][] = [];

    for (const row of dataRows) {
      const fecha = getVal(row, colIdx["FECHA"]);
      dateSet.add(fecha);

      const args: (string | number)[] = [
        getStr(row, colIdx["FUNCION"]),
        getStr(row, colIdx["FUNCION_DESC"]),
        fecha,
        getStr(row, colIdx["TURNO"]),
        getStr(row, colIdx["TURNO_DESC"]),
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

    const fileDates = [...dateSet].filter(Boolean);
    const client = getClient();

    // MINIMAL ROUND-TRIPS: 1 transaction, 1 DELETE, 1 giant INSERT, 1 COMMIT = ~4 total
    await client.execute("BEGIN TRANSACTION");

    // Delete old records for uploaded dates
    if (fileDates.length > 0) {
      const ph = fileDates.map((_, i) => `$d${i}`).join(",");
      const dp: Record<string, number> = {};
      fileDates.forEach((d, i) => { dp[`d${i}`] = d; });
      await client.execute({
        sql: `DELETE FROM production_records WHERE fecha IN (${ph})`,
        args: dp,
      });
    }

    // Single massive INSERT — all rows in ONE statement
    const cols = "funcion, funcion_desc, fecha, turno, turno_desc, operario, nombre, actividad, circuito, tiempo_mue, total, hora_00, hora_01, hora_02, hora_03, hora_04, hora_05, hora_06, hora_07, hora_08, hora_09, hora_10, hora_11, hora_12, hora_13, hora_14, hora_15, hora_16, hora_17, hora_18, hora_19, hora_20, hora_21, hora_22, hora_23";
    const ph = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    // Split into at most 2 batches (500 each) to avoid SQL size limits
    const MAX_BATCH = 500;
    if (allArgs.length <= MAX_BATCH) {
      // One single INSERT — 1 round-trip
      const sql = `INSERT INTO production_records (${cols}) VALUES ${allArgs.map(() => ph).join(", ")}`;
      await client.execute({ sql, args: allArgs.flat() });
    } else {
      // Two INSERTs — 2 round-trips
      for (let i = 0; i < allArgs.length; i += MAX_BATCH) {
        const batch = allArgs.slice(i, i + MAX_BATCH);
        const sql = `INSERT INTO production_records (${cols}) VALUES ${batch.map(() => ph).join(", ")}`;
        await client.execute({ sql, args: batch.flat() });
      }
    }

    await client.execute("COMMIT");

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    return NextResponse.json({
      message: `${allArgs.length.toLocaleString("es-AR")} registros cargados en ${elapsed}s — ${fileDates.length} fechas`,
      inserted: allArgs.length,
      dates: fileDates.sort(),
      elapsed: `${elapsed}s`,
    });
  } catch (error: any) {
    try { await getClient().execute("ROLLBACK"); } catch {}
    console.error("Upload production error:", error);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    return NextResponse.json(
      { error: error.message || "Error al procesar", elapsed: `${elapsed}s` },
      { status: 500 }
    );
  }
}
