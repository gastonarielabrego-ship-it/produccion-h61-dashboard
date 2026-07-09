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
import { Trophy, TrendingDown, User, Clock } from "lucide-react";

interface OperatorRow {
  operario: string;
  nombre: string;
  total: number;
  horasConectado: number;
}

interface OperatorsTableProps {
  data: {
    operators: OperatorRow[];
    bottomOperators: OperatorRow[];
  } | null;
}

function OperatorRowItem({
  op,
  index,
  maxTotal,
  variant,
}: {
  op: OperatorRow;
  index: number;
  maxTotal: number;
  variant: "top" | "bottom";
}) {
  const pct = maxTotal > 0 ? Math.round((op.total / maxTotal) * 100) : 0;
  const isTop = variant === "top";

  return (
    <div
      key={op.operario}
      className="flex items-center gap-3 py-2 border-b last:border-0 border-border/50"
    >
      {/* Rank */}
      <div className="w-6 text-center">
        {isTop && index < 3 ? (
          <Badge
            variant="secondary"
            className={`text-xs font-bold ${
              index === 0
                ? "bg-amber-100 text-amber-700"
                : index === 1
                ? "bg-gray-100 text-gray-600"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            {index + 1}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{index + 1}</span>
        )}
      </div>

      {/* Name */}
      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{op.nombre}</p>
        <p className="text-xs text-muted-foreground">{op.operario}</p>
      </div>

      {/* Hours connected */}
      <div className="flex items-center gap-1 flex-shrink-0 mr-1">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground w-6 text-right">
          {op.horasConectado}h
        </span>
      </div>

      {/* Bar + Total */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isTop ? "bg-emerald-500" : "bg-red-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-semibold w-16 text-right">
          {op.total.toLocaleString("es-AR")}
        </span>
      </div>
    </div>
  );
}

export function OperatorsTable({ data }: OperatorsTableProps) {
  if (!data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 h-[400px] flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const topMax = data.operators[0]?.total || 1;
  const bottomMax = data.bottomOperators[0]?.total || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Top 20 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Top 20 Más Productivos
          </CardTitle>
          <CardDescription>
            Operarios con mayor producción total en el período seleccionado
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="px-4 pb-4 space-y-0">
              {data.operators.map((op, i) => (
                <OperatorRowItem
                  key={op.operario}
                  op={op}
                  index={i}
                  maxTotal={topMax}
                  variant="top"
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Bottom 20 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4" />
            Menos Productivos
          </CardTitle>
          <CardDescription>
            Operarios con menor producción total en el período seleccionado
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="px-4 pb-4 space-y-0">
              {data.bottomOperators.map((op, i) => (
                <OperatorRowItem
                  key={op.operario}
                  op={op}
                  index={i}
                  maxTotal={bottomMax}
                  variant="bottom"
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}