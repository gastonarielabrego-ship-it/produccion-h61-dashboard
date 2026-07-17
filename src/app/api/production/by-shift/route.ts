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

    // Group by actividad value and hour
    const actHourly: Record<string, Record<number, number>> = {};

    for (const record of records) {
      const actKey = String(record.actividad || 0);
      if (!actHourly[actKey]) {
        const obj: Record<number, number> = {};
        for (let h = 0; h <= 23; h++) obj[h] = 0;
        actHourly[actKey] = obj;
      }
      for (const hd of record.hourlyData) {
        actHourly[actKey][hd.hour] += hd.quantity;
      }
    }

    const activities = Object.keys(actHourly).sort((a, b) => Number(a) - Number(b));
    const hourlyData: Record<string, string | number>[] = [];
    for (let h = 0; h <= 23; h++) {
      const point: Record<string, string | number> = {
        hour: `${String(h).padStart(2, "0")}:00`,
        hourNum: h,
      };
      for (const act of activities) {
        point[`Actividad ${act}`] = actHourly[act][h];
      }
      hourlyData.push(point);
    }

    const activityTotals = activities.map((act) => ({
      actividad: act,
      label: `Actividad ${act}`,
      total: Object.values(actHourly[act]).reduce((sum, v) => sum + v, 0),
      color: getActivityColor(act),
    }));

    return NextResponse.json({
      activities: activityTotals,
      hourlyData,
    });
  } catch (error) {
    console.error("Error fetching by-activity:", error);
    return NextResponse.json(
      { error: "Error fetching activity data" },
      { status: 500 }
    );
  }
}