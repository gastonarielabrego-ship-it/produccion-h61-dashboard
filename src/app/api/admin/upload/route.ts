import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

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

async function ensureTable() {
  const client = getClient();
  for (const stmt of PRODUCTION_DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await client.execute(stmt);
  }
}

export async function GET() {
  try {
    await ensureTable();
    const client = getClient();
    const result = await client.execute("SELECT COUNT(*) as cnt FROM production_records");
    const count = Number(result.rows[0]?.cnt ?? 0);
    return NextResponse.json({ ok: true, count });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const t0 = Date.now();
  let log: string[] = [];

  try {
    await ensureTable();
    log.push(`Tabla verificada en ${Date.now() - t0}ms`);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se recibió el archivo" }, { status: 400 });
    }

    log.push(`Archivo: ${file.name}, ${(file.size / 1024).toFixed(0)} KB`);

    const buffer = await file.arrayBuffer();
    const raw = new Uint8Array(buffer);

    const wb = XLSX.read(raw, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    log.push(`Hoja "${wb.SheetNames[0]}": ${rows.length} filas leídas`);

    if (rows.length < 2) {
      return NextResponse.json({ error: "El archivo tiene datos insuficientes (solo encabezado)" }, { status: 400 });
    }

    // Header mapping — handle typos and variations
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

    // Skip empty/invalid rows
    const dataRows = rows.slice(1).filter((r) => {
      const fecha = getVal(r, colIdx["FECHA"]);
      const operario = getStr(r, colIdx["OPERARIO"]);
      return fecha > 0 && operario.length > 0;
    });

    log.push(`${dataRows.length} filas válidas de ${rows.length - 1} totales`);

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "No se encontraron filas válidas (fecha y operario vacíos)" }, { status: 400 });
    }

    const fileDates = [...new Set(dataRows.map((r) => getVal(r, colIdx["FECHA"])))].filter(Boolean);
    log.push(`Fechas en archivo: ${fileDates.length} (${fileDates.sort().map(String).join(", ")})`);

    const client = getClient();

    // Count before
    const countBefore = await client.execute("SELECT COUNT(*) as cnt FROM production_records");
    const beforeCount = Number(countBefore.rows[0]?.cnt ?? 0);

    // Delete old records for the dates in this file
    let deletedCount = 0;
    if (fileDates.length > 0) {
      const ph = fileDates.map((_, i) => `$d${i}`).join(",");
      const dp: Record<string, number> = {};
      fileDates.forEach((d, i) => { dp[`d${i}`] = d; });
      const delResult = await client.execute({
        sql: `DELETE FROM production_records WHERE fecha IN (${ph})`,
        args: dp,
      });
      deletedCount = delResult.rowsAffected ?? 0;
      log.push(`Eliminados ${deletedCount} registros previos`);
    }

    const cols = "funcion, funcion_desc, fecha, turno, turno_desc, operario, nombre, actividad, circuito, tiempo_mue, total, hora_00, hora_01, hora_02, hora_03, hora_04, hora_05, hora_06, hora_07, hora_08, hora_09, hora_10, hora_11, hora_12, hora_13, hora_14, hora_15, hora_16, hora_17, hora_18, hora_19, hora_20, hora_21, hora_22, hora_23";
    const placeholders = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    const buildRowArgs = (row: (string | number | null | undefined)[]): (string | number)[] => {
      const args: (string | number)[] = [
        getStr(row, colIdx["FUNCION"]),
        getStr(row, colIdx["FUNCION_DESC"]),
        getVal(row, colIdx["FECHA"]),
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
      return args;
    };

    // Insert in smaller chunks with error handling
    const CHUNK = 50;
    let totalInserted = 0;
    let chunksDone = 0;
    const totalChunks = Math.ceil(dataRows.length / CHUNK);

    for (let i = 0; i < dataRows.length; i += CHUNK) {
      const chunk = dataRows.slice(i, i + CHUNK);
      const valueGroups = chunk.map(() => placeholders).join(", ");
      const sql = `INSERT INTO production_records (${cols}) VALUES ${valueGroups}`;
      const args = chunk.flatMap(buildRowArgs);
      try {
        await client.execute({ sql, args });
        totalInserted += chunk.length;
      } catch (chunkErr: any) {
        // If batch fails, try row by row
        log.push(`Chunk ${chunksDone + 1} falló (${chunkErr.message}), insertando de a uno...`);
        for (const row of chunk) {
          try {
            const rowArgs = buildRowArgs(row);
            await client.execute({
              sql: `INSERT INTO production_records (${cols}) VALUES ${placeholders}`,
              args: rowArgs,
            });
            totalInserted++;
          } catch (rowErr: any) {
            log.push(`Fila error: ${rowErr.message}`);
          }
        }
      }
      chunksDone++;
    }

    log.push(`${chunksDone}/${totalChunks} chunks procesados`);

    // Verify: count after
    const countAfter = await client.execute("SELECT COUNT(*) as cnt FROM production_records");
    const afterCount = Number(countAfter.rows[0]?.cnt ?? 0);
    log.push(`DB: ${beforeCount} -> ${afterCount} registros`);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    return NextResponse.json({
      message: `${totalInserted.toLocaleString("es-AR")} registros cargados (${elapsed}s) — ${fileDates.length} fechas`,
      inserted: totalInserted,
      deleted: deletedCount,
      dbTotal: afterCount,
      dates: fileDates.sort(),
      elapsed: `${elapsed}s`,
      log: log,
    });
  } catch (error: any) {
    console.error("Upload production error:", error);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    return NextResponse.json(
      { 
        error: `${error.message || "Error al procesar"}`,
        elapsed: `${elapsed}s`,
        log: log,
      },
      { status: 500 }
    );
  }
}
