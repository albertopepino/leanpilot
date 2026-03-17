"use client";
import { useI18n } from "@/stores/useI18n";
import { BookOpen, Factory, Footprints, Rocket, type LucideIcon } from "lucide-react";

const RESOURCES: { titleKey: string; descKey: string; icon: LucideIcon; url: string }[] = [
  { titleKey: "resources.leanThinking", descKey: "resources.leanThinkingDesc", icon: BookOpen, url: "#" },
  { titleKey: "resources.toyotaWay", descKey: "resources.toyotaWayDesc", icon: Factory, url: "#" },
  { titleKey: "resources.gembaKaizen", descKey: "resources.gembaKaizenDesc", icon: Footprints, url: "#" },
  { titleKey: "resources.leanStartup", descKey: "resources.leanStartupDesc", icon: Rocket, url: "#" },
];

export default function ResourcesRoute() {
  const { t } = useI18n();
  return (
    <div className="max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold text-th-text mb-6">{t("common.titleResources")}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {RESOURCES.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.titleKey} className="bg-th-bg-2 rounded-xl p-6 border border-th-border hover:shadow-md transition">
              <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-3">
                <Icon size={20} />
              </div>
              <h3 className="font-semibold text-th-text mb-1">{t(r.titleKey)}</h3>
              <p className="text-sm text-th-text-2">{t(r.descKey)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
