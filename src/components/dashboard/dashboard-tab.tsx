"use client";

import { useEffect, useState, useCallback } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CombinedHourlyChart } from "@/components/dashboard/hourly-combined-chart";
import { ByShiftChart } from "@/components/dashboard/by-shift-chart";
import { SummaryBreakdown } from "@/components/dashboard/summary-breakdown";
import { OperatorsTable } from "@/components/dashboard/operators-table";

interface DashboardTabProps {
  baseQuery: string;
  apiBase?: string;
}

export function DashboardTab({ baseQuery, apiBase = "/api/production" }: DashboardTabProps) {
  const [combinedHourlyData, setCombinedHourlyData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [shiftData, setShiftData] = useState<any>(null);
  const [operatorData, setOperatorData] = useState<any>(null);

  const fetchData = useCallback(() => {
    const base = baseQuery ? `?${baseQuery}` : "";

    Promise.all([
      fetch(`${apiBase}/hourly-combined${base}`).then((r) => r.json()),
      fetch(`${apiBase}/summary${base}`).then((r) => r.json()),
      fetch(`${apiBase}/by-shift${base}`).then((r) => r.json()),
      fetch(`${apiBase}/operators${base}`).then((r) => r.json()),
    ]).then(([combinedHourly, summary, shift, operators]) => {
      setCombinedHourlyData(combinedHourly);
      setSummaryData(summary);
      setShiftData(shift);
      setOperatorData(operators);
    });
  }, [baseQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <SummaryCards data={summaryData} />
      <CombinedHourlyChart data={combinedHourlyData} />
      <ByShiftChart data={shiftData} />
      <SummaryBreakdown data={summaryData} />
      <OperatorsTable data={operatorData} filtersQuery={baseQuery} />
    </div>
  );
}