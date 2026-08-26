import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";

function ensureTable() {
  const client = getClient();
  return client.execute({
    sql: `CREATE TABLE IF NOT EXISTS rendimientos_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL DEFAULT '',
      dia TEXT NOT NULL DEFAULT '',
      fecha INTEGER NOT NULL DEFAULT 0,
      bultos INTEGER NOT NULL DEFAULT 0,
      hs_brutas REAL NOT NULL DEFAULT 0,
      tm_hs REAL NOT NULL DEFAULT 0,
      hs_netas REAL NOT NULL DEFAULT 0,
      produccion REAL NOT NULL DEFAULT 0,
      bh_bruta REAL NOT NULL DEFAULT 0,
      bh_neta REAL NOT NULL DEFAULT 0
    )`,
  });
}

export async function GET(request: Request) {
  try {
    await ensureTable();
    const client = getClient();
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    let where = "WHERE 1=1";
    const params: Record<string, string | number> = {};
    if (dateFrom) { where += " AND fecha >= $dateFrom"; params.dateFrom = Number(dateFrom); }
    if (dateTo) { where += " AND fecha <= $dateTo"; params.dateTo = Number(dateTo); }

    // ── 1. Daily data per person ──
    const dailyResult = await client.execute({
      sql: `SELECT nombre, dia, fecha, bultos, hs_brutas, tm_hs, hs_netas, produccion, bh_bruta, bh_neta
        FROM rendimientos_records ${where} ORDER BY nombre, fecha`,
      args: params,
    });

    // ── 2. Summary per person ──
    const summaryResult = await client.execute({
      sql: `SELECT nombre,
        SUM(bultos) as total_bultos,
        SUM(hs_brutas) as total_hs_brutas,
        SUM(tm_hs) as total_tm,
        SUM(hs_netas) as total_hs_netas,
        SUM(bultos) * 1.0 / NULLIF(SUM(hs_brutas), 0) as avg_bh_bruta,
        SUM(bultos) * 1.0 / NULLIF(SUM(hs_netas), 0) as avg_bh_neta,
        COUNT(DISTINCT fecha) as dias
        FROM rendimientos_records ${where} GROUP BY nombre ORDER BY nombre`,
      args: params,
    });

    // ── 3. Available dates ──
    const datesResult = await client.execute({
      sql: "SELECT DISTINCT fecha, dia FROM rendimientos_records ORDER BY fecha",
    });

    // ── 4. Grand totals ──
    const totalsResult = await client.execute({
      sql: `SELECT
        SUM(bultos) as total_bultos,
        SUM(hs_brutas) as total_hs_brutas,
        SUM(tm_hs) as total_tm,
        SUM(hs_netas) as total_hs_netas,
        COUNT(DISTINCT nombre) as personal,
        COUNT(DISTINCT fecha) as dias,
        COUNT(*) as registros
        FROM rendimientos_records ${where}`,
      args: params,
    });

    const totals = totalsResult.rows[0] || {};
    const totalBultos = Number(totals.total_bultos ?? 0);
    const totalHsBrutas = Number(totals.total_hs_brutas ?? 0);
    const totalHsNetas = Number(totals.total_hs_netas ?? 0);

    return NextResponse.json({
      daily: dailyResult.rows,
      summary: summaryResult.rows,
      dates: datesResult.rows,
      totals: {
        totalBultos,
        totalHsBrutas,
        totalTm: Number(totals.total_tm ?? 0),
        totalHsNetas,
        bhBruta: totalHsBrutas > 0 ? totalBultos / totalHsBrutas : 0,
        bhNeta: totalHsNetas > 0 ? totalBultos / totalHsNetas : 0,
        personal: Number(totals.personal ?? 0),
        dias: Number(totals.dias ?? 0),
        registros: Number(totals.registros ?? 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
