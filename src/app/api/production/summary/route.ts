import {
  getAllRecords,
  parseFilters,
} from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const records = await getAllRecords(filters);

    // Total por circuito
    const byCircuit: Record<string, number> = {};
    for (const r of records) {
      byCircuit[r.circuito] = (byCircuit[r.circuito] || 0) + r.total;
    }
    const circuitData = Object.entries(byCircuit)
      .map(([circuito, total]) => ({ circuito, total }))
      .sort((a, b) => b.total - a.total);

    // Total por turno
    const byShift: Record<string, { label: string; total: number }> = {};
    for (const r of records) {
      if (!byShift[r.turno]) {
        byShift[r.turno] = { label: r.turnoDesc, total: 0 };
      }
      byShift[r.turno].total += r.total;
    }
    const shiftData = Object.entries(byShift).map(([turno, data]) => ({
      turno,
      label: data.label,
      total: data.total,
    }));

    // Total por fecha
    const byDate: Record<number, number> = {};
    for (const r of records) {
      byDate[r.date] = (byDate[r.date] || 0) + r.total;
    }
    const dateData = Object.entries(byDate)
      .map(([date, total]) => ({ date: Number(date), total }))
      .sort((a, b) => a.date - b.date);

    // Total por funcion
    const byFuncion: Record<string, { label: string; total: number }> = {};
    for (const r of records) {
      if (!byFuncion[r.funcion]) {
        byFuncion[r.funcion] = { label: r.funcionDesc, total: 0 };
      }
      byFuncion[r.funcion].total += r.total;
    }
    const funcionData = Object.entries(byFuncion).map(([funcion, data]) => ({
      funcion,
      label: data.label,
      total: data.total,
    }));

    const grandTotal = records.reduce((sum, r) => sum + r.total, 0);

    return NextResponse.json({
      totalRecords: records.length,
      grandTotal,
      circuitData,
      shiftData,
      dateData,
      funcionData,
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    return NextResponse.json(
      { error: "Error fetching summary" },
      { status: 500 }
    );
  }
}