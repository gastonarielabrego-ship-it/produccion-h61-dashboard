"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, X, TrendingUp, Users, Briefcase, ChevronDown, ChevronRight } from "lucide-react";
import { ExcelButton } from "./excel-button";
import { PrintButton } from "./print-button";

interface SeguimientoRRHHTabProps { refreshKey?: number }

export function SeguimientoRRHHTab({ refreshKey }: SeguimientoRRHHTabProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  // Filters
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fJornada, setFJornada] = useState("");
  const [fPerfil, setFPerfil] = useState("");
  const [fSoloActivos, setFSoloActivos] = useState(true);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

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
    if (fJornada) params.set("jornada", fJornada);
    if (fPerfil) params.set("perfil", fPerfil);
    if (fSoloActivos) params.set("activos", "1");
    fetch("/api/rrhh?" + params.toString(), { cache: "no-store" })
      .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(function() { setError(true); });
  }, [fDesde, fHasta, fJornada, fPerfil, fSoloActivos, dateToInt]);

  useEffect(function() { fetchData(); }, [fetchData, refreshKey]);

  const people = data ? (data.people || []) : [];
  const summary = data ? (data.summary || {}) : {};

  const hasFilters = fDesde || fHasta || fJornada || fPerfil;
  const clearFilters = function() { setFDesde(""); setFHasta(""); setFJornada(""); setFPerfil(""); };

  // Jornada labels
  const jornadaLabel = (j: string) => {
    if (j === "TM") return "Mañana";
    if (j === "TT") return "Tarde";
    if (j === "TN") return "Noche";
    if (j === "TI") return "Intermedio";
    return j;
  };

  // Excel data
  const excelRows = useMemo(function() {
    const rows: any[] = [];
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      rows.push({
        "Usuario": p.usuario,
        "Nombre": p.nombre,
        "Jornada": jornadaLabel(p.jornada),
        "Perfil": p.perfil,
        "Activo": p.activo === "*" || p.activo === "1" ? "Sí" : "No",
        "Días Trab.": p.diasTrabajados,
        "Bultos": p.totalBultos,
        "Hs. Brutas": p.totalHsBrutas,
        "TM (hs)": p.totalTm,
        "Hs. Netas": p.totalHsNetas,
        "B/H Bruta": p.bhBruta,
        "B/H Neta": p.bhNeta,
      });
    }
    return rows;
  }, [people]);

  if (error) return (
    <Card><CardContent className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Error al cargar datos de RRHH.</p>
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
            <span className="text-xs font-medium">Filtros RRHH</span>
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

            <select value={fJornada} onChange={function(e) { setFJornada(e.target.value); }}
              className="text-xs border rounded px-2 py-1 bg-background">
              <option value="">Todas las jornadas</option>
              <option value="TM">Mañana</option>
              <option value="TT">Tarde</option>
              <option value="TN">Noche</option>
              <option value="TI">Intermedio</option>
            </select>

            <select value={fPerfil} onChange={function(e) { setFPerfil(e.target.value); }}
              className="text-xs border rounded px-2 py-1 bg-background">
              <option value="">Todos los perfiles</option>
              <option value="ENTREVISTA">Entrevista</option>
              <option value="REINGRESO">Reingreso</option>
              <option value="XD">XD</option>
              <option value="MM">MM</option>
            </select>

            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={fSoloActivos} onChange={function(e) { setFSoloActivos(e.target.checked); }}
                className="rounded border" />
              Solo activos
            </label>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Nómina</span>
            </div>
            <p className="text-2xl font-bold">{summary.totalNomina ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Briefcase className="h-4 w-4" />
              <span className="text-xs font-medium">Con Producción</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{summary.conProduccion ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">B/H Bruta</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{summary.bhBruta ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">B/H Neta</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{summary.bhNeta ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4" />
              Seguimiento Productividad RRHH — Eventuales
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={excelRows}
              filename="RRHH-Eventuales"
              sheetName="Seguimiento"
              colWidths={[12, 30, 10, 12, 8, 10, 10, 10, 8, 10, 10, 10]}
            />
            <PrintButton title="RRHH Eventuales" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[200px]">Personal</th>
                <th className="text-xs font-semibold text-center p-2">Usuario</th>
                <th className="text-xs font-semibold text-center p-2">Jornada</th>
                <th className="text-xs font-semibold text-center p-2">Perfil</th>
                <th className="text-xs font-semibold text-center p-2">Act.</th>
                <th className="text-xs font-semibold text-center p-2">Bultos</th>
                <th className="text-xs font-semibold text-center p-2">Hs. Brutas</th>
                <th className="text-xs font-semibold text-center p-2">TM</th>
                <th className="text-xs font-semibold text-center p-2">Hs. Netas</th>
                <th className="text-xs font-semibold text-center p-2 text-blue-600">B/H Bruta</th>
                <th className="text-xs font-semibold text-center p-2 text-emerald-600">B/H Neta</th>
                <th className="text-xs font-semibold text-center p-2">Días</th>
              </tr>
            </thead>
            <tbody>
              {people.map(function(p: any) {
                const isExpanded = expandedPerson === p.usuario;
                return (
                  <>
                    <tr key={p.usuario} className={`border-b hover:bg-muted/50 cursor-pointer ${!p.hasProduction ? "opacity-50" : ""}`}
                      onClick={function() { setExpandedPerson(isExpanded ? null : p.usuario); }}>
                      <td className="text-xs font-medium p-2 sticky left-0 bg-card flex items-center gap-1">
                        {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                        {p.nombre}
                      </td>
                      <td className="text-xs text-center p-2 font-mono">{p.usuario}</td>
                      <td className="text-xs text-center p-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          p.jornada === "TM" ? "bg-amber-100 text-amber-800" :
                          p.jornada === "TT" ? "bg-blue-100 text-blue-800" :
                          p.jornada === "TN" ? "bg-purple-100 text-purple-800" :
                          p.jornada === "TI" ? "bg-teal-100 text-teal-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>{jornadaLabel(p.jornada)}</span>
                      </td>
                      <td className="text-xs text-center p-2">{p.perfil}</td>
                      <td className="text-xs text-center p-2">{p.activo === "*" || p.activo === "1" ? "✓" : ""}</td>
                      <td className="text-xs text-center p-2">{p.totalBultos.toLocaleString("es-AR")}</td>
                      <td className="text-xs text-center p-2">{p.totalHsBrutas}</td>
                      <td className="text-xs text-center p-2">{p.totalTm}</td>
                      <td className="text-xs text-center p-2">{p.totalHsNetas}</td>
                      <td className="text-xs text-center p-2 font-medium text-blue-600">{p.bhBruta}</td>
                      <td className="text-xs text-center p-2 font-medium text-emerald-600">{p.bhNeta}</td>
                      <td className="text-xs text-center p-2">{p.diasTrabajados}</td>
                    </tr>
                    {/* Expanded: daily detail */}
                    {isExpanded && p.daily.length > 0 && (
                      <tr key={p.usuario + "-detail"}>
                        <td colSpan={12} className="p-0 bg-muted/20">
                          <div className="px-8 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  <th className="font-semibold text-left p-1.5">Día</th>
                                  <th className="font-semibold text-center p-1.5">Bultos</th>
                                  <th className="font-semibold text-center p-1.5">Hs. Brutas</th>
                                  <th className="font-semibold text-center p-1.5">TM</th>
                                  <th className="font-semibold text-center p-1.5">Hs. Netas</th>
                                  <th className="font-semibold text-center p-1.5 text-blue-600">B/H Bruta</th>
                                  <th className="font-semibold text-center p-1.5 text-emerald-600">B/H Neta</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.daily.map(function(d: any, idx: number) {
                                  return (
                                    <tr key={idx} className="border-b">
                                      <td className="p-1.5">{d.dia}</td>
                                      <td className="text-center p-1.5">{Number(d.bultos).toLocaleString("es-AR")}</td>
                                      <td className="text-center p-1.5">{d.hs_brutas}</td>
                                      <td className="text-center p-1.5">{d.tm_hs}</td>
                                      <td className="text-center p-1.5">{d.hs_netas}</td>
                                      <td className="text-center p-1.5 text-blue-600">{d.bh_bruta}</td>
                                      <td className="text-center p-1.5 text-emerald-600">{d.bh_neta}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {/* Hourly breakdown */}
                            {p.daily.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[10px] font-semibold text-muted-foreground mb-1">Hora a hora (bultos por hora)</p>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[10px]">
                                    <thead>
                                      <tr>
                                        <th className="font-semibold text-left p-1 min-w-[80px]">Día</th>
                                        {Array.from({length: 24}, (_, h) => (
                                          <th key={h} className="font-semibold text-center p-1 min-w-[30px]">{String(h).padStart(2, "0")}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {p.daily.map(function(d: any, idx: number) {
                                        return (
                                          <tr key={idx} className="border-b">
                                            <td className="p-1 font-medium">{d.dia}</td>
                                            {(d.hourly || []).map(function(qty: number, h: number) {
                                              return (
                                                <td key={h} className={`text-center p-1 ${qty > 0 ? "bg-emerald-50 text-emerald-800 font-medium" : "text-muted-foreground"}`}>
                                                  {qty > 0 ? qty : ""}
                                                </td>
                                              );
                                            })}
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {/* Grand totals */}
              <tr className="border-t-2 font-bold bg-muted/30">
                <td className="text-xs font-bold p-2 sticky left-0 bg-muted/30">TOTAL</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30"></td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30"></td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30"></td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30"></td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{(summary.totalBultos ?? 0).toLocaleString("es-AR")}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{summary.totalHsBrutas ?? 0}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30"></td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{summary.totalHsNetas ?? 0}</td>
                <td className="text-xs text-center font-bold p-2 text-blue-600 bg-muted/30">{summary.bhBruta ?? 0}</td>
                <td className="text-xs text-center font-bold p-2 text-emerald-600 bg-muted/30">{summary.bhNeta ?? 0}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30"></td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
