import {
  getAllRecords,
  getSourceTable,
  parseFilters,
} from "@/lib/turso";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const records = await getAllRecords(filters, tableName);

    // ── 1. Daily metrics ─────────────────────────────────
    const dayMap: Record<
      number,
      {
        misionesSet: Set<string>;
        bultos: number;
        activeHourSet: Set<string>;
      }
    > = {};

    for (const r of records) {
      if (!dayMap[r.date]) {
        dayMap[r.date] = {
          misionesSet: new Set(),
          bultos: 0,
          activeHourSet: new Set(),
        };
      }
      const d = dayMap[r.date];
      d.misionesSet.add(r.operario);
      d.bultos += r.total;
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) {
          d.activeHourSet.add(`${r.date}:${hd.hour}`);
        }
      }
    }

    const sortedDates = Object.keys(dayMap)
      .map(Number)
      .sort((a, b) => a - b);

    const dailyMetrics = sortedDates.map((date) => {
      const d = dayMap[date];
      const misiones = d.misionesSet.size;
      const bultos = d.bultos;
      const horasProductivas = d.activeHourSet.size;
      const produccion = misiones > 0 ? Math.round((bultos / misiones) * 10) / 10 : 0;
      const bultosPorHora =
        horasProductivas > 0
          ? Math.round((bultos / horasProductivas) * 10) / 10
          : 0;
      return {
        date,
        misiones,
        bultos,
        horasProductivas,
        produccion,
        bultosPorHora,
      };
    });

    // ── 2. Day / Hour heatmap ────────────────────────────
    const dayHourMap: Record<string, number> = {};
    for (const r of records) {
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) {
          const key = `${r.date}:${hd.hour}`;
          dayHourMap[key] = (dayHourMap[key] || 0) + hd.quantity;
        }
      }
    }

    const dayHeatmap = sortedDates.map((date) => {
      const row: Record<string, number> = { date };
      for (let h = 0; h <= 23; h++) {
        row[String(h)] = dayHourMap[`${date}:${h}`] || 0;
      }
      return row;
    });

    // ── 3. Collaborator / Hour heatmap (all, sorted by total) ─
    const opTotalMap: Record<string, number> = {};
    const opNameMap: Record<string, string> = {};
    for (const r of records) {
      opTotalMap[r.operario] = (opTotalMap[r.operario] || 0) + r.total;
      opNameMap[r.operario] = r.nombre;
    }

    const sortedOps = Object.entries(opTotalMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([op]) => op);

    const opHourMap: Record<string, number> = {};
    for (const r of records) {
      for (const hd of r.hourlyData) {
        if (hd.quantity > 0) {
          const key = `${r.operario}:${hd.hour}`;
          opHourMap[key] = (opHourMap[key] || 0) + hd.quantity;
        }
      }
    }

    const collaboratorHeatmap = sortedOps.map((op) => {
      const row: Record<string, string | number> = {
        operario: op,
        nombre: opNameMap[op],
      };
      for (let h = 0; h <= 23; h++) {
        row[String(h)] = opHourMap[`${op}:${h}`] || 0;
      }
      return row;
    });

    return NextResponse.json({
      dailyMetrics,
      dayHeatmap,
      collaboratorHeatmap,
    });
  } catch (error) {
    console.error("Error fetching summary tables:", error);
    return NextResponse.json(
      { error: "Error fetching summary tables" },
      { status: 500 }
    );
  }
}