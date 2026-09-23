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

// Parse JSON but return null if the response has an error field
function safeJsonParse(r: Response) {
  return r.json().then((data: any) => (data && data.error ? null : data));
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
      fetchNoCache(`${effectiveBase}/hourly-combined${base}`).then(safeJsonParse).catch(() => null),
      fetchNoCache(`${effectiveBase}/daily-combined${base}`).then(safeJsonParse).catch(() => null),
      fetchNoCache(`${effectiveBase}/summary${base}`).then(safeJsonParse).catch(() => null),
      fetchNoCache(`${effectiveBase}/by-shift${base}`).then(safeJsonParse).catch(() => null),
    ]).then(([combinedHourly, daily, summary, activity]) => {
      setCombinedHourlyData(combinedHourly);
      setDailyData(daily);
      setSummaryData(summary);
      setActivityData(activity);
    }).catch(() => {
      // All API calls failed — leave data as null (components show loading)
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