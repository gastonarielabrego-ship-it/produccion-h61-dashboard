"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Filter, X, BarChart3, User, Trophy, Target, ArrowDownCircle, Calendar, Search } from "lucide-react";
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
  ComposedChart,
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

const MONTH_BAR_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function CustomTooltip({ active, payload, label }: any) {
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

function EvolutionTooltip({ active, payload, label }: any) {
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

function MonthlyTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md max-h-[200px] overflow-y-auto">
      <p className="font-semibold text-sm mb-1">{label}</p>
      {payload.slice(0, 10).map((entry: any, i: number) => (
        <p key={i} className="text-xs flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {Number(entry.value).toLocaleString("es-AR")}
        </p>
      ))}
      {payload.length > 10 && <p className="text-xs text-muted-foreground">...y {payload.length - 10} mas</p>}
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

  // Collaborator filter
  const [searchText, setSearchText] = useState("");
  const [showCount, setShowCount] = useState("20"); // "10", "20", "30", "all"

  // Selected collaborator for evolution chart
  const [selectedOperario, setSelectedOperario] = useState("");
  const [evolutionData, setEvolutionData] = useState<any[]>([]);
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

  const fetchData = useCallback(function() {
    setError(false);
    const params = new URLSearchParams();
    const fromNum = dateToInt(fDesde);
    if (fromNum) params.set("dateFrom", fromNum);
    const toNum = dateToInt(fHasta);
    if (toNum) params.set("dateTo", toNum);
    if (fTurno) params.set("turno", fTurno);
    if (fTipo) params.set("tipo", fTipo);
    fetch("/api/comparativo?" + params.toString(), { cache: "no-store" })
      .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(function() { setError(true); });
  }, [fDesde, fHasta, fTurno, fTipo, dateToInt]);

  useEffect(function() { fetchData(); }, [fetchData, refreshKey]);

  // Fetch evolution data when selected collaborator changes
  const fetchEvolution = useCallback(function() {
    if (!selectedOperario) {
      setEvolutionData([]);
      setMonthlyAvgData([]);
      return;
    }
    const params = new URLSearchParams();
    const fromNum = dateToInt(fDesde);
    if (fromNum) params.set("dateFrom", fromNum);
    const toNum = dateToInt(fHasta);
    if (toNum) params.set("dateTo", toNum);
    if (fTurno) params.set("turno", fTurno);
    if (fTipo) params.set("tipo", fTipo);
    params.set("operario", selectedOperario);
    fetch("/api/comparativo?" + params.toString(), { cache: "no-store" })
      .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function(d) {
        setEvolutionData(d.evolution || []);
        setMonthlyAvgData(d.monthlyAvg || []);
      })
      .catch(function() { setEvolutionData([]); setMonthlyAvgData([]); });
  }, [selectedOperario, fDesde, fHasta, fTurno, fTipo, dateToInt]);

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
  const monthlyChartDataRaw = data ? (data.monthlyChartData || []) : [];

  // ── Filtered ranking: apply search + show count ──
  const filteredRanking = useMemo(function() {
    let list = ranking;
    // Search filter
    if (searchText.trim()) {
      const q = searchText.trim().toUpperCase();
      list = list.filter(function(r: any) {
        return r.nombre.toUpperCase().indexOf(q) >= 0 || r.operario.toUpperCase().indexOf(q) >= 0;
      });
    }
    // Show count (top N from the already sorted ranking)
    if (showCount !== "all") {
      const n = Number(showCount);
      if (list.length > n) list = list.slice(0, n);
    }
    return list;
  }, [ranking, searchText, showCount]);

  // Prepare chart data — truncate long names, only show filtered
  const chartData = useMemo(function() {
    return filteredRanking.map(function(r: any) {
      const parts = r.nombre.split(" ");
      const shortName = parts.length > 2 ? parts[0] + " " + parts[1] : r.nombre;
      return {
        name: shortName,
        fullName: r.nombre,
        bh_neta: r.bh_neta,
        bh_bruta: r.bh_bruta,
        bultos: r.total_bultos,
        category: r.category,
        operario: r.operario,
      };
    });
  }, [filteredRanking]);

  // Filter monthly chart data to match filtered ranking
  const monthlyChartData = useMemo(function() {
    if (searchText.trim() || showCount !== "all") {
      const allowedNames = new Set(filteredRanking.map(function(r: any) { return r.nombre; }));
      // Always include the selected person if any
      if (selectedOperario) {
        const sel = ranking.find(function(r: any) { return r.operario === selectedOperario; });
        if (sel) allowedNames.add(sel.nombre);
      }
      return monthlyChartDataRaw.filter(function(d: any) { return allowedNames.has(d.nombre); });
    }
    // If no filter but too many, limit to top 20
    if (monthlyChartDataRaw.length > 20 && showCount === "all") {
      return monthlyChartDataRaw.slice(0, 20);
    }
    return monthlyChartDataRaw;
  }, [monthlyChartDataRaw, filteredRanking, searchText, showCount, selectedOperario, ranking]);

  // Selected collaborator info
  const selectedPerson = useMemo(function() {
    if (!selectedOperario) return null;
    return ranking.find(function(r: any) { return r.operario === selectedOperario; }) || null;
  }, [selectedOperario, ranking]);

  // Evolution chart data: merge personal data with monthly averages
  const evolutionChartData = useMemo(function() {
    if (evolutionData.length === 0) return [];
    return evolutionData.map(function(e: any) {
      const avgEntry = monthlyAvgData.find(function(a: any) { return a.ym === e.ym; });
      return {
        ...e,
        avgBhNeta: avgEntry ? avgEntry.avgBhNeta : globalAvg,
      };
    });
  }, [evolutionData, monthlyAvgData, globalAvg]);

  // Excel download data
  const excelRows = useMemo(function() {
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

  const hasFilters = fDesde || fHasta || fTurno || fTipo || searchText;
  const clearFilters = function() { setFDesde(""); setFHasta(""); setFTurno(""); setFTipo(""); setSearchText(""); setShowCount("20"); };

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

  // Dynamic chart height based on number of bars
  const barChartHeight = Math.max(300, chartData.length * 22);
  const monthlyChartHeight = Math.max(300, monthlyChartData.length * 22);

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

            {/* Collaborator search */}
            <div className="flex items-center gap-1 border rounded px-2 py-1 bg-background">
              <Search className="h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                value={searchText}
                onChange={function(e) { setSearchText(e.target.value); }}
                placeholder="Buscar colaborador..."
                className="text-xs bg-transparent outline-none w-[140px]"
              />
            </div>

            {/* Show count */}
            <select value={showCount} onChange={function(e) { setShowCount(e.target.value); }}
              className="text-xs border rounded px-2 py-1 bg-background">
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
              <option value="30">Top 30</option>
              <option value="50">Top 50</option>
              <option value="all">Todos ({totalPeople})</option>
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

      {/* Comparative Bar Chart by Person (filtered) */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Comparativo por Colaborador — B/H Neta (promedio mensual)
            </CardTitle>
            <CardDescription>
              Mostrando {chartData.length} de {totalPeople} colaboradores · Promedio general: {globalAvg}
            </CardDescription>
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
        <CardContent>
          {chartData.length > 0 ? (
            <div style={{ height: barChartHeight + "px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={130}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconType="circle" iconSize={8} />
                  <ReferenceLine x={globalAvg} stroke="#eab308" strokeDasharray="6 3" label={{ value: "Prom: " + globalAvg, position: "insideTopRight", fill: "#eab308", fontSize: 10 }} />
                  <Bar dataKey="bh_neta" name="B/H Neta" maxBarSize={18} radius={[0, 4, 4, 0]}>
                    {chartData.map(function(entry: any, idx: number) {
                      return (
                        <Cell
                          key={idx}
                          fill={CATEGORY_COLORS[entry.category as keyof typeof CATEGORY_COLORS] || "#888"}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              No hay datos para los filtros seleccionados
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Comparison Chart — only if we have a reasonable number of people */}
      {monthLabels.length > 0 && monthlyChartData.length > 0 && monthlyChartData.length <= 30 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Comparativo Mensual — B/H Neta por Mes
            </CardTitle>
            <CardDescription>
              {monthlyChartData.length} colaboradores · {monthLabels.join(", ")} · Use el filtro de busqueda para reducir la cantidad
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: monthlyChartHeight + "px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={130}
                  />
                  <Tooltip content={<MonthlyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} iconType="circle" iconSize={8} />
                  <ReferenceLine x={globalAvg} stroke="#eab308" strokeDasharray="6 3" label={{ value: "Prom", position: "insideTopRight", fill: "#eab308", fontSize: 10 }} />
                  {monthLabels.map(function(label: string, i: number) {
                    return (
                      <Bar
                        key={label}
                        dataKey={label}
                        name={label}
                        fill={MONTH_BAR_COLORS[i % MONTH_BAR_COLORS.length]}
                        maxBarSize={14}
                        radius={[0, 3, 3, 0]}
                      />
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show a hint when monthly chart is hidden due to too many people */}
      {monthlyChartData.length > 30 && (
        <Card>
          <CardContent className="p-6 text-center">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Hay {monthlyChartData.length} colaboradores. El grafico mensual se muestra con 30 o menos.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Use el campo <strong>Buscar colaborador</strong> o reduzca <strong>Top N</strong> para ver el grafico mensual.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Three sections: Top 10, Average 10, Below 10 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 10 */}
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
                  <th className="text-xs font-semibold text-center p-2">Meses</th>
                </tr>
              </thead>
              <tbody>
                {top10.map(function(r: any, i: number) {
                  return (
                    <tr key={r.operario} className="border-b hover:bg-muted/50 cursor-pointer" onClick={function() { setSelectedOperario(r.operario); }}>
                      <td className="text-xs text-center p-2">{i + 1}</td>
                      <td className="text-xs font-medium p-2">{r.nombre}</td>
                      <td className="text-xs text-center p-2 font-medium text-emerald-600">{r.bh_neta}</td>
                      <td className="text-xs text-center p-2">{r.meses}</td>
                    </tr>
                  );
                })}
                {top10.length === 0 && (
                  <tr><td colSpan={4} className="text-xs text-center p-4 text-muted-foreground">Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Average 10 */}
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
                  <th className="text-xs font-semibold text-center p-2">Meses</th>
                </tr>
              </thead>
              <tbody>
                {average10.map(function(r: any, i: number) {
                  return (
                    <tr key={r.operario} className="border-b hover:bg-muted/50 cursor-pointer" onClick={function() { setSelectedOperario(r.operario); }}>
                      <td className="text-xs text-center p-2">{i + 1}</td>
                      <td className="text-xs font-medium p-2">{r.nombre}</td>
                      <td className="text-xs text-center p-2 font-medium text-amber-600">{r.bh_neta}</td>
                      <td className="text-xs text-center p-2">{r.meses}</td>
                    </tr>
                  );
                })}
                {average10.length === 0 && (
                  <tr><td colSpan={4} className="text-xs text-center p-4 text-muted-foreground">Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Below 10 */}
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
                  <th className="text-xs font-semibold text-center p-2">Meses</th>
                </tr>
              </thead>
              <tbody>
                {below10.map(function(r: any, i: number) {
                  return (
                    <tr key={r.operario} className="border-b hover:bg-muted/50 cursor-pointer" onClick={function() { setSelectedOperario(r.operario); }}>
                      <td className="text-xs text-center p-2">{i + 1}</td>
                      <td className="text-xs font-medium p-2">{r.nombre}</td>
                      <td className="text-xs text-center p-2 font-medium text-red-600">{r.bh_neta}</td>
                      <td className="text-xs text-center p-2">{r.meses}</td>
                    </tr>
                  );
                })}
                {below10.length === 0 && (
                  <tr><td colSpan={4} className="text-xs text-center p-4 text-muted-foreground">Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Evolution / Devolution of a Collaborator (by month) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Evolución Mensual de Colaborador
          </CardTitle>
          <CardDescription>
            Seleccione un colaborador para ver su evolución mensual de B/H Neta y B/H Bruta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedOperario}
              onChange={function(e) { setSelectedOperario(e.target.value); }}
              className="text-xs border rounded px-2 py-1 bg-background min-w-[250px]"
            >
              <option value="">— Seleccionar colaborador —</option>
              {ranking.map(function(r: any) {
                return (
                  <option key={r.operario} value={r.operario}>
                    {r.nombre} ({r.operario})
                  </option>
                );
              })}
            </select>
            {selectedPerson && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>B/H Neta prom.: <strong className={selectedPerson.category === "top" ? "text-emerald-600" : selectedPerson.category === "average" ? "text-amber-600" : "text-red-600"}>{selectedPerson.bh_neta}</strong></span>
                <span>Bultos: <strong>{selectedPerson.total_bultos.toLocaleString("es-AR")}</strong></span>
                <span>Meses: <strong>{selectedPerson.meses}</strong></span>
                <span className={selectedPerson.category === "top" ? "text-emerald-600 font-semibold" : selectedPerson.category === "average" ? "text-amber-600 font-semibold" : "text-red-600 font-semibold"}>
                  {selectedPerson.category === "top" ? "▲ Mejores" : selectedPerson.category === "average" ? "● Promedio" : "▼ Por debajo"}
                </span>
              </div>
            )}
          </div>

          {selectedOperario && evolutionChartData.length > 0 ? (
            <div className="space-y-4">
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                    <Tooltip content={<EvolutionTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconType="circle" iconSize={8} />
                    <ReferenceLine y={globalAvg} stroke="#eab308" strokeDasharray="6 3" label={{ value: "Prom. Gral: " + globalAvg, position: "insideTopRight", fill: "#eab308", fontSize: 10 }} />
                    <Line type="monotone" dataKey="avgBhNeta" name="Prom. Mensual" stroke="#eab308" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                    <Line type="monotone" dataKey="bh_neta" name="B/H Neta" stroke="#10b981" strokeWidth={2.5} dot={{ r: 5, fill: "#fff", stroke: "#10b981", strokeWidth: 2 }} activeDot={{ r: 7 }} />
                    <Line type="monotone" dataKey="bh_bruta" name="B/H Bruta" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: "#fff", stroke: "#6366f1", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly detail table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-xs font-semibold text-center p-2">Mes</th>
                      <th className="text-xs font-semibold text-center p-2">Bultos</th>
                      <th className="text-xs font-semibold text-center p-2">Dias</th>
                      <th className="text-xs font-semibold text-center p-2">Produccion</th>
                      <th className="text-xs font-semibold text-center p-2 text-blue-600">B/H Bruta</th>
                      <th className="text-xs font-semibold text-center p-2 text-emerald-600">B/H Neta</th>
                      <th className="text-xs font-semibold text-center p-2">Prom. Mes</th>
                      <th className="text-xs font-semibold text-center p-2">vs Prom. Gral.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evolutionChartData.map(function(d: any, idx: number) {
                      const diffGral = Math.round((d.bh_neta - globalAvg) * 10) / 10;
                      return (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="text-xs text-center p-2 font-medium">{d.monthLabel}</td>
                          <td className="text-xs text-center p-2">{d.total_bultos.toLocaleString("es-AR")}</td>
                          <td className="text-xs text-center p-2">{d.dias}</td>
                          <td className="text-xs text-center p-2">{d.produccion}</td>
                          <td className="text-xs text-center p-2 text-blue-600">{d.bh_bruta}</td>
                          <td className="text-xs text-center p-2 font-medium text-emerald-600">{d.bh_neta}</td>
                          <td className="text-xs text-center p-2 text-amber-500">{d.avgBhNeta}</td>
                          <td className={"text-xs text-center p-2 font-medium " + (diffGral >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {diffGral >= 0 ? "+" : ""}{diffGral}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : selectedOperario ? (
            <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
              Cargando evolución mensual...
            </div>
          ) : (
            <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
              Seleccione un colaborador para ver su evolución mensual
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Ranking Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4" />
            Ranking Completo ({totalPeople} colaboradores)
          </CardTitle>
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
              </tr>
            </thead>
            <tbody>
              {filteredRanking.map(function(r: any, i: number) {
                // Find the absolute rank in the full ranking
                const absRank = ranking.findIndex(function(rr: any) { return rr.operario === r.operario; }) + 1;
                const catIcon = r.category === "top" ? "▲" : r.category === "average" ? "●" : "▼";
                const catColor = r.category === "top" ? "text-emerald-600" : r.category === "average" ? "text-amber-600" : "text-red-600";
                return (
                  <tr key={r.operario} className="border-b hover:bg-muted/50 cursor-pointer" onClick={function() { setSelectedOperario(r.operario); }}>
                    <td className="text-xs text-center p-2">{absRank}</td>
                    <td className="text-xs font-medium p-2">{r.nombre}</td>
                    <td className="text-xs text-center p-2 font-mono">{r.operario}</td>
                    <td className="text-xs text-center p-2">{r.total_bultos.toLocaleString("es-AR")}</td>
                    <td className="text-xs text-center p-2 text-blue-600">{r.bh_bruta}</td>
                    <td className="text-xs text-center p-2 font-medium text-emerald-600">{r.bh_neta}</td>
                    <td className="text-xs text-center p-2">{r.meses}</td>
                    <td className={"text-xs text-center p-2 font-medium " + catColor}>{catIcon} {CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS]}</td>
                  </tr>
                );
              })}
              {filteredRanking.length === 0 && (
                <tr><td colSpan={8} className="text-xs text-center p-4 text-muted-foreground">No hay datos</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
