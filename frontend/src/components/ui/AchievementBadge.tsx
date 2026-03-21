"use client";
import { useState } from "react";
import type { Achievement } from "@/stores/useAchievements";
import { useI18n } from "@/stores/useI18n";

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: "sm" | "md";
  locked?: boolean;
}

export default function AchievementBadge({ achievement, size = "md", locked = false }: AchievementBadgeProps) {
  const { t } = useI18n();
  const [showTooltip, setShowTooltip] = useState(false);

  const dimension = size === "sm" ? "w-8 h-8" : "w-12 h-12";
  const fontSize = size === "sm" ? "text-sm" : "text-xl";

  const title = t(achievement.titleKey) !== achievement.titleKey
    ? t(achievement.titleKey)
    : achievement.titleFallback;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`${dimension} rounded-full flex items-center justify-center transition-all duration-200 ${
          locked
            ? "bg-th-bg-3 border border-th-border grayscale opacity-40"
            : "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 border-2 border-amber-400/60 shadow-[0_0_8px_rgba(251,191,36,0.2)]"
        }`}
      >
        <span className={fontSize} role="img" aria-label={title}>
          {achievement.icon}
        </span>
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-th-bg-2 border border-th-border rounded-lg shadow-lg px-3 py-1.5 text-xs text-th-text whitespace-nowrap">
            {locked ? (t("achievements.locked") || "Keep going to unlock this!") : title}
          </div>
        </div>
      )}
    </div>
  );
}
