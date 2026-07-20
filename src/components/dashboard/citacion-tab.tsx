"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "./print-button";
import { Target } from "lucide-react";
import React from "react";

const THRESHOLDS = Array.from({ length: 24 }, (_, i) => 85 + i * 5); // 85,90,95,...,200

function cellColor(value: number): string {
  if (value <= 0) return "";
  if (value >= 85) return "bg-emerald-500 text-white font-bold";
  if (value >= 80) return "bg-amber-400 text-amber-950 font-semibold";
  return "bg-red-500 text-white font-bold";
}

function cellColorLight(value: number): string {
  if (value <= 0) return "";
  if (value >= 85) return "bg-emerald-100 text-emerald-800 font-bold";
  if (value >= 80) return "bg-amber-100 text-amber-800 font-semibold";
  return "bg-red-100 text-red-800 font-bold";
}

function formatArgDate(d: number): string {
  const s = String(d);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}`;
}

interface CitacionTabProps {
  baseQuery: string;
  showTipoFilter?: boolean;
}

const EFECTIVO_LIMIT = 10247;

function getTipo(operario: string): string {
  const num = parseInt(operario.replace(/\D/g, ""), 10);
  return num > 0 && num < EFECTIVO_LIMIT ? "EFECTIVO" : "EVENTUAL";
}

export function CitacionTab({ baseQuery, showTipoFilter }: CitacionTabProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [threshold, setThreshold] = useState(85);
  const [tipoFilter, setTipoFilter] = useState<string>("");

  const fetchData = useCallback(() => {
    setError(false);
    const base = baseQuery ? `?${baseQuery}` : "";
    fetch(`/api/production/citacion${base}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [baseQuery]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedOperators = useMemo(() => {
    if (!data) return [];
    const lo = threshold - 4;
    const hi = threshold >= 200 ? Infinity : threshold + 4;
    return [...data.operators]
      .filter((a: any) => {
        if (tipoFilter && getTipo(a.operario) !== tipoFilter) return false;
        return a.overallBH >= lo && a.overallBH <= hi;
      })
      .sort((a: any, b: any) => b.overallBH - a.overallBH);
  }, [data, threshold, tipoFilter]);

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
            <CardDescription>Productividad neta por colaborador (B/H Neta)</CardDescription>
          </div>
          {showTipoFilter && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tipo:</span>
              <div className="flex rounded-md border overflow-hidden">
                {["", "EFECTIVO", "EVENTUAL"].map((v) => (
                  <button
                    key={v || "all"}
                    onClick={() => setTipoFilter(v)}
                    className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors border-r last:border-r-0 ${
                      tipoFilter === v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                    }`}
                  >
                    {v || "Todos"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-muted-foreground">Rango:</span>
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="h-7 rounded-md border bg-background px-2 text-xs font-medium"
            >
              {THRESHOLDS.map((t) => (
                <option key={t} value={t}>{t} ({t - 4}{t < 200 ? "-" + (t + 4) : "+"})</option>
              ))}
            </select>
            <div className="flex items-center gap-3 ml-2">
              <span className="flex items-center gap-1 text-[10px]">
                <span className="inline-block w-3 h-3 rounded bg-emerald-500" />
                {">"}= 85
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="inline-block w-3 h-3 rounded bg-amber-400" />
                80–84
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="inline-block w-3 h-3 rounded bg-red-500" />
                {"<"} 80
              </span>
            </div>
          </div>
        </div>
        <PrintButton title="Citación" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[75vh]">
          <table className="w-full text-xs" style={{ minWidth: 700 + dates.length * 52 }}>
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-card">
                <th rowSpan={2} className="text-[10px] font-semibold text-left p-1.5 sticky left-0 bg-card z-20 min-w-[150px] max-w-[200px]">
                  Colaborador
                </th>
                <th rowSpan={2} className="text-[10px] font-semibold text-center p-1 min-w-[40px]">Días</th>
                <th rowSpan={2} className="text-[10px] font-semibold text-center p-1 min-w-[52px]">Hs. Trab.</th>
                <th rowSpan={2} className="text-[10px] font-semibold text-center p-1 text-red-500 min-w-[42px]">TM (hs)</th>
                <th rowSpan={2} className="text-[10px] font-semibold text-center p-1 min-w-[60px]">Bultos</th>
                <th rowSpan={2} className="text-[10px] font-bold text-center p-1 min-w-[60px]">B/H Neta</th>
                {dates.map((d) => (
                  <th key={d} className="text-[10px] font-semibold text-center p-1 border-l min-w-[52px]">
                    {formatArgDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedOperators.map((op: any) => {
                const daysWorked = (op.days as any[]).filter((d: any) => d.brutas > 0).length;
                return (
                  <tr key={op.operario} className="border-b hover:bg-muted/30">
                    <td className="text-[11px] font-medium p-1.5 sticky left-0 bg-card z-10">
                      <span className="truncate block">{op.nombre}</span>
                      <span className={`text-[8px] font-semibold ${getTipo(op.operario) === "EFECTIVO" ? "text-emerald-600" : "text-blue-600"}`}>
                        ({getTipo(op.operario)})
                      </span>
                    </td>
                    <td className="text-[11px] text-center p-1">{daysWorked}</td>
                    <td className="text-[11px] text-center p-1">{op.totalBrutas}</td>
                    <td className="text-[11px] text-center p-1 text-red-600">{op.totalTM}</td>
                    <td className="text-[11px] text-center p-1 font-medium">{op.totalBultos.toLocaleString("es-AR")}</td>
                    <td className={`text-[11px] text-center p-1 ${cellColor(op.overallBH)}`}>
                      {op.overallBH}
                    </td>
                    {dates.map((d: number) => {
                      const day = (op.days as any[]).find((dd: any) => dd.date === d);
                      const bh = day?.bhNeta || 0;
                      return (
                        <td
                          key={`${op.operario}-${d}`}
                          className={`text-[10px] text-center p-1 border-l ${bh > 0 ? cellColorLight(bh) : ""}`}
                        >
                          {bh > 0 ? bh : ""}
                        </td>
                      );
                    })}
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