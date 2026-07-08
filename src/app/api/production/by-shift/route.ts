import {
  getAllRecords,
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
    const records = await getAllRecords(filters);

    // Group by shift and hour
    const shiftHourly: Record<string, Record<number, number>> = {};

    for (const record of records) {
      if (!shiftHourly[record.turno]) {
        const obj: Record<number, number> = {};
        for (let h = 0; h <= 23; h++) obj[h] = 0;
        shiftHourly[record.turno] = obj;
      }
      for (const hd of record.hourlyData) {
        shiftHourly[record.turno][hd.hour] += hd.quantity;
      }
    }

    const shifts = Object.keys(shiftHourly).sort();
    const hourlyData: Record<string, string | number>[] = [];
    for (let h = 0; h <= 23; h++) {
      const point: Record<string, string | number> = {
        hour: `${String(h).padStart(2, "0")}:00`,
        hourNum: h,
      };
      for (const s of shifts) {
        const label = SHIFT_LABELS[s] || s;
        point[label] = shiftHourly[s][h];
      }
      hourlyData.push(point);
    }

    const shiftTotals = shifts.map((s) => ({
      turno: s,
      label: SHIFT_LABELS[s] || s,
      total: Object.values(shiftHourly[s]).reduce((sum, v) => sum + v, 0),
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