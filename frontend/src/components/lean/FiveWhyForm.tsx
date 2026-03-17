"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useI18n } from "@/stores/useI18n";
import { leanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Countermeasure {
  action: string;
  owner: string;
  dueDate: string;
  status: "open" | "in-progress" | "verified";
}

interface SavedAnalysis {
  id: string;
  title: string;
  problem: string;
  answers: string[];
  verification: boolean[];
  countermeasures: Countermeasure[];
  rootCause?: string;
  createdAt?: string;
  status?: string;
}

interface Toast {
  type: "success" | "error";
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MIN_STEPS = 3;
const MAX_STEPS = 7;
const INITIAL_STEPS = 5;
const TOAST_DURATION_MS = 4000;

const EMPTY_COUNTERMEASURE: Countermeasure = {
  action: "",
  owner: "",
  dueDate: "",
  status: "open",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Progressive depth colors — deeper = more intense. */
function stepColor(idx: number, total: number) {
  const depth = total <= 1 ? 1 : idx / (total - 1);
  if (depth <= 0.2)
    return "border-l-brand-300 dark:border-l-brand-400 bg-brand-50/60 dark:bg-brand-950/20";
  if (depth <= 0.4)
    return "border-l-brand-400 dark:border-l-brand-500 bg-brand-50/80 dark:bg-brand-950/30";
  if (depth <= 0.6)
    return "border-l-amber-400 dark:border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20";
  if (depth <= 0.8)
    return "border-l-orange-400 dark:border-l-orange-500 bg-orange-50/60 dark:bg-orange-950/20";
  return "border-l-red-400 dark:border-l-red-500 bg-red-50/60 dark:bg-red-950/25";
}

function stepGlowRing(idx: number, total: number) {
  const depth = total <= 1 ? 0 : idx / (total - 1);
  if (depth >= 0.85) return "ring-1 ring-red-400/20 dark:ring-red-500/20";
  return "";
}

/** Skeleton placeholder for the history panel. */
function HistorySkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between py-3">
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-th-bg-3 rounded w-1/3" />
            <div className="h-3 bg-th-bg-3 rounded w-2/3" />
            <div className="h-3 bg-th-bg-3 rounded w-1/4" />
          </div>
          <div className="h-6 bg-th-bg-3 rounded w-12 ml-4" />
        </div>
      ))}
    </div>
  );
}

/** Spinner SVG used by buttons. */
function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
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
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FiveWhyForm() {
  const { t } = useI18n();
  const { printView, exportToExcel } = useExport();

  // --- core form state ---
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [answers, setAnswers] = useState<string[]>(
    () => new Array(INITIAL_STEPS).fill(""),
  );
  const [stepCount, setStepCount] = useState(INITIAL_STEPS);
  const [verification, setVerification] = useState<boolean[]>(
    () => new Array(MAX_STEPS).fill(false),
  );
  const [countermeasures, setCountermeasures] = useState<Countermeasure[]>([
    { ...EMPTY_COUNTERMEASURE },
  ]);

  // --- UI state ---
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- toast helper ---
  const showToast = useCallback((type: Toast["type"], message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // --- load history on mount ---
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(false);
    try {
      const res = await leanApi.listFiveWhy();
      setSavedAnalyses(res.data ?? []);
    } catch {
      setHistoryError(true);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // --- derived ---
  const lastFilledIdx = (() => {
    for (let i = stepCount - 1; i >= 0; i--) {
      if (answers[i]?.trim()) return i;
    }
    return -1;
  })();

  const rootCause =
    lastFilledIdx >= 0 ? answers[lastFilledIdx]?.trim() ?? "" : "";

  const filledWhyCount = answers
    .slice(0, stepCount)
    .filter((a) => a.trim()).length;
  const chainComplete = lastFilledIdx >= 0 && problem.trim() !== "";

  // --- callbacks ---

  const updateAnswer = (idx: number, value: string) => {
    if (readOnly) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const addStep = () => {
    if (readOnly || stepCount >= MAX_STEPS) return;
    setStepCount((c) => c + 1);
    setAnswers((prev) => {
      const next = [...prev];
      if (next.length < stepCount + 1) next.push("");
      return next;
    });
  };

  const removeStep = (idx: number) => {
    if (readOnly || stepCount <= MIN_STEPS) return;
    setAnswers((prev) => {
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
    setStepCount((c) => c - 1);
  };

  const toggleVerification = (idx: number) => {
    if (readOnly) return;
    setVerification((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const updateCountermeasure = (
    idx: number,
    field: keyof Countermeasure,
    value: string,
  ) => {
    if (readOnly) return;
    setCountermeasures((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addCountermeasure = () => {
    if (readOnly) return;
    setCountermeasures((prev) => [...prev, { ...EMPTY_COUNTERMEASURE }]);
  };

  const removeCountermeasure = (idx: number) => {
    if (readOnly) return;
    setCountermeasures((prev) => prev.filter((_, i) => i !== idx));
  };

  // --- causal chain prompt ---
  const whyPrompt = (idx: number): string => {
    if (idx === 0) return problem.trim() || "...";
    return answers[idx - 1]?.trim() || "...";
  };

  // --- validation ---
  const validate = (): boolean => {
    const errors: string[] = [];
    if (!problem.trim()) {
      errors.push(t("problem-solving.validationProblemRequired"));
    }
    if (filledWhyCount < MIN_STEPS) {
      errors.push(
        t("problem-solving.validationMinWhys", { n: String(MIN_STEPS) }),
      );
    }
    setValidationErrors(errors);
    return errors.length === 0;
  };

  // --- save ---
  const handleSave = async () => {
    if (readOnly) return;
    if (!validate()) return;

    const payload = {
      title: title.trim() || t("problem-solving.untitledAnalysis"),
      problem: problem.trim(),
      answers: answers.slice(0, stepCount),
      rootCause,
      verification: verification.slice(0, stepCount + 1),
      countermeasures,
    };

    setSaving(true);
    try {
      await leanApi.createFiveWhy(payload);
      showToast("success", t("problem-solving.saveSuccess"));
      // Refresh history to include the new analysis
      fetchHistory();
    } catch {
      showToast("error", t("problem-solving.saveError"));
    } finally {
      setSaving(false);
    }
  };

  // --- delete ---
  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await leanApi.deleteFiveWhy(id as unknown as number);
      setSavedAnalyses((prev) => prev.filter((a) => a.id !== id));
      // If the deleted analysis is currently loaded, reset the form
      if (activeAnalysisId === id) {
        handleNewAnalysis();
      }
      showToast("success", t("problem-solving.deleteSuccess"));
    } catch {
      showToast("error", t("problem-solving.deleteError"));
    } finally {
      setDeleting(null);
    }
  };

  // --- load a saved analysis (read-only) ---
  const loadAnalysis = (analysis: SavedAnalysis) => {
    setTitle(analysis.title ?? "");
    setProblem(analysis.problem ?? "");
    const loadedAnswers = analysis.answers ?? [];
    const count = Math.max(
      MIN_STEPS,
      Math.min(MAX_STEPS, loadedAnswers.length),
    );
    setStepCount(count);
    const padded = [...loadedAnswers];
    while (padded.length < MAX_STEPS) padded.push("");
    setAnswers(padded);
    setVerification(
      analysis.verification ?? new Array(MAX_STEPS).fill(false),
    );
    setCountermeasures(
      analysis.countermeasures?.length
        ? analysis.countermeasures
        : [{ ...EMPTY_COUNTERMEASURE }],
    );
    setValidationErrors([]);
    setReadOnly(true);
    setActiveAnalysisId(analysis.id);
  };

  // --- new analysis (reset form) ---
  const handleNewAnalysis = () => {
    setTitle("");
    setProblem("");
    setAnswers(new Array(INITIAL_STEPS).fill(""));
    setStepCount(INITIAL_STEPS);
    setVerification(new Array(MAX_STEPS).fill(false));
    setCountermeasures([{ ...EMPTY_COUNTERMEASURE }]);
    setValidationErrors([]);
    setReadOnly(false);
    setActiveAnalysisId(null);
  };

  // --- export PDF via browser print ---
  const handleExportPdf = () => {
    window.print();
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="max-w-5xl mx-auto print:max-w-none" data-print-area="true" role="region" aria-label="Five Why Analysis">
      {/* ---- Toast notification ---- */}
      {toast && (
        <div
          role="alert"
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg shadow-black/10 text-sm font-medium backdrop-blur-sm transition-all animate-slide-in ${
            toast.type === "success"
              ? "bg-emerald-500/90 text-white border border-emerald-400/30"
              : "bg-red-500/90 text-white border border-red-400/30"
          }`}
        >
          <span className="mr-2">{toast.type === "success" ? "\u2713" : "\u2717"}</span>
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-3 font-bold opacity-80 hover:opacity-100 transition-opacity"
            aria-label={t("problem-solving.dismiss")}
          >
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ============================================================ */}
        {/*  HISTORY PANEL (left / top on mobile)                         */}
        {/* ============================================================ */}
        <div className="lg:col-span-1 print:hidden">
          <div className="bg-th-bg-2 backdrop-blur-sm p-5 rounded-2xl shadow-card border border-th-border transition-all">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold text-th-text-2 uppercase tracking-wider">
                {t("problem-solving.savedAnalyses")}
              </h4>
              <button
                type="button"
                onClick={handleNewAnalysis}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
              >
                + {t("problem-solving.newAnalysis")}
              </button>
            </div>

            {/* Loading skeleton */}
            {loadingHistory && <HistorySkeleton />}

            {/* Error state with retry */}
            {!loadingHistory && historyError && (
              <div className="text-center py-6">
                <p className="text-sm text-th-text-2 mb-3">
                  {t("problem-solving.loadError")}
                </p>
                <button
                  type="button"
                  onClick={fetchHistory}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 px-4 py-2 rounded-xl border border-th-border hover:bg-th-bg-3 transition-all"
                >
                  {t("problem-solving.retry")}
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loadingHistory && !historyError && savedAnalyses.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-th-bg-3 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-th-text-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <p className="text-sm text-th-text-2">
                  {t("problem-solving.noSavedAnalyses")}
                </p>
              </div>
            )}

            {/* History list */}
            {!loadingHistory && !historyError && savedAnalyses.length > 0 && (
              <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                {savedAnalyses.map((a) => (
                  <li
                    key={a.id}
                    className={`rounded-xl transition-all duration-200 ${
                      activeAnalysisId === a.id
                        ? "bg-brand-50 dark:bg-brand-500/10 ring-1 ring-brand-500/30"
                        : "hover:bg-th-bg-3"
                    }`}
                  >
                    <div
                      className="px-3 py-3 cursor-pointer"
                      onClick={() => loadAnalysis(a)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          loadAnalysis(a);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-th-text truncate">
                            {a.title}
                          </p>
                          <p className="text-xs text-th-text-2 truncate mt-0.5">
                            {a.problem}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {a.createdAt && (
                              <span className="text-[10px] text-th-text-3">
                                {new Date(a.createdAt).toLocaleDateString()}
                              </span>
                            )}
                            {a.status && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                                  a.status === "verified"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : a.status === "in-progress"
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                      : "bg-th-bg-3 text-th-text-2 border-th-border"
                                }`}
                              >
                                {t(`problem-solving.status${a.status.charAt(0).toUpperCase() + a.status.slice(1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}`)}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(a.id);
                          }}
                          disabled={deleting === a.id}
                          className="ml-2 p-1.5 rounded-lg text-th-text-3 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex-shrink-0 disabled:opacity-50 transition-all"
                          aria-label={t("problem-solving.delete")}
                          title={t("problem-solving.delete")}
                        >
                          {deleting === a.id ? (
                            <Spinner className="h-3.5 w-3.5" />
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3.5 w-3.5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/*  MAIN FORM PANEL                                               */}
        {/* ============================================================ */}
        <div className="lg:col-span-2 space-y-6">
          <div
            ref={printRef}
            className="bg-th-bg-2 backdrop-blur-sm p-6 rounded-2xl shadow-card border border-th-border transition-all"
          >
            {/* ---- Read-only banner ---- */}
            {readOnly && (
              <div className="mb-5 p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-between print:hidden backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse-slow" />
                  <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                    {t("problem-solving.viewingAnalysis")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleNewAnalysis}
                  className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline"
                >
                  {t("problem-solving.newAnalysis")}
                </button>
              </div>
            )}

            {/* ---- Section Title ---- */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-lg font-bold shadow-glow">
                  5W
                </div>
                <div>
                  <h3 className="text-lg font-bold text-th-text">
                    {t("problem-solving.fiveWhyTitle")}
                  </h3>
                  <p className="text-xs text-th-text-3">
                    {filledWhyCount}/{stepCount} {t("problem-solving.whyNum", { n: "" }).replace("#", "").trim() || "Whys"}
                  </p>
                </div>
              </div>
              <ExportToolbar
                onPrint={() => printView(t("common.titleFiveWhy"))}
                onExportExcel={() =>
                  exportToExcel({
                    title: t("common.titleFiveWhy"),
                    columns: [
                      t("problem-solving.step") || "Step",
                      t("problem-solving.whyQuestion") || "Why?",
                      t("problem-solving.answer") || "Answer",
                    ],
                    rows: [
                      [t("problem-solving.problemStatement") || "Problem Statement", problem, ""],
                      ...answers.map((ans, i) => [
                        `Why #${i + 1}`,
                        "",
                        ans,
                      ]),
                      [t("problem-solving.rootCause") || "Root Cause", rootCause, ""],
                      ...countermeasures.map((cm, i) => [
                        `${t("problem-solving.countermeasure") || "Countermeasure"} #${i + 1}`,
                        cm.action,
                        cm.owner || "",
                      ]),
                    ],
                  })
                }
              />
            </div>

            {/* ---- Progress bar ---- */}
            <div className="mb-6">
              <div className="h-1.5 bg-th-bg-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${stepCount > 0 ? (filledWhyCount / stepCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* ============================================================ */}
            {/*  ANALYSIS TITLE                                               */}
            {/* ============================================================ */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-th-text-2 uppercase tracking-wider mb-1.5">
                {t("problem-solving.analysisTitle")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                readOnly={readOnly}
                className={`w-full px-4 py-2.5 border rounded-xl bg-th-input text-th-text text-sm border-th-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all ${
                  readOnly ? "opacity-75 cursor-not-allowed" : ""
                }`}
                placeholder={t("problem-solving.analysisTitlePlaceholder")}
              />
            </div>

            {/* ============================================================ */}
            {/*  PROBLEM STATEMENT                                            */}
            {/* ============================================================ */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-th-text-2 uppercase tracking-wider mb-1.5">
                {t("problem-solving.problemStatement")}
                {!readOnly && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                readOnly={readOnly}
                className={`w-full px-4 py-2.5 border rounded-xl resize-none bg-th-input text-th-text text-sm focus:ring-2 focus:ring-brand-500/20 outline-none transition-all ${
                  readOnly
                    ? "opacity-75 cursor-not-allowed border-th-border"
                    : validationErrors.length > 0 && !problem.trim()
                      ? "border-red-400 dark:border-red-500/50 ring-2 ring-red-500/10"
                      : "border-th-border focus:border-brand-500"
                }`}
                rows={2}
                placeholder={t("problem-solving.problemPlaceholder")}
              />
            </div>

            {/* ============================================================ */}
            {/*  VALIDATION ERRORS                                            */}
            {/* ============================================================ */}
            {validationErrors.length > 0 && (
              <div className="mb-5 p-4 rounded-xl bg-red-50/80 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 print:hidden backdrop-blur-sm">
                <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* ============================================================ */}
            {/*  CAUSAL CHAIN - Progressive drill-down                        */}
            {/* ============================================================ */}
            <div className="relative">
              {/* Vertical connecting line */}
              <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-gradient-to-b from-brand-300 via-amber-400 to-red-400 dark:from-brand-500/40 dark:via-amber-500/40 dark:to-red-500/40 rounded-full print:hidden" />

              <div className="space-y-3">
                {Array.from({ length: stepCount }).map((_, idx) => {
                  const isLast = idx === stepCount - 1;
                  const isRootCause = isLast && answers[idx]?.trim() !== "";

                  return (
                    <div
                      key={idx}
                      className={`relative pl-14 transition-all duration-200`}
                      style={{ paddingLeft: `${3.5 + idx * 0.25}rem` }}
                    >
                      {/* Step number circle */}
                      <div
                        className={`absolute left-3 top-4 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all shadow-sm ${
                          isRootCause
                            ? "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-glow-red"
                            : answers[idx]?.trim()
                              ? "bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-glow"
                              : "bg-th-input text-th-text-2 border-2 border-th-border"
                        }`}
                      >
                        {idx + 1}
                      </div>

                      <div
                        className={`p-4 rounded-xl border-l-4 transition-all duration-200 hover:shadow-card ${stepColor(idx, stepCount)} ${stepGlowRing(idx, stepCount)}`}
                      >
                        {/* Step header */}
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-bold text-th-text flex items-center gap-2">
                            {t("problem-solving.whyNum", {
                              n: String(idx + 1),
                            })}
                            {isRootCause && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                {t("problem-solving.rootCause")}
                              </span>
                            )}
                          </p>
                          {!readOnly && idx >= MIN_STEPS && (
                            <button
                              type="button"
                              onClick={() => removeStep(idx)}
                              className="text-xs text-th-text-3 hover:text-red-500 dark:hover:text-red-400 transition-colors print:hidden"
                            >
                              {t("problem-solving.removeStep")}
                            </button>
                          )}
                        </div>

                        {/* Context prompt */}
                        <p className="text-xs text-th-text-3 mb-2 italic leading-relaxed">
                          {t("problem-solving.whyDidHappen", {
                            context: whyPrompt(idx),
                          })}
                        </p>

                        {/* Answer input */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-th-text-2 whitespace-nowrap uppercase tracking-wide">
                            {t("problem-solving.because")}
                          </span>
                          <input
                            type="text"
                            value={answers[idx] ?? ""}
                            onChange={(e) => updateAnswer(idx, e.target.value)}
                            readOnly={readOnly}
                            placeholder={t("problem-solving.becausePlaceholder")}
                            className={`flex-1 px-3 py-2 border rounded-lg text-sm bg-th-input text-th-text focus:ring-2 focus:ring-brand-500/20 outline-none transition-all ${
                              readOnly
                                ? "opacity-75 cursor-not-allowed border-th-border"
                                : validationErrors.length > 0 &&
                                    idx < MIN_STEPS &&
                                    !answers[idx]?.trim()
                                  ? "border-red-400 dark:border-red-500/50"
                                  : "border-th-border focus:border-brand-500"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add step button */}
            {!readOnly && stepCount < MAX_STEPS && (
              <button
                type="button"
                onClick={addStep}
                className="mt-4 ml-14 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium flex items-center gap-1.5 transition-colors print:hidden"
              >
                <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs">+</span>
                {t("problem-solving.addWhy")}
              </button>
            )}

            {/* ============================================================ */}
            {/*  ROOT CAUSE SUMMARY                                           */}
            {/* ============================================================ */}
            {rootCause && (
              <div className="mt-8 p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-600/5 border border-emerald-200 dark:border-emerald-500/20 shadow-sm relative overflow-hidden">
                {/* Subtle glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 dark:bg-emerald-500/30 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </div>
                    <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      {t("problem-solving.rootCause")}
                    </h4>
                  </div>
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    {rootCause}
                  </p>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/*  REVERSE VERIFICATION                                         */}
            {/* ============================================================ */}
            {chainComplete && (
              <div className="mt-8 p-5 rounded-2xl bg-th-bg-3 border border-th-border backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  </div>
                  <h4 className="text-xs font-bold text-th-text uppercase tracking-wider">
                    {t("problem-solving.verifyRootCause")}
                  </h4>
                </div>
                <p className="text-xs text-th-text-3 mb-4 ml-8">
                  {t("problem-solving.verifyDescription")}
                </p>

                {/* Reverse verification question */}
                <div className="mb-4 p-3 rounded-xl bg-brand-50/50 dark:bg-brand-500/5 border border-brand-200/50 dark:border-brand-500/15">
                  <p className="text-sm text-brand-700 dark:text-brand-300 italic">
                    {t("problem-solving.verifyIfFix", {
                      rootCause,
                      effect: problem.trim(),
                    })}
                  </p>
                </div>

                <div className="space-y-2">
                  {(() => {
                    const items: { label: string; key: number }[] = [];
                    const rootIdx = lastFilledIdx;
                    for (let i = rootIdx; i >= 0; i--) {
                      const cause = answers[i]?.trim() ?? "";
                      const effect =
                        i === 0
                          ? problem.trim()
                          : answers[i - 1]?.trim() ?? "";

                      if (!cause || !effect) continue;

                      const label =
                        i === rootIdx
                          ? t("problem-solving.verifyIfFix", {
                              rootCause: cause,
                              effect,
                            })
                          : t("problem-solving.verifyThen", {
                              cause,
                              effect,
                            });

                      items.push({ label, key: i });
                    }

                    if (items.length > 0) {
                      items.push({
                        label: t("problem-solving.verifyThenProblem", {
                          problem: problem.trim(),
                        }),
                        key: -1,
                      });
                    }

                    return items.map((item, vIdx) => (
                      <div
                        key={item.key}
                        className={`flex items-start gap-3 p-2.5 rounded-lg text-sm transition-colors ${
                          verification[vIdx]
                            ? "bg-emerald-50/50 dark:bg-emerald-500/5"
                            : "bg-transparent"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleVerification(vIdx)}
                          disabled={readOnly}
                          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all print:pointer-events-none ${
                            readOnly ? "cursor-not-allowed" : "cursor-pointer hover:scale-110"
                          } ${
                            verification[vIdx]
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-th-border text-transparent hover:border-emerald-400"
                          }`}
                          aria-label={
                            verification[vIdx]
                              ? t("problem-solving.verified")
                              : t("problem-solving.notVerified")
                          }
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                        <span className="text-th-text leading-relaxed">{item.label}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/*  COUNTERMEASURES                                               */}
            {/* ============================================================ */}
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                </div>
                <h4 className="text-xs font-bold text-th-text uppercase tracking-wider">
                  {t("problem-solving.countermeasures")}
                </h4>
              </div>

              <div className="space-y-4">
                {countermeasures.map((cm, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-th-bg-3 border border-th-border space-y-3 hover:shadow-card transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-th-text-3 uppercase tracking-widest">
                        {t("problem-solving.countermeasureNum", {
                          n: String(idx + 1),
                        })}
                      </span>
                      {!readOnly && countermeasures.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCountermeasure(idx)}
                          className="text-xs text-th-text-3 hover:text-red-500 dark:hover:text-red-400 transition-colors print:hidden"
                        >
                          {t("problem-solving.remove")}
                        </button>
                      )}
                    </div>

                    {/* Action */}
                    <div>
                      <label className="block text-xs font-medium text-th-text-2 mb-1">
                        {t("problem-solving.actionDescription")}
                      </label>
                      <textarea
                        value={cm.action}
                        onChange={(e) =>
                          updateCountermeasure(idx, "action", e.target.value)
                        }
                        readOnly={readOnly}
                        className={`w-full px-3 py-2 border rounded-xl resize-none text-sm bg-th-input text-th-text border-th-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all ${
                          readOnly ? "opacity-75 cursor-not-allowed" : ""
                        }`}
                        rows={2}
                        placeholder={t("problem-solving.actionPlaceholder")}
                      />
                    </div>

                    {/* Owner + Due Date + Status row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-th-text-2 mb-1">
                          {t("problem-solving.owner")}
                        </label>
                        <input
                          type="text"
                          value={cm.owner}
                          onChange={(e) =>
                            updateCountermeasure(idx, "owner", e.target.value)
                          }
                          readOnly={readOnly}
                          placeholder={t("problem-solving.ownerPlaceholder")}
                          className={`w-full px-3 py-2 border rounded-lg text-sm bg-th-input text-th-text border-th-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all ${
                            readOnly ? "opacity-75 cursor-not-allowed" : ""
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-th-text-2 mb-1">
                          {t("problem-solving.dueDate")}
                        </label>
                        <input
                          type="date"
                          value={cm.dueDate}
                          onChange={(e) =>
                            updateCountermeasure(idx, "dueDate", e.target.value)
                          }
                          readOnly={readOnly}
                          className={`w-full px-3 py-2 border rounded-lg text-sm bg-th-input text-th-text border-th-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all ${
                            readOnly ? "opacity-75 cursor-not-allowed" : ""
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-th-text-2 mb-1">
                          {t("problem-solving.status")}
                        </label>
                        <select
                          value={cm.status}
                          onChange={(e) =>
                            updateCountermeasure(idx, "status", e.target.value)
                          }
                          disabled={readOnly}
                          className={`w-full px-3 py-2 border rounded-lg text-sm bg-th-input text-th-text border-th-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all ${
                            readOnly ? "opacity-75 cursor-not-allowed" : ""
                          }`}
                        >
                          <option value="open">
                            {t("problem-solving.statusOpen")}
                          </option>
                          <option value="in-progress">
                            {t("problem-solving.statusInProgress")}
                          </option>
                          <option value="verified">
                            {t("problem-solving.statusVerified")}
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={addCountermeasure}
                  className="mt-4 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium flex items-center gap-1.5 transition-colors print:hidden"
                >
                  <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs">+</span>
                  {t("problem-solving.addCountermeasure")}
                </button>
              )}
            </div>

            {/* ============================================================ */}
            {/*  ACTION BUTTONS                                                */}
            {/* ============================================================ */}
            <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-th-border print:hidden">
              {!readOnly ? (
                <>
                  {/* Save */}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-gradient-to-r from-brand-500 to-brand-600 text-white px-6 py-2.5 rounded-xl hover:from-brand-600 hover:to-brand-700 hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 font-medium text-sm transition-all"
                  >
                    {saving && <Spinner />}
                    {saving
                      ? t("problem-solving.saving")
                      : t("problem-solving.saveAnalysis")}
                  </button>

                  {/* Export PDF */}
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="bg-th-input text-th-text-2 px-6 py-2.5 rounded-xl hover:bg-th-bg-3 border border-th-border text-sm font-medium transition-all"
                  >
                    {t("problem-solving.exportPdf")}
                  </button>

                  {/* Reset */}
                  <button
                    type="button"
                    onClick={handleNewAnalysis}
                    className="text-th-text-3 px-6 py-2.5 rounded-xl hover:bg-th-bg-3 border border-th-border text-sm transition-all"
                  >
                    {t("problem-solving.reset")}
                  </button>
                </>
              ) : (
                <>
                  {/* New Analysis */}
                  <button
                    type="button"
                    onClick={handleNewAnalysis}
                    className="bg-gradient-to-r from-brand-500 to-brand-600 text-white px-6 py-2.5 rounded-xl hover:from-brand-600 hover:to-brand-700 hover:shadow-glow font-medium text-sm transition-all"
                  >
                    {t("problem-solving.newAnalysis")}
                  </button>

                  {/* Export PDF */}
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="bg-th-input text-th-text-2 px-6 py-2.5 rounded-xl hover:bg-th-bg-3 border border-th-border text-sm font-medium transition-all"
                  >
                    {t("problem-solving.exportPdf")}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
