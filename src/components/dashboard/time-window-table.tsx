"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ArrowRightLeft, Sun, Moon } from "lucide-react";

interface OperatorRow {
  operario: string;
  nombre: string;
  window1: number;
  window2: number;
  totalGeneral: number;
  circuitCount: number;
  circuits: string[];
  entries: number;
  window1Entries: number;
  window2Entries: number;
}

interface TimeWindowData {
  operators: OperatorRow[];
  summary: {
    totalWindow1: number;
    totalWindow2: number;
    activeWindow1: number;
    activeWindow2: number;
    bothWindows: number;
    totalOperators: number;
  };
}

function WindowSummaryCards({ data }: { data: TimeWindowData["summary"] | null }) {
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

  const cards = [
    {
      title: "10:00 - 14:00",
      subtitle: "Ingreso desde las 10",
      value: data.totalWindow1.toLocaleString("es-AR"),
      detail: `${data.activeWindow1} operarios (solo ingresos 10+hs)`,
      icon: Sun,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-l-4 border-l-amber-400",
    },
    {
      title: "18:00 - 22:00",
      subtitle: "Ingreso desde las 18",
      value: data.totalWindow2.toLocaleString("es-AR"),
      detail: `${data.activeWindow2} operarios (solo ingresos 18+hs)`,
      icon: Moon,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-l-4 border-l-indigo-400",
    },
    {
      title: "Ambas Franjas",
      subtitle: "En ambas franjas",
      value: data.bothWindows.toLocaleString("es-AR"),
      detail: `de ${data.totalOperators} operarios filtrados`,
      icon: ArrowRightLeft,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-l-4 border-l-emerald-400",
    },
    {
      title: "Total Operarios",
      subtitle: "Ingresan 10+ o 18+",
      value: data.totalOperators.toLocaleString("es-AR"),
      detail: "excluidos quienes arrancan antes",
      icon: Users,
      color: "text-slate-600",
      bg: "bg-slate-50",
      border: "border-l-4 border-l-slate-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className={card.border}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {card.title}
                </span>
                <p className="text-[10px] text-muted-foreground/70">
                  {card.subtitle}
                </p>
              </div>
              <div className={`p-1.5 rounded-md ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getIntensityColor(window1: number, window2: number, maxTotal: number) {
  const combined = window1 + window2;
  const ratio = maxTotal > 0 ? combined / maxTotal : 0;
  if (ratio >= 0.7) return "bg-emerald-500";
  if (ratio >= 0.4) return "bg-amber-400";
  if (ratio > 0) return "bg-orange-300";
  return "bg-muted";
}

function getProfileBadge(window1: number, window2: number) {
  if (window1 > 0 && window2 > 0) {
    return (
      <Badge
        variant="secondary"
        className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0"
      >
        Ambas
      </Badge>
    );
  }
  if (window1 > 0) {
    return (
      <Badge
        variant="secondary"
        className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0"
      >
        10-14
      </Badge>
    );
  }
  if (window2 > 0) {
    return (
      <Badge
        variant="secondary"
        className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0"
      >
        18-22
      </Badge>
    );
  }
  return null;
}

export function TimeWindowTable({ data }: { data: TimeWindowData | null }) {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-4 h-[400px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  const maxTotal =
    data.operators.length > 0
      ? Math.max(...data.operators.map((o) => o.window1 + o.window2))
      : 1;

  const maxW1 =
    data.operators.length > 0
      ? Math.max(...data.operators.map((o) => o.window1))
      : 1;

  const maxW2 =
    data.operators.length > 0
      ? Math.max(...data.operators.map((o) => o.window2))
      : 1;

  return (
    <>
      <WindowSummaryCards data={data.summary} />

      {/* Comparison bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sun className="h-4 w-4 text-amber-500" />
              Franja 10:00 - 14:00
            </CardTitle>
            <CardDescription className="text-xs">
              Solo operarios cuyo <b>primer movimiento es a las 10hs o
              después</b> — Total:{" "}
              {data.summary.totalWindow1.toLocaleString("es-AR")} unidades
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="px-4 pb-4 space-y-1.5">
                {data.operators
                  .filter((o) => o.window1 > 0)
                  .sort((a, b) => b.window1 - a.window1)
                  .slice(0, 25)
                  .map((op, i) => {
                    const pct = Math.round((op.window1 / maxW1) * 100);
                    return (
                      <div
                        key={op.operario + "-w1"}
                        className="flex items-center gap-2 py-1.5"
                      >
                        <span className="w-5 text-xs text-muted-foreground text-right shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium truncate max-w-[140px]">
                              {op.nombre}
                            </span>
                            <span className="text-xs font-semibold text-amber-700 ml-2 shrink-0">
                              {op.window1.toLocaleString("es-AR")}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Moon className="h-4 w-4 text-indigo-500" />
              Franja 18:00 - 22:00
            </CardTitle>
            <CardDescription className="text-xs">
              Solo operarios cuyo <b>primer movimiento es a las 18hs o
              después</b> — Total:{" "}
              {data.summary.totalWindow2.toLocaleString("es-AR")} unidades
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="px-4 pb-4 space-y-1.5">
                {data.operators
                  .filter((o) => o.window2 > 0)
                  .sort((a, b) => b.window2 - a.window2)
                  .slice(0, 25)
                  .map((op, i) => {
                    const pct = Math.round((op.window2 / maxW2) * 100);
                    return (
                      <div
                        key={op.operario + "-w2"}
                        className="flex items-center gap-2 py-1.5"
                      >
                        <span className="w-5 text-xs text-muted-foreground text-right shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium truncate max-w-[140px]">
                              {op.nombre}
                            </span>
                            <span className="text-xs font-semibold text-indigo-700 ml-2 shrink-0">
                              {op.window2.toLocaleString("es-AR")}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Full comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Tabla Comparativa por Operario
          </CardTitle>
          <CardDescription>
            Solo se incluyen operarios cuyo <b>primer movimiento</b> del
            registro es a las 10hs o más tarde (franja diurna) o a las 18hs o
            más tarde (franja nocturna). Quienes ya venían produciendo desde
            antes quedan excluidos de esa franja.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[450px]">
            <div className="min-w-[700px]">
              {/* Table header */}
              <div className="grid grid-cols-[2.5rem_1fr_5.5rem_5.5rem_5.5rem_6rem_5rem] gap-2 px-4 py-2.5 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
                <span className="text-center">#</span>
                <span>Operario</span>
                <span className="text-right">10-14 hs</span>
                <span className="text-right">18-22 hs</span>
                <span className="text-right">Combinado</span>
                <span className="text-right">Total Gral.</span>
                <span className="text-center">Ingreso</span>
              </div>

              {/* Rows */}
              <div className="divide-y">
                {data.operators.map((op, i) => {
                  const combined = op.window1 + op.window2;
                  const intensityColor = getIntensityColor(
                    op.window1,
                    op.window2,
                    maxTotal
                  );
                  return (
                    <div
                      key={op.operario}
                      className="grid grid-cols-[2.5rem_1fr_5.5rem_5.5rem_5.5rem_6rem_5rem] gap-2 px-4 py-2.5 items-center hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-center text-xs text-muted-foreground">
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
                          <span className="text-xs">{i + 1}</span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {op.nombre}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {op.operario} · {op.circuitCount} circuito
                          {op.circuitCount !== 1 ? "s" : ""} ·{" "}
                          {op.circuits.slice(0, 4).join(", ")}
                          {op.circuits.length > 4 ? "..." : ""}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold text-right ${
                          op.window1 > 0
                            ? "text-amber-700"
                            : "text-muted-foreground/40"
                        }`}
                      >
                        {op.window1 > 0
                          ? op.window1.toLocaleString("es-AR")
                          : "—"}
                      </span>
                      <span
                        className={`text-sm font-semibold text-right ${
                          op.window2 > 0
                            ? "text-indigo-700"
                            : "text-muted-foreground/40"
                        }`}
                      >
                        {op.window2 > 0
                          ? op.window2.toLocaleString("es-AR")
                          : "—"}
                      </span>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm font-bold text-right">
                          {combined > 0
                            ? combined.toLocaleString("es-AR")
                            : "—"}
                        </span>
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${intensityColor}`}
                            style={{
                              width: `${
                                maxTotal > 0
                                  ? Math.round((combined / maxTotal) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-right text-muted-foreground">
                        {op.totalGeneral.toLocaleString("es-AR")}
                      </span>
                      <div className="flex justify-center">
                        {getProfileBadge(op.window1, op.window2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );
}