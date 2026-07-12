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

    // 1) Aggregate hourly production (bultos)
    const hourlyTotals: Record<number, number> = {};
    for (let h = 0; h <= 23; h++) hourlyTotals[h] = 0;

    let grandTotal = 0;
    const circuitBreakdown: Record<string, number> = {};

    for (const record of records) {
      grandTotal += record.total;
      circuitBreakdown[record.circuito] =
        (circuitBreakdown[record.circuito] || 0) + record.total;

      for (const hd of record.hourlyData) {
        hourlyTotals[hd.hour] += hd.quantity;
      }
    }

    // 2) Count unique (date, operario) per shift per hour (misiones)
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

    // 3) Build combined hourly data points
    const hourlyData: Record<string, string | number>[] = [];
    for (let h = 0; h <= 23; h++) {
      const point: Record<string, string | number> = {
        hour: `${String(h).padStart(2, "0")}:00`,
        hourNum: h,
        bultos: hourlyTotals[h],
      };
      for (const s of shifts) {
        const label = SHIFT_LABELS[s] || s;
        point[label] = shiftHourMissions[s][h].size;
      }
      hourlyData.push(point);
    }

    const circuitData = Object.entries(circuitBreakdown)
      .map(([circuito, total]) => ({ circuito, total }))
      .sort((a, b) => b.total - a.total);

    const shiftTotals = shifts.map((s) => ({
      turno: s,
      label: SHIFT_LABELS[s] || s,
      total: Object.values(shiftHourMissions[s]).reduce(
        (sum, set) => sum + set.size,
        0
      ),
    }));

    return NextResponse.json({
      totalRecords: records.length,
      grandTotal,
      hourlyData,
      circuitData,
      shifts: shiftTotals,
    });
  } catch (error) {
    console.error("Error fetching hourly combined:", error);
    return NextResponse.json(
      { error: "Error fetching combined hourly data" },
      { status: 500 }
    );
  }
}