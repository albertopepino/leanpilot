"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { useI18n } from "@/stores/useI18n";

/* ------------------------------------------------------------------ */
/*  Path segment -> human-readable label mapping                       */
/* ------------------------------------------------------------------ */

const SEGMENT_LABELS: Record<string, string> = {
  // New top-level groups
  operations: "common.navOperations",
  quality: "common.navQuality",
  planning: "common.navPlanning",
  improvement: "common.navImprovement",
  system: "common.navSystem",

  // Legacy top-level groups (kept for backward compatibility)
  production: "common.navProductionGroup",
  problems: "common.navProblemSolvingGroup",
  daily: "common.navDailyManagement",
  define: "common.navDefine",
  measure: "common.navMeasure",
  analyze: "common.navAnalyze",
  improve: "common.navImprove",
  control: "common.navControl",

  // Other top-level groups
  home: "common.navHome",
  "getting-started": "common.navGettingStarted",
  shopfloor: "common.navShopFloor",

  // Operations modules
  safety: "common.navSafety",
  sqcdp: "common.navSQCDP",
  andon: "common.navAndon",
  oee: "common.navOEE",

  // Planning modules
  orders: "common.navOrders",
  products: "common.navProducts",

  // Improvement modules
  kaizen: "common.navKaizen",
  "root-cause": "common.navRootCause",
  a3: "common.navA3",
  gemba: "common.navGemba",
  "lean-tools": "common.navLeanTools",
  tpm: "common.navTPM",
  "six-s": "common.navSixS",

  // System modules
  settings: "common.navSettings",
  admin: "common.navAdmin",

  // Legacy module segments (still needed for redirect pages)
  dashboard: "common.navDashboard",
  hourly: "common.navHourly",
  input: "common.navProduction",
  kanban: "common.navKanban",
  handover: "common.navHandover",
  "qc-dashboard": "common.navQCDashboard",
  spc: "common.navSPC",
  "poka-yoke": "common.navPokaYoke",
  waste: "common.navWaste",
  "five-why": "common.navFiveWhy",
  ishikawa: "common.navIshikawa",
  smed: "common.navSmed",
  vsm: "common.navVsm",
  lsw: "common.navLSW",
  "audit-scheduler": "common.navAuditScheduler",
  assessment: "common.navAssessment",
  copilot: "common.navCopilot",
  resources: "common.navResources",
  scorecard: "common.navScorecard",
  calendar: "common.navMasterCalendar",
  consolidated: "common.navConsolidated",
  pareto: "common.navPareto",
  defects: "common.navDefects",
  qc: "common.navQCChecks",
  "mind-map": "common.navMindMap",
  capa: "common.navCAPA",
  cilt: "common.navCilt",
  "qc-policies": "common.navQCPolicies",
  ncr: "common.navNCR",
  "horizontal-deploy": "common.navHorizontalDeploy",
  "production-input": "common.navProduction",
};

function humanize(segment: string): string {
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Breadcrumb() {
  const pathname = usePathname();
  const { t } = useI18n();

  if (!pathname || pathname === "/operations/home") return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  // Build crumbs: each has label + href
  const crumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const labelKey = SEGMENT_LABELS[seg];
    const label = labelKey ? t(labelKey) || humanize(seg) : humanize(seg);
    return { label, href };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-th-text-3 min-w-0">
      {/* Home icon */}
      <Link
        href="/operations/home"
        className="flex items-center hover:text-brand-500 transition shrink-0"
        aria-label={t("common.navHome") || "Home"}
      >
        <Home size={13} />
      </Link>

      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1 min-w-0">
            <ChevronRight size={11} className="text-th-text-3/50 shrink-0" />
            {isLast ? (
              <span
                className="font-medium text-th-text truncate max-w-[160px] md:max-w-none"
                aria-current="page"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-brand-500 transition truncate max-w-[100px] md:max-w-[160px]"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
