import {
  getAllRecords,
  parseFilters,
} from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const records = await getAllRecords(filters);

    const window1Hours = new Set([10, 11, 12, 13]);
    const window2Hours = new Set([18, 19, 20, 21]);

    // Track first active hour per (date, operario)
    const firstHourMap: Record<string, number> = {};

    // Bultos per (date, operario, window)
    const bultosW1: Record<string, number> = {};
    const bultosW2: Record<string, number> = {};

    for (const r of records) {
      let firstHour = -1;
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) {
          firstHour = hd.hour;
          break;
        }
      }

      const key = `${r.date}:${r.operario}`;

      if (firstHour >= 0) {
        if (!(key in firstHourMap) || firstHour < firstHourMap[key]) {
          firstHourMap[key] = firstHour;
        }
      }

      // Accumulate bultos per window per (date, operario)
      for (const hd of r.hourlyData) {
        if (window1Hours.has(hd.hour) && hd.quantity > 0) {
          bultosW1[key] = (bultosW1[key] || 0) + hd.quantity;
        }
        if (window2Hours.has(hd.hour) && hd.quantity > 0) {
          bultosW2[key] = (bultosW2[key] || 0) + hd.quantity;
        }
      }
    }

    // Count missions and bultos for each window
    let misiones10 = 0;
    let misiones18 = 0;
    let bultos10_14 = 0;
    let bultos18_22 = 0;

    for (const [key, fh] of Object.entries(firstHourMap)) {
      if (fh === 10) {
        misiones10 += 1;
        bultos10_14 += bultosW1[key] || 0;
      }
      if (fh === 18) {
        misiones18 += 1;
        bultos18_22 += bultosW2[key] || 0;
      }
    }

    return NextResponse.json({
      misiones10,
      misiones18,
      bultos10_14,
      bultos18_22,
      produccion10: misiones10 > 0 ? Math.round((bultos10_14 / misiones10) / 4) : 0,
      produccion18: misiones18 > 0 ? Math.round((bultos18_22 / misiones18) / 4) : 0,
    });
  } catch (error) {
    console.error("Error fetching franjas:", error);
    return NextResponse.json(
      { error: "Error fetching franjas data" },
      { status: 500 }
    );
  }
}