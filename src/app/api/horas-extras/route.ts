import { getClient } from "@/lib/neon";
import { NextResponse } from "next/server";

// Tables pre-created via Neon migration

function roundMinutesToHours(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.floor(minutes / 60);
}

export async function GET(request: Request) {
  try {
    const client = getClient();
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    // Build WHERE clause (PostgreSQL: positional params)
    let where = "WHERE 1=1";
    const params: (string | number)[] = [];
    let pIdx = 1;
    const addParam = (v: string | number): string => { params.push(v); return `$${pIdx++}`; };
    if (dateFrom) { where += ` AND fecha >= ${addParam(Number(dateFrom))}`; }
    if (dateTo) { where += ` AND fecha <= ${addParam(Number(dateTo))}`; }

    // ── 1. Ranking by personal ──
    const rankingResult = await client.execute(
      `SELECT nombre, sector,
        SUM(hs_extras_50) as total_50,
        SUM(hs_extras_100) as total_100,
        SUM(hs_noct_100) as total_noct,
        COUNT(*) as dias
        FROM horas_extras_records ${where}
        GROUP BY nombre, sector
        ORDER BY nombre`,
      params,
    );

    const ranking: { nombre: string; sector: string; he50: number; he100: number; noct100: number; totalHE: number; dias: number; mins: number }[] = [];
    let grandTotalHE = 0;
    let grandTotalMins = 0;
    let grandTotal50 = 0;
    let grandTotal100 = 0;
    let grandTotalNoct = 0;

    for (let i = 0; i < rankingResult.rows.length; i++) {
      const r = rankingResult.rows[i];
      const mins50 = Number(r.total_50 ?? 0);
      const mins100 = Number(r.total_100 ?? 0);
      const minsNoct = Number(r.total_noct ?? 0);
      const totalMins = mins50 + mins100 + minsNoct;
      const h50 = roundMinutesToHours(mins50);
      const h100 = roundMinutesToHours(mins100);
      const hNoct = roundMinutesToHours(minsNoct);
      const totalHE = h50 + h100 + hNoct;
      ranking.push({ nombre: String(r.nombre ?? ""), sector: String(r.sector ?? ""), he50: h50, he100: h100, noct100: hNoct, totalHE, dias: Number(r.dias ?? 0), mins: totalMins });
      grandTotalHE += totalHE; grandTotalMins += totalMins; grandTotal50 += h50; grandTotal100 += h100; grandTotalNoct += hNoct;
    }
    ranking.sort(function(a, b) { return b.totalHE - a.totalHE; });
    if (ranking.length > 50) ranking.length = 50;

    // ── 2. Distribution by day type ──
    const dayTypeResult = await client.execute(
      `SELECT dia, SUM(hs_extras_50) as total_50, SUM(hs_extras_100) as total_100, SUM(hs_noct_100) as total_noct, COUNT(*) as registros, COUNT(DISTINCT nombre) as personal FROM horas_extras_records ${where} GROUP BY dia ORDER BY dia`,
      params,
    );

    let lv50 = 0, lv100 = 0, lvNoct = 0, lvRegs = 0, lvPers = 0;
    let s50 = 0, s100 = 0, sNoct = 0, sRegs = 0, sPers = 0;
    let d50 = 0, d100 = 0, dNoct = 0, dRegs = 0, dPers = 0;
    const dayBreakdown: { dia: string; totalHE: number; registros: number; personal: number }[] = [];

    for (let i = 0; i < dayTypeResult.rows.length; i++) {
      const r = dayTypeResult.rows[i];
      const dia = String(r.dia ?? "").trim();
      const m50 = Number(r.total_50 ?? 0); const m100 = Number(r.total_100 ?? 0); const mNoct = Number(r.total_noct ?? 0);
      const regs = Number(r.registros ?? 0); const pers = Number(r.personal ?? 0);
      const totalHE = roundMinutesToHours(m50) + roundMinutesToHours(m100) + roundMinutesToHours(mNoct);
      dayBreakdown.push({ dia, totalHE, registros: regs, personal: pers });
      const d = dia.toLowerCase();
      if (d === "sa" || d === "sab" || d === "sábado") { s50 += roundMinutesToHours(m50); s100 += roundMinutesToHours(m100); sNoct += roundMinutesToHours(mNoct); sRegs += regs; sPers += pers; }
      else if (d === "do" || d === "dom" || d === "domingo") { d50 += roundMinutesToHours(m50); d100 += roundMinutesToHours(m100); dNoct += roundMinutesToHours(mNoct); dRegs += regs; dPers += pers; }
      else { lv50 += roundMinutesToHours(m50); lv100 += roundMinutesToHours(m100); lvNoct += roundMinutesToHours(mNoct); lvRegs += regs; lvPers += pers; }
    }
    const distribution = [
      { tipo: "Lunes a Viernes", he50: lv50, he100: lv100, noct100: lvNoct, totalHE: lv50 + lv100 + lvNoct, registros: lvRegs, personal: lvPers },
      { tipo: "Sábado", he50: s50, he100: s100, noct100: sNoct, totalHE: s50 + s100 + sNoct, registros: sRegs, personal: sPers },
      { tipo: "Domingo", he50: d50, he100: d100, noct100: dNoct, totalHE: d50 + d100 + dNoct, registros: dRegs, personal: dPers },
    ];

    // ── 3. Daily breakdown ──
    const dailyResult = await client.execute(
      `SELECT fecha, SUM(hs_extras_50) as total_50, SUM(hs_extras_100) as total_100, SUM(hs_noct_100) as total_noct, COUNT(*) as registros, COUNT(DISTINCT nombre) as personal FROM horas_extras_records ${where} GROUP BY fecha ORDER BY fecha`,
      params,
    );
    const daily: { date: number; totalHE: number; registros: number; personal: number }[] = [];
    for (let i = 0; i < dailyResult.rows.length; i++) {
      const r = dailyResult.rows[i];
      const m50 = Number(r.total_50 ?? 0); const m100 = Number(r.total_100 ?? 0); const mNoct = Number(r.total_noct ?? 0);
      daily.push({ date: Number(r.fecha ?? 0), totalHE: roundMinutesToHours(m50) + roundMinutesToHours(m100) + roundMinutesToHours(mNoct), registros: Number(r.registros ?? 0), personal: Number(r.personal ?? 0) });
    }

    // ── 4. Monthly breakdown ──
    const monthlyResult = await client.execute(
      `SELECT (fecha / 100) as month, SUM(hs_extras_50) as total_50, SUM(hs_extras_100) as total_100, SUM(hs_noct_100) as total_noct, COUNT(*) as registros, COUNT(DISTINCT nombre) as personal, COUNT(DISTINCT fecha) as dias FROM horas_extras_records ${where} GROUP BY month ORDER BY month`,
      params,
    );
    const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const monthly: { month: number; label: string; he50: number; he100: number; noct100: number; totalHE: number; registros: number; personal: number; dias: number }[] = [];
    for (let i = 0; i < monthlyResult.rows.length; i++) {
      const r = monthlyResult.rows[i]; const mk = Number(r.month ?? 0); const m = mk % 100; const y = Math.floor(mk / 100);
      const m50 = Number(r.total_50 ?? 0); const m100 = Number(r.total_100 ?? 0); const mNoct = Number(r.total_noct ?? 0);
      monthly.push({ month: mk, label: (MONTH_NAMES[m] || "") + " " + y, he50: roundMinutesToHours(m50), he100: roundMinutesToHours(m100), noct100: roundMinutesToHours(mNoct), totalHE: roundMinutesToHours(m50) + roundMinutesToHours(m100) + roundMinutesToHours(mNoct), registros: Number(r.registros ?? 0), personal: Number(r.personal ?? 0), dias: Number(r.dias ?? 0) });
    }

    // ── 5. By Empresa ──
    const empresaResult = await client.execute(
      `SELECT empresa, SUM(hs_extras_50) as total_50, SUM(hs_extras_100) as total_100, SUM(hs_noct_100) as total_noct, COUNT(*) as registros, COUNT(DISTINCT nombre) as personal FROM horas_extras_records ${where} GROUP BY empresa ORDER BY empresa`,
      params,
    );
    let gld50 = 0, gld100 = 0, gldNoct = 0, gldRegs = 0, gldPers = 0;
    let gl50 = 0, gl100 = 0, glNoct = 0, glRegs = 0, glPers = 0;
    for (let i = 0; i < empresaResult.rows.length; i++) {
      const r = empresaResult.rows[i]; const emp = String(r.empresa ?? "").toUpperCase();
      const m50 = Number(r.total_50 ?? 0); const m100 = Number(r.total_100 ?? 0); const mNoct = Number(r.total_noct ?? 0);
      const regs = Number(r.registros ?? 0); const pers = Number(r.personal ?? 0);
      if (emp.indexOf("G.L.D") >= 0) { gld50 += roundMinutesToHours(m50); gld100 += roundMinutesToHours(m100); gldNoct += roundMinutesToHours(mNoct); gldRegs += regs; gldPers += pers; }
      else { gl50 += roundMinutesToHours(m50); gl100 += roundMinutesToHours(m100); glNoct += roundMinutesToHours(mNoct); glRegs += regs; glPers += pers; }
    }
    const byEmpresa = [
      { tipo: "GLD", he50: gld50, he100: gld100, noct100: gldNoct, totalHE: gld50 + gld100 + gldNoct, registros: gldRegs, personal: gldPers },
      { tipo: "GL", he50: gl50, he100: gl100, noct100: glNoct, totalHE: gl50 + gl100 + glNoct, registros: glRegs, personal: glPers },
    ];

    // ── 6. Ranking with empresa ──
    const rankingEmpResult = await client.execute(
      `SELECT nombre, sector, empresa, SUM(hs_extras_50) as total_50, SUM(hs_extras_100) as total_100, SUM(hs_noct_100) as total_noct, COUNT(*) as dias FROM horas_extras_records ${where} GROUP BY nombre, sector, empresa ORDER BY nombre`,
      params,
    );
    ranking.length = 0; grandTotalHE = 0; grandTotalMins = 0; grandTotal50 = 0; grandTotal100 = 0; grandTotalNoct = 0;
    for (let i = 0; i < rankingEmpResult.rows.length; i++) {
      const r = rankingEmpResult.rows[i];
      const mins50 = Number(r.total_50 ?? 0); const mins100 = Number(r.total_100 ?? 0); const minsNoct = Number(r.total_noct ?? 0); const totalMins = mins50 + mins100 + minsNoct;
      const h50 = roundMinutesToHours(mins50); const h100 = roundMinutesToHours(mins100); const hNoct = roundMinutesToHours(minsNoct); const totalHE = h50 + h100 + hNoct;
      const emp = String(r.empresa ?? "").toUpperCase(); let empLabel = "GL"; if (emp.indexOf("G.L.D") >= 0) empLabel = "GLD";
      ranking.push({ nombre: String(r.nombre ?? ""), sector: String(r.sector ?? ""), empresa: empLabel, he50: h50, he100: h100, noct100: hNoct, totalHE, dias: Number(r.dias ?? 0), mins: totalMins });
      grandTotalHE += totalHE; grandTotalMins += totalMins; grandTotal50 += h50; grandTotal100 += h100; grandTotalNoct += hNoct;
    }
    ranking.sort(function(a, b) { return b.totalHE - a.totalHE; }); if (ranking.length > 50) ranking.length = 50;

    // ──2. Available dates ──
    const datesResult = await client.execute("SELECT DISTINCT fecha FROM horas_extras_records ORDER BY fecha");
    const monthsSet: Record<string, boolean> = {}; const datesList: number[] = [];
    for (let i = 0; i < datesResult.rows.length; i++) { const f = Number(datesResult.rows[i].fecha ?? 0); datesList.push(f); monthsSet[String(Math.floor(f / 100))] = true; }
    const monthsList = Object.keys(monthsSet).map(Number).sort();

    return NextResponse.json({ ranking, distribution, byEmpresa, daily, monthly, totals: { totalHE: grandTotalHE, totalMins: grandTotalMins, he50: grandTotal50, he100: grandTotal100, noct100: grandTotalNoct }, dates: datesList, months: monthsList });
  } catch (error: any) {
    console.error("Horas extras query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
