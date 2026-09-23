import { getClient } from "@/lib/neon";
import { NextResponse } from "next/server";

// Tables pre-created via Neon migration

export async function GET() {
  try {
    const client = getClient();
    const datesResult = await client.execute("SELECT DISTINCT fecha_prep FROM errores_records ORDER BY fecha_prep DESC");
    const monthsResult = await client.execute("SELECT DISTINCT fecha_prep / 100 as month_key FROM errores_records ORDER BY month_key DESC");

    const dates: number[] = [];
    for (let i = 0; i < datesResult.rows.length; i++) {
      dates.push(Number(datesResult.rows[i].fecha_prep));
    }

    const months: number[] = [];
    for (let i = 0; i < monthsResult.rows.length; i++) {
      months.push(Number(monthsResult.rows[i].month_key));
    }

    return NextResponse.json({ dates, months });
  } catch (error: any) {
    return NextResponse.json({ dates: [], months: [], error: error.message }, { status: 500 });
  }
}
