"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Users, BarChart3 } from "lucide-react";
import { PrintButton } from "./print-button";
import { ExcelButton } from "./excel-button";
import { MonthlySummary } from "./monthly-summary";

interface SummaryTabProps {
  baseQuery: string;
  apiBase?: string;
}

function heatColor(value: number, max: number): string {
  if (value === 0) return "";
  const ratio = max > 0 ? value / max : 0;
  if (ratio > 0.75) return "bg-green-600 text-white";
  if (ratio > 0.55) return "bg-green-400 text-green-950";
  if (ratio > 0.4) return "bg-lime-400 text-lime-950";
  if (ratio > 0.25) return "bg-yellow-300 text-yellow-950";
  if (ratio > 0.12) return "bg-amber-400 text-amber-950";
  if (ratio > 0.05) return "bg-orange-400 text-white";
  return "bg-red-500 text-white";
}

function formatArgDate(d: number): string {
  const s = String(d);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}`;
}

function DailyMetricsTable({ data, operatorName }: { data: any[]; operatorName?: string | null }) {
  const totals = useMemo(() => {
    let m = 0, b = 0, hb = 0, tm = 0;
    for (const r of data) { m += r.misiones; b += r.bultos; hb += r.horasProductivas; tm += r.tmHoras || 0; }
    const hn = Math.round((hb - tm) * 100) / 100;
    return {
      misiones: m, bultos: b, horasProductivas: hb, tmHoras: Math.round(tm * 100) / 100, horasNetas: hn,
      produccion: m > 0 ? Math.round((b / m) * 10) / 10 : 0,
      bultosPorHoraBruta: hb > 0 ? Math.round((b / hb) * 10) / 10 : 0,
      bultosPorHoraNeta: hn > 0 ? Math.round((b / hn) * 10) / 10 : 0,
    };
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" />Métricas Diarias</CardTitle>
          <CardDescription>Resumen por día con descuento de tiempos muertos</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <ExcelButton
            rows={[
              ...data.map((row: any) => ({
                Dia: formatArgDate(row.date),
                [operatorName || "Misiones"]: operatorName || row.misiones,
                Bultos: row.bultos,
                "Hs. Brutas": row.horasProductivas,
                "TM (hs)": row.tmHoras || 0,
                "Hs. Netas": row.horasNetas,
                Produccion: row.produccion,
                "B/H Bruta": row.bultosPorHoraBruta,
                "B/H Neta": row.bultosPorHoraNeta,
              })),
              {
                Dia: "TOTAL",
                [operatorName || "Misiones"]: operatorName || totals.misiones,
                Bultos: totals.bultos,
                "Hs. Brutas": totals.horasProductivas,
                "TM (hs)": totals.tmHoras,
                "Hs. Netas": totals.horasNetas,
                Produccion: totals.produccion,
                "B/H Bruta": totals.bultosPorHoraBruta,
                "B/H Neta": totals.bultosPorHoraNeta,
              },
            ]}
            filename="metricas-diarias"
            sheetName="Diarias"
            colWidths={[12, 14, 12, 12, 10, 12, 10, 12, 12]}
          />
          <PrintButton title="Métricas Diarias" />
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[70px]">Día</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[75px]">{operatorName || "Misiones"}</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[90px]">Bultos</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[80px]">Hs. Brutas</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[75px] text-red-600">TM (hs)</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[80px]">Hs. Netas</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[85px]">Prod.</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[85px]">B/H Bruta</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[85px]">B/H Neta</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.date} className="border-b hover:bg-muted/50">
                <td className="text-xs font-medium p-2 sticky left-0 bg-card">{formatArgDate(row.date)}</td>
                <td className="text-xs text-center p-2">{operatorName || row.misiones}</td>
                <td className="text-xs text-center font-medium p-2">{row.bultos.toLocaleString("es-AR")}</td>
                <td className="text-xs text-center p-2">{row.horasProductivas}</td>
                <td className="text-xs text-center p-2 text-red-600 font-medium">{row.tmHoras || 0}</td>
                <td className="text-xs text-center p-2 font-medium">{row.horasNetas}</td>
                <td className="text-xs text-center font-medium text-emerald-600 p-2">{row.produccion}</td>
                <td className="text-xs text-center p-2 text-sky-600">{row.bultosPorHoraBruta}</td>
                <td className="text-xs text-center font-bold text-sky-600 p-2">{row.bultosPorHoraNeta}</td>
              </tr>
            ))}
            <tr className="border-t-2 font-bold bg-muted/30">
              <td className="text-xs font-bold p-2 sticky left-0 bg-muted/30">TOTAL</td>
              <td className="text-xs text-center font-bold p-2">{operatorName || totals.misiones}</td>
              <td className="text-xs text-center font-bold p-2">{totals.bultos.toLocaleString("es-AR")}</td>
              <td className="text-xs text-center font-bold p-2">{totals.horasProductivas}</td>
              <td className="text-xs text-center font-bold p-2 text-red-600">{totals.tmHoras}</td>
              <td className="text-xs text-center font-bold p-2">{totals.horasNetas}</td>
              <td className="text-xs text-center font-bold text-emerald-600 p-2">{totals.produccion}</td>
              <td className="text-xs text-center font-bold text-sky-600 p-2">{totals.bultosPorHoraBruta}</td>
              <td className="text-xs text-center font-bold text-sky-600 p-2">{totals.bultosPorHoraNeta}</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function HeatmapTable({ title, description, icon: Icon, data, isCollaborator, printTitle, operatorName }: {
  title: string; description: string; icon: typeof Flame;
  data: Record<string, string | number>[]; isCollaborator?: boolean; printTitle: string;
  operatorName?: string | null;
}) {
  const maxVal = useMemo(() => {
    let m = 0;
    for (const row of data) { for (const h of HOURS) { const v = Number(row[String(h)]) || 0; if (v > m) m = v; } }
    return m;
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" />{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <ExcelButton
            rows={data.map((row: any) => {
              const r: Record<string, any> = {
                [isCollaborator ? "Colaborador" : "Dia"]: isCollaborator
                  ? `${row.nombre} (${row.operario})`
                  : formatArgDate(Number(row.date)),
              };
              if (operatorName && !isCollaborator) r["Colaborador"] = operatorName;
              let t = 0;
              for (const h of HOURS) { const v = Number(row[String(h)]) || 0; r[String(h)] = v; t += v; }
              r["Total"] = t;
              return r;
            })}
            filename={isCollaborator ? "mapa-calor-colaborador" : "mapa-calor-dia"}
            sheetName={isCollaborator ? "Colaborador" : "Dia"}
            colWidths={[30, ...HOURS.map(() => 8), 10]}
          />
          <PrintButton title={printTitle} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className={`overflow-auto ${isCollaborator ? "max-h-[600px]" : ""}`}>
          <table className="w-full text-sm" style={{ minWidth: 900 }}>
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-card">
                <th className="text-[10px] font-semibold text-left p-1 sticky left-0 bg-card z-20 min-w-[140px] max-w-[260px]">
                  {isCollaborator ? "Colaborador / Hora" : "Día / Hora"}
                </th>
                {operatorName && !isCollaborator && (
                  <th className="text-[10px] font-semibold text-left p-1 min-w-[120px]">Colaborador</th>
                )}
                {HOURS.map((h) => (
                  <th key={h} className={`text-[10px] font-semibold text-center p-1 min-w-[38px] ${(h === 10 || h === 14 || h === 18 || h === 22) ? "text-amber-600 bg-amber-50" : ""}`}>{h}</th>
                ))}
                <th className="text-[10px] font-semibold text-center p-1 min-w-[55px] sticky right-0 bg-card z-20">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                let rowTotal = 0;
                for (const h of HOURS) rowTotal += Number(row[String(h)]) || 0;
                const id = isCollaborator ? String(row.operario) : String(row.date);
                const label = isCollaborator ? `${row.nombre} (${row.operario})` : formatArgDate(Number(row.date));
                return (
                  <tr key={id} className="border-b hover:bg-muted/50">
                    <td className="text-[11px] font-medium p-1 sticky left-0 bg-card z-10 max-w-[140px] truncate">{label}</td>
                    {operatorName && !isCollaborator && (
                      <td className="text-[11px] p-1 text-muted-foreground truncate">{operatorName}</td>
                    )}
                    {HOURS.map((h) => {
                      const val = Number(row[String(h)]) || 0;
                      return <td key={h} className={`text-[10px] text-center p-1 min-w-[38px] ${heatColor(val, maxVal)}`}>{val > 0 ? val : ""}</td>;
                    })}
                    <td className="text-[11px] text-center font-semibold p-1 min-w-[55px] sticky right-0 bg-card z-10">{rowTotal.toLocaleString("es-AR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryTab({ baseQuery, apiBase = "/api/production" }: SummaryTabProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const fetchData = useCallback(() => {
    setError(false);
    const base = baseQuery ? `?${baseQuery}` : "";
    fetch(`/api/production/summary-tables${base}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [baseQuery]);
  useEffect(() => { fetchData(); }, [fetchData]);

  if (error) return (
    <Card><CardContent className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Error al cargar los datos.</p>
      <button onClick={fetchData} className="mt-2 text-xs text-primary underline">Reintentar</button>
    </CardContent></Card>
  );
  if (!data) return (
    <div className="space-y-6">{[1, 2, 3].map((i) => (
      <Card key={i}><CardContent className="p-4 h-[200px] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </CardContent></Card>
    ))}</div>
  );

  return (
    <div className="space-y-6">
      <MonthlySummary baseQuery={baseQuery} />
      <DailyMetricsTable data={data.dailyMetrics} operatorName={data.filteredOperatorName} />
      <HeatmapTable title="Mapa de Calor por Día" description="Horas más y menos productivas por día — cantidad de bultos" icon={Flame} data={data.dayHeatmap} printTitle="Mapa de Calor por Día" operatorName={data.filteredOperatorName} />
      <HeatmapTable title="Mapa de Calor por Colaborador" description="Distribución horaria de cada colaborador — cantidad de bultos" icon={Users} data={data.collaboratorHeatmap} isCollaborator printTitle="Mapa de Calor por Colaborador" />
    </div>
  );
}