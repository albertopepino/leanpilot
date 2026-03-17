"use client";
import { ReactNode, memo } from "react";

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: { direction: "up" | "down" | "flat"; value: string; };
  status?: "good" | "warning" | "danger" | "neutral";
  sparkline?: ReactNode;
  subtitle?: string;
  onClick?: () => void;
}

const statusColors = {
  good: "border-l-emerald-500",
  warning: "border-l-amber-500",
  danger: "border-l-red-500",
  neutral: "border-l-brand-500",
};

const trendIcons = { up: "↑", down: "↓", flat: "→" };
const trendColors = { up: "text-emerald-600 dark:text-emerald-400", down: "text-red-600 dark:text-red-400", flat: "text-th-text-3" };

function KPICard({ label, value, unit, trend, status = "neutral", sparkline, subtitle, onClick }: KPICardProps) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`bg-th-card border border-th-card-border rounded-xl p-4 border-l-4 ${statusColors[status]} ${onClick ? "cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all" : ""} text-left w-full`}
      {...(onClick ? { type: "button" as const } : {})}
    >
      <p className="text-xs font-medium text-th-text-2 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-th-text tabular-nums">{value}</span>
        {unit && <span className="text-sm text-th-text-2 mb-0.5">{unit}</span>}
      </div>
      {trend && (
        <p className={`text-xs mt-1 font-medium ${trendColors[trend.direction]}`}>
          {trendIcons[trend.direction]} {trend.value}
        </p>
      )}
      {subtitle && <p className="text-xs text-th-text-3 mt-1">{subtitle}</p>}
      {sparkline && <div className="mt-2 h-8">{sparkline}</div>}
    </Wrapper>
  );
}

export default memo(KPICard);
