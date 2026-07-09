"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Flame, Users, BarChart3 } from "lucide-react";

interface SummaryTabProps {
  baseQuery: string;
  funcionFilter?: string;
}

// ── Color scale for heatmap (traffic light) ────────────
function heatColor(value: number, max: number): string {
  if (value === 0) return "bg-transparent";
  const ratio = max > 0 ? value / max : 0;
  if (ratio > 0.75) return "bg-red-600 text-white";
  if (ratio > 0.55) return "bg-orange-500 text-white";
  if (ratio > 0.4) return "bg-amber-400 text-amber-950";
  if (ratio > 0.25) return "bg-yellow-300 text-yellow-950";
  if (ratio > 0.12) return "bg-lime-300 text-lime-950";
  if (ratio > 0.05) return "bg-green-300 text-green-950";
  return "bg-green-200 text-green-900";
}

function formatArgDate(d: number): string {
  // date is YYYYMMDD number
  const s = String(d);
  const day = s.slice(6, 8);
  const month = s.slice(4, 6);
  return `${day}/${month}`;
}

// ── Daily Metrics Table ────────────────────────────────
function DailyMetricsTable({ data }: { data: any[] }) {
  const totals = useMemo(() => {
    let m = 0, b = 0, h = 0;
    for (const r of data) { m += r.misiones; b += r.bultos; h += r.horasProductivas; }
    return {
      misiones: m,
      bultos: b,
      horasProductivas: h,
      produccion: m > 0 ? Math.round((b / m) * 10) / 10 : 0,
      bultosPorHora: h > 0 ? Math.round((b / h) * 10) / 10 : 0,
    };
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Métricas Diarias
        </CardTitle>
        <CardDescription>
          Resumen por día: misiones, bultos y productividad
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold sticky left-0 bg-background z-10 min-w-[70px]">Día</TableHead>
                <TableHead className="text-xs font-semibold text-center min-w-[80px]">Misiones</TableHead>
                <TableHead className="text-xs font-semibold text-center min-w-[100px]">Bultos Prep.</TableHead>
                <TableHead className="text-xs font-semibold text-center min-w-[90px]">Hs. Productivas</TableHead>
                <TableHead className="text-xs font-semibold text-center min-w-[90px]">Producción</TableHead>
                <TableHead className="text-xs font-semibold text-center min-w-[90px]">Bultos/Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.date} className="hover:bg-muted/50">
                  <TableCell className="text-xs font-medium sticky left-0 bg-background z-10">
                    {formatArgDate(row.date)}
                  </TableCell>
                  <TableCell className="text-xs text-center">{row.misiones}</TableCell>
                  <TableCell className="text-xs text-center font-medium">{row.bultos.toLocaleString("es-AR")}</TableCell>
                  <TableCell className="text-xs text-center">{row.horasProductivas}</TableCell>
                  <TableCell className="text-xs text-center font-medium text-emerald-600">{row.produccion}</TableCell>
                  <TableCell className="text-xs text-center font-medium text-sky-600">{row.bultosPorHora}</TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="border-t-2 font-bold hover:bg-transparent bg-muted/30">
                <TableCell className="text-xs font-bold sticky left-0 bg-muted/30 z-10">TOTAL</TableCell>
                <TableCell className="text-xs text-center font-bold">{totals.misiones}</TableCell>
                <TableCell className="text-xs text-center font-bold">{totals.bultos.toLocaleString("es-AR")}</TableCell>
                <TableCell className="text-xs text-center font-bold">{totals.horasProductivas}</TableCell>
                <TableCell className="text-xs text-center font-bold text-emerald-600">{totals.produccion}</TableCell>
                <TableCell className="text-xs text-center font-bold text-sky-600">{totals.bultosPorHora}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ── Heatmap Component (shared for day & collaborator) ──
function HeatmapTable({
  title,
  description,
  icon: Icon,
  data,
  rowLabelKey,
  rowLabelFn,
  getRowId,
}: {
  title: string;
  description: string;
  icon: typeof Flame;
  data: Record<string, string | number>[];
  rowLabelKey: string;
  rowLabelFn: (row: Record<string, string | number>) => string;
  getRowId: (row: Record<string, string | number>) => string;
  tall?: boolean;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const maxVal = useMemo(() => {
    let m = 0;
    for (const row of data) {
      for (const h of hours) {
        const v = Number(row[String(h)]) || 0;
        if (v > m) m = v;
      }
    }
    return m;
  }, [data, hours]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={tall ? "w-full max-h-[600px]" : "w-full"}>
          <div className="min-w-[900px]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold sticky left-0 bg-background z-10 min-w-[140px] max-w-[140px]">
                    {rowLabelKey === "operario" ? "Colaborador / Hora" : "Día / Hora"}
                  </TableHead>
                  {hours.map((h) => (
                    <TableHead
                      key={h}
                      className={`text-[10px] font-semibold text-center min-w-[40px] px-1 ${
                        (h === 10 || h === 14 || h === 18 || h === 22)
                          ? "text-amber-600 bg-amber-50"
                          : ""
                      }`}
                    >
                      {h}
                    </TableHead>
                  ))}
                  <TableHead className="text-[10px] font-semibold text-center min-w-[60px] bg-background sticky right-0 z-10">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => {
                  let rowTotal = 0;
                  for (const h of hours) rowTotal += Number(row[String(h)]) || 0;
                  return (
                    <TableRow key={getRowId(row)} className="hover:bg-muted/50">
                      <TableCell className="text-[11px] font-medium sticky left-0 bg-background z-10 max-w-[140px] truncate">
                        {rowLabelFn(row)}
                      </TableCell>
                      {hours.map((h) => {
                        const val = Number(row[String(h)]) || 0;
                        return (
                          <TableCell
                            key={h}
                            className={`text-[10px] text-center p-1 min-w-[40px] px-0.5 ${heatColor(val, maxVal)}`}
                          >
                            {val > 0 ? val : ""}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-[11px] text-center font-semibold sticky right-0 bg-background z-10">
                        {rowTotal.toLocaleString("es-AR")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ── Main Tab Component ─────────────────────────────────
export function SummaryTab({ baseQuery, funcionFilter }: SummaryTabProps) {
  const [data, setData] = useState<any>(null);

  const fetchData = useCallback(() => {
    const params = new URLSearchParams(baseQuery);
    if (funcionFilter) params.set("funcion", funcionFilter);
    const qs = params.toString();
    const base = qs ? `?${qs}` : "";
    fetch(`/api/production/summary-tables${base}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ dailyMetrics: [], dayHeatmap: [], collaboratorHeatmap: [] }));
  }, [baseQuery, funcionFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!data) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 h-[200px] flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DailyMetricsTable data={data.dailyMetrics} />

      <HeatmapTable
        title="Mapa de Calor por Día"
        description="Horas más y menos productivas por día — cantidad de bultos"
        icon={Flame}
        data={data.dayHeatmap}
        rowLabelKey="date"
        rowLabelFn={(row) => formatArgDate(Number(row.date))}
        getRowId={(row) => String(row.date)}
      />

      <HeatmapTable
        title="Mapa de Calor por Colaborador"
        description="Distribución horaria de cada colaborador — cantidad de bultos"
        icon={Users}
        data={data.collaboratorHeatmap}
        rowLabelKey="operario"
        rowLabelFn={(row) => `${row.nombre} (${row.operario})`}
        getRowId={(row) => String(row.operario)}
        tall
      />
    </div>
  );
}