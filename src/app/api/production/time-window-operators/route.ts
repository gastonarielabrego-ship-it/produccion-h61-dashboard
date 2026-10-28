import {
  getAggRecords,
  getSourceTable,
  parseFilters,
} from "@/lib/neon";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// PERF: SQL GROUP BY (fecha, operario) instead of fetching every raw row.
export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const rows = await getAggRecords(filters, tableName);

    const window6Hours = new Set([6, 7, 8, 9]);     // 6-10 hs
    const window1Hours = new Set([10, 11, 12, 13]);  // 10-14 hs
    const window2Hours = new Set([18, 19, 20, 21]);  // 18-22 hs

    const nameMap: Record<string, string> = {};

    // Step 1: true first active hour per (date, operario)
    const firstHourMap: Record<string, number> = {};

    for (const r of rows) {
      const key = `${r.fecha}:${r.operario}`;
      nameMap[r.operario] = r.nombre;
      let recordFirst = -1;
      for (let h = 0; h <= 23; h++) {
        if (r.act[h]) {
          recordFirst = h;
          break;
        }
      }
      if (recordFirst >= 0) {
        if (!(key in firstHourMap) || recordFirst < firstHourMap[key]) {
          firstHourMap[key] = recordFirst;
        }
      }
    }

    // Step 2: Eligibility by first active hour
    const eligible6 = new Set<string>();   // first hour < 6
    const eligible10 = new Set<string>();  // first hour = 10
    const eligible18 = new Set<string>();  // first hour = 18

    for (const [key, fh] of Object.entries(firstHourMap)) {
      if (fh < 6) eligible6.add(key);
      if (fh === 10) eligible10.add(key);
      if (fh === 18) eligible18.add(key);
    }

    // Step 3: Aggregate bultos only for eligible operators, and track who actually produced
    const opBultos6: Record<string, number> = {};
    const opBultos10: Record<string, number> = {};
    const opBultos18: Record<string, number> = {};
    let bultos6_10 = 0;
    let bultos10_14 = 0;
    let bultos18_22 = 0;

    const produced6 = new Set<string>();
    const produced10 = new Set<string>();
    const produced18 = new Set<string>();

    for (const r of rows) {
      const key = `${r.fecha}:${r.operario}`;

      if (eligible6.has(key)) {
        let q = 0;
        for (let h = 0; h <= 23; h++) {
          if (window6Hours.has(h)) q += r.hora[h];
        }
        if (q > 0) {
          produced6.add(key);
          bultos6_10 += q;
          opBultos6[r.operario] = (opBultos6[r.operario] || 0) + q;
        }
      }

      if (eligible10.has(key)) {
        let q = 0;
        for (let h = 0; h <= 23; h++) {
          if (window1Hours.has(h)) q += r.hora[h];
        }
        if (q > 0) {
          produced10.add(key);
          bultos10_14 += q;
          opBultos10[r.operario] = (opBultos10[r.operario] || 0) + q;
        }
      }

      if (eligible18.has(key)) {
        let q = 0;
        for (let h = 0; h <= 23; h++) {
          if (window2Hours.has(h)) q += r.hora[h];
        }
        if (q > 0) {
          produced18.add(key);
          bultos18_22 += q;
          opBultos18[r.operario] = (opBultos18[r.operario] || 0) + q;
        }
      }
    }

    // Misiones = eligible AND produced bultos in the window
    const misiones6 = produced6.size;
    const misiones10 = produced10.size;
    const misiones18 = produced18.size;

    // Build full operator list sorted by bultos (only those with production)
    // Ties broken by operario code for deterministic order
    const buildList = (bultosMap: Record<string, number>) =>
      Object.entries(bultosMap)
        .map(([operario, total]) => ({
          operario,
          nombre: nameMap[operario] || operario,
          total,
        }))
        .sort((a, b) => b.total - a.total || (a.operario < b.operario ? -1 : 1));

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
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error("Error fetching franjas:", error);
    return NextResponse.json({ error: "Error fetching franjas data" }, { status: 500 , headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
}
