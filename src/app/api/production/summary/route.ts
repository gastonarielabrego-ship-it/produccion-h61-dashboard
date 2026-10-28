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

// PERF: aggregation pushed into SQL (GROUP BY) + all queries run in parallel.
// Previously fetched every raw row (up to ~128K) and aggregated in JS.
export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const pool = getPool();
    const { sql: whereSql, params } = buildWhere(filters);

    const [overall, byCirc, byTurno, byFecha, byFuncion, tmByDate, tmByDateOp] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM(total), 0) AS g,
                COUNT(DISTINCT (fecha::text || ':' || operario))::int AS missions
         FROM ${tableName} ${whereSql}`,
        params,
      ),
      pool.query(
        `SELECT circuito, COALESCE(SUM(total), 0) AS total
         FROM ${tableName} ${whereSql} GROUP BY circuito`,
        params,
      ),
      pool.query(
        `SELECT turno, MAX(turno_desc) AS td, COALESCE(SUM(total), 0) AS total,
                COUNT(DISTINCT (fecha::text || ':' || operario))::int AS m
         FROM ${tableName} ${whereSql} GROUP BY turno`,
        params,
      ),
      pool.query(
        `SELECT fecha, COALESCE(SUM(total), 0) AS total
         FROM ${tableName} ${whereSql} GROUP BY fecha ORDER BY fecha`,
        params,
      ),
      pool.query(
        `SELECT funcion, MAX(funcion_desc) AS fd, COALESCE(SUM(total), 0) AS total
         FROM ${tableName} ${whereSql} GROUP BY funcion`,
        params,
      ),
      getTMByDate(filters),
      getTMByDateOperario(filters),
    ]);

    let totalTMMinutos: number;
    if (filters.operario) {
      totalTMMinutos = Object.values(tmByDateOp as Record<string, number>).reduce((s: number, v: number) => s + v, 0);
    } else {
      totalTMMinutos = Object.values(tmByDate as Record<string, number>).reduce((s: number, v: number) => s + v, 0);
    }
    const totalTMHoras = Math.round((totalTMMinutos / 60) * 100) / 100;

    const grandTotal = Number(overall.rows[0]?.g) || 0;
    const totalRecords = Number(overall.rows[0]?.n) || 0;
    const totalMissions = Number(overall.rows[0]?.missions) || 0;

    // Total por circuito
    const circuitData = byCirc.rows
      .map((r: Record<string, unknown>) => ({ circuito: String(r.circuito ?? ""), total: Number(r.total) || 0 }))
      .sort((a: any, b: any) => b.total - a.total);

    // Total por turno (deterministic order: bultos desc, then turno)
    const shiftData = byTurno.rows
      .map((r: Record<string, unknown>) => ({
        turno: String(r.turno ?? ""),
        label: String(r.td ?? r.turno ?? ""),
        total: Number(r.total) || 0,
      }))
      .sort((a: any, b: any) => b.total - a.total || (a.turno < b.turno ? -1 : 1));

    // Total por fecha
    const dateData = byFecha.rows
      .map((r: Record<string, unknown>) => ({ date: Number(r.fecha), total: Number(r.total) || 0 }))
      .sort((a: any, b: any) => a.date - b.date);

    // Total por funcion (deterministic order: bultos desc, then funcion)
    const funcionData = byFuncion.rows
      .map((r: Record<string, unknown>) => ({
        funcion: String(r.funcion ?? ""),
        label: String(r.fd ?? r.funcion ?? ""),
        total: Number(r.total) || 0,
      }))
      .sort((a: any, b: any) => b.total - a.total || (a.funcion < b.funcion ? -1 : 1));

    // Participación por turno (basada en misiones de cada turno)
    const totalShiftMissions = byTurno.rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.m) || 0), 0);
    const shiftParticipation = byTurno.rows
      .map((r: Record<string, unknown>) => {
        const count = Number(r.m) || 0;
        return {
          turno: String(r.turno ?? ""),
          label: String(r.td ?? r.turno ?? ""),
          missions: count,
          total: Number(r.total) || 0,
          percentage: totalShiftMissions > 0 ? Math.round((count / totalShiftMissions) * 100) : 0,
        };
      })
      .sort((a: any, b: any) => b.percentage - a.percentage);

    return NextResponse.json({
      totalRecords,
      grandTotal,
      totalMissions,
      totalTMMinutos,
      totalTMHoras,
      shiftParticipation,
      circuitData,
      shiftData,
      dateData,
      funcionData,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error("Error fetching summary:", error);
    return NextResponse.json({ error: "Error fetching summary" }, { status: 500 , headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
}
