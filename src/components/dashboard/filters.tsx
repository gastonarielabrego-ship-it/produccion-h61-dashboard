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
import { Filter, Factory, Activity, User } from "lucide-react";

interface Filters {
  dates: number[];
  circuits: string[];
  shifts: { value: string; label: string }[];
  functions: { value: string; label: string }[];
  operators: { value: string; label: string }[];
}

interface FilterState {
  dateFrom: string;
  dateTo: string;
  turno: string;
  circuito: string;
  funcion: string;
  operario: string;
}

export function useProductionFilters(apiBase = "/api/production") {
  const [filters, setFilters] = useState<Filters | null>(null);
  const [filterState, setFilterState] = useState<FilterState>({
    dateFrom: "",
    dateTo: "",
    turno: "",
    circuito: "",
    funcion: "",
    operario: "",
  });
  const [filterVersion, setFilterVersion] = useState(0);

  const reloadFilters = useCallback(() => setFilterVersion((v) => v + 1), []);

  // Extract source param from apiBase (e.g. "/api/clarkistas" → "clarkistas")
  const sourceParam = apiBase === "/api/clarkistas" ? "clarkistas" : undefined;

  useEffect(() => {
    const url = sourceParam
      ? `/api/production/dates?source=${sourceParam}`
      : `${apiBase}/dates`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setFilters(data);
        } else {
          // Table might not exist yet — return empty filters
          setFilters({ dates: [], circuits: [], shifts: [], functions: [], operators: [] });
        }
      })
      .catch(() => {
        setFilters({ dates: [], circuits: [], shifts: [], functions: [], operators: [] });
      });
  }, [filterVersion, apiBase, sourceParam]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (sourceParam) params.set("source", sourceParam);
    if (filterState.dateFrom) params.set("dateFrom", filterState.dateFrom);
    if (filterState.dateTo) params.set("dateTo", filterState.dateTo);
    if (filterState.turno) params.set("turno", filterState.turno);
    if (filterState.circuito) params.set("circuito", filterState.circuito);
    if (filterState.funcion) params.set("funcion", filterState.funcion);
    if (filterState.operario) params.set("operario", filterState.operario);
    return params.toString();
  }, [filterState, sourceParam]);

  return { filters, filterState, setFilterState, buildQuery, reloadFilters };
}

export function FilterBar({
  filters,
  filterState,
  setFilterState,
  title,
}: {
  filters: Filters | null;
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
  title?: string;
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

  const funcOptions = filters.functions.length > 0
    ? filters.functions
    : [
        { value: "P", label: "Preparación STD" },
        { value: "X", label: "Preparación XD" },
      ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filtros{title ? ` — ${title}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Desde */}
          <Select
            value={filterState.dateFrom}
            onValueChange={(v) =>
              setFilterState((prev) => ({ ...prev, dateFrom: v === "__all__" ? "" : v }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Desde" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Desde (todas)</SelectItem>
              {filters.dates.map((d) => (
                <SelectItem key={`from-${d}`} value={String(d)}>
                  {formatDate(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Hasta */}
          <Select
            value={filterState.dateTo}
            onValueChange={(v) =>
              setFilterState((prev) => ({ ...prev, dateTo: v === "__all__" ? "" : v }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Hasta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Hasta (todas)</SelectItem>
              {filters.dates.map((d) => (
                <SelectItem key={`to-${d}`} value={String(d)}>
                  {formatDate(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Función */}
          <Select
            value={filterState.funcion}
            onValueChange={(v) =>
              setFilterState((prev) => ({ ...prev, funcion: v === "__all__" ? "" : v }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas las funciones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las funciones</SelectItem>
              {funcOptions.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Turno */}
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

          {/* Circuito */}
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

          {/* Colaborador */}
          <Select
            value={filterState.operario}
            onValueChange={(v) =>
              setFilterState((prev) => ({
                ...prev,
                operario: v === "__all__" ? "" : v,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los colaboradores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los colaboradores</SelectItem>
              {filters.operators.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <span className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    {o.label}
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