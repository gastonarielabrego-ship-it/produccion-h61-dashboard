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

    // Step 1: Find the true first active hour per (date, operario) across ALL their records
    const firstHourMap: Record<string, number> = {};
    // Track operario name
    const nameMap: Record<string, string> = {};

    for (const r of records) {
      const key = `${r.date}:${r.operario}`;
      nameMap[r.operario] = r.nombre;
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
    const eligible6 = new Set<string>();
    const eligible10 = new Set<string>();
    const eligible18 = new Set<string>();

    for (const [key, fh] of Object.entries(firstHourMap)) {
      // Franja 6-10: personal que tiene bultos ANTES de las 6 y se queda hasta las 10
      if (fh < 6) eligible6.add(key);
      // Franja 10-14: personal que inicia exactamente a las 10
      if (fh === 10) eligible10.add(key);
      // Franja 18-22: personal que inicia exactamente a las 18
      if (fh === 18) eligible18.add(key);
    }

    // Step 3: Aggregate bultos per operario, per window, only for eligible people
    const opBultos6: Record<string, number> = {};
    const opBultos10: Record<string, number> = {};
    const opBultos18: Record<string, number> = {};
    let bultos6_10 = 0;
    let bultos10_14 = 0;
    let bultos18_22 = 0;

    for (const r of records) {
      const key = `${r.date}:${r.operario}`;

      if (eligible6.has(key)) {
        for (const hd of r.hourlyData) {
          if (window6Hours.has(hd.hour)) {
            const q = hd.quantity;
            bultos6_10 += q;
            opBultos6[r.operario] = (opBultos6[r.operario] || 0) + q;
          }
        }
      }

      if (eligible10.has(key)) {
        for (const hd of r.hourlyData) {
          if (window1Hours.has(hd.hour)) {
            const q = hd.quantity;
            bultos10_14 += q;
            opBultos10[r.operario] = (opBultos10[r.operario] || 0) + q;
          }
        }
      }

      if (eligible18.has(key)) {
        for (const hd of r.hourlyData) {
          if (window2Hours.has(hd.hour)) {
            const q = hd.quantity;
            bultos18_22 += q;
            opBultos18[r.operario] = (opBultos18[r.operario] || 0) + q;
          }
        }
      }
    }

    const misiones6 = eligible6.size;
    const misiones10 = eligible10.size;
    const misiones18 = eligible18.size;

    // Build full operator list sorted by bultos
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