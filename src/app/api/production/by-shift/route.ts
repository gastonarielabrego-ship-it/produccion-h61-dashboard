import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const circuito = searchParams.get("circuito");
    const funcion = searchParams.get("funcion");

    const where: Record<string, unknown> = {};
    if (date) where.date = Number(date);
    if (circuito) where.circuito = circuito;
    if (funcion) where.funcion = funcion;

    const records = await db.productionRecord.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { hourlyData: { orderBy: { hour: "asc" } } },
    });

    // Group by shift and hour
    const shiftHourly: Record<string, Record<number, number>> = {};

    for (const record of records) {
      if (!shiftHourly[record.turno]) {
        const obj: Record<number, number> = {};
        for (let h = 0; h <= 23; h++) obj[h] = 0;
        shiftHourly[record.turno] = obj;
      }
      for (const hd of record.hourlyData) {
        shiftHourly[record.turno][hd.hour] += hd.quantity;
      }
    }

    const shifts = Object.keys(shiftHourly).sort();
    const hourlyData = [];
    for (let h = 0; h <= 23; h++) {
      const point: Record<string, string | number> = {
        hour: `${String(h).padStart(2, "0")}:00`,
        hourNum: h,
      };
      for (const s of shifts) {
        const label =
          s === "M" ? "Mañana" : s === "T" ? "Tarde" : "Noche";
        point[label] = shiftHourly[s][h];
      }
      hourlyData.push(point);
    }

    const shiftTotals = shifts.map((s) => ({
      turno: s,
      label: s === "M" ? "Mañana" : s === "T" ? "Tarde" : "Noche",
      total: Object.values(shiftHourly[s]).reduce((sum, v) => sum + v, 0),
    }));

    return NextResponse.json({
      shifts: shiftTotals,
      hourlyData,
    });
  } catch (error) {
    console.error("Error fetching by-shift:", error);
    return NextResponse.json(
      { error: "Error fetching shift data" },
      { status: 500 }
    );
  }
}