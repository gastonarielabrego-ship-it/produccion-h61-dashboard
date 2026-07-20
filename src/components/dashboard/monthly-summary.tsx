"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { PrintButton } from "./print-button";
import { ExcelButton } from "./excel-button";

interface MonthlySummaryProps {
  baseQuery: string;
}

function ChangeIndicator({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (value === 0) return <span className="text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />0%</span>;
  if (value > 0) return <span className="text-emerald-600 flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />+{value}%</span>;
  return <span className="text-red-500 flex items-center gap-0.5"><TrendingDown className="h-3 w-3" />{value}%</span>;
}

export function MonthlySummary({ baseQuery }: MonthlySummaryProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  const fetchData = useCallback(() => {
    setError(false);
    const base = baseQuery ? `?${baseQuery}` : "";
    fetch(`/api/production/monthly-summary${base}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [baseQuery]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (error) return (
    <Card><CardContent className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Error al cargar resumen mensual.</p>
      <button onClick={fetchData} className="mt-2 text-xs text-primary underline">Reintentar</button>
    </CardContent></Card>
  );
  if (!data || !data.monthlyData || data.monthlyData.length <= 1) return null;

  const rows = data.monthlyData;

  // Totals
  const totals = rows.reduce((acc: any, r: any) => {
    acc.dias += r.dias; acc.misiones += r.misiones; acc.bultos += r.bultos;
    acc.horasBrutas += r.horasBrutas; acc.tmHoras += r.tmHoras; acc.horasNetas += r.horasNetas;
    return acc;
  }, { dias: 0, misiones: 0, bultos: 0, horasBrutas: 0, tmHoras: 0, horasNetas: 0 });
  totals.produccion = totals.misiones > 0 ? Math.round((totals.bultos / totals.misiones) * 10) / 10 : 0;
  totals.bhBruta = totals.horasBrutas > 0 ? Math.round((totals.bultos / totals.horasBrutas) * 10) / 10 : 0;
  totals.bhNeta = totals.horasNetas > 0 ? Math.round((totals.bultos / totals.horasNetas) * 10) / 10 : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Resumen Mensual — Comparativo
          </CardTitle>
          <CardDescription>Acumulado por mes con variación respecto al mes anterior</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <ExcelButton
            rows={[
              ...rows.map((r: any) => ({
                Mes: r.label,
                Dias: r.dias,
                Misiones: r.misiones,
                "Var. Misiones": r.cmpMisiones !== null ? `${r.cmpMisiones > 0 ? "+" : ""}${r.cmpMisiones}%` : "-",
                Bultos: r.bultos,
                "Var. Bultos": r.cmpBultos !== null ? `${r.cmpBultos > 0 ? "+" : ""}${r.cmpBultos}%` : "-",
                "Hs. Brutas": r.horasBrutas,
                "TM (hs)": r.tmHoras || 0,
                "Hs. Netas": r.horasNetas,
                "B/H Bruta": r.bhBruta,
                "Var. B/H": r.cmpBH !== null ? `${r.cmpBH > 0 ? "+" : ""}${r.cmpBH}%` : "-",
                "B/H Neta": r.bhNeta,
              })),
              {
                Mes: "TOTAL",
                Dias: totals.dias,
                Misiones: totals.misiones,
                "Var. Misiones": "-",
                Bultos: totals.bultos,
                "Var. Bultos": "-",
                "Hs. Brutas": totals.horasBrutas,
                "TM (hs)": Math.round(totals.tmHoras * 100) / 100,
                "Hs. Netas": totals.horasNetas,
                "B/H Bruta": totals.bhBruta,
                "Var. B/H": "-",
                "B/H Neta": totals.bhNeta,
              },
            ]}
            filename="resumen-mensual"
            sheetName="Mensual"
            colWidths={[14, 8, 10, 12, 14, 12, 12, 10, 12, 12, 12, 12]}
          />
          <PrintButton title="Resumen Mensual" />
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[120px]">Mes</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[50px]">Días</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[75px]">Misiones</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[70px]">Var.</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[90px]">Bultos</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[70px]">Var.</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[80px]">Hs. Brutas</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[65px]">TM (hs)</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[80px]">Hs. Netas</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[65px]">B/H Bruta</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[70px]">Var.</th>
              <th className="text-xs font-semibold text-center p-2 min-w-[65px]">B/H Neta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any) => (
              <tr key={row.month} className="border-b hover:bg-muted/50">
                <td className="text-xs font-medium p-2 sticky left-0 bg-card">{row.label}</td>
                <td className="text-xs text-center p-2">{row.dias}</td>
                <td className="text-xs text-center p-2">{row.misiones}</td>
                <td className="text-xs text-center p-2"><ChangeIndicator value={row.cmpMisiones} /></td>
                <td className="text-xs text-center font-medium p-2">{row.bultos.toLocaleString("es-AR")}</td>
                <td className="text-xs text-center p-2"><ChangeIndicator value={row.cmpBultos} /></td>
                <td className="text-xs text-center p-2">{row.horasBrutas}</td>
                <td className="text-xs text-center p-2 text-red-600">{row.tmHoras || 0}</td>
                <td className="text-xs text-center p-2 font-medium">{row.horasNetas}</td>
                <td className="text-xs text-center p-2 text-sky-600">{row.bhBruta}</td>
                <td className="text-xs text-center p-2"><ChangeIndicator value={row.cmpBH} /></td>
                <td className="text-xs text-center font-bold text-sky-600 p-2">{row.bhNeta}</td>
              </tr>
            ))}
            <tr className="border-t-2 font-bold bg-muted/30">
              <td className="text-xs font-bold p-2 sticky left-0 bg-muted/30">TOTAL</td>
              <td className="text-xs text-center font-bold p-2">{totals.dias}</td>
              <td className="text-xs text-center font-bold p-2">{totals.misiones}</td>
              <td className="text-xs text-center p-2">—</td>
              <td className="text-xs text-center font-bold p-2">{totals.bultos.toLocaleString("es-AR")}</td>
              <td className="text-xs text-center p-2">—</td>
              <td className="text-xs text-center font-bold p-2">{totals.horasBrutas}</td>
              <td className="text-xs text-center font-bold p-2 text-red-600">{Math.round(totals.tmHoras * 100) / 100}</td>
              <td className="text-xs text-center font-bold p-2">{Math.round(totals.horasNetas * 100) / 100}</td>
              <td className="text-xs text-center font-bold text-sky-600 p-2">{totals.bhBruta}</td>
              <td className="text-xs text-center p-2">—</td>
              <td className="text-xs text-center font-bold text-sky-600 p-2">{totals.bhNeta}</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}