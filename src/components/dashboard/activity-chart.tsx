"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  LabelList,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, Users } from "lucide-react";
import { PrintButton } from "./print-button";
import { ExcelButton } from "./excel-button";

const DEFAULT_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function ComboTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-semibold text-sm mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {entry.dataKey === "Operarios"
            ? `${Number(entry.value)} personas`
            : Number(entry.value).toLocaleString("es-AR")
          }
        </p>
      ))}
    </div>
  );
}

interface ComboChartProps {
  data: {
    activities: { actividad: string; label: string; total: number; color: string }[];
    hourlyData: Record<string, string | number>[];
    avgHourly: number;
    totalBultos: number;
    totalMisiones: number;
  } | null;
}

export function ComboChart({ data }: ComboChartProps) {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-4 h-[400px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  const labels = data.activities.map((a) => a.label);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Preparación por Hora y Actividad
          </CardTitle>
          <CardDescription>
            Unidades por actividad (barras) y operarios activos (línea) —{" "}
            {data.totalBultos.toLocaleString("es-AR")} unidades · {data.totalMisiones} operarios peak
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
            <ExcelButton
              rows={data.hourlyData.map((d: any) => {
                const row: Record<string, any> = { Hora: d.hour, Operarios: Number(d.Operarios) };
                data.activities.forEach((a: any) => { row[a.label] = Number(d[a.label]); });
                return row;
              })}
              filename="preparacion-por-hora-actividad"
              sheetName="Por Hora"
              colWidths={[8, 12, ...data.activities.map(() => 14)]}
            />
            <PrintButton title="Preparación por Hora y Actividad" />
          </div>
      </CardHeader>
      <CardContent>
        <div className="h-[450px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.hourlyData} margin={{ top: 30, right: 60, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={1}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ComboTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                iconType="circle"
                iconSize={8}
              />
              {/* Average reference line */}
              <ReferenceLine
                yAxisId="left"
                y={data.avgHourly}
                stroke="#eab308"
                strokeDasharray="6 3"
                label={{
                  value: `Prom: ${data.avgHourly.toLocaleString("es-AR")}`,
                  position: "insideTopRight",
                  fill: "#eab308",
                  fontSize: 10,
                }}
              />
              {/* Stacked bars per activity */}
              {labels.map((label, i) => (
                <Bar
                  key={label}
                  yAxisId="left"
                  dataKey={label}
                  fill={data.activities[i]?.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                  stackId="bultos"
                  radius={i === labels.length - 1 ? [2, 2, 0, 0] : undefined}
                  maxBarSize={40}
                />
              ))}
              {/* Total label on top of stacked bars */}
              <Bar
                yAxisId="left"
                dataKey="__total_label__"
                fill="transparent"
                stackId="bultos"
                maxBarSize={40}
                isAnimationActive={false}
              >
                <LabelList
                  valueAccessor={(entry: any) => {
                    let total = 0;
                    labels.forEach((l) => { total += Number(entry.payload?.[l]) || 0; });
                    return total;
                  }}
                  position="insideTop"
                  style={{ fontSize: 9, fill: "#374151", fontWeight: 600 }}
                  formatter={(v: number) => v > 0 ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v) : ""}
                />
              </Bar>
              {/* Operators line */}
              <Line
                yAxisId="right"
                dataKey="Operarios"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ r: 3, fill: "#0ea5e9" }}
                activeDot={{ r: 5 }}
              >
                <LabelList
                  dataKey="Operarios"
                  position="top"
                  style={{ fontSize: 8, fontWeight: 600, fill: "#0ea5e9" }}
                  offset={-2}
                  formatter={(v: number) => v > 0 ? v : ""}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}