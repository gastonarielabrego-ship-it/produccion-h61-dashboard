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
    { sql: `CREATE INDEX IF NOT EXISTS idx_errores_controlador ON errores_records (controlador)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_errores_motivo ON errores_records (motivo)` },
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
    const controlador = url.searchParams.get("controlador");

    const conditions: string[] = [];
    const params: Record<string, string | number> = {};

    if (dateFrom) { conditions.push("fecha_prep >= $df"); params.df = Number(dateFrom); }
    if (dateTo) { conditions.push("fecha_prep <= $dt"); params.dt = Number(dateTo); }
    if (motivo) { conditions.push("motivo = $motivo"); params.motivo = motivo; }
    if (controlador) { conditions.push("controlador = $ctrl"); params.ctrl = controlador; }

    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const result = await client.execute({
      sql: `SELECT * FROM errores_records ${where} ORDER BY fecha_prep DESC, controlador, producto`,
      args: params,
    });

    // Monthly summary
    const monthlyResult = await client.execute({
      sql: `SELECT
        fecha_prep / 100 as month_key,
        COUNT(*) as total_errores,
        COUNT(DISTINCT controlador) as controladores,
        COUNT(DISTINCT fecha_prep) as dias,
        SUM(errores) as suma_errores
      FROM errores_records ${where}
      GROUP BY month_key
      ORDER BY month_key`,
      args: params,
    });

    // By motivo summary
    const motivoResult = await client.execute({
      sql: `SELECT motivo, COUNT(*) as total, SUM(errores) as suma FROM errores_records ${where} GROUP BY motivo ORDER BY total DESC`,
      args: params,
    });

    // By controlador summary (top 20)
    const ctrlResult = await client.execute({
      sql: `SELECT controlador, COUNT(*) as total, SUM(errores) as suma FROM errores_records ${where} GROUP BY controlador ORDER BY total DESC LIMIT 50`,
      args: params,
    });

    const records = result.rows.map(function(row) {
      return {
        fechaPrep: Number(row.fecha_prep),
        fechaCtrl: Number(row.fecha_ctrl),
        idOperario: String(row.id_operario || ""),
        tipoControl: String(row.tipo_control || ""),
        controlador: String(row.controlador || ""),
        codigoProducto: String(row.codigo_producto || ""),
        producto: String(row.producto || ""),
        errores: Number(row.errores || 1),
        motivo: String(row.motivo || ""),
      };
    });

    const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const monthly = monthlyResult.rows.map(function(row) {
      const mk = Number(row.month_key);
      const monthNum = mk % 100;
      const year = Math.floor(mk / 100);
      return {
        month: mk,
        label: (MONTH_NAMES[monthNum] || "") + " " + year,
        total: Number(row.total_errores),
        controladores: Number(row.controladores),
        dias: Number(row.dias),
        sumaErrores: Number(row.suma_errores),
      };
    });

    const byMotivo = motivoResult.rows.map(function(row) {
      return {
        motivo: String(row.motivo || ""),
        total: Number(row.total),
        suma: Number(row.suma),
      };
    });

    const byControlador = ctrlResult.rows.map(function(row) {
      return {
        controlador: String(row.controlador || ""),
        total: Number(row.total),
        suma: Number(row.suma),
      };
    });

    return NextResponse.json({ records, monthly, byMotivo, byControlador });
  } catch (error) {
    console.error("Errores API error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
