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

    // Fetch all relevant records with hourly data
    const records = await db.productionRecord.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { hourlyData: { orderBy: { hour: "asc" } } },
    });

    // Hours for each window
    const window1Hours = [10, 11, 12, 13]; // 10:00 - 13:59
    const window2Hours = [18, 19, 20, 21]; // 18:00 - 21:59

    // Helper: find the first hour with production > 0
    function getFirstActiveHour(hourlyData: { hour: number; quantity: number }[]): number {
      for (const hd of hourlyData) {
        if (hd.quantity > 0) return hd.hour;
      }
      return -1; // no activity
    }

    // Aggregate per operator
    // Key: operario, but we track per-record entry hour to decide eligibility
    const operatorMap: Record<
      string,
      {
        operario: string;
        nombre: string;
        window1: number;
        window2: number;
        totalGeneral: number;
        circuits: Set<string>;
        entries: number;
        window1Entries: number; // records where entry >= 10
        window2Entries: number; // records where entry >= 18
      }
    > = {};

    for (const record of records) {
      if (!operatorMap[record.operario]) {
        operatorMap[record.operario] = {
          operario: record.operario,
          nombre: record.nombre,
          window1: 0,
          window2: 0,
          totalGeneral: 0,
          circuits: new Set<string>(),
          entries: 0,
          window1Entries: 0,
          window2Entries: 0,
        };
      }

      const op = operatorMap[record.operario];
      op.totalGeneral += record.total;
      op.entries += 1;
      op.circuits.add(record.circuito);

      const firstHour = getFirstActiveHour(record.hourlyData);

      // Only count 10-14 production if this record's first activity is at hour 10 or later
      if (firstHour >= 10) {
        op.window1Entries += 1;
        for (const hd of record.hourlyData) {
          if (window1Hours.includes(hd.hour)) {
            op.window1 += hd.quantity;
          }
        }
      }

      // Only count 18-22 production if this record's first activity is at hour 18 or later
      if (firstHour >= 18) {
        op.window2Entries += 1;
        for (const hd of record.hourlyData) {
          if (window2Hours.includes(hd.hour)) {
            op.window2 += hd.quantity;
          }
        }
      }
    }

    // Convert to array, only include operators who produced in at least one window
    const operators = Object.values(operatorMap)
      .filter((op) => op.window1 > 0 || op.window2 > 0)
      .map((op) => ({
        operario: op.operario,
        nombre: op.nombre,
        window1: op.window1,
        window2: op.window2,
        totalGeneral: op.totalGeneral,
        circuitCount: op.circuits.size,
        circuits: Array.from(op.circuits).sort(),
        entries: op.entries,
        window1Entries: op.window1Entries,
        window2Entries: op.window2Entries,
      }))
      .sort((a, b) => (b.window1 + b.window2) - (a.window1 + a.window2));

    // Summary stats
    const totalWindow1 = operators.reduce((s, o) => s + o.window1, 0);
    const totalWindow2 = operators.reduce((s, o) => s + o.window2, 0);
    const activeWindow1 = operators.filter((o) => o.window1 > 0).length;
    const activeWindow2 = operators.filter((o) => o.window2 > 0).length;
    const bothWindows = operators.filter(
      (o) => o.window1 > 0 && o.window2 > 0
    ).length;

    return NextResponse.json({
      operators,
      summary: {
        totalWindow1,
        totalWindow2,
        activeWindow1,
        activeWindow2,
        bothWindows,
        totalOperators: operators.length,
      },
    });
  } catch (error) {
    console.error("Error fetching time-window operators:", error);
    return NextResponse.json(
      { error: "Error fetching time-window data" },
      { status: 500 }
    );
  }
}