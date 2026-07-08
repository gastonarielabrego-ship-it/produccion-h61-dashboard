"use client";

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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

interface HourlyData {
  hour: string;
  hourNum: number;
  quantity: number;
}

interface HourlyChartProps {
  data: {
    totalRecords: number;
    grandTotal: number;
    hourlyData: HourlyData[];
    circuitData: { circuito: string; total: number }[];
  } | null;
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

export function HourlyChart({ data }: HourlyChartProps) {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-4 h-[400px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  const activeHours = data.hourlyData.filter((d) => d.quantity > 0).length;
  const avgQuantity =
    data.grandTotal > 0
      ? Math.round(data.grandTotal / activeHours)
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Producción por Hora
        </CardTitle>
        <CardDescription>
          Distribución horaria de la producción total —{" "}
          {data.grandTotal.toLocaleString("es-AR")} unidades en {data.totalRecords} registros
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.hourlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <Tooltip content={<HourlyTooltip avg={avgQuantity} />} />
              <ReferenceLine
                y={avgQuantity}
                stroke="#f59e0b"
                strokeDasharray="5 5"
                label={{
                  value: `Prom: ${avgQuantity.toLocaleString("es-AR")}`,
                  position: "insideTopRight",
                  fontSize: 11,
                  fill: "#f59e0b",
                }}
              />
              <Bar
                dataKey="quantity"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}