"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Filter, X, TrendingUp, TrendingDown, Minus, BarChart3, User, Trophy, Target, ArrowDownCircle } from "lucide-react";
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
  ScatterChart,
  Scatter,
  ZAxis,
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

export function ComparativoTab({ refreshKey }: ComparativoTabProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  // Filters
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fTurno, setFTurno] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [shifts, setShifts] = useState<{ value: string; label: string }[]>([]);

  // Selected collaborator for evolution chart
  const [selectedOperario, setSelectedOperario] = useState("");
  const [evolutionData, setEvolutionData] = useState<any[]>([]);

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
      })
      .catch(function() { setEvolutionData([]); });
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

  // Prepare chart data — truncate long names
  const chartData = useMemo(function() {
    return ranking.map(function(r: any) {
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
  }, [ranking]);

  // Selected collaborator info
  const selectedPerson = useMemo(function() {
    if (!selectedOperario) return null;
    return ranking.find(function(r: any) { return r.operario === selectedOperario; }) || null;
  }, [selectedOperario, ranking]);

  // Excel download data
  const excelRows = useMemo(function() {
    const rows: any[] = [];
    // Top 10
    rows.push({ Seccion: "TOP 10 MEJORES", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Dias: "" });
    for (let i = 0; i < top10.length; i++) {
      const r = top10[i];
      rows.push({ Seccion: String(i + 1), Personal: r.nombre, "B/H Neta": r.bh_neta, "B/H Bruta": r.bh_bruta, Bultos: r.total_bultos, Dias: r.dias });
    }
    rows.push({ Seccion: "", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Dias: "" });
    // Average 10
    rows.push({ Seccion: "10 EN EL PROMEDIO", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Dias: "" });
    for (let i = 0; i < average10.length; i++) {
      const r = average10[i];
      rows.push({ Seccion: String(i + 1), Personal: r.nombre, "B/H Neta": r.bh_neta, "B/H Bruta": r.bh_bruta, Bultos: r.total_bultos, Dias: r.dias });
    }
    rows.push({ Seccion: "", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Dias: "" });
    // Below 10
    rows.push({ Seccion: "10 POR DEBAJO", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Dias: "" });
    for (let i = 0; i < below10.length; i++) {
      const r = below10[i];
      rows.push({ Seccion: String(i + 1), Personal: r.nombre, "B/H Neta": r.bh_neta, "B/H Bruta": r.bh_bruta, Bultos: r.total_bultos, Dias: r.dias });
    }
    rows.push({ Seccion: "", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Dias: "" });
    // Full ranking
    rows.push({ Seccion: "RANKING COMPLETO", Personal: "", "B/H Neta": "", "B/H Bruta": "", Bultos: "", Dias: "" });
    for (let i = 0; i < ranking.length; i++) {
      const r = ranking[i];
      rows.push({ Seccion: String(i + 1), Personal: r.nombre, "B/H Neta": r.bh_neta, "B/H Bruta": r.bh_bruta, Bultos: r.total_bultos, Dias: r.dias });
    }
    return rows;
  }, [top10, average10, below10, ranking]);

  const hasFilters = fDesde || fHasta || fTurno || fTipo;
  const clearFilters = function() { setFDesde(""); setFHasta(""); setFTurno(""); setFTipo(""); };

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

  // Count people per category
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
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium">Promedio General</span>
            </div>
            <p className="text-2xl font-bold">{globalAvg}</p>
            <p className="text-xs text-muted-foreground">Desv. Est. {stdDev}</p>
          </CardContent>
        </Card>
      </div>

      {/* Comparative Bar Chart */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Comparativo por Colaborador — B/H Neta
            </CardTitle>
            <CardDescription>
              {totalPeople} colaboradores · Promedio: {globalAvg} · Rango promedio: {avgLow}–{avgHigh}
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
            <div className="h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 80 }} layout="vertical">
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
                    width={120}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconType="circle" iconSize={8} />
                  <ReferenceLine x={globalAvg} stroke="#eab308" strokeDasharray="6 3" label={{ value: "Prom: " + globalAvg, position: "insideTopRight", fill: "#eab308", fontSize: 10 }} />
                  <Bar dataKey="bh_neta" name="B/H Neta" maxBarSize={20} radius={[0, 4, 4, 0]}>
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
              No hay datos para el período seleccionado
            </div>
          )}
        </CardContent>
      </Card>

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
                  <th className="text-xs font-semibold text-center p-2">Dias</th>
                </tr>
              </thead>
              <tbody>
                {top10.map(function(r: any, i: number) {
                  return (
                    <tr key={r.operario} className="border-b hover:bg-muted/50 cursor-pointer" onClick={function() { setSelectedOperario(r.operario); }}>
                      <td className="text-xs text-center p-2">{i + 1}</td>
                      <td className="text-xs font-medium p-2">{r.nombre}</td>
                      <td className="text-xs text-center p-2 font-medium text-emerald-600">{r.bh_neta}</td>
                      <td className="text-xs text-center p-2">{r.dias}</td>
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
                  <th className="text-xs font-semibold text-center p-2">Dias</th>
                </tr>
              </thead>
              <tbody>
                {average10.map(function(r: any, i: number) {
                  return (
                    <tr key={r.operario} className="border-b hover:bg-muted/50 cursor-pointer" onClick={function() { setSelectedOperario(r.operario); }}>
                      <td className="text-xs text-center p-2">{i + 1}</td>
                      <td className="text-xs font-medium p-2">{r.nombre}</td>
                      <td className="text-xs text-center p-2 font-medium text-amber-600">{r.bh_neta}</td>
                      <td className="text-xs text-center p-2">{r.dias}</td>
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
                  <th className="text-xs font-semibold text-center p-2">Dias</th>
                </tr>
              </thead>
              <tbody>
                {below10.map(function(r: any, i: number) {
                  return (
                    <tr key={r.operario} className="border-b hover:bg-muted/50 cursor-pointer" onClick={function() { setSelectedOperario(r.operario); }}>
                      <td className="text-xs text-center p-2">{i + 1}</td>
                      <td className="text-xs font-medium p-2">{r.nombre}</td>
                      <td className="text-xs text-center p-2 font-medium text-red-600">{r.bh_neta}</td>
                      <td className="text-xs text-center p-2">{r.dias}</td>
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

      {/* Evolution / Devolution of a Collaborator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Evolución de Colaborador
          </CardTitle>
          <CardDescription>
            Seleccione un colaborador para ver su evolución diaria de B/H Neta y B/H Bruta
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
                <span>B/H Neta promedio: <strong className={selectedPerson.category === "top" ? "text-emerald-600" : selectedPerson.category === "average" ? "text-amber-600" : "text-red-600"}>{selectedPerson.bh_neta}</strong></span>
                <span>Bultos: <strong>{selectedPerson.total_bultos.toLocaleString("es-AR")}</strong></span>
                <span>Dias: <strong>{selectedPerson.dias}</strong></span>
                <span className={selectedPerson.category === "top" ? "text-emerald-600 font-semibold" : selectedPerson.category === "average" ? "text-amber-600 font-semibold" : "text-red-600 font-semibold"}>
                  {selectedPerson.category === "top" ? "▲ Mejores" : selectedPerson.category === "average" ? "● Promedio" : "▼ Por debajo"}
                </span>
              </div>
            )}
          </div>

          {selectedOperario && evolutionData.length > 0 ? (
            <div className="space-y-4">
              {/* Evolution line chart */}
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="fechaLabel"
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
                    <ReferenceLine y={globalAvg} stroke="#eab308" strokeDasharray="6 3" label={{ value: "Prom: " + globalAvg, position: "insideTopRight", fill: "#eab308", fontSize: 10 }} />
                    <Line type="monotone" dataKey="bh_neta" name="B/H Neta" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: "#10b981", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="bh_bruta" name="B/H Bruta" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#fff", stroke: "#6366f1", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Daily detail table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-xs font-semibold text-center p-2">Fecha</th>
                      <th className="text-xs font-semibold text-center p-2">Bultos</th>
                      <th className="text-xs font-semibold text-center p-2">Hs. Brutas</th>
                      <th className="text-xs font-semibold text-center p-2">Hs. Netas</th>
                      <th className="text-xs font-semibold text-center p-2 text-blue-600">B/H Bruta</th>
                      <th className="text-xs font-semibold text-center p-2 text-emerald-600">B/H Neta</th>
                      <th className="text-xs font-semibold text-center p-2">vs Prom.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evolutionData.map(function(d: any, idx: number) {
                      const diff = Math.round((d.bh_neta - globalAvg) * 10) / 10;
                      return (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="text-xs text-center p-2">{d.fechaLabel}</td>
                          <td className="text-xs text-center p-2">{d.bultos.toLocaleString("es-AR")}</td>
                          <td className="text-xs text-center p-2">{d.hs_brutas}</td>
                          <td className="text-xs text-center p-2">{d.hs_netas}</td>
                          <td className="text-xs text-center p-2 text-blue-600">{d.bh_bruta}</td>
                          <td className="text-xs text-center p-2 text-emerald-600">{d.bh_neta}</td>
                          <td className={"text-xs text-center p-2 font-medium " + (diff >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {diff >= 0 ? "+" : ""}{diff}
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
              Cargando evolución...
            </div>
          ) : (
            <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
              Seleccione un colaborador para ver su evolución
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
                <th className="text-xs font-semibold text-center p-2">Hs. Brutas</th>
                <th className="text-xs font-semibold text-center p-2">Hs. Netas</th>
                <th className="text-xs font-semibold text-center p-2 text-blue-600">B/H Bruta</th>
                <th className="text-xs font-semibold text-center p-2 text-emerald-600">B/H Neta</th>
                <th className="text-xs font-semibold text-center p-2">Dias</th>
                <th className="text-xs font-semibold text-center p-2">Categoria</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(function(r: any, i: number) {
                const catIcon = r.category === "top" ? "▲" : r.category === "average" ? "●" : "▼";
                const catColor = r.category === "top" ? "text-emerald-600" : r.category === "average" ? "text-amber-600" : "text-red-600";
                return (
                  <tr key={r.operario} className="border-b hover:bg-muted/50 cursor-pointer" onClick={function() { setSelectedOperario(r.operario); }}>
                    <td className="text-xs text-center p-2">{i + 1}</td>
                    <td className="text-xs font-medium p-2">{r.nombre}</td>
                    <td className="text-xs text-center p-2 font-mono">{r.operario}</td>
                    <td className="text-xs text-center p-2">{r.total_bultos.toLocaleString("es-AR")}</td>
                    <td className="text-xs text-center p-2">{Math.round(r.total_hs_brutas * 100) / 100}</td>
                    <td className="text-xs text-center p-2">{Math.round(r.total_hs_netas * 100) / 100}</td>
                    <td className="text-xs text-center p-2 text-blue-600">{r.bh_bruta}</td>
                    <td className="text-xs text-center p-2 font-medium text-emerald-600">{r.bh_neta}</td>
                    <td className="text-xs text-center p-2">{r.dias}</td>
                    <td className={"text-xs text-center p-2 font-medium " + catColor}>{catIcon} {CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS]}</td>
                  </tr>
                );
              })}
              {ranking.length === 0 && (
                <tr><td colSpan={10} className="text-xs text-center p-4 text-muted-foreground">No hay datos</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
