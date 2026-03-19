import { memo } from "react";

interface StatusBadgeProps {
  status: string;
  variant?: "dot" | "pill";
}

const statusMap: Record<string, { bg: string; text: string; dot: string }> = {
  open: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  "in_progress": { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  completed: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  closed: { bg: "bg-gray-50 dark:bg-gray-900/20", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" },
  overdue: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  planned: { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500" },
  released: { bg: "bg-cyan-50 dark:bg-cyan-900/20", text: "text-cyan-700 dark:text-cyan-400", dot: "bg-cyan-500" },
  on_hold: { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500" },
  active: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  inactive: { bg: "bg-gray-50 dark:bg-gray-900/20", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" },
  pass: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  fail: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  critical: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  major: { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500" },
  minor: { bg: "bg-yellow-50 dark:bg-yellow-900/20", text: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
  high: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  medium: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  low: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
};

const fallback = { bg: "bg-gray-50 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" };

function StatusBadge({ status, variant = "pill" }: StatusBadgeProps) {
  const safeStatus = status || "unknown";
  const key = safeStatus.toLowerCase().replace(/\s+/g, "_");
  const colors = statusMap[key] || fallback;
  const label = safeStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (variant === "dot") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${colors.dot}`} aria-hidden="true" />
        <span className={`text-xs font-medium ${colors.text}`}>{label}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export default memo(StatusBadge);
