"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Flame, Users, BarChart3 } from "lucide-react";
import { PrintButton } from "./print-button";

interface SummaryTabProps {
  baseQuery: string;
}

// ── Color scale for heatmap (traffic light) ────────────
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
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Métricas Diarias
          </CardTitle>
          <CardDescription>
            Resumen por día: misiones, bultos y productividad
          </CardDescription>
        </div>
        <PrintButton title="Métricas Diarias" />
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[70px]">Día</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[80px]">Misiones</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[100px]">Bultos Prep.</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[90px]">Hs. Productivas</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[90px]">Producción</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[90px]">Bultos/Hora</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.date} className="border-b hover:bg-muted/50">
                <td className="text-xs font-medium p-2 sticky left-0 bg-card">{formatArgDate(row.date)}</td>
                <td className="text-xs text-center p-2">{row.misiones}</td>
                <td className="text-xs text-center font-medium p-2">{row.bultos.toLocaleString("es-AR")}</td>
                <td className="text-xs text-center p-2">{row.horasProductivas}</td>
                <td className="text-xs text-center font-medium text-emerald-600 p-2">{row.produccion}</td>
                <td className="text-xs text-center font-medium text-sky-600 p-2">{row.bultosPorHora}</td>
              </tr>
            ))}
            <tr className="border-t-2 font-bold bg-muted/30">
              <td className="text-xs font-bold p-2 sticky left-0 bg-muted/30">TOTAL</td>
              <td className="text-xs text-center font-bold p-2">{totals.misiones}</td>
              <td className="text-xs text-center font-bold p-2">{totals.bultos.toLocaleString("es-AR")}</td>
              <td className="text-xs text-center font-bold p-2">{totals.horasProductivas}</td>
              <td className="text-xs text-center font-bold text-emerald-600 p-2">{totals.produccion}</td>
              <td className="text-xs text-center font-bold text-sky-600 p-2">{totals.bultosPorHora}</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ── Heatmap Component ──────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function HeatmapTable({
  title,
  description,
  icon: Icon,
  data,
  isCollaborator,
  printTitle,
}: {
  title: string;
  description: string;
  icon: typeof Flame;
  data: Record<string, string | number>[];
  isCollaborator?: boolean;
  printTitle: string;
}) {
  const maxVal = useMemo(() => {
    let m = 0;
    for (const row of data) {
      for (const h of HOURS) {
        const v = Number(row[String(h)]) || 0;
        if (v > m) m = v;
      }
    }
    return m;
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <PrintButton title={printTitle} />
      </CardHeader>
      <CardContent className="p-0">
        <div className={`overflow-auto ${isCollaborator ? "max-h-[600px]" : ""}`}>
          <table className="w-full text-sm" style={{ minWidth: 900 }}>
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-card">
                <th className="text-[10px] font-semibold text-left p-1 sticky left-0 bg-card z-20 min-w-[140px] max-w-[140px]">
                  {isCollaborator ? "Colaborador / Hora" : "Día / Hora"}
                </th>
                {HOURS.map((h) => (
                  <th
                    key={h}
                    className={`text-[10px] font-semibold text-center p-1 min-w-[38px] ${
                      (h === 10 || h === 14 || h === 18 || h === 22)
                        ? "text-amber-600 bg-amber-50"
                        : ""
                    }`}
                  >
                    {h}
                  </th>
                ))}
                <th className="text-[10px] font-semibold text-center p-1 min-w-[55px] sticky right-0 bg-card z-20">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                let rowTotal = 0;
                for (const h of HOURS) rowTotal += Number(row[String(h)]) || 0;
                const id = isCollaborator ? String(row.operario) : String(row.date);
                const label = isCollaborator
                  ? `${row.nombre} (${row.operario})`
                  : formatArgDate(Number(row.date));
                return (
                  <tr key={id} className="border-b hover:bg-muted/50">
                    <td className="text-[11px] font-medium p-1 sticky left-0 bg-card z-10 max-w-[140px] truncate">
                      {label}
                    </td>
                    {HOURS.map((h) => {
                      const val = Number(row[String(h)]) || 0;
                      return (
                        <td
                          key={h}
                          className={`text-[10px] text-center p-1 min-w-[38px] ${heatColor(val, maxVal)}`}
                        >
                          {val > 0 ? val : ""}
                        </td>
                      );
                    })}
                    <td className="text-[11px] text-center font-semibold p-1 min-w-[55px] sticky right-0 bg-card z-10">
                      {rowTotal.toLocaleString("es-AR")}
                    </td>
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

// ── Main Tab Component ─────────────────────────────────
export function SummaryTab({ baseQuery }: SummaryTabProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  const fetchData = useCallback(() => {
    setError(false);
    const base = baseQuery ? `?${baseQuery}` : "";
    fetch(`/api/production/summary-tables${base}`)
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true));
  }, [baseQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Error al cargar los datos.</p>
          <button
            onClick={fetchData}
            className="mt-2 text-xs text-primary underline"
          >
            Reintentar
          </button>
        </CardContent>
      </Card>
    );
  }

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
        printTitle="Mapa de Calor por Día"
      />

      <HeatmapTable
        title="Mapa de Calor por Colaborador"
        description="Distribución horaria de cada colaborador — cantidad de bultos"
        icon={Users}
        data={data.collaboratorHeatmap}
        isCollaborator
        printTitle="Mapa de Calor por Colaborador"
      />

    </div>
  );
}