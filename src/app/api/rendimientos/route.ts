import { getClient, ensureNominaOverrideTable } from "@/lib/turso";
import { NextResponse } from "next/server";

// ── Shift span calculation (same logic as summary-tables) ──
function calcHorasBrutas(hoursArr: number[]): number {
  const n = hoursArr.length;
  if (n === 0) return 0;

  const sorted = hoursArr.slice().sort(function(a, b) { return a - b; });

  // Deduplicate
  const uniq: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1]) uniq.push(sorted[i]);
  }
  const u = uniq.length;
  if (u === 1) return 1;

  // Find the largest gap between consecutive hours
  let maxGap = uniq[1] - uniq[0];
  let maxGapIdx = 0;
  for (let i = 1; i < u - 1; i++) {
    const gap = uniq[i + 1] - uniq[i];
    if (gap > maxGap) {
      maxGap = gap;
      maxGapIdx = i;
    }
  }

  // Wrap gap: from last hour through midnight to first hour
  const wrapGap = (24 - uniq[u - 1]) + uniq[0];

  if (wrapGap >= maxGap) {
    // No wrap-around: standard span from min to max
    return uniq[u - 1] - uniq[0] + 1;
  }

  // Wrap-around detected
  let newMin = 999;
  let newMax = -1;
  for (let i = 0; i < u; i++) {
    let h = uniq[i];
    if (h <= uniq[maxGapIdx]) h += 24;
    if (h < newMin) newMin = h;
    if (h > newMax) newMax = h;
  }
  return newMax - newMin + 1;
}

// ── Day of week in Spanish ──
function getDiaLabel(fecha: number): string {
  const day = fecha % 100;
  const month = Math.floor(fecha / 100) % 100;
  const year = Math.floor(fecha / 10000);
  const days = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
  const d = new Date(year, month - 1, day);
  const dayName = days[d.getDay()];
  return String(day).padStart(2, "0") + "/" + String(month).padStart(2, "0") + " (" + dayName + ")";
}

export async function GET(request: Request) {
  try {
    await ensureNominaOverrideTable();
    const client = getClient();
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const tipo = url.searchParams.get("tipo");
    const turno = url.searchParams.get("turno");

    // Build WHERE clause
    const conditions: string[] = [];
    const params: Record<string, string | number> = {};
    if (dateFrom) { conditions.push("fecha >= $dateFrom"); params.dateFrom = Number(dateFrom); }
    if (dateTo) { conditions.push("fecha <= $dateTo"); params.dateTo = Number(dateTo); }
    if (turno) { conditions.push("turno = $turno"); params.turno = turno; }
    if (tipo === "EFECTIVO") {
      conditions.push("(CAST(SUBSTR(operario, 2) AS INTEGER) < 10247 OR operario IN (SELECT operario FROM nomina_override))");
    } else if (tipo === "EVENTUAL") {
      conditions.push("(CAST(SUBSTR(operario, 2) AS INTEGER) >= 10247 AND operario NOT IN (SELECT operario FROM nomina_override))");
    }
    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    // ── 1. Fetch all production records in date range ──
    const result = await client.execute({
      sql: `SELECT fecha, operario, nombre, total, hora_00, hora_01, hora_02, hora_03, hora_04, hora_05, hora_06, hora_07, hora_08, hora_09, hora_10, hora_11, hora_12, hora_13, hora_14, hora_15, hora_16, hora_17, hora_18, hora_19, hora_20, hora_21, hora_22, hora_23
        FROM production_records ${where} ORDER BY fecha, nombre`,
      args: params,
    });

    // ── 2. Fetch tiempos muertos per (date, operario) ──
    const tmFilters: Record<string, string | number> = {};
    const tmConditions: string[] = [];
    if (dateFrom) { tmConditions.push("fecha >= $dateFrom"); tmFilters.dateFrom = Number(dateFrom); }
    if (dateTo) { tmConditions.push("fecha <= $dateTo"); tmFilters.dateTo = Number(dateTo); }
    const tmWhere = tmConditions.length > 0 ? "WHERE " + tmConditions.join(" AND ") : "";
    const tmResult = await client.execute({
      sql: `SELECT fecha, operario, SUM(minutos) as total_minutos FROM tiempos_muertos ${tmWhere} GROUP BY fecha, operario`,
      args: tmFilters,
    });
    const tmMap: Record<string, number> = {};
    for (let i = 0; i < tmResult.rows.length; i++) {
      const row = tmResult.rows[i];
      tmMap[row.fecha + ":" + row.operario] = Number(row.total_minutos) || 0;
    }

    // ── 3. Aggregate per (fecha, operario, nombre) ──
    // Key: "fecha:operario" → { nombre, bultos, activeHours[] }
    const personDateMap: Record<string, { nombre: string; bultos: number; activeHours: number[] }> = {};

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      const fecha = Number(row.fecha);
      const operario = String(row.operario || "");
      const nombre = String(row.nombre || "");
      const total = Number(row.total) || 0;
      if (fecha <= 0 || !operario) continue;

      const key = fecha + ":" + operario;
      if (!personDateMap[key]) {
        personDateMap[key] = { nombre: nombre, bultos: 0, activeHours: [] };
      }
      const entry = personDateMap[key];
      entry.bultos += total;

      // Collect hours with qty > 0
      for (let h = 0; h <= 23; h++) {
        const col = "hora_" + String(h).padStart(2, "0");
        if (Number(row[col]) > 0) {
          entry.activeHours.push(h);
        }
      }
    }

    // ── 4. Build daily rows ──
    const daily: any[] = [];
    const keys = Object.keys(personDateMap);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const entry = personDateMap[key];
      const colonIdx = key.indexOf(":");
      const fecha = Number(key.substring(0, colonIdx));
      const operario = key.substring(colonIdx + 1);

      const bultos = entry.bultos;
      const hsBrutas = calcHorasBrutas(entry.activeHours);
      const tmMin = tmMap[key] || 0;
      const tmHs = Math.round((tmMin / 60) * 100) / 100;
      const hsNetas = Math.round((hsBrutas - tmHs) * 100) / 100;
      const produccion = hsNetas > 0 ? Math.round((bultos / hsNetas) * 10) / 10 : 0;
      const bhBruta = hsBrutas > 0 ? Math.round((bultos / hsBrutas) * 10) / 10 : 0;
      const bhNeta = hsNetas > 0 ? Math.round((bultos / hsNetas) * 10) / 10 : 0;

      daily.push({
        nombre: entry.nombre,
        dia: getDiaLabel(fecha),
        fecha: fecha,
        bultos: bultos,
        hs_brutas: hsBrutas,
        tm_hs: tmHs,
        hs_netas: hsNetas,
        produccion: produccion,
        bh_bruta: bhBruta,
        bh_neta: bhNeta,
      });
    }

    // Sort by nombre, then fecha
    daily.sort(function(a, b) {
      if (a.nombre < b.nombre) return -1;
      if (a.nombre > b.nombre) return 1;
      return a.fecha - b.fecha;
    });

    // ── 5. Summary per person ──
    const summaryMap: Record<string, { nombre: string; total_bultos: number; total_hs_brutas: number; total_tm: number; total_hs_netas: number; dias: number }> = {};
    for (let i = 0; i < daily.length; i++) {
      const d = daily[i];
      const n = d.nombre;
      if (!summaryMap[n]) {
        summaryMap[n] = { nombre: n, total_bultos: 0, total_hs_brutas: 0, total_tm: 0, total_hs_netas: 0, dias: 0 };
      }
      const s = summaryMap[n];
      s.total_bultos += d.bultos;
      s.total_hs_brutas += d.hs_brutas;
      s.total_tm += d.tm_hs;
      s.total_hs_netas += d.hs_netas;
      s.dias += 1;
    }

    const summary: any[] = [];
    const sKeys = Object.keys(summaryMap).sort();
    for (let i = 0; i < sKeys.length; i++) {
      const s = summaryMap[sKeys[i]];
      const avgBhBruta = s.total_hs_brutas > 0 ? Math.round((s.total_bultos / s.total_hs_brutas) * 10) / 10 : 0;
      const avgBhNeta = s.total_hs_netas > 0 ? Math.round((s.total_bultos / s.total_hs_netas) * 10) / 10 : 0;
      summary.push({
        nombre: s.nombre,
        total_bultos: s.total_bultos,
        total_hs_brutas: Math.round(s.total_hs_brutas * 100) / 100,
        total_tm: Math.round(s.total_tm * 100) / 100,
        total_hs_netas: Math.round(s.total_hs_netas * 100) / 100,
        avg_bh_bruta: avgBhBruta,
        avg_bh_neta: avgBhNeta,
        dias: s.dias,
      });
    }

    // ── 6. Grand totals ──
    let totalBultos = 0;
    let totalHsBrutas = 0;
    let totalTm = 0;
    let totalHsNetas = 0;
    const personSet = new Set<string>();
    const dateSet = new Set<number>();
    for (let i = 0; i < daily.length; i++) {
      const d = daily[i];
      totalBultos += d.bultos;
      totalHsBrutas += d.hs_brutas;
      totalTm += d.tm_hs;
      totalHsNetas += d.hs_netas;
      personSet.add(d.nombre);
      dateSet.add(d.fecha);
    }

    totalHsBrutas = Math.round(totalHsBrutas * 100) / 100;
    totalTm = Math.round(totalTm * 100) / 100;
    totalHsNetas = Math.round(totalHsNetas * 100) / 100;

    // ── 7. Available dates ──
    const dates: any[] = [];
    const sortedDates = Array.from(dateSet).sort(function(a, b) { return a - b; });
    for (let i = 0; i < sortedDates.length; i++) {
      const f = sortedDates[i];
      dates.push({ fecha: f, dia: getDiaLabel(f) });
    }

    return NextResponse.json({
      daily: daily,
      summary: summary,
      dates: dates,
      totals: {
        totalBultos: totalBultos,
        totalHsBrutas: totalHsBrutas,
        totalTm: totalTm,
        totalHsNetas: totalHsNetas,
        bhBruta: totalHsBrutas > 0 ? Math.round((totalBultos / totalHsBrutas) * 10) / 10 : 0,
        bhNeta: totalHsNetas > 0 ? Math.round((totalBultos / totalHsNetas) * 10) / 10 : 0,
        personal: personSet.size,
        dias: dateSet.size,
        registros: daily.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
