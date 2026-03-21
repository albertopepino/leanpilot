"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { adminApi, oeeApi, advancedLeanApi, leanApi, qcApi } from "@/lib/api";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Gauge,
  Zap,
  BarChart3,
  Footprints,
  ClipboardCheck,
  ArrowLeftRight,
  Eye,
  Wrench,
  Square,
  CheckSquare,
} from "lucide-react";

/* ─── Types ─── */
interface SupervisorHomeProps {
  onNavigate: (view: string) => void;
}

interface SqcdpStatus {
  safety: "good" | "warning" | "critical";
  quality: "good" | "warning" | "critical";
  cost: "good" | "warning" | "critical";
  delivery: "good" | "warning" | "critical";
  people: "good" | "warning" | "critical";
}

interface KpiSummary {
  oee: number | null;
  activeAndon: number;
  openActions: number;
  openNCRs: number;
  kaizenInProgress: number;
}

interface ChecklistItem {
  id: string;
  labelKey: string;
  fallback: string;
  navTarget: string;
  icon: typeof Shield;
}

/* ─── Constants ─── */
const SQCDP_CONFIG = {
  S: { labelKey: "home.sqcdpSafety", fallback: "Safety", color: "emerald" },
  Q: { labelKey: "home.sqcdpQuality", fallback: "Quality", color: "blue" },
  C: { labelKey: "home.sqcdpCost", fallback: "Cost", color: "amber" },
  D: { labelKey: "home.sqcdpDelivery", fallback: "Delivery", color: "violet" },
  P: { labelKey: "home.sqcdpPeople", fallback: "People", color: "pink" },
} as const;

const STATUS_ICONS = {
  good: CheckCircle2,
  warning: AlertTriangle,
  critical: AlertTriangle,
};

const STATUS_COLORS = {
  good: "text-emerald-500",
  warning: "text-amber-500",
  critical: "text-rose-500",
};

const DAILY_CHECKLIST: ChecklistItem[] = [
  { id: "handover", labelKey: "supervisorHome.checkHandover", fallback: "Review shift handover", navTarget: "handover", icon: ArrowLeftRight },
  { id: "sqcdp", labelKey: "supervisorHome.checkSQCDP", fallback: "Update SQCDP board", navTarget: "sqcdp", icon: BarChart3 },
  { id: "gemba", labelKey: "supervisorHome.checkGemba", fallback: "Gemba walk", navTarget: "gemba", icon: Footprints },
  { id: "lsw", labelKey: "supervisorHome.checkLSW", fallback: "Leader standard work checks", navTarget: "kaizen", icon: ClipboardCheck },
  { id: "kaizen", labelKey: "supervisorHome.checkKaizen", fallback: "Kaizen follow-up", navTarget: "kaizen", icon: Eye },
];

/* ─── Helpers ─── */
function getChecklistStorageKey(userId?: number) {
  const today = new Date().toISOString().slice(0, 10);
  return `leanpilot_supervisor_checklist_${userId || "anon"}_${today}`;
}

function loadChecklist(userId?: number): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(getChecklistStorageKey(userId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveChecklist(userId: number | undefined, state: Record<string, boolean>) {
  try {
    localStorage.setItem(getChecklistStorageKey(userId), JSON.stringify(state));
  } catch { /* ignore */ }
}

/* ─── Component ─── */
export default function SupervisorHome({ onNavigate }: SupervisorHomeProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [sqcdp, setSqcdp] = useState<SqcdpStatus>({ safety: "good", quality: "good", cost: "good", delivery: "good", people: "good" });
  const [kpi, setKpi] = useState<KpiSummary>({ oee: null, activeAndon: 0, openActions: 0, openNCRs: 0, kaizenInProgress: 0 });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [escalations, setEscalations] = useState<{ id: string; text: string; severity: "warning" | "critical"; navTarget: string }[]>([]);

  useEffect(() => {
    setChecklist(loadChecklist(user?.id));
  }, [user?.id]);

  const toggleCheck = (id: string) => {
    setChecklist(prev => {
      const next = { ...prev, [id]: !prev[id] };
      saveChecklist(user?.id, next);
      return next;
    });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const newEscalations: typeof escalations = [];

    try {
      // OEE
      let oeeValue: number | null = null;
      try {
        const factoryRes = await adminApi.getFactory();
        const factory = factoryRes.data ?? factoryRes;
        const lines = factory?.production_lines ?? [];
        if (lines.length > 0) {
          const oeeRes = await oeeApi.getSummary(lines[0].id, 1);
          oeeValue = oeeRes.data?.avg_oee ?? null;
        }
      } catch { /* skip */ }

      // Andon
      let activeAndon = 0;
      try {
        const andonRes = await advancedLeanApi.getAndonStatus();
        const data = Array.isArray(andonRes.data) ? andonRes.data : [];
        activeAndon = data.filter((a: { resolved_at?: string | null }) => !a.resolved_at).length;
      } catch { /* skip */ }

      // NCRs
      let openNCRs = 0;
      try {
        const ncrRes = await qcApi.listNCRs({ status: "open" });
        openNCRs = (ncrRes.data || []).length;
      } catch { /* skip */ }

      // Kaizen
      let kaizenInProgress = 0;
      try {
        const kaizenRes = await leanApi.getKaizenBoard();
        const items = kaizenRes.data?.items || kaizenRes.data || [];
        kaizenInProgress = items.filter((k: { status?: string }) => k.status === "in_progress" || k.status === "doing").length;
      } catch { /* skip */ }

      // CAPA overdue
      let capaOverdue = 0;
      try {
        const capaRes = await qcApi.listCAPAs({ status: "open" });
        const capas = capaRes.data || [];
        capaOverdue = capas.filter((c: { due_date?: string }) => c.due_date && new Date(c.due_date) < new Date()).length;
      } catch { /* skip */ }

      const openActions = capaOverdue + openNCRs + kaizenInProgress;
      setKpi({ oee: oeeValue, activeAndon, openActions, openNCRs, kaizenInProgress });

      // SQCDP status inference
      const newSqcdp: SqcdpStatus = {
        safety: "good",
        quality: oeeValue !== null && oeeValue < 70 ? "critical" : oeeValue !== null && oeeValue < 85 ? "warning" : "good",
        cost: "good",
        delivery: "good",
        people: "good",
      };
      if (openNCRs > 3) newSqcdp.quality = "critical";
      else if (openNCRs > 0) newSqcdp.quality = "warning";
      if (activeAndon > 0) { newSqcdp.delivery = "warning"; }
      setSqcdp(newSqcdp);

      // Build escalation list
      if (activeAndon > 0) {
        newEscalations.push({
          id: "andon", text: `${activeAndon} ${t("supervisorHome.andonActive") || "active Andon alerts"}`,
          severity: activeAndon > 2 ? "critical" : "warning", navTarget: "andon",
        });
      }
      if (capaOverdue > 0) {
        newEscalations.push({
          id: "capa", text: `${capaOverdue} ${t("supervisorHome.capaOverdue") || "overdue CAPA actions"}`,
          severity: "critical", navTarget: "quality",
        });
      }
      if (openNCRs > 2) {
        newEscalations.push({
          id: "ncr", text: `${openNCRs} ${t("supervisorHome.ncrOpen") || "open NCRs need attention"}`,
          severity: "warning", navTarget: "quality",
        });
      }
      setEscalations(newEscalations);
    } catch (err) {
      console.error("[SupervisorHome] Data load error:", err);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const completedChecks = DAILY_CHECKLIST.filter(c => checklist[c.id]).length;
  const totalChecks = DAILY_CHECKLIST.length;
  const checklistPct = Math.round((completedChecks / totalChecks) * 100);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <p className="text-sm text-th-text-3">{t("home.loadingData")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1100px] mx-auto">
      {/* ─── Header ─── */}
      <div>
        <h1 className="text-xl font-bold text-th-text">
          {t("supervisorHome.title") || "My Area Today"}
        </h1>
        <p className="text-xs text-th-text-3">
          {user?.full_name} — {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* ─── SQCDP Status Strip ─── */}
      <div className="grid grid-cols-5 gap-2">
        {(Object.entries(SQCDP_CONFIG) as [string, typeof SQCDP_CONFIG.S][]).map(([letter, cfg], sqIdx) => {
          const statusKey = { S: "safety", Q: "quality", C: "cost", D: "delivery", P: "people" }[letter] as keyof SqcdpStatus;
          const status = sqcdp[statusKey];
          const StatusIcon = STATUS_ICONS[status];
          return (
            <button
              key={letter}
              onClick={() => onNavigate("sqcdp")}
              className={`rounded-xl border border-th-border bg-th-bg-2 p-3 text-center hover:shadow-md transition-all active:scale-[0.98] animate-card-enter animate-card-enter-${sqIdx + 1}`}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className={`text-lg font-bold text-${cfg.color}-600 dark:text-${cfg.color}-400`}>{letter}</span>
                <StatusIcon size={16} className={STATUS_COLORS[status]} />
              </div>
              <p className="text-[10px] text-th-text-3 font-medium">{t(cfg.labelKey) || cfg.fallback}</p>
            </button>
          );
        })}
      </div>

      {/* ─── KPI Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => onNavigate("oee")} className="rounded-xl border border-th-border bg-th-bg-2 p-4 text-left hover:shadow-md transition-all animate-card-enter animate-card-enter-1">
          <div className="flex items-center gap-2 mb-2">
            <Gauge size={16} className="text-brand-500" />
            <span className="text-xs text-th-text-3 font-medium">OEE</span>
          </div>
          <p className={`text-2xl font-bold ${kpi.oee !== null && kpi.oee >= 85 ? "text-emerald-600 dark:text-emerald-400" : kpi.oee !== null && kpi.oee >= 70 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
            {kpi.oee !== null ? `${kpi.oee.toFixed(1)}%` : "—"}
          </p>
        </button>

        <button onClick={() => onNavigate("andon")} className="rounded-xl border border-th-border bg-th-bg-2 p-4 text-left hover:shadow-md transition-all animate-card-enter animate-card-enter-2">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className={kpi.activeAndon > 0 ? "text-rose-500" : "text-emerald-500"} />
            <span className="text-xs text-th-text-3 font-medium">{t("supervisorHome.andonAlerts") || "Andon"}</span>
          </div>
          <p className={`text-2xl font-bold ${kpi.activeAndon > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {kpi.activeAndon}
          </p>
        </button>

        <button onClick={() => onNavigate("quality")} className="rounded-xl border border-th-border bg-th-bg-2 p-4 text-left hover:shadow-md transition-all animate-card-enter animate-card-enter-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className={kpi.openNCRs > 0 ? "text-amber-500" : "text-emerald-500"} />
            <span className="text-xs text-th-text-3 font-medium">{t("supervisorHome.openNCRs") || "Open NCRs"}</span>
          </div>
          <p className="text-2xl font-bold text-th-text">{kpi.openNCRs}</p>
        </button>

        <button onClick={() => onNavigate("kaizen")} className="rounded-xl border border-th-border bg-th-bg-2 p-4 text-left hover:shadow-md transition-all animate-card-enter animate-card-enter-4">
          <div className="flex items-center gap-2 mb-2">
            <Wrench size={16} className="text-amber-500" />
            <span className="text-xs text-th-text-3 font-medium">{t("supervisorHome.actionItems") || "Action Items"}</span>
          </div>
          <p className="text-2xl font-bold text-th-text">{kpi.openActions}</p>
        </button>
      </div>

      {/* ─── Daily Routine Checklist ─── */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-th-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className="text-brand-500" />
            <div>
              <h2 className="text-sm font-semibold text-th-text">{t("supervisorHome.dailyRoutine") || "Daily Routine"}</h2>
              <p className="text-[10px] text-th-text-3">{completedChecks}/{totalChecks} {t("supervisorHome.completed") || "completed"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 rounded-full bg-th-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${checklistPct === 100 ? "bg-emerald-500" : "bg-brand-500"}`}
                style={{ width: `${checklistPct}%` }}
              />
            </div>
            <span className={`text-xs font-bold ${checklistPct === 100 ? "text-emerald-500" : "text-brand-500"}`}>
              {checklistPct}%
            </span>
          </div>
        </div>
        <div className="divide-y divide-th-border/50">
          {DAILY_CHECKLIST.map((item) => {
            const Icon = item.icon;
            const checked = !!checklist[item.id];
            return (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-th-bg-hover transition-colors">
                <button
                  onClick={() => toggleCheck(item.id)}
                  className="shrink-0 text-th-text-2 hover:text-brand-500 transition-colors"
                  aria-label={checked ? "Uncheck" : "Check"}
                >
                  {checked
                    ? <CheckSquare size={20} className="text-emerald-500" />
                    : <Square size={20} className="text-th-text-3" />
                  }
                </button>
                <Icon size={16} className="text-th-text-3 shrink-0" />
                <span className={`flex-1 text-sm ${checked ? "text-th-text-3 line-through" : "text-th-text"}`}>
                  {t(item.labelKey) || item.fallback}
                </span>
                <button
                  onClick={() => onNavigate(item.navTarget)}
                  className="text-brand-500 hover:text-brand-600 transition-colors"
                  aria-label={t("common.goToTool")}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Escalations ─── */}
      {escalations.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-th-text-3 uppercase tracking-wider">
            {t("supervisorHome.escalations") || "Escalations"}
          </h2>
          {escalations.map((esc) => (
            <button
              key={esc.id}
              onClick={() => onNavigate(esc.navTarget)}
              className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left hover:shadow-md transition-all active:scale-[0.98] ${
                esc.severity === "critical"
                  ? "border-rose-200 dark:border-rose-500/20 bg-rose-500/10"
                  : "border-amber-200 dark:border-amber-500/20 bg-amber-500/10"
              }`}
            >
              <AlertTriangle size={18} className={esc.severity === "critical" ? "text-rose-500" : "text-amber-500"} />
              <span className={`flex-1 text-sm font-medium ${
                esc.severity === "critical" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
              }`}>{esc.text}</span>
              <ChevronRight size={16} className="text-th-text-3" />
            </button>
          ))}
        </div>
      )}

      {escalations.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-500/10 p-4">
          <CheckCircle2 size={18} className="text-emerald-500" />
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {t("supervisorHome.noEscalations") || "No escalations — all areas within targets"}
          </p>
        </div>
      )}
    </div>
  );
}
