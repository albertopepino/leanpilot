"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/stores/useI18n";
import { Plus, X, AlertTriangle, FileText, Footprints } from "lucide-react";
import QuickReportModal from "@/components/shared/QuickReportModal";

interface QuickAction {
  id: string;
  labelKey: string;
  fallbackLabel: string;
  icon: typeof Plus;
  color: string;
  onClick: () => void;
}

export default function QuickActionsFAB() {
  const { t } = useI18n();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);
  const close = useCallback(() => setExpanded(false), []);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expanded, close]);

  const actions: QuickAction[] = [
    {
      id: "report",
      labelKey: "common.reportProblem",
      fallbackLabel: "Report Problem",
      icon: AlertTriangle,
      color: "bg-red-500 hover:bg-red-600 text-white",
      onClick: () => {
        close();
        setShowReportModal(true);
      },
    },
    {
      id: "production",
      labelKey: "common.logProduction",
      fallbackLabel: "Log Production",
      icon: FileText,
      color: "bg-blue-500 hover:bg-blue-600 text-white",
      onClick: () => {
        close();
        router.push("/operations/production");
      },
    },
    {
      id: "gemba",
      labelKey: "common.startGemba",
      fallbackLabel: "Start Gemba Walk",
      icon: Footprints,
      color: "bg-emerald-500 hover:bg-emerald-600 text-white",
      onClick: () => {
        close();
        router.push("/improvement/gemba");
      },
    },
  ];

  return (
    <>
      {/* Report Modal */}
      {showReportModal && (
        <QuickReportModal onClose={() => setShowReportModal(false)} />
      )}

      {/* Overlay when expanded */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/20 z-[49] transition-opacity"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* FAB Container */}
      <div
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex flex-col-reverse items-end gap-3"
        role="group"
        aria-label={t("common.quickActions") || "Quick Actions"}
      >
        {/* Main FAB button */}
        <button
          onClick={toggle}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
            expanded
              ? "bg-th-bg-3 hover:bg-th-bg-hover rotate-45"
              : "bg-brand-600 hover:bg-brand-700"
          }`}
          aria-expanded={expanded}
          aria-label={expanded ? (t("common.close") || "Close") : (t("common.quickActions") || "Quick Actions")}
        >
          {expanded ? (
            <X size={24} className="text-white transition-transform" />
          ) : (
            <Plus size={24} className="text-white transition-transform" />
          )}
        </button>

        {/* Expanded action items */}
        {actions.map((action, index) => {
          const Icon = action.icon;
          const translated = t(action.labelKey);
          const label = (translated && translated !== action.labelKey) ? translated : action.fallbackLabel;
          return (
            <div
              key={action.id}
              className={`flex items-center gap-2 transition-all duration-200 ${
                expanded
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4 pointer-events-none"
              }`}
              style={{
                transitionDelay: expanded ? `${(index + 1) * 50}ms` : "0ms",
              }}
            >
              {/* Label */}
              <span className="px-3 py-1.5 bg-th-bg-2 text-th-text text-sm font-medium rounded-lg shadow-md border border-th-border whitespace-nowrap">
                {label}
              </span>
              {/* Action button */}
              <button
                onClick={action.onClick}
                className={`w-12 h-12 rounded-full shadow-md flex items-center justify-center transition-colors ${action.color} focus-visible:ring-2 focus-visible:ring-offset-2`}
                aria-label={label}
                tabIndex={expanded ? 0 : -1}
              >
                <Icon size={20} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
