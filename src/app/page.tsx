"use client";

import { useEffect, useState, useCallback } from "react";
import { FilterBar, useProductionFilters } from "@/components/dashboard/filters";
import { DashboardTab } from "@/components/dashboard/dashboard-tab";
import { TimeWindowTable } from "@/components/dashboard/time-window-table";
import { HeaderActions } from "@/components/dashboard/header-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Clock, Table2, Cog } from "lucide-react";
import { SummaryTab } from "@/components/dashboard/summary-tab";

const API_PRODUCTION = "/api/production";

export default function Home() {
  // ── Preparación state ──
  const {
    filters,
    filterState,
    setFilterState,
    buildQuery,
    reloadFilters,
  } = useProductionFilters(API_PRODUCTION);

  const [activeTab, setActiveTab] = useState("general");
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshData = useCallback(() => setRefreshKey((k) => k + 1), []);

  const refresh = useCallback(() => {
    reloadFilters();
    setFilterState({ mes: "", dateFrom: "", dateTo: "", turno: "", circuito: [], actividad: "", funcion: "", operario: "" });
    setRefreshKey((k) => k + 1);
  }, [reloadFilters]);

  useEffect(() => {
    refreshData();
  }, [filterState.mes, filterState.dateFrom, filterState.dateTo, filterState.turno, filterState.circuito.length, filterState.funcion, filterState.operario, refreshData]);

  const baseQuery = buildQuery();
  const infoText = `${filters ? filters.dates.length : 0} días · ${filters ? filters.circuits.length : 0} circuitos`;

  // ── Clarkistas state ──
  const [clarkRefreshKey, setClarkRefreshKey] = useState(0);

  const refreshClarkistas = useCallback(() => {
    setClarkRefreshKey((k) => k + 1);
  }, []);

  const isClarkistas = activeTab === "clarkistas";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v8H3zm6-4h2v12H9zm6-6h2v18h-2zm6 10h2v8h-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Producción H61</h1>
              <p className="text-xs text-muted-foreground leading-tight">Dashboard de Producción por Hora</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs text-muted-foreground hidden md:inline">{infoText}</span>
            <HeaderActions onRefresh={refresh} onRefreshClarkistas={refreshClarkistas} />
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="general" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> General
            </TabsTrigger>
            <TabsTrigger value="franjas" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Franjas
            </TabsTrigger>
            <TabsTrigger value="resumen" className="gap-1.5">
              <Table2 className="h-3.5 w-3.5" /> Resumen
            </TabsTrigger>
            <TabsTrigger value="clarkistas" className="gap-1.5">
              <Cog className="h-3.5 w-3.5" /> Clarkistas
            </TabsTrigger>
          </TabsList>

          {/* Preparación filter bar */}
          {!isClarkistas && (
            <FilterBar filters={filters} filterState={filterState} setFilterState={setFilterState} title="Preparación" />
          )}

          <TabsContent value="general" className="mt-6">
            <DashboardTab key={`gen-${refreshKey}`} baseQuery={baseQuery} apiBase={API_PRODUCTION} />
          </TabsContent>
          <TabsContent value="franjas" className="mt-6">
            <TimeWindowWrapper key={`fw-${refreshKey}`} baseQuery={baseQuery} refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="resumen" className="mt-6">
            <SummaryTab key={`res-${refreshKey}`} baseQuery={baseQuery} apiBase={API_PRODUCTION} />
          </TabsContent>

          {/* Clarkistas full section */}
          <TabsContent value="clarkistas" className="mt-6">
            <ClarkistasDashboard refreshKey={clarkRefreshKey} />
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

/** Reusable time-window wrapper — always uses /api/production, source is in baseQuery */
function TimeWindowWrapper({ baseQuery, refreshKey }: { baseQuery: string; refreshKey: number }) {
  const [data, setData] = useState<any>(null);
  const [shiftHourly, setShiftHourly] = useState<any>(null);

  useEffect(() => {
    const base = baseQuery ? `?${baseQuery}` : "";
    fetch(`/api/production/time-window-operators${base}`).then((r) => r.json()).then(setData);
    fetch(`/api/production/by-shift${base}`).then((r) => r.json()).then(setShiftHourly);
  }, [baseQuery, refreshKey]);

  return <TimeWindowTable data={data} filtersQuery={baseQuery} shiftHourly={shiftHourly} />;
}

/** Full Clarkistas section with its own filters + sub-tabs */
function ClarkistasDashboard({ refreshKey }: { refreshKey: number }) {
  const {
    filters,
    filterState,
    setFilterState,
    buildQuery,
    reloadFilters,
  } = useProductionFilters("/api/clarkistas");

  const [cRefreshKey, setCRefreshKey] = useState(0);
  const cRefreshData = useCallback(() => setCRefreshKey((k) => k + 1), []);

  // Re-fetch when parent refreshKey changes (after upload)
  useEffect(() => {
    reloadFilters();
    setCRefreshKey((k) => k + 1);
  }, [refreshKey, reloadFilters]);

  useEffect(() => {
    cRefreshData();
  }, [filterState.mes, filterState.dateFrom, filterState.dateTo, filterState.turno, filterState.circuito.length, filterState.funcion, filterState.operario, cRefreshData]);

  const cBaseQuery = buildQuery();
  const [cActiveTab, setCActiveTab] = useState("general");

  return (
    <div className="space-y-6">
      <FilterBar filters={filters} filterState={filterState} setFilterState={setFilterState} title="Clarkistas" />
      <Tabs value={cActiveTab} onValueChange={setCActiveTab}>
        <TabsList>
          <TabsTrigger value="general" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> General
          </TabsTrigger>
          <TabsTrigger value="franjas" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Franjas
          </TabsTrigger>
          <TabsTrigger value="resumen" className="gap-1.5">
            <Table2 className="h-3.5 w-3.5" /> Resumen
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-6">
          <DashboardTab key={`cg-${cRefreshKey}`} baseQuery={cBaseQuery} />
        </TabsContent>
        <TabsContent value="franjas" className="mt-6">
          <TimeWindowWrapper key={`cfw-${cRefreshKey}`} baseQuery={cBaseQuery} refreshKey={cRefreshKey} />
        </TabsContent>
        <TabsContent value="resumen" className="mt-6">
          <SummaryTab key={`cr-${cRefreshKey}`} baseQuery={cBaseQuery} />
        </TabsContent>
      </Tabs>
    </div>
  );
}