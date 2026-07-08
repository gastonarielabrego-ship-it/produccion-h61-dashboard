import {
  getAllRecords,
  parseFilters,
  type ProductionRecord,
} from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const records = await getAllRecords(filters);

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

    return NextResponse.json({ dates, circuits, shifts, functions });
  } catch (error) {
    console.error("Error fetching filters:", error);
    return NextResponse.json(
      { error: "Error fetching filters" },
      { status: 500 }
    );
  }
}