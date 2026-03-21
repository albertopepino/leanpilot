"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { oeeApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import { AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface LineSummary {
  line_id: number;
  line_name: string;
  avg_oee: number;
  avg_availability: number;
  avg_performance: number;
  avg_quality: number;
  record_count: number;
  total_downtime_min: number;
}

interface FactorySummary {
  avg_oee: number;
  avg_availability: number;
  avg_performance: number;
  avg_quality: number;
  record_count: number;
  total_downtime_min: number;
}

interface TrendPoint {
  date: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  line_count: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function oeeColor(v: number): string {
  if (v >= 85) return "text-green-600 dark:text-green-400";
  if (v >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function oeeBg(v: number): string {
  if (v >= 85) return "bg-green-500";
  if (v >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function formatDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Donut SVG ──────────────────────────────────────────────────────────────

function DonutGauge({ value, size = 110, label }: { value: number; size?: number; label: string }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(value, 100) / 100) * circ;
  const color = value >= 85 ? "#22c55e" : value >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          className="stroke-th-border" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${oeeColor(value)}`}>{value.toFixed(1)}%</span>
      </div>
      </div>
      <span className="text-xs font-medium text-th-text-2 mt-1">{label}</span>
    </div>
  );
}

// ─── Sparkline SVG ──────────────────────────────────────────────────────────

function Sparkline({ data, width = 200, height = 48, color = "#6366f1" }: {
  data: number[]; width?: number; height?: number; color?: string;
}) {
  if (data.length < 2) return <div style={{ width, height }} className="bg-th-bg rounded" />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ConsolidatedOEE() {
  const { t } = useI18n();
  const { printView, exportToCSV } = useExport();

  // Date range state
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [days, setDays] = useState(30);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Data state
  const [lines, setLines] = useState<LineSummary[]>([]);
  const [factorySummary, setFactorySummary] = useState<FactorySummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Sort state
  const [sortKey, setSortKey] = useState<keyof LineSummary>("avg_oee");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = mode === "custom" && startDate && endDate
        ? { start_date: startDate, end_date: endDate }
        : { days };

      const [summaryRes, trendRes] = await Promise.all([
        oeeApi.getConsolidatedSummary(params),
        oeeApi.getConsolidatedTrend(params),
      ]);

      setLines(summaryRes.data.lines || []);
      setFactorySummary(summaryRes.data.factory_summary || null);
      setTrend(trendRes.data || []);
    } catch (err: unknown) {
      console.error("Consolidated OEE error:", err);
      setError(t("common.failedToLoadData"));
      setFactorySummary(null);
      setLines([]);
      setTrend([]);
    } finally {
      setLoading(false);
    }
  }, [mode, days, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedLines = useMemo(() => {
    return [...lines].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [lines, sortKey, sortDir]);

  const toggleSort = (key: keyof LineSummary) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  // ─── Trend chart (SVG) ──────────────────────────────────────────────────

  const chartW = 700, chartH = 200, pad = 40;

  const trendChart = useMemo(() => {
    if (trend.length < 2) return null;
    const maxOee = Math.max(...trend.map(pt => pt.oee), 100);
    const minOee = Math.min(...trend.map(pt => pt.oee), 0);
    const range = maxOee - minOee || 1;

    function toY(v: number) { return chartH - pad - ((v - minOee) / range) * (chartH - pad * 2); }
    function toX(i: number) { return pad + (i / (trend.length - 1)) * (chartW - pad * 2); }

    const oeePoints = trend.map((pt, i) => `${toX(i)},${toY(pt.oee)}`).join(" ");
    const availPoints = trend.map((pt, i) => `${toX(i)},${toY(pt.availability)}`).join(" ");
    const perfPoints = trend.map((pt, i) => `${toX(i)},${toY(pt.performance)}`).join(" ");
    const qualPoints = trend.map((pt, i) => `${toX(i)},${toY(pt.quality)}`).join(" ");

    // World class line at 85%
    const wcY = toY(85);

    return (
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={pad} y1={toY(v)} x2={chartW - pad} y2={toY(v)}
              className="stroke-th-border" strokeWidth={0.5} strokeDasharray="4,4" />
            <text x={pad - 4} y={toY(v) + 3} textAnchor="end"
              className="fill-th-text-3 text-[10px]">{v}%</text>
          </g>
        ))}

        {/* World Class line */}
        <line x1={pad} y1={wcY} x2={chartW - pad} y2={wcY}
          stroke="#22c55e" strokeWidth={1.5} strokeDasharray="6,3" opacity={0.7} />
        <text x={chartW - pad + 4} y={wcY + 3}
          className="text-[9px] font-medium" fill="#22c55e">WC 85%</text>

        {/* X-axis labels */}
        {trend.filter((_, i) => i % Math.max(1, Math.floor(trend.length / 8)) === 0).map((pt, idx) => {
          const origIdx = trend.indexOf(pt);
          return (
            <text key={idx} x={toX(origIdx)} y={chartH - 8} textAnchor="middle"
              className="fill-th-text-3 text-[9px]">{formatDate(pt.date)}</text>
          );
        })}

        {/* Lines */}
        <polyline points={qualPoints} fill="none" stroke="#06b6d4" strokeWidth={1.5} opacity={0.5} />
        <polyline points={availPoints} fill="none" stroke="#a78bfa" strokeWidth={1.5} opacity={0.5} />
        <polyline points={perfPoints} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.5} />
        <polyline points={oeePoints} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" />

        {/* Data dots on OEE line */}
        {trend.length <= 31 && trend.map((pt, i) => (
          <circle key={i} cx={toX(i)} cy={toY(pt.oee)} r={3} fill="#6366f1" />
        ))}
      </svg>
    );
  }, [trend]);

  // ─── Bar chart for line comparison ──────────────────────────────────────

  const lineBarChart = useMemo(() => {
    if (sortedLines.length === 0) return null;
    const barH = 28;
    const gap = 6;
    const svgH = sortedLines.length * (barH + gap) + 10;
    const maxOee = Math.max(...sortedLines.map(l => l.avg_oee), 100);

    return (
      <svg viewBox={`0 0 500 ${svgH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {sortedLines.map((line, i) => {
          const y = i * (barH + gap) + 5;
          const w = (line.avg_oee / maxOee) * 340;
          const color = line.avg_oee >= 85 ? "#22c55e" : line.avg_oee >= 60 ? "#f59e0b" : "#ef4444";
          return (
            <g key={line.line_id}>
              <text x={0} y={y + barH / 2 + 1} dominantBaseline="central"
                className="fill-th-text text-[11px] font-medium">{line.line_name}</text>
              <rect x={140} y={y} width={w} height={barH} rx={6} fill={color} opacity={0.85} />
              <text x={140 + w + 6} y={y + barH / 2 + 1} dominantBaseline="central"
                className="fill-th-text text-[12px] font-bold">{line.avg_oee.toFixed(1)}%</text>
            </g>
          );
        })}
      </svg>
    );
  }, [sortedLines]);

  // ─── Render ─────────────────────────────────────────────────────────────

  const fs = factorySummary;

  return (
    <div className="space-y-6 print-area" id="consolidated-oee">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date mode toggle */}
        <div className="flex rounded-lg border border-th-border overflow-hidden">
          <button
            onClick={() => setMode("preset")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${mode === "preset" ? "bg-indigo-600 text-white" : "bg-th-bg-2 text-th-text hover:bg-th-bg"}`}
          >{t("consolidated.presets") || "Presets"}</button>
          <button
            onClick={() => setMode("custom")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${mode === "custom" ? "bg-indigo-600 text-white" : "bg-th-bg-2 text-th-text hover:bg-th-bg"}`}
          >{t("consolidated.customRange") || "Custom Range"}</button>
        </div>

        {mode === "preset" ? (
          <div className="flex rounded-lg border border-th-border overflow-hidden">
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${days === d && mode === "preset" ? "bg-indigo-600 text-white" : "bg-th-bg-2 text-th-text hover:bg-th-bg"}`}
              >{t(`consolidated.last${d}`) || `Last ${d} days`}</button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input type="date" value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2 py-1.5 text-sm rounded-lg border border-th-border bg-th-bg-2 text-th-text" />
            <span className="text-th-text-2">→</span>
            <input type="date" value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2 py-1.5 text-sm rounded-lg border border-th-border bg-th-bg-2 text-th-text" />
          </div>
        )}

        <div className="ml-auto">
          <ExportToolbar
            onPrint={() => printView({ title: t("consolidated.title") || "Consolidated OEE" })}
            onExportCSV={() => exportToCSV({
              filename: "consolidated_oee",
              columns: [
                { key: "line_name", header: "Line", width: 20 },
                { key: "avg_oee", header: "OEE %", width: 10 },
                { key: "avg_availability", header: "Availability %", width: 14 },
                { key: "avg_performance", header: "Performance %", width: 14 },
                { key: "avg_quality", header: "Quality %", width: 10 },
                { key: "record_count", header: "Records", width: 10 },
                { key: "total_downtime_min", header: "Downtime (min)", width: 14 },
              ],
              rows: sortedLines.map(l => ({
                line_name: l.line_name,
                avg_oee: l.avg_oee.toFixed(1),
                avg_availability: l.avg_availability.toFixed(1),
                avg_performance: l.avg_performance.toFixed(1),
                avg_quality: l.avg_quality.toFixed(1),
                record_count: l.record_count,
                total_downtime_min: l.total_downtime_min.toFixed(0),
              })),
            })}
          />
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-amber-700 dark:text-amber-300 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertTriangle size={14} /> {t("consolidated.demoData") || "Demo Data"} — {error}</span>
          <button onClick={fetchData} className="px-3 py-1 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 transition-colors">
            {t("common.retry") || "Retry"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Factory-wide KPIs */}
          {fs && (
            <div className="bg-th-bg-2 rounded-xl border border-th-border p-6 shadow-card">
              <h3 className="text-lg font-bold mb-4 text-th-text">
                {t("consolidated.factoryOverview") || "Factory Overview"} — {t("consolidated.allLines") || "All Lines"}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <DonutGauge value={fs.avg_oee} size={100} label={t("consolidated.overallOEE") || "Overall OEE"} />
                  </div>
                </div>
                <div className="bg-th-bg-3 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-th-text">{fs.avg_availability.toFixed(1)}%</div>
                  <div className="text-xs text-th-text-2">{t("consolidated.availability") || "Availability"}</div>
                  <Sparkline data={trend.map(pt => pt.availability)} color="#a78bfa" width={120} height={30} />
                </div>
                <div className="bg-th-bg-3 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-th-text">{fs.avg_performance.toFixed(1)}%</div>
                  <div className="text-xs text-th-text-2">{t("consolidated.performance") || "Performance"}</div>
                  <Sparkline data={trend.map(pt => pt.performance)} color="#f59e0b" width={120} height={30} />
                </div>
                <div className="bg-th-bg-3 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-th-text">{fs.avg_quality.toFixed(1)}%</div>
                  <div className="text-xs text-th-text-2">{t("consolidated.quality") || "Quality"}</div>
                  <Sparkline data={trend.map(pt => pt.quality)} color="#06b6d4" width={120} height={30} />
                </div>
                <div className="bg-th-bg-3 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-th-text">{(fs.total_downtime_min / 60).toFixed(1)}h</div>
                  <div className="text-xs text-th-text-2">{t("consolidated.totalDowntime") || "Total Downtime"}</div>
                  <div className="text-xs mt-1 text-th-text-3">{fs.record_count} {t("consolidated.records") || "records"}</div>
                </div>
              </div>
            </div>
          )}

          {/* Trend chart */}
          <div className="bg-th-bg-2 rounded-xl border border-th-border p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-th-text">
                {t("consolidated.factoryTrend") || "Factory OEE Trend"}
              </h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 inline-block rounded" /> OEE</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-400 inline-block rounded" /> {t("consolidated.availability") || "Avail."}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded" /> {t("consolidated.performance") || "Perf."}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-400 inline-block rounded" /> {t("consolidated.quality") || "Quality"}</span>
              </div>
            </div>
            {trendChart || (
              <div className="h-48 flex items-center justify-center text-th-text-3 text-sm">
                {t("consolidated.noTrendData") || "Not enough data points for trend"}
              </div>
            )}
          </div>

          {/* Line comparison chart + table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div className="bg-th-bg-2 rounded-xl border border-th-border p-5 shadow-card">
              <h3 className="text-base font-semibold text-th-text mb-3">
                {t("consolidated.lineComparison") || "Line Comparison"}
              </h3>
              {lineBarChart || (
                <div className="h-32 flex items-center justify-center text-th-text-3 text-sm">
                  {t("consolidated.noData") || "No data"}
                </div>
              )}
            </div>

            {/* Detailed table */}
            <div className="bg-th-bg-2 rounded-xl border border-th-border p-5 shadow-card overflow-x-auto">
              <h3 className="text-base font-semibold text-th-text mb-3">
                {t("consolidated.detailedBreakdown") || "Detailed Breakdown"}
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-th-border text-left">
                    {[
                      { key: "line_name" as keyof LineSummary, label: t("consolidated.line") || "Line" },
                      { key: "avg_oee" as keyof LineSummary, label: "OEE" },
                      { key: "avg_availability" as keyof LineSummary, label: t("consolidated.avail") || "Avail." },
                      { key: "avg_performance" as keyof LineSummary, label: t("consolidated.perf") || "Perf." },
                      { key: "avg_quality" as keyof LineSummary, label: t("consolidated.qual") || "Qual." },
                      { key: "total_downtime_min" as keyof LineSummary, label: t("consolidated.downtime") || "Downtime" },
                    ].map(col => (
                      <th key={col.key} onClick={() => toggleSort(col.key)}
                        className="py-2 px-2 text-th-text-2 font-medium cursor-pointer hover:text-th-text select-none">
                        <span className="flex items-center gap-1">{col.label} {sortKey === col.key ? (sortDir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : null}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedLines.map(line => (
                    <tr key={line.line_id} className="border-b border-th-border/40 hover:bg-th-bg/50">
                      <td className="py-2 px-2 text-th-text font-medium">{line.line_name}</td>
                      <td className={`py-2 px-2 font-bold ${oeeColor(line.avg_oee)}`}>{line.avg_oee.toFixed(1)}%</td>
                      <td className="py-2 px-2 text-th-text">{line.avg_availability.toFixed(1)}%</td>
                      <td className="py-2 px-2 text-th-text">{line.avg_performance.toFixed(1)}%</td>
                      <td className="py-2 px-2 text-th-text">{line.avg_quality.toFixed(1)}%</td>
                      <td className="py-2 px-2 text-th-text">{(line.total_downtime_min / 60).toFixed(1)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedLines.length === 0 && (
                <div className="text-center py-8 text-th-text-3 text-sm">
                  {t("consolidated.noData") || "No production data available"}
                </div>
              )}
            </div>
          </div>

          {/* World-class benchmark */}
          {fs && (
            <div className="bg-th-bg-2 rounded-xl border border-th-border p-5 shadow-card">
              <h3 className="text-base font-semibold text-th-text mb-3">
                {t("consolidated.benchmark") || "World-Class Benchmark"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: t("consolidated.availability") || "Availability", actual: fs.avg_availability, target: 90 },
                  { label: t("consolidated.performance") || "Performance", actual: fs.avg_performance, target: 95 },
                  { label: t("consolidated.quality") || "Quality", actual: fs.avg_quality, target: 99.9 },
                  { label: "OEE", actual: fs.avg_oee, target: 85 },
                ].map(item => {
                  const gap = item.actual - item.target;
                  return (
                    <div key={item.label} className="flex flex-col gap-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-th-text">{item.label}</span>
                        <span className={gap >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          {gap >= 0 ? "+" : ""}{gap.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-th-text-2 w-14">{item.actual.toFixed(1)}%</span>
                        <div className="flex-1 h-2 bg-th-border rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${gap >= 0 ? "bg-green-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, (item.actual / item.target) * 100)}%` }} />
                        </div>
                        <span className="text-xs text-th-text-3 w-10">{item.target}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
