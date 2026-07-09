"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, Factory, Activity } from "lucide-react";

interface Filters {
  dates: number[];
  circuits: string[];
  shifts: { value: string; label: string }[];
  functions: { value: string; label: string }[];
}

interface FilterState {
  date: string;
  turno: string;
  circuito: string;
}

export function useProductionFilters() {
  const [filters, setFilters] = useState<Filters | null>(null);
  const [filterState, setFilterState] = useState<FilterState>({
    date: "",
    turno: "",
    circuito: "",
  });

  useEffect(() => {
    fetch("/api/production/dates")
      .then((r) => r.json())
      .then(setFilters);
  }, []);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (filterState.date) params.set("date", filterState.date);
    if (filterState.turno) params.set("turno", filterState.turno);
    if (filterState.circuito) params.set("circuito", filterState.circuito);
    return params.toString();
  }, [filterState]);

  return { filters, filterState, setFilterState, buildQuery };
}

export function FilterBar({
  filters,
  filterState,
  setFilterState,
}: {
  filters: Filters | null;
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
}) {
  if (!filters) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Cargando filtros...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (d: number) => {
    const s = String(d);
    return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filtros de Producción
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            value={filterState.date}
            onValueChange={(v) =>
              setFilterState((prev) => ({ ...prev, date: v === "__all__" ? "" : v }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas las fechas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las fechas</SelectItem>
              {filters.dates.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {formatDate(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterState.turno}
            onValueChange={(v) =>
              setFilterState((prev) => ({ ...prev, turno: v === "__all__" ? "" : v }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los turnos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los turnos</SelectItem>
              {filters.shifts.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterState.circuito}
            onValueChange={(v) =>
              setFilterState((prev) => ({
                ...prev,
                circuito: v === "__all__" ? "" : v,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los circuitos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los circuitos</SelectItem>
              {filters.circuits.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2">
                    <Factory className="h-3 w-3" />
                    {c}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}