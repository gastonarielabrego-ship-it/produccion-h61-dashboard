"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, BarChart3, Users, Clock } from "lucide-react";

interface SummaryCardsProps {
  data: {
    totalRecords: number;
    grandTotal: number;
    circuitData: { circuito: string; total: number }[];
    shiftData: { turno: string; label: string; total: number }[];
  } | null;
}

export function SummaryCards({ data }: SummaryCardsProps) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-16 bg-muted/50 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const topCircuit = data.circuitData[0]?.circuito || "N/A";
  const topShift = data.shiftData.reduce(
    (max, s) => (s.total > (max?.total || 0) ? s : max),
    data.shiftData[0] || { turno: "", label: "", total: 0 }
  );

  const cards = [
    {
      title: "Producción Total",
      value: data.grandTotal.toLocaleString("es-AR"),
      icon: BarChart3,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Registros",
      value: data.totalRecords.toLocaleString("es-AR"),
      icon: TrendingUp,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Circuito Líder",
      value: topCircuit,
      icon: Clock,
      color: "text-sky-600",
      bg: "bg-sky-50",
    },
    {
      title: "Turno Líder",
      value: topShift.label || "N/A",
      icon: Users,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-md ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}