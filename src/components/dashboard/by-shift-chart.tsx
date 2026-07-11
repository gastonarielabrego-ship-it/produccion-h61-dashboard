"use client";

import {
  LineChart,
  Line,
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
import { Clock } from "lucide-react";
import { PrintButton } from "@/components/dashboard/print-button";

const SHIFT_COLORS: Record<string, string> = {
  Mañana: "#10b981",
  Tarde: "#f59e0b",
  Noche: "#6366f1",
};

function ShiftTooltip({ active, payload, label }: any) {
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
          {entry.name}: {Number(entry.value).toLocaleString("es-AR")}
        </p>
      ))}
    </div>
  );
}

interface ByShiftChartProps {
  data: {
    shifts: { turno: string; label: string; total: number }[];
    hourlyData: Record<string, string | number>[];
  } | null;
}

export function ByShiftChart({ data }: ByShiftChartProps) {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-4 h-[400px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  const shiftLabels = data.shifts.map((s) => s.label);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Producción por Hora y Turno
          </CardTitle>
          <CardDescription>
            Perfil de producción horaria según turno (Mañana / Tarde / Noche)
          </CardDescription>
        </div>
        <PrintButton title="Producción por Hora y Turno" />
      </CardHeader>
      <CardContent>
        <div className="h-[450px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.hourlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
              <Tooltip content={<ShiftTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                iconType="circle"
                iconSize={8}
              />
              {shiftLabels.map((label) => (
                <Line
                  key={label}
                  type="monotone"
                  dataKey={label}
                  stroke={SHIFT_COLORS[label] || "#888"}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}