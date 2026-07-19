import {
  getAllRecords,
  getSourceTable,
  parseFilters,
  getTMByDateOperario,
} from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const [records, tmByDateOp] = await Promise.all([
      getAllRecords(filters, tableName),
      getTMByDateOperario(filters),
    ]);

    // Group by (operario, date)
    const opDateMap: Record<string, {
      operario: string;
      nombre: string;
      date: number;
      bultos: number;
      activeSlots: Set<string>; // unique (operario, hour) — but per operator it's just hour
    }> = {};

    for (const r of records) {
      const key = `${r.operario}:${r.date}`;
      if (!opDateMap[key]) {
        opDateMap[key] = {
          operario: r.operario,
          nombre: r.nombre,
          date: r.date,
          bultos: 0,
          activeSlots: new Set(),
        };
      }
      const entry = opDateMap[key];
      entry.bultos += r.total;
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) entry.activeSlots.add(String(hd.hour));
      }
    }

    // Collect all dates sorted
    const dateSet = new Set<number>();
    for (const key in opDateMap) dateSet.add(opDateMap[key].date);
    const dates = Array.from(dateSet).sort((a, b) => a - b);

    // Collect all operators with their total B/H Neta for sorting
    const opNameMap: Record<string, string> = {};
    const opBHNetaMap: Record<string, number> = {};
    const opTotalBultos: Record<string, number> = {};
    const opTotalNetas: Record<string, number> = {};

    for (const key in opDateMap) {
      const e = opDateMap[key];
      opNameMap[e.operario] = e.nombre;

      const tmMinutos = tmByDateOp[`${e.date}:${e.operario}`] || 0;
      const tmHoras = tmMinutos / 60;
      const brutas = e.activeSlots.size;
      const netas = Math.round((brutas - tmHoras) * 100) / 100;
      const bhNeta = netas > 0 ? Math.round((e.bultos / netas) * 10) / 10 : 0;

      opTotalBultos[e.operario] = (opTotalBultos[e.operario] || 0) + e.bultos;
      opTotalNetas[e.operario] = (opTotalNetas[e.operario] || 0) + netas;
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

    // Build per-operator, per-date detail
    type DayDetail = {
      date: number;
      brutas: number;
      tmHoras: number;
      netas: number;
      bultos: number;
      bhNeta: number;
    };

    const operators = sortedOps.map((op) => {
      const dayDetails: DayDetail[] = dates.map((d) => {
        const key = `${op}:${d}`;
        const e = opDateMap[key];
        if (!e) {
          return { date: d, brutas: 0, tmHoras: 0, netas: 0, bultos: 0, bhNeta: 0 };
        }
        const tmMinutos = tmByDateOp[`${d}:${op}`] || 0;
        const tmHoras = Math.round((tmMinutos / 60) * 100) / 100;
        const brutas = e.activeSlots.size;
        const netas = Math.round((brutas - tmHoras) * 100) / 100;
        const bultos = e.bultos;
        const bhNeta = netas > 0 ? Math.round((bultos / netas) * 10) / 10 : 0;
        return { date: d, brutas, tmHoras, netas, bultos, bhNeta };
      });

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

    return NextResponse.json({ dates, operators });
  } catch (error) {
    console.error("Error fetching citacion:", error);
    return NextResponse.json({ error: "Error fetching citacion" }, { status: 500 });
  }
}