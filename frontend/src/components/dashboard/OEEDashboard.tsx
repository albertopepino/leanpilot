"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { oeeApi, adminApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  ReferenceLine,
  PieChart,
  Pie,
  Line,
  ComposedChart,
} from "recharts";
import MetricExplainer from "@/components/shared/MetricExplainer";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type OEESummary = {
  avg_oee: number;
  avg_availability: number;
  avg_performance: number;
  avg_quality: number;
  total_downtime_min: number;
  record_count: number;
};

type OEETrendPoint = {
  date: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
};

type ProductionLine = {
  id: number;
  name: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AUTO_REFRESH_MS = 60_000;

const WORLD_CLASS = {
  availability: 90,
  performance: 95,
  quality: 99.9,
  oee: 85,
} as const;

const PERIOD_OPTIONS = [
  { value: 7, key: "last7" },
  { value: 14, key: "last14" },
  { value: 30, key: "last30" },
  { value: 90, key: "last90" },
] as const;

/* Color constants */
const COLOR = {
  emerald: "#10b981",
  emeraldLight: "#34d399",
  emeraldDark: "#059669",
  teal: "#14b8a6",
  amber: "#f59e0b",
  amberLight: "#fbbf24",
  rose: "#f43f5e",
  roseLight: "#fb7185",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  slate400: "#94a3b8",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
} as const;

/* ------------------------------------------------------------------ */
/*  Empty defaults                                                     */
/* ------------------------------------------------------------------ */

const EMPTY_SUMMARY: OEESummary = {
  avg_oee: 0,
  avg_availability: 0,
  avg_performance: 0,
  avg_quality: 0,
  total_downtime_min: 0,
  record_count: 0,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getGaugeColor(value: number): string {
  if (value >= 85) return COLOR.emerald;
  if (value >= 60) return COLOR.amber;
  return COLOR.rose;
}

function getGaugeGlowClass(value: number): string {
  if (value >= 85) return "oee-gauge-track";
  if (value >= 60) return "oee-gauge-track-amber";
  return "oee-gauge-track-red";
}

function getGlowAnimClass(value: number): string {
  if (value >= 85) return "animate-glow-pulse";
  if (value >= 60) return "animate-glow-pulse-amber";
  return "animate-glow-pulse-red";
}

function getAccentBorder(value: number): string {
  if (value >= 85) return "border-l-emerald-500";
  if (value >= 60) return "border-l-amber-500";
  return "border-l-rose-500";
}

function TrendArrow({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.3) return null;
  const isUp = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        isUp ? "text-emerald-500" : "text-rose-500"
      }`}
    >
      {isUp ? "\u2191" : "\u2193"}
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function getOeeBgClass(value: number): string {
  if (value >= 85) return "bg-emerald-500/10 border-emerald-500/20";
  if (value >= 60) return "bg-amber-500/10 border-amber-500/20";
  return "bg-rose-500/10 border-rose-500/20";
}

function formatDateLabel(dateStr: string): string {
  if (dateStr.length <= 5) return dateStr;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
  } catch {
    return dateStr;
  }
}

function computeSixBigLosses(s: OEESummary) {
  const a = s.avg_availability;
  const p = s.avg_performance;
  const q = s.avg_quality;
  const oee = s.avg_oee;

  const availLoss = 100 - a;
  const perfLoss = a - (a * p) / 100;
  const qualLoss = (a * p) / 100 - oee;

  return [
    { key: "plannedStops",   pct: +(availLoss * 0.6).toFixed(1),  color: COLOR.rose,       family: "availability" },
    { key: "unplannedStops", pct: +(availLoss * 0.4).toFixed(1),  color: COLOR.roseLight,  family: "availability" },
    { key: "smallStops",     pct: +(perfLoss * 0.45).toFixed(1),  color: COLOR.amber,      family: "performance" },
    { key: "slowCycles",     pct: +(perfLoss * 0.55).toFixed(1),  color: COLOR.amberLight, family: "performance" },
    { key: "defects",        pct: +(qualLoss * 0.65).toFixed(1),  color: COLOR.purple,     family: "quality" },
    { key: "startupRejects", pct: +(qualLoss * 0.35).toFixed(1),  color: COLOR.blue,       family: "quality" },
  ];
}

/* ------------------------------------------------------------------ */
/*  Custom hook: useProductionLines                                    */
/* ------------------------------------------------------------------ */

function useProductionLines() {
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.getFactory();
        const factory = res.data;
        const lineList: ProductionLine[] =
          factory?.lines ??
          factory?.production_lines ??
          (Array.isArray(factory) ? factory : []);
        if (!cancelled) setLines(lineList);
      } catch {
        // Fallback: leave empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { lines, loading };
}

/* ------------------------------------------------------------------ */
/*  Custom hook: useOEEData                                            */
/* ------------------------------------------------------------------ */

function useOEEData(lineId: number, days: number) {
  const [summary, setSummary] = useState<OEESummary>(EMPTY_SUMMARY);
  const [trend, setTrend] = useState<OEETrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (silent = false) => {
      if (lineId === 0) return; // Wait for line selection
      if (!silent) setLoading(true);
      setError(null);

      try {
        const [summaryRes, trendRes] = await Promise.all([
          oeeApi.getSummary(lineId, days),
          oeeApi.getTrend(lineId, days),
        ]);

        setSummary(summaryRes.data ?? EMPTY_SUMMARY);
        setTrend(Array.isArray(trendRes.data) ? trendRes.data : []);
        setUsingFallback(false);
      } catch (err: any) {
        const msg =
          err?.response?.data?.detail ??
          err?.message ??
          "Failed to load OEE data";
        setError(msg);
        setSummary(EMPTY_SUMMARY);
        setTrend([]);
        setUsingFallback(true);
      } finally {
        setLoading(false);
      }
    },
    [lineId, days],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(true), AUTO_REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  return { summary, trend, loading, error, usingFallback, retry: () => fetchData() };
}

/* ================================================================== */
/*  Radial Gauge Component                                             */
/* ================================================================== */

function RadialGauge({
  value,
  size,
  label,
  strokeWidth = 10,
  showLabel = true,
}: {
  value: number;
  size: number;
  label?: string;
  strokeWidth?: number;
  showLabel?: boolean;
}) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(value / 100, 0), 1);
  const offset = circumference - progress * circumference;
  const color = getGaugeColor(value);
  const glowClass = getGaugeGlowClass(value);

  const fontSize = size >= 200 ? "text-5xl" : size >= 120 ? "text-2xl" : "text-lg";
  const labelSize = size >= 200 ? "text-sm" : "text-xs";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className={`-rotate-90 ${glowClass}`}
        style={
          {
            "--gauge-circumference": circumference,
            "--gauge-offset": offset,
          } as React.CSSProperties
        }
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-th-border"
        />
        {/* Colored arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{
            filter: `drop-shadow(0 0 8px ${color}60)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${fontSize} font-bold tabular-nums`} style={{ color }}>
          {value.toFixed(1)}%
        </span>
        {showLabel && label && (
          <span className={`${labelSize} text-th-text-2 mt-0.5 font-medium`}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Custom Recharts Tooltip                                            */
/* ================================================================== */

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  // Extract A, P, Q values for OEE calculation display
  const avail = payload.find((p: any) => p.dataKey === "availability");
  const perf = payload.find((p: any) => p.dataKey === "performance");
  const qual = payload.find((p: any) => p.dataKey === "quality");
  const oee = payload.find((p: any) => p.dataKey === "oee");
  const oeeValue = oee?.value ?? 0;

  // Color-code the OEE value in tooltip
  const oeeColor = oeeValue >= 85 ? "#10b981" : oeeValue >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="bg-th-bg-3 backdrop-blur-sm border border-th-border rounded-lg px-4 py-3 shadow-xl min-w-[200px]">
      <p className="text-xs text-th-text-2 mb-2 font-medium">{label}</p>
      {payload.map((entry: any, i: number) => {
        const val = entry.value ?? 0;
        const entryColor = entry.dataKey === "oee"
          ? oeeColor
          : entry.color;
        return (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entryColor }}
              />
              <span className="text-th-text">{entry.name}</span>
            </div>
            <span className="font-semibold text-th-text tabular-nums">{val.toFixed(1)}%</span>
          </div>
        );
      })}
      {/* Show OEE = A x P x Q formula */}
      {avail && perf && qual && (
        <div className="mt-2 pt-2 border-t border-th-border">
          <p className="text-[10px] text-th-text-3 font-mono tabular-nums">
            OEE = {avail.value?.toFixed(1)}% x {perf.value?.toFixed(1)}% x {qual.value?.toFixed(1)}%
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-th-text-3">Target: {WORLD_CLASS.oee}%</span>
            <span
              className="text-[10px] font-bold"
              style={{ color: oeeColor }}
            >
              {oeeValue >= WORLD_CLASS.oee ? "On Target" : `${(WORLD_CLASS.oee - oeeValue).toFixed(1)}% gap`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  KPI Card                                                           */
/* ================================================================== */

function KPICard({
  label,
  value,
  unit,
  icon,
  accentColor,
  trend: trendValue,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  accentColor: "emerald" | "amber" | "rose" | "blue";
  trend?: { direction: "up" | "down"; pct: number };
}) {
  const borderColors = {
    emerald: "border-l-emerald-500",
    amber: "border-l-amber-500",
    rose: "border-l-rose-500",
    blue: "border-l-blue-500",
  };

  const bgGradients = {
    emerald: "from-emerald-900/20 to-emerald-800/5 dark:from-emerald-900/20 dark:to-emerald-900/5",
    amber: "from-amber-900/20 to-amber-800/5 dark:from-amber-900/20 dark:to-amber-900/5",
    rose: "from-rose-900/20 to-rose-800/5 dark:from-rose-900/20 dark:to-rose-900/5",
    blue: "from-blue-900/20 to-blue-800/5 dark:from-blue-900/20 dark:to-blue-900/5",
  };

  const iconBg = {
    emerald: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    rose: "bg-rose-500/10 text-rose-400",
    blue: "bg-blue-500/10 text-blue-400",
  };

  return (
    <div
      className={`kpi-card-premium oee-dashboard-card bg-gradient-to-br ${bgGradients[accentColor]} border border-th-card-border ${borderColors[accentColor]} border-l-4 rounded-xl p-5 animate-count-up`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${iconBg[accentColor]}`}>
          {icon}
        </div>
        {trendValue && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trendValue.direction === "up"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-rose-500/10 text-rose-400"
            }`}
          >
            <svg
              className={`w-3 h-3 ${trendValue.direction === "down" ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
            {trendValue.pct.toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-sm text-th-text-2 font-medium mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-th-text tabular-nums">{value}</span>
        {unit && <span className="text-sm text-th-text-2 font-medium">{unit}</span>}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Skeleton Components                                                */
/* ================================================================== */

function SkeletonGauge() {
  return (
    <div className="flex flex-col items-center gap-4 animate-pulse">
      <div className="w-48 h-48 rounded-full bg-th-bg-3 border-8 border-th-border/30" />
      <div className="flex gap-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-th-bg-3 border-4 border-th-border/30" />
            <div className="h-3 w-16 bg-th-bg-3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonKPI() {
  return (
    <div className="bg-th-bg-2 border border-th-card-border rounded-xl p-5 animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-th-bg-3 mb-3" />
      <div className="h-3 w-20 bg-th-bg-3 rounded mb-2" />
      <div className="h-8 w-24 bg-th-bg-3 rounded" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="h-72 flex items-end gap-3 px-4 animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <div
            className="w-full bg-th-bg-3 rounded-t-md"
            style={{ height: `${30 + Math.random() * 50}%` }}
          />
          <div className="h-3 bg-th-bg-3 rounded w-8" />
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

export default function OEEDashboard({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { t } = useI18n();
  const { printView, exportToExcel } = useExport();
  const { lines, loading: linesLoading } = useProductionLines();
  const [selectedLine, setSelectedLine] = useState<number>(0);
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<"overview" | "lossAnalysis">("overview");

  useEffect(() => {
    if (lines.length > 0 && selectedLine === 0) {
      setSelectedLine(lines[0].id);
    }
  }, [lines, selectedLine]);

  const effectiveLineId = selectedLine || (lines.length > 0 ? lines[0].id : 0);
  const { summary, trend, loading, error, usingFallback, retry } =
    useOEEData(effectiveLineId, days);

  const sixLosses = computeSixBigLosses(summary);
  const totalLossPct = sixLosses.reduce((s, l) => s + l.pct, 0);

  // Compute demo "production" KPIs from the summary
  const totalProduction = useMemo(() => Math.round(summary.record_count * 350), [summary]);
  const goodUnits = useMemo(
    () => Math.round(totalProduction * (summary.avg_quality / 100)),
    [totalProduction, summary],
  );
  const defects = useMemo(() => totalProduction - goodUnits, [totalProduction, goodUnits]);

  // Trend data for Recharts
  const chartTrend = useMemo(
    () =>
      trend.map((p) => ({
        ...p,
        dateLabel: formatDateLabel(p.date),
      })),
    [trend],
  );

  // Compute trend direction by comparing first half vs second half of trend data
  const trendDirection = useMemo(() => {
    if (trend.length < 2) return { oee: 0, availability: 0, performance: 0, quality: 0 };
    const mid = Math.floor(trend.length / 2);
    const first = trend.slice(0, mid);
    const second = trend.slice(mid);
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return {
      oee: avg(second.map((p) => p.oee)) - avg(first.map((p) => p.oee)),
      availability: avg(second.map((p) => p.availability)) - avg(first.map((p) => p.availability)),
      performance: avg(second.map((p) => p.performance)) - avg(first.map((p) => p.performance)),
      quality: avg(second.map((p) => p.quality)) - avg(first.map((p) => p.quality)),
    };
  }, [trend]);

  // Downtime breakdown for donut chart
  const downtimeBreakdown = useMemo(() => {
    const losses = computeSixBigLosses(summary);
    return losses.map((l) => ({
      name: l.key,
      value: l.pct,
      color: l.color,
    }));
  }, [summary]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto" data-print-area="true" role="region" aria-label="OEE Dashboard">
      {/* -------- Header Controls -------- */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Line selector */}
        <select
          value={selectedLine}
          onChange={(e) => setSelectedLine(Number(e.target.value))}
          aria-label="Production line"
          className="px-3 py-2 border border-th-border rounded-lg bg-th-bg-2 text-th-text text-sm focus:ring-2 focus:ring-emerald-500/40 focus:outline-none transition-colors"
        >
          {linesLoading ? (
            <option>{t("dashboard.loadingLines")}</option>
          ) : lines.length === 0 ? (
            <option value={1}>{t("dashboard.noLinesAvailable")}</option>
          ) : (
            lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))
          )}
        </select>

        {/* Period selector */}
        <div className="flex rounded-lg border border-th-border overflow-hidden" role="group" aria-label="Time period">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              aria-pressed={days === opt.value}
              className={`px-3 py-2 text-sm font-medium transition-all ${
                days === opt.value
                  ? "bg-emerald-600 text-white shadow-inner"
                  : "bg-th-bg-2 text-th-text-2 hover:bg-th-bg-hover"
              }`}
            >
              {t(`dashboard.${opt.key}`)}
            </button>
          ))}
        </div>

        {/* Demo data badge */}
        {usingFallback && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-900/30 text-amber-300 border border-amber-700/50">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {t("dashboard.demoDataBadge")}
          </span>
        )}

        {/* Live indicator */}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-th-text-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          {t("dashboard.liveAutoRefresh")}
        </span>

        <ExportToolbar
          onPrint={() =>
            printView({
              title: t("common.titleDashboard"),
              subtitle: `${lines.find((l) => l.id === selectedLine)?.name || ""} — ${days} ${t("dashboard.days") || "days"}`,
            })
          }
          onExportExcel={() =>
            exportToExcel({
              filename: `OEE_Dashboard_${new Date().toISOString().slice(0, 10)}`,
              sheetName: "OEE",
              columns: [
                { key: "date", header: t("common.date"), width: 14 },
                { key: "oee", header: "OEE %", width: 10 },
                { key: "availability", header: t("dashboard.availability") || "Availability", width: 14 },
                { key: "performance", header: t("dashboard.performance") || "Performance", width: 14 },
                { key: "quality", header: t("dashboard.quality") || "Quality", width: 12 },
              ],
              rows: trend.map((p) => ({
                date: p.date,
                oee: (p.oee ?? 0).toFixed(1),
                availability: (p.availability ?? 0).toFixed(1),
                performance: (p.performance ?? 0).toFixed(1),
                quality: (p.quality ?? 0).toFixed(1),
              })),
              headerRows: [
                [
                  `${t("dashboard.avgOee") || "Avg OEE"}: ${summary.avg_oee.toFixed(1)}%`,
                  "",
                  `${t("dashboard.totalDowntime") || "Total Downtime"}: ${summary.total_downtime_min.toFixed(0)} min`,
                ],
              ],
            })
          }
        />
      </div>

      {/* -------- View Tabs -------- */}
      <div className="flex rounded-lg border border-th-border overflow-hidden w-fit" role="tablist" aria-label="Dashboard views">
        <button
          role="tab"
          aria-selected={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "overview"
              ? "bg-emerald-600 text-white shadow-inner"
              : "bg-th-bg-2 text-th-text-2 hover:bg-th-bg-hover"
          }`}
        >
          {t("dashboard.overview") || "Overview"}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "lossAnalysis"}
          onClick={() => setActiveTab("lossAnalysis")}
          className={`px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "lossAnalysis"
              ? "bg-emerald-600 text-white shadow-inner"
              : "bg-th-bg-2 text-th-text-2 hover:bg-th-bg-hover"
          }`}
        >
          {t("dashboard.lossAnalysis") || "Loss Analysis"}
        </button>
      </div>

      {/* -------- Error banner -------- */}
      {error && (
        <div className="flex items-center justify-between bg-rose-950/30 border border-rose-800/50 rounded-xl px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-rose-300">
              {error}
              {usingFallback && ` — ${t("dashboard.usingDemoData")}`}
            </span>
          </div>
          <button
            onClick={retry}
            className="px-3 py-1.5 text-sm font-medium text-rose-300 bg-rose-900/40 rounded-lg hover:bg-rose-900/60 transition-colors"
          >
            {t("dashboard.retry")}
          </button>
        </div>
      )}

      {/* -------- Demo banner -------- */}
      {usingFallback && !loading && (
        <div className="flex items-center justify-between bg-amber-950/30 border border-amber-800/50 rounded-xl px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-amber-200">
              {t("dashboard.demoBannerText")}
            </span>
          </div>
          <button
            onClick={retry}
            className="px-3 py-1.5 text-sm font-medium text-amber-200 bg-amber-900/40 rounded-lg hover:bg-amber-900/60 transition-colors"
          >
            {t("dashboard.retry")}
          </button>
        </div>
      )}

      {/* -------- Loss Analysis Tab -------- */}
      {activeTab === "lossAnalysis" && (
        <SixBigLossesWaterfall summary={summary} loading={loading} effectiveLineId={effectiveLineId} days={days} />
      )}

      {/* -------- Overview Tab -------- */}
      {activeTab === "overview" && !loading && !usingFallback && summary.record_count === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-th-bg-2 rounded-xl border border-th-border text-center">
          <svg className="w-16 h-16 text-th-text-2 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-xl font-semibold text-th-text mb-2">
            {t("dashboard.noProductionDataYet")}
          </h3>
          <p className="text-sm text-th-text-2 max-w-md mb-6">
            {t("dashboard.oeeExplanation")}
          </p>
          <button
            onClick={() => onNavigate?.("production")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20"
          >
            {t("dashboard.logFirstRecord")}
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      )}
      {activeTab === "overview" && !((!loading && !usingFallback && summary.record_count === 0)) && (
        <OverviewTabContent
          summary={summary}
          loading={loading}
          trendDirection={trendDirection}
          totalProduction={totalProduction}
          goodUnits={goodUnits}
          defects={defects}
          chartTrend={chartTrend}
          downtimeBreakdown={downtimeBreakdown}
          t={t}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  OverviewTabContent                                                 */
/* ================================================================== */

function OverviewTabContent({
  summary,
  loading,
  trendDirection,
  totalProduction,
  goodUnits,
  defects,
  chartTrend,
  downtimeBreakdown,
  t,
}: {
  summary: OEESummary;
  loading: boolean;
  trendDirection: { oee: number; availability: number; performance: number; quality: number };
  totalProduction: number;
  goodUnits: number;
  defects: number;
  chartTrend: (OEETrendPoint & { dateLabel: string })[];
  downtimeBreakdown: { name: string; value: number; color: string }[];
  t: (key: string) => string;
}) {
  return (
    <>
      {/* ================================================================ */}
      {/*  ROW 1: Hero OEE Gauge + Sub-Metrics                            */}
      {/* ================================================================ */}
      <div className={`oee-dashboard-card oee-hero-section rounded-xl border border-th-card-border p-8 ${getGlowAnimClass(summary.avg_oee)}`}>
        {loading ? (
          <SkeletonGauge />
        ) : (
          <div className="flex flex-col items-center">
            {/* Main OEE Gauge */}
            <div className="mb-4">
              <RadialGauge
                value={summary.avg_oee}
                size={220}
                label={t("dashboard.overallOee")}
                strokeWidth={14}
              />
            </div>

            {/* OEE trend arrow */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <TrendArrow delta={trendDirection.oee} />
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getOeeBgClass(summary.avg_oee)}`}>
                {t("dashboard.target") || "Target"}: {WORLD_CLASS.oee}%
              </span>
              <MetricExplainer metricKey="oee" value={summary.avg_oee} target={WORLD_CLASS.oee} />
            </div>

            {/* World-class target reference */}
            <div className="flex items-center gap-2 mb-8">
              <div className="h-px w-8 bg-emerald-500/50" />
              <span className="text-xs text-th-text-2 font-medium uppercase tracking-wider">
                {t("dashboard.worldClass")}: {WORLD_CLASS.oee}%
              </span>
              <div className="h-px w-8 bg-emerald-500/50" />
            </div>

            {/* Three sub-metric gauges */}
            <div className="flex flex-wrap justify-center gap-8 md:gap-12">
              {([
                { key: "availability", value: summary.avg_availability, target: WORLD_CLASS.availability, trend: trendDirection.availability },
                { key: "performance", value: summary.avg_performance, target: WORLD_CLASS.performance, trend: trendDirection.performance },
                { key: "quality", value: summary.avg_quality, target: WORLD_CLASS.quality, trend: trendDirection.quality },
              ] as const).map((metric) => (
                <div key={metric.key} className="flex flex-col items-center">
                  <RadialGauge
                    value={metric.value}
                    size={100}
                    strokeWidth={8}
                    showLabel={false}
                  />
                  <span className="mt-2 text-sm font-medium text-th-text inline-flex items-center gap-1">
                    {t(`dashboard.${metric.key}`)}
                    <MetricExplainer metricKey={metric.key} value={metric.value} target={metric.target} />
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-th-text-2">
                      {t("dashboard.target")}: {metric.target}%
                    </span>
                    <TrendArrow delta={metric.trend} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/*  ROW 2: KPI Cards                                               */}
      {/* ================================================================ */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonKPI key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label={t("dashboard.records") || "Total Production"}
            value={totalProduction.toLocaleString()}
            unit={t("dashboard.units") || "units"}
            accentColor="emerald"
            trend={{ direction: "up", pct: 3.2 }}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
            }
          />
          <KPICard
            label={t("dashboard.quality") || "Good Units"}
            value={goodUnits.toLocaleString()}
            unit={t("dashboard.units") || "units"}
            accentColor="blue"
            trend={{ direction: "up", pct: 1.8 }}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <KPICard
            label={t("dashboard.defects") || "Defects"}
            value={defects.toLocaleString()}
            unit={t("dashboard.units") || "units"}
            accentColor="rose"
            trend={{ direction: "down", pct: 2.1 }}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            }
          />
          <KPICard
            label={t("dashboard.totalDowntime") || "Downtime"}
            value={`${Math.floor(summary.total_downtime_min / 60)}h ${(summary.total_downtime_min % 60).toFixed(0)}m`}
            accentColor="amber"
            trend={{ direction: "down", pct: 5.4 }}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      )}

      {/* ================================================================ */}
      {/*  ROW 3: OEE Trend Chart + Downtime Breakdown                    */}
      {/* ================================================================ */}
      <OEETrendAndBreakdown
        loading={loading}
        chartTrend={chartTrend}
        downtimeBreakdown={downtimeBreakdown}
        t={t}
      />

      {/* ================================================================ */}
      {/*  OEE WATERFALL — How 100% cascades to OEE                       */}
      {/* ================================================================ */}
      <div className="oee-dashboard-card rounded-xl border border-th-card-border p-6">
        <h3 className="text-lg font-semibold text-th-text mb-2">
          {t("dashboard.oeeWaterfall") || "OEE Waterfall \u2014 Loss Cascade"}
        </h3>
        <p className="text-xs text-th-text-3 mb-6">
          {t("dashboard.oeeWaterfallDesc") || "How your total available time breaks down into OEE"}
        </p>
        {loading ? (
          <SkeletonChart />
        ) : (() => {
          const a = summary.avg_availability;
          const p = summary.avg_performance;
          const q = summary.avg_quality;
          const oee = summary.avg_oee;
          const availLoss = 100 - a;
          const perfLoss = a * (100 - p) / 100;
          const qualLoss = a * p * (100 - q) / 10000;

          const waterfallData = [
            { name: t("dashboard.totalTime") || "Total Time", value: 100, fill: COLOR.slate600, isTotal: true },
            { name: t("dashboard.availabilityLoss") || "Availability Loss", value: -availLoss, fill: COLOR.rose, isTotal: false },
            { name: t("dashboard.performanceLoss") || "Performance Loss", value: -perfLoss, fill: COLOR.amber, isTotal: false },
            { name: t("dashboard.qualityLoss") || "Quality Loss", value: -qualLoss, fill: COLOR.purple, isTotal: false },
            { name: "OEE", value: oee, fill: COLOR.emerald, isTotal: true },
          ];

          let running = 100;
          const bars = waterfallData.map((d) => {
            if (d.isTotal && d.name !== "OEE") {
              return { ...d, base: 0, height: d.value, display: d.value.toFixed(1) };
            }
            if (d.name === "OEE") {
              return { ...d, base: 0, height: oee, display: oee.toFixed(1) };
            }
            const lossAbs = Math.abs(d.value);
            running -= lossAbs;
            return { ...d, base: running, height: lossAbs, display: `-${lossAbs.toFixed(1)}` };
          });

          return (
            <div className="flex items-end justify-around gap-2 h-64 px-4">
              {bars.map((bar) => {
                const maxH = 240;
                const barH = (bar.height / 100) * maxH;
                const baseH = (bar.base / 100) * maxH;
                return (
                  <div key={bar.name} className="flex flex-col items-center flex-1 min-w-0">
                    <span className="text-xs font-bold text-th-text mb-1 tabular-nums">
                      {bar.display}%
                    </span>
                    <div className="w-full relative" style={{ height: `${maxH}px` }}>
                      <div
                        className="absolute bottom-0 left-1 right-1 rounded-t-lg transition-all duration-700"
                        style={{
                          height: `${barH}px`,
                          bottom: `${baseH}px`,
                          backgroundColor: bar.fill,
                          opacity: bar.isTotal ? 1 : 0.85,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-th-text-2 mt-2 text-center leading-tight font-medium truncate w-full">
                      {bar.name}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ================================================================ */}
      {/*  ROW 4: A/P/Q Breakdown Bar Chart + Benchmark Table             */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Grouped Bar Chart: A/P/Q per day */}
        <div className="oee-dashboard-card rounded-xl border border-th-card-border p-6">
          <h3 className="text-lg font-semibold text-th-text mb-6">
            {t("dashboard.availability")}/{t("dashboard.performance")}/{t("dashboard.quality")}
          </h3>
          {loading ? (
            <SkeletonChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR.slate700} strokeOpacity={0.3} vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fill: COLOR.slate400, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: COLOR.slate700, strokeOpacity: 0.5 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: COLOR.slate400, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<DarkTooltip />} />
                <Bar
                  dataKey="availability"
                  fill={COLOR.teal}
                  radius={[3, 3, 0, 0]}
                  name={t("dashboard.availability") || "Availability"}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="performance"
                  fill={COLOR.amber}
                  radius={[3, 3, 0, 0]}
                  name={t("dashboard.performance") || "Performance"}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="quality"
                  fill={COLOR.blue}
                  radius={[3, 3, 0, 0]}
                  name={t("dashboard.quality") || "Quality"}
                  maxBarSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* World-Class Benchmark */}
        <div className="oee-dashboard-card rounded-xl border border-th-card-border p-6">
          <h3 className="text-lg font-semibold text-th-text mb-1">
            {t("dashboard.benchmark")}
          </h3>
          <p className="text-sm text-th-text-2 mb-5">
            {t("dashboard.benchmarkDesc")}
          </p>
          {!loading && <BenchmarkTable summary={summary} />}
        </div>
      </div>

      {/* ================================================================ */}
      {/*  ROW 5: OEE Waterfall                                           */}
      {/* ================================================================ */}
      <div className="oee-dashboard-card rounded-xl border border-th-card-border p-6">
        <h3 className="text-lg font-semibold text-th-text mb-6">
          {t("dashboard.oeeWaterfall")}
        </h3>
        {loading ? <SkeletonChart /> : <OEEWaterfall summary={summary} />}
      </div>
    </>
  );
}

/* ================================================================== */
/*  OEETrendAndBreakdown — Row 3 charts                                */
/* ================================================================== */

function OEETrendAndBreakdown({
  loading,
  chartTrend,
  downtimeBreakdown,
  t,
}: {
  loading: boolean;
  chartTrend: (OEETrendPoint & { dateLabel: string })[];
  downtimeBreakdown: { name: string; value: number; color: string }[];
  t: (key: string) => string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* OEE Trend - Area Chart (2/3 width) */}
      <div className="lg:col-span-2 oee-dashboard-card rounded-xl border border-th-card-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-th-text">
            {t("dashboard.oeeTrend")}
          </h3>
          <div className="flex items-center gap-4">
            {[
              { key: "oee", color: COLOR.emerald },
              { key: "availability", color: COLOR.teal },
              { key: "performance", color: COLOR.amber },
              { key: "quality", color: COLOR.blue },
            ].map((item) => (
              <span key={item.key} className="flex items-center gap-1.5 text-xs text-th-text-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {t(`dashboard.${item.key}`)}
              </span>
            ))}
          </div>
        </div>
        {loading ? (
          <SkeletonChart />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="oeeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.emerald} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLOR.emerald} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="availGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.teal} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLOR.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLOR.slate700} strokeOpacity={0.3} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: COLOR.slate400, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: COLOR.slate700, strokeOpacity: 0.5 }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: COLOR.slate400, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<DarkTooltip />} />
              <ReferenceLine
                y={WORLD_CLASS.oee}
                stroke={COLOR.emerald}
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                label={{
                  value: `WC ${WORLD_CLASS.oee}%`,
                  position: "insideTopRight",
                  fill: COLOR.emerald,
                  fontSize: 10,
                }}
              />
              <Area
                type="monotone"
                dataKey="availability"
                stroke={COLOR.teal}
                strokeWidth={1.5}
                fill="url(#availGradient)"
                name={t("dashboard.availability") || "Availability"}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="performance"
                stroke={COLOR.amber}
                strokeWidth={1.5}
                fill="transparent"
                name={t("dashboard.performance") || "Performance"}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="quality"
                stroke={COLOR.blue}
                strokeWidth={1.5}
                fill="transparent"
                name={t("dashboard.quality") || "Quality"}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="oee"
                stroke={COLOR.emerald}
                strokeWidth={2.5}
                fill="url(#oeeGradient)"
                name="OEE"
                dot={{ r: 3, fill: COLOR.emerald, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: COLOR.emerald, stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Downtime Breakdown - Donut Chart (1/3 width) */}
      <div className="oee-dashboard-card rounded-xl border border-th-card-border p-6">
        <h3 className="text-lg font-semibold text-th-text mb-4">
          {t("dashboard.sixBigLosses")}
        </h3>
        {loading ? (
          <div className="flex items-center justify-center h-64 animate-pulse">
            <div className="w-40 h-40 rounded-full bg-th-bg-3" />
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={downtimeBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {downtimeBreakdown.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0];
                    return (
                      <div className="bg-th-bg-3 backdrop-blur-sm border border-th-border rounded-lg px-3 py-2 shadow-xl">
                        <p className="text-xs text-th-text">{t(`dashboard.${item.name}`)}</p>
                        <p className="text-sm font-semibold text-white">{(item.value as number)?.toFixed(1)}%</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="space-y-2 mt-2">
              {downtimeBreakdown.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-th-text-2">{t(`dashboard.${item.name}`)}</span>
                  </div>
                  <span className="font-medium text-th-text tabular-nums">{item.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Six Big Losses Waterfall (Loss Analysis Tab)                       */
/* ================================================================== */

const SIX_BIG_LOSSES = [
  { key: "equipmentFailure",  labelFallback: "Equipment Failure",   color: "#ef4444", family: "availability" },
  { key: "setupAdjustment",   labelFallback: "Setup & Adjustment",  color: "#f97316", family: "availability" },
  { key: "idlingMinorStops",  labelFallback: "Idling & Minor Stops",color: "#eab308", family: "performance" },
  { key: "reducedSpeed",      labelFallback: "Reduced Speed",       color: "#3b82f6", family: "performance" },
  { key: "processDefects",    labelFallback: "Process Defects",     color: "#8b5cf6", family: "quality" },
  { key: "reducedYield",      labelFallback: "Reduced Yield",       color: "#ec4899", family: "quality" },
] as const;

function SixBigLossesWaterfall({
  summary,
  loading,
  effectiveLineId,
  days,
}: {
  summary: OEESummary;
  loading: boolean;
  effectiveLineId: number;
  days: number;
}) {
  const { t } = useI18n();
  const [lossData, setLossData] = useState<{ key: string; minutes: number; color: string; label: string }[] | null>(null);

  // Try to fetch real loss data, fall back to calculated from OEE gaps
  useEffect(() => {
    if (effectiveLineId === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const endDate = new Date().toISOString().split("T")[0];
        const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
        const res = await oeeApi.getLosses?.(effectiveLineId, startDate, endDate);
        // Backend returns { losses: [...], summary: {...} } — map to frontend format
        const rawLosses = res?.data?.losses ?? (Array.isArray(res?.data) ? res.data : null);
        if (!cancelled && rawLosses && Array.isArray(rawLosses) && rawLosses.length > 0) {
          // Map backend loss categories to frontend keys
          const categoryToKey: Record<string, string> = {
            "Equipment Failure": "equipmentFailure",
            "Setup & Adjustment": "setupAdjustment",
            "Idling & Minor Stops": "idlingMinorStops",
            "Reduced Speed": "reducedSpeed",
            "Process Defects": "processDefects",
            "Reduced Yield": "reducedYield",
          };
          const mapped = SIX_BIG_LOSSES.map((loss) => {
            const backendLoss = rawLosses.find(
              (bl: { category: string }) => categoryToKey[bl.category] === loss.key
            );
            return {
              key: loss.key,
              minutes: backendLoss?.minutes_lost ?? 0,
              color: loss.color,
              label: (() => { const v = t(`dashboard.${loss.key}`); return (v && !v.startsWith("dashboard.")) ? v : loss.labelFallback; })(),
            };
          });
          setLossData(mapped);
          return;
        }
      } catch {
        // endpoint not available yet, derive from OEE
      }

      if (!cancelled) {
        // Derive losses from OEE gaps - assume 480 min/shift * days
        const totalAvailMin = 480 * Math.max(summary.record_count, days);
        const a = summary.avg_availability;
        const p = summary.avg_performance;
        const q = summary.avg_quality;

        const availLossMin = totalAvailMin * (100 - a) / 100;
        const perfLossMin = totalAvailMin * (a / 100) * (100 - p) / 100;
        const qualLossMin = totalAvailMin * (a / 100) * (p / 100) * (100 - q) / 100;

        const derived = SIX_BIG_LOSSES.map((loss) => {
          let minutes = 0;
          if (loss.family === "availability") {
            minutes = loss.key === "equipmentFailure"
              ? Math.round(availLossMin * 0.6)
              : Math.round(availLossMin * 0.4);
          } else if (loss.family === "performance") {
            minutes = loss.key === "idlingMinorStops"
              ? Math.round(perfLossMin * 0.45)
              : Math.round(perfLossMin * 0.55);
          } else {
            minutes = loss.key === "processDefects"
              ? Math.round(qualLossMin * 0.65)
              : Math.round(qualLossMin * 0.35);
          }
          return {
            key: loss.key,
            minutes,
            color: loss.color,
            label: t(`dashboard.${loss.key}`) || loss.labelFallback,
          };
        });
        setLossData(derived);
      }
    })();

    return () => { cancelled = true; };
  }, [effectiveLineId, days, summary, t]);

  if (loading || !lossData || !Array.isArray(lossData)) {
    return (
      <div className="space-y-4">
        <SkeletonChart />
      </div>
    );
  }

  const totalAvailMin = 480 * Math.max(summary.record_count, days);
  const totalLossMin = (lossData || []).reduce((s, d) => s + d.minutes, 0);
  const productiveMin = totalAvailMin - totalLossMin;

  // Build waterfall chart data: start with total available, subtract each loss, end with productive
  const waterfallData: { name: string; loss: number; remaining: number; cumLine: number; fill: string }[] = [];
  let remaining = totalAvailMin;

  waterfallData.push({
    name: t("dashboard.totalAvailable") || "Available Time",
    loss: 0,
    remaining: totalAvailMin,
    cumLine: totalAvailMin,
    fill: COLOR.slate600,
  });

  for (const loss of lossData) {
    remaining -= loss.minutes;
    waterfallData.push({
      name: loss.label,
      loss: loss.minutes,
      remaining: 0,
      cumLine: remaining,
      fill: loss.color,
    });
  }

  waterfallData.push({
    name: t("dashboard.productiveTime") || "Productive Time",
    loss: 0,
    remaining: productiveMin,
    cumLine: productiveMin,
    fill: COLOR.emerald,
  });

  const maxMin = totalAvailMin;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-th-border bg-th-bg-2 p-4 text-center">
          <p className="text-[10px] text-th-text-3 font-bold uppercase tracking-wider mb-1">{t("dashboard.totalAvailable") || "Available Time"}</p>
          <p className="text-2xl font-bold text-th-text tabular-nums">{totalAvailMin.toLocaleString()}</p>
          <p className="text-xs text-th-text-3">min</p>
        </div>
        <div className="rounded-xl border border-th-border bg-th-bg-2 p-4 text-center">
          <p className="text-[10px] text-th-text-3 font-bold uppercase tracking-wider mb-1">{t("dashboard.totalLosses") || "Total Losses"}</p>
          <p className="text-2xl font-bold text-rose-500 tabular-nums">{totalLossMin.toLocaleString()}</p>
          <p className="text-xs text-th-text-3">min</p>
        </div>
        <div className="rounded-xl border border-th-border bg-th-bg-2 p-4 text-center">
          <p className="text-[10px] text-th-text-3 font-bold uppercase tracking-wider mb-1">{t("dashboard.productiveTime") || "Productive Time"}</p>
          <p className="text-2xl font-bold text-emerald-500 tabular-nums">{productiveMin.toLocaleString()}</p>
          <p className="text-xs text-th-text-3">min</p>
        </div>
        <div className="rounded-xl border border-th-border bg-th-bg-2 p-4 text-center">
          <p className="text-[10px] text-th-text-3 font-bold uppercase tracking-wider mb-1">{t("dashboard.lossRatio") || "Loss Ratio"}</p>
          <p className="text-2xl font-bold text-amber-500 tabular-nums">{totalAvailMin > 0 ? ((totalLossMin / totalAvailMin) * 100).toFixed(1) : "0"}%</p>
        </div>
      </div>

      {/* Waterfall Bar Chart */}
      <div className="oee-dashboard-card rounded-xl border border-th-card-border p-6">
        <h3 className="text-lg font-semibold text-th-text mb-2">
          {t("dashboard.sixBigLossesWaterfall") || "Six Big Losses Waterfall"}
        </h3>
        <p className="text-xs text-th-text-3 mb-6">
          {t("dashboard.sixBigLossesDesc") || "Minutes lost per loss category with cumulative productive time line"}
        </p>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={waterfallData} margin={{ top: 20, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLOR.slate700} strokeOpacity={0.3} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: COLOR.slate400, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: COLOR.slate700, strokeOpacity: 0.5 }}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: COLOR.slate400, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}`}
                label={{ value: "min", position: "insideTopLeft", fill: COLOR.slate400, fontSize: 10 }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-th-bg-3 backdrop-blur-sm border border-th-border rounded-lg px-4 py-3 shadow-xl">
                      <p className="text-xs text-th-text-2 mb-1 font-medium">{label}</p>
                      {payload.map((entry: any, i: number) => (
                        <div key={i} className="text-sm text-th-text">
                          {entry.dataKey === "loss" && entry.value > 0 && (
                            <span className="font-semibold text-rose-400">{entry.value.toLocaleString()} min lost</span>
                          )}
                          {entry.dataKey === "remaining" && entry.value > 0 && (
                            <span className="font-semibold" style={{ color: COLOR.emerald }}>{entry.value.toLocaleString()} min</span>
                          )}
                          {entry.dataKey === "cumLine" && (
                            <div className="text-xs text-th-text-3 mt-1">Cumulative: {entry.value.toLocaleString()} min</div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {/* recharts Cell types radius as number but accepts number[] at runtime */}
              <Bar dataKey="loss" name="Loss" stackId="a" barSize={40}>
                {waterfallData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} fillOpacity={0.85} radius={[4, 4, 0, 0] as unknown as number} />
                ))}
              </Bar>
              <Bar dataKey="remaining" name="Remaining" stackId="a" barSize={40}>
                {waterfallData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.remaining > 0 ? COLOR.emerald : "transparent"} fillOpacity={0.85} radius={[4, 4, 0, 0] as unknown as number} />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="cumLine"
                stroke={COLOR.amber}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, fill: COLOR.amber, strokeWidth: 0 }}
                name="Cumulative"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Individual Loss Bars */}
      <div className="oee-dashboard-card rounded-xl border border-th-card-border p-6">
        <h3 className="text-lg font-semibold text-th-text mb-4">
          {t("dashboard.lossBreakdown") || "Loss Breakdown"}
        </h3>
        <div className="space-y-3">
          {lossData.map((loss) => {
            const pct = maxMin > 0 ? (loss.minutes / maxMin) * 100 : 0;
            return (
              <div key={loss.key} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: loss.color }} />
                <span className="text-sm text-th-text w-40 truncate">{loss.label}</span>
                <div className="flex-1 h-6 bg-th-bg-3 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg transition-all duration-700"
                    style={{ width: `${Math.max(pct, 0.5)}%`, backgroundColor: loss.color, opacity: 0.85 }}
                  />
                  <span className="absolute inset-y-0 right-2 flex items-center text-xs font-semibold text-th-text tabular-nums">
                    {loss.minutes.toLocaleString()} min
                  </span>
                </div>
                <span className="text-xs text-th-text-3 w-12 text-right tabular-nums">
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Benchmark Table                                                    */
/* ================================================================== */

function BenchmarkTable({ summary }: { summary: OEESummary }) {
  const { t } = useI18n();

  const rows = [
    { key: "availability", actual: summary.avg_availability, wc: WORLD_CLASS.availability },
    { key: "performance",  actual: summary.avg_performance,  wc: WORLD_CLASS.performance },
    { key: "quality",      actual: summary.avg_quality,      wc: WORLD_CLASS.quality },
    { key: "oee",          actual: summary.avg_oee,          wc: WORLD_CLASS.oee },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-th-border/50">
            <th className="text-left py-2 font-medium text-th-text-2" />
            <th className="text-right py-2 font-medium text-th-text-2 px-3">
              {t("dashboard.actual")}
            </th>
            <th className="text-right py-2 font-medium text-th-text-2 px-3">
              {t("dashboard.worldClass")}
            </th>
            <th className="text-right py-2 font-medium text-th-text-2 px-3">
              {t("dashboard.gap")}
            </th>
            <th className="py-2 px-3 w-40" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const gap = row.wc - row.actual;
            const pctOfWc = Math.min((row.actual / row.wc) * 100, 100);
            const isLast = row.key === "oee";
            const color = getGaugeColor(row.actual);
            return (
              <tr
                key={row.key}
                className={`border-b border-th-border/30 ${isLast ? "font-semibold" : ""}`}
              >
                <td className="py-2.5 text-th-text">
                  {t(`dashboard.${row.key}`)}
                </td>
                <td className="py-2.5 text-right px-3 tabular-nums font-semibold" style={{ color }}>
                  {row.actual.toFixed(1)}%
                </td>
                <td className="py-2.5 text-right px-3 tabular-nums text-th-text-2">
                  {row.wc}%
                </td>
                <td className={`py-2.5 text-right px-3 tabular-nums ${gap > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {gap > 0 ? `-${gap.toFixed(1)}%` : `+${Math.abs(gap).toFixed(1)}%`}
                </td>
                <td className="py-2.5 px-3">
                  <div className="h-2 bg-th-bg-3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pctOfWc}%`,
                        backgroundColor: color,
                        boxShadow: `0 0 8px ${color}40`,
                      }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================== */
/*  OEE Waterfall                                                      */
/* ================================================================== */

function OEEWaterfall({ summary }: { summary: OEESummary }) {
  const { t } = useI18n();

  const a = summary.avg_availability;
  const p = summary.avg_performance;
  const q = summary.avg_quality;
  const oee = summary.avg_oee;

  const availLoss = 100 - a;
  const perfLoss = a - (a * p) / 100;
  const qualLoss = (a * p) / 100 - oee;

  const breakdownLoss = +(availLoss * 0.36).toFixed(1);
  const setupLoss = +(availLoss - breakdownLoss).toFixed(1);
  const minorStopLoss = +(perfLoss * 0.42).toFixed(1);
  const reducedSpeedLoss = +(perfLoss - minorStopLoss).toFixed(1);
  const defectLoss = +(qualLoss * 0.67).toFixed(1);
  const startupLoss = +(qualLoss - defectLoss).toFixed(1);

  type Step = {
    key: string;
    pct: number;
    type: "start" | "loss" | "subtotal" | "result";
    color?: string;
  };

  const steps: Step[] = ([
    { key: "plannedTime",      pct: 100,                                              type: "start" as const },
    { key: "breakdowns",       pct: -breakdownLoss,                                   type: "loss" as const, color: COLOR.rose },
    { key: "setupAdjustments", pct: -setupLoss,                                       type: "loss" as const, color: COLOR.roseLight },
    { key: "availability",     pct: +a.toFixed(1) as unknown as number,               type: "subtotal" as const },
    { key: "minorStops",       pct: -minorStopLoss,                                   type: "loss" as const, color: COLOR.amber },
    { key: "reducedSpeed",     pct: -reducedSpeedLoss,                                type: "loss" as const, color: COLOR.amberLight },
    { key: "performance",      pct: +((a * p) / 100).toFixed(1) as unknown as number, type: "subtotal" as const },
    { key: "defects",          pct: -defectLoss,                                      type: "loss" as const, color: COLOR.purple },
    { key: "startupLosses",    pct: -startupLoss,                                     type: "loss" as const, color: COLOR.blue },
    { key: "oee",              pct: +oee.toFixed(1) as unknown as number,             type: "result" as const },
  ] as const).map((s) => ({ ...s, pct: Number(s.pct) }));

  let running = 100;

  return (
    <div className="space-y-1.5">
      {steps.map((step) => {
        const isLoss = step.type === "loss";
        const isSubtotal = step.type === "subtotal";
        const isResult = step.type === "result";

        let barLeft: number;
        let barWidth: number;

        if (isLoss) {
          const newRunning = running + step.pct;
          barLeft = newRunning;
          barWidth = Math.abs(step.pct);
          running = newRunning;
        } else {
          barLeft = 0;
          barWidth = step.pct;
          running = step.pct;
        }

        const barColor = isLoss
          ? step.color!
          : isResult
            ? COLOR.emerald
            : isSubtotal
              ? COLOR.teal
              : COLOR.slate600;

        const textClass = isLoss
          ? "text-th-text"
          : isResult
            ? "text-emerald-400 font-bold"
            : isSubtotal
              ? "text-teal-400 font-semibold"
              : "text-th-text";

        return (
          <div key={step.key} className="flex items-center gap-3 group">
            <div className="w-36 sm:w-44 shrink-0 text-right">
              <span className={`text-sm ${textClass}`}>
                {t(`dashboard.${step.key}`)}
              </span>
            </div>
            <div className="flex-1 relative h-7 bg-th-bg-3/50 rounded overflow-hidden">
              {isLoss && (
                <div
                  className="absolute top-0 h-full border-l border-dashed border-th-border/50"
                  style={{ left: `${barLeft + barWidth}%` }}
                />
              )}
              <div
                className="absolute top-0 h-full rounded transition-all duration-500 group-hover:brightness-125"
                style={{
                  left: `${barLeft}%`,
                  width: `${barWidth}%`,
                  backgroundColor: barColor,
                  boxShadow: isResult ? `0 0 12px ${barColor}40` : undefined,
                }}
              />
            </div>
            <div className="w-16 shrink-0">
              <span className={`text-sm tabular-nums ${textClass}`}>
                {step.pct}%
              </span>
            </div>
          </div>
        );
      })}

      {/* Scale reference */}
      <div className="flex items-center gap-3 mt-2">
        <div className="w-36 sm:w-44 shrink-0" />
        <div className="flex-1 flex justify-between text-[10px] text-th-text-2 px-0.5">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
        <div className="w-16 shrink-0" />
      </div>
    </div>
  );
}
