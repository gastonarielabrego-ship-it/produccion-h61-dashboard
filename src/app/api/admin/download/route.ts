import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

const HORA_COLS = Array.from({ length: 24 }, (_, i) => `HORA_${String(i).padStart(2, "0")}`);
const HEADER = [
  "FUNCION", "FUNCION_DESC", "FECHA", "TURNO", "TURNO_DESC", "TAREA",
  "OPERARIO", "NOMBRE", "ACTIVIDAD", "CIRCUITO", "TIEMPO_MUE",
  ...HORA_COLS,
  "TOTAL",
];

export async function GET() {
  try {
    const client = getClient();
    const result = await client.execute("SELECT * FROM production_records ORDER BY fecha, turno, operario");

    // Build worksheet data
    const wsData: (string | number | null)[][] = [HEADER];

    for (const row of result.rows) {
      const wsRow: (string | number | null)[] = [
        String(row.funcion ?? ""),
        String(row.funcion_desc ?? ""),
        Number(row.fecha) || 0,
        String(row.turno ?? ""),
        String(row.turno_desc ?? ""),
        row.tarea ? String(row.tarea) : null,
        String(row.operario ?? ""),
        String(row.nombre ?? ""),
        Number(row.actividad) || 0,
        String(row.circuito ?? ""),
        Number(row.tiempo_mue) || 0,
      ];

      for (let h = 0; h <= 23; h++) {
        wsRow.push(Number(row[`hora_${String(h).padStart(2, "0")}`]) || 0);
      }

      wsRow.push(Number(row.total) || 0);
      wsData.push(wsRow);
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws["!cols"] = [
      { wch: 8 },   // FUNCION
      { wch: 20 },  // FUNCION_DESC
      { wch: 12 },  // FECHA
      { wch: 6 },   // TURNO
      { wch: 10 },  // TURNO_DESC
      { wch: 20 },  // TAREA
      { wch: 10 },  // OPERARIO
      { wch: 30 },  // NOMBRE
      { wch: 10 },  // ACTIVIDAD
      { wch: 10 },  // CIRCUITO
      { wch: 12 },  // TIEMPO_MUE
      ...Array(24).fill({ wch: 8 }), // HORA_00..23
      { wch: 10 },  // TOTAL
    ];

    // Freeze header
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, "Datos");

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Get date range for filename
    const dates = result.rows.map((r) => Number(r.fecha)).filter(Boolean);
    const minDate = dates.length ? Math.min(...dates) : 0;
    const maxDate = dates.length ? Math.max(...dates) : 0;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="produccion_h61_${minDate}_${maxDate}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Error downloading data:", error);
    return NextResponse.json(
      { error: error.message || "Error al generar la descarga" },
      { status: 500 }
    );
  }
}