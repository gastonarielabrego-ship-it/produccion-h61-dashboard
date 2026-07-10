"use client";

import { useEffect, useState, useCallback } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { HourlyChart } from "@/components/dashboard/hourly-chart";
import { ByShiftChart } from "@/components/dashboard/by-shift-chart";
import { MissionsHourlyChart } from "@/components/dashboard/missions-hourly-chart";
import { SummaryBreakdown } from "@/components/dashboard/summary-breakdown";
import { OperatorsTable } from "@/components/dashboard/operators-table";

interface DashboardTabProps {
  baseQuery: string;
}

export function DashboardTab({ baseQuery }: DashboardTabProps) {
  const [hourlyData, setHourlyData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [shiftData, setShiftData] = useState<any>(null);
  const [operatorData, setOperatorData] = useState<any>(null);
  const [missionsHourlyData, setMissionsHourlyData] = useState<any>(null);

  const fetchData = useCallback(() => {
    const base = baseQuery ? `?${baseQuery}` : "";

    Promise.all([
      fetch(`/api/production/hourly${base}`).then((r) => r.json()),
      fetch(`/api/production/summary${base}`).then((r) => r.json()),
      fetch(`/api/production/by-shift${base}`).then((r) => r.json()),
      fetch(`/api/production/operators${base}`).then((r) => r.json()),
      fetch(`/api/production/missions-hourly${base}`).then((r) => r.json()),
    ]).then(([hourly, summary, shift, operators, missionsHourly]) => {
      setHourlyData(hourly);
      setSummaryData(summary);
      setShiftData(shift);
      setOperatorData(operators);
      setMissionsHourlyData(missionsHourly);
    });
  }, [baseQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <SummaryCards data={summaryData} />
      <HourlyChart data={hourlyData} />
      <MissionsHourlyChart data={missionsHourlyData} />
      <ByShiftChart data={shiftData} />
      <SummaryBreakdown data={summaryData} />
      <OperatorsTable data={operatorData} filtersQuery={baseQuery} />
    </div>
  );
}