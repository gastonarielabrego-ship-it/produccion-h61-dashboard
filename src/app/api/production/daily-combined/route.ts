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

    // 1) Aggregate daily production (bultos)
    const dailyTotals: Record<number, number> = {};

    let grandTotal = 0;

    for (const record of records) {
      grandTotal += record.total;
      dailyTotals[record.date] = (dailyTotals[record.date] || 0) + record.total;
    }

    // 2) Count unique operarios per shift per day
    const shiftDayMissions: Record<string, Record<number, Set<string>>> = {};

    for (const r of records) {
      if (!shiftDayMissions[r.turno]) {
        shiftDayMissions[r.turno] = {};
      }
      if (!shiftDayMissions[r.turno][r.date]) {
        shiftDayMissions[r.turno][r.date] = new Set();
      }
      if (r.total > 0) {
        shiftDayMissions[r.turno][r.date].add(r.operario);
      }
    }

    const shifts = Object.keys(shiftDayMissions).sort();

    // 3) Build combined daily data points
    const sortedDates = Object.keys(dailyTotals)
      .map(Number)
      .sort((a, b) => a - b);

    const dailyData: Record<string, string | number>[] = [];
    for (const date of sortedDates) {
      const s = String(date);
      const dayLabel = `${s.slice(6, 8)}/${s.slice(4, 6)}`;
      const point: Record<string, string | number> = {
        day: dayLabel,
        dateNum: date,
        bultos: dailyTotals[date],
      };
      for (const shift of shifts) {
        const label = SHIFT_LABELS[shift] || shift;
        point[label] = shiftDayMissions[shift]?.[date]?.size || 0;
      }
      dailyData.push(point);
    }

    const shiftTotals = shifts.map((s) => {
      const label = SHIFT_LABELS[s] || s;
      const total = sortedDates.reduce(
        (sum, d) => sum + (shiftDayMissions[s]?.[d]?.size || 0),
        0
      );
      return { turno: s, label, total };
    });

    return NextResponse.json({
      totalRecords: records.length,
      grandTotal,
      dailyData,
      shifts: shiftTotals,
    });
  } catch (error) {
    console.error("Error fetching daily combined:", error);
    return NextResponse.json(
      { error: "Error fetching combined daily data" },
      { status: 500 }
    );
  }
}