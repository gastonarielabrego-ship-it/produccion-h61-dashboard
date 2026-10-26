"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, X, Clock, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { ExcelButton } from "./excel-button";
import { PrintButton } from "./print-button";

interface TurnoIntermedioTabProps { refreshKey?: number }

/** Turno Intermedio code — workers with "pikeos" starting at 9:00hs */
const TURNO_INTERMEDIO = "I";

export function TurnoIntermedioTab({ refreshKey }: TurnoIntermedioTabProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  // Filters (date range + tipo only — turno is always "I")
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [availableShifts, setAvailableShifts] = useState<{ value: string; label: string }[]>([]);
  const [intermedioFound, setIntermedioFound] = useState(false);

  // Fetch available shifts once to verify Turno Intermedio exists in DB
  useEffect(function() {
    fetch("/api/production/dates", { cache: "no-store" })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.shifts) {
          setAvailableShifts(d.shifts);
          const found = d.shifts.some(function(s: any) { return s.value === TURNO_INTERMEDIO; });
          setIntermedioFound(found);
        }
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
    // Always filter by turno Intermedio
    params.set("turno", TURNO_INTERMEDIO);
    const fromNum = dateToInt(fDesde);
    if (fromNum) params.set("dateFrom", fromNum);
    const toNum = dateToInt(fHasta);
    if (toNum) params.set("dateTo", toNum);
    if (fTipo) params.set("tipo", fTipo);
    fetch("/api/rendimientos?" + params.toString(), { cache: "no-store" })
      .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(function() { setError(true); });
  }, [fDesde, fHasta, fTipo, dateToInt]);

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

  // Excel download data
  const excelRows = useMemo(function() {
    const rows: any[] = [];
    const emptyRow = {
      Dia: "", Operario: "", Personal: "", Bultos: "",
      "Hs. Brutas": "", "TM (hs)": "", "Hs. Netas": "",
      Produccion: "", "B/H Bruta": "", "B/H Neta": "",
    };

    for (let i = 0; i < summaryRows.length; i++) {
      const s = summaryRows[i];
      const personDaily = dailyByPerson[s.nombre] || [];

      if (i > 0) rows.push({ ...emptyRow });

      rows.push({
        Dia: "Dia", Operario: "Operario", Personal: s.nombre,
        Bultos: "Bultos", "Hs. Brutas": "Hs. Brutas", "TM (hs)": "TM (hs)",
        "Hs. Netas": "Hs. Netas", Produccion: "Produccion",
        "B/H Bruta": "B/H Bruta", "B/H Neta": "B/H Neta",
      });

      for (let j = 0; j < personDaily.length; j++) {
        const d = personDaily[j];
        rows.push({
          Dia: String(d.dia ?? ""), Operario: String(d.operario ?? ""),
          Personal: s.nombre, Bultos: Number(d.bultos ?? 0),
          "Hs. Brutas": Number(d.hs_brutas ?? 0),
          "TM (hs)": Math.round(Number(d.tm_hs ?? 0) * 100) / 100,
          "Hs. Netas": Math.round(Number(d.hs_netas ?? 0) * 100) / 100,
          Produccion: Number(d.bultos ?? 0),
          "B/H Bruta": Math.round(Number(d.bh_bruta ?? 0) * 10) / 10,
          "B/H Neta": Math.round(Number(d.bh_neta ?? 0) * 10) / 10,
        });
      }

      rows.push({
        Dia: "TOTAL", Operario: s.operario, Personal: s.nombre,
        Bultos: s.bultos, "Hs. Brutas": Math.round(s.hsBrutas * 100) / 100,
        "TM (hs)": Math.round(s.tmHs * 100) / 100,
        "Hs. Netas": Math.round(s.hsNetas * 100) / 100,
        Produccion: s.bultos, "B/H Bruta": Math.round(s.bhBruta * 10) / 10,
        "B/H Neta": Math.round(s.bhNeta * 10) / 10,
      });
    }
    return rows;
  }, [summaryRows, dailyByPerson]);

  const hasFilters = fDesde || fHasta || fTipo;
  const clearFilters = function() { setFDesde(""); setFHasta(""); setFTipo(""); };

  // Pikeo analysis: find workers active at 9:00hs (hora_09)
  // This comes from the daily data — we flag which workers have pikeos starting at 9:00
  const pikeoWorkers = useMemo(function() {
    if (!daily || daily.length === 0) return [];
    // Workers who are active — all Turno Intermedio workers have pikeos at 9:00hs by definition
    return summaryRows.map(function(s) { return s.nombre; });
  }, [summaryRows, daily]);

  if (error) return (
    <Card><CardContent className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Error al cargar datos del Turno Intermedio.</p>
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
      {/* Warning if Turno Intermedio not found in DB */}
      {!intermedioFound && availableShifts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Turno Intermedio (código &quot;{TURNO_INTERMEDIO}&quot;) no encontrado en la base de datos
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Asegúrese de cargar un archivo de Preparación que contenga registros con turno &quot;{TURNO_INTERMEDIO}&quot;.
                Turnos disponibles: {availableShifts.map(function(s) { return `${s.value} (${s.label})`; }).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Filter className="h-4 w-4" />
            <span className="text-xs font-medium">Filtros — Turno Intermedio (pikeos desde 9:00hs)</span>
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

            <select value={fTipo} onChange={function(e) { setFTipo(e.target.value); }}
              className="text-xs border rounded px-2 py-1 bg-background">
              <option value="">Todos</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="EVENTUAL">Eventual</option>
            </select>

            {/* Badge showing turno is locked */}
            <span className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full px-2 py-0.5">
              <Clock className="h-3 w-3" />
              Turno: Intermedio
            </span>
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
              <Clock className="h-4 w-4 text-amber-500" />
              Rendimientos Turno Intermedio — Pikeos desde 9:00hs
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={excelRows}
              filename="Turno_Intermedio"
              sheetName="Intermedio"
              colWidths={[22, 14, 30, 10, 10, 8, 10, 12, 10, 10]}
            />
            <PrintButton title="Turno Intermedio" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[200px]">Personal</th>
                <th className="text-xs font-semibold text-center p-2">Operario</th>
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
                    <td className="text-xs text-center p-2 font-mono">{row.operario}</td>
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
              {summaryRows.length > 0 && (
                <tr className="border-t-2 font-bold bg-muted/30">
                  <td className="text-xs font-bold p-2 sticky left-0 bg-muted/30">TOTAL</td>
                  <td className="text-xs text-center font-bold p-2 bg-muted/30"></td>
                  <td className="text-xs text-center font-bold p-2 bg-muted/30">{(totals.totalBultos ?? 0).toLocaleString("es-AR")}</td>
                  <td className="text-xs text-center font-bold p-2 bg-muted/30">{Math.round((totals.totalHsBrutas ?? 0) * 100) / 100}</td>
                  <td className="text-xs text-center font-bold p-2 bg-muted/30">{Math.round((totals.totalTm ?? 0) * 100) / 100}</td>
                  <td className="text-xs text-center font-bold p-2 bg-muted/30">{Math.round((totals.totalHsNetas ?? 0) * 100) / 100}</td>
                  <td className="text-xs text-center font-bold p-2 bg-muted/30">{Math.round((totals.produccion ?? 0) * 10) / 10}</td>
                  <td className="text-xs text-center font-bold p-2 text-blue-600 bg-muted/30">{Math.round((totals.bhBruta ?? 0) * 10) / 10}</td>
                  <td className="text-xs text-center font-bold p-2 text-emerald-600 bg-muted/30">{Math.round((totals.bhNeta ?? 0) * 10) / 10}</td>
                  <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.dias ?? 0}</td>
                </tr>
              )}
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
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                {nombre} <span className="text-xs font-normal text-muted-foreground font-mono">({rows[0]?.operario ?? ""})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-xs font-semibold text-center p-2">Dia</th>
                    <th className="text-xs font-semibold text-center p-2">Operario</th>
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
                        <td className="text-xs text-center p-2 font-mono">{String(r.operario ?? "")}</td>
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
                      <td className="text-xs text-center font-bold p-2 bg-muted/30"></td>
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

      {/* Empty state */}
      {summaryRows.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No hay datos para el Turno Intermedio en el período seleccionado.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Los registros con turno &quot;{TURNO_INTERMEDIO}&quot; aparecerán aquí al cargar el archivo de Preparación correspondiente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
