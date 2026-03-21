"use client";
import { Suspense } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { ChevronRight, ArrowLeft, Check } from "lucide-react";
import { useI18n } from "@/stores/useI18n";
import { useBeginnerMode } from "@/stores/useBeginnerMode";

/**
 * Flow breadcrumb + PDCA step indicator for cross-tool navigation.
 * Shows where the user came from, where they are, and what comes next.
 */

const BACK_ROUTES: Record<string, string> = {
  oee: "/operations/home",
  downtime: "/operations/home",
  pareto: "/improvement/pareto",
  "6s-audit": "/operations/standards/six-s",
  assessment: "/operations/standards/assessment",
  sqcdp: "/operations/daily/sqcdp",
  spc: "/quality/spc",
  safety: "/quality/safety",
  andon: "/operations/respond/andon",
};

const MODULE_LABELS: Record<string, string> = {
  oee: "OEE Dashboard",
  downtime: "OEE Dashboard",
  pareto: "Pareto Analysis",
  "6s-audit": "6S Audit",
  assessment: "Lean Assessment",
  sqcdp: "SQCDP Board",
  spc: "SPC Charts",
  safety: "Safety",
  andon: "Andon Board",
};

/* ── PDCA Flow Steps ──────────────────────────────────────────────── */
interface FlowStep {
  key: string;
  labelKey: string;
  fallback: string;
  route: string;
}

const PDCA_STEPS: FlowStep[] = [
  { key: "identify", labelKey: "problem-solving.flowStep1", fallback: "Identify", route: "/operations/home" },
  { key: "analyze", labelKey: "problem-solving.flowStep2", fallback: "Analyze", route: "/improvement/pareto" },
  { key: "rootcause", labelKey: "problem-solving.flowStep3", fallback: "Root Cause", route: "/improvement/root-cause" },
  { key: "action", labelKey: "problem-solving.flowStep4", fallback: "Action", route: "/improvement/kaizen" },
];

// Map pathname to PDCA step index
function getCurrentStep(pathname: string): number {
  if (pathname.includes("/operations/home") || pathname.includes("/oee")) return 0;
  if (pathname.includes("/pareto")) return 1;
  if (pathname.includes("/root-cause")) return 2;
  if (pathname.includes("/kaizen")) return 3;
  return -1;
}

// Only show PDCA stepper for these flow sources
const PDCA_SOURCES = new Set(["oee", "downtime", "pareto", "6s-audit", "assessment"]);

function FlowBreadcrumbInner({ currentLabel }: { currentLabel: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { enabled: beginnerMode } = useBeginnerMode();

  const fromModule = searchParams.get("from");
  const fromLabel = searchParams.get("fromLabel");
  const currentStep = getCurrentStep(pathname);

  // In beginner mode, show PDCA stepper even without ?from= on relevant pages
  const hasFlowContext = !!fromModule;
  const showPDCAbeginner = beginnerMode && currentStep >= 0;

  if (!hasFlowContext && !showPDCAbeginner) return null;

  const backRoute = fromModule ? (BACK_ROUTES[fromModule] || "/") : "/";
  const parentLabel = fromLabel || (fromModule ? MODULE_LABELS[fromModule] : "") || fromModule || "";
  const showPDCA = (hasFlowContext && PDCA_SOURCES.has(fromModule!) && currentStep >= 0) || showPDCAbeginner;

  return (
    <div className="space-y-2 print:hidden">
      {/* Back breadcrumb — only when navigated from another tool */}
      {hasFlowContext && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-sm">
          <button
            onClick={() => router.push(backRoute)}
            className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("common.back") ? t("common.back").replace("← ", "") : "Back"}
          </button>
          <div className="flex items-center gap-1.5 text-th-text-2 min-w-0">
            <span className="truncate font-medium text-indigo-600 dark:text-indigo-400">{parentLabel}</span>
            <ChevronRight className="w-3.5 h-3.5 text-th-text-3 shrink-0" />
            <span className="truncate font-semibold text-th-text">{currentLabel}</span>
          </div>
        </div>
      )}

      {/* PDCA Flow Stepper */}
      {showPDCA && (
        <div className="flex items-center gap-1 px-2 py-2 rounded-xl bg-th-bg-2 border border-th-border text-xs">
          {PDCA_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            const isFuture = idx > currentStep;

            return (
              <div key={step.key} className="flex items-center">
                {idx > 0 && (
                  <div className={`w-4 sm:w-6 h-px mx-0.5 ${isCompleted || isCurrent ? "bg-brand-500" : "bg-th-border"}`} />
                )}
                <button
                  onClick={() => {
                    if (!isCurrent) {
                      const params = new URLSearchParams();
                      if (fromModule) params.set("from", fromModule);
                      if (fromLabel) params.set("fromLabel", fromLabel);
                      router.push(`${step.route}${params.toString() ? `?${params.toString()}` : ""}`);
                    }
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                    isCurrent
                      ? "bg-brand-600 text-white shadow-sm"
                      : isCompleted
                        ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-950/60"
                        : "text-th-text-3 hover:text-th-text-2 hover:bg-th-bg-3"
                  }`}
                >
                  {isCompleted && <Check className="w-3 h-3" />}
                  <span className={`${isFuture ? "hidden sm:inline" : ""}`}>
                    {t(step.labelKey) || step.fallback}
                  </span>
                  {isFuture && <span className="sm:hidden">{idx + 1}</span>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FlowBreadcrumb({ currentLabel }: { currentLabel: string }) {
  return (
    <Suspense fallback={null}>
      <FlowBreadcrumbInner currentLabel={currentLabel} />
    </Suspense>
  );
}
