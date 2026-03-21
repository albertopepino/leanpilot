"use client";

import { useMemo, useId } from "react";

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  showTrend?: boolean;
}

/**
 * Attempt to create smooth cubic bezier curve points for a sparkline.
 * Falls back to polyline if fewer than 3 points.
 */
function buildSmoothPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M${points[0][0]},${points[0][1]} L${points[1][0]},${points[1][1]}`;
  }

  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cpx1 = curr[0] + (next[0] - curr[0]) / 3;
    const cpy1 = curr[1];
    const cpx2 = next[0] - (next[0] - curr[0]) / 3;
    const cpy2 = next[1];
    d += ` C${cpx1},${cpy1} ${cpx2},${cpy2} ${next[0]},${next[1]}`;
  }
  return d;
}

export default function Sparkline({
  data,
  color = "rgb(99,102,241)", // brand-500
  height = 24,
  width = 80,
  showTrend = false,
}: SparklineProps) {
  const gradientId = useId();

  const { linePath, areaPath, trend } = useMemo(() => {
    if (data.length < 2) return { linePath: "", areaPath: "", trend: 0 as const };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const drawH = height - padding * 2;
    const drawW = width - padding * 2;

    const points: [number, number][] = data.map((v, i) => [
      padding + (i / (data.length - 1)) * drawW,
      padding + drawH - ((v - min) / range) * drawH,
    ]);

    const line = buildSmoothPath(points);
    // Area path: line path + close along the bottom
    const last = points[points.length - 1];
    const first = points[0];
    const area = `${line} L${last[0]},${height} L${first[0]},${height} Z`;

    // Trend: compare last value to first
    const trendVal = data[data.length - 1] - data[0];
    return { linePath: line, areaPath: area, trend: trendVal };
  }, [data, height, width]);

  if (data.length < 2) return null;

  const trendUp = trend > 0;
  const trendDown = trend < 0;

  return (
    <span className="inline-flex items-center gap-1">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="sparkline-draw"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Gradient fill below the line */}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="sparkline-line"
        />
      </svg>

      {showTrend && (trendUp || trendDown) && (
        <span
          className={`text-[10px] font-bold leading-none ${
            trendUp ? "text-emerald-500" : "text-rose-500"
          }`}
          aria-label={trendUp ? "Trending up" : "Trending down"}
        >
          {trendUp ? "\u25B2" : "\u25BC"}
        </span>
      )}

      <style>{`
        @keyframes sparklineDraw {
          from { stroke-dashoffset: 200; }
          to { stroke-dashoffset: 0; }
        }
        .sparkline-line {
          stroke-dasharray: 200;
          animation: sparklineDraw 1s ease-out forwards;
        }
      `}</style>
    </span>
  );
}
