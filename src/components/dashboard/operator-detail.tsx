"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BarChart3, Clock, Calendar, Layers, Zap } from "lucide-react";

interface OperatorDetailProps {
  operario: string | null;
  onClose: () => void;
  filtersQuery: string;
  hourFrom?: number | null;
  hourTo?: number | null;
}

function HourlyTooltip({ active, payload, label, avg }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-sm text-emerald-600 mt-1">
        Producción: {payload[0].value.toLocaleString("es-AR")} unidades
      </p>
      {payload[0].value > 0 && avg > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {payload[0].value > avg ? "▲" : "▼"}{" "}
          {Math.abs(
            Math.round(((payload[0].value - avg) / avg) * 100)
          )}
          % vs promedio
        </p>
      )}
    </div>
  );
}

export function OperatorDetail({
  operario,
  onClose,
  filtersQuery,
  hourFrom,
  hourTo,
}: OperatorDetailProps) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!operario) {
      setDetail(null);
      return;
    }

    setLoading(true);
    const parts = [`operario=${encodeURIComponent(operario)}`];
    if (filtersQuery) parts.push(filtersQuery);
    if (hourFrom != null) parts.push(`hourFrom=${hourFrom}`);
    if (hourTo != null) parts.push(`hourTo=${hourTo}`);
    fetch(`/api/production/operator-hourly?${parts.join("&")}`)
      .then((r) => r.json())
      .then((data) => {
        setDetail(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [operario, filtersQuery, hourFrom, hourTo]);

  const avgQuantity =
    detail && detail.horasConectado > 0
      ? Math.round(detail.total / detail.horasConectado)
      : 0;

  return (
    <Sheet open={!!operario} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-1 pr-6">
          <SheetTitle className="text-lg">
            {loading ? "Cargando..." : detail?.nombre || operario}
          </SheetTitle>
          <SheetDescription>
            {detail ? `Legajo: ${detail.operario}` : ""}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="mt-6 flex items-center justify-center h-40">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {detail && !loading && (
          <div className="mt-6 space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs text-muted-foreground">Producción</span>
                </div>
                <p className="text-lg font-bold">
                  {detail.total.toLocaleString("es-AR")}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs text-muted-foreground">Horas activas</span>
                </div>
                <p className="text-lg font-bold">{detail.horasConectado}h</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-sky-600" />
                  <span className="text-xs text-muted-foreground">Días trabajados</span>
                </div>
                <p className="text-lg font-bold">{detail.diasTrabajados}</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-xs text-muted-foreground">Promedio/hora</span>
                </div>
                <p className="text-lg font-bold">
                  {detail.avgPerActiveHour.toLocaleString("es-AR")}
                </p>
              </div>
            </div>

            {/* Shifts & Circuits */}
            <div className="flex flex-wrap gap-2">
              {detail.shifts.map((s: string) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))}
              <Badge variant="outline" className="text-xs">
                <Layers className="h-3 w-3 mr-1" />
                {detail.circuits} circuitos
              </Badge>
            </div>

            <Separator />

            {/* Hourly chart */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Producción por Hora
              </h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={detail.hourlyData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        v >= 1000
                          ? `${(v / 1000).toFixed(0)}k`
                          : String(v)
                      }
                    />
                    <Tooltip
                      content={<HourlyTooltip avg={avgQuantity} />}
                    />
                    <ReferenceLine
                      y={avgQuantity}
                      stroke="#f59e0b"
                      strokeDasharray="5 5"
                      label={{
                        value: `Prom: ${avgQuantity.toLocaleString("es-AR")}`,
                        position: "insideTopRight",
                        fontSize: 10,
                        fill: "#f59e0b",
                      }}
                    />
                    <Bar
                      dataKey="quantity"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <Separator />

            {/* Circuit breakdown */}
            {detail.circuitBreakdown.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <Layers className="h-4 w-4" />
                  Desglose por Circuito
                </h3>
                <div className="space-y-2">
                  {detail.circuitBreakdown.slice(0, 8).map((c: any) => {
                    const pct =
                      detail.total > 0
                        ? Math.round((c.total / detail.total) * 100)
                        : 0;
                    return (
                      <div
                        key={c.circuito}
                        className="flex items-center gap-3"
                      >
                        <span className="text-xs w-10 text-muted-foreground text-right">
                          {c.circuito}
                        </span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-14 text-right">
                          {c.total.toLocaleString("es-AR")}
                        </span>
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shift breakdown */}
            {detail.shiftBreakdown.length > 1 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Desglose por Turno
                  </h3>
                  <div className="space-y-2">
                    {detail.shiftBreakdown.map((s: any) => {
                      const pct =
                        detail.total > 0
                          ? Math.round((s.total / detail.total) * 100)
                          : 0;
                      return (
                        <div
                          key={s.turno}
                          className="flex items-center gap-3"
                        >
                          <span className="text-xs w-16 text-muted-foreground text-right">
                            {s.turno}
                          </span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-violet-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium w-14 text-right">
                            {s.total.toLocaleString("es-AR")}
                          </span>
                          <span className="text-xs text-muted-foreground w-8 text-right">
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}