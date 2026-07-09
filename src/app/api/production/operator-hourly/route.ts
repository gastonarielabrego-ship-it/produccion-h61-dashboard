import {
  getAllRecords,
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

    const filters = parseFilters(request);
    const records = await getAllRecords(filters);

    // Filter records for this operator
    const opRecords = records.filter((r) => r.operario === operario);

    // Aggregate hourly production
    const hourly: number[] = new Array(24).fill(0);
    let total = 0;
    const circuits = new Set<string>();
    const dates = new Set<number>();
    const shifts = new Set<string>();

    for (const r of opRecords) {
      total += r.total;
      circuits.add(r.circuito);
      dates.add(r.date);
      shifts.add(r.turnoDesc);
      for (const hd of r.hourlyData) {
        hourly[hd.hour] += hd.quantity;
      }
    }

    // Active hours (hours with production > 0)
    const activeHours = hourly.filter((v) => v > 0).length;
    const avgPerActiveHour =
      activeHours > 0 ? Math.round(total / activeHours) : 0;

    const hourlyData = hourly.map((quantity, hour) => ({
      hour: `${String(hour).padStart(2, "0")}:00`,
      hourNum: hour,
      quantity,
    }));

    // Circuit breakdown
    const circuitMap: Record<string, number> = {};
    for (const r of opRecords) {
      circuitMap[r.circuito] = (circuitMap[r.circuito] || 0) + r.total;
    }
    const circuitBreakdown = Object.entries(circuitMap)
      .map(([circuito, total]) => ({ circuito, total }))
      .sort((a, b) => b.total - a.total);

    // Shift breakdown
    const shiftMap: Record<string, number> = {};
    for (const r of opRecords) {
      shiftMap[r.turnoDesc] = (shiftMap[r.turnoDesc] || 0) + r.total;
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