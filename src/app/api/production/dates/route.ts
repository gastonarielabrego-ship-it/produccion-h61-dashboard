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

    return NextResponse.json({ dates, circuits, shifts, functions, operators });
  } catch (error) {
    console.error("Error fetching filters:", error);
    return NextResponse.json(
      { error: "Error fetching filters" },
      { status: 500 }
    );
  }
}