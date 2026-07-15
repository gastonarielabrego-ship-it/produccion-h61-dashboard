import {
  getAllRecords,
  getSourceTable,
  parseFilters,
  getTMByDate,
  getTMByDateOperario,
} from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const [records, tmByDate, tmByDateOp] = await Promise.all([
      getAllRecords(filters, tableName),
      getTMByDate(filters),
      getTMByDateOperario(filters),
    ]);

    const dayMap: Record<number, { misionesSet: Set<string>; bultos: number; horasBrutas: number }> = {};
    for (const r of records) {
      if (!dayMap[r.date]) dayMap[r.date] = { misionesSet: new Set(), bultos: 0, horasBrutas: 0 };
      const d = dayMap[r.date];
      d.misionesSet.add(r.operario);
      d.bultos += r.total;
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) d.horasBrutas += 1;
      }
    }

    const sortedDates = Object.keys(dayMap).map(Number).sort((a, b) => a - b);

    const dailyMetrics = sortedDates.map((date) => {
      const d = dayMap[date];
      const misiones = d.misionesSet.size;
      const bultos = d.bultos;
      const horasProductivas = d.horasBrutas;
      const tmMinutos = tmByDate[date] || 0;
      const tmHoras = Math.round((tmMinutos / 60) * 100) / 100;
      const horasNetas = Math.round((horasProductivas - tmHoras) * 100) / 100;
      const produccion = misiones > 0 ? Math.round((bultos / misiones) * 10) / 10 : 0;
      const bultosPorHora = horasNetas > 0 ? Math.round((bultos / horasNetas) * 10) / 10 : 0;
      const bultosPorHoraBruta = horasProductivas > 0 ? Math.round((bultos / horasProductivas) * 10) / 10 : 0;
      return { date, misiones, bultos, horasProductivas, tmMinutos, tmHoras, horasNetas, produccion, bultosPorHora, bultosPorHoraBruta };
    });

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

    const opTotalMap: Record<string, number> = {};
    const opNameMap: Record<string, string> = {};
    for (const r of records) {
      opTotalMap[r.operario] = (opTotalMap[r.operario] || 0) + r.total;
      opNameMap[r.operario] = r.nombre;
    }
    const opTMTotal: Record<string, number> = {};
    for (const [key, minutos] of Object.entries(tmByDateOp)) {
      const operario = key.split(":").slice(1).join(":");
      opTMTotal[operario] = (opTMTotal[operario] || 0) + minutos;
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

    const operatorTM = sortedOps.map((op) => ({
      operario: op, nombre: opNameMap[op],
      tmMinutos: opTMTotal[op] || 0, tmHoras: Math.round(((opTMTotal[op] || 0) / 60) * 100) / 100,
      bultos: opTotalMap[op],
    }));

    return NextResponse.json({ dailyMetrics, dayHeatmap, collaboratorHeatmap, operatorTM });
  } catch (error) {
    console.error("Error fetching summary tables:", error);
    return NextResponse.json({ error: "Error fetching summary tables" }, { status: 500 });
  }
}