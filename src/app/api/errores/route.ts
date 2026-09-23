import { getClient } from "@/lib/neon";
import { NextResponse } from "next/server";

// Tables are pre-created via Neon migration script

export async function GET(request: Request) {
  try {
    const client = getClient();
    const url = new URL(request.url);

    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const motivo = url.searchParams.get("motivo");

    // Build WHERE clause (PostgreSQL: positional params)
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let pIdx = 1;
    const addParam = (v: string | number): string => { params.push(v); return `$${pIdx++}`; };

    if (dateFrom) { conditions.push(`fecha_prep >= ${addParam(Number(dateFrom))}`); }
    if (dateTo) { conditions.push(`fecha_prep <= ${addParam(Number(dateTo))}`); }
    if (motivo) { conditions.push(`motivo = ${addParam(motivo)}`); }

    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    // Monthly summary
    const monthlyResult = await client.execute(
      `SELECT
        fecha_prep / 100 as month_key,
        COUNT(*) as total_errores,
        COUNT(DISTINCT fecha_prep) as dias,
        SUM(errores) as suma_errores
      FROM errores_records ${where}
      GROUP BY month_key
      ORDER BY month_key`,
      params,
    );

    // FAL/SOB breakdown by month
    const falSobResult = await client.execute(
      `SELECT
        fecha_prep / 100 as month_key,
        motivo,
        COUNT(*) as total,
        SUM(errores) as suma
      FROM errores_records ${where}
      GROUP BY month_key, motivo
      ORDER BY month_key`,
      params,
    );

    // By motivo summary
    const motivoResult = await client.execute(
      `SELECT motivo, COUNT(*) as total, SUM(errores) as suma FROM errores_records ${where} GROUP BY motivo ORDER BY total DESC`,
      params,
    );

    // Ranking by personal with FAL/SOB breakdown
    const rankingResult = await client.execute(
      `SELECT tipo_control, motivo, COUNT(*) as total, SUM(errores) as suma FROM errores_records ${where} GROUP BY tipo_control, motivo ORDER BY tipo_control`,
      params,
    );

    // Daily data for chart
    const dailyResult = await client.execute(
      `SELECT
        fecha_prep as date,
        COUNT(*) as total,
        SUM(errores) as suma
      FROM errores_records ${where}
      GROUP BY fecha_prep
      ORDER BY fecha_prep`,
      params,
    );

    // By motivo per month
    const motivoMonthResult = await client.execute(
      `SELECT
        fecha_prep / 100 as month_key,
        motivo,
        COUNT(*) as total,
        SUM(errores) as suma
      FROM errores_records ${where}
      GROUP BY month_key, motivo
      ORDER BY month_key, motivo`,
      params,
    );

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
    ranking.sort(function(a, b) { return b.suma - a.suma; });
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
