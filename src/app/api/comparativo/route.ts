import { getClient, ensureNominaOverrideTable } from "@/lib/turso";
import { NextResponse } from "next/server";

// ── Shift span calculation (same as rendimientos) ──
function calcHorasBrutas(hoursArr: number[]): number {
  const n = hoursArr.length;
  if (n === 0) return 0;
  const sorted = hoursArr.slice().sort(function(a, b) { return a - b; });
  const uniq: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1]) uniq.push(sorted[i]);
  }
  const u = uniq.length;
  if (u === 1) return 1;
  let maxGap = uniq[1] - uniq[0];
  let maxGapIdx = 0;
  for (let i = 1; i < u - 1; i++) {
    const gap = uniq[i + 1] - uniq[i];
    if (gap > maxGap) { maxGap = gap; maxGapIdx = i; }
  }
  const wrapGap = (24 - uniq[u - 1]) + uniq[0];
  if (wrapGap >= maxGap) return uniq[u - 1] - uniq[0] + 1;
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

export async function GET(request: Request) {
  try {
    await ensureNominaOverrideTable();
    const client = getClient();
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const tipo = url.searchParams.get("tipo");
    const turno = url.searchParams.get("turno");
    const operarioParam = url.searchParams.get("operario"); // for evolution chart

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

    // ── 1. Fetch production records ──
    const result = await client.execute({
      sql: `SELECT fecha, operario, nombre, total, hora_00, hora_01, hora_02, hora_03, hora_04, hora_05, hora_06, hora_07, hora_08, hora_09, hora_10, hora_11, hora_12, hora_13, hora_14, hora_15, hora_16, hora_17, hora_18, hora_19, hora_20, hora_21, hora_22, hora_23
        FROM production_records ${where} ORDER BY fecha, nombre`,
      args: params,
    });

    // ── 2. Fetch tiempos muertos ──
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

    // ── 3. Aggregate per (fecha, operario) ──
    const personDateMap: Record<string, { operario: string; nombre: string; bultos: number; activeHours: number[] }> = {};
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      const fecha = Number(row.fecha);
      const operario = String(row.operario || "");
      const nombre = String(row.nombre || "");
      const total = Number(row.total) || 0;
      if (fecha <= 0 || !operario) continue;
      const key = fecha + ":" + operario;
      if (!personDateMap[key]) {
        personDateMap[key] = { operario: operario, nombre: nombre, bultos: 0, activeHours: [] };
      }
      const entry = personDateMap[key];
      entry.bultos += total;
      for (let h = 0; h <= 23; h++) {
        const col = "hora_" + String(h).padStart(2, "0");
        if (Number(row[col]) > 0) entry.activeHours.push(h);
      }
    }

    // ── 4. Build daily rows (same as rendimientos) ──
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
      const bhBruta = hsBrutas > 0 ? Math.round((bultos / hsBrutas) * 10) / 10 : 0;
      const bhNeta = hsNetas > 0 ? Math.round((bultos / hsNetas) * 10) / 10 : 0;
      daily.push({
        operario: entry.operario,
        nombre: entry.nombre,
        fecha: fecha,
        bultos: bultos,
        hs_brutas: hsBrutas,
        tm_hs: tmHs,
        hs_netas: hsNetas,
        bh_bruta: bhBruta,
        bh_neta: bhNeta,
      });
    }

    // ── 5. Summary per person ──
    const summaryMap: Record<string, { operario: string; nombre: string; total_bultos: number; total_hs_brutas: number; total_tm: number; total_hs_netas: number; dias: number }> = {};
    for (let i = 0; i < daily.length; i++) {
      const d = daily[i];
      const n = d.nombre;
      const operarioKey = d.operario || "";
      if (!summaryMap[n]) {
        summaryMap[n] = { operario: operarioKey, nombre: n, total_bultos: 0, total_hs_brutas: 0, total_tm: 0, total_hs_netas: 0, dias: 0 };
      }
      const s = summaryMap[n];
      s.total_bultos += d.bultos;
      s.total_hs_brutas += d.hs_brutas;
      s.total_tm += d.tm_hs;
      s.total_hs_netas += d.hs_netas;
      s.dias += 1;
    }

    // Build ranking array sorted by B/H Neta (descending)
    const ranking: any[] = [];
    const sKeys = Object.keys(summaryMap).sort();
    for (let i = 0; i < sKeys.length; i++) {
      const s = summaryMap[sKeys[i]];
      const bhBruta = s.total_hs_brutas > 0 ? Math.round((s.total_bultos / s.total_hs_brutas) * 10) / 10 : 0;
      const bhNeta = s.total_hs_netas > 0 ? Math.round((s.total_bultos / s.total_hs_netas) * 10) / 10 : 0;
      const produccion = s.dias > 0 ? Math.round((s.total_bultos / s.dias) * 10) / 10 : 0;
      ranking.push({
        operario: s.operario,
        nombre: s.nombre,
        total_bultos: s.total_bultos,
        total_hs_brutas: Math.round(s.total_hs_brutas * 100) / 100,
        total_hs_netas: Math.round(s.total_hs_netas * 100) / 100,
        total_tm: Math.round(s.total_tm * 100) / 100,
        bh_bruta: bhBruta,
        bh_neta: bhNeta,
        produccion: produccion,
        dias: s.dias,
      });
    }
    // Sort by B/H Neta descending
    ranking.sort(function(a, b) { return b.bh_neta - a.bh_neta; });

    // ── 6. Classify: top 10, average range, below 10 ──
    // Calculate global average B/H Neta
    let totalBhNeta = 0;
    for (let i = 0; i < ranking.length; i++) {
      totalBhNeta += ranking[i].bh_neta;
    }
    const globalAvg = ranking.length > 0 ? Math.round((totalBhNeta / ranking.length) * 10) / 10 : 0;

    // Calculate standard deviation
    let sumSqDiff = 0;
    for (let i = 0; i < ranking.length; i++) {
      const diff = ranking[i].bh_neta - globalAvg;
      sumSqDiff += diff * diff;
    }
    const stdDev = ranking.length > 1 ? Math.round(Math.sqrt(sumSqDiff / ranking.length) * 10) / 10 : 0;

    // Classify each person
    const avgLow = globalAvg - stdDev * 0.5;
    const avgHigh = globalAvg + stdDev * 0.5;

    const top10: any[] = [];
    const average10: any[] = [];
    const below10: any[] = [];

    for (let i = 0; i < ranking.length; i++) {
      const r = ranking[i];
      if (r.bh_neta >= avgHigh) {
        r.category = "top";
        if (top10.length < 10) top10.push(r);
      } else if (r.bh_neta >= avgLow) {
        r.category = "average";
        if (average10.length < 10) average10.push(r);
      } else {
        r.category = "below";
        if (below10.length < 10) below10.push(r);
      }
    }

    // ── 7. Evolution data for a specific collaborator ──
    let evolution: any[] = [];
    if (operarioParam) {
      // Get daily data for this operario, sorted by fecha
      const personDaily = daily.filter(function(d) { return d.operario === operarioParam; });
      personDaily.sort(function(a, b) { return a.fecha - b.fecha; });
      evolution = personDaily.map(function(d) {
        const day = d.fecha % 100;
        const month = Math.floor(d.fecha / 100) % 100;
        return {
          fecha: d.fecha,
          fechaLabel: String(day).padStart(2, "0") + "/" + String(month).padStart(2, "0"),
          bultos: d.bultos,
          bh_bruta: d.bh_bruta,
          bh_neta: d.bh_neta,
          hs_brutas: d.hs_brutas,
          hs_netas: d.hs_netas,
        };
      });
    }

    // ── 8. Available dates ──
    const dateSet = new Set<number>();
    for (let i = 0; i < daily.length; i++) {
      dateSet.add(daily[i].fecha);
    }
    const dates = Array.from(dateSet).sort(function(a, b) { return a - b; });

    return NextResponse.json({
      ranking: ranking,
      top10: top10,
      average10: average10,
      below10: below10,
      globalAvg: globalAvg,
      stdDev: stdDev,
      avgLow: Math.round(avgLow * 10) / 10,
      avgHigh: Math.round(avgHigh * 10) / 10,
      evolution: evolution,
      totalPeople: ranking.length,
      dates: dates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
