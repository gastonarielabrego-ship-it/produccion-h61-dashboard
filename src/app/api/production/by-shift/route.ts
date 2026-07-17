import {
  getAllRecords,
  getSourceTable,
  parseFilters,
} from "@/lib/turso";
import { NextResponse } from "next/server";

const ACTIVITY_COLORS: Record<string, string> = {
  "2": "#10b981",
  "4": "#6366f1",
  "6": "#f59e0b",
  "8": "#ef4444",
  "10": "#8b5cf6",
};

export function getActivityColor(key: string): string {
  return ACTIVITY_COLORS[key] || "#64748b";
}

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);
    const records = await getAllRecords(filters, tableName);

    // 1. Bultos per hour per activity (for stacked bars)
    const actHourly: Record<string, Record<number, number>> = {};

    // 2. Active operators per hour (for line)
    const opHourly: Record<number, Set<string>> = {};
    for (let h = 0; h <= 23; h++) opHourly[h] = new Set();

    // 3. Bultos per hour total (for total bar)
    const totalHourly: Record<number, number> = {};
    for (let h = 0; h <= 23; h++) totalHourly[h] = 0;

    for (const record of records) {
      const actKey = String(record.actividad || 0);
      if (!actHourly[actKey]) {
        const obj: Record<number, number> = {};
        for (let h = 0; h <= 23; h++) obj[h] = 0;
        actHourly[actKey] = obj;
      }
      for (const hd of record.hourlyData) {
        if (hd.quantity > 0) {
          actHourly[actKey][hd.hour] += hd.quantity;
          opHourly[hd.hour].add(`${record.date}:${record.operario}`);
          totalHourly[hd.hour] += hd.quantity;
        }
      }
    }

    const activities = Object.keys(actHourly).sort((a, b) => Number(a) - Number(b));

    // Build hourly data points
    const hourlyData: Record<string, string | number>[] = [];
    for (let h = 0; h <= 23; h++) {
      const point: Record<string, string | number> = {
        hour: `${String(h).padStart(2, "0")}:00`,
        hourNum: h,
      };
      for (const act of activities) {
        point[`Actividad ${act}`] = actHourly[act][h];
      }
      point["Operarios"] = opHourly[h].size;
      hourlyData.push(point);
    }

    // Totals per activity
    const activityTotals = activities.map((act) => ({
      actividad: act,
      label: `Actividad ${act}`,
      total: Object.values(actHourly[act]).reduce((sum, v) => sum + v, 0),
      color: getActivityColor(act),
    }));

    // Average bultos per hour (for reference line)
    const totalBultos = Object.values(totalHourly).reduce((s, v) => s + v, 0);
    const activeHours = Object.values(totalHourly).filter((v) => v > 0).length;
    const avgHourly = activeHours > 0 ? Math.round(totalBultos / activeHours) : 0;

    return NextResponse.json({
      activities: activityTotals,
      hourlyData,
      avgHourly,
      totalBultos,
      totalMisiones: Object.values(opHourly).reduce((max, s) => Math.max(max, s.size), 0),
    });
  } catch (error) {
    console.error("Error fetching by-activity:", error);
    return NextResponse.json(
      { error: "Error fetching activity data" },
      { status: 500 }
    );
  }
}