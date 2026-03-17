"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useI18n } from "@/stores/useI18n";
import { productionApi, advancedLeanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DataSource = "downtime" | "defects" | "scrap" | "andon";
type DatePreset = 7 | 14 | 30 | 90;

interface ParetoItem {
  id: number;
  categoryKey: string;
  count: number;
  minutes: number;
  cost: number;
}

interface DrillDownRecord {
  date: string;
  line: string;
  duration: number;
  cost: number;
  notes: string;
}

interface ComputedItem extends ParetoItem {
  pct: number;
  cumPct: number;
  isVital: boolean;
}

// ---------------------------------------------------------------------------
// Demo data (fallback when API is unavailable)
// ---------------------------------------------------------------------------

const DEMO_DATA: Record<DataSource, ParetoItem[]> = {
  downtime: [
    { id: 1, categoryKey: "toolBreakage", count: 23, minutes: 460, cost: 4600 },
    { id: 2, categoryKey: "materialShortage", count: 18, minutes: 360, cost: 3200 },
    { id: 3, categoryKey: "setupError", count: 14, minutes: 280, cost: 2100 },
    { id: 4, categoryKey: "qualityReject", count: 11, minutes: 165, cost: 1650 },
    { id: 5, categoryKey: "equipmentJam", count: 8, minutes: 200, cost: 1800 },
    { id: 6, categoryKey: "operatorAbsent", count: 5, minutes: 300, cost: 900 },
    { id: 7, categoryKey: "itSystemDown", count: 3, minutes: 90, cost: 750 },
    { id: 8, categoryKey: "other", count: 2, minutes: 30, cost: 120 },
  ],
  defects: [
    { id: 1, categoryKey: "dimensionError", count: 30, minutes: 0, cost: 5400 },
    { id: 2, categoryKey: "surfaceFinish", count: 22, minutes: 0, cost: 3300 },
    { id: 3, categoryKey: "assemblyMismatch", count: 15, minutes: 0, cost: 2700 },
    { id: 4, categoryKey: "materialDefect", count: 10, minutes: 0, cost: 2000 },
    { id: 5, categoryKey: "colorVariation", count: 7, minutes: 0, cost: 700 },
    { id: 6, categoryKey: "packaging", count: 4, minutes: 0, cost: 200 },
  ],
  scrap: [
    { id: 1, categoryKey: "rawMaterial", count: 35, minutes: 0, cost: 7000 },
    { id: 2, categoryKey: "rework", count: 20, minutes: 0, cost: 4000 },
    { id: 3, categoryKey: "processWaste", count: 12, minutes: 0, cost: 1800 },
    { id: 4, categoryKey: "overProduction", count: 8, minutes: 0, cost: 1600 },
    { id: 5, categoryKey: "handling", count: 5, minutes: 0, cost: 500 },
  ],
  andon: [
    { id: 1, categoryKey: "andonRed", count: 15, minutes: 320, cost: 4800 },
    { id: 2, categoryKey: "andonMaintenance", count: 12, minutes: 240, cost: 3600 },
    { id: 3, categoryKey: "andonQuality", count: 10, minutes: 200, cost: 3000 },
    { id: 4, categoryKey: "andonMaterial", count: 8, minutes: 120, cost: 1600 },
    { id: 5, categoryKey: "andonYellow", count: 6, minutes: 90, cost: 900 },
    { id: 6, categoryKey: "andonSafety", count: 3, minutes: 60, cost: 1200 },
  ],
};

const DEMO_DRILLDOWN: DrillDownRecord[] = [
  { date: "2026-03-12", line: "Line A", duration: 45, cost: 450, notes: "Worn tool tip on CNC #3" },
  { date: "2026-03-11", line: "Line B", duration: 30, cost: 300, notes: "Feed jam after shift change" },
  { date: "2026-03-10", line: "Line A", duration: 60, cost: 600, notes: "Spindle alignment issue" },
  { date: "2026-03-09", line: "Line C", duration: 25, cost: 250, notes: "Insert chipped mid-cycle" },
  { date: "2026-03-08", line: "Line A", duration: 50, cost: 500, notes: "Emergency replacement" },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATA_SOURCES: { key: DataSource; labelKey: string }[] = [
  { key: "downtime", labelKey: "problem-solving.dsDowntime" },
  { key: "defects", labelKey: "problem-solving.dsDefects" },
  { key: "scrap", labelKey: "problem-solving.dsScrap" },
  { key: "andon", labelKey: "problem-solving.dsAndon" },
];

const DATE_PRESETS: { days: DatePreset; labelKey: string }[] = [
  { days: 7, labelKey: "problem-solving.last7" },
  { days: 14, labelKey: "problem-solving.last14" },
  { days: 30, labelKey: "problem-solving.last30" },
  { days: 90, labelKey: "problem-solving.last90" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function fmtCurrency(v: number): string {
  if (v >= 1000) return `\u20AC${(v / 1000).toFixed(1)}k`;
  return `\u20AC${v}`;
}

function computePareto(items: ParetoItem[]): ComputedItem[] {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((s, i) => s + i.count, 0) || 1;
  let cum = 0;
  let crossedThreshold = false;
  return sorted.map((item, idx) => {
    cum += item.count;
    const cumPct = (cum / total) * 100;
    const isVital = !crossedThreshold;
    if (cumPct >= 80 && !crossedThreshold) crossedThreshold = true;
    return {
      ...item,
      pct: (item.count / total) * 100,
      cumPct,
      isVital: isVital || idx === 0,
    };
  });
}

function buildCsvString(computed: ComputedItem[], t: (k: string) => string): string {
  const header = [
    t("problem-solving.category"),
    t("problem-solving.count"),
    t("problem-solving.percentage"),
    t("problem-solving.cumulative"),
  ].join(",");
  const rows = computed.map(
    (c) =>
      `"${t(`problem-solving.${c.categoryKey}`) || c.categoryKey}",${c.count},${c.pct.toFixed(1)}%,${c.cumPct.toFixed(1)}%`
  );
  return [header, ...rows].join("\n");
}

// ---------------------------------------------------------------------------
// Custom Recharts Tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload, label, t }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div className="bg-th-bg-2 border border-th-border rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="font-bold text-white mb-1.5">
        {t(`problem-solving.${data.categoryKey}`) || data.categoryKey}
      </p>
      <div className="space-y-1">
        <p className="text-th-text">
          <span className="text-white font-semibold">{data.count}</span> {t("problem-solving.occurrences")}
        </p>
        <p className="text-th-text">
          {t("problem-solving.percentage")}: <span className="text-white font-semibold">{data.pct.toFixed(1)}%</span>
        </p>
        <p className="text-th-text">
          {t("problem-solving.cumulative")}: <span className={`font-semibold ${data.cumPct <= 80 ? "text-rose-400" : "text-th-text-2"}`}>{data.cumPct.toFixed(1)}%</span>
        </p>
        {data.cost > 0 && (
          <p className="text-purple-400 font-medium mt-1">
            {fmtCurrency(data.cost)}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ParetoChart() {
  const { t } = useI18n();
  const { printView, exportToExcel } = useExport();

  // State
  const [dataSource, setDataSource] = useState<DataSource>("downtime");
  const [datePreset, setDatePreset] = useState<DatePreset>(30);
  const [items, setItems] = useState<ParetoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ComputedItem | null>(null);
  const [drillDownData, setDrillDownData] = useState<DrillDownRecord[]>([]);
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // -----------------------------------------------------------------------
  // Computed Pareto data
  // -----------------------------------------------------------------------

  const computed = useMemo(() => computePareto(items), [items]);

  const total = useMemo(() => computed.reduce((s, i) => s + i.count, 0), [computed]);
  const vitalCount = useMemo(() => computed.filter((c) => c.isVital).length, [computed]);
  const totalCost = useMemo(() => computed.reduce((s, i) => s + i.cost, 0), [computed]);
  const topContributor = computed.length > 0 ? computed[0] : null;

  // Chart data for Recharts
  const chartData = useMemo(
    () =>
      computed.map((item) => ({
        ...item,
        name: t(`problem-solving.${item.categoryKey}`) || item.categoryKey,
      })),
    [computed, t]
  );

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedItem(null);
    setDrillDownData([]);

    const startDate = daysAgo(datePreset);

    try {
      let rawRecords: any[] = [];

      if (dataSource === "andon") {
        const res = await advancedLeanApi.getAndonStatus();
        const payload = res.data?.events ?? res.data?.active ?? res.data ?? res;
        rawRecords = Array.isArray(payload) ? payload : [];
      } else {
        const res = await productionApi.listRecords();
        const payload = res.data?.records ?? res.data ?? res;
        rawRecords = Array.isArray(payload) ? payload : [];
      }

      if (rawRecords.length === 0) throw new Error("empty");

      const start = new Date(startDate);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const filtered = rawRecords.filter((r: any) => {
        const d = new Date(r.created_at || r.date || r.timestamp || r.started_at);
        return d >= start && d <= end;
      });

      if (filtered.length === 0) throw new Error("empty-range");

      const fieldMap: Record<DataSource, string> = {
        downtime: "downtime_reason",
        defects: "defect_type",
        scrap: "scrap_category",
        andon: "event_type",
      };
      const field = fieldMap[dataSource];
      const agg = new Map<string, { count: number; minutes: number; cost: number }>();

      for (const r of filtered) {
        const key = r[field] || r.reason || r.type || r.category || "other";
        const existing = agg.get(key) || { count: 0, minutes: 0, cost: 0 };
        existing.count += 1;
        existing.minutes += Number(r.duration_minutes || r.minutes || r.duration || 0);
        existing.cost += Number(r.cost || r.unit_cost || r.estimated_cost || 0);
        agg.set(key, existing);
      }

      if (agg.size === 0) throw new Error("no-categories");

      const result: ParetoItem[] = [];
      let id = 1;
      for (const [key, val] of Array.from(agg.entries())) {
        result.push({ id: id++, categoryKey: key, ...val });
      }

      setItems(result);
      setIsDemo(false);
    } catch {
      setItems(DEMO_DATA[dataSource]);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, [dataSource, datePreset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Drill-down
  // -----------------------------------------------------------------------

  const handleBarClick = useCallback(
    (item: ComputedItem) => {
      if (selectedItem?.id === item.id) {
        setSelectedItem(null);
        setDrillDownData([]);
        return;
      }
      setSelectedItem(item);
      setDrillDownLoading(true);

      (async () => {
        try {
          if (!isDemo) {
            const res = await productionApi.listRecords();
            const records: any[] = res.data?.records ?? res.data ?? res;
            if (Array.isArray(records) && records.length > 0) {
              const fieldMap: Record<DataSource, string> = {
                downtime: "downtime_reason",
                defects: "defect_type",
                scrap: "scrap_category",
                andon: "event_type",
              };
              const field = fieldMap[dataSource];
              const details = records
                .filter((r: any) => (r[field] || r.reason || r.type || r.category || "other") === item.categoryKey)
                .slice(0, 20)
                .map((r: any) => ({
                  date: (r.created_at || r.date || r.timestamp || "").slice(0, 10),
                  line: r.line_name || r.line || r.area || "-",
                  duration: Number(r.duration_minutes || r.minutes || r.duration || 0),
                  cost: Number(r.cost || r.unit_cost || 0),
                  notes: r.notes || r.description || r.comment || "-",
                }));
              if (details.length > 0) {
                setDrillDownData(details);
                setDrillDownLoading(false);
                return;
              }
            }
          }
          throw new Error("fallback");
        } catch {
          setDrillDownData(DEMO_DRILLDOWN);
        } finally {
          setDrillDownLoading(false);
        }
      })();
    },
    [selectedItem, isDemo, dataSource]
  );

  // -----------------------------------------------------------------------
  // Export CSV
  // -----------------------------------------------------------------------

  const handleExportCsv = useCallback(() => {
    const csv = buildCsvString(computed, t);
    navigator.clipboard.writeText(csv).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  }, [computed, t]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-5 max-w-5xl mx-auto" data-print-area="true">
      {/* ---- Demo data banner ---- */}
      {isDemo && (
        <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-sm backdrop-blur-sm">
          <span className="text-amber-700 dark:text-amber-400 font-medium">{"\u26A0\uFE0F"} {t("dashboard.demoDataBadge")} {"\u2014"} {t("dashboard.usingDemoData")}</span>
          <button onClick={() => fetchData()} className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-semibold underline transition">
            {t("dashboard.retry")}
          </button>
        </div>
      )}

      {/* ---- Header ---- */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-950 border border-th-border p-6 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 to-pink-500/5 pointer-events-none" />
        <div className="relative flex items-center gap-4 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-white tracking-tight">{t("problem-solving.paretoTitle")}</h2>
            <p className="text-sm text-white/60 mt-0.5">{t("problem-solving.paretoSubtitle")}</p>
          </div>
          {isDemo && (
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-3 py-1 backdrop-blur-sm shrink-0">
              {t("problem-solving.demoData")}
            </span>
          )}
        </div>

        {/* KPI summary cards */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-th-bg-3 backdrop-blur-sm rounded-xl p-3.5 border border-th-border/50">
            <div className="text-3xl font-bold text-white">{items.length}</div>
            <div className="text-xs text-white/50 uppercase tracking-wider font-medium mt-1">{t("problem-solving.categories")}</div>
          </div>
          <div className="bg-th-bg-3 backdrop-blur-sm rounded-xl p-3.5 border border-th-border/50">
            <div className="text-3xl font-bold text-white">{total}</div>
            <div className="text-xs text-white/50 uppercase tracking-wider font-medium mt-1">{t("problem-solving.totalEvents")}</div>
          </div>
          <div className="bg-th-bg-3 backdrop-blur-sm rounded-xl p-3.5 border border-th-border/50">
            <div className="text-3xl font-bold text-rose-400">{vitalCount}</div>
            <div className="text-xs text-white/50 uppercase tracking-wider font-medium mt-1">{t("problem-solving.categoriesEighty")}</div>
          </div>
          <div className="bg-th-bg-3 backdrop-blur-sm rounded-xl p-3.5 border border-th-border/50">
            <div className="text-3xl font-bold text-purple-400">{topContributor ? `${topContributor.pct.toFixed(0)}%` : "\u2014"}</div>
            <div className="text-xs text-white/50 uppercase tracking-wider font-medium mt-1">{t("problem-solving.topContributor") || "Top Contributor"}</div>
          </div>
        </div>
      </div>

      {/* ---- Export ---- */}
      <ExportToolbar
        onPrint={() => printView(t("common.titlePareto"))}
        onExportExcel={() =>
          exportToExcel({
            title: t("common.titlePareto"),
            columns: [
              t("problem-solving.category") || "Category",
              t("problem-solving.count") || "Count",
              t("problem-solving.percentage") || "Percentage",
              t("problem-solving.cumulativePct") || "Cumulative %",
            ],
            rows: computed.map((item) => [
              t(`problem-solving.${item.categoryKey}`) || item.categoryKey,
              String(item.count),
              `${item.pct.toFixed(1)}%`,
              `${item.cumPct.toFixed(1)}%`,
            ]),
          })
        }
      />

      {/* ---- Filters ---- */}
      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-white/5 shadow-card space-y-4">
        {/* Data source tabs */}
        <div>
          <div className="text-xs text-th-text-3 mb-2 font-medium uppercase tracking-wider">{t("problem-solving.dataSource")}</div>
          <div className="flex flex-wrap gap-2">
            {DATA_SOURCES.map((ds) => (
              <button
                key={ds.key}
                onClick={() => setDataSource(ds.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  dataSource === ds.key
                    ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/20"
                    : "bg-white dark:bg-white/5 text-th-text-2 border border-slate-200/50 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10"
                }`}
              >
                {t(ds.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Date range + export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-th-text-3 font-medium mr-1 uppercase tracking-wider">{t("problem-solving.dateRange")}:</div>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDatePreset(p.days)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                datePreset === p.days
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/20"
                  : "bg-white dark:bg-white/5 text-th-text-2 border border-slate-200/50 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10"
              }`}
            >
              {t(p.labelKey)}
            </button>
          ))}

          <div className="flex-1" />

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            disabled={computed.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-white/5 text-th-text-2 border border-slate-200/50 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all disabled:opacity-40"
          >
            {copyFeedback ? t("problem-solving.copiedCsv") : t("problem-solving.exportCsv")}
          </button>
        </div>
      </div>

      {/* ---- Chart ---- */}
      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-white/5 shadow-card relative min-h-[380px]">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl flex items-center justify-center z-30">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-rose-500/20 rounded-full" />
              <div className="absolute inset-0 w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex items-center justify-center h-64 text-th-text-3">
            <p>{t("problem-solving.loadError")}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && computed.length === 0 && (
          <div className="flex items-center justify-center h-64 text-th-text-3">
            <p>{t("problem-solving.noData")}</p>
          </div>
        )}

        {/* Recharts Pareto Chart */}
        {!loading && computed.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 40, bottom: 20, left: 10 }}
                onClick={(state: any) => {
                  if (state?.activePayload?.[0]?.payload) {
                    handleBarClick(state.activePayload[0].payload);
                  }
                }}
              >
                <defs>
                  <linearGradient id="barGradientVital" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={1} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="barGradientTrivial" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64748b" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#64748b" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-slate-200 dark:text-white/5"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border-primary)" }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  content={<CustomTooltip t={t} />}
                  cursor={{ fill: "var(--bg-hover)", opacity: 0.5 }}
                />
                <ReferenceLine
                  yAxisId="right"
                  y={80}
                  stroke="#f43f5e"
                  strokeDasharray="8 4"
                  strokeWidth={2}
                  label={{
                    value: "80%",
                    position: "insideTopRight",
                    fill: "#f43f5e",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  maxBarSize={60}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isVital ? "url(#barGradientVital)" : "url(#barGradientTrivial)"}
                      stroke={selectedItem?.id === entry.id ? "#6366f1" : "none"}
                      strokeWidth={selectedItem?.id === entry.id ? 2 : 0}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumPct"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ fill: "#fff", stroke: "#6366f1", strokeWidth: 2, r: 4 }}
                  activeDot={{ fill: "#6366f1", stroke: "#fff", strokeWidth: 2, r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-white/5 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-th-text-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-b from-rose-500 to-rose-500/60" />
                <span className="font-medium">{t("problem-solving.vitalFew")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gradient-to-b from-slate-500/60 to-slate-500/25" />
                <span className="font-medium">{t("problem-solving.usefulMany")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-indigo-500" />
                <span className="font-medium">{t("problem-solving.cumulativeLine")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0 border-t-2 border-dashed border-rose-500" />
                <span className="font-medium">{t("problem-solving.threshold80")}</span>
              </div>
            </div>

            {/* 80% summary */}
            <p className="mt-2 text-sm text-th-text-2 font-medium">
              {t("problem-solving.summaryEighty", { count: vitalCount })}
            </p>
          </>
        )}
      </div>

      {/* ---- Data Table ---- */}
      {!loading && computed.length > 0 && (
        <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-white/5 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-white/5">
                  <th className="text-left py-3 px-4 font-semibold text-th-text-3 text-xs uppercase tracking-wider">#</th>
                  <th className="text-left py-3 px-4 font-semibold text-th-text-3 text-xs uppercase tracking-wider">
                    {t("problem-solving.category")}
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-th-text-3 text-xs uppercase tracking-wider">
                    {t("problem-solving.count")}
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-th-text-3 text-xs uppercase tracking-wider">
                    {t("problem-solving.percentage")}
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-th-text-3 text-xs uppercase tracking-wider">
                    {t("problem-solving.cumulative")}
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-th-text-3 text-xs uppercase tracking-wider">
                    {t("problem-solving.cost") || "Cost"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {computed.map((item, idx) => (
                  <tr
                    key={item.id}
                    onClick={() => handleBarClick(item)}
                    className={`border-b border-slate-200/30 dark:border-white/5 cursor-pointer transition-colors ${
                      selectedItem?.id === item.id
                        ? "bg-indigo-50 dark:bg-indigo-950/20"
                        : "hover:bg-slate-50/50 dark:hover:bg-white/5"
                    }`}
                  >
                    <td className="py-3 px-4 text-th-text-3">{idx + 1}</td>
                    <td className="py-3 px-4 text-th-text font-semibold">
                      <span className="flex items-center gap-2">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-sm shrink-0 ${
                            item.isVital ? "bg-rose-500" : "bg-slate-400 dark:bg-slate-600"
                          }`}
                        />
                        {t(`problem-solving.${item.categoryKey}`) || item.categoryKey}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-th-text tabular-nums font-bold">{item.count}</td>
                    <td className="py-3 px-4 text-right text-th-text tabular-nums">{item.pct.toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span
                        className={
                          item.cumPct <= 80
                            ? "text-rose-600 dark:text-rose-400 font-bold"
                            : "text-th-text-3"
                        }
                      >
                        {item.cumPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-purple-600 dark:text-purple-400 font-medium">
                      {fmtCurrency(item.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Drill-down Panel ---- */}
      {selectedItem && (
        <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-2xl p-5 border-l-4 border-l-indigo-500 border border-slate-200/50 dark:border-white/5 shadow-card animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-th-text">
              {t("problem-solving.drillDownTitle")} {"\u2014"}{" "}
              <span className="text-rose-600 dark:text-rose-400">
                {t(`problem-solving.${selectedItem.categoryKey}`) || selectedItem.categoryKey}
              </span>
            </h3>
            <button
              onClick={() => {
                setSelectedItem(null);
                setDrillDownData([]);
              }}
              className="text-th-text-3 hover:text-th-text transition text-lg leading-none px-2 py-1 rounded-lg hover:bg-th-bg-3"
              aria-label={t("problem-solving.close")}
            >
              {"\u2715"}
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/60 dark:bg-white/[0.03] rounded-xl p-3.5 text-center border border-slate-200/50 dark:border-white/5">
              <div className="text-2xl font-bold text-th-text">{selectedItem.count}</div>
              <div className="text-xs text-th-text-3 uppercase tracking-wider font-medium mt-0.5">{t("problem-solving.occurrences")}</div>
            </div>
            <div className="bg-white/60 dark:bg-white/[0.03] rounded-xl p-3.5 text-center border border-slate-200/50 dark:border-white/5">
              <div className="text-2xl font-bold text-th-text">{selectedItem.minutes} min</div>
              <div className="text-xs text-th-text-3 uppercase tracking-wider font-medium mt-0.5">{t("problem-solving.totalDowntime")}</div>
            </div>
            <div className="bg-white/60 dark:bg-white/[0.03] rounded-xl p-3.5 text-center border border-purple-200/50 dark:border-purple-500/10">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {fmtCurrency(selectedItem.cost)}
              </div>
              <div className="text-xs text-th-text-3 uppercase tracking-wider font-medium mt-0.5">{t("problem-solving.costImpact")}</div>
            </div>
          </div>

          {/* Detail table */}
          {drillDownLoading ? (
            <div className="flex justify-center py-8">
              <div className="relative">
                <div className="w-8 h-8 border-3 border-rose-500/20 rounded-full" />
                <div className="absolute inset-0 w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200/50 dark:border-white/5 text-th-text-3">
                    <th className="text-left py-2.5 pr-4 font-medium text-xs uppercase tracking-wider">{t("problem-solving.date")}</th>
                    <th className="text-left py-2.5 pr-4 font-medium text-xs uppercase tracking-wider">{t("problem-solving.line")}</th>
                    <th className="text-right py-2.5 pr-4 font-medium text-xs uppercase tracking-wider">{t("problem-solving.duration")}</th>
                    <th className="text-right py-2.5 pr-4 font-medium text-xs uppercase tracking-wider">{t("problem-solving.cost")}</th>
                    <th className="text-left py-2.5 font-medium text-xs uppercase tracking-wider">{t("problem-solving.notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drillDownData.map((row, i) => (
                    <tr key={i} className="border-b border-slate-200/30 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-2.5 pr-4 text-th-text">{row.date}</td>
                      <td className="py-2.5 pr-4 text-th-text">{row.line}</td>
                      <td className="py-2.5 pr-4 text-right text-th-text tabular-nums">{row.duration} min</td>
                      <td className="py-2.5 pr-4 text-right text-purple-600 dark:text-purple-400 font-medium tabular-nums">
                        {fmtCurrency(row.cost)}
                      </td>
                      <td className="py-2.5 text-th-text-2">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isDemo && drillDownData.length > 0 && (
            <p className="mt-2 text-xs text-th-text-3 italic">
              {t("problem-solving.demoData")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
