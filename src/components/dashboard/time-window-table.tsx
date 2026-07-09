"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Target, Sun, Moon } from "lucide-react";

interface FranjasData {
  misiones: number;
  bultos10_14: number;
  bultos18_22: number;
}

export function TimeWindowTable({ data }: { data: FranjasData | null }) {
  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-24 bg-muted/50 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Misiones",
      description: "Personas que inician a las 10 o a las 18 hs",
      value: data.misiones.toLocaleString("es-AR"),
      icon: Target,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-l-4 border-l-emerald-400",
    },
    {
      title: "Bultos 10 - 14 hs",
      description: "Total de unidades producidas entre las 10 y las 14",
      value: data.bultos10_14.toLocaleString("es-AR"),
      icon: Sun,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-l-4 border-l-amber-400",
    },
    {
      title: "Bultos 18 - 22 hs",
      description: "Total de unidades producidas entre las 18 y las 22",
      value: data.bultos18_22.toLocaleString("es-AR"),
      icon: Moon,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-l-4 border-l-indigo-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className={card.border}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  {card.title}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {card.description}
                </CardDescription>
              </div>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}