import { getClient } from "@/lib/neon";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

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

    return NextResponse.json({ dates, months }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ dates: [], months: [], error: error.message }, { status: 500 , headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
}
