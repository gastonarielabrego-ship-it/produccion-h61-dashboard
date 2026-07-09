"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Target, Sun, Moon, TrendingUp, User, Clock } from "lucide-react";
import { OperatorDetail } from "./operator-detail";

interface OperatorRow {
  operario: string;
  nombre: string;
  total: number;
}

interface FranjasGroup {
  misiones10: number;
  misiones18: number;
  bultos10_14: number;
  bultos18_22: number;
  produccion10: number;
  produccion18: number;
  operators10: OperatorRow[];
  operators18: OperatorRow[];
}

interface TimeWindowTableProps {
  data: FranjasGroup | null;
  filtersQuery: string;
}

function MissionTable({
  operators,
  barColor,
  onSelectOperator,
}: {
  operators: OperatorRow[];
  barColor: string;
  onSelectOperator: (operario: string) => void;
}) {
  const maxTotal = operators[0]?.total || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Personas alcanzadas ({operators.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px]">
          <div className="px-4 pb-4 space-y-0">
            {operators.map((op, i) => {
              const pct = Math.round((op.total / maxTotal) * 100);
              return (
                <div
                  key={op.operario}
                  className="flex items-center gap-3 py-2 border-b last:border-0 border-border/50"
                >
                  <div className="w-6 text-center">
                    {i < 3 ? (
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-bold ${
                          i === 0
                            ? "bg-amber-100 text-amber-700"
                            : i === 1
                            ? "bg-gray-100 text-gray-600"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {i + 1}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left cursor-pointer group bg-transparent border-0 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectOperator(op.operario);
                    }}
                  >
                    <p className="text-xs font-medium truncate group-hover:text-primary transition-colors underline-offset-4 group-hover:underline">
                      {op.nombre}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {op.operario}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0 mr-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground w-4 text-right">
                      4h
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold w-14 text-right">
                      {op.total.toLocaleString("es-AR")}
                    </span>
                  </div>
                </div>
              );
            })}
            {operators.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                Sin datos
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function FranjaSection({
  label,
  icon: Icon,
  misiones,
  bultos,
  produccion,
  operators,
  iconColor,
  borderColor,
  barColor,
  onSelectOperator,
}: {
  label: string;
  icon: typeof Sun;
  misiones: number;
  bultos: number;
  produccion: number;
  operators: OperatorRow[];
  iconColor: string;
  borderColor: string;
  barColor: string;
  onSelectOperator: (operario: string) => void;
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
      description: "Unidades producidas en esa franja",
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
    <div className={`border-l-4 ${borderColor} rounded-r-lg space-y-4`}>
      <div className="px-4 pt-3 pb-1">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          Franja {label}
        </h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-3 pb-2">
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
      <div className="px-3 pb-3">
        <MissionTable operators={operators} barColor={barColor} onSelectOperator={onSelectOperator} />
      </div>
    </div>
  );
}

export function TimeWindowTable({ data, filtersQuery }: TimeWindowTableProps) {
  const [selectedOperario, setSelectedOperario] = useState<string | null>(null);
  const [hourRange, setHourRange] = useState<{ from: number; to: number } | null>(null);

  const handleSelect = (operario: string, hourFrom: number, hourTo: number) => {
    setSelectedOperario(operario);
    setHourRange({ from: hourFrom, to: hourTo });
  };
  if (!data) {
    return (
      <div className="space-y-6">
        {[1, 2].map((g) => (
          <div key={g} className="border-l-4 border-l-muted rounded-r-lg p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-16 bg-muted/50 rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="p-4 h-[320px] flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FranjaSection
        label="10 - 14 hs"
        icon={Sun}
        misiones={data.misiones10}
        bultos={data.bultos10_14}
        produccion={data.produccion10}
        operators={data.operators10}
        iconColor="text-amber-600"
        borderColor="border-l-amber-400"
        barColor="bg-amber-400"
        onSelectOperator={(op) => handleSelect(op, 10, 14)}
      />
      <FranjaSection
        label="18 - 22 hs"
        icon={Moon}
        misiones={data.misiones18}
        bultos={data.bultos18_22}
        produccion={data.produccion18}
        operators={data.operators18}
        iconColor="text-indigo-600"
        borderColor="border-l-indigo-400"
        barColor="bg-indigo-400"
        onSelectOperator={(op) => handleSelect(op, 18, 22)}
      />

      {/* Detail sheet */}
      <OperatorDetail
        operario={selectedOperario}
        onClose={() => setSelectedOperario(null)}
        filtersQuery={filtersQuery}
        hourFrom={hourRange?.from}
        hourTo={hourRange?.to}
      />
    </div>
  );
}