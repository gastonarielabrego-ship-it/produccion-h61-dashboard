import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const maxDuration = 60;

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

    const required = ["FUNCION", "FUNCION_DESC", "FECHA", "TURNO", "TURNO_DESC", "OPERARIO", "NOMBRE", "ACTIVIDAD", "CIRCUITO", "TIEMPO_MUE", "TOTAL"];
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

    // Collect unique dates to delete old records for those dates
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

    // Multi-row INSERT in chunks of 150 to avoid Turso limits
    const CHUNK = 150;
    let totalInserted = 0;

    for (let i = 0; i < dataRows.length; i += CHUNK) {
      const chunk = dataRows.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => {
        const qs = new Array(35).fill("?");
        return `(${qs.join(", ")})`;
      }).join(", ");

      const sql = `INSERT INTO production_records
        (funcion, funcion_desc, fecha, turno, turno_desc, operario, nombre, actividad, circuito, tiempo_mue, total,
         hora_00, hora_01, hora_02, hora_03, hora_04, hora_05, hora_06, hora_07, hora_08, hora_09,
         hora_10, hora_11, hora_12, hora_13, hora_14, hora_15, hora_16, hora_17, hora_18, hora_19,
         hora_20, hora_21, hora_22, hora_23)
        VALUES ${placeholders}`;

      const args: (string | number)[] = [];
      for (const row of chunk) {
        args.push(
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
        );
        for (let h = 0; h <= 23; h++) args.push(getVal(row, hourCols[h]));
      }

      await client.execute({ sql, args });
      totalInserted += chunk.length;
    }

    const uniqueDates = fileDates.length;
    return NextResponse.json({
      message: `${totalInserted.toLocaleString("es-AR")} registros cargados (${uniqueDates} ${uniqueDates === 1 ? "día" : "días"})`,
      inserted: totalInserted,
      dates: uniqueDates,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar el archivo" },
      { status: 500 }
    );
  }
}