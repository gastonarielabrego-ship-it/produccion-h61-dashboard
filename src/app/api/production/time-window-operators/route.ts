import {
  getAllRecords,
  parseFilters,
  applyFilters,
  type ProductionRecord,
} from "@/lib/google-sheets";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const allRecords = await getAllRecords();
    const records = applyFilters(allRecords, filters);

    const window1Hours = [10, 11, 12, 13];
    const window2Hours = [18, 19, 20, 21];

    function getFirstActiveHour(
      hourlyData: { hour: number; quantity: number }[]
    ): number {
      for (const hd of hourlyData) {
        if (hd.quantity > 0) return hd.hour;
      }
      return -1;
    }

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
        window1Entries: number;
        window2Entries: number;
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

      if (firstHour >= 10) {
        op.window1Entries += 1;
        for (const hd of record.hourlyData) {
          if (window1Hours.includes(hd.hour)) {
            op.window1 += hd.quantity;
          }
        }
      }

      if (firstHour >= 18) {
        op.window2Entries += 1;
        for (const hd of record.hourlyData) {
          if (window2Hours.includes(hd.hour)) {
            op.window2 += hd.quantity;
          }
        }
      }
    }

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