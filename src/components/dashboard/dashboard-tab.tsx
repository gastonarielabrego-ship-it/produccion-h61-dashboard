"use client";

import { useEffect, useState, useCallback } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CombinedHourlyChart } from "@/components/dashboard/hourly-combined-chart";
import { DailyCombinedChart } from "@/components/dashboard/daily-combined-chart";
import { ComboChart } from "@/components/dashboard/activity-chart";

// Bypass browser HTTP cache on every data fetch
function fetchNoCache(url: string) {
  return fetch(url, { cache: "no-store" });
}

interface DashboardTabProps {
  baseQuery: string;
  apiBase?: string;
}

export function DashboardTab({ baseQuery, apiBase = "/api/production" }: DashboardTabProps) {
  const [combinedHourlyData, setCombinedHourlyData] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [activityData, setActivityData] = useState<any>(null);

  // Always use /api/production — source param is already in baseQuery
  const effectiveBase = "/api/production";

  const fetchData = useCallback(() => {
    const base = baseQuery ? `?${baseQuery}` : "";

    Promise.all([
      fetchNoCache(`${effectiveBase}/hourly-combined${base}`).then((r) => r.json()),
      fetchNoCache(`${effectiveBase}/daily-combined${base}`).then((r) => r.json()),
      fetchNoCache(`${effectiveBase}/summary${base}`).then((r) => r.json()),
      fetchNoCache(`${effectiveBase}/by-shift${base}`).then((r) => r.json()),
    ]).then(([combinedHourly, daily, summary, activity]) => {
      setCombinedHourlyData(combinedHourly);
      setDailyData(daily);
      setSummaryData(summary);
      setActivityData(activity);
    });
  }, [baseQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <SummaryCards data={summaryData} />
      <CombinedHourlyChart data={combinedHourlyData} />
      <DailyCombinedChart data={dailyData} />
      <ComboChart data={activityData} />
    </div>
  );
}