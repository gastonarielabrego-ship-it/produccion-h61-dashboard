"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Flame, Users, BarChart3, CalendarDays } from "lucide-react";
import { PrintButton } from "./print-button";
import { ExcelButton } from "./excel-button";
import { MonthlySummary } from "./monthly-summary";
import { SectionCard, ErrorState, TabSkeleton, TH, TH_LEFT, TD, TD_LEFT, TD_NUM, TR_FOOT } from "./ui-kit";

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
    <SectionCard
      icon={BarChart3}
      title="Métricas Diarias"
      description="Resumen por día con descuento de tiempos muertos"
      tone="sky"
      contentClassName="p-0 overflow-x-auto"
      actions={
        <>
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
        </>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className={`${TH_LEFT} sticky left-0 bg-muted/40 min-w-[70px]`}>Día</th>
            <th className={`${TH} min-w-[75px]`}>{operatorName || "Misiones"}</th>
            <th className={`${TH} min-w-[90px]`}>Bultos</th>
            <th className={`${TH} min-w-[80px]`}>Hs. Brutas</th>
            <th className={`${TH} min-w-[75px] text-red-600`}>TM (hs)</th>
            <th className={`${TH} min-w-[80px]`}>Hs. Netas</th>
            <th className={`${TH} min-w-[85px]`}>Prod.</th>
            <th className={`${TH} min-w-[85px] text-sky-600`}>B/H Bruta</th>
            <th className={`${TH} min-w-[85px] text-sky-600`}>B/H Neta</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date} className="border-b hover:bg-muted/50">
              <td className={`${TD_LEFT} font-medium sticky left-0 bg-card`}>{formatArgDate(row.date)}</td>
              <td className={TD}>{operatorName || row.misiones}</td>
              <td className={`${TD_NUM} font-medium`}>{row.bultos.toLocaleString("es-AR")}</td>
              <td className={TD_NUM}>{row.horasProductivas}</td>
              <td className={`${TD_NUM} text-red-600 font-medium`}>{row.tmHoras || 0}</td>
              <td className={`${TD_NUM} font-medium`}>{row.horasNetas}</td>
              <td className={`${TD_NUM} font-medium text-emerald-600`}>{row.produccion}</td>
              <td className={`${TD_NUM} text-sky-600`}>{row.bultosPorHoraBruta}</td>
              <td className={`${TD_NUM} font-bold text-sky-600`}>{row.bultosPorHoraNeta}</td>
            </tr>
          ))}
          <tr className={TR_FOOT}>
            <td className={`${TD_LEFT} sticky left-0 bg-muted/40`}>TOTAL</td>
            <td className={`${TD} font-bold`}>{operatorName || totals.misiones}</td>
            <td className={`${TD_NUM} font-bold`}>{totals.bultos.toLocaleString("es-AR")}</td>
            <td className={`${TD_NUM} font-bold`}>{totals.horasProductivas}</td>
            <td className={`${TD_NUM} font-bold text-red-600`}>{totals.tmHoras}</td>
            <td className={`${TD_NUM} font-bold`}>{totals.horasNetas}</td>
            <td className={`${TD_NUM} font-bold text-emerald-600`}>{totals.produccion}</td>
            <td className={`${TD_NUM} font-bold text-sky-600`}>{totals.bultosPorHoraBruta}</td>
            <td className={`${TD_NUM} font-bold text-sky-600`}>{totals.bultosPorHoraNeta}</td>
          </tr>
        </tbody>
      </table>
    </SectionCard>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function HeatmapTable({ title, description, icon, data, isCollaborator, isMonthly, printTitle, operatorName }: {
  title: string; description: string; icon: typeof Flame;
  data: Record<string, any>[]; isCollaborator?: boolean; isMonthly?: boolean; printTitle: string;
  operatorName?: string | null;
}) {
  const maxVal = useMemo(() => {
    let m = 0;
    for (const row of data) { for (const h of HOURS) { const v = Number(row[String(h)]) || 0; if (v > m) m = v; } }
    return m;
  }, [data]);

  const rowId = (row: any) => isCollaborator ? String(row.operario) : isMonthly ? String(row.month) : String(row.date);
  const rowLabel = (row: any) =>
    isCollaborator ? `${row.nombre} (${row.operario})` : isMonthly ? String(row.label) : formatArgDate(Number(row.date));
  const labelHeader = isCollaborator ? "Colaborador / Hora" : isMonthly ? "Mes / Hora" : "Día / Hora";

  return (
    <SectionCard
      icon={icon}
      title={title}
      description={description}
      tone={isMonthly ? "violet" : isCollaborator ? "sky" : "amber"}
      contentClassName="p-0"
      actions={
        <>
          <ExcelButton
            rows={data.map((row: any) => {
              const r: Record<string, any> = {
                [isCollaborator ? "Colaborador" : isMonthly ? "Mes" : "Dia"]: rowLabel(row),
              };
              if (operatorName && !isCollaborator && !isMonthly) r["Colaborador"] = operatorName;
              let t = 0;
              for (const h of HOURS) { const v = Number(row[String(h)]) || 0; r[String(h)] = v; t += v; }
              r["Total"] = t;
              return r;
            })}
            filename={isMonthly ? "mapa-calor-mes" : isCollaborator ? "mapa-calor-colaborador" : "mapa-calor-dia"}
            sheetName={isMonthly ? "Mensual" : isCollaborator ? "Colaborador" : "Dia"}
            colWidths={[30, ...HOURS.map(() => 8), 10]}
          />
          <PrintButton title={printTitle} />
        </>
      }
    >
      <div className={`overflow-auto ${isCollaborator ? "max-h-[600px]" : ""}`}>
        <table className="w-full text-sm" style={{ minWidth: 900 }}>
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-card">
              <th className={`${TH_LEFT} sticky left-0 bg-card z-20 min-w-[140px] max-w-[260px]`}>{labelHeader}</th>
              {operatorName && !isCollaborator && !isMonthly && (
                <th className={`${TH_LEFT} min-w-[120px]`}>Colaborador</th>
              )}
              {HOURS.map((h) => (
                <th key={h} className={`${TH} min-w-[38px] ${(h === 10 || h === 14 || h === 18 || h === 22) ? "text-amber-600" : ""}`}>{h}</th>
              ))}
              <th className={`${TH} min-w-[55px] sticky right-0 bg-card z-20`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              let rowTotal = 0;
              for (const h of HOURS) rowTotal += Number(row[String(h)]) || 0;
              return (
                <tr key={rowId(row)} className="border-b hover:bg-muted/50">
                  <td className={`${TD_LEFT} font-medium sticky left-0 bg-card z-10 max-w-[140px] truncate`}>{rowLabel(row)}</td>
                  {operatorName && !isCollaborator && !isMonthly && (
                    <td className={`${TD_LEFT} text-muted-foreground truncate`}>{operatorName}</td>
                  )}
                  {HOURS.map((h) => {
                    const val = Number(row[String(h)]) || 0;
                    return (
                      <td
                        key={h}
                        title={`${rowLabel(row)} — ${h}:00 hs — ${val.toLocaleString("es-AR")} bultos`}
                        className={`text-[10px] text-center p-1 min-w-[38px] tabular-nums ${heatColor(val, maxVal)}`}
                      >
                        {val > 0 ? val : ""}
                      </td>
                    );
                  })}
                  <td className={`${TD_NUM} font-semibold sticky right-0 bg-card z-10`}>{rowTotal.toLocaleString("es-AR")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export function SummaryTab({ baseQuery, apiBase = "/api/production" }: SummaryTabProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const fetchData = useCallback(() => {
    setError(false);
    const base = baseQuery ? `?${baseQuery}` : "";
    // Single API call — monthlyData + monthHeatmap are included in the response
    fetch(`/api/production/summary-tables${base}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [baseQuery]);
  useEffect(() => { fetchData(); }, [fetchData]);

  if (error) return <ErrorState message="Error al cargar los datos del resumen." onRetry={fetchData} />;
  if (!data) return <TabSkeleton rows={4} />;

  return (
    <div className="space-y-5">
      {/* MonthlySummary now receives data as prop — no separate API call */}
      <MonthlySummary monthlyData={data.monthlyData || []} />
      <DailyMetricsTable data={data.dailyMetrics} operatorName={data.filteredOperatorName} />
      <HeatmapTable title="Mapa de Calor por Día" description="Horas más y menos productivas por día — cantidad de bultos" icon={Flame} data={data.dayHeatmap} printTitle="Mapa de Calor por Día" operatorName={data.filteredOperatorName} />
      <HeatmapTable title="Mapa de Calor por Mes" description="Productividad horaria acumulada de cada mes — cantidad de bultos" icon={CalendarDays} data={data.monthHeatmap || []} isMonthly printTitle="Mapa de Calor por Mes" />
      <HeatmapTable title="Mapa de Calor por Colaborador" description="Distribución horaria de cada colaborador — cantidad de bultos" icon={Users} data={data.collaboratorHeatmap} isCollaborator printTitle="Mapa de Calor por Colaborador" />
    </div>
  );
}
