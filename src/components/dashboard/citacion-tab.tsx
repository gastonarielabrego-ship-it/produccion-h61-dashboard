"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "./print-button";
import { Target } from "lucide-react";

const THRESHOLDS = [85, 90, 95, 100];

function bhColor(value: number, threshold: number): string {
  if (value >= threshold) return "bg-emerald-500 text-white font-bold";
  if (value >= threshold - 5) return "bg-amber-400 text-amber-950 font-semibold";
  return "bg-red-500 text-white font-bold";
}

function bhColorMuted(value: number, threshold: number): string {
  if (value >= threshold) return "text-emerald-700 font-bold";
  if (value >= threshold - 5) return "text-amber-600 font-semibold";
  return "text-red-600 font-bold";
}

function formatArgDate(d: number): string {
  const s = String(d);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}`;
}

interface CitacionTabProps {
  baseQuery: string;
}

export function CitacionTab({ baseQuery }: CitacionTabProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [threshold, setThreshold] = useState(95);

  const fetchData = useCallback(() => {
    setError(false);
    const base = baseQuery ? `?${baseQuery}` : "";
    fetch(`/api/production/citacion${base}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [baseQuery]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sort operators by overallBH descending
  const sortedOperators = useMemo(() => {
    if (!data) return [];
    return [...data.operators].sort((a: any, b: any) => b.overallBH - a.overallBH);
  }, [data]);

  if (error) return (
    <Card><CardContent className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Error al cargar los datos.</p>
      <button onClick={fetchData} className="mt-2 text-xs text-primary underline">Reintentar</button>
    </CardContent></Card>
  );
  if (!data) return (
    <div className="space-y-6">{[1, 2].map((i) => (
      <Card key={i}><CardContent className="p-4 h-[200px] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </CardContent></Card>
    ))}</div>
  );

  const dates = data.dates as number[];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Citación
            </CardTitle>
            <CardDescription>Productividad neta por colaborador y día (B/H Neta)</CardDescription>
          </div>
          {/* Threshold selector */}
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-muted-foreground">B/H meta:</span>
            <div className="flex rounded-lg border overflow-hidden">
              {THRESHOLDS.map((t) => (
                <button
                  key={t}
                  onClick={() => setThreshold(t)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0 ${
                    threshold === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 ml-2">
              <span className="flex items-center gap-1 text-[10px]">
                <span className="inline-block w-3 h-3 rounded bg-emerald-500" />
                {">"}= {threshold}
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="inline-block w-3 h-3 rounded bg-amber-400" />
                {threshold - 5}–{threshold - 1}
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="inline-block w-3 h-3 rounded bg-red-500" />
                {"<"} {threshold - 5}
              </span>
            </div>
          </div>
        </div>
        <PrintButton title="Citación" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[75vh]">
          <table className="w-full text-xs" style={{ minWidth: 600 + dates.length * 100 }}>
            <thead className="sticky top-0 z-10">
              {/* Header row 1: dates spanning 5 columns each */}
              <tr className="border-b bg-card">
                <th rowSpan={2} className="text-[10px] font-semibold text-left p-1.5 sticky left-0 bg-card z-20 min-w-[160px] max-w-[220px]">
                  Colaborador
                </th>
                {dates.map((d) => (
                  <th key={d} colSpan={5} className="text-[10px] font-semibold text-center p-1 border-l bg-muted/40">
                    {formatArgDate(d)}
                  </th>
                ))}
                <th colSpan={5} className="text-[10px] font-bold text-center p-1 border-l sticky right-0 bg-card z-20 bg-emerald-50">
                  TOTAL
                </th>
              </tr>
              {/* Header row 2: sub-columns */}
              <tr className="border-b bg-card">
                {dates.map((d) => (
                  <React.Fragment key={`sub-${d}`}>
                    <th className="text-[9px] font-medium text-center p-0.5 border-l text-muted-foreground min-w-[52px]">Hs.B</th>
                    <th className="text-[9px] font-medium text-center p-0.5 text-red-500 min-w-[42px]">TM</th>
                    <th className="text-[9px] font-medium text-center p-0.5 text-muted-foreground min-w-[52px]">Hs.N</th>
                    <th className="text-[9px] font-medium text-center p-0.5 text-muted-foreground min-w-[58px]">Bultos</th>
                    <th className="text-[9px] font-bold text-center p-0.5 min-w-[58px]">B/H N</th>
                  </React.Fragment>
                ))}
                <th className="text-[9px] font-medium text-center p-0.5 border-l sticky right-0 bg-emerald-50 min-w-[52px]">Hs.B</th>
                <th className="text-[9px] font-medium text-center p-0.5 text-red-500 sticky right-0 bg-emerald-50 min-w-[42px]">TM</th>
                <th className="text-[9px] font-medium text-center p-0.5 sticky right-0 bg-emerald-50 min-w-[52px]">Hs.N</th>
                <th className="text-[9px] font-medium text-center p-0.5 sticky right-0 bg-emerald-50 min-w-[58px]">Bultos</th>
                <th className="text-[9px] font-bold text-center p-0.5 sticky right-0 bg-emerald-50 z-20 min-w-[58px]">B/H N</th>
              </tr>
            </thead>
            <tbody>
              {sortedOperators.map((op: any) => (
                <tr key={op.operario} className="border-b hover:bg-muted/30">
                  <td className="text-[11px] font-medium p-1.5 sticky left-0 bg-card z-10 max-w-[160px] truncate">
                    {op.nombre}
                  </td>
                  {dates.map((d: number) => {
                    const day = (op.days as any[]).find((dd: any) => dd.date === d);
                    const bh = day?.bhNeta || 0;
                    return (
                      <React.Fragment key={`${op.operario}-${d}`}>
                        <td className="text-[10px] text-center p-0.5 border-l">{day?.brutas || 0}</td>
                        <td className="text-[10px] text-center p-0.5 text-red-600">{day?.tmHoras || 0}</td>
                        <td className="text-[10px] text-center p-0.5">{day?.netas || 0}</td>
                        <td className="text-[10px] text-center p-0.5 font-medium">{day?.bultos ? day.bultos.toLocaleString("es-AR") : ""}</td>
                        <td className={`text-[10px] text-center p-0.5 ${bh > 0 ? bhColorMuted(bh, threshold) : "text-muted-foreground"}`}>
                          {bh > 0 ? bh : ""}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  {/* Total row */}
                  <td className="text-[10px] text-center p-0.5 border-l font-medium sticky right-0 bg-muted/20">{op.totalBrutas}</td>
                  <td className="text-[10px] text-center p-0.5 text-red-600 font-medium sticky right-0 bg-muted/20">{op.totalTM}</td>
                  <td className="text-[10px] text-center p-0.5 font-medium sticky right-0 bg-muted/20">{op.totalNetas}</td>
                  <td className="text-[10px] text-center p-0.5 font-bold sticky right-0 bg-muted/20">{op.totalBultos.toLocaleString("es-AR")}</td>
                  <td className={`text-[10px] text-center p-1 font-bold sticky right-0 z-10 ${bhColor(op.overallBH, threshold)}`}>
                    {op.overallBH}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// Need React for Fragment in the table
import React from "react";