import {
  getAllRecords,
  getSourceTable,
} from "@/lib/turso";
import { NextResponse } from "next/server";

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

    return NextResponse.json({ dates, circuits, activities, shifts, functions, operators, months });
  } catch (error) {
    console.error("Error fetching filters:", error);
    return NextResponse.json(
      { error: "Error fetching filters" },
      { status: 500 }
    );
  }
}