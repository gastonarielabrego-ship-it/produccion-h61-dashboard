"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, Factory, Activity, User, Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  circuito: string[];
  funcion: string;
  operario: string;
}

export function useProductionFilters(apiBase = "/api/production") {
  const [filters, setFilters] = useState<Filters | null>(null);
  const [filterState, setFilterState] = useState<FilterState>({
    dateFrom: "",
    dateTo: "",
    turno: "",
    circuito: [],
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
    for (const c of filterState.circuito) {
      params.append("circuito", c);
    }
    if (filterState.funcion) params.set("funcion", filterState.funcion);
    if (filterState.operario) params.set("operario", filterState.operario);
    return params.toString();
  }, [filterState, sourceParam]);

  return { filters, filterState, setFilterState, buildQuery, reloadFilters };
}

/** Multi-select component for circuito */
function CircuitoMultiSelect({
  circuits,
  selected,
  onChange,
}: {
  circuits: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = circuits.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (c: string) => {
    if (selected.includes(c)) {
      onChange(selected.filter((x) => x !== c));
    } else {
      onChange([...selected, c]);
    }
  };

  const selectAll = () => onChange(circuits.length === selected.length ? [] : [...circuits]);
  const allSelected = circuits.length > 0 && circuits.length === selected.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between text-sm font-normal"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Factory className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {selected.length === 0 ? (
              <span className="text-muted-foreground">Todos los circuitos</span>
            ) : (
              <span className="truncate">
                {selected.length === 1
                  ? selected[0]
                  : `${selected.length} circuitos`}
              </span>
            )}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* Search */}
        <div className="flex items-center border-b px-3 py-2">
          <input
            ref={inputRef}
            placeholder="Buscar circuito..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {/* Select all / clear */}
        <div className="flex items-center justify-between border-b px-3 py-1.5">
          <button
            onClick={selectAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {allSelected ? "Desmarcar todos" : "Seleccionar todos"}
          </button>
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
        {/* Options list */}
        <ScrollArea className="max-h-60">
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin resultados
              </p>
            ) : (
              filtered.map((c) => {
                const isChecked = selected.includes(c);
                return (
                  <label
                    key={c}
                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => toggle(c)}
                  >
                    <Checkbox checked={isChecked} />
                    <span className="flex-1 truncate">{c}</span>
                  </label>
                );
              })
            )}
          </div>
        </ScrollArea>
        {/* Selected badges */}
        {selected.length > 1 && (
          <div className="flex flex-wrap gap-1 border-t p-2">
            {selected.map((c) => (
              <Badge key={c} variant="secondary" className="text-xs gap-1 px-1.5 py-0">
                {c}
                <button
                  onClick={(e) => { e.stopPropagation(); toggle(c); }}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
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

          {/* Circuito — Multi-select */}
          <CircuitoMultiSelect
            circuits={filters.circuits}
            selected={filterState.circuito}
            onChange={(value) =>
              setFilterState((prev) => ({ ...prev, circuito: value }))
            }
          />

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