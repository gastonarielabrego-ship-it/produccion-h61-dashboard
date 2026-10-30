"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Filter, X, TrendingUp, Users, Briefcase, ChevronDown, ChevronRight } from "lucide-react";
import { ExcelButton } from "./excel-button";
import { PrintButton } from "./print-button";
import { KpiCard, SectionCard, ErrorState, TabSkeleton, TH, TH_LEFT, TD, TD_LEFT, TD_NUM, TR_FOOT } from "./ui-kit";

interface SeguimientoRRHHTabProps { refreshKey?: number }

export function SeguimientoRRHHTab({ refreshKey }: SeguimientoRRHHTabProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  // Filters
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fJornada, setFJornada] = useState("");
  const [fPerfil, setFPerfil] = useState("");
  const [fSoloActivos, setFSoloActivos] = useState(false);
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

  const jornadaChip = (j: string) => {
    if (j === "TM") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    if (j === "TT") return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
    if (j === "TN") return "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300";
    if (j === "TI") return "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300";
    return "bg-muted text-muted-foreground";
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

  if (error) return <ErrorState message="Error al cargar datos de RRHH." onRetry={fetchData} />;
  if (!data) return <TabSkeleton rows={3} />;

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Nómina" value={summary.totalNomina ?? 0} sub="personas en la base" tone="slate" />
        <KpiCard icon={Briefcase} label="Con Producción" value={summary.conProduccion ?? 0} sub="con bultos en el período" tone="emerald" />
        <KpiCard icon={TrendingUp} label="B/H Bruta" value={summary.bhBruta ?? 0} sub="bultos por hora bruta" tone="sky" />
        <KpiCard icon={TrendingUp} label="B/H Neta" value={summary.bhNeta ?? 0} sub="bultos por hora neta" tone="emerald" />
      </div>

      {/* Filters */}
      <SectionCard icon={Filter} title="Filtros RRHH" tone="slate" contentClassName="p-4 pt-0"
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

          <select value={fJornada} onChange={function(e) { setFJornada(e.target.value); }}
            className="text-xs border rounded-md px-2 py-1.5 bg-background">
            <option value="">Todas las jornadas</option>
            <option value="TM">Mañana</option>
            <option value="TT">Tarde</option>
            <option value="TN">Noche</option>
            <option value="TI">Intermedio</option>
          </select>

          <select value={fPerfil} onChange={function(e) { setFPerfil(e.target.value); }}
            className="text-xs border rounded-md px-2 py-1.5 bg-background">
            <option value="">Todos los perfiles</option>
            <option value="ENTREVISTA">Entrevista</option>
            <option value="REINGRESO">Reingreso</option>
            <option value="XD">XD</option>
            <option value="MM">MM</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
            <input type="checkbox" checked={fSoloActivos} onChange={function(e) { setFSoloActivos(e.target.checked); }}
              className="rounded border" />
            Solo activos
          </label>
        </div>
      </SectionCard>

      {/* Summary Table */}
      <SectionCard
        icon={Briefcase}
        title="Seguimiento Productividad RRHH — Eventuales"
        description="Hacé clic en una persona para ver su detalle diario y hora a hora"
        tone="violet"
        contentClassName="p-0 overflow-x-auto"
        actions={
          <>
            <ExcelButton
              rows={excelRows}
              filename="RRHH-Eventuales"
              sheetName="Seguimiento"
              colWidths={[12, 30, 10, 12, 8, 10, 10, 10, 8, 10, 10, 10]}
            />
            <PrintButton title="RRHH Eventuales" />
          </>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className={`${TH_LEFT} sticky left-0 bg-muted/40 min-w-[200px]`}>Personal</th>
              <th className={TH}>Usuario</th>
              <th className={TH}>Jornada</th>
              <th className={TH}>Perfil</th>
              <th className={TH}>Act.</th>
              <th className={TH}>Bultos</th>
              <th className={TH}>Hs. Brutas</th>
              <th className={TH}>TM</th>
              <th className={TH}>Hs. Netas</th>
              <th className={`${TH} text-blue-600`}>B/H Bruta</th>
              <th className={`${TH} text-emerald-600`}>B/H Neta</th>
              <th className={TH}>Días</th>
            </tr>
          </thead>
          <tbody>
            {people.map(function(p: any) {
              const isExpanded = expandedPerson === p.usuario;
              return (
                <>
                  <tr key={p.usuario} className={`border-b hover:bg-muted/50 cursor-pointer transition-colors ${!p.hasProduction ? "opacity-50" : ""}`}
                    onClick={function() { setExpandedPerson(isExpanded ? null : p.usuario); }}>
                    <td className={`${TD_LEFT} font-medium sticky left-0 bg-card`}>
                      <div className="flex items-center gap-1">
                        {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                        <span className="truncate">{p.nombre}</span>
                      </div>
                    </td>
                    <td className={`${TD} font-mono`}>{p.usuario}</td>
                    <td className={TD}>
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${jornadaChip(p.jornada)}`}>{jornadaLabel(p.jornada)}</span>
                    </td>
                    <td className={TD}>{p.perfil}</td>
                    <td className={`${TD} ${p.activo === "*" || p.activo === "1" ? "text-emerald-600 font-bold" : "text-muted-foreground"}`}>{p.activo === "*" || p.activo === "1" ? "✓" : "—"}</td>
                    <td className={`${TD_NUM} font-medium`}>{p.totalBultos.toLocaleString("es-AR")}</td>
                    <td className={TD_NUM}>{p.totalHsBrutas}</td>
                    <td className={TD_NUM}>{p.totalTm}</td>
                    <td className={TD_NUM}>{p.totalHsNetas}</td>
                    <td className={`${TD_NUM} font-medium text-blue-600`}>{p.bhBruta}</td>
                    <td className={`${TD_NUM} font-medium text-emerald-600`}>{p.bhNeta}</td>
                    <td className={TD_NUM}>{p.diasTrabajados}</td>
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
            <tr className={TR_FOOT}>
              <td className={`${TD_LEFT} sticky left-0 bg-muted/40`}>TOTAL</td>
              <td className={TD}></td>
              <td className={TD}></td>
              <td className={TD}></td>
              <td className={TD}></td>
              <td className={`${TD_NUM} font-bold`}>{(summary.totalBultos ?? 0).toLocaleString("es-AR")}</td>
              <td className={`${TD_NUM} font-bold`}>{summary.totalHsBrutas ?? 0}</td>
              <td className={TD}></td>
              <td className={`${TD_NUM} font-bold`}>{summary.totalHsNetas ?? 0}</td>
              <td className={`${TD_NUM} font-bold text-blue-600`}>{summary.bhBruta ?? 0}</td>
              <td className={`${TD_NUM} font-bold text-emerald-600`}>{summary.bhNeta ?? 0}</td>
              <td className={TD}></td>
            </tr>
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}
