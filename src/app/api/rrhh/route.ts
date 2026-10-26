import { getClient, ensureNominaOverrideTable } from "@/lib/neon";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// ── Shift span calculation (same logic as rendimientos) ──
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
    const jornada = url.searchParams.get("jornada");
    const perfil = url.searchParams.get("perfil");
    const soloActivos = url.searchParams.get("activos") === "1";

    // ── 1. Fetch nomina_eventuales ──
    const nomConditions: string[] = [];
    const nomParams: (string | number)[] = [];
    let nIdx = 1;
    const nomAddParam = (v: string | number): string => { nomParams.push(v); return `$${nIdx++}`; };
    if (jornada) { nomConditions.push(`jornada = ${nomAddParam(jornada)}`); }
    if (perfil) { nomConditions.push(`perfil = ${nomAddParam(perfil)}`); }
    if (soloActivos) { nomConditions.push(`activo = '*'`); }
    const nomWhere = nomConditions.length > 0 ? "WHERE " + nomConditions.join(" AND ") : "";

    const nomResult = await client.execute(
      `SELECT usuario, nombre, jornada, perfil, sector, activo, fecha_alta, fecha_baja, motivo_baja, dias_activos, codigo_empleado FROM nomina_eventuales ${nomWhere} ORDER BY nombre`,
      nomParams,
    );

    if (nomResult.rows.length === 0) {
      return NextResponse.json({ people: [], summary: {} }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // ── 2. Get operario codes from nomina ──
    const usuarios = nomResult.rows.map((r: any) => String(r.usuario)).filter(Boolean);
    if (usuarios.length === 0) {
      return NextResponse.json({ people: [], summary: {} }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // ── 3. Fetch production records for these operarios in date range ──
    const prodConditions: string[] = [];
    const prodParams: (string | number)[] = [];
    let pIdx = 1;
    const prodAddParam = (v: string | number): string => { prodParams.push(v); return `$${pIdx++}`; };

    // Build IN clause for operarios
    const operarioPlaceholders = usuarios.map((u) => prodAddParam(u)).join(",");
    prodConditions.push(`operario IN (${operarioPlaceholders})`);

    if (dateFrom) { prodConditions.push(`fecha >= ${prodAddParam(Number(dateFrom))}`); }
    if (dateTo) { prodConditions.push(`fecha <= ${prodAddParam(Number(dateTo))}`); }
    const prodWhere = "WHERE " + prodConditions.join(" AND ");

    const prodResult = await client.execute(
      `SELECT fecha, operario, nombre, total, hora_00, hora_01, hora_02, hora_03, hora_04, hora_05, hora_06, hora_07, hora_08, hora_09, hora_10, hora_11, hora_12, hora_13, hora_14, hora_15, hora_16, hora_17, hora_18, hora_19, hora_20, hora_21, hora_22, hora_23
        FROM production_records ${prodWhere} ORDER BY fecha, nombre`,
      prodParams,
    );

    // ── 4. Fetch tiempos muertos ──
    const tmConditions: string[] = [];
    const tmParams: (string | number)[] = [];
    let tmIdx = 1;
    const tmAddParam = (v: string | number): string => { tmParams.push(v); return `$${tmIdx++}`; };
    const tmOperarioPlaceholders = usuarios.map((u) => tmAddParam(u)).join(",");
    tmConditions.push(`operario IN (${tmOperarioPlaceholders})`);
    if (dateFrom) { tmConditions.push(`fecha >= ${tmAddParam(Number(dateFrom))}`); }
    if (dateTo) { tmConditions.push(`fecha <= ${tmAddParam(Number(dateTo))}`); }
    const tmWhere = "WHERE " + tmConditions.join(" AND ");

    const tmResult = await client.execute(
      `SELECT fecha, operario, SUM(minutos) as total_minutos FROM tiempos_muertos ${tmWhere} GROUP BY fecha, operario`,
      tmParams,
    );
    const tmMap: Record<string, number> = {};
    for (let i = 0; i < tmResult.rows.length; i++) {
      const row = tmResult.rows[i];
      tmMap[row.fecha + ":" + row.operario] = Number(row.total_minutos) || 0;
    }

    // ── 5. Aggregate production data per person ──
    // Key: operario → { nombre, dailyRows[], totals }
    const personMap: Record<string, {
      nombre: string;
      dailyRows: any[];
      totalBultos: number;
      totalHsBrutas: number;
      totalTm: number;
      totalHsNetas: number;
      dias: Set<number>;
    }> = {};

    // Key: "fecha:operario" → { bultos, activeHours[] }
    const dateOpMap: Record<string, { bultos: number; activeHours: number[] }> = {};

    for (let i = 0; i < prodResult.rows.length; i++) {
      const row = prodResult.rows[i];
      const fecha = Number(row.fecha);
      const operario = String(row.operario || "");
      const nombre = String(row.nombre || "");
      const total = Number(row.total) || 0;
      if (fecha <= 0 || !operario) continue;

      const key = fecha + ":" + operario;
      if (!dateOpMap[key]) {
        dateOpMap[key] = { bultos: 0, activeHours: [] };
      }
      dateOpMap[key].bultos += total;

      for (let h = 0; h <= 23; h++) {
        const col = "hora_" + String(h).padStart(2, "0");
        if (Number(row[col]) > 0) {
          dateOpMap[key].activeHours.push(h);
        }
      }

      if (!personMap[operario]) {
        personMap[operario] = { nombre, dailyRows: [], totalBultos: 0, totalHsBrutas: 0, totalTm: 0, totalHsNetas: 0, dias: new Set() };
      }
    }

    // Build daily rows per person
    const opKeys = Object.keys(dateOpMap);
    for (let i = 0; i < opKeys.length; i++) {
      const key = opKeys[i];
      const entry = dateOpMap[key];
      const colonIdx = key.indexOf(":");
      const fecha = Number(key.substring(0, colonIdx));
      const operario = key.substring(colonIdx + 1);

      const hsBrutas = calcHorasBrutas(entry.activeHours);
      const tmMinutos = tmMap[key] || 0;
      const tmHoras = tmMinutos / 60;
      const hsNetas = Math.max(0, hsBrutas - tmHoras);
      const bultos = entry.bultos;
      const bhBruta = hsBrutas > 0 ? bultos / hsBrutas : 0;
      const bhNeta = hsNetas > 0 ? bultos / hsNetas : 0;

      // Hourly breakdown
      const hourly: number[] = [];
      for (let h = 0; h <= 23; h++) {
        // Collect from all rows with this fecha+operario
        let qty = 0;
        for (let j = 0; j < prodResult.rows.length; j++) {
          const row = prodResult.rows[j];
          if (Number(row.fecha) === fecha && String(row.operario) === operario) {
            const col = "hora_" + String(h).padStart(2, "0");
            qty += Number(row[col]) || 0;
          }
        }
        hourly.push(qty);
      }

      const person = personMap[operario];
      if (person) {
        person.dailyRows.push({
          fecha,
          dia: getDiaLabel(fecha),
          bultos,
          hs_brutas: hsBrutas,
          tm_hs: Math.round(tmHoras * 100) / 100,
          hs_netas: Math.round(hsNetas * 100) / 100,
          bh_bruta: Math.round(bhBruta * 10) / 10,
          bh_neta: Math.round(bhNeta * 10) / 10,
          hourly,
        });
        person.totalBultos += bultos;
        person.totalHsBrutas += hsBrutas;
        person.totalTm += tmHoras;
        person.totalHsNetas += hsNetas;
        person.dias.add(fecha);
      }
    }

    // ── 6. Build output combining nomina + production ──
    const people: any[] = [];
    let grandBultos = 0;
    let grandHsBrutas = 0;
    let grandHsNetas = 0;
    let grandPersonnel = 0;

    for (let i = 0; i < nomResult.rows.length; i++) {
      const nom = nomResult.rows[i];
      const usuario = String(nom.usuario);
      const prod = personMap[usuario];

      const p: any = {
        usuario,
        nombre: String(nom.nombre),
        codigo_empleado: Number(nom.codigo_empleado),
        jornada: String(nom.jornada),
        perfil: String(nom.perfil),
        sector: String(nom.sector),
        activo: String(nom.activo),
        fecha_alta: String(nom.fecha_alta),
        fecha_baja: String(nom.fecha_baja),
        motivo_baja: String(nom.motivo_baja),
        dias_activos: Number(nom.dias_activos),
        // Production data
        hasProduction: !!prod,
        daily: prod ? prod.dailyRows.sort((a: any, b: any) => a.fecha - b.fecha) : [],
        totalBultos: prod ? prod.totalBultos : 0,
        totalHsBrutas: prod ? Math.round(prod.totalHsBrutas * 100) / 100 : 0,
        totalTm: prod ? Math.round(prod.totalTm * 100) / 100 : 0,
        totalHsNetas: prod ? Math.round(prod.totalHsNetas * 100) / 100 : 0,
        bhBruta: prod && prod.totalHsBrutas > 0 ? Math.round((prod.totalBultos / prod.totalHsBrutas) * 10) / 10 : 0,
        bhNeta: prod && prod.totalHsNetas > 0 ? Math.round((prod.totalBultos / prod.totalHsNetas) * 10) / 10 : 0,
        diasTrabajados: prod ? prod.dias.size : 0,
      };

      people.push(p);
      if (prod) {
        grandBultos += prod.totalBultos;
        grandHsBrutas += prod.totalHsBrutas;
        grandHsNetas += prod.totalHsNetas;
        grandPersonnel++;
      }
    }

    return NextResponse.json({
      people,
      summary: {
        totalNomina: nomResult.rows.length,
        conProduccion: grandPersonnel,
        totalBultos: grandBultos,
        totalHsBrutas: Math.round(grandHsBrutas * 100) / 100,
        totalHsNetas: Math.round(grandHsNetas * 100) / 100,
        bhBruta: grandHsBrutas > 0 ? Math.round((grandBultos / grandHsBrutas) * 10) / 10 : 0,
        bhNeta: grandHsNetas > 0 ? Math.round((grandBultos / grandHsNetas) * 10) / 10 : 0,
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
}
