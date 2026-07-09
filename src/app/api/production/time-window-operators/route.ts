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

    // Step 1: Find the true first active hour per (date, operario) across ALL their records
    const firstHourMap: Record<string, number> = {};

    for (const r of records) {
      const key = `${r.date}:${r.operario}`;
      let recordFirst = -1;
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) {
          recordFirst = hd.hour;
          break;
        }
      }
      if (recordFirst >= 0) {
        if (!(key in firstHourMap) || recordFirst < firstHourMap[key]) {
          firstHourMap[key] = recordFirst;
        }
      }
    }

    // Step 2: Identify eligible (date, operario) for each window
    // Only those whose FIRST active hour of the day is EXACTLY 10 or 18
    const eligible10 = new Set<string>();
    const eligible18 = new Set<string>();

    for (const [key, fh] of Object.entries(firstHourMap)) {
      if (fh === 10) eligible10.add(key);
      if (fh === 18) eligible18.add(key);
    }

    // Step 3: Count bultos ONLY from eligible people
    let bultos10_14 = 0;
    let bultos18_22 = 0;

    for (const r of records) {
      const key = `${r.date}:${r.operario}`;

      if (eligible10.has(key)) {
        for (const hd of r.hourlyData) {
          if (window1Hours.has(hd.hour)) {
            bultos10_14 += hd.quantity;
          }
        }
      }

      if (eligible18.has(key)) {
        for (const hd of r.hourlyData) {
          if (window2Hours.has(hd.hour)) {
            bultos18_22 += hd.quantity;
          }
        }
      }
    }

    const misiones10 = eligible10.size;
    const misiones18 = eligible18.size;

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