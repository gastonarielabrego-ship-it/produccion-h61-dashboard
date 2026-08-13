import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";

async function ensureTable() {
  const client = getClient();
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
    { sql: `CREATE INDEX IF NOT EXISTS idx_errores_fecha ON errores_records (fecha_prep)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_errores_motivo ON errores_records (motivo)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_errores_tipo_ctrl ON errores_records (tipo_control)` },
  ]);
}

export async function GET(request: Request) {
  try {
    await ensureTable();
    const client = getClient();
    const url = new URL(request.url);

    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const motivo = url.searchParams.get("motivo");

    const conditions: string[] = [];
    const params: Record<string, string | number> = {};

    if (dateFrom) { conditions.push("fecha_prep >= $df"); params.df = Number(dateFrom); }
    if (dateTo) { conditions.push("fecha_prep <= $dt"); params.dt = Number(dateTo); }
    if (motivo) { conditions.push("motivo = $motivo"); params.motivo = motivo; }

    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    // Monthly summary (without controladores)
    const monthlyResult = await client.execute({
      sql: `SELECT
        fecha_prep / 100 as month_key,
        COUNT(*) as total_errores,
        COUNT(DISTINCT fecha_prep) as dias,
        SUM(errores) as suma_errores
      FROM errores_records ${where}
      GROUP BY month_key
      ORDER BY month_key`,
      args: params,
    });

    // FAL/SOB breakdown by month
    const falSobResult = await client.execute({
      sql: `SELECT
        fecha_prep / 100 as month_key,
        motivo,
        COUNT(*) as total,
        SUM(errores) as suma
      FROM errores_records ${where}
      GROUP BY month_key, motivo
      ORDER BY month_key`,
      args: params,
    });

    // By motivo summary
    const motivoResult = await client.execute({
      sql: `SELECT motivo, COUNT(*) as total, SUM(errores) as suma FROM errores_records ${where} GROUP BY motivo ORDER BY total DESC`,
      args: params,
    });

    // Ranking by personal with FAL/SOB breakdown
    const rankingResult = await client.execute({
      sql: `SELECT tipo_control, motivo, COUNT(*) as total, SUM(errores) as suma FROM errores_records ${where} GROUP BY tipo_control, motivo ORDER BY tipo_control`,
      args: params,
    });

    // Daily data for chart
    const dailyResult = await client.execute({
      sql: `SELECT
        fecha_prep as date,
        COUNT(*) as total,
        SUM(errores) as suma
      FROM errores_records ${where}
      GROUP BY fecha_prep
      ORDER BY fecha_prep`,
      args: params,
    });

    // By motivo per month (FAL/SOB by month)
    const motivoMonthResult = await client.execute({
      sql: `SELECT
        fecha_prep / 100 as month_key,
        motivo,
        COUNT(*) as total,
        SUM(errores) as suma
      FROM errores_records ${where}
      GROUP BY month_key, motivo
      ORDER BY month_key, motivo`,
      args: params,
    });

    const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const monthly: { month: number; label: string; total: number; dias: number; sumaErrores: number; fal: number; sob: number }[] = [];
    for (let i = 0; i < monthlyResult.rows.length; i++) {
      const row = monthlyResult.rows[i];
      const mk = Number(row.month_key);
      const monthNum = mk % 100;
      const year = Math.floor(mk / 100);
      monthly.push({
        month: mk,
        label: (MONTH_NAMES[monthNum] || "") + " " + year,
        total: Number(row.total_errores),
        dias: Number(row.dias),
        sumaErrores: Number(row.suma_errores),
        fal: 0,
        sob: 0,
      });
    }

    // Fill FAL/SOB per month from motivoMonthResult
    for (let i = 0; i < motivoMonthResult.rows.length; i++) {
      const row = motivoMonthResult.rows[i];
      const mk = Number(row.month_key);
      const mot = String(row.motivo || "").toUpperCase().trim();
      const suma = Number(row.suma) || 0;
      for (let j = 0; j < monthly.length; j++) {
        if (monthly[j].month === mk) {
          if (mot.indexOf("FAL") >= 0) monthly[j].fal = suma;
          else if (mot.indexOf("SOB") >= 0) monthly[j].sob = suma;
          break;
        }
      }
    }

    const byMotivo: { motivo: string; total: number; suma: number }[] = [];
    for (let i = 0; i < motivoResult.rows.length; i++) {
      const row = motivoResult.rows[i];
      byMotivo.push({
        motivo: String(row.motivo || ""),
        total: Number(row.total),
        suma: Number(row.suma),
      });
    }

    // Build ranking with FAL/SOB per person
    const rankingMap: Record<string, { nombre: string; total: number; suma: number; fal: number; sob: number }> = {};
    for (let i = 0; i < rankingResult.rows.length; i++) {
      const row = rankingResult.rows[i];
      const nombre = String(row.tipo_control || "").trim();
      if (!nombre) continue;
      if (!rankingMap[nombre]) {
        rankingMap[nombre] = { nombre: nombre, total: 0, suma: 0, fal: 0, sob: 0 };
      }
      const r = rankingMap[nombre];
      r.total += Number(row.total);
      r.suma += Number(row.suma);
      const mot = String(row.motivo || "").toUpperCase().trim();
      if (mot.indexOf("FAL") >= 0) r.fal += Number(row.suma);
      else if (mot.indexOf("SOB") >= 0) r.sob += Number(row.suma);
    }

    const ranking: { nombre: string; total: number; suma: number; fal: number; sob: number }[] = [];
    const rankingKeys = Object.keys(rankingMap);
    for (let i = 0; i < rankingKeys.length; i++) {
      ranking.push(rankingMap[rankingKeys[i]]);
    }
    // Sort by suma DESC
    ranking.sort(function(a, b) { return b.suma - a.suma; });
    // Top 30
    if (ranking.length > 30) ranking.length = 30;

    const daily: { date: number; total: number; suma: number }[] = [];
    for (let i = 0; i < dailyResult.rows.length; i++) {
      const row = dailyResult.rows[i];
      daily.push({
        date: Number(row.date),
        total: Number(row.total),
        suma: Number(row.suma),
      });
    }

    return NextResponse.json({ monthly, byMotivo, ranking, daily });
  } catch (error) {
    console.error("Errores API error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
