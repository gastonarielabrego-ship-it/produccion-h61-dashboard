import {
  getAllRecords,
  parseFilters,
  applyFilters,
} from "@/lib/google-sheets";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const allRecords = await getAllRecords();
    const records = applyFilters(allRecords, filters);

    // Group by circuit and hour
    const circuitHourly: Record<string, Record<number, number>> = {};

    for (const record of records) {
      if (!circuitHourly[record.circuito]) {
        const obj: Record<number, number> = {};
        for (let h = 0; h <= 23; h++) obj[h] = 0;
        circuitHourly[record.circuito] = obj;
      }
      for (const hd of record.hourlyData) {
        circuitHourly[record.circuito][hd.hour] += hd.quantity;
      }
    }

    const circuits = Object.keys(circuitHourly).sort();
    const hourlyData: Record<string, string | number>[] = [];
    for (let h = 0; h <= 23; h++) {
      const point: Record<string, string | number> = {
        hour: `${String(h).padStart(2, "0")}:00`,
        hourNum: h,
      };
      for (const c of circuits) {
        point[c] = circuitHourly[c][h];
      }
      hourlyData.push(point);
    }

    const circuitTotals = circuits
      .map((c) => ({
        circuito: c,
        total: Object.values(circuitHourly[c]).reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      circuits,
      circuitTotals,
      hourlyData,
    });
  } catch (error) {
    console.error("Error fetching by-circuit:", error);
    return NextResponse.json(
      { error: "Error fetching circuit data" },
      { status: 500 }
    );
  }
}