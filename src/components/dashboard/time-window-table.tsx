"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Target, Sun, Moon, TrendingUp } from "lucide-react";

interface FranjasGroup {
  misiones10: number;
  misiones18: number;
  bultos10_14: number;
  bultos18_22: number;
  produccion10: number;
  produccion18: number;
}

interface TimeWindowTableProps {
  data: FranjasGroup | null;
}

function FranjaRow({ label, icon: Icon, misiones, bultos, produccion, iconColor, borderColor }: {
  label: string;
  icon: typeof Sun;
  misiones: number;
  bultos: number;
  produccion: number;
  iconColor: string;
  borderColor: string;
}) {
  const cards = [
    {
      title: "Misiones",
      description: `Personas que inician a las ${label === "10 - 14 hs" ? "10" : "18"} hs`,
      value: misiones.toLocaleString("es-AR"),
      icon: Target,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: `Bultos ${label}`,
      description: `Unidades producidas en esa franja`,
      value: bultos.toLocaleString("es-AR"),
      icon: Icon,
      color: iconColor,
      bg: iconColor === "text-amber-600" ? "bg-amber-50" : "bg-indigo-50",
    },
    {
      title: "Producción",
      description: "Bultos por misión por hora",
      value: produccion.toLocaleString("es-AR"),
      icon: TrendingUp,
      color: "text-sky-600",
      bg: "bg-sky-50",
    },
  ];

  return (
    <div className={`border-l-4 ${borderColor} rounded-r-lg`}>
      <div className="px-4 pt-3 pb-1">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          Franja {label}
        </h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-3 pb-3">
        {cards.map((card) => (
          <Card key={card.title} className="shadow-sm">
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {card.title}
                </CardTitle>
                <div className={`p-1.5 rounded-md ${card.bg}`}>
                  <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                </div>
              </div>
              <CardDescription className="text-[11px]">
                {card.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-bold tracking-tight">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function TimeWindowTable({ data }: TimeWindowTableProps) {
  if (!data) {
    return (
      <div className="space-y-6">
        {[1, 2].map((g) => (
          <div key={g} className="border-l-4 border-l-muted rounded-r-lg p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-16 bg-muted/50 rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FranjaRow
        label="10 - 14 hs"
        icon={Sun}
        misiones={data.misiones10}
        bultos={data.bultos10_14}
        produccion={data.produccion10}
        iconColor="text-amber-600"
        borderColor="border-l-amber-400"
      />
      <FranjaRow
        label="18 - 22 hs"
        icon={Moon}
        misiones={data.misiones18}
        bultos={data.bultos18_22}
        produccion={data.produccion18}
        iconColor="text-indigo-600"
        borderColor="border-l-indigo-400"
      />
    </div>
  );
}