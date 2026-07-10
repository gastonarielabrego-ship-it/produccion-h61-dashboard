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
import { Users } from "lucide-react";

const SHIFT_COLORS: Record<string, string> = {
  Mañana: "#10b981",
  Tarde: "#f59e0b",
  Noche: "#6366f1",
};

function MissionTooltip({ active, payload, label }: any) {
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
          {entry.name}: {entry.value} personas
        </p>
      ))}
    </div>
  );
}

interface MissionsHourlyChartProps {
  data: {
    shifts: { turno: string; label: string; total: number }[];
    hourlyData: Record<string, string | number>[];
  } | null;
}

export function MissionsHourlyChart({ data }: MissionsHourlyChartProps) {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-4 h-[450px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  const shiftLabels = data.shifts.map((s) => s.label);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Misiones por Hora y Turno
        </CardTitle>
        <CardDescription>
          Personas activas por hora según turno (Mañana / Tarde / Noche)
        </CardDescription>
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
                allowDecimals={false}
              />
              <Tooltip content={<MissionTooltip />} />
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