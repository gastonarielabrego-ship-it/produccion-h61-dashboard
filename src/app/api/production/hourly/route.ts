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

    // Aggregate hourly production
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

    const hourlyData = Object.entries(hourlyTotals).map(([hour, quantity]) => ({
      hour: `${hour.padStart(2, "0")}:00`,
      hourNum: Number(hour),
      quantity,
    }));

    const circuitData = Object.entries(circuitBreakdown)
      .map(([circuito, total]) => ({ circuito, total }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      totalRecords: records.length,
      grandTotal,
      hourlyData,
      circuitData,
    });
  } catch (error) {
    console.error("Error fetching hourly production:", error);
    return NextResponse.json(
      { error: "Error fetching production data" },
      { status: 500 }
    );
  }
}