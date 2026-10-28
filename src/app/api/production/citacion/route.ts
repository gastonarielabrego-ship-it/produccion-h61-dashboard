import {
  getAggRecords,
  getSourceTable,
  parseFilters,
  getTMByDateOperario,
} from "@/lib/neon";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// PERF: SQL GROUP BY (fecha, operario) + parallel TM query.
// Days with no activity are omitted from each operator's `days` array
// (the frontend treats missing days as zeros) — cuts the payload ~75%.
export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const [rows, tmByDateOp] = await Promise.all([
      getAggRecords(filters, tableName),
      getTMByDateOperario(filters),
    ]);

    // Collect all dates sorted
    const dateSet = new Set<number>();
    for (const r of rows) dateSet.add(r.fecha);
    const dates = Array.from(dateSet).sort((a, b) => a - b);

    // Collect all operators with their total B/H Neta for sorting
    const opNameMap: Record<string, string> = {};
    const opBHNetaMap: Record<string, number> = {};
    const opTotalBultos: Record<string, number> = {};
    const opTotalNetas: Record<string, number> = {};

    type DayDetail = {
      date: number;
      brutas: number;
      tmHoras: number;
      netas: number;
      bultos: number;
      bhNeta: number;
    };

    const opDaysMap: Record<string, DayDetail[]> = {};

    for (const r of rows) {
      if (!r.operario) continue;
      opNameMap[r.operario] = r.nombre;

      const tmMinutos = tmByDateOp[`${r.fecha}:${r.operario}`] || 0;
      const tmHoras = tmMinutos / 60;
      let brutas = 0;
      for (let h = 0; h <= 23; h++) {
        if (r.act[h]) brutas++;
      }
      const netas = Math.round((brutas - tmHoras) * 100) / 100;
      const bhNeta = netas > 0 ? Math.round((r.total / netas) * 10) / 10 : 0;

      opTotalBultos[r.operario] = (opTotalBultos[r.operario] || 0) + r.total;
      opTotalNetas[r.operario] = (opTotalNetas[r.operario] || 0) + netas;

      // Omit days with no activity and no TM (they were zero-filled before)
      if (brutas > 0 || r.total > 0 || tmMinutos !== 0) {
        if (!opDaysMap[r.operario]) opDaysMap[r.operario] = [];
        opDaysMap[r.operario].push({
          date: r.fecha,
          brutas,
          tmHoras: Math.round(tmHoras * 100) / 100,
          netas,
          bultos: r.total,
          bhNeta,
        });
      }
    }

    // Calculate overall B/H Neta per operator (weighted by net hours)
    for (const op in opTotalBultos) {
      opBHNetaMap[op] = opTotalNetas[op] > 0
        ? Math.round((opTotalBultos[op] / opTotalNetas[op]) * 10) / 10
        : 0;
    }

    // Sort operators descending by overall B/H Neta
    const sortedOps = Object.keys(opNameMap).sort(
      (a, b) => opBHNetaMap[b] - opBHNetaMap[a]
    );

    const operators = sortedOps.map((op) => {
      const dayDetails = (opDaysMap[op] || []).sort((a, b) => a.date - b.date);

      const totalBultos = dayDetails.reduce((s, d) => s + d.bultos, 0);
      const totalNetas = dayDetails.reduce((s, d) => s + d.netas, 0);
      const totalTM = dayDetails.reduce((s, d) => s + d.tmHoras, 0);
      const totalBrutas = dayDetails.reduce((s, d) => s + d.brutas, 0);
      const overallBH = totalNetas > 0 ? Math.round((totalBultos / totalNetas) * 10) / 10 : 0;

      return {
        operario: op,
        nombre: opNameMap[op],
        days: dayDetails,
        totalBultos,
        totalBrutas,
        totalTM: Math.round(totalTM * 100) / 100,
        totalNetas: Math.round(totalNetas * 100) / 100,
        overallBH,
      };
    });

    return NextResponse.json({ dates, operators }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error("Error fetching citacion:", error);
    return NextResponse.json({ error: "Error fetching citacion" }, { status: 500 , headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
}
