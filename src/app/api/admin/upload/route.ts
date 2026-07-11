import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const maxDuration = 60;

export async function GET() {
  try {
    const client = getClient();
    const result = await client.execute("SELECT COUNT(*) as cnt FROM production_records");
    const count = Number(result.rows[0]?.cnt ?? 0);
    return NextResponse.json({ ok: true, count });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Read file from FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se recibió el archivo" }, { status: 400 });
    }

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();
    const raw = new Uint8Array(buffer);

    // Parse xlsx
    const wb = XLSX.read(raw, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (rows.length < 2) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
    }

    // Header mapping
    const header = rows[0].map((c) => String(c ?? "").toUpperCase().trim());
    const colIdx: Record<string, number> = {};
    header.forEach((h, i) => { colIdx[h] = i; });

    const required = ["FUNCION","FUNCION_DESC","FECHA","TURNO","TURNO_DESC","OPERARIO","NOMBRE","ACTIVIDAD","CIRCUITO","TIEMPO_MUE","TOTAL"];
    const missing = required.filter((r) => !(r in colIdx));
    if (missing.length > 0) {
      return NextResponse.json({ error: `Faltan columnas: ${missing.join(", ")}` }, { status: 400 });
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

    const dataRows = rows.slice(1);

    // Collect unique dates
    const fileDates = [...new Set(dataRows.map(r => getVal(r, colIdx["FECHA"])))].filter(Boolean);

    const client = getClient();

    // Delete old records for the dates in this file
    if (fileDates.length > 0) {
      const ph = fileDates.map((_, i) => `$d${i}`).join(",");
      const dp: Record<string, number> = {};
      fileDates.forEach((d, i) => { dp[`d${i}`] = d; });
      await client.execute({
        sql: `DELETE FROM production_records WHERE fecha IN (${ph})`,
        args: dp,
      });
    }

    // Build INSERT SQL
    const insertSql = `INSERT INTO production_records
      (funcion, funcion_desc, fecha, turno, turno_desc, operario, nombre, actividad, circuito, tiempo_mue, total,
       hora_00, hora_01, hora_02, hora_03, hora_04, hora_05, hora_06, hora_07, hora_08, hora_09,
       hora_10, hora_11, hora_12, hora_13, hora_14, hora_15, hora_16, hora_17, hora_18, hora_19,
       hora_20, hora_21, hora_22, hora_23)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?)`;

    const buildArgs = (row: (string | number | null | undefined)[]): (string | number)[] => {
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

    // Process in chunks of 500 rows to avoid timeouts
    const CHUNK_SIZE = 500;
    let totalInserted = 0;

    for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
      const chunk = dataRows.slice(i, i + CHUNK_SIZE);
      const statements = chunk.map(row => ({
        sql: insertSql,
        args: buildArgs(row),
      }));
      await client.batch(statements as any);
      totalInserted += chunk.length;
    }

    return NextResponse.json({
      message: `${totalInserted.toLocaleString("es-AR")} registros cargados correctamente`,
      inserted: totalInserted,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar el archivo" },
      { status: 500 }
    );
  }
}