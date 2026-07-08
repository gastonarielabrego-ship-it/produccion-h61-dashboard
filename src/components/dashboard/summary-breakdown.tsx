"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Layers } from "lucide-react";

const COLORS = [
  "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
  "#84cc16", "#e11d48", "#0ea5e9", "#a855f7",
];

interface SummaryBreakdownProps {
  data: {
    circuitData: { circuito: string; total: number }[];
    shiftData: { turno: string; label: string; total: number }[];
    dateData: { date: number; total: number }[];
    funcionData: { funcion: string; label: string; total: number }[];
  } | null;
}

function CircuitTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-sm text-emerald-600 mt-1">
        {payload[0].value.toLocaleString("es-AR")} unidades
      </p>
    </div>
  );
}

export function SummaryBreakdown({ data }: SummaryBreakdownProps) {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-4 h-[400px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  // Dynamic height based on number of circuits
  const circuitCount = data.circuitData.length;
  const chartHeight = Math.max(250, circuitCount * 38);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4" />
          Producción por Circuito
        </CardTitle>
        <CardDescription>
          Circuitos ordenados por volumen total de producción
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: `${chartHeight}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.circuitData}
              layout="vertical"
              margin={{ top: 0, right: 80, left: 50, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-muted"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <YAxis
                type="category"
                dataKey="circuito"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={45}
              />
              <Tooltip content={<CircuitTooltip />} />
              <Bar
                dataKey="total"
                radius={[0, 4, 4, 0]}
                maxBarSize={22}
              >
                {data.circuitData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
                <LabelList
                  dataKey="total"
                  position="right"
                  formatter={(v: number) => v.toLocaleString("es-AR")}
                  style={{ fontSize: 11, fill: "#525252" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}