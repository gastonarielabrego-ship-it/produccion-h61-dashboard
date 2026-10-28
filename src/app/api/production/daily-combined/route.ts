import {
  getPool,
  buildWhere,
  getSourceTable,
  parseFilters,
} from "@/lib/neon";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const SHIFT_LABELS: Record<string, string> = {
  M: "Mañana",
  T: "Tarde",
  N: "Noche",
};

// PERF: aggregation pushed into SQL — one grouped query (fecha, turno)
// instead of fetching every raw row (up to ~128K) into Node.
export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const pool = getPool();
    const { sql: whereSql, params } = buildWhere(filters);

    const result = await pool.query(
      `SELECT fecha, turno, COUNT(*)::int AS n, COALESCE(SUM(total), 0) AS t,
              COUNT(DISTINCT CASE WHEN total > 0 THEN operario END)::int AS m
       FROM ${tableName} ${whereSql}
       GROUP BY fecha, turno ORDER BY fecha`,
      params,
    );

    // 1) Aggregate daily production (bultos)
    const dailyTotals: Record<number, number> = {};
    let grandTotal = 0;
    let totalRecords = 0;

    // 2) Unique operarios per shift per day (only rows with production)
    const shiftDayMissions: Record<string, Record<number, number>> = {};

    for (const r of result.rows as Record<string, unknown>[]) {
      const date = Number(r.fecha);
      const turno = String(r.turno ?? "");
      const n = Number(r.n) || 0;
      const t = Number(r.t) || 0;
      const m = Number(r.m) || 0;

      grandTotal += t;
      totalRecords += n;
      dailyTotals[date] = (dailyTotals[date] || 0) + t;

      if (!shiftDayMissions[turno]) shiftDayMissions[turno] = {};
      shiftDayMissions[turno][date] = m;
    }

    const shifts = Object.keys(shiftDayMissions).sort();

    // 3) Build combined daily data points
    const sortedDates = Object.keys(dailyTotals)
      .map(Number)
      .sort((a, b) => a - b);

    const dailyData: Record<string, string | number>[] = [];
    for (const date of sortedDates) {
      const s = String(date);
      const dayLabel = `${s.slice(6, 8)}/${s.slice(4, 6)}`;
      const point: Record<string, string | number> = {
        day: dayLabel,
        dateNum: date,
        bultos: dailyTotals[date],
      };
      for (const shift of shifts) {
        const label = SHIFT_LABELS[shift] || shift;
        point[label] = shiftDayMissions[shift]?.[date] || 0;
      }
      dailyData.push(point);
    }

    const shiftTotals = shifts.map((s) => {
      const label = SHIFT_LABELS[s] || s;
      const total = sortedDates.reduce(
        (sum, d) => sum + (shiftDayMissions[s]?.[d] || 0),
        0
      );
      return { turno: s, label, total };
    });

    return NextResponse.json({
      totalRecords,
      grandTotal,
      dailyData,
      shifts: shiftTotals,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error("Error fetching daily combined:", error);
    return NextResponse.json({ error: "Error fetching combined daily data" }, { status: 500 , headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
}
