"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "@/stores/useI18n";
import {
  HelpCircle,
  X,
  ExternalLink,
  Lightbulb,
  Target,
  Link2,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface HelpEntry {
  title: string;
  phase: "define" | "measure" | "analyze" | "improve" | "control";
  whatIsThisKey: string;
  whenToUseKey: string;
  proTipKey: string;
  connectedTools: { id: string; labelKey: string }[];
}

interface ContextualHelpProps {
  moduleId: string;
  onNavigate?: (view: string) => void;
}

interface ContextualHelpButtonProps {
  moduleId: string;
  onNavigate?: (view: string) => void;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  DMAIC Phase Metadata                                               */
/* ------------------------------------------------------------------ */

const PHASE_META: Record<string, { color: string; gradient: string; labelKey: string }> = {
  define: { color: "text-blue-500", gradient: "from-blue-500 to-cyan-500", labelKey: "help.phaseDefine" },
  measure: { color: "text-emerald-500", gradient: "from-emerald-500 to-teal-500", labelKey: "help.phaseMeasure" },
  analyze: { color: "text-amber-500", gradient: "from-amber-500 to-orange-500", labelKey: "help.phaseAnalyze" },
  improve: { color: "text-purple-500", gradient: "from-purple-500 to-violet-500", labelKey: "help.phaseImprove" },
  control: { color: "text-rose-500", gradient: "from-rose-500 to-pink-500", labelKey: "help.phaseControl" },
};

/* ------------------------------------------------------------------ */
/*  Help Content Registry                                              */
/* ------------------------------------------------------------------ */

export const HELP_CONTENT: Record<string, HelpEntry> = {
  "oee-dashboard": {
    title: "OEE Dashboard",
    phase: "measure",
    whatIsThisKey: "help.oee_whatIsThis",
    whenToUseKey: "help.oee_whenToUse",
    proTipKey: "help.oee_proTip",
    connectedTools: [
      { id: "hourly-board", labelKey: "common.navHourly" },
      { id: "andon-board", labelKey: "common.navAndon" },
      { id: "smed-tracker", labelKey: "common.navSmed" },
      { id: "tpm-dashboard", labelKey: "common.navTpm" },
    ],
  },
  "andon-board": {
    title: "Andon Board",
    phase: "control",
    whatIsThisKey: "help.andon_whatIsThis",
    whenToUseKey: "help.andon_whenToUse",
    proTipKey: "help.andon_proTip",
    connectedTools: [
      { id: "oee-dashboard", labelKey: "common.navDashboard" },
      { id: "five-why", labelKey: "common.navFiveWhy" },
      { id: "hourly-board", labelKey: "common.navHourly" },
    ],
  },
  "sqcdp-board": {
    title: "SQCDP Board",
    phase: "control",
    whatIsThisKey: "help.sqcdp_whatIsThis",
    whenToUseKey: "help.sqcdp_whenToUse",
    proTipKey: "help.sqcdp_proTip",
    connectedTools: [
      { id: "andon-board", labelKey: "common.navAndon" },
      { id: "safety-tracker", labelKey: "common.navSafety" },
      { id: "shift-handover", labelKey: "common.navHandover" },
      { id: "kaizen-board", labelKey: "common.navKaizen" },
    ],
  },
  "kaizen-board": {
    title: "Kaizen Board",
    phase: "improve",
    whatIsThisKey: "help.kaizen_whatIsThis",
    whenToUseKey: "help.kaizen_whenToUse",
    proTipKey: "help.kaizen_proTip",
    connectedTools: [
      { id: "five-why", labelKey: "common.navFiveWhy" },
      { id: "ishikawa", labelKey: "common.navIshikawa" },
      { id: "a3-report", labelKey: "common.navA3" },
      { id: "gemba-walk", labelKey: "common.navGemba" },
    ],
  },
  "vsm-editor": {
    title: "Value Stream Mapping",
    phase: "define",
    whatIsThisKey: "help.vsm_whatIsThis",
    whenToUseKey: "help.vsm_whenToUse",
    proTipKey: "help.vsm_proTip",
    connectedTools: [
      { id: "waste-tracker", labelKey: "common.navWaste" },
      { id: "smed-tracker", labelKey: "common.navSmed" },
      { id: "kaizen-board", labelKey: "common.navKaizen" },
    ],
  },
  "five-s-audit": {
    title: "6S Audit",
    phase: "control",
    whatIsThisKey: "help.sixs_whatIsThis",
    whenToUseKey: "help.sixs_whenToUse",
    proTipKey: "help.sixs_proTip",
    connectedTools: [
      { id: "gemba-walk", labelKey: "common.navGemba" },
      { id: "leader-standard-work", labelKey: "common.navLSW" },
      { id: "audit-scheduler", labelKey: "common.navAuditScheduler" },
    ],
  },
  "smed-tracker": {
    title: "SMED",
    phase: "improve",
    whatIsThisKey: "help.smed_whatIsThis",
    whenToUseKey: "help.smed_whenToUse",
    proTipKey: "help.smed_proTip",
    connectedTools: [
      { id: "oee-dashboard", labelKey: "common.navDashboard" },
      { id: "vsm-editor", labelKey: "common.navVsm" },
      { id: "kaizen-board", labelKey: "common.navKaizen" },
    ],
  },
  "tpm-dashboard": {
    title: "TPM Dashboard",
    phase: "control",
    whatIsThisKey: "help.tpm_whatIsThis",
    whenToUseKey: "help.tpm_whenToUse",
    proTipKey: "help.tpm_proTip",
    connectedTools: [
      { id: "oee-dashboard", labelKey: "common.navDashboard" },
      { id: "cilt-checklist", labelKey: "common.navCilt" },
      { id: "andon-board", labelKey: "common.navAndon" },
    ],
  },
  "gemba-walk": {
    title: "Gemba Walk",
    phase: "measure",
    whatIsThisKey: "help.gemba_whatIsThis",
    whenToUseKey: "help.gemba_whenToUse",
    proTipKey: "help.gemba_proTip",
    connectedTools: [
      { id: "five-s-audit", labelKey: "common.navSixS" },
      { id: "kaizen-board", labelKey: "common.navKaizen" },
      { id: "leader-standard-work", labelKey: "common.navLSW" },
    ],
  },
  "a3-report": {
    title: "A3 Report",
    phase: "analyze",
    whatIsThisKey: "help.a3_whatIsThis",
    whenToUseKey: "help.a3_whenToUse",
    proTipKey: "help.a3_proTip",
    connectedTools: [
      { id: "five-why", labelKey: "common.navFiveWhy" },
      { id: "ishikawa", labelKey: "common.navIshikawa" },
      { id: "kaizen-board", labelKey: "common.navKaizen" },
    ],
  },
  "hourly-board": {
    title: "Hourly Production Board",
    phase: "measure",
    whatIsThisKey: "help.hourly_whatIsThis",
    whenToUseKey: "help.hourly_whenToUse",
    proTipKey: "help.hourly_proTip",
    connectedTools: [
      { id: "oee-dashboard", labelKey: "common.navDashboard" },
      { id: "andon-board", labelKey: "common.navAndon" },
      { id: "shift-handover", labelKey: "common.navHandover" },
    ],
  },
  "leader-standard-work": {
    title: "Leader Standard Work",
    phase: "control",
    whatIsThisKey: "help.lsw_whatIsThis",
    whenToUseKey: "help.lsw_whenToUse",
    proTipKey: "help.lsw_proTip",
    connectedTools: [
      { id: "gemba-walk", labelKey: "common.navGemba" },
      { id: "five-s-audit", labelKey: "common.navSixS" },
      { id: "sqcdp-board", labelKey: "common.navSQCDP" },
    ],
  },
  "shift-handover": {
    title: "Shift Handover",
    phase: "control",
    whatIsThisKey: "help.handover_whatIsThis",
    whenToUseKey: "help.handover_whenToUse",
    proTipKey: "help.handover_proTip",
    connectedTools: [
      { id: "hourly-board", labelKey: "common.navHourly" },
      { id: "andon-board", labelKey: "common.navAndon" },
      { id: "sqcdp-board", labelKey: "common.navSQCDP" },
    ],
  },
  "safety-tracker": {
    title: "Safety Tracker",
    phase: "control",
    whatIsThisKey: "help.safety_whatIsThis",
    whenToUseKey: "help.safety_whenToUse",
    proTipKey: "help.safety_proTip",
    connectedTools: [
      { id: "sqcdp-board", labelKey: "common.navSQCDP" },
      { id: "five-why", labelKey: "common.navFiveWhy" },
      { id: "gemba-walk", labelKey: "common.navGemba" },
    ],
  },
  "kanban-board": {
    title: "Kanban Board",
    phase: "control",
    whatIsThisKey: "help.kanban_whatIsThis",
    whenToUseKey: "help.kanban_whenToUse",
    proTipKey: "help.kanban_proTip",
    connectedTools: [
      { id: "vsm-editor", labelKey: "common.navVsm" },
      { id: "waste-tracker", labelKey: "common.navWaste" },
      { id: "oee-dashboard", labelKey: "common.navDashboard" },
    ],
  },
  "poka-yoke": {
    title: "Poka-Yoke",
    phase: "control",
    whatIsThisKey: "help.pokayoke_whatIsThis",
    whenToUseKey: "help.pokayoke_whenToUse",
    proTipKey: "help.pokayoke_proTip",
    connectedTools: [
      { id: "qc-dashboard", labelKey: "common.navQuality" },
      { id: "five-why", labelKey: "common.navFiveWhy" },
      { id: "kaizen-board", labelKey: "common.navKaizen" },
    ],
  },
  "five-why": {
    title: "5 Why Analysis",
    phase: "analyze",
    whatIsThisKey: "help.fivewhy_whatIsThis",
    whenToUseKey: "help.fivewhy_whenToUse",
    proTipKey: "help.fivewhy_proTip",
    connectedTools: [
      { id: "ishikawa", labelKey: "common.navIshikawa" },
      { id: "a3-report", labelKey: "common.navA3" },
      { id: "kaizen-board", labelKey: "common.navKaizen" },
    ],
  },
  "ishikawa": {
    title: "Ishikawa Diagram",
    phase: "analyze",
    whatIsThisKey: "help.ishikawa_whatIsThis",
    whenToUseKey: "help.ishikawa_whenToUse",
    proTipKey: "help.ishikawa_proTip",
    connectedTools: [
      { id: "five-why", labelKey: "common.navFiveWhy" },
      { id: "pareto-chart", labelKey: "common.navPareto" },
      { id: "a3-report", labelKey: "common.navA3" },
    ],
  },
  "pareto-chart": {
    title: "Pareto Chart",
    phase: "analyze",
    whatIsThisKey: "help.pareto_whatIsThis",
    whenToUseKey: "help.pareto_whenToUse",
    proTipKey: "help.pareto_proTip",
    connectedTools: [
      { id: "ishikawa", labelKey: "common.navIshikawa" },
      { id: "five-why", labelKey: "common.navFiveWhy" },
      { id: "kaizen-board", labelKey: "common.navKaizen" },
    ],
  },
  "waste-tracker": {
    title: "Waste Tracker (TIMWOODS)",
    phase: "measure",
    whatIsThisKey: "help.waste_whatIsThis",
    whenToUseKey: "help.waste_whenToUse",
    proTipKey: "help.waste_proTip",
    connectedTools: [
      { id: "vsm-editor", labelKey: "common.navVsm" },
      { id: "kaizen-board", labelKey: "common.navKaizen" },
      { id: "gemba-walk", labelKey: "common.navGemba" },
    ],
  },
  "cilt-checklist": {
    title: "CILT Checklist",
    phase: "control",
    whatIsThisKey: "help.cilt_whatIsThis",
    whenToUseKey: "help.cilt_whenToUse",
    proTipKey: "help.cilt_proTip",
    connectedTools: [
      { id: "tpm-dashboard", labelKey: "common.navTpm" },
      { id: "five-s-audit", labelKey: "common.navSixS" },
      { id: "leader-standard-work", labelKey: "common.navLSW" },
    ],
  },
  "qc-dashboard": {
    title: "Quality Control Dashboard",
    phase: "measure",
    whatIsThisKey: "help.qc_whatIsThis",
    whenToUseKey: "help.qc_whenToUse",
    proTipKey: "help.qc_proTip",
    connectedTools: [
      { id: "spc-charts", labelKey: "help.spcTitle" },
      { id: "five-why", labelKey: "common.navFiveWhy" },
      { id: "pareto-chart", labelKey: "common.navPareto" },
    ],
  },
  "spc-charts": {
    title: "SPC Charts",
    phase: "measure",
    whatIsThisKey: "help.spc_whatIsThis",
    whenToUseKey: "help.spc_whenToUse",
    proTipKey: "help.spc_proTip",
    connectedTools: [
      { id: "qc-dashboard", labelKey: "common.navQuality" },
      { id: "pareto-chart", labelKey: "common.navPareto" },
      { id: "oee-dashboard", labelKey: "common.navDashboard" },
    ],
  },
  "lean-assessment": {
    title: "Lean Assessment",
    phase: "define",
    whatIsThisKey: "help.assessment_whatIsThis",
    whenToUseKey: "help.assessment_whenToUse",
    proTipKey: "help.assessment_proTip",
    connectedTools: [
      { id: "vsm-editor", labelKey: "common.navVsm" },
      { id: "kaizen-board", labelKey: "common.navKaizen" },
      { id: "a3-report", labelKey: "common.navA3" },
    ],
  },
  "audit-scheduler": {
    title: "Audit Scheduler",
    phase: "control",
    whatIsThisKey: "help.auditScheduler_whatIsThis",
    whenToUseKey: "help.auditScheduler_whenToUse",
    proTipKey: "help.auditScheduler_proTip",
    connectedTools: [
      { id: "five-s-audit", labelKey: "common.navSixS" },
      { id: "gemba-walk", labelKey: "common.navGemba" },
      { id: "leader-standard-work", labelKey: "common.navLSW" },
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Storage                                                            */
/* ------------------------------------------------------------------ */

const HELP_PREF_KEY = "leanpilot_help_hidden";

function isHelpHidden(): boolean {
  try {
    return localStorage.getItem(HELP_PREF_KEY) === "true";
  } catch {
    return false;
  }
}

function setHelpHidden(hidden: boolean): void {
  try {
    localStorage.setItem(HELP_PREF_KEY, String(hidden));
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/*  Slide-out Panel Component                                          */
/* ------------------------------------------------------------------ */

function HelpPanel({
  moduleId,
  onClose,
  onNavigate,
}: {
  moduleId: string;
  onClose: () => void;
  onNavigate?: (view: string) => void;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const entry = HELP_CONTENT[moduleId];

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  if (!entry) return null;

  const phase = PHASE_META[entry.phase];

  return (
    <div className="fixed inset-0 z-[90] flex justify-end" role="dialog" aria-modal="true" aria-label={t("help.ariaLabel")}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full max-w-sm bg-th-bg-2 border-l border-th-border shadow-xl overflow-y-auto animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-th-bg-2 border-b border-th-border px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-brand-500" />
            <h2 className="text-sm font-bold text-th-text">{entry.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-th-bg-3 text-th-text-3 hover:text-th-text transition"
            aria-label={t("common.close")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* DMAIC Phase badge */}
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-th-text-3 font-semibold mb-2">
              {t("help.dmaicPhase")}
            </h3>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${phase.gradient} bg-opacity-10`}>
              <Target size={12} className="text-white" />
              <span className="text-xs font-semibold text-white">
                {t(phase.labelKey)}
              </span>
            </div>
            <p className="text-xs text-th-text-2 mt-1.5">{t(`help.${entry.phase}Reason`)}</p>
          </div>

          {/* What is this? */}
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-th-text-3 font-semibold mb-1.5 flex items-center gap-1.5">
              <HelpCircle size={12} />
              {t("help.whatIsThis")}
            </h3>
            <p className="text-sm text-th-text-2 leading-relaxed">
              {t(entry.whatIsThisKey)}
            </p>
          </div>

          {/* When to use it */}
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-th-text-3 font-semibold mb-1.5 flex items-center gap-1.5">
              <Target size={12} />
              {t("help.whenToUse")}
            </h3>
            <p className="text-sm text-th-text-2 leading-relaxed">
              {t(entry.whenToUseKey)}
            </p>
          </div>

          {/* Connected tools */}
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-th-text-3 font-semibold mb-2 flex items-center gap-1.5">
              <Link2 size={12} />
              {t("help.connectedTools")}
            </h3>
            <div className="space-y-1">
              {entry.connectedTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate(tool.id);
                      onClose();
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-th-text-2 hover:text-th-text hover:bg-th-bg-3 transition text-left"
                >
                  <ExternalLink size={12} className="flex-shrink-0 text-th-text-3" />
                  {t(tool.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Pro tip */}
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
            <h3 className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold mb-1.5 flex items-center gap-1.5">
              <Lightbulb size={12} />
              {t("help.proTip")}
            </h3>
            <p className="text-xs text-th-text-2 leading-relaxed italic">
              {t(entry.proTipKey)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ContextualHelpButton — the "?" icon to place next to PageHeader    */
/* ------------------------------------------------------------------ */

export function ContextualHelpButton({ moduleId, onNavigate, className = "" }: ContextualHelpButtonProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  // F1 or ? key opens help for current page
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger inside input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "F1" || (e.key === "?" && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!HELP_CONTENT[moduleId]) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full bg-th-bg-3 border border-th-border text-th-text-3 hover:text-brand-500 hover:border-brand-500/30 transition ${className}`}
        aria-label={t("help.openHelp")}
        title={t("help.openHelp") + " (F1)"}
      >
        <HelpCircle size={14} />
      </button>
      {isOpen && (
        <HelpPanel
          moduleId={moduleId}
          onClose={() => setIsOpen(false)}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Default export — for standalone use                                */
/* ------------------------------------------------------------------ */

export default function ContextualHelp({ moduleId, onNavigate }: ContextualHelpProps) {
  return <ContextualHelpButton moduleId={moduleId} onNavigate={onNavigate} />;
}
