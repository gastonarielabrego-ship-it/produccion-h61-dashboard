"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, X, TrendingUp, Clock, Users } from "lucide-react";
import { ExcelButton } from "./excel-button";
import { PrintButton } from "./print-button";

export function RendimientosTab() {
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

  useEffect(function() { fetchData(); }, [fetchData]);

  const summary = data ? (data.summary || []) : [];
  const daily = data ? (data.daily || []) : [];
  const totals = data ? (data.totals || {}) : {};

  const summaryRows = useMemo(function() {
    return summary.map(function(r: any) {
      const hsBrutas = Number(r.total_hs_brutas ?? 0);
      const hsNetas = Number(r.total_hs_netas ?? 0);
      const bultos = Number(r.total_bultos ?? 0);
      return {
        nombre: r.nombre,
        bultos: bultos,
        hsBrutas: hsBrutas,
        tmHs: Number(r.total_tm ?? 0),
        hsNetas: hsNetas,
        produccion: hsNetas > 0 ? Math.round((bultos / hsNetas) * 10) / 10 : 0,
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
  const excelRows = useMemo(function() {
    const rows: any[] = [];
    for (let i = 0; i < summaryRows.length; i++) {
      const s = summaryRows[i];
      const personDaily = dailyByPerson[s.nombre] || [];

      // Header row per person
      rows.push({
        Dia: "Dia",
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
          Personal: s.nombre,
          Bultos: Number(d.bultos ?? 0),
          "Hs. Brutas": Number(d.hs_brutas ?? 0),
          "TM (hs)": Math.round(Number(d.tm_hs ?? 0) * 100) / 100,
          "Hs. Netas": Math.round(Number(d.hs_netas ?? 0) * 100) / 100,
          Produccion: Math.round(Number(d.produccion ?? 0) * 10) / 10,
          "B/H Bruta": Math.round(Number(d.bh_bruta ?? 0) * 10) / 10,
          "B/H Neta": Math.round(Number(d.bh_neta ?? 0) * 10) / 10,
        });
      }

      // Total row
      rows.push({
        Dia: "TOTAL",
        Personal: s.nombre,
        Bultos: s.bultos,
        "Hs. Brutas": Math.round(s.hsBrutas * 100) / 100,
        "TM (hs)": Math.round(s.tmHs * 100) / 100,
        "Hs. Netas": Math.round(s.hsNetas * 100) / 100,
        Produccion: Math.round(s.produccion * 10) / 10,
        "B/H Bruta": Math.round(s.bhBruta * 10) / 10,
        "B/H Neta": Math.round(s.bhNeta * 10) / 10,
      });
    }
    return rows;
  }, [summaryRows, dailyByPerson]);

  const hasFilters = fDesde || fHasta || fTurno || fTipo;
  const clearFilters = function() { setFDesde(""); setFHasta(""); setFTurno(""); setFTipo(""); };

  if (error) return (
    <Card><CardContent className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Error al cargar datos de rendimientos.</p>
      <button onClick={fetchData} className="mt-2 text-xs text-primary underline">Reintentar</button>
    </CardContent></Card>
  );
  if (!data) return (
    <div className="space-y-6">{[1, 2].map(function(i) {
      return (
        <Card key={i}><CardContent className="p-4 h-[200px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent></Card>
      );
    })}</div>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Filter className="h-4 w-4" />
            <span className="text-xs font-medium">Filtros</span>
            {hasFilters && (
              <button onClick={clearFilters}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <input type="date" value={fDesde} onChange={function(e) { setFDesde(e.target.value); }}
                className="text-xs border rounded px-2 py-1 bg-background" />
              <span className="text-xs text-muted-foreground">a</span>
              <input type="date" value={fHasta} onChange={function(e) { setFHasta(e.target.value); }}
                className="text-xs border rounded px-2 py-1 bg-background" />
            </div>

            <select value={fTurno} onChange={function(e) { setFTurno(e.target.value); }}
              className="text-xs border rounded px-2 py-1 bg-background">
              <option value="">Todos los turnos</option>
              {shifts.map(function(s) {
                return <option key={s.value} value={s.value}>{s.label}</option>;
              })}
            </select>

            <select value={fTipo} onChange={function(e) { setFTipo(e.target.value); }}
              className="text-xs border rounded px-2 py-1 bg-background">
              <option value="">Todos</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="EVENTUAL">Eventual</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Bultos Total</span>
            </div>
            <p className="text-2xl font-bold">{(totals.totalBultos ?? 0).toLocaleString("es-AR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">B/H Bruta</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{Math.round((totals.bhBruta ?? 0) * 10) / 10}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">B/H Neta</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{Math.round((totals.bhNeta ?? 0) * 10) / 10}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Personal / Dias</span>
            </div>
            <p className="text-2xl font-bold">{totals.personal ?? 0} <span className="text-sm font-normal text-muted-foreground">/ {totals.dias ?? 0}</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Resumen de Rendimientos por Personal
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={excelRows}
              filename="Rendimientos"
              sheetName="Diarias"
              colWidths={[22, 30, 10, 10, 8, 10, 12, 10, 10]}
            />
            <PrintButton title="Rendimientos" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[200px]">Personal</th>
                <th className="text-xs font-semibold text-center p-2">Bultos</th>
                <th className="text-xs font-semibold text-center p-2">Hs. Brutas</th>
                <th className="text-xs font-semibold text-center p-2">TM (hs)</th>
                <th className="text-xs font-semibold text-center p-2">Hs. Netas</th>
                <th className="text-xs font-semibold text-center p-2">Produccion</th>
                <th className="text-xs font-semibold text-center p-2 text-blue-600">B/H Bruta</th>
                <th className="text-xs font-semibold text-center p-2 text-emerald-600">B/H Neta</th>
                <th className="text-xs font-semibold text-center p-2">Dias</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map(function(row) {
                return (
                  <tr key={row.nombre} className="border-b hover:bg-muted/50">
                    <td className="text-xs font-medium p-2 sticky left-0 bg-card">{row.nombre}</td>
                    <td className="text-xs text-center p-2">{row.bultos.toLocaleString("es-AR")}</td>
                    <td className="text-xs text-center p-2">{Math.round(row.hsBrutas * 100) / 100}</td>
                    <td className="text-xs text-center p-2">{Math.round(row.tmHs * 100) / 100}</td>
                    <td className="text-xs text-center p-2">{Math.round(row.hsNetas * 100) / 100}</td>
                    <td className="text-xs text-center p-2">{Math.round(row.produccion * 10) / 10}</td>
                    <td className="text-xs text-center p-2 font-medium text-blue-600">{Math.round(row.bhBruta * 10) / 10}</td>
                    <td className="text-xs text-center p-2 font-medium text-emerald-600">{Math.round(row.bhNeta * 10) / 10}</td>
                    <td className="text-xs text-center p-2">{row.dias}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 font-bold bg-muted/30">
                <td className="text-xs font-bold p-2 sticky left-0 bg-muted/30">TOTAL</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{(totals.totalBultos ?? 0).toLocaleString("es-AR")}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{Math.round((totals.totalHsBrutas ?? 0) * 100) / 100}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{Math.round((totals.totalTm ?? 0) * 100) / 100}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{Math.round((totals.totalHsNetas ?? 0) * 100) / 100}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.totalHsNetas > 0 ? Math.round(((totals.totalBultos ?? 0) / totals.totalHsNetas) * 10) / 10 : 0}</td>
                <td className="text-xs text-center font-bold p-2 text-blue-600 bg-muted/30">{Math.round((totals.bhBruta ?? 0) * 10) / 10}</td>
                <td className="text-xs text-center font-bold p-2 text-emerald-600 bg-muted/30">{Math.round((totals.bhNeta ?? 0) * 10) / 10}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.dias ?? 0}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Detailed daily breakdown per person */}
      {Object.keys(dailyByPerson).map(function(nombre) {
        const rows = dailyByPerson[nombre];
        const sData = summaryRows.find(function(s) { return s.nombre === nombre; });
        return (
          <Card key={nombre}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{nombre}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-xs font-semibold text-center p-2">Dia</th>
                    <th className="text-xs font-semibold text-center p-2">Bultos</th>
                    <th className="text-xs font-semibold text-center p-2">Hs. Brutas</th>
                    <th className="text-xs font-semibold text-center p-2">TM (hs)</th>
                    <th className="text-xs font-semibold text-center p-2">Hs. Netas</th>
                    <th className="text-xs font-semibold text-center p-2 text-blue-600">B/H Bruta</th>
                    <th className="text-xs font-semibold text-center p-2 text-emerald-600">B/H Neta</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(function(r: any, idx: number) {
                    return (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="text-xs text-center p-2">{String(r.dia ?? "")}</td>
                        <td className="text-xs text-center p-2">{Number(r.bultos ?? 0).toLocaleString("es-AR")}</td>
                        <td className="text-xs text-center p-2">{Number(r.hs_brutas ?? 0)}</td>
                        <td className="text-xs text-center p-2">{Math.round(Number(r.tm_hs ?? 0) * 100) / 100}</td>
                        <td className="text-xs text-center p-2">{Math.round(Number(r.hs_netas ?? 0) * 100) / 100}</td>
                        <td className="text-xs text-center p-2 text-blue-600">{Math.round(Number(r.bh_bruta ?? 0) * 10) / 10}</td>
                        <td className="text-xs text-center p-2 text-emerald-600">{Math.round(Number(r.bh_neta ?? 0) * 10) / 10}</td>
                      </tr>
                    );
                  })}
                  {sData && (
                    <tr className="border-t-2 font-bold bg-muted/30">
                      <td className="text-xs text-center font-bold p-2 bg-muted/30">TOTAL</td>
                      <td className="text-xs text-center font-bold p-2 bg-muted/30">{sData.bultos.toLocaleString("es-AR")}</td>
                      <td className="text-xs text-center font-bold p-2 bg-muted/30">{Math.round(sData.hsBrutas * 100) / 100}</td>
                      <td className="text-xs text-center font-bold p-2 bg-muted/30">{Math.round(sData.tmHs * 100) / 100}</td>
                      <td className="text-xs text-center font-bold p-2 bg-muted/30">{Math.round(sData.hsNetas * 100) / 100}</td>
                      <td className="text-xs text-center font-bold p-2 text-blue-600 bg-muted/30">{Math.round(sData.bhBruta * 10) / 10}</td>
                      <td className="text-xs text-center font-bold p-2 text-emerald-600 bg-muted/30">{Math.round(sData.bhNeta * 10) / 10}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}