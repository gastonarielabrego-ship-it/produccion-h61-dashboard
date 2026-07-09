"use client";

import { useEffect, useState, useCallback } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { HourlyChart } from "@/components/dashboard/hourly-chart";
import { ByShiftChart } from "@/components/dashboard/by-shift-chart";
import { SummaryBreakdown } from "@/components/dashboard/summary-breakdown";
import { OperatorsTable } from "@/components/dashboard/operators-table";

interface DashboardTabProps {
  /** Optional funcion code to filter (e.g. "PSTD", "PXD"). Empty = all. */
  funcionFilter?: string;
  /** Additional query params from the global filter bar (date, turno, circuito) */
  baseQuery: string;
}

export function DashboardTab({ funcionFilter, baseQuery }: DashboardTabProps) {
  const [hourlyData, setHourlyData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [shiftData, setShiftData] = useState<any>(null);
  const [operatorData, setOperatorData] = useState<any>(null);

  const buildFullQuery = useCallback(() => {
    const params = new URLSearchParams(baseQuery);
    if (funcionFilter) params.set("funcion", funcionFilter);
    return params.toString();
  }, [baseQuery, funcionFilter]);

  const fetchData = useCallback(() => {
    const q = buildFullQuery();
    const base = q ? `?${q}` : "";

    Promise.all([
      fetch(`/api/production/hourly${base}`).then((r) => r.json()),
      fetch(`/api/production/summary${base}`).then((r) => r.json()),
      fetch(`/api/production/by-shift${base}`).then((r) => r.json()),
      fetch(`/api/production/operators${base}`).then((r) => r.json()),
    ]).then(([hourly, summary, shift, operators]) => {
      setHourlyData(hourly);
      setSummaryData(summary);
      setShiftData(shift);
      setOperatorData(operators);
    });
  }, [buildFullQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <SummaryCards data={summaryData} />
      <HourlyChart data={hourlyData} />
      <ByShiftChart data={shiftData} />
      <SummaryBreakdown data={summaryData} />
      <OperatorsTable data={operatorData} filtersQuery={buildFullQuery()} />
    </div>
  );
}