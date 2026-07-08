import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const turno = searchParams.get("turno");
    const funcion = searchParams.get("funcion");
    const circuito = searchParams.get("circuito");

    const where: Record<string, unknown> = {};
    if (date) where.date = Number(date);
    if (turno) where.turno = turno;
    if (funcion) where.funcion = funcion;
    if (circuito) where.circuito = circuito;

    const records = await db.productionRecord.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { hourlyData: { orderBy: { hour: "asc" } } },
    });

    // Group by circuit and hour
    const circuitHourly: Record<string, Record<number, number>> = {};

    for (const record of records) {
      if (!circuitHourly[record.circuito]) {
        const obj: Record<number, number> = {};
        for (let h = 0; h <= 23; h++) obj[h] = 0;
        circuitHourly[record.circuito] = obj;
      }
      for (const hd of record.hourlyData) {
        circuitHourly[record.circuito][hd.hour] += hd.quantity;
      }
    }

    const circuits = Object.keys(circuitHourly).sort();
    const hourlyData = [];
    for (let h = 0; h <= 23; h++) {
      const point: Record<string, string | number> = {
        hour: `${String(h).padStart(2, "0")}:00`,
        hourNum: h,
      };
      for (const c of circuits) {
        point[c] = circuitHourly[c][h];
      }
      hourlyData.push(point);
    }

    // Totals per circuit
    const circuitTotals = circuits.map((c) => ({
      circuito: c,
      total: Object.values(circuitHourly[c]).reduce((s, v) => s + v, 0),
    }));

    return NextResponse.json({
      circuits,
      circuitTotals: circuitTotals.sort((a, b) => b.total - a.total),
      hourlyData,
    });
  } catch (error) {
    console.error("Error fetching by-circuit:", error);
    return NextResponse.json(
      { error: "Error fetching circuit data" },
      { status: 500 }
    );
  }
}