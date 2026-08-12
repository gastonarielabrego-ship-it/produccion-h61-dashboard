"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Clock, Calculator } from "lucide-react";
import { PrintButton } from "./print-button";
import { ExcelButton } from "./excel-button";

interface HorasExtrasTabProps {
  baseQuery: string;
}

function ChangeIndicator({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (value === 0) return <span className="text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />0%</span>;
  if (value > 0) return <span className="text-emerald-600 flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />+{value}%</span>;
  return <span className="text-red-500 flex items-center gap-0.5"><TrendingDown className="h-3 w-3" />{value}%</span>;
}

export function HorasExtrasTab({ baseQuery }: HorasExtrasTabProps) {
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

  // Totals row — hooks MUST be called unconditionally (before any early return)
  const monthly = data ? (data.monthlyData || []) : [];
  const totals = useMemo(() => {
    let dias = 0, misiones = 0, bultos = 0, hb = 0, he = 0, opHE = 0;
    for (let i = 0; i < monthly.length; i++) {
      const r = monthly[i];
      dias += r.dias;
      misiones += r.misiones;
      bultos += r.bultos;
      hb += r.horasBrutas;
      he += r.horasExtras || 0;
      opHE += r.misionesConHE || 0;
    }
    const hePromedio = dias > 0 ? Math.round((he / dias) * 10) / 10 : 0;
    return { dias, misiones, bultos, hb, he, opHE, hePromedio };
  }, [monthly]);

  if (error) return (
    <Card><CardContent className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Error al cargar los datos de horas extras.</p>
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

  if (monthly.length < 2) return (
    <Card><CardContent className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Se necesitan al menos 2 meses de datos para el comparativo.</p>
    </CardContent></Card>
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Total HE</span>
            </div>
            <p className="text-2xl font-bold">{totals.he.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</p>
            <p className="text-[11px] text-muted-foreground">horas extras acumuladas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calculator className="h-4 w-4" />
              <span className="text-xs font-medium">HE / día prom.</span>
            </div>
            <p className="text-2xl font-bold">{totals.hePromedio.toLocaleString("es-AR")}</p>
            <p className="text-[11px] text-muted-foreground">promedio diario de HE</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calculator className="h-4 w-4" />
              <span className="text-xs font-medium">Misiones con HE</span>
            </div>
            <p className="text-2xl font-bold">{totals.opHE.toLocaleString("es-AR")}</p>
            <p className="text-[11px] text-muted-foreground">veces que un operario hizo HE</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Costo HE (est.)</span>
            </div>
            <p className="text-2xl font-bold">{(totals.he * 1.5).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</p>
            <p className="text-[11px] text-muted-foreground">HS @ 1.5x (sin datos reales)</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly comparison table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Horas Extras — Comparativo Mensual
            </CardTitle>
            <CardDescription>
              Base: jornada de 8 HS. Toda hora por encima de 8 HS se cuenta como hora extra.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={[
                ...monthly.map((r: any) => ({
                  Mes: r.label,
                  Dias: r.dias,
                  "Misiones tot.": r.misiones,
                  "Misiones c/HE": r.misionesConHE || 0,
                  "Hs. Brutas": r.horasBrutas,
                  "Hs. Extras": r.horasExtras || 0,
                  "HE / dia": r.dias > 0 ? Math.round((r.horasExtras / r.dias) * 10) / 10 : 0,
                  "Var. HE": r.cmpHE !== null ? `${r.cmpHE > 0 ? "+" : ""}${r.cmpHE}%` : "-",
                })),
                {
                  Mes: "TOTAL",
                  Dias: totals.dias,
                  "Misiones tot.": totals.misiones,
                  "Misiones c/HE": totals.opHE,
                  "Hs. Brutas": totals.hb,
                  "Hs. Extras": Math.round(totals.he * 100) / 100,
                  "HE / dia": totals.hePromedio,
                  "Var. HE": "-",
                },
              ]}
              filename="horas-extras"
              sheetName="Horas Extras"
              colWidths={[14, 8, 12, 14, 12, 12, 10, 12]}
            />
            <PrintButton title="Horas Extras" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[120px]">Mes</th>
                <th className="text-xs font-semibold text-center p-2 min-w-[50px]">Días</th>
                <th className="text-xs font-semibold text-center p-2 min-w-[80px]">Misiones tot.</th>
                <th className="text-xs font-semibold text-center p-2 min-w-[90px]">Misiones c/HE</th>
                <th className="text-xs font-semibold text-center p-2 min-w-[80px]">Hs. Brutas</th>
                <th className="text-xs font-semibold text-center p-2 min-w-[80px] text-amber-600">Hs. Extras</th>
                <th className="text-xs font-semibold text-center p-2 min-w-[70px]">HE / día</th>
                <th className="text-xs font-semibold text-center p-2 min-w-[70px]">Var.</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row: any) => {
                const heDia = row.dias > 0 ? Math.round((row.horasExtras / row.dias) * 10) / 10 : 0;
                return (
                  <tr key={row.month} className="border-b hover:bg-muted/50">
                    <td className="text-xs font-medium p-2 sticky left-0 bg-card">{row.label}</td>
                    <td className="text-xs text-center p-2">{row.dias}</td>
                    <td className="text-xs text-center p-2">{row.misiones.toLocaleString("es-AR")}</td>
                    <td className="text-xs text-center p-2">{(row.misionesConHE || 0).toLocaleString("es-AR")}</td>
                    <td className="text-xs text-center p-2">{row.horasBrutas.toLocaleString("es-AR")}</td>
                    <td className="text-xs text-center p-2 font-medium text-amber-600">{(row.horasExtras || 0).toLocaleString("es-AR", { maximumFractionDigits: 1 })}</td>
                    <td className="text-xs text-center p-2">{heDia}</td>
                    <td className="text-xs text-center p-2"><ChangeIndicator value={row.cmpHE} /></td>
                  </tr>
                );
              })}
              <tr className="border-t-2 font-bold bg-muted/30">
                <td className="text-xs font-bold p-2 sticky left-0 bg-muted/30">TOTAL</td>
                <td className="text-xs text-center font-bold p-2">{totals.dias}</td>
                <td className="text-xs text-center font-bold p-2">{totals.misiones.toLocaleString("es-AR")}</td>
                <td className="text-xs text-center font-bold p-2">{totals.opHE.toLocaleString("es-AR")}</td>
                <td className="text-xs text-center font-bold p-2">{totals.hb.toLocaleString("es-AR")}</td>
                <td className="text-xs text-center font-bold p-2 text-amber-600">{Math.round(totals.he * 100) / 100}</td>
                <td className="text-xs text-center font-bold p-2">{totals.hePromedio}</td>
                <td className="text-xs text-center p-2">—</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
