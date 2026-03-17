"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/stores/useI18n";
import { viewToRoute } from "@/lib/routes";
import { useLinkedItems } from "@/hooks/useLinkedItems";

/* ------------------------------------------------------------------ */
/*  Target action definitions per source module                        */
/* ------------------------------------------------------------------ */

interface TargetAction {
  /** Legacy view ID used by viewToRoute() */
  viewId: string;
  /** i18n key for the button label */
  labelKey: string;
  /** Fallback English label */
  fallback: string;
  icon: string;
}

const MODULE_TARGETS: Record<string, TargetAction[]> = {
  gemba: [
    { viewId: "kaizen", labelKey: "crossModule.createKaizen", fallback: "Create Kaizen Event", icon: "\u2B50" },
    { viewId: "five-why", labelKey: "crossModule.startFiveWhy", fallback: "Start 5-Why Analysis", icon: "\u2753" },
    { viewId: "ncr", labelKey: "crossModule.createNCR", fallback: "Create NCR", icon: "\u26D4" },
  ],
  "five-why": [
    { viewId: "capa", labelKey: "crossModule.createCAPA", fallback: "Create CAPA", icon: "\uD83D\uDEE1\uFE0F" },
    { viewId: "kaizen", labelKey: "crossModule.createKaizen", fallback: "Create Kaizen Event", icon: "\u2B50" },
  ],
  kaizen: [
    { viewId: "five-why", labelKey: "crossModule.startFiveWhy", fallback: "Start 5-Why Analysis", icon: "\u2753" },
    { viewId: "gemba", labelKey: "crossModule.scheduleGemba", fallback: "Schedule Gemba Walk", icon: "\uD83D\uDEB6" },
  ],
  andon: [
    { viewId: "five-why", labelKey: "crossModule.startFiveWhy", fallback: "Start 5-Why Analysis", icon: "\u2753" },
    { viewId: "kaizen", labelKey: "crossModule.createKaizen", fallback: "Create Kaizen Event", icon: "\u2B50" },
  ],
  oee: [
    { viewId: "kaizen", labelKey: "crossModule.createKaizen", fallback: "Create Kaizen Event", icon: "\u2B50" },
    { viewId: "five-why", labelKey: "crossModule.startFiveWhy", fallback: "Start 5-Why Analysis", icon: "\u2753" },
  ],
  qc: [
    { viewId: "ncr", labelKey: "crossModule.createNCR", fallback: "Create NCR", icon: "\u26D4" },
    { viewId: "capa", labelKey: "crossModule.createCAPA", fallback: "Create CAPA", icon: "\uD83D\uDEE1\uFE0F" },
  ],
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface CreateLinkedActionProps {
  sourceModule: string;
  sourceId: number;
  /** Optional label shown in the collapsed state, e.g. a problem title */
  sourceLabel?: string;
}

export default function CreateLinkedAction({ sourceModule, sourceId, sourceLabel }: CreateLinkedActionProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { addLink } = useLinkedItems(sourceModule, sourceId);
  const [open, setOpen] = useState(false);

  const targets = MODULE_TARGETS[sourceModule];
  if (!targets || targets.length === 0) return null;

  const handleAction = (target: TargetAction) => {
    // Navigate to the target module with source context as search params.
    // The target module is responsible for creating the real cross-module
    // link (with an actual ID) after the new item is saved — we do NOT
    // store a link with a placeholder/fake ID here.
    const route = viewToRoute(target.viewId);
    const params = new URLSearchParams({
      from: sourceModule,
      fromId: String(sourceId),
      ...(sourceLabel ? { fromLabel: sourceLabel } : {}),
      linkBack: "true", // signals the target to call addLink after save
    });
    router.push(`${route}?${params.toString()}`);
    setOpen(false);
  };

  return (
    <div className="relative inline-block print:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/10 text-brand-700 dark:text-brand-400 border border-brand-500/20 hover:bg-brand-500/20 transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
        </svg>
        {t("crossModule.createLinked") || "Create linked..."}
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[220px] bg-th-bg rounded-xl shadow-xl border border-th-border p-1.5 animate-slide-in">
            <p className="px-2.5 py-1.5 text-[10px] font-bold text-th-text-3 uppercase tracking-widest">
              {t("crossModule.createFrom") || "Create from this item"}
            </p>
            {targets.map((target) => (
              <button
                key={target.viewId}
                type="button"
                onClick={() => handleAction(target)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-th-text hover:bg-th-bg-3 transition-colors text-left"
              >
                <span className="text-base" aria-hidden="true">{target.icon}</span>
                <span className="font-medium">{t(target.labelKey) || target.fallback}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
