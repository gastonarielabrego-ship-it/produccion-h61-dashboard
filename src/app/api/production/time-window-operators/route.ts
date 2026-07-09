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

    // Missions: unique (fecha, operario) whose first active hour of the day is 10 or 18
    const missionSet = new Set<string>();

    // Bultos totals
    let bultos10_14 = 0;
    let bultos18_22 = 0;

    // Track first active hour per (date, operario)
    const firstHourMap: Record<string, number> = {};

    for (const r of records) {
      // Find first active hour for this record
      let firstHour = -1;
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) {
          firstHour = hd.hour;
          break;
        }
      }

      const key = `${r.date}:${r.operario}`;

      // Track earliest first active hour for this (date, operario)
      if (firstHour >= 0) {
        if (!(key in firstHourMap) || firstHour < firstHourMap[key]) {
          firstHourMap[key] = firstHour;
        }
      }

      // Count bultos in each window
      for (const hd of r.hourlyData) {
        if (window1Hours.has(hd.hour)) {
          bultos10_14 += hd.quantity;
        }
        if (window2Hours.has(hd.hour)) {
          bultos18_22 += hd.quantity;
        }
      }
    }

    // Missions = people whose earliest first hour of the day is 10 or 18
    for (const [key, fh] of Object.entries(firstHourMap)) {
      if (fh === 10 || fh === 18) {
        missionSet.add(key);
      }
    }

    return NextResponse.json({
      misiones: missionSet.size,
      bultos10_14,
      bultos18_22,
    });
  } catch (error) {
    console.error("Error fetching franjas:", error);
    return NextResponse.json(
      { error: "Error fetching franjas data" },
      { status: 500 }
    );
  }
}