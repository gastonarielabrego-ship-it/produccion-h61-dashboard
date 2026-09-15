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

// ── Month label from YYYYMM integer ──
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function getMonthLabel(ym: number): string {
  const month = ym % 100;
  const year = Math.floor(ym / 100);
  return MONTH_NAMES[month - 1] + " " + String(year).slice(2);
}

// ── Extract YYYYMM from fecha integer (e.g. 20260715 → 202607) ──
function toYYYYMM(fecha: number): number {
  return Math.floor(fecha / 100);
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
    const actividad = url.searchParams.get("actividad");
    const operariosParam = url.searchParams.getAll("operario"); // multiple operarios for comparison

    // Build WHERE clause
    const conditions: string[] = [];
    const params: Record<string, string | number> = {};
    if (dateFrom) { conditions.push("fecha >= $dateFrom"); params.dateFrom = Number(dateFrom); }
    if (dateTo) { conditions.push("fecha <= $dateTo"); params.dateTo = Number(dateTo); }
    if (turno) { conditions.push("turno = $turno"); params.turno = turno; }
    if (actividad) { conditions.push("actividad = $actividad"); params.actividad = Number(actividad); }
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
      const bhBruta = hsBrutas > 0 ? Math.round((bultos / hsBrutas) * 10) / 10 : 0;
      const bhNeta = hsNetas > 0 ? Math.round((bultos / hsNetas) * 10) / 10 : 0;
      daily.push({
        operario: entry.operario,
        nombre: entry.nombre,
        fecha: fecha,
        ym: toYYYYMM(fecha),
        bultos: bultos,
        hs_brutas: hsBrutas,
        tm_hs: tmHs,
        hs_netas: hsNetas,
        bh_bruta: bhBruta,
        bh_neta: bhNeta,
      });
    }

    // ── 5. Aggregate per (month, person) for monthly comparison ──
    const monthlyMap: Record<string, { operario: string; nombre: string; ym: number; total_bultos: number; total_hs_brutas: number; total_hs_netas: number; total_tm: number; dias: number }> = {};
    for (let i = 0; i < daily.length; i++) {
      const d = daily[i];
      const mKey = d.ym + ":" + d.operario;
      if (!monthlyMap[mKey]) {
        monthlyMap[mKey] = { operario: d.operario, nombre: d.nombre, ym: d.ym, total_bultos: 0, total_hs_brutas: 0, total_hs_netas: 0, total_tm: 0, dias: 0 };
      }
      const m = monthlyMap[mKey];
      m.total_bultos += d.bultos;
      m.total_hs_brutas += d.hs_brutas;
      m.total_hs_netas += d.hs_netas;
      m.total_tm += d.tm_hs;
      m.dias += 1;
    }

    // Build monthly rows
    const monthly: any[] = [];
    const mKeys = Object.keys(monthlyMap);
    for (let i = 0; i < mKeys.length; i++) {
      const m = monthlyMap[mKeys[i]];
      const bhBruta = m.total_hs_brutas > 0 ? Math.round((m.total_bultos / m.total_hs_brutas) * 10) / 10 : 0;
      const bhNeta = m.total_hs_netas > 0 ? Math.round((m.total_bultos / m.total_hs_netas) * 10) / 10 : 0;
      const produccion = m.dias > 0 ? Math.round((m.total_bultos / m.dias) * 10) / 10 : 0;
      monthly.push({
        operario: m.operario,
        nombre: m.nombre,
        ym: m.ym,
        monthLabel: getMonthLabel(m.ym),
        total_bultos: m.total_bultos,
        total_hs_brutas: Math.round(m.total_hs_brutas * 100) / 100,
        total_hs_netas: Math.round(m.total_hs_netas * 100) / 100,
        total_tm: Math.round(m.total_tm * 100) / 100,
        bh_bruta: bhBruta,
        bh_neta: bhNeta,
        produccion: produccion,
        dias: m.dias,
      });
    }

    // ── 6. Summary per person (overall) ──
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
        meses: 0, // will be filled below
      });
    }
    // Sort by B/H Neta descending
    ranking.sort(function(a, b) { return b.bh_neta - a.bh_neta; });

    // Count months per person
    const personMonthSet: Record<string, Set<number>> = {};
    for (let i = 0; i < monthly.length; i++) {
      const m = monthly[i];
      if (!personMonthSet[m.nombre]) personMonthSet[m.nombre] = new Set<number>();
      personMonthSet[m.nombre].add(m.ym);
    }
    for (let i = 0; i < ranking.length; i++) {
      ranking[i].meses = personMonthSet[ranking[i].nombre] ? personMonthSet[ranking[i].nombre].size : 0;
    }

    // ── 7. Classify: top 10, average range, below 10 ──
    let totalBhNeta = 0;
    for (let i = 0; i < ranking.length; i++) {
      totalBhNeta += ranking[i].bh_neta;
    }
    const globalAvg = ranking.length > 0 ? Math.round((totalBhNeta / ranking.length) * 10) / 10 : 0;

    let sumSqDiff = 0;
    for (let i = 0; i < ranking.length; i++) {
      const diff = ranking[i].bh_neta - globalAvg;
      sumSqDiff += diff * diff;
    }
    const stdDev = ranking.length > 1 ? Math.round(Math.sqrt(sumSqDiff / ranking.length) * 10) / 10 : 0;

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

    // ── 8. Monthly comparison data (all persons, all months) ──
    // For the comparative chart: one entry per person with monthly columns
    const allMonthsSet = new Set<number>();
    for (let i = 0; i < monthly.length; i++) {
      allMonthsSet.add(monthly[i].ym);
    }
    const allMonths = Array.from(allMonthsSet).sort(function(a, b) { return a - b; });
    const monthLabels = allMonths.map(function(ym) { return getMonthLabel(ym); });

    // Monthly per-person for chart: { nombre, operario, "Ene 26": bh_neta, "Feb 26": bh_neta, ... }
    const monthlyByPerson: Record<string, any> = {};
    for (let i = 0; i < monthly.length; i++) {
      const m = monthly[i];
      const k = m.nombre;
      if (!monthlyByPerson[k]) {
        monthlyByPerson[k] = { nombre: m.nombre, operario: m.operario, fullName: m.nombre, category: "" };
      }
      monthlyByPerson[k][m.monthLabel] = m.bh_neta;
    }
    // Assign category from ranking
    for (let i = 0; i < ranking.length; i++) {
      const r = ranking[i];
      if (monthlyByPerson[r.nombre]) {
        monthlyByPerson[r.nombre].category = r.category;
      }
    }
    const monthlyChartData = Object.values(monthlyByPerson);

    // ── 9. Evolution data for selected collaborators (by month) ──
    // Returns one series per operario, merged by month for the comparison chart
    let evolutionSeries: any[] = [];
    if (operariosParam.length > 0) {
      // Get monthly data for all selected operarios
      const selectedMonthly = monthly.filter(function(m) {
        return operariosParam.indexOf(m.operario) >= 0;
      });
      // Group by operario
      const byOperario: Record<string, any[]> = {};
      for (let i = 0; i < selectedMonthly.length; i++) {
        const m = selectedMonthly[i];
        if (!byOperario[m.operario]) byOperario[m.operario] = [];
        byOperario[m.operario].push(m);
      }
      // Build series
      const oKeys = Object.keys(byOperario);
      for (let i = 0; i < oKeys.length; i++) {
        const operario = oKeys[i];
        const rows = byOperario[operario];
        rows.sort(function(a, b) { return a.ym - b.ym; });
        evolutionSeries.push({
          operario: operario,
          nombre: rows[0].nombre,
          category: "",
          data: rows.map(function(m) {
            return {
              ym: m.ym,
              monthLabel: m.monthLabel,
              total_bultos: m.total_bultos,
              bh_bruta: m.bh_bruta,
              bh_neta: m.bh_neta,
              produccion: m.produccion,
              dias: m.dias,
            };
          }),
        });
      }
      // Assign category
      for (let i = 0; i < evolutionSeries.length; i++) {
        const es = evolutionSeries[i];
        const r = ranking.find(function(rr: any) { return rr.operario === es.operario; });
        if (r) es.category = r.category;
      }
    }

    // ── 9b. Distribution histogram ──
    // Bucket B/H Neta values into ranges
    const distribution: any[] = [];
    if (ranking.length > 0) {
      const minVal = ranking[ranking.length - 1].bh_neta;
      const maxVal = ranking[0].bh_neta;
      const range = maxVal - minVal;
      const bucketCount = Math.min(12, Math.max(5, Math.ceil(range / 10)));
      const bucketSize = range > 0 ? Math.ceil(range / bucketCount) : 10;
      const baseVal = Math.floor(minVal / bucketSize) * bucketSize;
      for (let b = 0; b < bucketCount; b++) {
        const lo = baseVal + b * bucketSize;
        const hi = lo + bucketSize;
        const count = ranking.filter(function(r: any) { return r.bh_neta >= lo && r.bh_neta < hi; }).length;
        const topCount = ranking.filter(function(r: any) { return r.bh_neta >= lo && r.bh_neta < hi && r.category === "top"; }).length;
        const avgCount2 = ranking.filter(function(r: any) { return r.bh_neta >= lo && r.bh_neta < hi && r.category === "average"; }).length;
        const belowCount2 = ranking.filter(function(r: any) { return r.bh_neta >= lo && r.bh_neta < hi && r.category === "below"; }).length;
        distribution.push({
          range: lo + "-" + hi,
          lo: lo,
          hi: hi,
          count: count,
          top: topCount,
          average: avgCount2,
          below: belowCount2,
        });
      }
    }

    // ── 10. Available months ──
    const dates = allMonths;

    // ── 11. Monthly averages per month (for reference lines in evolution) ──
    const monthlyAvg: any[] = [];
    for (let i = 0; i < allMonths.length; i++) {
      const ym = allMonths[i];
      const monthData = monthly.filter(function(m) { return m.ym === ym; });
      let sumBhNeta = 0;
      for (let j = 0; j < monthData.length; j++) {
        sumBhNeta += monthData[j].bh_neta;
      }
      monthlyAvg.push({
        ym: ym,
        monthLabel: getMonthLabel(ym),
        avgBhNeta: monthData.length > 0 ? Math.round((sumBhNeta / monthData.length) * 10) / 10 : 0,
        personas: monthData.length,
      });
    }

    // ── 12. Monthly category counts (how many people in each category per month) ──
    const monthlyCategoryCounts: any[] = [];
    for (let i = 0; i < allMonths.length; i++) {
      const ym = allMonths[i];
      const monthData = monthly.filter(function(m) { return m.ym === ym; });
      // For each person in this month, determine their category based on their monthly B/H Neta
      let topCnt = 0;
      let avgCnt = 0;
      let belowCnt = 0;
      for (let j = 0; j < monthData.length; j++) {
        const bh = monthData[j].bh_neta;
        if (bh >= avgHigh) {
          topCnt++;
        } else if (bh >= avgLow) {
          avgCnt++;
        } else {
          belowCnt++;
        }
      }
      monthlyCategoryCounts.push({
        ym: ym,
        monthLabel: getMonthLabel(ym),
        top: topCnt,
        average: avgCnt,
        below: belowCnt,
        total: topCnt + avgCnt + belowCnt,
      });
    }

    // ── 13. Per-person monthly evolution data for ranking accordion ──
    const personMonthlyMap: Record<string, any[]> = {};
    for (let i = 0; i < monthly.length; i++) {
      const m = monthly[i];
      if (!personMonthlyMap[m.operario]) personMonthlyMap[m.operario] = [];
      personMonthlyMap[m.operario].push({
        ym: m.ym,
        monthLabel: m.monthLabel,
        total_bultos: m.total_bultos,
        bh_bruta: m.bh_bruta,
        bh_neta: m.bh_neta,
        produccion: m.produccion,
        dias: m.dias,
      });
    }
    // Sort each person's monthly data chronologically
    const pKeys = Object.keys(personMonthlyMap);
    for (let i = 0; i < pKeys.length; i++) {
      personMonthlyMap[pKeys[i]].sort(function(a, b) { return a.ym - b.ym; });
    }

    return NextResponse.json({
      ranking: ranking,
      top10: top10,
      average10: average10,
      below10: below10,
      globalAvg: globalAvg,
      stdDev: stdDev,
      avgLow: Math.round(avgLow * 10) / 10,
      avgHigh: Math.round(avgHigh * 10) / 10,
      evolutionSeries: evolutionSeries,
      distribution: distribution,
      monthlyAvg: monthlyAvg,
      monthlyCategoryCounts: monthlyCategoryCounts,
      personMonthly: personMonthlyMap,
      monthLabels: monthLabels,
      totalPeople: ranking.length,
      dates: dates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
