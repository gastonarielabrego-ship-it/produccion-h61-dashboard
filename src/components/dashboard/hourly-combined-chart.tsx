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
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, Users } from "lucide-react";

const SHIFT_STROKES: Record<string, string> = {
  Mañana: "#059669",
  Tarde: "#d97706",
  Noche: "#4f46e5",
};

function CombinedTooltip({ active, payload, label, avg }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md min-w-[160px]">
      <p className="font-semibold text-sm mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => {
        const isBultos = entry.dataKey === "bultos";
        return (
          <p key={i} className="text-xs flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: entry.color || entry.stroke }}
              />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums">
              {isBultos
                ? `${entry.value.toLocaleString("es-AR")} u.`
                : `${entry.value} pers.`}
            </span>
          </p>
        );
      })}
      {avg > 0 && (
        <div className="border-t mt-1.5 pt-1.5 text-[10px] text-muted-foreground text-right">
          Prom. bultos: {avg.toLocaleString("es-AR")} u.
        </div>
      )}
    </div>
  );
}

interface CombinedHourlyChartProps {
  data: {
    totalRecords: number;
    grandTotal: number;
    hourlyData: Record<string, string | number>[];
    circuitData: { circuito: string; total: number }[];
    shifts: { turno: string; label: string; total: number }[];
  } | null;
}

export function CombinedHourlyChart({ data }: CombinedHourlyChartProps) {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-4 h-[480px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  const shiftLabels = data.shifts.map((s) => s.label);
  const activeHours = data.hourlyData.filter((d) => Number(d.bultos) > 0).length;
  const avgQuantity = data.grandTotal > 0 ? Math.round(data.grandTotal / activeHours) : 0;
  const totalMissions = data.shifts.reduce((sum, s) => sum + s.total, 0);
  const tooltipContent = <CombinedTooltip avg={avgQuantity} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          <Users className="h-4 w-4 ml-1" />
          Producción y Misiones por Hora
        </CardTitle>
        <CardDescription>
          Bultos producidos (barras) y personas activas por turno (líneas) —{" "}
          {data.grandTotal.toLocaleString("es-AR")} unidades · {totalMissions.toLocaleString("es-AR")} misiones
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[480px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={1}
              />

              {/* Left Y-axis: Bultos */}
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                label={{
                  value: "Bultos",
                  angle: -90,
                  position: "insideLeft",
                  offset: 40,
                  style: { fontSize: 11, fill: "#10b981" },
                }}
              />

              {/* Right Y-axis: Personas */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                label={{
                  value: "Personas",
                  angle: 90,
                  position: "insideRight",
                  offset: 40,
                  style: { fontSize: 11, fill: "#6366f1" },
                }}
              />

              <Tooltip content={tooltipContent} />

              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                iconType="circle"
                iconSize={8}
                formatter={(value: string) =>
                  value === "bultos" ? "Bultos (producción)" : value
                }
              />

              <ReferenceLine
                yAxisId="left"
                y={avgQuantity}
                stroke="#f59e0b"
                strokeDasharray="5 5"
                label={{
                  value: `Prom: ${avgQuantity.toLocaleString("es-AR")}`,
                  position: "insideTopLeft",
                  fontSize: 10,
                  fill: "#f59e0b",
                }}
              />

              {/* Bars: bultos por hora */}
              <Bar
                yAxisId="left"
                dataKey="bultos"
                name="bultos"
                fill="#10b981"
                fillOpacity={0.35}
                stroke="#10b981"
                strokeWidth={1}
                radius={[3, 3, 0, 0]}
                maxBarSize={36}
              />

              {/* Lines: misiones por turno */}
              {shiftLabels.map((label) => (
                <Line
                  key={label}
                  yAxisId="right"
                  type="monotone"
                  dataKey={label}
                  name={label}
                  stroke={SHIFT_STROKES[label] || "#888"}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: SHIFT_STROKES[label] || "#888" }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}