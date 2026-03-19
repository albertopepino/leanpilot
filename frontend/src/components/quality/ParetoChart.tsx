"use client";
import { useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ParetoDataPoint {
  category: string;
  count: number;
}

interface ParetoChartProps {
  data: ParetoDataPoint[];
  title?: string;
  height?: number;
  barColor?: string;
  lineColor?: string;
  showLegend?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COLOR = {
  bar: "#3b82f6",
  barTop: "#60a5fa",
  line: "#f59e0b",
  reference: "#ef4444",
  grid: "#334155",
  text: "#94a3b8",
  tooltipBg: "#1e293b",
  tooltipBorder: "#334155",
} as const;

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                     */
/* ------------------------------------------------------------------ */

function ParetoTooltip({ active, payload, label }: any) {
  const { t } = useI18n();
  if (!active || !payload?.length) return null;

  const barPayload = payload.find((p: any) => p.dataKey === "count");
  const linePayload = payload.find((p: any) => p.dataKey === "cumulativePct");

  return (
    <div className="bg-th-bg-3 backdrop-blur-sm border border-th-border rounded-lg px-4 py-3 shadow-xl">
      <p className="text-xs text-th-text-2 mb-2 font-semibold">{label}</p>
      {barPayload && (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLOR.bar }} />
          <span className="text-th-text">{t("quality.count") || "Count"}:</span>
          <span className="font-bold text-th-text tabular-nums">{barPayload.value}</span>
        </div>
      )}
      {linePayload && (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLOR.line }} />
          <span className="text-th-text">{t("quality.cumulative") || "Cumulative"}:</span>
          <span className="font-bold text-th-text tabular-nums">{linePayload.value?.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ParetoChart({
  data,
  title,
  height = 400,
  barColor = COLOR.bar,
  lineColor = COLOR.line,
  showLegend = true,
}: ParetoChartProps) {
  const { t } = useI18n();

  /* Sort descending and compute cumulative percentage */
  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.count - a.count);
    const total = sorted.reduce((sum, d) => sum + d.count, 0);
    if (total === 0) return [];

    let cumulative = 0;
    return sorted.map((item) => {
      cumulative += item.count;
      return {
        category: item.category,
        count: item.count,
        cumulativePct: (cumulative / total) * 100,
        pct: (item.count / total) * 100,
      };
    });
  }, [data]);

  /* Find the 80/20 cutoff index */
  const cutoffIndex = useMemo(() => {
    return chartData.findIndex((d) => d.cumulativePct >= 80);
  }, [chartData]);

  if (chartData.length === 0) {
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
      {title && (
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-th-text">{title}</h3>
          {showLegend && (
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-th-text-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: barColor }} />
                {t("quality.count") || "Count"}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-th-text-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lineColor }} />
                {t("quality.cumulative") || "Cumulative %"}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-th-text-2">
                <span className="w-5 border-t-2 border-dashed" style={{ borderColor: COLOR.reference }} />
                {t("quality.eightyTwenty") || "80/20 Line"}
              </span>
            </div>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 20, left: -10, bottom: 40 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={COLOR.grid}
            strokeOpacity={0.3}
            vertical={false}
          />
          <XAxis
            dataKey="category"
            tick={{ fill: COLOR.text, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: COLOR.grid, strokeOpacity: 0.5 }}
            angle={-35}
            textAnchor="end"
            height={60}
            interval={0}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: COLOR.text, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: COLOR.text, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />

          <Tooltip content={<ParetoTooltip />} />

          {/* 80% reference line */}
          <ReferenceLine
            yAxisId="right"
            y={80}
            stroke={COLOR.reference}
            strokeDasharray="6 4"
            strokeOpacity={0.6}
            label={{
              value: "80%",
              position: "insideTopRight",
              fill: COLOR.reference,
              fontSize: 10,
              fontWeight: 700,
            }}
          />

          {/* Bars - colored differently for items within vs outside the 80/20 */}
          <Bar
            yAxisId="left"
            dataKey="count"
            radius={[4, 4, 0, 0]}
            maxBarSize={60}
            name={t("quality.count") || "Count"}
          >
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index <= cutoffIndex ? barColor : `${barColor}60`}
                stroke={index <= cutoffIndex ? barColor : "transparent"}
                strokeWidth={1}
              />
            ))}
          </Bar>

          {/* Cumulative percentage line */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulativePct"
            stroke={lineColor}
            strokeWidth={2.5}
            dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: lineColor, stroke: "#fff", strokeWidth: 2 }}
            name={t("quality.cumulative") || "Cumulative %"}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary stats */}
      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-th-border">
        <div className="text-center">
          <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">
            {t("quality.totalItems") || "Total Items"}
          </p>
          <p className="text-lg font-bold text-th-text tabular-nums">
            {chartData.reduce((s, d) => s + d.count, 0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">
            {t("quality.categories") || "Categories"}
          </p>
          <p className="text-lg font-bold text-th-text tabular-nums">
            {chartData.length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">
            {t("quality.vitalFew") || "Vital Few (80%)"}
          </p>
          <p className="text-lg font-bold text-blue-400 tabular-nums">
            {cutoffIndex + 1} / {chartData.length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">
            {t("quality.topCategory") || "Top Category"}
          </p>
          <p className="text-sm font-bold text-th-text truncate max-w-[120px]" title={chartData[0]?.category}>
            {chartData[0]?.category || "-"}
          </p>
          <p className="text-xs text-th-text-3">
            {chartData[0]?.pct.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}
