"use client";
import { useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WorkElement {
  name: string;
  duration: number; // seconds
  type: "value_add" | "non_value_add" | "waste";
}

export interface YamazumiStation {
  name: string;
  elements: WorkElement[];
}

interface YamazumiChartProps {
  stations: YamazumiStation[];
  taktTime?: number; // seconds
  title?: string;
  height?: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COLOR = {
  valueAdd: "#10b981",       // green
  nonValueAdd: "#f59e0b",    // yellow/amber
  waste: "#ef4444",          // red
  taktLine: "#8b5cf6",       // purple
  grid: "#334155",
  text: "#94a3b8",
} as const;

const TYPE_LABELS: Record<string, string> = {
  value_add: "Value Add",
  non_value_add: "Non-Value Add",
  waste: "Waste",
};

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                     */
/* ------------------------------------------------------------------ */

interface YamazumiPayloadEntry { value: number; name?: string; color?: string; fill?: string }

function YamazumiTooltip({ active, payload, label }: { active?: boolean; payload?: YamazumiPayloadEntry[]; label?: string }) {
  const { t } = useI18n();
  if (!active || !payload?.length) return null;

  // Filter out zero values and sort by type
  const items = payload.filter((p) => p.value > 0);

  return (
    <div className="bg-th-bg-3 backdrop-blur-sm border border-th-border rounded-lg px-4 py-3 shadow-xl min-w-[180px]">
      <p className="text-xs text-th-text-2 mb-2 font-semibold">{label}</p>
      {items.map((entry, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-sm mb-0.5">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-th-text text-xs">{entry.name}</span>
          </div>
          <span className="font-semibold text-th-text tabular-nums text-xs">{entry.value}s</span>
        </div>
      ))}
      <div className="border-t border-th-border mt-1.5 pt-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-th-text-3 font-medium">{t("improvement.totalTime") || "Total"}</span>
          <span className="font-bold text-th-text tabular-nums">
            {items.reduce((s: number, p) => s + (p.value || 0), 0)}s
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function YamazumiChart({
  stations,
  taktTime,
  title,
  height = 400,
}: YamazumiChartProps) {
  const { t } = useI18n();

  /* Transform stations into stacked bar data */
  const chartData = useMemo(() => {
    return stations.map((station) => {
      const va = station.elements
        .filter((e) => e.type === "value_add")
        .reduce((s, e) => s + e.duration, 0);
      const nva = station.elements
        .filter((e) => e.type === "non_value_add")
        .reduce((s, e) => s + e.duration, 0);
      const waste = station.elements
        .filter((e) => e.type === "waste")
        .reduce((s, e) => s + e.duration, 0);

      return {
        name: station.name,
        value_add: va,
        non_value_add: nva,
        waste,
        total: va + nva + waste,
      };
    });
  }, [stations]);

  /* Summary metrics */
  const summary = useMemo(() => {
    const totalVA = chartData.reduce((s, d) => s + d.value_add, 0);
    const totalNVA = chartData.reduce((s, d) => s + d.non_value_add, 0);
    const totalWaste = chartData.reduce((s, d) => s + d.waste, 0);
    const grandTotal = totalVA + totalNVA + totalWaste;
    const maxTotal = Math.max(...chartData.map((d) => d.total), 0);
    const bottleneck = chartData.reduce(
      (max, d) => (d.total > max.total ? d : max),
      { name: "-", total: 0, value_add: 0, non_value_add: 0, waste: 0 },
    );
    const exceedsTakt = taktTime ? chartData.filter((d) => d.total > taktTime).length : 0;

    return {
      totalVA,
      totalNVA,
      totalWaste,
      grandTotal,
      maxTotal,
      bottleneck,
      exceedsTakt,
      vaPct: grandTotal > 0 ? (totalVA / grandTotal) * 100 : 0,
    };
  }, [chartData, taktTime]);

  if (stations.length === 0) {
    return (
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        {title && <h3 className="text-lg font-semibold text-th-text mb-4">{title}</h3>}
        <div className="flex items-center justify-center h-40 text-sm text-th-text-3">
          {t("quality.noData") || "No data available"}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-th-text">{title}</h3>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-th-text-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR.valueAdd }} />
              {t("improvement.valueAdd") || "Value Add"}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-th-text-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR.nonValueAdd }} />
              {t("improvement.nonValueAdd") || "Non-Value Add"}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-th-text-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR.waste }} />
              {t("improvement.waste") || "Waste"}
            </span>
            {taktTime && (
              <span className="flex items-center gap-1.5 text-xs text-th-text-2">
                <span className="w-5 border-t-2 border-dashed" style={{ borderColor: COLOR.taktLine }} />
                {t("improvement.taktTime") || "Takt Time"} ({taktTime}s)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 20, left: -10, bottom: 10 }}
          barGap={0}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={COLOR.grid}
            strokeOpacity={0.3}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: COLOR.text, fontSize: 12, fontWeight: 600 }}
            tickLine={false}
            axisLine={{ stroke: COLOR.grid, strokeOpacity: 0.5 }}
          />
          <YAxis
            tick={{ fill: COLOR.text, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}s`}
          />

          <Tooltip content={<YamazumiTooltip />} />

          {/* Takt time reference line */}
          {taktTime && (
            <ReferenceLine
              y={taktTime}
              stroke={COLOR.taktLine}
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{
                value: `${t("improvement.taktTime") || "Takt"}: ${taktTime}s`,
                position: "insideTopRight",
                fill: COLOR.taktLine,
                fontSize: 11,
                fontWeight: 700,
              }}
            />
          )}

          {/* Stacked bars: Value Add (bottom), Non-Value Add (middle), Waste (top) */}
          <Bar
            dataKey="value_add"
            stackId="yamazumi"
            fill={COLOR.valueAdd}
            radius={[0, 0, 0, 0]}
            name={t("improvement.valueAdd") || "Value Add"}
            maxBarSize={80}
          />
          <Bar
            dataKey="non_value_add"
            stackId="yamazumi"
            fill={COLOR.nonValueAdd}
            radius={[0, 0, 0, 0]}
            name={t("improvement.nonValueAdd") || "Non-Value Add"}
            maxBarSize={80}
          />
          <Bar
            dataKey="waste"
            stackId="yamazumi"
            fill={COLOR.waste}
            radius={[4, 4, 0, 0]}
            name={t("improvement.waste") || "Waste"}
            maxBarSize={80}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-th-border">
        <div className="text-center p-3 rounded-xl border border-th-border bg-th-bg-3">
          <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold mb-1">
            {t("improvement.valueAdd") || "Value Add"}
          </p>
          <p className="text-lg font-bold text-emerald-400 tabular-nums">{summary.totalVA}s</p>
          <p className="text-[10px] text-th-text-3">{summary.vaPct.toFixed(1)}%</p>
        </div>
        <div className="text-center p-3 rounded-xl border border-th-border bg-th-bg-3">
          <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold mb-1">
            {t("improvement.nonValueAdd") || "Non-Value Add"}
          </p>
          <p className="text-lg font-bold text-amber-400 tabular-nums">{summary.totalNVA}s</p>
        </div>
        <div className="text-center p-3 rounded-xl border border-th-border bg-th-bg-3">
          <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold mb-1">
            {t("improvement.waste") || "Waste"}
          </p>
          <p className="text-lg font-bold text-red-400 tabular-nums">{summary.totalWaste}s</p>
        </div>
        <div className="text-center p-3 rounded-xl border border-th-border bg-th-bg-3">
          <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold mb-1">
            {t("improvement.bottleneck") || "Bottleneck"}
          </p>
          <p className="text-sm font-bold text-th-text truncate" title={summary.bottleneck.name}>
            {summary.bottleneck.name}
          </p>
          <p className="text-xs text-th-text-3">{summary.bottleneck.total}s</p>
        </div>
        {taktTime && (
          <div className="text-center p-3 rounded-xl border border-th-border bg-th-bg-3">
            <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold mb-1">
              {t("improvement.taktTime") || "Takt Time"}
            </p>
            <p className="text-lg font-bold text-violet-400 tabular-nums">{taktTime}s</p>
          </div>
        )}
        {taktTime && (
          <div className="text-center p-3 rounded-xl border border-th-border bg-th-bg-3">
            <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold mb-1">
              {t("improvement.exceedsTakt") || "Over Takt"}
            </p>
            <p className={`text-lg font-bold tabular-nums ${summary.exceedsTakt > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {summary.exceedsTakt} / {stations.length}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
