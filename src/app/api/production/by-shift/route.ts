import {
  getAllRecords,
  getSourceTable,
  parseFilters,
} from "@/lib/turso";
import { NextResponse } from "next/server";

const SHIFT_LABELS: Record<string, string> = {
  M: "Mañana",
  T: "Tarde",
  N: "Noche",
};

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const records = await getAllRecords(filters, tableName);

    // Group by shift and hour — actividad
    const shiftHourlyAct: Record<string, Record<number, number>> = {};

    for (const record of records) {
      if (!shiftHourlyAct[record.turno]) {
        const obj: Record<number, number> = {};
        for (let h = 0; h <= 23; h++) obj[h] = 0;
        shiftHourlyAct[record.turno] = obj;
      }
      // Add actividad to each hour where the operator had production
      for (const hd of record.hourlyData) {
        if (hd.quantity > 0) {
          shiftHourlyAct[record.turno][hd.hour] += record.actividad;
        }
      }
    }

    const shifts = Object.keys(shiftHourlyAct).sort();
    const hourlyData: Record<string, string | number>[] = [];
    for (let h = 0; h <= 23; h++) {
      const point: Record<string, string | number> = {
        hour: `${String(h).padStart(2, "0")}:00`,
        hourNum: h,
      };
      for (const s of shifts) {
        const label = SHIFT_LABELS[s] || s;
        point[label] = shiftHourlyAct[s][h];
      }
      hourlyData.push(point);
    }

    const shiftTotals = shifts.map((s) => ({
      turno: s,
      label: SHIFT_LABELS[s] || s,
      total: Object.values(shiftHourlyAct[s]).reduce((sum, v) => sum + v, 0),
    }));

    return NextResponse.json({
      shifts: shiftTotals,
      hourlyData,
    });
  } catch (error) {
    console.error("Error fetching by-shift:", error);
    return NextResponse.json(
      { error: "Error fetching shift data" },
      { status: 500 }
    );
  }
}