import {
  getAllRecords,
  getSourceTable,
  parseFilters,
  getTMByDate,
  getTMByDateOperario,
} from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const [records, tmByDate, tmByDateOp] = await Promise.all([
      getAllRecords(filters, tableName),
      getTMByDate(filters),
      getTMByDateOperario(filters),
    ]);

    let totalTMMinutos: number;
    if (filters.operario) {
      totalTMMinutos = Object.values(tmByDateOp).reduce((s, v) => s + v, 0);
    } else {
      totalTMMinutos = Object.values(tmByDate).reduce((s, v) => s + v, 0);
    }
    const totalTMHoras = Math.round((totalTMMinutos / 60) * 100) / 100;

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

    // Misiones: unique (fecha, operario) combinations
    const missionSet = new Set<string>();
    for (const r of records) {
      missionSet.add(`${r.date}:${r.operario}`);
    }
    const totalMissions = missionSet.size;

    // Participación por turno (basada en misiones de cada turno)
    const shiftMissions: Record<string, { label: string; count: number; total: number }> = {};
    const missionKeys = new Set<string>();
    for (const r of records) {
      const key = `${r.date}:${r.operario}:${r.turno}`;
      if (!missionKeys.has(key)) {
        missionKeys.add(key);
        if (!shiftMissions[r.turno]) {
          shiftMissions[r.turno] = { label: r.turnoDesc, count: 0, total: 0 };
        }
        shiftMissions[r.turno].count += 1;
      }
      if (shiftMissions[r.turno]) {
        shiftMissions[r.turno].total += r.total;
      }
    }
    const totalShiftMissions = Object.values(shiftMissions).reduce(
      (sum, s) => sum + s.count,
      0
    );
    const shiftParticipation = Object.entries(shiftMissions)
      .map(([turno, data]) => ({
        turno,
        label: data.label,
        missions: data.count,
        total: data.total,
        percentage:
          totalShiftMissions > 0
            ? Math.round((data.count / totalShiftMissions) * 100)
            : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    return NextResponse.json({
      totalRecords: records.length,
      grandTotal,
      totalMissions,
      totalTMMinutos,
      totalTMHoras,
      shiftParticipation,
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