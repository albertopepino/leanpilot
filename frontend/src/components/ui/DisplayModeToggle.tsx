"use client";
import { Suspense } from "react";
import { useDisplayMode } from "@/hooks/useDisplayMode";
import { useI18n } from "@/stores/useI18n";
import { Monitor } from "lucide-react";

function DisplayModeToggleInner() {
  const { isDisplayMode, enterDisplayMode } = useDisplayMode();
  const { t } = useI18n();

  if (isDisplayMode) return null;

  return (
    <button
      onClick={enterDisplayMode}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-th-bg-3 text-th-text-3 border border-th-border hover:bg-th-bg-hover hover:text-th-text-2 transition-colors"
      title={t("common.displayMode") || "Display Mode"}
    >
      <Monitor className="w-3.5 h-3.5" />
      {t("common.displayMode") || "Display Mode"}
    </button>
  );
}

export default function DisplayModeToggle() {
  return (
    <Suspense fallback={null}>
      <DisplayModeToggleInner />
    </Suspense>
  );
}
