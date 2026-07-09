"use client";

import { useEffect, useState, useCallback } from "react";
import { FilterBar, useProductionFilters } from "@/components/dashboard/filters";
import { DashboardTab } from "@/components/dashboard/dashboard-tab";
import { TimeWindowTable } from "@/components/dashboard/time-window-table";
import { HeaderActions } from "@/components/dashboard/header-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Clock, Wrench, Zap, Table2 } from "lucide-react";
import { SummaryTab } from "@/components/dashboard/summary-tab";

export default function Home() {
  const { filters, filterState, setFilterState, buildQuery } =
    useProductionFilters();

  const [activeTab, setActiveTab] = useState("general");

  // Re-fetch when global filters change (date, turno, circuito)
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Re-fetch when filters change
  useEffect(() => {
    refresh();
  }, [filterState.date, filterState.turno, filterState.circuito, refresh]);

  const baseQuery = buildQuery();

  // Header info from General tab
  const infoText = `${filters ? filters.dates.length : 0} días · ${filters ? filters.circuits.length : 0} circuitos`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs text-muted-foreground hidden md:inline">
              {infoText}
            </span>
            <HeaderActions onRefresh={refresh} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        <FilterBar
          filters={filters}
          filterState={filterState}
          setFilterState={setFilterState}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="general" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              General
            </TabsTrigger>
            <TabsTrigger value="std" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              Preparación STD
            </TabsTrigger>
            <TabsTrigger value="xd" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Preparación XD
            </TabsTrigger>
            <TabsTrigger value="franjas" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Franjas
            </TabsTrigger>
            <TabsTrigger value="resumen" className="gap-1.5">
              <Table2 className="h-3.5 w-3.5" />
              Resumen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6">
            <DashboardTab key={`gen-${refreshKey}`} baseQuery={baseQuery} />
          </TabsContent>

          <TabsContent value="std" className="mt-6">
            <DashboardTab key={`std-${refreshKey}`} baseQuery={baseQuery} funcionFilter="P" />
          </TabsContent>

          <TabsContent value="xd" className="mt-6">
            <DashboardTab key={`xd-${refreshKey}`} baseQuery={baseQuery} funcionFilter="X" />
          </TabsContent>

          <TabsContent value="franjas" className="space-y-6 mt-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                <Wrench className="h-3.5 w-3.5 inline mr-1.5" />
                Preparación STD
              </h3>
              <TimeWindowTableData baseQuery={baseQuery} funcionFilter="P" refreshKey={refreshKey} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                <Zap className="h-3.5 w-3.5 inline mr-1.5" />
                Preparación XD
              </h3>
              <TimeWindowTableData baseQuery={baseQuery} funcionFilter="X" refreshKey={refreshKey} />
            </div>
          </TabsContent>

          <TabsContent value="resumen" className="mt-6">
            <SummaryTab key={`res-${refreshKey}`} baseQuery={baseQuery} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Producción H61 · Dashboard de Control</span>
          <span>Next.js + Turso + Recharts</span>
        </div>
      </footer>
    </div>
  );
}

/** Wrapper for TimeWindowTable that fetches its own data */
function TimeWindowTableData({
  baseQuery,
  funcionFilter,
  refreshKey,
}: {
  baseQuery: string;
  funcionFilter?: string;
  refreshKey: number;
}) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(baseQuery);
    if (funcionFilter) params.set("funcion", funcionFilter);
    const qs = params.toString();
    const base = qs ? `?${qs}` : "";
    fetch(`/api/production/time-window-operators${base}`)
      .then((r) => r.json())
      .then(setData);
  }, [baseQuery, funcionFilter, refreshKey]);

  return <TimeWindowTable data={data} filtersQuery={baseQuery} />;
}