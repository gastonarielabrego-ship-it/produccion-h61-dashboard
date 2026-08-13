import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";

async function ensureTable() {
  const client = getClient();
  return client.execute({ sql: "SELECT 1 FROM errores_records LIMIT 1" }).catch(() => {
    return client.batch([
      { sql: `CREATE TABLE IF NOT EXISTS errores_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_prep INTEGER NOT NULL,
        fecha_ctrl INTEGER NOT NULL,
        id_operario TEXT NOT NULL DEFAULT '',
        tipo_control TEXT NOT NULL DEFAULT '',
        controlador TEXT NOT NULL DEFAULT '',
        codigo_producto TEXT NOT NULL DEFAULT '',
        producto TEXT NOT NULL DEFAULT '',
        errores INTEGER NOT NULL DEFAULT 1,
        motivo TEXT NOT NULL DEFAULT ''
      )` },
    ]);
  });
}

export async function GET() {
  try {
    await ensureTable();
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
