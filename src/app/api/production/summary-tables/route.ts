import {
  getAllRecords,
  getSourceTable,
  parseFilters,
  getTMByDate,
  getTMByDateOperario,
} from "@/lib/turso";
import { NextResponse } from "next/server";

const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// ── Helper: compute shift span + start/end hours, handling midnight wrap-around ──
// Example: hours [23, 0, 1, 2, 3, 4, 5, 6] → span=8, start=23, end=6
// Example: hours [8, 9, 10, 11, 12, 13, 14, 15, 16] → span=9, start=8, end=16
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

// ── Franjas horarias definition ──
const FRANJAS = [
  { id: "06-10", label: "06:00 - 10:00", minH: 6, maxH: 10 },
  { id: "10-14", label: "10:00 - 14:00", minH: 10, maxH: 14 },
  { id: "18-22", label: "18:00 - 22:00", minH: 18, maxH: 22 },
];

function getFranjaForHour(h: number): string | null {
  const wh = ((h % 24) + 24) % 24; // wrap to 0-23
  for (let i = 0; i < FRANJAS.length; i++) {
    if (wh >= FRANJAS[i].minH && wh < FRANJAS[i].maxH) return FRANJAS[i].id;
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const tableName = getSourceTable(request);

    const [records, tmByDateAll, tmByDateOpAll] = await Promise.all([
      getAllRecords(filters, tableName),
      getTMByDate({}),
      getTMByDateOperario({}),
    ]);

    // ── Per-day aggregation ──
    // opHours stores all hours with qty > 0 per (date, operario)
    const dayMap: Record<number, { missions: Set<string>; bultos: number; opHours: Record<string, number[]> }> = {};
    const monthMap: Record<number, { missions: Set<string>; bultos: number; days: Set<number> }> = {};

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const op = r.operario;
      const dt = r.date;
      const tot = r.total;
      const missionKey = dt + ":" + op;
      const hourly = r.hourlyData;

      // Collect hours with qty > 0
      const recHours: number[] = [];
      for (let j = 0; j < hourly.length; j++) {
        if (hourly[j].quantity > 0) recHours.push(hourly[j].hour);
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
    }

    const sortedDates = Object.keys(dayMap).map(Number).sort(function(a, b) { return a - b; });
    const sortedMonths = Object.keys(monthMap).map(Number).sort(function(a, b) { return a - b; });

    // ── Daily metrics (with horas extras) ──
    const dailyMetrics = [];
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
      const tmH = Math.round((tmMin / 60) * 100) / 100;
      const hn = Math.round((hb - tmH) * 100) / 100;
      const prod = misiones > 0 ? Math.round((bultos / misiones) * 10) / 10 : 0;
      const bhB = hb > 0 ? Math.round((bultos / hb) * 10) / 10 : 0;
      const bhN = hn > 0 ? Math.round((bultos / hn) * 10) / 10 : 0;
      dailyMetrics.push({ date, misiones, bultos, horasProductivas: hb, tmHoras: tmH, horasNetas: hn, produccion: prod, bultosPorHoraBruta: bhB, bultosPorHoraNeta: bhN, horasExtras: Math.round(heDia * 100) / 100, misionesConHE: opConHEDia });
    }

    // ── Monthly summary + Horas Extras ──
    const allTMDateKeys = Object.keys(tmByDateAll);
    const allTMDateOpKeys = Object.keys(tmByDateOpAll);

    const monthlyData = [];
    for (let i = 0; i < sortedMonths.length; i++) {
      const month = sortedMonths[i];
      const m = monthMap[month];
      const misiones = m.missions.size;
      const bultos = m.bultos;
      const dias = m.days.size;

      // Sum daily horas brutas for this month
      let hb = 0;
      let heAcum = 0; // horas extras acumuladas
      let opConHE = 0; // operarios con horas extras (conteo de misiones-diarias con HE)
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
      const tmH = Math.round((tmMin / 60) * 100) / 100;
      const hn = Math.round((hb - tmH) * 100) / 100;
      const prod = misiones > 0 ? Math.round((bultos / misiones) * 10) / 10 : 0;
      const bhB = hb > 0 ? Math.round((bultos / hb) * 10) / 10 : 0;
      const bhN = hn > 0 ? Math.round((bultos / hn) * 10) / 10 : 0;

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
    const dayHourMap: Record<string, number> = {};
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const hourly = r.hourlyData;
      for (let j = 0; j < hourly.length; j++) {
        if (hourly[j].quantity > 0) {
          const key = r.date + ":" + hourly[j].hour;
          dayHourMap[key] = (dayHourMap[key] || 0) + hourly[j].quantity;
        }
      }
    }
    const dayHeatmap = [];
    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const row: Record<string, number> = { date: date };
      for (let h = 0; h <= 23; h++) {
        row[String(h)] = dayHourMap[(date + ":" + h)] || 0;
      }
      dayHeatmap.push(row);
    }

    // ── Collaborator heatmap ──
    const opTotalMap: Record<string, number> = {};
    const opNameMap: Record<string, string> = {};
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      opTotalMap[r.operario] = (opTotalMap[r.operario] || 0) + r.total;
      opNameMap[r.operario] = r.nombre;
    }
    const opEntries = Object.entries(opTotalMap).sort(function(a, b) { return b[1] - a[1]; });
    const sortedOps: string[] = [];
    for (let i = 0; i < Math.min(opEntries.length, 100); i++) {
      sortedOps.push(opEntries[i][0]);
    }
    const opHourMap: Record<string, number> = {};
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const hourly = r.hourlyData;
      for (let j = 0; j < hourly.length; j++) {
        if (hourly[j].quantity > 0) {
          const key = r.operario + ":" + hourly[j].hour;
          opHourMap[key] = (opHourMap[key] || 0) + hourly[j].quantity;
        }
      }
    }
    const collaboratorHeatmap = [];
    for (let i = 0; i < sortedOps.length; i++) {
      const op = sortedOps[i];
      const row: Record<string, any> = { operario: op, nombre: opNameMap[op] };
      for (let h = 0; h <= 23; h++) {
        row[String(h)] = opHourMap[(op + ":" + h)] || 0;
      }
      collaboratorHeatmap.push(row);
    }

    // ── HE by Franja Horaria ──
    // Assign ALL extra hours to the franja based on shift START hour.
    // This way every HE is attributed and totals match exactly.
    const heFranjaMap: Record<string, { he: number; misionesConHE: number; dias: Set<number> }> = {};
    for (let i = 0; i < FRANJAS.length; i++) {
      heFranjaMap[FRANJAS[i].id] = { he: 0, misionesConHE: 0, dias: new Set() };
    }
    heFranjaMap["otros"] = { he: 0, misionesConHE: 0, dias: new Set() };

    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const dd = dayMap[date];
      const dk = Object.keys(dd.opHours);
      for (let j = 0; j < dk.length; j++) {
        const details = calcShiftDetails(dd.opHours[dk[j]]);
        if (details.span > 8) {
          const he = details.span - 8;
          // Determine franja from shift start hour (wrapped to 0-23)
          const startWrapped = ((details.startHour % 24) + 24) % 24;
          const franjaId = getFranjaForHour(startWrapped) || "otros";
          if (!heFranjaMap[franjaId]) heFranjaMap[franjaId] = { he: 0, misionesConHE: 0, dias: new Set() };
          heFranjaMap[franjaId].he += he;
          heFranjaMap[franjaId].misionesConHE++;
          heFranjaMap[franjaId].dias.add(date);
        }
      }
    }

    const heByFranja = [];
    for (let i = 0; i < FRANJAS.length; i++) {
      const f = FRANJAS[i];
      const info = heFranjaMap[f.id];
      if (info.he > 0 || info.misionesConHE > 0) {
        heByFranja.push({
          franja: f.id,
          label: f.label,
          horasExtras: Math.round(info.he * 100) / 100,
          misionesConHE: info.misionesConHE,
          dias: info.dias.size,
        });
      }
    }
    // Only add "otros" if there are hours outside the 3 main franjas
    const otrosInfo = heFranjaMap["otros"];
    if (otrosInfo.he > 0 || otrosInfo.misionesConHE > 0) {
      heByFranja.push({
        franja: "otros",
        label: "Otros horarios",
        horasExtras: Math.round(otrosInfo.he * 100) / 100,
        misionesConHE: otrosInfo.misionesConHE,
        dias: otrosInfo.dias.size,
      });
    }

    const filteredOperatorName = filters.operario && records.length > 0 ? records[0].nombre : null;

    return NextResponse.json({
      dailyMetrics,
      monthlyData,
      heByFranja,
      dayHeatmap,
      collaboratorHeatmap,
      filteredOperatorName,
    });
  } catch (error) {
    console.error("Error fetching summary tables:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error fetching summary tables", detail: msg }, { status: 500 });
  }
}
