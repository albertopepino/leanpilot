"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type A3Status =
  | "draft"
  | "in_review"
  | "approved"
  | "implementing"
  | "completed";

interface A3Section {
  key: keyof A3Sections;
  labelKey: string;
  icon: string;
  hintKey: string;
  side: "left" | "right";
}

interface A3Sections {
  background: string;
  current_condition: string;
  goal_statement: string;
  root_cause_analysis: string;
  countermeasures: string;
  implementation_plan: string;
  follow_up: string;
  results: string;
}

interface A3Data extends A3Sections {
  title: string;
  owner: string;
  date: string;
  status: A3Status;
}

interface SavedA3 extends A3Data {
  id: number;
  created_at?: string;
  updated_at?: string;
}

/* ------------------------------------------------------------------ */
/*  Section definitions                                                */
/* ------------------------------------------------------------------ */

const SECTION_DEFS: A3Section[] = [
  { key: "background",          labelKey: "background",        icon: "\u{1F4C4}", hintKey: "backgroundHint",        side: "left"  },
  { key: "current_condition",   labelKey: "currentCondition",  icon: "\u{1F4CA}", hintKey: "currentConditionHint",  side: "left"  },
  { key: "goal_statement",      labelKey: "goalTarget",        icon: "\u{1F3AF}", hintKey: "goalTargetHint",        side: "left"  },
  { key: "root_cause_analysis", labelKey: "rootCauseAnalysis", icon: "\u{1F50D}", hintKey: "rootCauseAnalysisHint", side: "left"  },
  { key: "countermeasures",     labelKey: "countermeasures",   icon: "\u{1F4A1}", hintKey: "countermeasuresHint",   side: "right" },
  { key: "implementation_plan", labelKey: "implementationPlan",icon: "\u{1F4C5}", hintKey: "implementationPlanHint",side: "right" },
  { key: "follow_up",           labelKey: "followUp",          icon: "\u2705",    hintKey: "followUpHint",          side: "right" },
  { key: "results",             labelKey: "results",           icon: "\u{1F4C8}", hintKey: "resultsHint",           side: "right" },
];

const LEFT_SECTIONS = SECTION_DEFS.filter((s) => s.side === "left");
const RIGHT_SECTIONS = SECTION_DEFS.filter((s) => s.side === "right");

/* ------------------------------------------------------------------ */
/*  Section accent colors                                              */
/* ------------------------------------------------------------------ */

const SECTION_ACCENT: Record<string, string> = {
  background:          "border-l-slate-400 dark:border-l-slate-500",
  current_condition:   "border-l-blue-400 dark:border-l-blue-500",
  goal_statement:      "border-l-emerald-400 dark:border-l-emerald-500",
  root_cause_analysis: "border-l-red-400 dark:border-l-red-500",
  countermeasures:     "border-l-amber-400 dark:border-l-amber-500",
  implementation_plan: "border-l-violet-400 dark:border-l-violet-500",
  follow_up:           "border-l-cyan-400 dark:border-l-cyan-500",
  results:             "border-l-green-400 dark:border-l-green-500",
};

/* ------------------------------------------------------------------ */
/*  Status workflow                                                    */
/* ------------------------------------------------------------------ */

const STATUS_FLOW: A3Status[] = [
  "draft",
  "in_review",
  "approved",
  "implementing",
  "completed",
];

const STATUS_META: Record<
  A3Status,
  { labelKey: string; color: string; bg: string; dot: string }
> = {
  draft: {
    labelKey: "statusDraft",
    color: "text-gray-600 dark:text-gray-300",
    bg: "bg-gray-500/10 border-gray-500/20",
    dot: "bg-gray-400",
  },
  in_review: {
    labelKey: "statusInReview",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    dot: "bg-amber-400",
  },
  approved: {
    labelKey: "statusApproved",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  implementing: {
    labelKey: "statusImplementing",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    dot: "bg-blue-400",
  },
  completed: {
    labelKey: "statusCompleted",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    dot: "bg-violet-400",
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const emptyA3 = (): A3Data => ({
  title: "",
  owner: "",
  date: new Date().toISOString().slice(0, 10),
  status: "draft",
  background: "",
  current_condition: "",
  goal_statement: "",
  root_cause_analysis: "",
  countermeasures: "",
  implementation_plan: "",
  follow_up: "",
  results: "",
});

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function A3Report() {
  const { t } = useI18n();
  const { printView, exportToExcel } = useExport();

  /* ---- State ---------------------------------------------------- */
  const [data, setData] = useState<A3Data>(emptyA3());
  const [savedReports, setSavedReports] = useState<SavedA3[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [isPrintView, setIsPrintView] = useState(false);
  const [showList, setShowList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);

  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- Derived -------------------------------------------------- */
  const filledSections = SECTION_DEFS.filter(
    (s) => data[s.key]?.trim(),
  ).length;
  const progress = Math.round((filledSections / SECTION_DEFS.length) * 100);

  const nextStatus = (): A3Status | null => {
    const idx = STATUS_FLOW.indexOf(data.status);
    return idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  /* ---- Field update --------------------------------------------- */
  const updateField = (key: string, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  /* ---- Flash feedback ------------------------------------------- */
  const flash = useCallback((type: "ok" | "err", msg: string) => {
    setFeedback({ type, msg });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3500);
  }, []);

  /* ---- Load list from API --------------------------------------- */
  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(false);
    try {
      const res = await advancedLeanApi.listA3();
      const list: SavedA3[] = Array.isArray(res.data) ? res.data : [];
      setSavedReports(list);
    } catch {
      setListError(true);
      flash("err", t("problem-solving.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [flash, t]);

  /* ---- Save to API ---------------------------------------------- */
  const handleSave = async () => {
    if (!data.title.trim()) {
      flash("err", t("problem-solving.titleRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await advancedLeanApi.createA3(data);
      const saved: SavedA3 = res.data;
      setActiveId(saved.id);
      flash("ok", t("problem-solving.saved"));
      loadList();
    } catch {
      flash("err", t("problem-solving.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  /* ---- Status transition ---------------------------------------- */
  const handleStatusChange = async (newStatus: A3Status) => {
    if (activeId && activeId > 0) {
      try {
        await advancedLeanApi.updateA3Status(
          activeId,
          newStatus,
          newStatus === "completed" ? data.results : undefined,
        );
        flash("ok", t("problem-solving.statusUpdated"));
      } catch {
        flash("err", t("problem-solving.statusFailed"));
      }
    }
    setData((prev) => ({ ...prev, status: newStatus }));
  };

  /* ---- Load a saved report into editor -------------------------- */
  const openReport = (report: SavedA3) => {
    setData({
      title: report.title,
      owner: report.owner,
      date: report.date,
      status: report.status,
      background: report.background,
      current_condition: report.current_condition,
      goal_statement: report.goal_statement,
      root_cause_analysis: report.root_cause_analysis,
      countermeasures: report.countermeasures,
      implementation_plan: report.implementation_plan,
      follow_up: report.follow_up,
      results: report.results,
    });
    setActiveId(report.id);
    setShowList(false);
  };

  /* ---- New blank report ----------------------------------------- */
  const handleNew = () => {
    setData(emptyA3());
    setActiveId(null);
  };

  /* ---- Fetch on mount ------------------------------------------- */
  useEffect(() => {
    loadList();
  }, [loadList]);

  /* ---- Cleanup timer on unmount --------------------------------- */
  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  /* ================================================================ */
  /*  Render helpers                                                   */
  /* ================================================================ */

  const statusMeta = STATUS_META[data.status];
  const next = nextStatus();

  const renderSectionCard = (section: A3Section) => (
    <div
      key={section.key}
      className={
        isPrintView
          ? "border border-th-border p-3 print:border-black print:p-2"
          : `bg-white/60 dark:bg-th-bg-3 backdrop-blur-sm rounded-xl p-5 border border-gray-200 dark:border-th-border border-l-4 ${SECTION_ACCENT[section.key]} hover:shadow-card hover:bg-white/80 dark:hover:bg-th-bg-3 transition-all duration-200 group`
      }
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-lg print:text-base">{section.icon}</span>
        <h3 className="font-bold text-sm text-th-text print:text-xs print:text-black uppercase tracking-wide">
          {t(`problem-solving.${section.labelKey}`)}
        </h3>
        {!isPrintView && data[section.key]?.trim() && (
          <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400" title="Filled" />
        )}
      </div>

      {!isPrintView && (
        <p className="text-[11px] text-th-text-3 mb-3 leading-relaxed">
          {t(`problem-solving.${section.hintKey}`)}
        </p>
      )}

      {isPrintView ? (
        <p className="text-xs text-th-text-2 whitespace-pre-wrap print:text-black print:text-[10px] print:leading-tight min-h-[60px]">
          {data[section.key] || "\u2014"}
        </p>
      ) : (
        <textarea
          value={data[section.key]}
          onChange={(e) => updateField(section.key, e.target.value)}
          rows={5}
          className="w-full px-3.5 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-y bg-white dark:bg-th-input text-th-text placeholder:text-th-text-3 border-gray-200 dark:border-th-border transition-all"
          placeholder={t(`problem-solving.${section.hintKey}`)}
        />
      )}
    </div>
  );

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="space-y-6 max-w-7xl mx-auto print:max-w-none print:m-0 print:p-0" data-print-area="true" role="region" aria-label="A3 Report">
      {/* ---------- Feedback toast ---------- */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg shadow-black/10 text-sm font-medium backdrop-blur-sm transition-all animate-slide-in ${
            feedback.type === "ok"
              ? "bg-emerald-500/90 text-white border border-emerald-400/30"
              : "bg-red-500/90 text-white border border-red-400/30"
          }`}
        >
          <span className="mr-2">{feedback.type === "ok" ? "\u2713" : "\u2717"}</span>
          {feedback.msg}
        </div>
      )}

      {/* ---------- Header (hidden when printing) ---------- */}
      <div className="bg-white/80 dark:bg-th-bg-2 backdrop-blur-sm rounded-2xl p-6 shadow-card border border-gray-200 dark:border-th-border print:hidden transition-all">
        <div className="flex items-start gap-4 mb-5 flex-wrap">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-glow flex-shrink-0">
            A3
          </div>
          <div className="flex-1 min-w-[180px]">
            <h2 className="text-xl font-bold text-th-text">
              {t("problem-solving.a3Title")}
            </h2>
            <p className="text-sm text-th-text-3">
              {t("problem-solving.a3Subtitle")}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleNew}
              className="px-4 py-2.5 bg-white dark:bg-th-input rounded-xl text-sm font-medium text-th-text-2 hover:bg-gray-50 dark:hover:bg-th-bg-3 border border-gray-200 dark:border-th-border transition-all"
            >
              {t("problem-solving.newReport")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowList(!showList);
                if (!showList) loadList();
              }}
              disabled={loading}
              className="px-4 py-2.5 bg-white dark:bg-th-input rounded-xl text-sm font-medium text-th-text-2 hover:bg-gray-50 dark:hover:bg-th-bg-3 border border-gray-200 dark:border-th-border transition-all disabled:opacity-50"
            >
              {loading ? "\u2026" : t("problem-solving.loadReport")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 rounded-xl text-sm font-semibold text-white hover:from-brand-600 hover:to-brand-700 hover:shadow-glow transition-all disabled:opacity-50"
            >
              {saving ? "\u2026" : t("problem-solving.saveReport")}
            </button>
            <button
              type="button"
              onClick={() => setIsPrintView(!isPrintView)}
              className="px-4 py-2.5 bg-white dark:bg-th-input rounded-xl text-sm font-medium text-th-text-2 hover:bg-gray-50 dark:hover:bg-th-bg-3 border border-gray-200 dark:border-th-border transition-all"
            >
              {isPrintView
                ? t("problem-solving.editMode")
                : t("problem-solving.printView")}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2.5 bg-white dark:bg-th-input rounded-xl text-sm text-th-text-2 hover:bg-gray-50 dark:hover:bg-th-bg-3 border border-gray-200 dark:border-th-border transition-all"
              aria-label={t("problem-solving.print")}
            >
              {"\u{1F5A8}\uFE0F"}
            </button>
          </div>
        </div>

        {/* Title input */}
        <input
          type="text"
          value={data.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder={t("problem-solving.a3TitlePlaceholder")}
          className="w-full px-4 py-3 bg-white dark:bg-th-input backdrop-blur-sm border border-gray-200 dark:border-th-border rounded-xl text-th-text placeholder:text-th-text-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
        />

        {/* Owner, Date, Status row */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-1.5">
              {t("problem-solving.owner")}
            </label>
            <input
              type="text"
              value={data.owner}
              onChange={(e) => updateField("owner", e.target.value)}
              placeholder={t("problem-solving.ownerPlaceholder")}
              className="w-full px-3 py-2 bg-white dark:bg-th-input backdrop-blur-sm border border-gray-200 dark:border-th-border rounded-xl text-th-text placeholder:text-th-text-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-1.5">
              {t("problem-solving.date")}
            </label>
            <input
              type="date"
              value={data.date}
              onChange={(e) => updateField("date", e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-th-input backdrop-blur-sm border border-gray-200 dark:border-th-border rounded-xl text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all dark:[color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-1.5">
              {t("problem-solving.status")}
            </label>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${statusMeta.bg} ${statusMeta.color}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                {t(`problem-solving.${statusMeta.labelKey}`)}
              </span>
              {next && (
                <button
                  type="button"
                  onClick={() => handleStatusChange(next)}
                  className="px-3 py-1.5 bg-white dark:bg-th-input rounded-lg text-xs font-medium text-th-text-2 hover:bg-gray-50 dark:hover:bg-th-bg-3 border border-gray-200 dark:border-th-border transition-all"
                  title={t(`problem-solving.${STATUS_META[next].labelKey}`)}
                >
                  {"→"} {t(`problem-solving.${STATUS_META[next].labelKey}`)}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 bg-th-bg-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-th-text-3 tabular-nums font-medium">
            {filledSections}/{SECTION_DEFS.length}{" "}
            {t("problem-solving.sections")}
          </span>
        </div>
      </div>

      {/* ---------- Export Toolbar ---------- */}
      <ExportToolbar
        onPrint={() => printView(t("common.titleA3"))}
        onExportExcel={() =>
          exportToExcel({
            title: t("common.titleA3"),
            columns: [
              t("problem-solving.a3Title") || "Title",
              t("problem-solving.status") || "Status",
              t("problem-solving.owner") || "Owner",
              t("problem-solving.date") || "Date",
              t("problem-solving.background") || "Background",
              t("problem-solving.currentCondition") || "Current Condition",
              t("problem-solving.goalStatement") || "Goal Statement",
              t("problem-solving.rootCauseAnalysis") || "Root Cause Analysis",
              t("problem-solving.countermeasures") || "Countermeasures",
              t("problem-solving.implementationPlan") || "Implementation Plan",
              t("problem-solving.followUp") || "Follow Up",
              t("problem-solving.results") || "Results",
            ],
            rows: [
              [
                data.title,
                data.status,
                data.owner,
                data.date,
                data.background,
                data.current_condition,
                data.goal_statement,
                data.root_cause_analysis,
                data.countermeasures,
                data.implementation_plan,
                data.follow_up,
                data.results,
              ],
            ],
          })
        }
      />

      {/* ---------- Saved reports list (collapsible) ---------- */}
      {showList && (
        <div className="bg-white/80 dark:bg-th-bg-2 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-th-border shadow-card overflow-hidden print:hidden animate-slide-in transition-all">
          <div className="p-4 border-b border-gray-200 dark:border-th-border flex items-center justify-between">
            <h3 className="font-bold text-th-text text-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              {t("problem-solving.savedReports")}
            </h3>
            <button
              type="button"
              onClick={() => setShowList(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-th-text-3 hover:text-th-text hover:bg-gray-100 dark:hover:bg-th-bg-3 transition-all"
              aria-label={t("problem-solving.close")}
            >
              &times;
            </button>
          </div>

          {loading ? (
            <div className="p-6 flex items-center justify-center gap-2 text-th-text-3 text-sm">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {t("problem-solving.loading")}
            </div>
          ) : listError ? (
            <div className="p-4 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
              <span>{t("problem-solving.loadFailed")}</span>
              <button
                type="button"
                onClick={loadList}
                className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
              >
                {t("problem-solving.retry")}
              </button>
            </div>
          ) : savedReports.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-th-text-3">
                {t("problem-solving.noReports")}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-th-border max-h-72 overflow-y-auto">
              {savedReports.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.draft;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => openReport(r)}
                      className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-th-bg-3 transition-all flex items-center gap-3 ${
                        activeId === r.id
                          ? "bg-brand-50/50 dark:bg-brand-500/5 ring-1 ring-inset ring-brand-500/30"
                          : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-th-text truncate">
                          {r.title}
                        </p>
                        <p className="text-xs text-th-text-3">
                          {r.owner} &middot; {r.date}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${meta.bg} ${meta.color}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {t(`problem-solving.${meta.labelKey}`)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ---------- A3 Grid (landscape two-column layout) ---------- */}
      {isPrintView && (
        <div className="text-center mb-2 print:mb-1">
          <p className="text-xs text-th-text-3 print:hidden">
            {t("problem-solving.a3PrintHint")}
          </p>
        </div>
      )}

      <div
        className={
          isPrintView
            ? "grid grid-cols-2 gap-0 border-2 border-th-border rounded-lg overflow-hidden print:border-black print:rounded-none"
            : "grid grid-cols-1 lg:grid-cols-2 gap-5"
        }
      >
        {/* Left side: Problem / Analysis */}
        {isPrintView ? (
          <>
            {LEFT_SECTIONS.map(renderSectionCard)}
            {RIGHT_SECTIONS.map(renderSectionCard)}
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <span className="text-xs font-bold text-th-text uppercase tracking-wider">
                    {t("problem-solving.problemAnalysis")}
                  </span>
                  <div className="h-0.5 w-12 mt-1 bg-gradient-to-r from-blue-500 to-transparent rounded-full" />
                </div>
              </div>
              {LEFT_SECTIONS.map(renderSectionCard)}
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <span className="text-xs font-bold text-th-text uppercase tracking-wider">
                    {t("problem-solving.solutionAction")}
                  </span>
                  <div className="h-0.5 w-12 mt-1 bg-gradient-to-r from-emerald-500 to-transparent rounded-full" />
                </div>
              </div>
              {RIGHT_SECTIONS.map(renderSectionCard)}
            </div>
          </>
        )}
      </div>

      {/* ---------- Status workflow stepper (screen only) ---------- */}
      <div className="bg-white/80 dark:bg-th-bg-2 backdrop-blur-sm rounded-2xl p-5 border border-gray-200 dark:border-th-border shadow-card print:hidden transition-all">
        <h3 className="text-xs font-bold text-th-text uppercase tracking-wider mb-4">
          {t("problem-solving.workflow")}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FLOW.map((s, i) => {
            const meta = STATUS_META[s];
            const isActive = s === data.status;
            const isPast = STATUS_FLOW.indexOf(data.status) > i;
            return (
              <div key={s} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    isActive
                      ? `${meta.bg} ${meta.color} ring-2 ring-brand-500/30 shadow-sm`
                      : isPast
                        ? "bg-th-bg-3 text-th-text-2 border-gray-200 dark:border-th-border"
                        : "bg-white dark:bg-transparent text-th-text-3 border-gray-200 dark:border-th-border hover:bg-gray-50 dark:hover:bg-th-bg-3"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isPast && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  )}
                  {isActive && <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />}
                  {t(`problem-solving.${meta.labelKey}`)}
                </button>
                {i < STATUS_FLOW.length - 1 && (
                  <div className={`w-4 h-0.5 rounded-full ${
                    isPast ? "bg-emerald-300 dark:bg-emerald-500/40" : "bg-gray-200 dark:bg-th-bg-3"
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- Print header (visible only in @media print) ---- */}
      <div className="hidden print:block mb-4">
        <div className="text-center border-b-2 border-black pb-2 mb-2">
          <h1 className="text-lg font-bold">
            {data.title || t("problem-solving.a3Title")}
          </h1>
          <p className="text-xs">
            {t("problem-solving.owner")}: {data.owner || "\u2014"} &nbsp;|&nbsp;
            {t("problem-solving.date")}: {data.date} &nbsp;|&nbsp;
            {t("problem-solving.status")}:{" "}
            {t(`problem-solving.${statusMeta.labelKey}`)}
          </p>
        </div>
      </div>

      {/* ---------- Print styles ---------------------------------- */}
      <style>{`
        @media print {
          @page {
            size: A3 landscape;
            margin: 10mm;
          }
          body * { visibility: hidden; }
          .print\\:block,
          .print\\:block * { visibility: visible; }
          [class*="grid-cols-2"],
          [class*="grid-cols-2"] * {
            visibility: visible;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
