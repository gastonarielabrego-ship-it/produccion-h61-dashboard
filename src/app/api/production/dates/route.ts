import {
  getPool,
  getSourceTable,
} from "@/lib/neon";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// PERF: filter metadata now comes from 7 tiny SQL queries in parallel
// (DISTINCT / GROUP BY) instead of fetching every raw row (~128K) into Node.
export async function GET(request: Request) {
  try {
    const tableName = getSourceTable(request);
    const pool = getPool();

    const intermedioCond = `hora_09 > 0 AND hora_00 = 0 AND hora_01 = 0 AND hora_02 = 0 AND hora_03 = 0 AND hora_04 = 0 AND hora_05 = 0 AND hora_06 = 0 AND hora_07 = 0 AND hora_08 = 0`;

    const [datesRes, circuitsRes, activitiesRes, shiftsRes, intermedioRes, functionsRes, operatorsRes] = await Promise.all([
      pool.query(`SELECT DISTINCT fecha FROM ${tableName} ORDER BY fecha`),
      pool.query(`SELECT DISTINCT circuito FROM ${tableName} ORDER BY circuito`),
      pool.query(`SELECT DISTINCT actividad FROM ${tableName} ORDER BY actividad`),
      pool.query(`SELECT turno, MAX(turno_desc) AS td FROM ${tableName} GROUP BY turno ORDER BY (ARRAY_AGG(ctid ORDER BY ctid))[1]`),
      pool.query(`SELECT EXISTS(SELECT 1 FROM ${tableName} WHERE ${intermedioCond}) AS has_intermedio`),
      pool.query(`SELECT funcion, MAX(funcion_desc) AS fd FROM ${tableName} GROUP BY funcion ORDER BY (ARRAY_AGG(ctid ORDER BY ctid))[1]`),
      pool.query(`SELECT operario, (ARRAY_AGG(nombre ORDER BY id DESC))[1] AS nombre FROM ${tableName} GROUP BY operario`),
    ]);

    const dates = (datesRes.rows as Record<string, unknown>[]).map((r) => Number(r.fecha)).sort((a, b) => a - b);
    const circuits = (circuitsRes.rows as Record<string, unknown>[]).map((r) => String(r.circuito ?? "")).sort();
    const activities = (activitiesRes.rows as Record<string, unknown>[])
      .map((r) => String(r.actividad ?? ""))
      .sort((a, b) => Number(a) - Number(b));

    const shifts = (shiftsRes.rows as Record<string, unknown>[]).map((r) => ({
      value: String(r.turno ?? ""),
      label: String(r.td ?? r.turno ?? ""),
    }));

    // ── Virtual "Intermedio" turno: records with first activity at hour 09 ──
    const hasIntermedio = Boolean(intermedioRes.rows[0]?.has_intermedio);
    if (hasIntermedio && !shifts.some((s) => s.value === "I")) {
      shifts.push({ value: "I", label: "Intermedio" });
    }

    const functions = (functionsRes.rows as Record<string, unknown>[]).map((r) => ({
      value: String(r.funcion ?? ""),
      label: String(r.fd ?? r.funcion ?? ""),
    }));

    // Operators: unique (operario, nombre) sorted by nombre
    const operators = (operatorsRes.rows as Record<string, unknown>[])
      .map((r) => ({ value: String(r.operario ?? ""), label: String(r.nombre ?? "") }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Months: unique YYYYMM from dates, with labels
    const monthSet = new Set<number>();
    for (const d of dates) monthSet.add(Math.floor(d / 100));
    const months = Array.from(monthSet).sort((a, b) => b - a); // most recent first

    return NextResponse.json({ dates, circuits, activities, shifts, functions, operators, months }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error("Error fetching filters:", error);
    return NextResponse.json({ error: "Error fetching filters" }, { status: 500 , headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
}
