"use client";

import { useEffect, useState } from "react";
import { FilterBar, useProductionFilters } from "@/components/dashboard/filters";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { HourlyChart } from "@/components/dashboard/hourly-chart";
import { ByCircuitChart } from "@/components/dashboard/by-circuit-chart";
import { ByShiftChart } from "@/components/dashboard/by-shift-chart";
import { SummaryBreakdown } from "@/components/dashboard/summary-breakdown";
import { OperatorsTable } from "@/components/dashboard/operators-table";

export default function Home() {
  const { filters, filterState, setFilterState, buildQuery } =
    useProductionFilters();

  const [hourlyData, setHourlyData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [circuitData, setCircuitData] = useState<any>(null);
  const [shiftData, setShiftData] = useState<any>(null);
  const [operatorData, setOperatorData] = useState<any>(null);

  useEffect(() => {
    const q = buildQuery();
    const base = q ? `?${q}` : "";

    Promise.all([
      fetch(`/api/production/hourly${base}`).then((r) => r.json()),
      fetch(`/api/production/summary${base}`).then((r) => r.json()),
      fetch(`/api/production/by-circuit${base}`).then((r) => r.json()),
      fetch(`/api/production/by-shift${base}`).then((r) => r.json()),
      fetch(`/api/production/operators${base}`).then((r) => r.json()),
    ]).then(([hourly, summary, circuit, shift, operators]) => {
      setHourlyData(hourly);
      setSummaryData(summary);
      setCircuitData(circuit);
      setShiftData(shift);
      setOperatorData(operators);
    });
  }, [buildQuery]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13h2v8H3zm6-4h2v12H9zm6-6h2v18h-2zm6 10h2v8h-2z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">
                Producción H61
              </h1>
              <p className="text-xs text-muted-foreground leading-tight">
                Dashboard de Producción por Hora
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Datos: Jul 2026 · 6,054 registros
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Filters */}
        <FilterBar
          filters={filters}
          filterState={filterState}
          setFilterState={setFilterState}
        />

        {/* KPI Cards */}
        <SummaryCards data={summaryData} />

        {/* Main Hourly Chart */}
        <HourlyChart data={hourlyData} />

        {/* Two column: By Shift + By Circuit */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ByShiftChart data={shiftData} />
          <ByCircuitChart data={circuitData} />
        </div>

        {/* Breakdown: Circuits + Dates */}
        <SummaryBreakdown data={summaryData} />

        {/* Operators Table */}
        <OperatorsTable data={operatorData} />
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Producción H61 · Dashboard de Control</span>
          <span>Next.js + Prisma + Recharts</span>
        </div>
      </footer>
    </div>
  );
}