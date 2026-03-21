"use client";
import { useEffect } from "react";
import { useAchievements, ACHIEVEMENT_DEFS } from "@/stores/useAchievements";
import { useI18n } from "@/stores/useI18n";
import AchievementBadge from "./AchievementBadge";

export default function AchievementWall() {
  const { t } = useI18n();
  const { achievements, loaded, initAchievements } = useAchievements();

  useEffect(() => {
    if (!loaded) initAchievements();
  }, [loaded, initAchievements]);

  const total = ACHIEVEMENT_DEFS.length;
  const unlocked = achievements.filter((a) => a.unlockedAt).length;
  const progressPct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  const progressLabel = t("achievements.progress") !== "achievements.progress"
    ? t("achievements.progress", { unlocked: String(unlocked), total: String(total) })
    : `${unlocked} of ${total} unlocked`;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-th-text">{progressLabel}</span>
          <span className="text-xs text-th-text-3">{progressPct}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-th-bg-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {achievements.map((achievement) => {
          const isLocked = !achievement.unlockedAt;
          const title = t(achievement.titleKey) !== achievement.titleKey
            ? t(achievement.titleKey)
            : achievement.titleFallback;

          const unlockDateLabel = achievement.unlockedAt
            ? (t("achievements.unlockedOn") !== "achievements.unlockedOn"
              ? t("achievements.unlockedOn", {
                  date: new Date(achievement.unlockedAt).toLocaleDateString(),
                })
              : `Unlocked on ${new Date(achievement.unlockedAt).toLocaleDateString()}`)
            : "";

          return (
            <div key={achievement.id} className="flex flex-col items-center gap-1.5 text-center">
              <AchievementBadge
                achievement={achievement}
                size="md"
                locked={isLocked}
              />
              <span className={`text-[11px] leading-tight font-medium ${
                isLocked ? "text-th-text-3" : "text-th-text"
              }`}>
                {isLocked ? "???" : title}
              </span>
              {!isLocked && unlockDateLabel && (
                <span className="text-[9px] text-th-text-3 leading-tight">
                  {unlockDateLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
