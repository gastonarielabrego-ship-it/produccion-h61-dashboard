import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

const HORA_COLS = Array.from({ length: 24 }, (_, i) => `hora_${String(i).padStart(2, "0")}`);
const ALL_COLS = [
  "funcion", "funcion_desc", "fecha", "turno", "turno_desc", "tarea",
  "operario", "nombre", "actividad", "circuito", "tiempo_mue",
  ...HORA_COLS,
  "total",
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo." },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Solo se aceptan archivos .xlsx o .xls" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets["Datos"];

    if (!sheet) {
      return NextResponse.json(
        { error: 'No se encontró la hoja "Datos" en el archivo' },
        { status: 400 }
      );
    }

    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
    });

    const dataRows = rows.slice(1).filter((r) => r && r.length >= 12);

    if (dataRows.length === 0) {
      return NextResponse.json(
        { error: "El archivo no contiene registros válidos" },
        { status: 400 }
      );
    }

    const client = getClient();

    // Extract unique dates from the uploaded file
    const uploadedDates = new Set<number>();
    for (const row of dataRows) {
      const fecha = Number(row[2]);
      if (fecha) uploadedDates.add(fecha);
    }
    const dateList = Array.from(uploadedDates).sort();

    // Check which dates already exist
    let existingCount = 0;
    if (dateList.length > 0) {
      const placeholders = dateList.map(() => "?").join(", ");
      const existing = await client.execute({
        sql: `SELECT DISTINCT fecha FROM production_records WHERE fecha IN (${placeholders})`,
        args: dateList,
      });
      existingCount = existing.rows.length;

      // Delete only the dates that are being re-uploaded (pisar)
      if (existing.rows.length > 0) {
        const existDates = existing.rows.map((r) => Number(r.fecha));
        const delPlaceholders = existDates.map(() => "?").join(", ");
        await client.execute({
          sql: `DELETE FROM production_records WHERE fecha IN (${delPlaceholders})`,
          args: existDates,
        });
      }
    }

    // Insert all rows from the file
    const BATCH_SIZE = 200;
    let inserted = 0;

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const values = batch.map((row) => {
        const tarea = row[5] ?? null;
        const horas = HORA_COLS.map((_, idx) => Number(row[11 + idx]) || 0);
        return [
          String(row[0] ?? ""),
          String(row[1] ?? ""),
          Number(row[2]) || 0,
          String(row[3] ?? ""),
          String(row[4] ?? ""),
          tarea,
          String(row[6] ?? ""),
          String(row[7] ?? ""),
          Number(row[8]) || 0,
          String(row[9] ?? ""),
          Number(row[10]) || 0,
          ...horas,
          Number(row[35]) || 0,
        ];
      });

      const placeholders = values
        .map(
          (_, rowIdx) =>
            `(${ALL_COLS.map((_, colIdx) => `$${rowIdx * ALL_COLS.length + colIdx + 1}`).join(", ")})`
        )
        .join(", ");

      const sql = `INSERT INTO production_records (${ALL_COLS.join(", ")}) VALUES ${placeholders}`;
      await client.execute({ sql, args: values.flat() });

      inserted += batch.length;
    }

    const newDates = dateList.length - existingCount;
    const msg = existingCount > 0
      ? `${inserted.toLocaleString("es-AR")} registros: ${newDates} fecha${newDates !== 1 ? "s" : ""} nueva${newDates !== 1 ? "s" : ""} + ${existingCount} fecha${existingCount !== 1 ? "s" : ""} actualizada${existingCount !== 1 ? "s" : ""}`
      : `${inserted.toLocaleString("es-AR")} registros (${dateList.length} fecha${dateList.length !== 1 ? "s" : ""} nueva${dateList.length !== 1 ? "s" : ""})`;

    return NextResponse.json({
      success: true,
      message: msg,
      inserted,
      datesInFile: dateList.length,
      datesReplaced: existingCount,
      datesAdded: newDates,
    });
  } catch (error: any) {
    console.error("Error uploading Excel:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar el archivo" },
      { status: 500 }
    );
  }
}