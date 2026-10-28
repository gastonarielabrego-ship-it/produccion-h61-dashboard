import {
  getPool,
  buildWhere,
  getSourceTable,
  parseFilters,
} from "@/lib/neon";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const ACTIVITY_COLORS: Record<string, string> = {
  "2": "#10b981",
  "4": "#6366f1",
  "6": "#f59e0b",
  "8": "#ef4444",
  "10": "#8b5cf6",
};

export function getActivityColor(key: string): string {
  return ACTIVITY_COLORS[key] || "#64748b";
}

// PERF: aggregation pushed into SQL — 2 small grouped queries in parallel
// instead of fetching every raw row (up to ~128K) into Node.
export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const pool = getPool();
    const { sql: whereSql, params } = buildWhere(filters);

    const hourCols = Array.from({ length: 24 }, (_, h) => `hora_${String(h).padStart(2, "0")}`);
    const sumExprs = hourCols.map((col, h) => `COALESCE(SUM(${col}), 0) AS h${h}`);
    const missionExprs = hourCols.map((col, h) =>
      `COUNT(DISTINCT CASE WHEN ${col} > 0 THEN fecha::text || ':' || operario END)::int AS m${h}`
    );

    const [actRes, overallRes] = await Promise.all([
      pool.query(
        `SELECT actividad, ${sumExprs.join(", ")}
         FROM ${tableName} ${whereSql} GROUP BY actividad`,
        params,
      ),
      pool.query(
        `SELECT ${missionExprs.join(", ")}
         FROM ${tableName} ${whereSql}`,
        params,
      ),
    ]);

    // 1. Bultos per hour per activity (for stacked bars)
    const actHourly: Record<string, number[]> = {};
    for (const r of actRes.rows as Record<string, unknown>[]) {
      const actKey = String(r.actividad ?? 0);
      const sums: number[] = [];
      for (let h = 0; h <= 23; h++) sums.push(Number(r["h" + h]) || 0);
      actHourly[actKey] = sums;
    }

    // 2. Active operators per hour (for line)
    const overall = overallRes.rows[0] || {};
    const opHourly: number[] = [];
    for (let h = 0; h <= 23; h++) opHourly.push(Number(overall["m" + h]) || 0);

    const activities = Object.keys(actHourly).sort((a, b) => Number(a) - Number(b));

    // Build hourly data points
    const hourlyData: Record<string, string | number>[] = [];
    for (let h = 0; h <= 23; h++) {
      const point: Record<string, string | number> = {
        hour: `${String(h).padStart(2, "0")}:00`,
        hourNum: h,
      };
      for (const act of activities) {
        point[`Actividad ${act}`] = actHourly[act][h];
      }
      point["Operarios"] = opHourly[h];
      hourlyData.push(point);
    }

    // Totals per activity
    const activityTotals = activities.map((act) => ({
      actividad: act,
      label: `Actividad ${act}`,
      total: actHourly[act].reduce((sum, v) => sum + v, 0),
      color: getActivityColor(act),
    }));

    // Average bultos per hour (for reference line)
    const overallHourly = new Array(24).fill(0);
    for (const act of activities) {
      for (let h = 0; h <= 23; h++) overallHourly[h] += actHourly[act][h];
    }
    const totalBultosFinal = overallHourly.reduce((s, v) => s + v, 0);
    const activeHoursFinal = overallHourly.filter((v) => v > 0).length;
    const avgHourly = activeHoursFinal > 0 ? Math.round(totalBultosFinal / activeHoursFinal) : 0;

    return NextResponse.json({
      activities: activityTotals,
      hourlyData,
      avgHourly,
      totalBultos: totalBultosFinal,
      totalMisiones: Math.max(...opHourly, 0),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error("Error fetching by-activity:", error);
    return NextResponse.json({ error: "Error fetching activity data" }, { status: 500 , headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
}
