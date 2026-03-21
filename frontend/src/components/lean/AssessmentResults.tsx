"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/stores/useI18n";
import { useExport } from "@/hooks/useExport";
import { leanApi } from "@/lib/api";
import ExportToolbar from "@/components/ui/ExportToolbar";
import AssessmentRadarChart from "./AssessmentRadarChart";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/ToastContainer";
import {
  ClipboardList, Star, Target, TrendingUp, AlertTriangle,
  Award, RotateCcw, History, Zap, Monitor, Lightbulb, Search,
} from "lucide-react";
import {
  CATEGORIES, MATURITY_NAMES, scoreToLevel,
  type AssessmentResult, type ResultsTab,
} from "./assessment-data";

interface Props {
  result: AssessmentResult;
  allResults: AssessmentResult[];
  autoScores: Record<string, { count: number; score: number }> | null;
  onRetake: () => void;
}

export default function AssessmentResults({ result, allResults, autoScores, onRetake }: Props) {
  const { t } = useI18n();
  const { printView, exportToExcel, exportToCSV } = useExport();
  const { toasts, addToast, removeToast } = useToast();
  const [tab, setTab] = useState<ResultsTab>("results");

  const overall = MATURITY_NAMES[result.overallLevel] || MATURITY_NAMES[1];

  const tabs: { id: ResultsTab; labelKey: string; icon: React.ReactNode }[] = [
    { id: "results", labelKey: "resultsTab", icon: <Star className="w-4 h-4" /> },
    { id: "history", labelKey: "historyTab", icon: <History className="w-4 h-4" /> },
    { id: "actionPlan", labelKey: "actionPlanTab", icon: <Zap className="w-4 h-4" /> },
    { id: "scoreboard", labelKey: "scoreboardTab", icon: <Monitor className="w-4 h-4" /> },
  ];

  // Sorted recommendations (weakest first)
  const recommendations = useMemo(() => {
    if (!result.categoryScores?.length) return [];
    return [...result.categoryScores]
      .sort((a, b) => a.score - b.score)
      .map((cs) => {
        const cat = CATEGORIES.find((c) => c.id === cs.id);
        if (!cat) return null;
        return { ...cs, tools: cat.recommendedTools, color: cat.color, colorDark: cat.colorDark, actionKey: cat.actionKey };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [result]);

  const radarLabels = (result.categoryScores || []).map((cs) => {
    const translated = t(`assessment.${cs.titleKey}`);
    return translated.startsWith("assessment.") ? cs.titleKey.replace("cat", "") : translated;
  });
  const radarScores = (result.categoryScores || []).map((cs) => cs.score);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 p-4 sm:p-6" data-print-area="true">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-end">
          <ExportToolbar
            onPrint={() => printView({ title: t("assessment.resultsTitle") || "Lean Assessment Results" })}
            onExportExcel={() => {
              const rows = (result.categoryScores || []).map((cs) => ({ category: t(`assessment.${cs.titleKey}`) || cs.titleKey, score: cs.score, level: cs.level, maturity: cs.level }));
              exportToExcel({ filename: "lean_assessment", sheetName: "Assessment", rows, columns: [
                { key: "category", header: t("assessment.category") || "Category", width: 25 },
                { key: "score", header: t("assessment.score") || "Score", width: 10, format: (v: unknown) => Number(v).toFixed(1) },
                { key: "level", header: t("assessment.level") || "Level", width: 10 },
              ], headerRows: [[t("assessment.overallScore") || "Overall", result.overallScore.toFixed(1)]] });
            }}
            onExportCSV={() => {
              const rows = (result.categoryScores || []).map((cs) => ({ category: t(`assessment.${cs.titleKey}`) || cs.titleKey, score: cs.score, level: cs.level }));
              exportToCSV({ filename: "lean_assessment", rows, columns: [
                { key: "category", header: "Category" }, { key: "score", header: "Score", format: (v: unknown) => Number(v).toFixed(1) }, { key: "level", header: "Level" },
              ] });
            }}
          />
        </div>
        <div className="flex items-center justify-center gap-2">
          <ClipboardList className="w-6 h-6 text-th-accent" />
          <h1 className="text-2xl sm:text-3xl font-bold text-th-text">{t("assessment.resultsTitle")}</h1>
        </div>
        <p className="text-sm text-th-text-3">
          {t("assessment.completedOn", { date: new Date(result.completedAt).toLocaleDateString() })}
        </p>
      </div>

      {/* Overall Score Card */}
      <div className={`rounded-xl border ${overall.border} ${overall.bg} p-6 sm:p-8 shadow-sm`}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className={`flex-shrink-0 w-28 h-28 rounded-full border-4 ${overall.border} flex items-center justify-center`}>
            <div className="text-center">
              <Award className={`w-6 h-6 mx-auto mb-1 ${overall.color}`} />
              <div className={`text-3xl font-bold ${overall.color}`}>{result.overallScore.toFixed(1)}</div>
              <div className="text-xs text-th-text-3">{t("assessment.outOf5")}</div>
            </div>
          </div>
          <div className="text-center sm:text-left flex-1">
            <div className={`text-xl font-bold ${overall.color}`}>{t(`assessment.${overall.nameKey}`)}</div>
            <p className="text-sm text-th-text-2 mt-1">{t(`assessment.${overall.nameKey}Desc`)}</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-th-border overflow-x-auto">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
              tab === tb.id
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-th-text-3 hover:text-th-text-2"
            }`}
          >
            {tb.icon}
            {t(`assessment.${tb.labelKey}`)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "results" && <ResultsPanel result={result} radarScores={radarScores} radarLabels={radarLabels} autoScores={autoScores} t={t} />}
      {tab === "history" && <HistoryPanel allResults={allResults} t={t} />}
      {tab === "actionPlan" && <ActionPlanPanel recommendations={recommendations} t={t} addToast={addToast} />}
      {tab === "scoreboard" && <ScoreboardPanel result={result} radarScores={radarScores} radarLabels={radarLabels} t={t} />}

      {/* Retake button */}
      <div className="text-center pt-2 pb-4">
        <button onClick={onRetake} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold border border-th-border text-th-text-2 bg-th-bg-2 hover:bg-th-bg-3 transition">
          <RotateCcw className="w-4 h-4" /> {t("assessment.retake")}
        </button>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

// ─── Results Tab ─────────────────────────────────────────────────────────────
function ResultsPanel({ result, radarScores, radarLabels, autoScores, t }: {
  result: AssessmentResult; radarScores: number[]; radarLabels: string[];
  autoScores: Record<string, { count: number; score: number }> | null;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Score bars */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-4 h-4 text-th-accent" />
          <h2 className="text-lg font-semibold text-th-text">{t("assessment.categoryScores")}</h2>
        </div>
        <div className="space-y-3">
          {(result.categoryScores || []).map((cs) => {
            const lvl = MATURITY_NAMES[cs.level] || MATURITY_NAMES[1];
            const pct = ((cs.score - 1) / 4) * 100;
            const colors = [, "#ef4444", "#f97316", "#3b82f6", "#14b8a6", "#10b981"];
            return (
              <div key={cs.id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-th-text">{t(`assessment.${cs.titleKey}`)}</span>
                  <span className={`text-xs font-semibold ${lvl.color}`}>{cs.score.toFixed(1)} / 5</span>
                </div>
                <div className="h-2 rounded-full bg-th-bg-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: colors[cs.level] || "#6366f1" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Radar chart */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 flex items-center justify-center">
        <AssessmentRadarChart
          scores={radarScores}
          labels={radarLabels}
          autoScores={autoScores ? (result.categoryScores || []).map((cs) => {
            // Map frontend category IDs to backend auto-score keys
            const keyMap: Record<string, string> = {
              workplace: "workplace_5s", visual: "visual_management", standard: "standard_work",
              improvement: "continuous_improvement", problem: "problem_solving", tpmEquip: "tpm_equipment",
              flow: "flow_pull", quality: "quality_at_source", safety: "safety_culture",
              leadership: "leadership", supply: "supply_chain", digital: "digital_industry4",
            };
            const backendKey = keyMap[cs.id] || cs.id;
            return autoScores[backendKey]?.score ?? 0;
          }) : undefined}
          showLegend={!!autoScores}
        />
      </div>
    </div>
  );
}

// ─── History Tab ─────────────────────────────────────────────────────────────
function HistoryPanel({ allResults, t }: {
  allResults: AssessmentResult[];
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  if (allResults.length <= 1) {
    return (
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-8 text-center text-th-text-3">
        {t("assessment.noHistory")}
      </div>
    );
  }
  const sorted = [...allResults].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  return (
    <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-th-border bg-th-bg-3">
            <th className="text-left px-4 py-3 font-medium text-th-text-2">{t("assessment.historyDate")}</th>
            <th className="text-right px-4 py-3 font-medium text-th-text-2">{t("assessment.historyScore")}</th>
            <th className="text-right px-4 py-3 font-medium text-th-text-2">{t("assessment.historyTrend")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, idx) => {
            const prev = sorted[idx + 1];
            const delta = prev ? r.overallScore - prev.overallScore : 0;
            const lvl = MATURITY_NAMES[r.overallLevel] || MATURITY_NAMES[1];
            return (
              <tr key={r.completedAt} className="border-b border-th-border last:border-0">
                <td className="px-4 py-3 text-th-text">{new Date(r.completedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-semibold ${lvl.color}`}>{r.overallScore.toFixed(1)}</span>
                  <span className="text-th-text-3 text-xs ml-1">({t(`assessment.${lvl.nameKey}`)})</span>
                </td>
                <td className="px-4 py-3 text-right text-xs">
                  {!prev ? <span className="text-th-text-3">--</span> :
                    delta > 0 ? <span className="text-emerald-600 dark:text-emerald-400">{t("assessment.trendUp", { delta: Math.abs(delta).toFixed(1) })}</span> :
                    delta < 0 ? <span className="text-red-600 dark:text-red-400">{t("assessment.trendDown", { delta: Math.abs(delta).toFixed(1) })}</span> :
                    <span className="text-th-text-3">{t("assessment.trendFlat")}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Action Plan Tab ─────────────────────────────────────────────────────────
function ActionPlanPanel({ recommendations, t, addToast }: {
  recommendations: { id: string; titleKey: string; score: number; level: number; tools: { navId: string; nameKey: string }[]; actionKey: string; color: string; colorDark: string }[];
  t: (key: string, vars?: Record<string, string>) => string;
  addToast: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const router = useRouter();
  const [creatingKaizen, setCreatingKaizen] = useState<string | null>(null);
  const [createdKaizens, setCreatedKaizens] = useState<Set<string>>(new Set());
  const actionItems = recommendations.filter((r) => r.score < 3.0);

  const handleCreateKaizen = async (item: typeof actionItems[0]) => {
    setCreatingKaizen(item.id);
    try {
      const categoryName = t(`assessment.${item.titleKey}`) || item.titleKey;
      await leanApi.createKaizen({
        title: `${t("assessment.kaizenFromAudit") || "6S Audit"}: ${categoryName}`,
        description: `${t("assessment.kaizenFromAuditDesc") || "Improvement needed"} — ${t(`assessment.${item.actionKey}`)} (${t("assessment.score")}: ${item.score.toFixed(1)}/5)`,
        category: "quality",
        priority: item.score < 2.0 ? "critical" : "high",
        source_type: "6s-audit",
      });
      setCreatedKaizens((prev) => new Set(prev).add(item.id));
      addToast(`${t("problem-solving.kaizenCreatedToast") || "Improvement action created"}: ${categoryName}`, "success");
    } catch {
      addToast(t("common.error") || "Failed to create improvement", "error");
    } finally {
      setCreatingKaizen(null);
    }
  };

  const handleStartRCA = (item: typeof actionItems[0]) => {
    const categoryName = t(`assessment.${item.titleKey}`) || item.titleKey;
    const params = new URLSearchParams({
      from: "6s-audit",
      fromLabel: categoryName,
    });
    router.push(`/improvement/root-cause?${params.toString()}`);
  };

  const handleCreateAll = async () => {
    const uncreated = actionItems.filter((item) => !createdKaizens.has(item.id));
    for (const item of uncreated) {
      await handleCreateKaizen(item);
    }
    if (uncreated.length > 0) {
      addToast(`${uncreated.length} ${t("assessment.batchKaizensToast") || "improvements created"}`, "success");
    }
  };

  return (
    <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
            <Zap className="w-4 h-4 text-th-accent" /> {t("assessment.actionPlanTitle")}
          </h2>
          <p className="text-sm text-th-text-3 mt-1">{t("assessment.actionPlanDesc")}</p>
        </div>
        {actionItems.length > 0 && (
          <button
            onClick={handleCreateAll}
            disabled={createdKaizens.size >= actionItems.length}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Lightbulb className="w-4 h-4" />
            {createdKaizens.size >= actionItems.length
              ? (t("assessment.allKaizensCreated") || "All Kaizens Created ✓")
              : (t("assessment.createAllKaizens") || "Create All Kaizens")}
          </button>
        )}
      </div>
      {actionItems.length === 0 ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-4">
          {t("assessment.noActionsNeeded")}
        </p>
      ) : (
        <div className="space-y-3">
          {actionItems.map((item, idx) => {
            const lvl = MATURITY_NAMES[item.level] || MATURITY_NAMES[1];
            const alreadyCreated = createdKaizens.has(item.id);
            return (
              <div key={item.id} className={`rounded-xl p-4 border ${idx < 2 ? `${lvl.bg} ${lvl.border}` : "bg-th-bg-3 border-th-border"}`}>
                <div className="flex items-start gap-3">
                  {idx < 2 ? <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" /> : <Target className={`w-5 h-5 flex-shrink-0 mt-0.5 ${item.color} ${item.colorDark}`} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-th-text text-sm">{t(`assessment.${item.titleKey}`)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lvl.bg} ${lvl.color}`}>
                        {t(`assessment.${lvl.nameKey}`)} ({item.score.toFixed(1)})
                      </span>
                      {idx < 2 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-medium">{t("assessment.priority")}</span>}
                    </div>
                    <p className="text-xs text-th-text-2 mb-2">
                      <span className="font-medium">{t("assessment.suggestedAction")}:</span>{" "}
                      {t(`assessment.${item.actionKey}`)}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="text-xs text-th-text-3 font-medium">{t("assessment.relevantTools")}:</span>
                      {item.tools.map((tool) => (
                        <span key={tool.navId} className="text-xs px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {t(`assessment.${tool.nameKey}`)}
                        </span>
                      ))}
                    </div>
                    {/* Actions: Create Kaizen (stays on page) / Start RCA */}
                    <div className="flex flex-wrap gap-2 print:hidden">
                      {alreadyCreated ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          <Lightbulb className="w-3.5 h-3.5" />
                          {t("assessment.kaizenCreated") || "Kaizen Created ✓"}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCreateKaizen(item)}
                          disabled={creatingKaizen === item.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                        >
                          <Lightbulb className="w-3.5 h-3.5" />
                          {creatingKaizen === item.id
                            ? (t("common.creating") || "Creating...")
                            : (t("assessment.createKaizen") || "Create Kaizen")}
                        </button>
                      )}
                      <button
                        onClick={() => handleStartRCA(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                      >
                        <Search className="w-3.5 h-3.5" />
                        {t("assessment.investigateRootCause") || "Investigate Root Cause"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Summary: link to kaizen board if any created */}
          {createdKaizens.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm">
              <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-emerald-700 dark:text-emerald-300">
                {createdKaizens.size} {t("assessment.kaizensCreatedCount") || "Kaizen(s) created."}{" "}
                <button
                  onClick={() => router.push("/improvement/kaizen")}
                  className="underline font-semibold hover:no-underline"
                >
                  {t("assessment.viewKaizenBoard") || "View Kaizen Board →"}
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Scoreboard Tab (TV-friendly) ───────────────────────────────────────────
function ScoreboardPanel({ result, radarScores, radarLabels, t }: {
  result: AssessmentResult; radarScores: number[]; radarLabels: string[];
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const overall = MATURITY_NAMES[result.overallLevel] || MATURITY_NAMES[1];
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-th-text">{t("assessment.scoreboardTitle")}</h2>
        <div className={`text-5xl font-bold mt-4 ${overall.color}`}>{result.overallScore.toFixed(1)}<span className="text-lg text-th-text-3"> / 5.0</span></div>
        <div className={`text-xl font-semibold mt-1 ${overall.color}`}>{t(`assessment.${overall.nameKey}`)}</div>
      </div>
      <AssessmentRadarChart scores={radarScores} labels={radarLabels} size={480} showLegend={false} />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {(result.categoryScores || []).map((cs) => {
          const lvl = MATURITY_NAMES[cs.level] || MATURITY_NAMES[1];
          return (
            <div key={cs.id} className={`rounded-lg p-3 border text-center ${lvl.bg} ${lvl.border}`}>
              <div className={`text-2xl font-bold ${lvl.color}`}>{cs.score.toFixed(1)}</div>
              <div className="text-xs text-th-text-2 mt-1 truncate">{t(`assessment.${cs.titleKey}`)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
