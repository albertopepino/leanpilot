"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/stores/useI18n";
import { productionApi, advancedLeanApi, leanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import FlowBreadcrumb from "@/components/ui/FlowBreadcrumb";
import ToolInfoCard from "@/components/ui/ToolInfoCard";
import { TOOL_INFO } from "@/lib/toolInfo";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/ToastContainer";
import {
  BarChart3,
  TrendingUp,
  Filter,
  CalendarDays,
  ClipboardCopy,
  Check,
  AlertTriangle,
  RefreshCw,
  Loader2,
  X,
  Hash,
  Layers,
  Target,
  Trophy,
  CircleDot,
  Lightbulb,
  HelpCircle,
  GitBranch,
  Search,
  ChevronDown,
} from "lucide-react";
import {
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
/* Demo data removed — component relies on API data */

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

function CustomTooltip({ active, payload, t }: { active?: boolean; payload?: { payload: Record<string, unknown> }[]; t: (key: string) => string }) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.payload;
  if (!raw) return null;
  const categoryKey = String(raw.categoryKey ?? "");
  const count = Number(raw.count ?? 0);
  const pct = Number(raw.pct ?? 0);
  const cumPct = Number(raw.cumPct ?? 0);
  const cost = Number(raw.cost ?? 0);
  return (
    <div className="rounded-xl border border-th-border bg-th-bg-2 px-4 py-3 shadow-sm text-sm">
      <p className="font-bold text-th-text mb-1.5">
        {t(`problem-solving.${categoryKey}`) || categoryKey}
      </p>
      <div className="space-y-1">
        <p className="text-th-text-2">
          <span className="text-th-text font-semibold">{count}</span> {t("problem-solving.occurrences")}
        </p>
        <p className="text-th-text-2">
          {t("problem-solving.percentage")}: <span className="text-th-text font-semibold">{pct.toFixed(1)}%</span>
        </p>
        <p className="text-th-text-2">
          {t("problem-solving.cumulative")}: <span className={`font-semibold ${cumPct <= 80 ? "text-rose-500" : "text-th-text-3"}`}>{cumPct.toFixed(1)}%</span>
        </p>
        {cost > 0 && (
          <p className="text-purple-500 font-medium mt-1">
            {fmtCurrency(cost)}
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
  const router = useRouter();
  const { printView, exportToExcel } = useExport();
  const { toasts, addToast, removeToast } = useToast();

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rawRecords: Record<string, any>[] = [];

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

      const filtered = rawRecords.filter((r) => {
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
      setItems([]);
      setIsDemo(false);
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const records: Record<string, any>[] = res.data?.records ?? res.data ?? res;
            if (Array.isArray(records) && records.length > 0) {
              const fieldMap: Record<DataSource, string> = {
                downtime: "downtime_reason",
                defects: "defect_type",
                scrap: "scrap_category",
                andon: "event_type",
              };
              const field = fieldMap[dataSource];
              const details = records
                .filter((r) => (r[field] || r.reason || r.type || r.category || "other") === item.categoryKey)
                .slice(0, 20)
                .map((r) => ({
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
          setDrillDownData([]);
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
    <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true">
      {/* Flow breadcrumb when navigated from another tool */}
      <FlowBreadcrumb currentLabel={t("common.titlePareto") || "Pareto Analysis"} />

      {/* Tool info card */}
      <ToolInfoCard info={TOOL_INFO.pareto} />

      {/* ---- Empty state ---- */}
      {!loading && items.length === 0 && (
        <div className="px-4 py-6 bg-th-bg-2 border border-th-border rounded-xl text-center text-sm text-th-text-2">
          {t("problem-solving.noParetoData") || "No data yet. Pareto analysis will appear once production records are available."}
        </div>
      )}

      {/* ---- Header ---- */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-th-text tracking-tight">{t("problem-solving.paretoTitle")}</h2>
            <p className="text-sm text-th-text-3 mt-0.5">{t("problem-solving.paretoSubtitle")}</p>
          </div>
          {isDemo && (
            <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-lg px-3 py-1 shrink-0">
              {t("problem-solving.demoData")}
            </span>
          )}
        </div>

        {/* KPI summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-3.5 h-3.5 text-th-text-3" />
              <span className="text-xs text-th-text-3 uppercase tracking-wider font-medium">{t("problem-solving.categories")}</span>
            </div>
            <div className="text-2xl font-bold text-th-text">{items.length}</div>
          </div>
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Hash className="w-3.5 h-3.5 text-th-text-3" />
              <span className="text-xs text-th-text-3 uppercase tracking-wider font-medium">{t("problem-solving.totalEvents")}</span>
            </div>
            <div className="text-2xl font-bold text-th-text">{total}</div>
          </div>
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-xs text-th-text-3 uppercase tracking-wider font-medium">{t("problem-solving.categoriesEighty")}</span>
            </div>
            <div className="text-2xl font-bold text-rose-500">{vitalCount}</div>
          </div>
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs text-th-text-3 uppercase tracking-wider font-medium">{t("problem-solving.topContributor") || "Top Contributor"}</span>
            </div>
            <div className="text-2xl font-bold text-purple-500">{topContributor ? `${topContributor.pct.toFixed(0)}%` : "\u2014"}</div>
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
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 space-y-4">
        {/* Data source tabs */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-th-text-3 mb-2 font-medium uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            {t("problem-solving.dataSource")}
          </div>
          <div className="flex flex-wrap gap-2">
            {DATA_SOURCES.map((ds) => (
              <button
                key={ds.key}
                onClick={() => setDataSource(ds.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  dataSource === ds.key
                    ? "bg-rose-500 text-white"
                    : "bg-th-bg-3 text-th-text-2 border border-th-border hover:bg-th-bg-hover"
                }`}
              >
                {t(ds.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Date range + export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-th-text-3 font-medium mr-1 uppercase tracking-wider">
            <CalendarDays className="w-3.5 h-3.5" />
            {t("problem-solving.dateRange")}:
          </div>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDatePreset(p.days)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                datePreset === p.days
                  ? "bg-indigo-500 text-white"
                  : "bg-th-bg-3 text-th-text-2 border border-th-border hover:bg-th-bg-hover"
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-th-bg-3 text-th-text-2 border border-th-border hover:bg-th-bg-hover transition-all disabled:opacity-40"
          >
            {copyFeedback ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <ClipboardCopy className="w-4 h-4" />
            )}
            {copyFeedback ? t("problem-solving.copiedCsv") : t("problem-solving.exportCsv")}
          </button>
        </div>
      </div>

      {/* ---- Chart ---- */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 relative min-h-[380px]">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-th-bg-2/80 rounded-xl flex items-center justify-center z-30">
            <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
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
                onClick={(state: { activePayload?: { payload: ComputedItem }[] }) => {
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
                  className="text-th-border"
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
            <div className="mt-4 pt-3 border-t border-th-border flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-th-text-3">
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
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-th-bg-3">
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
                  <th className="text-center py-3 px-4 font-semibold text-th-text-3 text-xs uppercase tracking-wider">
                    {t("common.actions") || "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {computed.map((item, idx) => (
                  <tr
                    key={item.id}
                    onClick={() => handleBarClick(item)}
                    className={`border-b border-th-border cursor-pointer transition-colors ${
                      selectedItem?.id === item.id
                        ? "bg-indigo-500/10"
                        : "hover:bg-th-bg-hover"
                    }`}
                  >
                    <td className="py-3 px-4 text-th-text-3">{idx + 1}</td>
                    <td className="py-3 px-4 text-th-text font-semibold">
                      <span className="flex items-center gap-2">
                        <CircleDot
                          className={`w-3 h-3 shrink-0 ${
                            item.isVital ? "text-rose-500" : "text-th-text-3"
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
                            ? "text-rose-500 font-bold"
                            : "text-th-text-3"
                        }
                      >
                        {item.cumPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-purple-500 font-medium">
                      {fmtCurrency(item.cost)}
                    </td>
                    <td className="py-3 px-4">
                      <InvestigateMenu
                        item={item}
                        t={t}
                        router={router}
                        onKaizenCreated={() => addToast(t("problem-solving.kaizenCreatedToast") || "Improvement action created", "success")}
                      />
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
        <div className="rounded-xl border border-th-border border-l-4 border-l-indigo-500 bg-th-bg-2 shadow-sm p-5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-base font-bold text-th-text">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              {t("problem-solving.drillDownTitle")} —{" "}
              <span className="text-rose-500">
                {t(`problem-solving.${selectedItem.categoryKey}`) || selectedItem.categoryKey}
              </span>
            </h3>
            <button
              onClick={() => {
                setSelectedItem(null);
                setDrillDownData([]);
              }}
              className="text-th-text-3 hover:text-th-text transition p-1.5 rounded-lg hover:bg-th-bg-3"
              aria-label={t("problem-solving.close")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-3.5 text-center">
              <div className="text-2xl font-bold text-th-text">{selectedItem.count}</div>
              <div className="text-xs text-th-text-3 uppercase tracking-wider font-medium mt-0.5">{t("problem-solving.occurrences")}</div>
            </div>
            <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-3.5 text-center">
              <div className="text-2xl font-bold text-th-text">{selectedItem.minutes} min</div>
              <div className="text-xs text-th-text-3 uppercase tracking-wider font-medium mt-0.5">{t("problem-solving.totalDowntime")}</div>
            </div>
            <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-3.5 text-center">
              <div className="text-2xl font-bold text-purple-500">
                {fmtCurrency(selectedItem.cost)}
              </div>
              <div className="text-xs text-th-text-3 uppercase tracking-wider font-medium mt-0.5">{t("problem-solving.costImpact")}</div>
            </div>
          </div>

          {/* Detail table */}
          {drillDownLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-th-border text-th-text-3">
                    <th className="text-left py-2.5 pr-4 font-medium text-xs uppercase tracking-wider">{t("problem-solving.date")}</th>
                    <th className="text-left py-2.5 pr-4 font-medium text-xs uppercase tracking-wider">{t("problem-solving.line")}</th>
                    <th className="text-right py-2.5 pr-4 font-medium text-xs uppercase tracking-wider">{t("problem-solving.duration")}</th>
                    <th className="text-right py-2.5 pr-4 font-medium text-xs uppercase tracking-wider">{t("problem-solving.cost")}</th>
                    <th className="text-left py-2.5 font-medium text-xs uppercase tracking-wider">{t("problem-solving.notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drillDownData.map((row, i) => (
                    <tr key={i} className="border-b border-th-border hover:bg-th-bg-hover transition-colors">
                      <td className="py-2.5 pr-4 text-th-text">{row.date}</td>
                      <td className="py-2.5 pr-4 text-th-text">{row.line}</td>
                      <td className="py-2.5 pr-4 text-right text-th-text tabular-nums">{row.duration} min</td>
                      <td className="py-2.5 pr-4 text-right text-purple-500 font-medium tabular-nums">
                        {fmtCurrency(row.cost)}
                      </td>
                      <td className="py-2.5 text-th-text-2">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Root Cause Analysis actions */}
          <ParetoRCAActions
            categoryKey={selectedItem.categoryKey}
            count={selectedItem.count}
            pct={selectedItem.pct}
            t={t}
          />

          {isDemo && drillDownData.length > 0 && (
            <p className="mt-2 text-xs text-th-text-3 italic">
              {t("problem-solving.demoData")}
            </p>
          )}
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

/* ── Investigate Menu (dropdown per row) ─────────────────────────── */
function InvestigateMenu({ item, t, router, onKaizenCreated }: {
  item: ComputedItem;
  t: (key: string, vars?: Record<string, string>) => string;
  router: ReturnType<typeof useRouter>;
  onKaizenCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const dropW = 256; // w-64 = 16rem = 256px
      let left = r.right - dropW;
      if (left < 8) left = 8;
      setPos({ top: r.bottom + 4, left });
    }
  }, [open]);

  const label = t(`problem-solving.${item.categoryKey}`) || item.categoryKey;
  const fromLabel = `${label} (${item.count}x, ${item.pct.toFixed(1)}%)`;

  const actions = [
    {
      icon: HelpCircle,
      title: t("problem-solving.askFiveWhys") || "Ask 5 Whys",
      desc: t("problem-solving.askFiveWhysDesc") || "Find the root cause step by step",
      color: "text-blue-600 dark:text-blue-400",
      bg: "hover:bg-blue-50 dark:hover:bg-blue-950/30",
      onClick: () => {
        const params = new URLSearchParams({ from: "pareto", fromLabel, tool: "five-why" });
        router.push(`/improvement/root-cause?${params.toString()}`);
      },
    },
    {
      icon: GitBranch,
      title: t("problem-solving.drawFishbone") || "Draw Fishbone Diagram",
      desc: t("problem-solving.drawFishboneDesc") || "Map all possible causes visually",
      color: "text-amber-600 dark:text-amber-400",
      bg: "hover:bg-amber-50 dark:hover:bg-amber-950/30",
      onClick: () => {
        const params = new URLSearchParams({ from: "pareto", fromLabel, tool: "ishikawa" });
        router.push(`/improvement/root-cause?${params.toString()}`);
      },
    },
    {
      icon: Lightbulb,
      title: t("problem-solving.createImprovement") || "Create Improvement",
      desc: t("problem-solving.createImprovementDesc") || "Track the fix as a Kaizen action",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
      onClick: async () => {
        try {
          await leanApi.createKaizen({
            title: `${t("problem-solving.createKaizenFromPareto") || "Pareto"}: ${label}`,
            description: `${t("problem-solving.topDefect") || "Top defect"} — ${item.count} ${t("problem-solving.occurrences") || "occurrences"} (${item.pct.toFixed(1)}%)`,
            category: "quality",
            priority: item.isVital ? "high" : "medium",
          });
          onKaizenCreated();
        } catch {
          // silent
        }
      },
    },
  ];

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
          item.isVital
            ? "bg-rose-600 text-white hover:bg-rose-700"
            : "bg-brand-600 text-white hover:bg-brand-700"
        }`}
      >
        <Search className="w-3.5 h-3.5" />
        {t("problem-solving.investigate") || "Investigate"}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown — fixed so it escapes overflow-hidden/auto ancestors */}
          <div
            className="fixed z-50 w-64 rounded-xl border border-th-border bg-th-bg-1 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
            style={{ top: pos.top, left: pos.left }}
          >
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    action.onClick();
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${action.bg}`}
                >
                  <Icon className={`w-4.5 h-4.5 mt-0.5 shrink-0 ${action.color}`} />
                  <div>
                    <div className={`text-sm font-semibold ${action.color}`}>{action.title}</div>
                    <div className="text-xs text-th-text-3 mt-0.5">{action.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/* ── Pareto → RCA Actions ──────────────────────────────────────────── */
function ParetoRCAActions({ categoryKey, count, pct, t }: {
  categoryKey: string;
  count: number;
  pct: number;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const router = useRouter();
  const label = t(`problem-solving.${categoryKey}`) || categoryKey;

  const navigateToRCA = (tool: "five-why" | "ishikawa") => {
    const params = new URLSearchParams({
      from: "pareto",
      fromLabel: `${label} (${count}x, ${pct.toFixed(1)}%)`,
      tool,
    });
    router.push(`/improvement/root-cause?${params.toString()}`);
  };

  return (
    <div className="mt-4 pt-4 border-t border-th-border">
      <p className="text-xs font-semibold text-th-text-2 mb-2 uppercase tracking-wider">
        {t("problem-solving.investigateRootCause") || "Investigate Root Cause"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigateToRCA("five-why")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          {t("problem-solving.startFiveWhy") || "Start 5-Why Analysis"}
        </button>
        <button
          onClick={() => navigateToRCA("ishikawa")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
        >
          <GitBranch className="w-3.5 h-3.5" />
          {t("problem-solving.startIshikawa") || "Start Ishikawa Diagram"}
        </button>
      </div>
    </div>
  );
}
