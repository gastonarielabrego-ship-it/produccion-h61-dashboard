import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const turno = searchParams.get("turno");
    const circuito = searchParams.get("circuito");
    const funcion = searchParams.get("funcion");

    const where: Record<string, unknown> = {};
    if (date) where.date = Number(date);
    if (turno) where.turno = turno;
    if (circuito) where.circuito = circuito;
    if (funcion) where.funcion = funcion;

    const records = await db.productionRecord.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { hourlyData: { orderBy: { hour: "asc" } } },
    });

    // Aggregate hourly production
    const hourlyTotals: Record<number, number> = {};
    for (let h = 0; h <= 23; h++) {
      hourlyTotals[h] = 0;
    }

    let grandTotal = 0;
    const circuitBreakdown: Record<string, number> = {};

    for (const record of records) {
      grandTotal += record.total;
      circuitBreakdown[record.circuito] =
        (circuitBreakdown[record.circuito] || 0) + record.total;

      for (const hd of record.hourlyData) {
        hourlyTotals[hd.hour] += hd.quantity;
      }
    }

    const hourlyData = Object.entries(hourlyTotals).map(([hour, quantity]) => ({
      hour: `${hour.padStart(2, "0")}:00`,
      hourNum: Number(hour),
      quantity,
    }));

    const circuitData = Object.entries(circuitBreakdown)
      .map(([circuito, total]) => ({ circuito, total }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      totalRecords: records.length,
      grandTotal,
      hourlyData,
      circuitData,
    });
  } catch (error) {
    console.error("Error fetching hourly production:", error);
    return NextResponse.json(
      { error: "Error fetching production data" },
      { status: 500 }
    );
  }
}