"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  Home,
  Gauge,
  Lightbulb,
  Menu,
  TrafficCone,
  Footprints,
  FlaskConical,
  ClipboardPen,
  AlertTriangle,
  Clipboard,
  Package,
  FileText,
  Factory,
  Clock,
  BarChart3,
  HelpCircle,
  Fish,
  Map,
  RefreshCw,
  Wrench,
  Settings as SettingsIcon,
  Sparkles,
  FileWarning,
  FolderOpen,
  Trash2,
  Calendar,
  Compass,
  Bot,
  X,
  LogOut,
  StopCircle,
  ShieldAlert,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MobileNavProps {
  isOperatorMode?: boolean;
}

interface NavTab {
  id: string;
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

// Full navigation for non-operator users on mobile
const fullTabs: NavTab[] = [
  { id: "home", href: "/home", labelKey: "common.navHome", icon: Home },
  { id: "measure", href: "/measure/oee", labelKey: "common.navMeasure", icon: Gauge },
  { id: "improve", href: "/improve/kaizen", labelKey: "common.navImprove", icon: Lightbulb },
  { id: "more", href: "", labelKey: "common.navMore", icon: Menu },
];

// Operator-focused mobile nav: Gemba, QC, Andon, Production Input
const operatorTabs: NavTab[] = [
  { id: "andon", href: "/define/andon", labelKey: "common.navAndon", icon: TrafficCone },
  { id: "gemba", href: "/analyze/gemba", labelKey: "common.navGemba", icon: Footprints },
  { id: "qc", href: "/measure/qc", labelKey: "common.navQCChecks", icon: FlaskConical },
  { id: "input", href: "/define/production", labelKey: "common.navProduction", icon: ClipboardPen },
  { id: "report", href: "", labelKey: "common.navReport", icon: AlertTriangle },
];

export default function MobileNav({ isOperatorMode = false }: MobileNavProps) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const [showQuickReport, setShowQuickReport] = useState(false);

  const tabs = isOperatorMode ? operatorTabs : fullTabs;

  const handleTabClick = (tab: NavTab) => {
    if (tab.id === "more") {
      setShowMore(!showMore);
      return;
    }
    if (tab.id === "report") {
      setShowQuickReport(!showQuickReport);
      return;
    }
    router.push(tab.href);
    setShowMore(false);
  };

  const isActive = (tab: NavTab) => {
    if (tab.id === "more" || tab.id === "report") return false;
    return pathname.startsWith(tab.href);
  };

  return (
    <>
      {/* Quick Report Modal (Operator Mode) */}
      {showQuickReport && (
        <QuickReportModal onClose={() => setShowQuickReport(false)} />
      )}

      {/* More Menu (Full Mode) */}
      {showMore && (
        <MoreMenu
          onClose={() => setShowMore(false)}
          onNavigate={(href) => { router.push(href); setShowMore(false); }}
          onLogout={logout}
        />
      )}

      {/* Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-th-bg-2 border-t border-th-border pb-safe"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around h-14 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab);
            const isReport = tab.id === "report";
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  active
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-th-text-3"
                }`}
                aria-current={active ? "page" : undefined}
                aria-label={t(tab.labelKey)}
              >
                {isReport ? (
                  <span className="bg-red-500 text-white w-10 h-10 rounded-full flex items-center justify-center -mt-5 shadow-lg">
                    <Icon size={20} />
                  </span>
                ) : (
                  <Icon size={20} />
                )}
                <span className="text-[10px] font-medium truncate max-w-[64px]">
                  {t(tab.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Spacer to prevent content from being hidden behind nav */}
      <div className="h-14" aria-hidden="true" />
    </>
  );
}

/* ============================================================
   Quick Report Modal — Operator can quickly report issues to Andon
   ============================================================ */
function QuickReportModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const trapRef = useFocusTrap<HTMLDivElement>();
  const [type, setType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const issueTypes: { id: string; label: string; icon: LucideIcon; color: string }[] = [
    { id: "machine_stop", label: t("common.machineStop") || "Machine Stop", icon: StopCircle, color: "border-red-500 bg-red-50 dark:bg-red-900/20" },
    { id: "quality_issue", label: t("common.qualityIssue") || "Quality Issue", icon: AlertTriangle, color: "border-amber-500 bg-amber-50 dark:bg-amber-900/20" },
    { id: "material_shortage", label: t("common.materialShortage") || "Material Shortage", icon: Package, color: "border-orange-500 bg-orange-50 dark:bg-orange-900/20" },
    { id: "safety_concern", label: t("common.safetyConcern") || "Safety Concern", icon: ShieldAlert, color: "border-purple-500 bg-purple-50 dark:bg-purple-900/20" },
    { id: "maintenance_needed", label: t("common.maintenanceNeeded") || "Maintenance Needed", icon: Wrench, color: "border-blue-500 bg-blue-50 dark:bg-blue-900/20" },
    { id: "other", label: t("common.other") || "Other", icon: MessageSquare, color: "border-gray-500 bg-gray-50 dark:bg-gray-900/20" },
  ];

  const handleSubmit = async () => {
    if (!type) return;
    try {
      const { advancedLeanApi, adminApi } = await import("@/lib/api");
      let lineId = 1;
      try {
        const linesRes = await adminApi.listProductionLines();
        const lines = Array.isArray(linesRes.data) ? linesRes.data : (linesRes.data?.lines || []);
        if (lines.length > 0) lineId = lines[0].id;
      } catch { /* fallback: use default */ }
      await advancedLeanApi.createAndonEvent({
        production_line_id: lineId,
        status: type,
        description: description || issueTypes.find(i => i.id === type)?.label || type,
      });
      setSubmitted(true);
      setTimeout(onClose, 1500);
    } catch {
      setSubmitted(true);
      setTimeout(onClose, 1500);
    }
  };

  return (
    <div ref={trapRef} className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Quick Report">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-th-bg-2 rounded-t-2xl border-t border-th-border p-5 pb-8 pb-safe animate-slide-in">
        {submitted ? (
          <div className="text-center py-8">
            <CheckCircle2 size={48} className="mx-auto mb-3 text-green-500" />
            <h3 className="text-lg font-semibold text-th-text">{t("common.reportSubmitted") || "Report Submitted"}</h3>
            <p className="text-sm text-th-text-2 mt-1">{t("common.reportSubmittedDesc") || "Your team has been notified."}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-th-text">{t("common.quickReport") || "Quick Report"}</h3>
              <button onClick={onClose} className="text-th-text-3 hover:text-th-text" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-th-text-2 mb-4">{t("common.quickReportDesc") || "What type of issue?"}</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {issueTypes.map((issue) => {
                const IssueIcon = issue.icon;
                return (
                  <button
                    key={issue.id}
                    onClick={() => setType(issue.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                      type === issue.id
                        ? issue.color + " border-current font-medium"
                        : "border-th-border bg-th-bg hover:border-th-text-3"
                    }`}
                  >
                    <IssueIcon size={20} />
                    <span className="text-sm text-th-text">{issue.label}</span>
                  </button>
                );
              })}
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("common.describeIssue") || "Describe the issue (optional)..."}
              className="w-full p-3 border border-th-border rounded-xl bg-th-input text-th-text text-sm resize-none h-20 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mb-4"
              aria-label="Issue description"
            />

            <button
              onClick={handleSubmit}
              disabled={!type}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              {t("common.submitReport") || "Submit Report to Andon"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   More Menu — Expanded navigation on mobile
   ============================================================ */
function MoreMenu({ onClose, onNavigate, onLogout }: { onClose: () => void; onNavigate: (href: string) => void; onLogout: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();

  const sections: { title: string; color: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
    {
      title: t("common.navDefine") || "Define",
      color: "text-blue-600",
      items: [
        { href: "/define/production-orders", label: t("common.navProductionOrders"), icon: Clipboard },
        { href: "/define/products", label: t("common.navProducts"), icon: Package },
        { href: "/define/production", label: t("common.navProduction"), icon: FileText },
        { href: "/define/andon", label: t("common.navAndon"), icon: TrafficCone },
      ],
    },
    {
      title: t("common.navMeasure") || "Measure",
      color: "text-emerald-600",
      items: [
        { href: "/measure/oee", label: t("common.navDashboard"), icon: Gauge },
        { href: "/measure/consolidated", label: t("common.navConsolidated"), icon: Factory },
        { href: "/measure/hourly", label: t("common.navHourly"), icon: Clock },
        { href: "/measure/pareto", label: t("common.navPareto"), icon: BarChart3 },
        { href: "/measure/qc", label: t("common.navQCChecks"), icon: FlaskConical },
      ],
    },
    {
      title: t("common.navAnalyze") || "Analyze",
      color: "text-orange-600",
      items: [
        { href: "/analyze/five-why", label: t("common.navFiveWhy"), icon: HelpCircle },
        { href: "/analyze/ishikawa", label: t("common.navIshikawa"), icon: Fish },
        { href: "/analyze/gemba", label: t("common.navGemba"), icon: Footprints },
        { href: "/analyze/vsm", label: t("common.navVsm"), icon: Map },
        { href: "/analyze/a3", label: t("common.navA3"), icon: Clipboard },
      ],
    },
    {
      title: t("common.navImprove") || "Improve",
      color: "text-purple-600",
      items: [
        { href: "/improve/kaizen", label: t("common.navKaizen"), icon: Lightbulb },
        { href: "/improve/smed", label: t("common.navSmed"), icon: RefreshCw },
        { href: "/improve/capa", label: t("common.navCAPA"), icon: Wrench },
        { href: "/improve/tpm", label: t("common.navTpm"), icon: SettingsIcon },
        { href: "/analyze/waste", label: t("common.navWaste") || "Waste Tracker", icon: Trash2 },
      ],
    },
    {
      title: t("common.navControl") || "Control",
      color: "text-teal-600",
      items: [
        { href: "/control/six-s", label: t("common.navSixS"), icon: Sparkles },
        { href: "/control/ncr", label: t("common.navNCR"), icon: FileWarning },
        { href: "/control/qc-policies", label: t("common.navQCPolicies"), icon: FolderOpen },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute bottom-14 left-0 right-0 max-h-[70vh] bg-th-bg-2 border-t border-th-border rounded-t-2xl overflow-y-auto pb-safe animate-slide-in">
        {/* User info */}
        <div className="flex items-center gap-3 p-4 border-b border-th-border">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-sm font-bold text-white">
            {user?.full_name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-th-text truncate">{user?.full_name}</p>
            <p className="text-xs text-th-text-3">{user?.role}</p>
          </div>
          <button
            onClick={() => { onNavigate("/system/settings"); }}
            className="text-th-text-3 hover:text-th-text"
            aria-label={t("common.navSettings")}
          >
            <SettingsIcon size={20} />
          </button>
          <button
            onClick={onLogout}
            className="text-th-text-3 hover:text-red-500"
            aria-label={t("common.signOut")}
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* Quick links */}
        <div className="flex gap-2 p-4 border-b border-th-border overflow-x-auto">
          {([
            { href: "/home", label: t("common.navHome"), icon: Home },
            { href: "/home/calendar", label: t("common.navMasterCalendar") || "Calendar", icon: Calendar },
            { href: "/getting-started/assessment", label: t("common.navAssessment"), icon: Compass },
            { href: "/getting-started/copilot", label: t("common.navCopilot"), icon: Bot },
          ] as { href: string; label: string; icon: LucideIcon }[]).map((link) => {
            const LinkIcon = link.icon;
            return (
              <button
                key={link.href}
                onClick={() => onNavigate(link.href)}
                className="flex items-center gap-1.5 px-3 py-2 bg-th-bg rounded-lg text-sm text-th-text whitespace-nowrap hover:bg-th-bg-hover transition shrink-0"
              >
                <LinkIcon size={16} />
                <span>{link.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sections */}
        <div className="p-4 space-y-4">
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${section.color}`}>
                {section.title}
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {section.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.href}
                      onClick={() => onNavigate(item.href)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-th-text hover:bg-th-bg-hover transition text-left"
                    >
                      <ItemIcon size={18} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
