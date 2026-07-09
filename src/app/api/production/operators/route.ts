import {
  getAllRecords,
  parseFilters,
} from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const records = await getAllRecords(filters);

    // Aggregate per operator: total production + unique (date, hour) with activity
    const opMap: Record<string, {
      operario: string;
      nombre: string;
      total: number;
      activeSlots: Set<string>;
    }> = {};

    for (const r of records) {
      if (!opMap[r.operario]) {
        opMap[r.operario] = {
          operario: r.operario,
          nombre: r.nombre,
          total: 0,
          activeSlots: new Set(),
        };
      }
      opMap[r.operario].total += r.total;

      // Count unique (date, hour) slots where operator had production > 0
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) {
          opMap[r.operario].activeSlots.add(`${r.date}:${hd.hour}`);
        }
      }
    }

    const allOperators = Object.values(opMap)
      .map((op) => ({
        operario: op.operario,
        nombre: op.nombre,
        total: op.total,
        horasConectado: op.activeSlots.size,
      }))
      .sort((a, b) => b.total - a.total);

    const topOperators = allOperators.slice(0, 20);
    const bottomOperators = [...allOperators]
      .reverse()
      .slice(0, 20)
      .sort((a, b) => b.total - a.total); // keep ascending order by total (least first)

    return NextResponse.json({
      operators: topOperators,
      bottomOperators,
    });
  } catch (error) {
    console.error("Error fetching operators:", error);
    return NextResponse.json(
      { error: "Error fetching operators" },
      { status: 500 }
    );
  }
}