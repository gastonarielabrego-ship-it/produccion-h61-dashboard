"use client";

import { useEffect, useState, useCallback } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CombinedHourlyChart } from "@/components/dashboard/hourly-combined-chart";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { SummaryBreakdown } from "@/components/dashboard/summary-breakdown";
import { OperatorsTable } from "@/components/dashboard/operators-table";

interface DashboardTabProps {
  baseQuery: string;
  apiBase?: string;
}

export function DashboardTab({ baseQuery, apiBase = "/api/production" }: DashboardTabProps) {
  const [combinedHourlyData, setCombinedHourlyData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [activityData, setActivityData] = useState<any>(null);
  const [operatorData, setOperatorData] = useState<any>(null);

  // Always use /api/production — source param is already in baseQuery
  const effectiveBase = "/api/production";

  const fetchData = useCallback(() => {
    const base = baseQuery ? `?${baseQuery}` : "";

    Promise.all([
      fetch(`${effectiveBase}/hourly-combined${base}`).then((r) => r.json()),
      fetch(`${effectiveBase}/summary${base}`).then((r) => r.json()),
      fetch(`${effectiveBase}/by-shift${base}`).then((r) => r.json()),
      fetch(`${effectiveBase}/operators${base}`).then((r) => r.json()),
    ]).then(([combinedHourly, summary, shift, operators]) => {
      setCombinedHourlyData(combinedHourly);
      setSummaryData(summary);
      setActivityData(shift);
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
      <ActivityChart data={activityData} />
      <SummaryBreakdown data={summaryData} />
      <OperatorsTable data={operatorData} filtersQuery={baseQuery} />
    </div>
  );
}