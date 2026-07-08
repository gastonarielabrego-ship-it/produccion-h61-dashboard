"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Layers } from "lucide-react";

const CIRCUIT_COLORS = [
  "#10b981",
  "#f59e0b",
  "#3b82f6",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#14b8a6",
  "#6366f1",
  "#84cc16",
  "#e11d48",
  "#0ea5e9",
  "#a855f7",
];

function CircuitTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const entries = payload.filter((p: any) => p.value > 0);
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md max-w-[250px]">
      <p className="font-semibold text-sm mb-1">{label}</p>
      {entries.map((entry: any, i: number) => (
        <p key={i} className="text-xs flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {Number(entry.value).toLocaleString("es-AR")}
        </p>
      ))}
    </div>
  );
}

interface ByCircuitChartProps {
  data: {
    circuits: string[];
    circuitTotals: { circuito: string; total: number }[];
    hourlyData: Record<string, string | number>[];
  } | null;
}

export function ByCircuitChart({ data }: ByCircuitChartProps) {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-4 h-[400px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  // Only show top 8 circuits
  const topCircuits = data.circuitTotals.slice(0, 8).map((c) => c.circuito);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4" />
          Producción por Hora y Circuito
        </CardTitle>
        <CardDescription>
          Comparación horaria entre los 8 circuitos con mayor producción
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
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
              <Tooltip content={<CircuitTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                iconType="circle"
                iconSize={8}
              />
              {topCircuits.map((c, i) => (
                <Bar
                  key={c}
                  dataKey={c}
                  stackId="a"
                  fill={CIRCUIT_COLORS[i % CIRCUIT_COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}