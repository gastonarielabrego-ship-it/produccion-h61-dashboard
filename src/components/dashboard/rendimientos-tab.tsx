"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Filter, X, TrendingUp, Users } from "lucide-react";
import { ExcelButton } from "./excel-button";
import { PrintButton } from "./print-button";
import { KpiCard, SectionCard, ErrorState, TabSkeleton, TH, TH_LEFT, TD, TD_LEFT, TD_NUM, TR_FOOT } from "./ui-kit";

interface RendimientosTabProps { refreshKey?: number }

export function RendimientosTab({ refreshKey }: RendimientosTabProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  // Filters
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fTurno, setFTurno] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [shifts, setShifts] = useState<{ value: string; label: string }[]>([]);

  // Fetch available shifts once
  useEffect(function() {
    fetch("/api/production/dates", { cache: "no-store" })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.shifts) setShifts(d.shifts);
      })
      .catch(function() {});
  }, []);

  const dateToInt = useCallback(function(dateStr: string): string {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return "";
    return String(Number(parts[0]) * 10000 + Number(parts[1]) * 100 + Number(parts[2]));
  }, []);

  const fetchData = useCallback(function() {
    setError(false);
    const params = new URLSearchParams();
    const fromNum = dateToInt(fDesde);
    if (fromNum) params.set("dateFrom", fromNum);
    const toNum = dateToInt(fHasta);
    if (toNum) params.set("dateTo", toNum);
    if (fTurno) params.set("turno", fTurno);
    if (fTipo) params.set("tipo", fTipo);
    fetch("/api/rendimientos?" + params.toString(), { cache: "no-store" })
      .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(function() { setError(true); });
  }, [fDesde, fHasta, fTurno, fTipo, dateToInt]);

  useEffect(function() { fetchData(); }, [fetchData, refreshKey]);

  const summary = data ? (data.summary || []) : [];
  const daily = data ? (data.daily || []) : [];
  const totals = data ? (data.totals || {}) : {};

  const summaryRows = useMemo(function() {
    return summary.map(function(r: any) {
      const hsBrutas = Number(r.total_hs_brutas ?? 0);
      const hsNetas = Number(r.total_hs_netas ?? 0);
      const bultos = Number(r.total_bultos ?? 0);
      return {
        operario: r.operario || "",
        nombre: r.nombre,
        bultos: bultos,
        hsBrutas: hsBrutas,
        tmHs: Number(r.total_tm ?? 0),
        hsNetas: hsNetas,
        produccion: r.dias > 0 ? Math.round((bultos / r.dias) * 10) / 10 : 0,
        bhBruta: hsBrutas > 0 ? Math.round((bultos / hsBrutas) * 10) / 10 : 0,
        bhNeta: hsNetas > 0 ? Math.round((bultos / hsNetas) * 10) / 10 : 0,
        dias: Number(r.dias ?? 0),
      };
    });
  }, [summary]);

  // Group daily data by person
  const dailyByPerson = useMemo(function() {
    const map: Record<string, any[]> = {};
    for (let i = 0; i < daily.length; i++) {
      const r = daily[i];
      const n = String(r.nombre ?? "");
      if (!map[n]) map[n] = [];
      map[n].push(r);
    }
    return map;
  }, [daily]);

  // Excel download data — same format as reference Excel
  // Each person's section: header row → daily rows → total row → empty separator row
  const excelRows = useMemo(function() {
    const rows: any[] = [];
    const emptyRow = {
      Dia: "",
      Operario: "",
      Personal: "",
      Bultos: "",
      "Hs. Brutas": "",
      "TM (hs)": "",
      "Hs. Netas": "",
      Produccion: "",
      "B/H Bruta": "",
      "B/H Neta": "",
    };

    for (let i = 0; i < summaryRows.length; i++) {
      const s = summaryRows[i];
      const personDaily = dailyByPerson[s.nombre] || [];

      // Add empty separator row BEFORE each person (except the first)
      if (i > 0) {
        rows.push({ ...emptyRow });
      }

      // Header row per person
      rows.push({
        Dia: "Dia",
        Operario: "Operario",
        Personal: s.nombre,
        Bultos: "Bultos",
        "Hs. Brutas": "Hs. Brutas",
        "TM (hs)": "TM (hs)",
        "Hs. Netas": "Hs. Netas",
        Produccion: "Produccion",
        "B/H Bruta": "B/H Bruta",
        "B/H Neta": "B/H Neta",
      });

      // Daily rows
      for (let j = 0; j < personDaily.length; j++) {
        const d = personDaily[j];
        rows.push({
          Dia: String(d.dia ?? ""),
          Operario: String(d.operario ?? ""),
          Personal: s.nombre,
          Bultos: Number(d.bultos ?? 0),
          "Hs. Brutas": Number(d.hs_brutas ?? 0),
          "TM (hs)": Math.round(Number(d.tm_hs ?? 0) * 100) / 100,
          "Hs. Netas": Math.round(Number(d.hs_netas ?? 0) * 100) / 100,
          Produccion: Number(d.bultos ?? 0),
          "B/H Bruta": Math.round(Number(d.bh_bruta ?? 0) * 10) / 10,
          "B/H Neta": Math.round(Number(d.bh_neta ?? 0) * 10) / 10,
        });
      }

      // Total row — sums for additive columns, ratio for B/H
      rows.push({
        Dia: "TOTAL",
        Operario: s.operario,
        Personal: s.nombre,
        Bultos: s.bultos,
        "Hs. Brutas": Math.round(s.hsBrutas * 100) / 100,
        "TM (hs)": Math.round(s.tmHs * 100) / 100,
        "Hs. Netas": Math.round(s.hsNetas * 100) / 100,
        Produccion: s.bultos,
        "B/H Bruta": Math.round(s.bhBruta * 10) / 10,
        "B/H Neta": Math.round(s.bhNeta * 10) / 10,
      });
    }
    return rows;
  }, [summaryRows, dailyByPerson]);

  const hasFilters = fDesde || fHasta || fTurno || fTipo;
  const clearFilters = function() { setFDesde(""); setFHasta(""); setFTurno(""); setFTipo(""); };

  if (error) return <ErrorState message="Error al cargar datos de rendimientos." onRetry={fetchData} />;
  if (!data) return <TabSkeleton rows={3} />;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <SectionCard icon={Filter} title="Filtros" tone="slate" contentClassName="p-4 pt-0"
        actions={hasFilters ? (
          <button onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3 w-3" /> Limpiar
          </button>
        ) : undefined}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <input type="date" value={fDesde} onChange={function(e) { setFDesde(e.target.value); }}
              className="text-xs border rounded-md px-2 py-1.5 bg-background" />
            <span className="text-xs text-muted-foreground">a</span>
            <input type="date" value={fHasta} onChange={function(e) { setFHasta(e.target.value); }}
              className="text-xs border rounded-md px-2 py-1.5 bg-background" />
          </div>

          <select value={fTurno} onChange={function(e) { setFTurno(e.target.value); }}
            className="text-xs border rounded-md px-2 py-1.5 bg-background">
            <option value="">Todos los turnos</option>
            {shifts.map(function(s) {
              return <option key={s.value} value={s.value}>{s.label}</option>;
            })}
          </select>

          <select value={fTipo} onChange={function(e) { setFTipo(e.target.value); }}
            className="text-xs border rounded-md px-2 py-1.5 bg-background">
            <option value="">Todos</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="EVENTUAL">Eventual</option>
          </select>
        </div>
      </SectionCard>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="Bultos Total" value={(totals.totalBultos ?? 0).toLocaleString("es-AR")} tone="emerald" />
        <KpiCard icon={TrendingUp} label="B/H Bruta" value={Math.round((totals.bhBruta ?? 0) * 10) / 10} tone="sky" />
        <KpiCard icon={TrendingUp} label="B/H Neta" value={Math.round((totals.bhNeta ?? 0) * 10) / 10} tone="emerald" />
        <KpiCard
          icon={Users}
          label="Personal / Días"
          value={<>{totals.personal ?? 0} <span className="text-sm font-normal text-muted-foreground">/ {totals.dias ?? 0}</span></>}
          tone="violet"
        />
      </div>

      {/* Summary Table */}
      <SectionCard
        icon={TrendingUp}
        title="Resumen de Rendimientos por Personal"
        tone="emerald"
        contentClassName="p-0 overflow-x-auto"
        actions={
          <>
            <ExcelButton
              rows={excelRows}
              filename="Rendimientos"
              sheetName="Diarias"
              colWidths={[22, 14, 30, 10, 10, 8, 10, 12, 10, 10]}
            />
            <PrintButton title="Rendimientos" />
          </>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className={`${TH_LEFT} sticky left-0 bg-muted/40 min-w-[200px]`}>Personal</th>
              <th className={TH}>Operario</th>
              <th className={TH}>Bultos</th>
              <th className={TH}>Hs. Brutas</th>
              <th className={TH}>TM (hs)</th>
              <th className={TH}>Hs. Netas</th>
              <th className={TH}>Produccion</th>
              <th className={`${TH} text-blue-600`}>B/H Bruta</th>
              <th className={`${TH} text-emerald-600`}>B/H Neta</th>
              <th className={TH}>Dias</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map(function(row) {
              return (
                <tr key={row.nombre} className="border-b hover:bg-muted/50">
                  <td className={`${TD_LEFT} font-medium sticky left-0 bg-card`}>{row.nombre}</td>
                  <td className={`${TD} font-mono`}>{row.operario}</td>
                  <td className={`${TD_NUM} font-medium`}>{row.bultos.toLocaleString("es-AR")}</td>
                  <td className={TD_NUM}>{Math.round(row.hsBrutas * 100) / 100}</td>
                  <td className={TD_NUM}>{Math.round(row.tmHs * 100) / 100}</td>
                  <td className={TD_NUM}>{Math.round(row.hsNetas * 100) / 100}</td>
                  <td className={TD_NUM}>{Math.round(row.produccion * 10) / 10}</td>
                  <td className={`${TD_NUM} font-medium text-blue-600`}>{Math.round(row.bhBruta * 10) / 10}</td>
                  <td className={`${TD_NUM} font-medium text-emerald-600`}>{Math.round(row.bhNeta * 10) / 10}</td>
                  <td className={TD_NUM}>{row.dias}</td>
                </tr>
              );
            })}
            <tr className={TR_FOOT}>
              <td className={`${TD_LEFT} sticky left-0 bg-muted/40`}>TOTAL</td>
              <td className={TD}></td>
              <td className={`${TD_NUM} font-bold`}>{(totals.totalBultos ?? 0).toLocaleString("es-AR")}</td>
              <td className={`${TD_NUM} font-bold`}>{Math.round((totals.totalHsBrutas ?? 0) * 100) / 100}</td>
              <td className={`${TD_NUM} font-bold`}>{Math.round((totals.totalTm ?? 0) * 100) / 100}</td>
              <td className={`${TD_NUM} font-bold`}>{Math.round((totals.totalHsNetas ?? 0) * 100) / 100}</td>
              <td className={`${TD_NUM} font-bold`}>{Math.round((totals.produccion ?? 0) * 10) / 10}</td>
              <td className={`${TD_NUM} font-bold text-blue-600`}>{Math.round((totals.bhBruta ?? 0) * 10) / 10}</td>
              <td className={`${TD_NUM} font-bold text-emerald-600`}>{Math.round((totals.bhNeta ?? 0) * 10) / 10}</td>
              <td className={`${TD_NUM} font-bold`}>{totals.dias ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </SectionCard>

      {/* Detailed daily breakdown per person */}
      {Object.keys(dailyByPerson).map(function(nombre) {
        const rows = dailyByPerson[nombre];
        const sData = summaryRows.find(function(s) { return s.nombre === nombre; });
        return (
          <SectionCard
            key={nombre}
            icon={Users}
            title={`${nombre}`}
            description={`Operario ${rows[0]?.operario ?? ""}`}
            tone="slate"
            contentClassName="p-0 overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className={TH}>Dia</th>
                  <th className={TH}>Operario</th>
                  <th className={TH}>Bultos</th>
                  <th className={TH}>Hs. Brutas</th>
                  <th className={TH}>TM (hs)</th>
                  <th className={TH}>Hs. Netas</th>
                  <th className={`${TH} text-blue-600`}>B/H Bruta</th>
                  <th className={`${TH} text-emerald-600`}>B/H Neta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(function(r: any, idx: number) {
                  return (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className={TD}>{String(r.dia ?? "")}</td>
                      <td className={`${TD} font-mono`}>{String(r.operario ?? "")}</td>
                      <td className={`${TD_NUM} font-medium`}>{Number(r.bultos ?? 0).toLocaleString("es-AR")}</td>
                      <td className={TD_NUM}>{Number(r.hs_brutas ?? 0)}</td>
                      <td className={TD_NUM}>{Math.round(Number(r.tm_hs ?? 0) * 100) / 100}</td>
                      <td className={TD_NUM}>{Math.round(Number(r.hs_netas ?? 0) * 100) / 100}</td>
                      <td className={`${TD_NUM} text-blue-600`}>{Math.round(Number(r.bh_bruta ?? 0) * 10) / 10}</td>
                      <td className={`${TD_NUM} text-emerald-600`}>{Math.round(Number(r.bh_neta ?? 0) * 10) / 10}</td>
                    </tr>
                  );
                })}
                {sData && (
                  <tr className={TR_FOOT}>
                    <td className={`${TD} font-bold`}>TOTAL</td>
                    <td className={TD}></td>
                    <td className={`${TD_NUM} font-bold`}>{sData.bultos.toLocaleString("es-AR")}</td>
                    <td className={`${TD_NUM} font-bold`}>{Math.round(sData.hsBrutas * 100) / 100}</td>
                    <td className={`${TD_NUM} font-bold`}>{Math.round(sData.tmHs * 100) / 100}</td>
                    <td className={`${TD_NUM} font-bold`}>{Math.round(sData.hsNetas * 100) / 100}</td>
                    <td className={`${TD_NUM} font-bold text-blue-600`}>{Math.round(sData.bhBruta * 10) / 10}</td>
                    <td className={`${TD_NUM} font-bold text-emerald-600`}>{Math.round(sData.bhNeta * 10) / 10}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </SectionCard>
        );
      })}
    </div>
  );
}
