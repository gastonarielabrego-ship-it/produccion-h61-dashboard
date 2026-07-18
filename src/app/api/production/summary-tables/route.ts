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

    // Per-day aggregation using unique (operario, hour) pairs for person-hours
    const dayMap: Record<number, { misionesSet: Set<string>; bultos: number; activeSlots: Set<string> }> = {};
    for (const r of records) {
      if (!dayMap[r.date]) dayMap[r.date] = { misionesSet: new Set(), bultos: 0, activeSlots: new Set() };
      const d = dayMap[r.date];
      d.misionesSet.add(r.operario);
      d.bultos += r.total;
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) d.activeSlots.add(`${r.operario}:${hd.hour}`);
      }
    }

    const sortedDates = Object.keys(dayMap).map(Number).sort((a, b) => a - b);

    const dailyMetrics = sortedDates.map((date) => {
      const d = dayMap[date];
      const misiones = d.misionesSet.size;
      const bultos = d.bultos;
      const horasProductivas = d.activeSlots.size;
      const produccion = misiones > 0 ? Math.round((bultos / misiones) * 10) / 10 : 0;
      const bultosPorHora = horasProductivas > 0 ? Math.round((bultos / horasProductivas) * 10) / 10 : 0;
      return { date, misiones, bultos, horasProductivas, produccion, bultosPorHora };
    });

    // Day heatmap: total bultos per (date, hour)
    const dayHourMap: Record<string, number> = {};
    for (const r of records) {
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) dayHourMap[`${r.date}:${hd.hour}`] = (dayHourMap[`${r.date}:${hd.hour}`] || 0) + hd.quantity;
      }
    }
    const dayHeatmap = sortedDates.map((date) => {
      const row: Record<string, number> = { date };
      for (let h = 0; h <= 23; h++) row[String(h)] = dayHourMap[`${date}:${h}`] || 0;
      return row;
    });

    // Collaborator heatmap: total bultos per (operario, hour)
    const opTotalMap: Record<string, number> = {};
    const opNameMap: Record<string, string> = {};
    for (const r of records) {
      opTotalMap[r.operario] = (opTotalMap[r.operario] || 0) + r.total;
      opNameMap[r.operario] = r.nombre;
    }
    const sortedOps = Object.entries(opTotalMap).sort((a, b) => b[1] - a[1]).slice(0, 100).map(([op]) => op);

    const opHourMap: Record<string, number> = {};
    for (const r of records) {
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) opHourMap[`${r.operario}:${hd.hour}`] = (opHourMap[`${r.operario}:${hd.hour}`] || 0) + hd.quantity;
      }
    }
    const collaboratorHeatmap = sortedOps.map((op) => {
      const row: Record<string, string | number> = { operario: op, nombre: opNameMap[op] };
      for (let h = 0; h <= 23; h++) row[String(h)] = opHourMap[`${op}:${h}`] || 0;
      return row;
    });

    // If filtered by operario, return their name for the UI
    const filteredOperatorName = filters.operario && records.length > 0 ? records[0].nombre : null;

    return NextResponse.json({ dailyMetrics, dayHeatmap, collaboratorHeatmap, filteredOperatorName });
  } catch (error) {
    console.error("Error fetching summary tables:", error);
    return NextResponse.json({ error: "Error fetching summary tables" }, { status: 500 });
  }
}