import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

function formatDate(n: number): string {
  const s = String(n);
  if (s.length !== 8) return s;
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export async function GET() {
  try {
    const client = getClient();

    await client.execute(`CREATE TABLE IF NOT EXISTS tiempos_muertos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, fecha INTEGER NOT NULL,
      turno TEXT NOT NULL, operario TEXT NOT NULL, nombre TEXT NOT NULL,
      estado TEXT, motivo INTEGER, minutos INTEGER NOT NULL DEFAULT 0,
      observacion TEXT, usuario_alta TEXT
    )`);

    const result = await client.execute("SELECT * FROM production_records ORDER BY fecha, turno, operario");
    const rows = result.rows;
    const tmResult = await client.execute("SELECT * FROM tiempos_muertos ORDER BY fecha, operario");
    const tmRows = tmResult.rows;

    const totalUnidades = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const fechas = [...new Set(rows.map((r) => Number(r.fecha)))].sort();
    const byCircuit: Record<string, number> = {};
    const byShift: Record<string, { label: string; total: number; count: number }> = {};
    const byDate: Record<number, number> = {};
    const byOp: Record<string, { nombre: string; total: number; entries: number }> = {};
    const hourly: number[] = Array(24).fill(0);
    const dayActiveHours: Record<number, Set<string>> = {};

    for (const r of rows) {
      const circ = String(r.circuito), turno = String(r.turno), turnoDesc = String(r.turno_desc);
      const fecha = Number(r.fecha), op = String(r.operario), nombre = String(r.nombre);
      const total = Number(r.total) || 0;
      byCircuit[circ] = (byCircuit[circ] || 0) + total;
      if (!byShift[turno]) byShift[turno] = { label: turnoDesc, total: 0, count: 0 };
      byShift[turno].total += total; byShift[turno].count += 1;
      byDate[fecha] = (byDate[fecha] || 0) + total;
      if (!byOp[op]) byOp[op] = { nombre, total: 0, entries: 0 };
      byOp[op].total += total; byOp[op].entries += 1;
      if (!dayActiveHours[fecha]) dayActiveHours[fecha] = new Set();
      for (let h = 0; h <= 23; h++) {
        const val = Number(r[`hora_${String(h).padStart(2, "0")}`]) || 0;
        hourly[h] += val;
        if (val > 0) dayActiveHours[fecha].add(`${fecha}:${h}`);
      }
    }

    const tmByDate: Record<number, number> = {};
    const tmByOp: Record<string, number> = {};
    let totalTMMinutos = 0;
    for (const r of tmRows) {
      const fecha = Number(r.fecha), op = String(r.operario), mins = Number(r.minutos) || 0;
      tmByDate[fecha] = (tmByDate[fecha] || 0) + mins;
      tmByOp[op] = (tmByOp[op] || 0) + mins;
      totalTMMinutos += mins;
    }

    const wb = XLSX.utils.book_new();

    // SHEET 1: RESUMEN
    const resumen: (string | number)[][] = [
      ["INFORME DE PRODUCCIÓN H61"], [],
      ["Período", `${formatDate(fechas[0])} al ${formatDate(fechas[fechas.length - 1])}`],
      ["Total Unidades", totalUnidades],
      ["Operarios Únicos", Object.keys(byOp).length],
      ["Días", fechas.length],
      ["Tiempos Muertos (min)", totalTMMinutos],
      ["Tiempos Muertos (hs)", Math.round((totalTMMinutos / 60) * 100) / 100], [],
      ["PRODUCCIÓN POR FECHA (CON TIEMPOS MUERTOS)"],
      ["Fecha", "Unidades", "Hs. Brutas", "TM (min)", "TM (hs)", "Hs. Netas", "B/H Bruta", "B/H Neta"],
    ];
    let sumB = 0, sumBrutas = 0, sumTM = 0;
    for (const [fecha, total] of Object.entries(byDate).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      const f = Number(fecha);
      const brutas = dayActiveHours[f]?.size || 0, tm = tmByDate[f] || 0;
      const tmH = Math.round((tm / 60) * 100) / 100, netas = Math.round((brutas - tmH) * 100) / 100;
      sumB += total; sumBrutas += brutas; sumTM += tm;
      resumen.push([formatDate(f), total, brutas, tm, tmH, netas,
        brutas > 0 ? Math.round((total / brutas) * 10) / 10 : 0,
        netas > 0 ? Math.round((total / netas) * 10) / 10 : 0]);
    }
    const sumTmH = Math.round((sumTM / 60) * 100) / 100, sumNetas = Math.round((sumBrutas - sumTmH) * 100) / 100;
    resumen.push(["TOTAL", sumB, sumBrutas, sumTM, sumTmH, sumNetas,
      sumBrutas > 0 ? Math.round((sumB / sumBrutas) * 10) / 10 : 0,
      sumNetas > 0 ? Math.round((sumB / sumNetas) * 10) / 10 : 0]);
    resumen.push([]);

    resumen.push(["PRODUCCIÓN POR HORA"], ["Hora", "Unidades"]);
    for (let h = 0; h <= 23; h++) {
      if (hourly[h] > 0) resumen.push([`${String(h).padStart(2, "0")}:00`, hourly[h]]);
    }

    const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
    wsResumen["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    // SHEET 2: RANKING
    const rankingData: (string | number)[][] = [["RANKING DE OPERARIOS"], [], ["#", "Operario", "Nombre", "Unidades", "TM (min)", "TM (hs)"]];
    const topOps = Object.entries(byOp).sort((a, b) => b[1].total - a[1].total);
    topOps.forEach(([op, data], idx) => {
      const tmM = tmByOp[op] || 0;
      rankingData.push([idx + 1, op, data.nombre, data.total, tmM, Math.round((tmM / 60) * 100) / 100]);
    });
    rankingData.push([], ["Total", "", "", topOps.length, totalTMMinutos, Math.round((totalTMMinutos / 60) * 100) / 100]);
    const wsRanking = XLSX.utils.aoa_to_sheet(rankingData);
    wsRanking["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 35 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsRanking, "Ranking Operarios");

    // SHEET 3: DETALLE
    const detalleData: (string | number)[][] = [["DETALLE POR DÍA Y TURNO"], [], ["Fecha", "Turno", "Circuito", "Operario", "Nombre", "Total"]];
    for (const r of [...rows].sort((a, b) => Number(a.fecha) - Number(b.fecha) || String(a.turno).localeCompare(String(b.turno)))) {
      detalleData.push([formatDate(Number(r.fecha)), String(r.turno_desc), String(r.circuito), String(r.operario), String(r.nombre), Number(r.total) || 0]);
    }
    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
    wsDetalle["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 35 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle");

    // SHEET 4: TIEMPOS MUERTOS
    const tmData: (string | number | null)[][] = [["TIEMPOS MUERTOS"], [], ["Fecha", "Turno", "Operario", "Nombre", "Motivo", "Minutos", "Observación"]];
    for (const r of tmRows) {
      tmData.push([formatDate(Number(r.fecha)), String(r.turno), String(r.operario), String(r.nombre), r.motivo || "", Number(r.minutos) || 0, r.observacion || ""]);
    }
    const wsTM = XLSX.utils.aoa_to_sheet(tmData);
    wsTM["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 35 }, { wch: 8 }, { wch: 10 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, wsTM, "Tiempos Muertos");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const dateRange = `${formatDate(fechas[0]).replace(/\//g, "-")}_a_${formatDate(fechas[fechas.length - 1]).replace(/\//g, "-")}`;
    return new NextResponse(buffer, {
      status: 200,
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="informe_produccion_h61_${dateRange}.xlsx"` },
    });
  } catch (error: any) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: error.message || "Error al generar el informe" }, { status: 500 });
  }
}