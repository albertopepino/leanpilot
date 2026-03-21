"use client";
import { useState } from "react";
import { useI18n } from "@/stores/useI18n";

export default function LoginStreakBadge() {
  const { t } = useI18n();
  const [showTooltip, setShowTooltip] = useState(false);

  if (typeof window === "undefined") return null;

  const streak = parseInt(localStorage.getItem("leanpilot_login_streak") || "0", 10);
  if (streak < 1) return null;

  const tooltipText = t("achievements.streak7") !== "achievements.streak7"
    ? `${streak} ${t("achievements.streak7").replace(/\d+/, "").replace(/-/g, "").trim()}`
    : `${streak}-day login streak`;

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 leading-none">
        <span role="img" aria-label="streak">{"\u{1F525}"}</span>
        <span>{streak}</span>
      </span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none">
          <div className="bg-th-bg-2 border border-th-border rounded-lg shadow-lg px-2 py-1 text-[10px] text-th-text whitespace-nowrap">
            {tooltipText}
          </div>
        </div>
      )}
    </div>
  );
}
