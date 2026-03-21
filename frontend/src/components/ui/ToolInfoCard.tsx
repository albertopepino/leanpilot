"use client";
import { useState, useEffect } from "react";
import { Info, X, ArrowRight, ArrowLeft } from "lucide-react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { useBeginnerMode } from "@/stores/useBeginnerMode";
import { useRouter } from "next/navigation";

/**
 * ToolInfoCard — A dismissable info card shown at the top of each tool page.
 * Explains what the tool does, when to use it, and what it connects to.
 * Shown on first visit; user can dismiss and it won't appear again.
 * Can be re-shown via a small "?" button.
 *
 * In Beginner Mode: always shown, dismiss button hidden.
 */

export interface ToolInfo {
  id: string;
  titleKey: string;
  titleFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  whenToUseKey: string;
  whenToUseFallback: string;
  connectsFrom?: { labelKey: string; fallback: string; href: string }[];
  connectsTo?: { labelKey: string; fallback: string; href: string }[];
}

function getStorageKey(toolId: string, userId?: number) {
  return `leanpilot_tool_info_dismissed_${userId || "anon"}_${toolId}`;
}

export default function ToolInfoCard({ info }: { info: ToolInfo }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { enabled: beginnerMode } = useBeginnerMode();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const key = getStorageKey(info.id, user?.id);
    const wasDismissed = localStorage.getItem(key) === "1";
    setDismissed(wasDismissed);
    setLoaded(true);
  }, [info.id, user?.id]);

  const handleDismiss = () => {
    setDismissed(true);
    const key = getStorageKey(info.id, user?.id);
    localStorage.setItem(key, "1");
  };

  const handleShow = () => {
    setDismissed(false);
    const key = getStorageKey(info.id, user?.id);
    localStorage.removeItem(key);
  };

  if (!loaded) return null;

  // In beginner mode: always show the full card
  const forceShow = beginnerMode;

  // Small "?" button when dismissed (not in beginner mode)
  if (dismissed && !forceShow) {
    return (
      <button
        onClick={handleShow}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-th-text-3 hover:text-brand-600 hover:bg-brand-500/10 transition-colors print:hidden"
        title={t("common.toolInfoShow") || "What is this tool?"}
      >
        <Info size={13} />
        <span>{t("common.toolInfoShow") || "What is this tool?"}</span>
      </button>
    );
  }

  const description = t(info.descriptionKey) || info.descriptionFallback;
  const whenToUse = t(info.whenToUseKey) || info.whenToUseFallback;

  return (
    <div className="relative rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-950/20 p-4 print:hidden animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Dismiss button — hidden in beginner mode */}
      {!forceShow && (
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 text-th-text-3 hover:text-th-text-2 transition-colors rounded-lg hover:bg-th-bg-hover"
          title={t("common.close") || "Close"}
        >
          <X size={14} />
        </button>
      )}

      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center shrink-0 mt-0.5">
          <Info size={16} className="text-brand-600 dark:text-brand-400" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          {/* Description */}
          <p className="text-sm text-th-text leading-relaxed">{description}</p>

          {/* When to use */}
          <p className="text-xs text-th-text-3 mt-2 italic">{whenToUse}</p>

          {/* Connections */}
          {((info.connectsFrom && info.connectsFrom.length > 0) ||
            (info.connectsTo && info.connectsTo.length > 0)) && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 pt-3 border-t border-brand-200/50 dark:border-brand-800/50">
              {info.connectsFrom && info.connectsFrom.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-th-text-3">
                  <ArrowLeft size={11} className="text-brand-500" />
                  <span className="font-medium">{t("common.toolInfoFrom") || "Receives from"}:</span>
                  {info.connectsFrom.map((c, i) => (
                    <span key={i}>
                      <button onClick={() => router.push(c.href)} className="text-brand-600 dark:text-brand-400 hover:underline">
                        {t(c.labelKey) || c.fallback}
                      </button>
                      {i < info.connectsFrom!.length - 1 && ", "}
                    </span>
                  ))}
                </div>
              )}
              {info.connectsTo && info.connectsTo.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-th-text-3">
                  <ArrowRight size={11} className="text-emerald-500" />
                  <span className="font-medium">{t("common.toolInfoTo") || "Feeds into"}:</span>
                  {info.connectsTo.map((c, i) => (
                    <span key={i}>
                      <button onClick={() => router.push(c.href)} className="text-emerald-600 dark:text-emerald-400 hover:underline">
                        {t(c.labelKey) || c.fallback}
                      </button>
                      {i < info.connectsTo!.length - 1 && ", "}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
