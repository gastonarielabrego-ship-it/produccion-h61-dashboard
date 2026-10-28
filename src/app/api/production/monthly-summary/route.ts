import {
  getPool,
  buildWhere,
  getSourceTable,
  parseFilters,
  getTMByDate,
  getTMByDateOperario,
} from "@/lib/neon";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// PERF: aggregation pushed into SQL (GROUP BY month) + comparisons computed
// in a second pass. Fixes a TDZ crash (monthlyData referenced inside its own
// .map callback) that made this endpoint always return 500.
export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const pool = getPool();
    const { sql: whereSql, params } = buildWhere(filters);

    // activeSlots per month = distinct (operario, hour) pairs with qty > 0
    const distinctExprs = Array.from({ length: 24 }, (_, h) => {
      const col = `hora_${String(h).padStart(2, "0")}`;
      return `COUNT(DISTINCT CASE WHEN ${col} > 0 THEN operario END)::int AS m${h}`;
    });

    const [monthRes, tmByDate, tmByDateOp] = await Promise.all([
      pool.query(
        `SELECT (fecha / 100) AS ym,
                COUNT(DISTINCT operario)::int AS misiones,
                COALESCE(SUM(total), 0) AS bultos,
                COUNT(DISTINCT fecha)::int AS dias,
                ${distinctExprs.join(", ")}
         FROM ${tableName} ${whereSql}
         GROUP BY 1 ORDER BY 1`,
        params,
      ),
      getTMByDate(filters),
      getTMByDateOperario(filters),
    ]);

    const monthlyData: any[] = [];

    for (let idx = 0; idx < monthRes.rows.length; idx++) {
      const r = monthRes.rows[idx] as Record<string, unknown>;
      const month = Number(r.ym);
      const misiones = Number(r.misiones) || 0;
      const bultos = Number(r.bultos) || 0;
      const dias = Number(r.dias) || 0;

      // horasBrutas = size of activeSlots = sum over hours of distinct operarios active at that hour
      let horasBrutas = 0;
      for (let h = 0; h <= 23; h++) horasBrutas += Number(r["m" + h]) || 0;

      // Sum TM for this month
      let tmMinutos = 0;
      if (filters.operario) {
        for (const key of Object.keys(tmByDateOp)) {
          const parts = key.split(":");
          const d = Number(parts[0]);
          const op = parts.slice(1).join(":");
          if (Math.floor(d / 100) === month && op === filters.operario) {
            tmMinutos += tmByDateOp[key] || 0;
          }
        }
      } else {
        for (const key of Object.keys(tmByDate)) {
          if (Math.floor(Number(key) / 100) === month) {
            tmMinutos += tmByDate[key] || 0;
          }
        }
      }
      const tmHoras = Math.round((tmMinutos / 60) * 100) / 100;
      const horasNetas = Math.round((horasBrutas - tmHoras) * 100) / 100;

      const produccion = misiones > 0 ? Math.round((bultos / misiones) * 10) / 10 : 0;
      const bhBruta = horasBrutas > 0 ? Math.round((bultos / horasBrutas) * 10) / 10 : 0;
      const bhNeta = horasNetas > 0 ? Math.round((bultos / horasNetas) * 10) / 10 : 0;

      monthlyData.push({
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
        cmpBultos: null,
        cmpBH: null,
        cmpMisiones: null,
      });
    }

    // Month-over-month comparison (second pass — no TDZ)
    for (let idx = 1; idx < monthlyData.length; idx++) {
      const prev = monthlyData[idx - 1];
      const cur = monthlyData[idx];
      cur.cmpBultos = prev.bultos > 0 ? Math.round(((cur.bultos - prev.bultos) / prev.bultos) * 10000) / 100 : null;
      cur.cmpBH = prev.bhBruta > 0 ? Math.round(((cur.bhBruta - prev.bhBruta) / prev.bhBruta) * 10000) / 100 : null;
      cur.cmpMisiones = prev.misiones > 0 ? Math.round(((cur.misiones - prev.misiones) / prev.misiones) * 10000) / 100 : null;
    }

    return NextResponse.json({ monthlyData }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error("Error fetching monthly summary:", error);
    return NextResponse.json({ error: "Error fetching monthly summary" }, { status: 500 , headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
}
