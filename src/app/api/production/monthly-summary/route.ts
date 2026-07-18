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
    const [records, tmByDate, tmByDateOp] = await Promise.all([
      getAllRecords(filters, tableName),
      getTMByDate(filters),
      getTMByDateOperario(filters),
    ]);

    // Group by month (YYYYMM)
    const monthMap: Record<number, {
      misionesSet: Set<string>;
      bultos: number;
      activeSlots: Set<string>;
      days: Set<number>;
    }> = {};

    for (const r of records) {
      const monthKey = Math.floor(r.date / 100);
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { misionesSet: new Set(), bultos: 0, activeSlots: new Set(), days: new Set() };
      }
      const m = monthMap[monthKey];
      m.misionesSet.add(r.operario);
      m.bultos += r.total;
      m.days.add(r.date);
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) m.activeSlots.add(`${r.operario}:${hd.hour}`);
      }
    }

    const sortedMonths = Object.keys(monthMap).map(Number).sort((a, b) => a - b);

    const monthlyData = sortedMonths.map((month, idx) => {
      const m = monthMap[month];
      const misiones = m.misionesSet.size;
      const bultos = m.bultos;
      const horasBrutas = m.activeSlots.size;
      const dias = m.days.size;

      // Sum TM for this month
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

      // Month-over-month comparison
      const prev = idx > 0 ? monthlyData[idx - 1] : null;
      const cmpBultos = prev ? Math.round(((bultos - prev.bultos) / prev.bultos) * 10000) / 100 : null;
      const cmpBH = prev ? Math.round(((bhBruta - prev.bhBruta) / prev.bhBruta) * 10000) / 100 : null;
      const cmpMisiones = prev ? Math.round(((misiones - prev.misiones) / prev.misiones) * 10000) / 100 : null;

      return {
        month,
        label: `${MONTH_NAMES[month % 100]} ${String(month).slice(0, 4)}`,
        dias,
        misiones,
        bultos,
        horasBrutas,
        tmHoras,
        horasNetas,
        produccion,
        bhBruta,
        bhNeta,
        cmpBultos,
        cmpBH,
        cmpMisiones,
      };
    });

    return NextResponse.json({ monthlyData });
  } catch (error) {
    console.error("Error fetching monthly summary:", error);
    return NextResponse.json({ error: "Error fetching monthly summary" }, { status: 500 });
  }
}