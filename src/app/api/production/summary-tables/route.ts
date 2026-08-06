import {
  getAllRecords,
  getSourceTable,
  parseFilters,
  getTMByDate,
  getTMByDateOperario,
} from "@/lib/turso";
import { NextResponse } from "next/server";

const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);

    // Fetch records and TM data — ensureTMTable uses a promise lock so
    // the two TM functions won't double-fire on cold start
    const [records, tmByDate, tmByDateOp] = await Promise.all([
      getAllRecords(filters, tableName),
      getTMByDate(filters),
      getTMByDateOperario(filters),
    ]);

    // ── Per-day aggregation ──
    const dayMap: Record<number, { misionesSet: Set<string>; bultos: number; activeSlots: Set<string>; days: Set<number> }> = {};
    const monthMap: Record<number, { misionesSet: Set<string>; bultos: number; activeSlots: Set<string>; days: Set<number> }> = {};

    for (const r of records) {
      // Day level
      if (!dayMap[r.date]) dayMap[r.date] = { misionesSet: new Set(), bultos: 0, activeSlots: new Set<string>(), days: new Set() };
      const d = dayMap[r.date];
      d.misionesSet.add(r.operario);
      d.bultos += r.total;
      d.days.add(r.date);
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) d.activeSlots.add(`${r.operario}:${hd.hour}`);
      }

      // Month level (YYYYMM)
      const monthKey = Math.floor(r.date / 100);
      if (!monthMap[monthKey]) monthMap[monthKey] = { misionesSet: new Set(), bultos: 0, activeSlots: new Set<string>(), days: new Set() };
      const m = monthMap[monthKey];
      m.misionesSet.add(r.operario);
      m.bultos += r.total;
      m.days.add(r.date);
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) m.activeSlots.add(`${r.operario}:${hd.hour}`);
      }
    }

    const sortedDates = Object.keys(dayMap).map(Number).sort((a, b) => a - b);

    // ── Daily metrics ──
    const dailyMetrics = sortedDates.map((date) => {
      const d = dayMap[date];
      const misiones = d.misionesSet.size;
      const bultos = d.bultos;
      const horasProductivas = d.activeSlots.size;
      let tmMinutos = 0;
      if (filters.operario) {
        tmMinutos = tmByDateOp[`${date}:${filters.operario}`] || 0;
      } else {
        tmMinutos = tmByDate[date] || 0;
      }
      const tmHoras = Math.round((tmMinutos / 60) * 100) / 100;
      const horasNetas = Math.round((horasProductivas - tmHoras) * 100) / 100;
      const produccion = misiones > 0 ? Math.round((bultos / misiones) * 10) / 10 : 0;
      const bultosPorHoraBruta = horasProductivas > 0 ? Math.round((bultos / horasProductivas) * 10) / 10 : 0;
      const bultosPorHoraNeta = horasNetas > 0 ? Math.round((bultos / horasNetas) * 10) / 10 : 0;
      return { date, misiones, bultos, horasProductivas, tmHoras, horasNetas, produccion, bultosPorHoraBruta, bultosPorHoraNeta };
    });

    // ── Monthly summary (merged here — avoids 2nd API call) ──
    const sortedMonths = Object.keys(monthMap).map(Number).sort((a, b) => a - b);
    const monthlyData = sortedMonths.map((month, idx) => {
      const m = monthMap[month];
      const misiones = m.misionesSet.size;
      const bultos = m.bultos;
      const horasBrutas = m.activeSlots.size;
      const dias = m.days.size;

      let tmMinutos = 0;
      for (const d of m.days) {
        if (filters.operario) {
          tmMinutos += tmByDateOp[`${d}:${filters.operario}`] || 0;
        } else {
          tmMinutos += tmByDate[d] || 0;
        }
      }
      const tmHoras = Math.round((tmMinutos / 60) * 100) / 100;
      const horasNetas = Math.round((horasBrutas - tmHoras) * 100) / 100;

      const produccion = misiones > 0 ? Math.round((bultos / misiones) * 10) / 10 : 0;
      const bhBruta = horasBrutas > 0 ? Math.round((bultos / horasBrutas) * 10) / 10 : 0;
      const bhNeta = horasNetas > 0 ? Math.round((bultos / horasNetas) * 10) / 10 : 0;

      const prev = idx > 0 ? monthlyData[idx - 1] : null;
      const cmpBultos = prev ? Math.round(((bultos - prev.bultos) / prev.bultos) * 10000) / 100 : null;
      const cmpBH = prev ? Math.round(((bhBruta - prev.bhBruta) / prev.bhBruta) * 10000) / 100 : null;
      const cmpMisiones = prev ? Math.round(((misiones - prev.misiones) / prev.misiones) * 10000) / 100 : null;

      return {
        month,
        label: `${MONTH_NAMES[month % 100]} ${String(month).slice(0, 4)}`,
        dias, misiones, bultos, horasBrutas, tmHoras, horasNetas,
        produccion, bhBruta, bhNeta,
        cmpBultos, cmpBH, cmpMisiones,
      };
    });

    // ── Day heatmap ──
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

    // ── Collaborator heatmap ──
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

    const filteredOperatorName = filters.operario && records.length > 0 ? records[0].nombre : null;

    return NextResponse.json({
      dailyMetrics,
      monthlyData,
      dayHeatmap,
      collaboratorHeatmap,
      filteredOperatorName,
    });
  } catch (error) {
    console.error("Error fetching summary tables:", error);
    return NextResponse.json({ error: "Error fetching summary tables" }, { status: 500 });
  }
}
