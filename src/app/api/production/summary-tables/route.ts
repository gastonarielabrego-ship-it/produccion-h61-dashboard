import {
  getAggRecords,
  getPool,
  buildWhere,
  getSourceTable,
  parseFilters,
  getTMByDate,
  getTMByDateOperario,
} from "@/lib/neon";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// ── Helper: compute shift span + start/end hours, handling midnight wrap-around ──
function calcShiftDetails(hoursArr: number[]): { span: number; startHour: number; endHour: number } {
  const n = hoursArr.length;
  if (n === 0) return { span: 0, startHour: 0, endHour: 0 };

  const sorted = hoursArr.slice().sort(function(a, b) { return a - b; });

  // Deduplicate
  const uniq: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1]) uniq.push(sorted[i]);
  }
  const u = uniq.length;
  if (u === 1) return { span: 1, startHour: uniq[0], endHour: uniq[0] };

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
    return { span: uniq[u - 1] - uniq[0] + 1, startHour: uniq[0], endHour: uniq[u - 1] };
  }

  // Wrap-around detected: add 24 to the "low block" hours to unwrap
  let newMin = 999;
  let newMax = -1;
  for (let i = 0; i < u; i++) {
    let h = uniq[i];
    if (h <= uniq[maxGapIdx]) h += 24;
    if (h < newMin) newMin = h;
    if (h > newMax) newMax = h;
  }
  return { span: newMax - newMin + 1, startHour: newMin, endHour: newMax };
}

// Convenience wrapper that returns just the span
function calcHorasBrutas(hoursArr: number[]): number {
  return calcShiftDetails(hoursArr).span;
}

// PERF: SQL GROUP BY (fecha, operario) with majority turno — replaces fetching
// all raw rows (~128K). All heavy aggregation happens inside Postgres.
export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);

    const [rows, turnoRows, tmByDateAll, tmByDateOpAll] = await Promise.all([
      getAggRecords(filters, tableName),
      // Exact per-row turno attribution data (replicates the previous JS majority
      // vote with first-seen tie-break = lowest row id)
      (async () => {
        const pool = getPool();
        const { sql: whereSql2, params: params2 } = buildWhere(filters);
        return pool.query(
          `SELECT fecha, operario, COALESCE(turno, '') AS turno, MAX(turno_desc) AS td, COUNT(*)::int AS n, MIN(id)::int AS min_id
           FROM ${tableName} ${whereSql2} GROUP BY fecha, operario, COALESCE(turno, '')`,
          params2,
        );
      })(),
      getTMByDate({}),
      getTMByDateOperario({}),
    ]);

    // ── Per-day aggregation ──
    // opHours stores all active hours per (date, operario)
    const dayMap: Record<number, { missions: Set<string>; bultos: number; opHours: Record<string, number[]> }> = {};
    const monthMap: Record<number, { missions: Set<string>; bultos: number; days: Set<number> }> = {};

    // Heatmaps: (date, hour) and (operario, hour) bultos sums
    const dayHourMap: Record<string, number> = {};
    const opTotalMap: Record<string, number> = {};
    const opNameMap: Record<string, string> = {};
    const opHourMap: Record<string, number> = {};

    // Turno attribution per (date, operario) — majority turno by row count,
    // ties broken by earliest row (min id), matching the previous JS behavior
    const opDateTurno: Record<string, string> = {};
    const turnoDescMap: Record<string, string> = {};
    const opDateTurnoCount: Record<string, Record<string, { n: number; minId: number }>> = {};
    for (const r of turnoRows.rows as Record<string, unknown>[]) {
      const key = r.fecha + ":" + r.operario;
      const turno = String(r.turno ?? "");
      if (!opDateTurnoCount[key]) opDateTurnoCount[key] = {};
      opDateTurnoCount[key][turno] = { n: Number(r.n) || 0, minId: Number(r.min_id) || 0 };
      if (turno && !turnoDescMap[turno]) turnoDescMap[turno] = String(r.td ?? turno);
    }
    for (const key of Object.keys(opDateTurnoCount)) {
      const counts = opDateTurnoCount[key];
      let bestTurno = "";
      let bestCount = 0;
      let bestMinId = Infinity;
      const cKeys = Object.keys(counts);
      for (let j = 0; j < cKeys.length; j++) {
        const c = counts[cKeys[j]];
        if (c.n > bestCount || (c.n === bestCount && c.minId < bestMinId)) {
          bestCount = c.n;
          bestMinId = c.minId;
          bestTurno = cKeys[j];
        }
      }
      opDateTurno[key] = bestTurno;
    }

    // ── Main aggregation pass over aggregated rows ──
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const op = r.operario;
      const dt = r.fecha;
      const tot = r.total;
      const missionKey = dt + ":" + op;

      // Active hours for this person-day
      const recHours: number[] = [];
      for (let h = 0; h <= 23; h++) {
        if (r.act[h]) recHours.push(h);
      }

      // Day
      if (!dayMap[dt]) dayMap[dt] = { missions: new Set(), bultos: 0, opHours: {} };
      const dd = dayMap[dt];
      dd.missions.add(missionKey);
      dd.bultos += tot;
      if (recHours.length > 0) {
        if (!dd.opHours[op]) {
          dd.opHours[op] = recHours;
        } else {
          const existing = dd.opHours[op];
          for (let j = 0; j < recHours.length; j++) existing.push(recHours[j]);
        }
      }

      // Month
      const mk = Math.floor(dt / 100);
      if (!monthMap[mk]) monthMap[mk] = { missions: new Set(), bultos: 0, days: new Set() };
      const mm = monthMap[mk];
      mm.missions.add(missionKey);
      mm.bultos += tot;
      mm.days.add(dt);

      // Day heatmap (bultos per hour)
      for (let h = 0; h <= 23; h++) {
        if (r.hora[h] > 0) {
          const key = dt + ":" + h;
          dayHourMap[key] = (dayHourMap[key] || 0) + r.hora[h];
        }
      }

      // Collaborator aggregates
      opTotalMap[op] = (opTotalMap[op] || 0) + tot;
      opNameMap[op] = r.nombre;
      for (let h = 0; h <= 23; h++) {
        if (r.hora[h] > 0) {
          const key = op + ":" + h;
          opHourMap[key] = (opHourMap[key] || 0) + r.hora[h];
        }
      }
    }

    const sortedDates = Object.keys(dayMap).map(Number).sort(function(a, b) { return a - b; });
    const sortedMonths = Object.keys(monthMap).map(Number).sort(function(a, b) { return a - b; });

    // ── Daily metrics (with horas extras) ──
    const dailyMetrics: any[] = [];
    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const d = dayMap[date];
      const misiones = d.missions.size;
      const bultos = d.bultos;
      let hb = 0;
      let heDia = 0;
      let opConHEDia = 0;
      const opKeys = Object.keys(d.opHours);
      for (let k = 0; k < opKeys.length; k++) {
        const span = calcHorasBrutas(d.opHours[opKeys[k]]);
        hb += span;
        if (span > 8) {
          heDia += (span - 8);
          opConHEDia++;
        }
      }
      const tmMin = filters.operario ? (tmByDateOpAll[(date + ":" + filters.operario)] || 0) : (tmByDateAll[date] || 0);
      const tmHRaw = Math.round((tmMin / 60) * 100) / 100;
      const prod = misiones > 0 ? Math.round((bultos / misiones) * 10) / 10 : 0;
      const bhB = hb > 0 ? Math.round((bultos / hb) * 10) / 10 : 0;
      // If TM >= 80% of hb, TM data is unreliable — use B/H Bruta as B/H Neta
      let hn: number;
      let bhN: number;
      const tmH = Math.min(tmHRaw, hb);
      if (hb > 0 && tmHRaw >= hb * 0.8) {
        hn = hb;
        bhN = bhB;
      } else {
        hn = Math.round((hb - tmH) * 100) / 100;
        bhN = hn > 0 ? Math.round((bultos / hn) * 10) / 10 : bhB;
      }
      dailyMetrics.push({ date, misiones, bultos, horasProductivas: hb, tmHoras: tmH, horasNetas: hn, produccion: prod, bultosPorHoraBruta: bhB, bultosPorHoraNeta: bhN, horasExtras: Math.round(heDia * 100) / 100, misionesConHE: opConHEDia });
    }

    // ── Monthly summary + Horas Extras ──
    const allTMDateKeys = Object.keys(tmByDateAll);
    const allTMDateOpKeys = Object.keys(tmByDateOpAll);

    const monthlyData: any[] = [];
    for (let i = 0; i < sortedMonths.length; i++) {
      const month = sortedMonths[i];
      const m = monthMap[month];
      const misiones = m.missions.size;
      const bultos = m.bultos;
      const dias = m.days.size;

      // Sum daily horas brutas for this month
      let hb = 0;
      let heAcum = 0;
      let opConHE = 0;
      for (let k = 0; k < sortedDates.length; k++) {
        const dayDate = sortedDates[k];
        const dayMonth = Math.floor(dayDate / 100);
        if (dayMonth === month) {
          const dd = dayMap[dayDate];
          const dk = Object.keys(dd.opHours);
          for (let j = 0; j < dk.length; j++) {
            const span = calcHorasBrutas(dd.opHours[dk[j]]);
            hb += span;
            // Horas extras: si trabajó más de 8, la diferencia es HE
            if (span > 8) {
              heAcum += (span - 8);
              opConHE++;
            }
          }
        }
      }

      // TM
      const yearStr = String(month).slice(0, 4);
      const monthNum = month % 100;
      const lastDay = new Date(Number(yearStr), monthNum, 0).getDate();
      const monthStart = month * 100 + 1;
      const monthEnd = month * 100 + lastDay;

      let tmMin = 0;
      if (filters.operario) {
        for (let k = 0; k < allTMDateOpKeys.length; k++) {
          const parts = allTMDateOpKeys[k].split(":");
          const d = Number(parts[0]);
          const op = parts.slice(1).join(":");
          if (d >= monthStart && d <= monthEnd && op === filters.operario) {
            tmMin += tmByDateOpAll[allTMDateOpKeys[k]];
          }
        }
      } else {
        for (let k = 0; k < allTMDateKeys.length; k++) {
          const d = Number(allTMDateKeys[k]);
          if (d >= monthStart && d <= monthEnd) {
            tmMin += tmByDateAll[allTMDateKeys[k]];
          }
        }
      }
      const tmHRaw = Math.round((tmMin / 60) * 100) / 100;
      const prod = misiones > 0 ? Math.round((bultos / misiones) * 10) / 10 : 0;
      const bhB = hb > 0 ? Math.round((bultos / hb) * 10) / 10 : 0;
      // If TM >= 80% of hb, TM data is unreliable — use B/H Bruta as B/H Neta
      let hn: number;
      let bhN: number;
      const tmH = Math.min(tmHRaw, hb);
      if (hb > 0 && tmHRaw >= hb * 0.8) {
        hn = hb;
        bhN = bhB;
      } else {
        hn = Math.round((hb - tmH) * 100) / 100;
        bhN = hn > 0 ? Math.round((bultos / hn) * 10) / 10 : bhB;
      }

      const prev = i > 0 ? monthlyData[i - 1] : null;
      const prevDays = prev ? prev.dias : 0;
      const canCompare = prev && prevDays >= 7 && dias >= 7;
      const cmpB = canCompare && prev.bultos > 0 ? Math.round(((bultos / dias) / (prev.bultos / prevDays) - 1) * 10000) / 100 : null;
      const cmpBH = canCompare && prev.bhBruta > 0 ? Math.round(((bhB - prev.bhBruta) / prev.bhBruta) * 10000) / 100 : null;
      const cmpM = canCompare && prev.misiones > 0 ? Math.round(((misiones / dias) / (prev.misiones / prevDays) - 1) * 10000) / 100 : null;

      const label = MONTH_NAMES[month % 100] + " " + String(month).slice(0, 4);
      monthlyData.push({
        month, label, dias, misiones, bultos,
        horasBrutas: hb, tmHoras: tmH, horasNetas: hn,
        produccion: prod, bhBruta: bhB, bhNeta: bhN,
        cmpBultos: cmpB, cmpBH: cmpBH, cmpMisiones: cmpM,
        horasExtras: Math.round(heAcum * 100) / 100,
        misionesConHE: opConHE,
        cmpHE: canCompare && prev.horasExtras > 0 ? Math.round((heAcum / dias) / (prev.horasExtras / prevDays) - 1) * 10000 / 100 : null,
      });
    }

    // ── Day heatmap ──
    const dayHeatmap: any[] = [];
    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const row: Record<string, number> = { date: date };
      for (let h = 0; h <= 23; h++) {
        row[String(h)] = dayHourMap[(date + ":" + h)] || 0;
      }
      dayHeatmap.push(row);
    }

    // ── Collaborator heatmap (top 100 by bultos) ──
    const opEntries = Object.entries(opTotalMap).sort(function(a, b) { return b[1] - a[1]; });
    const sortedOps: string[] = [];
    for (let i = 0; i < Math.min(opEntries.length, 100); i++) {
      sortedOps.push(opEntries[i][0]);
    }
    const collaboratorHeatmap: any[] = [];
    for (let i = 0; i < sortedOps.length; i++) {
      const op = sortedOps[i];
      const row: Record<string, any> = { operario: op, nombre: opNameMap[op] };
      for (let h = 0; h <= 23; h++) {
        row[String(h)] = opHourMap[(op + ":" + h)] || 0;
      }
      collaboratorHeatmap.push(row);
    }

    // ── HE by Turno (majority turno per date-operario from SQL) ──
    const heByTurnoMap: Record<string, { he: number; misionesConHE: number; dias: Set<number>; hb: number }> = {};
    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const dd = dayMap[date];
      const dk = Object.keys(dd.opHours);
      for (let j = 0; j < dk.length; j++) {
        const span = calcHorasBrutas(dd.opHours[dk[j]]);
        const he = span > 8 ? (span - 8) : 0;
        const key = date + ":" + dk[j];
        const turno = opDateTurno[key] || "";
        if (!heByTurnoMap[turno]) heByTurnoMap[turno] = { he: 0, misionesConHE: 0, dias: new Set(), hb: 0 };
        heByTurnoMap[turno].hb += span;
        heByTurnoMap[turno].he += he;
        heByTurnoMap[turno].dias.add(date);
        if (he > 0) heByTurnoMap[turno].misionesConHE++;
      }
    }

    const heByTurno: any[] = [];
    const turnoEntries = Object.keys(heByTurnoMap);
    for (let i = 0; i < turnoEntries.length; i++) {
      const t = turnoEntries[i];
      const info = heByTurnoMap[t];
      heByTurno.push({
        turno: t,
        turnoDesc: turnoDescMap[t] || t,
        horasBrutas: info.hb,
        horasExtras: Math.round(info.he * 100) / 100,
        misionesConHE: info.misionesConHE,
        dias: info.dias.size,
      });
    }

    let filteredOperatorName: string | null = null;
    if (filters.operario) {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].operario === filters.operario) {
          filteredOperatorName = rows[i].nombre;
          break;
        }
      }
    }

    return NextResponse.json({
      dailyMetrics,
      monthlyData,
      heByTurno,
      dayHeatmap,
      collaboratorHeatmap,
      filteredOperatorName,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error("Error fetching summary tables:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error fetching summary tables", detail: msg }, { status: 500 , headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
}
