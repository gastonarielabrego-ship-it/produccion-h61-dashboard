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

    // Count unique (date, operario) per shift per hour
    const shiftHourMissions: Record<string, Record<number, Set<string>>> = {};

    for (const r of records) {
      if (!shiftHourMissions[r.turno]) {
        const obj: Record<number, Set<string>> = {};
        for (let h = 0; h <= 23; h++) obj[h] = new Set();
        shiftHourMissions[r.turno] = obj;
      }
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) {
          shiftHourMissions[r.turno][hd.hour].add(`${r.date}:${r.operario}`);
        }
      }
    }

    const shifts = Object.keys(shiftHourMissions).sort();
    const hourlyData: Record<string, string | number>[] = [];
    for (let h = 0; h <= 23; h++) {
      const point: Record<string, string | number> = {
        hour: `${String(h).padStart(2, "0")}:00`,
        hourNum: h,
      };
      for (const s of shifts) {
        const label = SHIFT_LABELS[s] || s;
        point[label] = shiftHourMissions[s][h].size;
      }
      hourlyData.push(point);
    }

    const shiftTotals = shifts.map((s) => ({
      turno: s,
      label: SHIFT_LABELS[s] || s,
      total: Object.values(shiftHourMissions[s]).reduce(
        (sum, set) => sum + set.size,
        0
      ),
    }));

    return NextResponse.json({
      shifts: shiftTotals,
      hourlyData,
    });
  } catch (error) {
    console.error("Error fetching missions-hourly:", error);
    return NextResponse.json(
      { error: "Error fetching missions hourly data" },
      { status: 500 }
    );
  }
}