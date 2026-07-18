import {
  getAllRecords,
  getSourceTable,
  parseFilters,
} from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const records = await getAllRecords(filters, tableName);

    const window6Hours = new Set([6, 7, 8, 9]);     // 6-10 hs
    const window1Hours = new Set([10, 11, 12, 13]);  // 10-14 hs
    const window2Hours = new Set([18, 19, 20, 21]);  // 18-22 hs

    // Track operario name
    const nameMap: Record<string, string> = {};

    // Sets of (date, operario) that actually produced bultos in each window
    const active6 = new Set<string>();
    const active10 = new Set<string>();
    const active18 = new Set<string>();

    // Bultos per operario per window (aggregated across dates)
    const opBultos6: Record<string, number> = {};
    const opBultos10: Record<string, number> = {};
    const opBultos18: Record<string, number> = {};
    let bultos6_10 = 0;
    let bultos10_14 = 0;
    let bultos18_22 = 0;

    for (const r of records) {
      const key = `${r.date}:${r.operario}`;
      nameMap[r.operario] = r.nombre;

      // Window 6-10
      let q6 = 0;
      for (const hd of r.hourlyData) {
        if (window6Hours.has(hd.hour)) {
          q6 += hd.quantity;
        }
      }
      if (q6 > 0) {
        active6.add(key);
        bultos6_10 += q6;
        opBultos6[r.operario] = (opBultos6[r.operario] || 0) + q6;
      }

      // Window 10-14
      let q10 = 0;
      for (const hd of r.hourlyData) {
        if (window1Hours.has(hd.hour)) {
          q10 += hd.quantity;
        }
      }
      if (q10 > 0) {
        active10.add(key);
        bultos10_14 += q10;
        opBultos10[r.operario] = (opBultos10[r.operario] || 0) + q10;
      }

      // Window 18-22
      let q18 = 0;
      for (const hd of r.hourlyData) {
        if (window2Hours.has(hd.hour)) {
          q18 += hd.quantity;
        }
      }
      if (q18 > 0) {
        active18.add(key);
        bultos18_22 += q18;
        opBultos18[r.operario] = (opBultos18[r.operario] || 0) + q18;
      }
    }

    // Misiones = unique (date, operario) pairs with actual production in window
    const misiones6 = active6.size;
    const misiones10 = active10.size;
    const misiones18 = active18.size;

    // Build full operator list sorted by bultos (only those with production)
    const buildList = (bultosMap: Record<string, number>) =>
      Object.entries(bultosMap)
        .map(([operario, total]) => ({
          operario,
          nombre: nameMap[operario] || operario,
          total,
        }))
        .sort((a, b) => b.total - a.total);

    const operators6 = buildList(opBultos6);
    const operators10 = buildList(opBultos10);
    const operators18 = buildList(opBultos18);

    return NextResponse.json({
      misiones6,
      misiones10,
      misiones18,
      bultos6_10,
      bultos10_14,
      bultos18_22,
      produccion6: misiones6 > 0 ? Math.round((bultos6_10 / misiones6) / 4) : 0,
      produccion10: misiones10 > 0 ? Math.round((bultos10_14 / misiones10) / 4) : 0,
      produccion18: misiones18 > 0 ? Math.round((bultos18_22 / misiones18) / 4) : 0,
      operators6,
      operators10,
      operators18,
    });
  } catch (error) {
    console.error("Error fetching franjas:", error);
    return NextResponse.json(
      { error: "Error fetching franjas data" },
      { status: 500 }
    );
  }
}