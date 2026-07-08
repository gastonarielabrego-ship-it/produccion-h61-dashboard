"use client";

import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Target, Layers } from "lucide-react";

interface ShiftParticipation {
  turno: string;
  label: string;
  missions: number;
  total: number;
  percentage: number;
}

interface SummaryCardsProps {
  data: {
    totalRecords: number;
    grandTotal: number;
    totalMissions: number;
    shiftParticipation: ShiftParticipation[];
    circuitData: { circuito: string; total: number }[];
    shiftData: { turno: string; label: string; total: number }[];
  } | null;
}

const SHIFT_COLORS = [
  { bg: "bg-blue-500", text: "text-blue-700" },
  { bg: "bg-amber-500", text: "text-amber-700" },
  { bg: "bg-violet-500", text: "text-violet-700" },
  { bg: "bg-emerald-500", text: "text-emerald-700" },
  { bg: "bg-rose-500", text: "text-rose-700" },
];

export function SummaryCards({ data }: SummaryCardsProps) {
  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-20 bg-muted/50 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalPercentage = data.shiftParticipation.reduce(
    (sum, s) => sum + s.percentage,
    0
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Producción Total */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Producción Total
            </span>
            <div className="p-1.5 rounded-md bg-emerald-50">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight">
            {data.grandTotal.toLocaleString("es-AR")}
          </p>
        </CardContent>
      </Card>

      {/* Misiones */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Misiones
            </span>
            <div className="p-1.5 rounded-md bg-amber-50">
              <Target className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight">
            {data.totalMissions.toLocaleString("es-AR")}
          </p>
        </CardContent>
      </Card>

      {/* Participación por Turno */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Participación por Turno
            </span>
            <div className="p-1.5 rounded-md bg-sky-50">
              <Layers className="h-4 w-4 text-sky-600" />
            </div>
          </div>

          {/* Stacked bar */}
          <div className="w-full h-2.5 rounded-full bg-muted flex overflow-hidden mb-3">
            {data.shiftParticipation.map((shift, i) => (
              <div
                key={shift.turno}
                className={`${SHIFT_COLORS[i % SHIFT_COLORS.length].bg} transition-all duration-500`}
                style={{
                  width: `${totalPercentage > 0 ? (shift.percentage / totalPercentage) * 100 : 0}%`,
                }}
                title={`${shift.label}: ${shift.percentage}%`}
              />
            ))}
          </div>

          {/* Labels */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {data.shiftParticipation.map((shift, i) => (
              <div key={shift.turno} className="flex items-center gap-1.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${SHIFT_COLORS[i % SHIFT_COLORS.length].bg}`}
                />
                <span
                  className={`text-xs font-medium ${SHIFT_COLORS[i % SHIFT_COLORS.length].text}`}
                >
                  {shift.label}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {shift.percentage}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}