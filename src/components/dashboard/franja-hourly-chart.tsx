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
  LabelList,
} from "recharts";

const SHIFT_COLORS: Record<string, string> = {
  Mañana: "#10b981",
  Tarde: "#f59e0b",
  Noche: "#6366f1",
};

function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2 shadow-md">
      <p className="font-semibold text-xs mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-[11px] flex items-center gap-1.5">
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

export function FranjaHourlyChart({
  hourlyData,
  shifts,
  hourFrom,
  hourTo,
}: {
  hourlyData: Record<string, string | number>[] | null;
  shifts: { turno: string; label: string; total: number }[] | null;
  hourFrom: number;
  hourTo: number;
}) {
  if (!hourlyData || !shifts) return null;

  const shiftLabels = shifts.map((s) => s.label);
  const filtered = hourlyData.filter(
    (d) => Number(d.hourNum) >= hourFrom && Number(d.hourNum) <= hourTo
  );

  if (filtered.length === 0) return null;

  return (
    <div className="h-[200px] mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={filtered} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
            width={40}
          />
          <Tooltip content={<MiniTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            iconType="circle"
            iconSize={6}
          />
          {shiftLabels.map((label) => (
            <Line
              key={label}
              type="monotone"
              dataKey={label}
              stroke={SHIFT_COLORS[label] || "#888"}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 4 }}
            >
              <LabelList
                dataKey={label}
                position="top"
                style={{ fontSize: 9, fill: SHIFT_COLORS[label] || "#888" }}
                formatter={(v: number) => v > 0 ? v : ""}
              />
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}