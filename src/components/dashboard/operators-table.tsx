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
import { Trophy, User } from "lucide-react";

interface OperatorsTableProps {
  data: {
    operators: { operario: string; nombre: string; total: number }[];
  } | null;
}

export function OperatorsTable({ data }: OperatorsTableProps) {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-4 h-[400px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  const maxTotal = data.operators[0]?.total || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" />
          Top 20 Operarios
        </CardTitle>
        <CardDescription>
          Operarios con mayor producción total en el período seleccionado
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[360px]">
          <div className="px-4 pb-4 space-y-2">
            {data.operators.map((op, i) => {
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
                        className={`text-xs font-bold ${
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
                      <span className="text-xs text-muted-foreground">{i + 1}</span>
                    )}
                  </div>
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {op.nombre}
                    </p>
                    <p className="text-xs text-muted-foreground">{op.operario}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-16 text-right">
                      {op.total.toLocaleString("es-AR")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}