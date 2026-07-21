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
import { PrintButton } from "@/components/dashboard/print-button";
import { ExcelButton } from "./excel-button";

const FALLBACK_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function ActTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-sm text-emerald-600 mt-1">
        {Number(payload[0].value).toLocaleString("es-AR")} unidades
      </p>
    </div>
  );
}

interface ActivityBreakdownProps {
  data: {
    activities: { actividad: string; label: string; total: number; color: string }[];
  } | null;
}

export function ActivityBreakdown({ data }: ActivityBreakdownProps) {
  if (!data || data.activities.length === 0) return null;

  const chartHeight = Math.max(180, data.activities.length * 60);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            Producción por Actividad
          </CardTitle>
          <CardDescription>
            Total de unidades preparadas por tipo de actividad
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
            <ExcelButton
              rows={data.activities.map((a: any) => ({
                Actividad: a.label,
                Unidades: Number(a.total),
              }))}
              filename="produccion-por-actividad"
              sheetName="Actividad"
              colWidths={[30, 14]}
            />
            <PrintButton title="Producción por Actividad" />
          </div>
      </CardHeader>
      <CardContent>
        <div style={{ height: `${chartHeight}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.activities}
              layout="vertical"
              margin={{ top: 0, right: 80, left: 100, bottom: 0 }}
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
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={95}
              />
              <Tooltip content={<ActTooltip />} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {data.activities.map((entry, i) => (
                  <Cell key={i} fill={entry.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                ))}
                <LabelList
                  dataKey="total"
                  position="right"
                  formatter={(v: number) => v.toLocaleString("es-AR")}
                  style={{ fontSize: 11, fill: "#374151", fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}