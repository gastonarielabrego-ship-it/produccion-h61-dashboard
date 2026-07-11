import {
  getAllRecords,
  getSourceTable,
  parseFilters,
} from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const operario = url.searchParams.get("operario");
    if (!operario) {
      return NextResponse.json(
        { error: "operario param required" },
        { status: 400 }
      );
    }

    // Optional hour range filter (used by Franjas)
    const hourFrom = url.searchParams.get("hourFrom");
    const hourTo = url.searchParams.get("hourTo");
    const hFrom = hourFrom ? parseInt(hourFrom, 10) : null;
    const hTo = hourTo ? parseInt(hourTo, 10) : null;

    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const records = await getAllRecords(filters, tableName);

    // Filter records for this operator
    const opRecords = records.filter((r) => r.operario === operario);

    // Aggregate hourly production (optionally filtered by hour range)
    const hourly: number[] = new Array(24).fill(0);
    let total = 0;
    const circuits = new Set<string>();
    const dates = new Set<number>();
    const shifts = new Set<string>();

    for (const r of opRecords) {
      let recordTotal = 0;
      for (const hd of r.hourlyData) {
        if (hFrom !== null && (hd.hour < hFrom || hd.hour >= hTo)) continue;
        hourly[hd.hour] += hd.quantity;
        recordTotal += hd.quantity;
      }
      if (recordTotal > 0) {
        total += recordTotal;
        circuits.add(r.circuito);
        dates.add(r.date);
        shifts.add(r.turnoDesc);
      }
    }

    // Active hours (hours with production > 0)
    const activeHours = hourly.filter((v) => v > 0).length;
    const avgPerActiveHour =
      activeHours > 0 ? Math.round(total / activeHours) : 0;

    // If hour range, only show those hours
    const startH = hFrom ?? 0;
    const endH = hTo ?? 24;
    const hourlyData = hourly
      .map((quantity, hour) => ({
        hour: `${String(hour).padStart(2, "0")}:00`,
        hourNum: hour,
        quantity,
      }))
      .filter((d) => d.hourNum >= startH && d.hourNum < endH);

    // Circuit breakdown (filtered by hour range)
    const circuitMap: Record<string, number> = {};
    for (const r of opRecords) {
      let recordTotal = 0;
      for (const hd of r.hourlyData) {
        if (hFrom !== null && (hd.hour < hFrom || hd.hour >= hTo)) continue;
        recordTotal += hd.quantity;
      }
      if (recordTotal > 0) {
        circuitMap[r.circuito] = (circuitMap[r.circuito] || 0) + recordTotal;
      }
    }
    const circuitBreakdown = Object.entries(circuitMap)
      .map(([circuito, total]) => ({ circuito, total }))
      .sort((a, b) => b.total - a.total);

    // Shift breakdown (filtered by hour range)
    const shiftMap: Record<string, number> = {};
    for (const r of opRecords) {
      let recordTotal = 0;
      for (const hd of r.hourlyData) {
        if (hFrom !== null && (hd.hour < hFrom || hd.hour >= hTo)) continue;
        recordTotal += hd.quantity;
      }
      if (recordTotal > 0) {
        shiftMap[r.turnoDesc] = (shiftMap[r.turnoDesc] || 0) + recordTotal;
      }
    }
    const shiftBreakdown = Object.entries(shiftMap)
      .map(([turno, total]) => ({ turno, total }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      operario,
      nombre: opRecords[0]?.nombre || operario,
      total,
      diasTrabajados: dates.size,
      horasConectado: activeHours,
      avgPerActiveHour,
      circuits: circuits.size,
      shifts: [...shifts],
      hourlyData,
      circuitBreakdown,
      shiftBreakdown,
    });
  } catch (error) {
    console.error("Error fetching operator hourly:", error);
    return NextResponse.json(
      { error: "Error fetching operator detail" },
      { status: 500 }
    );
  }
}