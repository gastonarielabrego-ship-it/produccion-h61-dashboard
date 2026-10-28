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
    if (soloActivos) { nomConditions.push(`(activo = '*' OR activo = '1')`); }
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

    // ── 3. Fetch production (aggregated in SQL by fecha+operario) and tiempos muertos IN PARALLEL ──
    // PERF: SQL-side GROUP BY reduces ~67K raw rows to ~10K aggregated rows before transfer,
    // and lets Postgres do the heavy SUM work instead of Node.
    const prodConditions: string[] = [];
    const prodParams: (string | number | string[])[] = [];
    let pIdx = 1;
    const prodAddParam = (v: string | number | string[]): string => { prodParams.push(v); return `$${pIdx++}`; };
    prodConditions.push(`operario = ANY(${prodAddParam(usuarios)})`);
    if (dateFrom) { prodConditions.push(`fecha >= ${prodAddParam(Number(dateFrom))}`); }
    if (dateTo) { prodConditions.push(`fecha <= ${prodAddParam(Number(dateTo))}`); }
    const prodWhere = "WHERE " + prodConditions.join(" AND ");

    // Per-hour aggregates: SUM(hora_XX) for totals + SUM(CASE WHEN hora_XX > 0 ...)
    // to preserve the exact "hour active in ANY raw row" semantics.
    const hourAgg: string[] = [];
    for (let h = 0; h <= 23; h++) {
      const col = "hora_" + String(h).padStart(2, "0");
      hourAgg.push(`SUM(${col}) AS ${col}, SUM(CASE WHEN ${col} > 0 THEN 1 ELSE 0 END) AS act_${col}`);
    }

    const tmConditions: string[] = [];
    const tmParams: (string | number | string[])[] = [];
    let tmIdx = 1;
    const tmAddParam = (v: string | number | string[]): string => { tmParams.push(v); return `$${tmIdx++}`; };
    tmConditions.push(`operario = ANY(${tmAddParam(usuarios)})`);
    if (dateFrom) { tmConditions.push(`fecha >= ${tmAddParam(Number(dateFrom))}`); }
    if (dateTo) { tmConditions.push(`fecha <= ${tmAddParam(Number(dateTo))}`); }
    const tmWhere = "WHERE " + tmConditions.join(" AND ");

    const [prodResult, tmResult] = await Promise.all([
      client.execute(
        `SELECT fecha, operario, MAX(nombre) AS nombre, SUM(total) AS total, ${hourAgg.join(", ")}
          FROM production_records ${prodWhere}
          GROUP BY fecha, operario`,
        prodParams,
      ),
      client.execute(
        `SELECT fecha, operario, SUM(minutos) as total_minutos FROM tiempos_muertos ${tmWhere} GROUP BY fecha, operario`,
        tmParams,
      ),
    ]);
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

    // Key: "fecha:operario" → { bultos, activeHours[], hourly[24] }
    // PERF: hourly sums accumulated in THIS single pass (rows arrive pre-aggregated by SQL).
    // Previously each of the ~10K person-days re-scanned all 67K rows 24 times = 17.2B iterations (~61s CPU).
    const dateOpMap: Record<string, { bultos: number; activeHours: number[]; hourly: number[] }> = {};

    for (let i = 0; i < prodResult.rows.length; i++) {
      const row = prodResult.rows[i];
      const fecha = Number(row.fecha);
      const operario = String(row.operario || "");
      const nombre = String(row.nombre || "");
      const total = Number(row.total) || 0;
      if (fecha <= 0 || !operario) continue;

      const key = fecha + ":" + operario;
      let entry = dateOpMap[key];
      if (!entry) {
        entry = dateOpMap[key] = { bultos: 0, activeHours: [], hourly: new Array(24).fill(0) };
      }
      entry.bultos += total;

      for (let h = 0; h <= 23; h++) {
        const col = "hora_" + String(h).padStart(2, "0");
        const qty = Number(row[col]) || 0;
        entry.hourly[h] += qty;
        if (Number(row["act_" + col]) > 0) {
          entry.activeHours.push(h);
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

      // Hourly breakdown — pre-accumulated during the single pass above (O(1) here)
      const hourly = entry.hourly;

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
