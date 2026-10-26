import {
  getAllRecords,
  getSourceTable,
  getClient,
} from "@/lib/neon";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Always fetch ALL records for filter dropdowns (no user filters applied)
    const tableName = getSourceTable(request);
    const records = await getAllRecords(undefined, tableName);

    const dates = [...new Set(records.map((r) => r.date))].sort();
    const circuits = [...new Set(records.map((r) => r.circuito))].sort();
    const activities = [...new Set(records.map((r) => String(r.actividad)))].sort((a, b) => Number(a) - Number(b));

    const shiftMap = new Map<string, string>();
    for (const r of records) shiftMap.set(r.turno, r.turnoDesc);
    const shifts = Array.from(shiftMap.entries()).map(([value, label]) => ({
      value,
      label,
    }));

    // ── Virtual "Intermedio" turno: detect records with first activity at hour 09 ──
    // If any record has hora_09 > 0 AND all hours 0-8 = 0, add "I" / "Intermedio" as a shift option
    let hasIntermedio = false;
    for (const r of records) {
      const hasHour09 = r.hourlyData.some((h) => h.hour === 9 && h.quantity > 0);
      const hasBefore09 = r.hourlyData.some((h) => h.hour < 9 && h.quantity > 0);
      if (hasHour09 && !hasBefore09) {
        hasIntermedio = true;
        break;
      }
    }
    if (hasIntermedio) {
      // Only add if not already present (avoid duplicates if DB already has "I")
      if (!shifts.some((s) => s.value === "I")) {
        shifts.push({ value: "I", label: "Intermedio" });
      }
    }

    const funcMap = new Map<string, string>();
    for (const r of records) funcMap.set(r.funcion, r.funcionDesc);
    const functions = Array.from(funcMap.entries()).map(([value, label]) => ({
      value,
      label,
    }));

    // Operators: unique (operario, nombre) sorted by nombre
    const opMap = new Map<string, string>();
    for (const r of records) opMap.set(r.operario, r.nombre);
    const operators = Array.from(opMap.entries())
      .map(([value, label]) => ({ value, label }))
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
