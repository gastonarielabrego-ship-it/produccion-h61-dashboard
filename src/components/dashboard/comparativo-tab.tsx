"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Filter, X, BarChart3, User, Trophy, Target, ArrowDownCircle, Calendar, Search, Users, Plus, Trash2 } from "lucide-react";
import { ExcelButton } from "./excel-button";
import { PrintButton } from "./print-button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface ComparativoTabProps { refreshKey?: number }

const CATEGORY_COLORS = {
  top: "#10b981",
  average: "#f59e0b",
  below: "#ef4444",
};

const CATEGORY_LABELS = {
  top: "Mejores",
  average: "En el promedio",
  below: "Por debajo",
};

const COMPARE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6"];

function DistTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-semibold text-sm mb-1">B/H Neta: {label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {Number(entry.value)}
        </p>
      ))}
    </div>
  );
}

function CompareTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-semibold text-sm mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {Number(entry.value).toLocaleString("es-AR")}
        </p>
      ))}
    </div>
  );
}

export function ComparativoTab({ refreshKey }: ComparativoTabProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  // Filters
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fTurno, setFTurno] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [shifts, setShifts] = useState<{ value: string; label: string }[]>([]);

  // Compare: selected operarios (up to 5)
  const [compareOperarios, setCompareOperarios] = useState<string[]>([]);
  const [compareSearch, setCompareSearch] = useState("");
  const [evolutionSeries, setEvolutionSeries] = useState<any[]>([]);
  const [monthlyAvgData, setMonthlyAvgData] = useState<any[]>([]);

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

  const buildBaseParams = useCallback(function() {
    const params = new URLSearchParams();
    const fromNum = dateToInt(fDesde);
    if (fromNum) params.set("dateFrom", fromNum);
    const toNum = dateToInt(fHasta);
    if (toNum) params.set("dateTo", toNum);
    if (fTurno) params.set("turno", fTurno);
    if (fTipo) params.set("tipo", fTipo);
    return params;
  }, [fDesde, fHasta, fTurno, fTipo, dateToInt]);

  const fetchData = useCallback(function() {
    setError(false);
    fetch("/api/comparativo?" + buildBaseParams().toString(), { cache: "no-store" })
      .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(function() { setError(true); });
  }, [buildBaseParams]);

  useEffect(function() { fetchData(); }, [fetchData, refreshKey]);

  // Fetch evolution comparison when selected operarios change
  const fetchEvolution = useCallback(function() {
    if (compareOperarios.length === 0) {
      setEvolutionSeries([]);
      setMonthlyAvgData([]);
      return;
    }
    const params = buildBaseParams();
    for (let i = 0; i < compareOperarios.length; i++) {
      params.append("operario", compareOperarios[i]);
    }
    fetch("/api/comparativo?" + params.toString(), { cache: "no-store" })
      .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function(d) {
        setEvolutionSeries(d.evolutionSeries || []);
        setMonthlyAvgData(d.monthlyAvg || []);
      })
      .catch(function() { setEvolutionSeries([]); setMonthlyAvgData([]); });
  }, [compareOperarios, buildBaseParams]);

  useEffect(function() { fetchEvolution(); }, [fetchEvolution]);

  const ranking = data ? (data.ranking || []) : [];
  const top10 = data ? (data.top10 || []) : [];
  const average10 = data ? (data.average10 || []) : [];
  const below10 = data ? (data.below10 || []) : [];
  const globalAvg = data ? (data.globalAvg || 0) : 0;
  const stdDev = data ? (data.stdDev || 0) : 0;
  const avgLow = data ? (data.avgLow || 0) : 0;
  const avgHigh = data ? (data.avgHigh || 0) : 0;
  const totalPeople = data ? (data.totalPeople || 0) : 0;
  const monthLabels = data ? (data.monthLabels || []) : [];
  const distribution = data ? (data.distribution || []) : [];

  // Add/remove collaborators for comparison
  const addCompare = function(operario: string) {
    if (compareOperarios.length >= 5) return;
    if (compareOperarios.indexOf(operario) >= 0) return;
    setCompareOperarios(function(prev) { return prev.concat([operario]); });
  };
  const removeCompare = function(operario: string) {
    setCompareOperarios(function(prev) { return prev.filter(function(o) { return o !== operario; }); });
  };

  // Build merged evolution chart data (all selected persons, one column per month)
  const compareChartData = useMemo(function() {
    if (evolutionSeries.length === 0) return [];
    // Get all months across all series
    const allMonthsSet = new Set<number>();
    for (let i = 0; i < evolutionSeries.length; i++) {
      for (let j = 0; j < evolutionSeries[i].data.length; j++) {
        allMonthsSet.add(evolutionSeries[i].data[j].ym);
      }
    }
    const allMonths = Array.from(allMonthsSet).sort(function(a, b) { return a - b; });
    // Get month labels from monthlyAvgData
    const monthLabelMap: Record<number, string> = {};
    for (let i = 0; i < monthlyAvgData.length; i++) {
      monthLabelMap[monthlyAvgData[i].ym] = monthlyAvgData[i].monthLabel;
    }
    // Build one row per month
    const rows: any[] = [];
    for (let i = 0; i < allMonths.length; i++) {
      const ym = allMonths[i];
      const row: any = { ym: ym, monthLabel: monthLabelMap[ym] || String(ym) };
      // Add each person's data
      for (let j = 0; j < evolutionSeries.length; j++) {
        const series = evolutionSeries[j];
        const shortName = series.nombre.split(" ").slice(0, 2).join(" ");
        const d = series.data.find(function(dd: any) { return dd.ym === ym; });
        row[series.operario + "_neta"] = d ? d.bh_neta : null;
        row[series.operario + "_bruta"] = d ? d.bh_bruta : null;
        row[series.operario + "_name"] = shortName;
      }
      // Add monthly average
      const avg = monthlyAvgData.find(function(a: any) { return a.ym === ym; });
      row.avgBhNeta = avg ? avg.avgBhNeta : globalAvg;
      rows.push(row);
    }
    return rows;
  }, [evolutionSeries, monthlyAvgData, globalAvg]);

  // Filtered list for the add-collaborator search
  const filteredRankingForSearch = useMemo(function() {
    if (!compareSearch.trim()) return ranking.slice(0, 20);
    const q = compareSearch.trim().toUpperCase();
    return ranking.filter(function(r: any) {
      return r.nombre.toUpperCase().indexOf(q) >= 0 || r.operario.toUpperCase().indexOf(q) >= 0;
    }).slice(0, 20);
  }, [ranking, compareSearch]);

  // Excel download data
  const excelRows = useMemo(function() {
   if (!data) return [];
    const rows: any[] = [];
    rows.push({ Seccion: "TOP 10 MEJORES", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Meses: "" });
    for (let i = 0; i < top10.length; i++) {
      const r = top10[i];
      rows.push({ Seccion: String(i + 1), Personal: r.nombre, "B/H Neta": r.bh_neta, "B/H Bruta": r.bh_bruta, Bultos: r.total_bultos, Meses: r.meses });
    }
    rows.push({ Seccion: "", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Meses: "" });
    rows.push({ Seccion: "10 EN EL PROMEDIO", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Meses: "" });
    for (let i = 0; i < average10.length; i++) {
      const r = average10[i];
      rows.push({ Seccion: String(i + 1), Personal: r.nombre, "B/H Neta": r.bh_neta, "B/H Bruta": r.bh_bruta, Bultos: r.total_bultos, Meses: r.meses });
    }
    rows.push({ Seccion: "", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Meses: "" });
    rows.push({ Seccion: "10 POR DEBAJO", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Meses: "" });
    for (let i = 0; i < below10.length; i++) {
      const r = below10[i];
      rows.push({ Seccion: String(i + 1), Personal: r.nombre, "B/H Neta": r.bh_neta, "B/H Bruta": r.bh_bruta, Bultos: r.total_bultos, Meses: r.meses });
    }
    rows.push({ Seccion: "", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Meses: "" });
    rows.push({ Seccion: "RANKING COMPLETO", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Meses: "" });
    for (let i = 0; i < ranking.length; i++) {
      const r = ranking[i];
      rows.push({ Seccion: String(i + 1), Personal: r.nombre, "B/H Neta": r.bh_neta, "B/H Bruta": r.bh_bruta, Bultos: r.total_bultos, Meses: r.meses });
    }
    return rows;
  }, [top10, average10, below10, ranking]);

  const hasFilters = fDesde || fHasta || fTurno || fTipo;
  const clearFilters = function() { setFDesde(""); setFHasta(""); setFTurno(""); setFTipo(""); setCompareOperarios([]); setCompareSearch(""); };

  if (error) return (
    <Card><CardContent className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Error al cargar datos comparativos.</p>
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

  const topCount = ranking.filter(function(r: any) { return r.category === "top"; }).length;
  const avgCount = ranking.filter(function(r: any) { return r.category === "average"; }).length;
  const belowCount = ranking.filter(function(r: any) { return r.category === "below"; }).length;

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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Trophy className="h-4 w-4" />
              <span className="text-xs font-medium">Mejores</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{topCount}</p>
            <p className="text-xs text-muted-foreground">B/H Neta ≥ {avgHigh}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium">En Promedio</span>
            </div>
            <p className="text-2xl font-bold text-amber-500">{avgCount}</p>
            <p className="text-xs text-muted-foreground">{avgLow} – {avgHigh}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ArrowDownCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Por Debajo</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{belowCount}</p>
            <p className="text-xs text-muted-foreground">B/H Neta &lt; {avgLow}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-medium">Promedio General</span>
            </div>
            <p className="text-2xl font-bold">{globalAvg}</p>
            <p className="text-xs text-muted-foreground">Desv. Est. {stdDev} · {monthLabels.length} meses</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Histogram */}
      {distribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Distribución de Rendimiento — B/H Neta
            </CardTitle>
            <CardDescription>
              {totalPeople} colaboradores · Cada barra = cantidad de personas en ese rango · Verde=mejores · Amarillo=promedio · Rojo=por debajo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<DistTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconType="circle" iconSize={8} />
                  <Bar dataKey="top" name="Mejores" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="average" name="Promedio" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="below" name="Por debajo" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Three ranking cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-emerald-500" />
              Top 10 Mejores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-xs font-semibold text-center p-2 w-8">#</th>
                  <th className="text-xs font-semibold text-left p-2">Personal</th>
                  <th className="text-xs font-semibold text-center p-2">B/H Neta</th>
                  <th className="text-xs font-semibold text-center p-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {top10.map(function(r: any, i: number) {
                  const isAdded = compareOperarios.indexOf(r.operario) >= 0;
                  return (
                    <tr key={r.operario} className="border-b hover:bg-muted/50">
                      <td className="text-xs text-center p-2">{i + 1}</td>
                      <td className="text-xs font-medium p-2">{r.nombre}</td>
                      <td className="text-xs text-center p-2 font-medium text-emerald-600">{r.bh_neta}</td>
                      <td className="text-xs text-center p-2">
                        <button onClick={function() { isAdded ? removeCompare(r.operario) : addCompare(r.operario); }}
                          className={"text-xs px-1.5 py-0.5 rounded " + (isAdded ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600")}>
                          {isAdded ? "✕" : "+"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-amber-500" />
              10 en el Promedio
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-xs font-semibold text-center p-2 w-8">#</th>
                  <th className="text-xs font-semibold text-left p-2">Personal</th>
                  <th className="text-xs font-semibold text-center p-2">B/H Neta</th>
                  <th className="text-xs font-semibold text-center p-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {average10.map(function(r: any, i: number) {
                  const isAdded = compareOperarios.indexOf(r.operario) >= 0;
                  return (
                    <tr key={r.operario} className="border-b hover:bg-muted/50">
                      <td className="text-xs text-center p-2">{i + 1}</td>
                      <td className="text-xs font-medium p-2">{r.nombre}</td>
                      <td className="text-xs text-center p-2 font-medium text-amber-600">{r.bh_neta}</td>
                      <td className="text-xs text-center p-2">
                        <button onClick={function() { isAdded ? removeCompare(r.operario) : addCompare(r.operario); }}
                          className={"text-xs px-1.5 py-0.5 rounded " + (isAdded ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600")}>
                          {isAdded ? "✕" : "+"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ArrowDownCircle className="h-4 w-4 text-red-500" />
              10 Por Debajo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-xs font-semibold text-center p-2 w-8">#</th>
                  <th className="text-xs font-semibold text-left p-2">Personal</th>
                  <th className="text-xs font-semibold text-center p-2">B/H Neta</th>
                  <th className="text-xs font-semibold text-center p-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {below10.map(function(r: any, i: number) {
                  const isAdded = compareOperarios.indexOf(r.operario) >= 0;
                  return (
                    <tr key={r.operario} className="border-b hover:bg-muted/50">
                      <td className="text-xs text-center p-2">{i + 1}</td>
                      <td className="text-xs font-medium p-2">{r.nombre}</td>
                      <td className="text-xs text-center p-2 font-medium text-red-600">{r.bh_neta}</td>
                      <td className="text-xs text-center p-2">
                        <button onClick={function() { isAdded ? removeCompare(r.operario) : addCompare(r.operario); }}
                          className={"text-xs px-1.5 py-0.5 rounded " + (isAdded ? "bg-red-100 text-red-600" : "bg-red-100 text-red-600")}>
                          {isAdded ? "✕" : "+"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Multi-collaborator Comparison Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Comparar Colaboradores
          </CardTitle>
          <CardDescription>
            Seleccione hasta 5 colaboradores para comparar su evolución mensual. Haga clic en "+" en las tablas de arriba o busque abajo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search to add */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 border rounded px-2 py-1 bg-background">
              <Search className="h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                value={compareSearch}
                onChange={function(e) { setCompareSearch(e.target.value); }}
                placeholder="Buscar colaborador..."
                className="text-xs bg-transparent outline-none w-[180px]"
              />
            </div>
            {compareOperarios.length >= 5 && (
              <span className="text-xs text-muted-foreground">Máximo 5 colaboradores</span>
            )}
          </div>

          {/* Search results */}
          {compareSearch.trim() && (
            <div className="border rounded max-h-[150px] overflow-y-auto">
              {filteredRankingForSearch
                .filter(function(r: any) { return compareOperarios.indexOf(r.operario) < 0; })
                .map(function(r: any) {
                  const catColor = r.category === "top" ? "text-emerald-600" : r.category === "average" ? "text-amber-600" : "text-red-600";
                  return (
                    <div key={r.operario} className="flex items-center justify-between px-2 py-1 hover:bg-muted/50 text-xs border-b last:border-b-0">
                      <span className="font-medium">{r.nombre}</span>
                      <span className={catColor + " mr-2"}>{r.bh_neta}</span>
                      <button onClick={function() { addCompare(r.operario); setCompareSearch(""); }}
                        className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Selected collaborators chips */}
          {compareOperarios.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {compareOperarios.map(function(operario: string, idx: number) {
                const person = ranking.find(function(r: any) { return r.operario === operario; });
                if (!person) return null;
                return (
                  <div key={operario}
                    className="flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border"
                    style={{ borderColor: COMPARE_COLORS[idx % COMPARE_COLORS.length], backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length] + "15" }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length] }} />
                    <span className="font-medium">{person.nombre.split(" ").slice(0, 2).join(" ")}</span>
                    <span className="text-muted-foreground">{person.bh_neta}</span>
                    <button onClick={function() { removeCompare(operario); }} className="ml-1 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comparison chart */}
          {compareChartData.length > 0 && evolutionSeries.length > 0 ? (
            <div className="space-y-4">
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={compareChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CompareTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconType="circle" iconSize={8} />
                    <ReferenceLine y={globalAvg} stroke="#eab308" strokeDasharray="6 3" label={{ value: "Prom: " + globalAvg, position: "insideTopRight", fill: "#eab308", fontSize: 10 }} />
                    <Line type="monotone" dataKey="avgBhNeta" name="Prom. Mensual" stroke="#eab308" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                    {evolutionSeries.map(function(series: any, idx: number) {
                      const shortName = series.nombre.split(" ").slice(0, 2).join(" ");
                      return (
                        <Line
                          key={series.operario}
                          type="monotone"
                          dataKey={series.operario + "_neta"}
                          name={shortName}
                          stroke={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
                          strokeWidth={2.5}
                          dot={{ r: 5, fill: "#fff", stroke: COMPARE_COLORS[idx % COMPARE_COLORS.length], strokeWidth: 2 }}
                          activeDot={{ r: 7 }}
                          connectNulls
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Detail table per person */}
              {evolutionSeries.map(function(series: any, idx: number) {
                return (
                  <div key={series.operario} className="border rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length] }} />
                      <span className="text-sm font-semibold">{series.nombre}</span>
                      <span className="text-xs text-muted-foreground font-mono">({series.operario})</span>
                      <span className={"text-xs font-medium " + (series.category === "top" ? "text-emerald-600" : series.category === "average" ? "text-amber-600" : "text-red-600")}>
                        {series.category === "top" ? "▲ Mejor" : series.category === "average" ? "● Promedio" : "▼ Por debajo"}
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-xs font-semibold text-center p-2">Mes</th>
                          <th className="text-xs font-semibold text-center p-2">Bultos</th>
                          <th className="text-xs font-semibold text-center p-2">Dias</th>
                          <th className="text-xs font-semibold text-center p-2 text-blue-600">B/H Bruta</th>
                          <th className="text-xs font-semibold text-center p-2 text-emerald-600">B/H Neta</th>
                          <th className="text-xs font-semibold text-center p-2">vs Prom.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {series.data.map(function(d: any, i: number) {
                          const diff = Math.round((d.bh_neta - globalAvg) * 10) / 10;
                          return (
                            <tr key={i} className="border-b hover:bg-muted/50">
                              <td className="text-xs text-center p-2">{d.monthLabel}</td>
                              <td className="text-xs text-center p-2">{d.total_bultos.toLocaleString("es-AR")}</td>
                              <td className="text-xs text-center p-2">{d.dias}</td>
                              <td className="text-xs text-center p-2 text-blue-600">{d.bh_bruta}</td>
                              <td className="text-xs text-center p-2 font-medium text-emerald-600">{d.bh_neta}</td>
                              <td className={"text-xs text-center p-2 font-medium " + (diff >= 0 ? "text-emerald-600" : "text-red-600")}>
                                {diff >= 0 ? "+" : ""}{diff}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          ) : compareOperarios.length > 0 ? (
            <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
              Cargando comparación...
            </div>
          ) : (
            <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
              Haga clic en "+" en las tablas de arriba o busque un colaborador para comparar
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Ranking Table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              Ranking Completo ({totalPeople} colaboradores)
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={excelRows}
              filename="Comparativo"
              sheetName="Ranking"
              colWidths={[14, 30, 10, 10, 10, 8]}
            />
            <PrintButton title="Comparativo" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-center p-2 w-8">#</th>
                <th className="text-xs font-semibold text-left p-2 min-w-[180px]">Personal</th>
                <th className="text-xs font-semibold text-center p-2">Operario</th>
                <th className="text-xs font-semibold text-center p-2">Bultos</th>
                <th className="text-xs font-semibold text-center p-2 text-blue-600">B/H Bruta</th>
                <th className="text-xs font-semibold text-center p-2 text-emerald-600">B/H Neta</th>
                <th className="text-xs font-semibold text-center p-2">Meses</th>
                <th className="text-xs font-semibold text-center p-2">Categoria</th>
                <th className="text-xs font-semibold text-center p-2">Comparar</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(function(r: any, i: number) {
                const catIcon = r.category === "top" ? "▲" : r.category === "average" ? "●" : "▼";
                const catColor = r.category === "top" ? "text-emerald-600" : r.category === "average" ? "text-amber-600" : "text-red-600";
                const isAdded = compareOperarios.indexOf(r.operario) >= 0;
                return (
                  <tr key={r.operario} className="border-b hover:bg-muted/50">
                    <td className="text-xs text-center p-2">{i + 1}</td>
                    <td className="text-xs font-medium p-2">{r.nombre}</td>
                    <td className="text-xs text-center p-2 font-mono">{r.operario}</td>
                    <td className="text-xs text-center p-2">{r.total_bultos.toLocaleString("es-AR")}</td>
                    <td className="text-xs text-center p-2 text-blue-600">{r.bh_bruta}</td>
                    <td className="text-xs text-center p-2 font-medium text-emerald-600">{r.bh_neta}</td>
                    <td className="text-xs text-center p-2">{r.meses}</td>
                    <td className={"text-xs text-center p-2 font-medium " + catColor}>{catIcon} {CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS]}</td>
                    <td className="text-xs text-center p-2">
                      <button onClick={function() { isAdded ? removeCompare(r.operario) : addCompare(r.operario); }}
                        className={"text-xs px-1.5 py-0.5 rounded " + (isAdded ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary")}>
                        {isAdded ? "✕" : "+"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
