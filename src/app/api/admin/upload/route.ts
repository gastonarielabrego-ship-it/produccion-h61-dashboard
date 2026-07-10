import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data: base64, name } = body;

    if (!base64 || !name) {
      return NextResponse.json(
        { error: "Archivo no proporcionado" },
        { status: 400 }
      );
    }

    // Decode base64
    const buffer = Buffer.from(base64, "base64");

    // Parse xlsx
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as (string | number | null)[][];

    if (rows.length < 2) {
      return NextResponse.json(
        { error: "El archivo está vacío o no tiene datos" },
        { status: 400 }
      );
    }

    // Validate header
    const header = rows[0].map((c) => String(c).toUpperCase().trim());
    const required = [
      "FUNCION", "FUNCION_DESC", "FECHA", "TURNO", "TURNO_DESC",
      "OPERARIO", "NOMBRE", "ACTIVIDAD", "CIRCUITO", "TIEMPO_MUE", "TOTAL",
    ];
    const missing = required.filter((r) => !header.includes(r));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Faltan columnas: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Map header to column indices
    const colIdx: Record<string, number> = {};
    header.forEach((h, i) => {
      colIdx[h] = i;
    });

    // Build hour column indices
    const hourCols: number[] = [];
    for (let h = 0; h <= 23; h++) {
      const colName = `HORA_${String(h).padStart(2, "0")}`;
      if (colIdx[colName] !== undefined) {
        hourCols.push(colIdx[colName]);
      } else {
        hourCols.push(-1);
      }
    }

    const dataRows = rows.slice(1);

    // Collect unique dates from file
    const fileDates = new Set<number>();
    for (const row of dataRows) {
      const fechaIdx = colIdx["FECHA"];
      if (fechaIdx !== undefined && fechaIdx < row.length) {
        const v = Number(row[fechaIdx]);
        if (v) fileDates.add(v);
      }
    }
    const dateList = [...fileDates];

    const client = getClient();

    // Delete existing records for those dates
    if (dateList.length > 0) {
      const placeholders = dateList.map((_, i) => `$d${i}`).join(", ");
      const deleteParams: Record<string, number> = {};
      dateList.forEach((d, i) => {
        deleteParams[`d${i}`] = d;
      });
      await client.execute({
        sql: `DELETE FROM production_records WHERE fecha IN (${placeholders})`,
        args: deleteParams,
      });
    }

    // Build INSERT statement (simple, no conflict since we deleted first)
    const insertSql = `
      INSERT INTO production_records
        (funcion, funcion_desc, fecha, turno, turno_desc, operario, nombre, actividad, circuito, tiempo_mue, total,
         hora_00, hora_01, hora_02, hora_03, hora_04, hora_05, hora_06, hora_07, hora_08, hora_09,
         hora_10, hora_11, hora_12, hora_13, hora_14, hora_15, hora_16, hora_17, hora_18, hora_19,
         hora_20, hora_21, hora_22, hora_23)
      VALUES (
        $funcion, $funcion_desc, $fecha, $turno, $turno_desc, $operario, $nombre, $actividad, $circuito, $tiempo_mue, $total,
        $hora_00, $hora_01, $hora_02, $hora_03, $hora_04, $hora_05, $hora_06, $hora_07, $hora_08, $hora_09,
        $hora_10, $hora_11, $hora_12, $hora_13, $hora_14, $hora_15, $hora_16, $hora_17, $hora_18, $hora_19,
        $hora_20, $hora_21, $hora_22, $hora_23
      )
    `;

    let inserted = 0;
    let errors = 0;

    // Process in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const statements = batch.map((row) => {
        const getVal = (colIndex: number) => {
          if (colIndex < 0 || colIndex >= row.length) return 0;
          const v = row[colIndex];
          return v === null || v === undefined ? 0 : Number(v) || 0;
        };
        const getStr = (colIndex: number) => {
          if (colIndex < 0 || colIndex >= row.length) return "";
          const v = row[colIndex];
          return v === null || v === undefined ? "" : String(v).trim();
        };

        const params: Record<string, string | number> = {
          funcion: getStr(colIdx["FUNCION"]),
          funcion_desc: getStr(colIdx["FUNCION_DESC"]),
          fecha: getVal(colIdx["FECHA"]),
          turno: getStr(colIdx["TURNO"]),
          turno_desc: getStr(colIdx["TURNO_DESC"]),
          operario: getStr(colIdx["OPERARIO"]),
          nombre: getStr(colIdx["NOMBRE"]),
          actividad: getVal(colIdx["ACTIVIDAD"]),
          circuito: getStr(colIdx["CIRCUITO"]),
          tiempo_mue: getVal(colIdx["TIEMPO_MUE"]),
          total: getVal(colIdx["TOTAL"]),
        };

        for (let h = 0; h <= 23; h++) {
          params[`hora_${String(h).padStart(2, "0")}`] = getVal(hourCols[h]);
        }

        return { sql: insertSql, args: params };
      });

      try {
        await client.batch(statements, { mode: "sequential" });
        inserted += batch.length;
      } catch (err: any) {
        console.error(`Batch error at row ${i}:`, err.message);
        errors += batch.length;
      }
    }

    return NextResponse.json({
      message: `${inserted.toLocaleString("es-AR")} registros cargados (${errors > 0 ? `con ${errors} errores` : "sin errores"})`,
      inserted,
      errors,
      total: dataRows.length,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar el archivo" },
      { status: 500 }
    );
  }
}