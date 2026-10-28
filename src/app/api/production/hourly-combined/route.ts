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

// PERF: aggregation pushed into SQL — 3 small grouped queries in parallel
// instead of fetching every raw row (up to ~128K) into Node.
export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const pool = getPool();
    const { sql: whereSql, params } = buildWhere(filters);

    const hourCols = Array.from({ length: 24 }, (_, h) => `hora_${String(h).padStart(2, "0")}`);

    // Mission distinct expressions: COUNT(DISTINCT date:operario active at hour h)
    const missionExprs = hourCols.map((col, h) =>
      `COUNT(DISTINCT CASE WHEN ${col} > 0 THEN fecha::text || ':' || operario END)::int AS m${h}`
    );
    const sumExprs = hourCols.map((col, h) =>
      `COALESCE(SUM(${col}), 0) AS h${h}`
    );

    const [overallRes, turnoRes, circuitoRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM(total), 0) AS g, ${sumExprs.join(", ")},
                ${missionExprs.join(", ")}
         FROM ${tableName} ${whereSql}`,
        params,
      ),
      pool.query(
        `SELECT turno, ${missionExprs.join(", ")}
         FROM ${tableName} ${whereSql} GROUP BY turno`,
        params,
      ),
      pool.query(
        `SELECT circuito, COALESCE(SUM(total), 0) AS total
         FROM ${tableName} ${whereSql} GROUP BY circuito`,
        params,
      ),
    ]);

    const overall = overallRes.rows[0] || {};
    const grandTotal = Number(overall.g) || 0;
    const totalRecords = Number(overall.n) || 0;

    // 1) Aggregate hourly production (bultos)
    const hourlyTotals: number[] = [];
    for (let h = 0; h <= 23; h++) hourlyTotals.push(Number(overall["h" + h]) || 0);

    // 2) Unique (date, operario) per shift per hour (misiones)
    const shiftHourMissions: Record<string, number[]> = {};
    for (const r of turnoRes.rows as Record<string, unknown>[]) {
      const turno = String(r.turno ?? "");
      const missions: number[] = [];
      for (let h = 0; h <= 23; h++) missions.push(Number(r["m" + h]) || 0);
      shiftHourMissions[turno] = missions;
    }
    const shifts = Object.keys(shiftHourMissions).sort();

    // 3) Build combined hourly data points
    const hourlyData: Record<string, string | number>[] = [];
    for (let h = 0; h <= 23; h++) {
      const point: Record<string, string | number> = {
        hour: `${String(h).padStart(2, "0")}:00`,
        hourNum: h,
        bultos: hourlyTotals[h],
      };
      for (const s of shifts) {
        const label = SHIFT_LABELS[s] || s;
        point[label] = shiftHourMissions[s][h];
      }
      hourlyData.push(point);
    }

    const circuitData = (circuitoRes.rows as Record<string, unknown>[])
      .map((r) => ({ circuito: String(r.circuito ?? ""), total: Number(r.total) || 0 }))
      .sort((a, b) => b.total - a.total);

    const shiftTotals = shifts.map((s) => ({
      turno: s,
      label: SHIFT_LABELS[s] || s,
      total: shiftHourMissions[s].reduce((sum, v) => sum + v, 0),
    }));

    return NextResponse.json({
      totalRecords,
      grandTotal,
      hourlyData,
      circuitData,
      shifts: shiftTotals,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error("Error fetching hourly combined:", error);
    return NextResponse.json({ error: "Error fetching combined hourly data" }, { status: 500 , headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
}
