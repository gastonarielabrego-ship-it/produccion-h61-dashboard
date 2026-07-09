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

    // ── Raw data ──
    const result = await client.execute(
      "SELECT * FROM production_records ORDER BY fecha, turno, operario"
    );
    const rows = result.rows;

    // ── Aggregations ──
    const totalRegistros = rows.length;
    const totalUnidades = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const operariosUnicos = new Set(rows.map((r) => String(r.operario))).size;
    const fechas = [...new Set(rows.map((r) => Number(r.fecha)))].sort();
    const circuitos = [...new Set(rows.map((r) => String(r.circuito)))].sort();

    // By circuit
    const byCircuit: Record<string, number> = {};
    // By shift
    const byShift: Record<string, { label: string; total: number; count: number }> = {};
    // By date
    const byDate: Record<number, number> = {};
    // By operator
    const byOp: Record<string, { nombre: string; total: number; entries: number }> = {};
    // Hourly totals
    const hourly: number[] = Array(24).fill(0);

    for (const r of rows) {
      const circ = String(r.circuito);
      const turno = String(r.turno);
      const turnoDesc = String(r.turno_desc);
      const fecha = Number(r.fecha);
      const op = String(r.operario);
      const nombre = String(r.nombre);
      const total = Number(r.total) || 0;

      byCircuit[circ] = (byCircuit[circ] || 0) + total;

      if (!byShift[turno]) byShift[turno] = { label: turnoDesc, total: 0, count: 0 };
      byShift[turno].total += total;
      byShift[turno].count += 1;

      byDate[fecha] = (byDate[fecha] || 0) + total;

      if (!byOp[op]) byOp[op] = { nombre, total: 0, entries: 0 };
      byOp[op].total += total;
      byOp[op].entries += 1;

      for (let h = 0; h <= 23; h++) {
        hourly[h] += Number(r[`hora_${String(h).padStart(2, "0")}`]) || 0;
      }
    }

    // ── Build workbook ──
    const wb = XLSX.utils.book_new();

    // ═══════════ SHEET 1: RESUMEN ═══════════
    const resumen: (string | number)[][] = [];

    resumen.push(["INFORME DE PRODUCCIÓN H61"]);
    resumen.push([]);
    resumen.push(["Período", `${formatDate(fechas[0])} al ${formatDate(fechas[fechas.length - 1])}`]);
    resumen.push(["Total Registros", totalRegistros]);
    resumen.push(["Total Unidades", totalUnidades]);
    resumen.push(["Operarios Únicos", operariosUnicos]);
    resumen.push(["Días", fechas.length]);
    resumen.push(["Circuitos", circuitos.length]);
    resumen.push([]);

    // By circuit table
    resumen.push(["PRODUCCIÓN POR CIRCUITO"]);
    resumen.push(["Circuito", "Unidades", "% del Total"]);
    const sortedCircuits = Object.entries(byCircuit).sort((a, b) => b[1] - a[1]);
    for (const [circ, total] of sortedCircuits) {
      resumen.push([circ, total, Math.round((total / totalUnidades) * 10000) / 100]);
    }
    resumen.push([]);

    // By shift table
    resumen.push(["PRODUCCIÓN POR TURNO"]);
    resumen.push(["Turno", "Unidades", "Registros", "% del Total"]);
    const sortedShifts = Object.entries(byShift).sort((a, b) => b[1].total - a[1].total);
    for (const [turno, data] of sortedShifts) {
      resumen.push([data.label, data.total, data.count, Math.round((data.total / totalUnidades) * 10000) / 100]);
    }
    resumen.push([]);

    // By date table
    resumen.push(["PRODUCCIÓN POR FECHA"]);
    resumen.push(["Fecha", "Unidades", "% del Total"]);
    for (const [fecha, total] of Object.entries(byDate).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      resumen.push([formatDate(Number(fecha)), total, Math.round((total / totalUnidades) * 10000) / 100]);
    }
    resumen.push([]);

    // Hourly profile
    resumen.push(["PRODUCCIÓN POR HORA (acumulado)"]);
    resumen.push(["Hora", "Unidades", "% del Total"]);
    for (let h = 0; h <= 23; h++) {
      if (hourly[h] > 0) {
        resumen.push([
          `${String(h).padStart(2, "0")}:00`,
          hourly[h],
          Math.round((hourly[h] / totalUnidades) * 10000) / 100,
        ]);
      }
    }

    const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
    wsResumen["!cols"] = [
      { wch: 25 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    // ═══════════ SHEET 2: RANKING OPERARIOS ═══════════
    const rankingData: (string | number)[][] = [
      ["RANKING DE OPERARIOS"],
      [],
      ["#", "Operario", "Nombre", "Unidades", "Registros"],
    ];

    const topOps = Object.entries(byOp)
      .sort((a, b) => b[1].total - a[1].total);

    topOps.forEach(([op, data], idx) => {
      rankingData.push([idx + 1, op, data.nombre, data.total, data.entries]);
    });

    rankingData.push([]);
    rankingData.push(["Total operarios", "", "", topOps.length, ""]);

    const wsRanking = XLSX.utils.aoa_to_sheet(rankingData);
    wsRanking["!cols"] = [
      { wch: 5 },
      { wch: 12 },
      { wch: 35 },
      { wch: 14 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsRanking, "Ranking Operarios");

    // ═══════════ SHEET 3: DETALLE POR DÍA ═══════════
    const detalleData: (string | number)[][] = [
      ["DETALLE POR DÍA Y TURNO"],
      [],
      ["Fecha", "Turno", "Circuito", "Función", "Operario", "Nombre", "Total"],
    ];

    const sortedRows = [...rows].sort((a, b) => {
      const fd = Number(a.fecha) - Number(b.fecha);
      if (fd !== 0) return fd;
      const td = String(a.turno).localeCompare(String(b.turno));
      if (td !== 0) return td;
      return (Number(a.total) || 0) - (Number(b.total) || 0);
    });

    for (const r of sortedRows) {
      detalleData.push([
        formatDate(Number(r.fecha)),
        String(r.turno_desc),
        String(r.circuito),
        String(r.funcion_desc),
        String(r.operario),
        String(r.nombre),
        Number(r.total) || 0,
      ]);
    }

    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
    wsDetalle["!cols"] = [
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 20 },
      { wch: 12 },
      { wch: 35 },
      { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle");

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const dateRange = `${formatDate(fechas[0]).replace(/\//g, "-")}_a_${formatDate(fechas[fechas.length - 1]).replace(/\//g, "-")}`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="informe_produccion_h61_${dateRange}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: error.message || "Error al generar el informe" },
      { status: 500 }
    );
  }
}