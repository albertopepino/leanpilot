"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import {
  ResponsiveContainer,
  RadarChart as ReRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Sparkles,
  ArrowUpDown,
  LayoutGrid,
  Paintbrush,
  ClipboardCheck,
  RefreshCw,
  Shield,
  AlertTriangle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Save,
  RotateCcw,
  History,
  Eye,
  MapPin,
  Radar as RadarIcon,
  type LucideIcon,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_KEYS: {
  id: string;
  labelKey: string;
  shortKey: string;
  Icon: LucideIcon;
  color: string;
  solidColor: string;
  descKey: string;
  iconColor: string;
}[] = [
  { id: "sort", labelKey: "catSort", shortKey: "catSortShort", Icon: ArrowUpDown, color: "from-red-500 to-rose-500", solidColor: "#ef4444", descKey: "catSortDesc", iconColor: "text-red-500" },
  { id: "set_in_order", labelKey: "catSetInOrder", shortKey: "catSetInOrderShort", Icon: LayoutGrid, color: "from-orange-500 to-amber-500", solidColor: "#f97316", descKey: "catSetInOrderDesc", iconColor: "text-orange-500" },
  { id: "shine", labelKey: "catShine", shortKey: "catShineShort", Icon: Paintbrush, color: "from-yellow-500 to-lime-500", solidColor: "#eab308", descKey: "catShineDesc", iconColor: "text-yellow-500" },
  { id: "standardize", labelKey: "catStandardize", shortKey: "catStandardizeShort", Icon: ClipboardCheck, color: "from-green-500 to-emerald-500", solidColor: "#10b981", descKey: "catStandardizeDesc", iconColor: "text-emerald-500" },
  { id: "sustain", labelKey: "catSustain", shortKey: "catSustainShort", Icon: RefreshCw, color: "from-blue-500 to-cyan-500", solidColor: "#3b82f6", descKey: "catSustainDesc", iconColor: "text-blue-500" },
  { id: "safety", labelKey: "catSafety", shortKey: "catSafetyShort", Icon: Shield, color: "from-purple-500 to-violet-500", solidColor: "#8b5cf6", descKey: "catSafetyDesc", iconColor: "text-violet-500" },
];

const QUESTION_KEYS: Record<string, string[]> = {
  sort: ["sort_q1", "sort_q2", "sort_q3", "sort_q4", "sort_q5"],
  set_in_order: ["setInOrder_q1", "setInOrder_q2", "setInOrder_q3", "setInOrder_q4", "setInOrder_q5"],
  shine: ["shine_q1", "shine_q2", "shine_q3", "shine_q4", "shine_q5"],
  standardize: ["standardize_q1", "standardize_q2", "standardize_q3", "standardize_q4", "standardize_q5"],
  sustain: ["sustain_q1", "sustain_q2", "sustain_q3", "sustain_q4", "sustain_q5"],
  safety: ["safety_q1", "safety_q2", "safety_q3", "safety_q4", "safety_q5"],
};

const AREA_PRESETS = [
  "Production Floor",
  "Warehouse",
  "Assembly Line",
  "Quality Lab",
  "Packaging",
  "Receiving Dock",
  "Shipping Dock",
  "Tool Crib",
  "Maintenance Shop",
  "Office Area",
];

const SCORE_LABELS: Record<number, { key: string; fallback: string }> = {
  1: { key: "scorePoor", fallback: "Poor" },
  2: { key: "scoreBelowAvg", fallback: "Below Avg" },
  3: { key: "scoreAverage", fallback: "Average" },
  4: { key: "scoreGood", fallback: "Good" },
  5: { key: "scoreExcellent", fallback: "Excellent" },
};

const SCORE_COLORS = [
  "",
  "bg-red-500/20 text-red-400 border-red-500/50 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/50",
  "bg-orange-500/20 text-orange-400 border-orange-500/50 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/50",
  "bg-yellow-500/20 text-yellow-400 border-yellow-500/50 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/50",
  "bg-lime-500/20 text-lime-400 border-lime-500/50 dark:bg-lime-500/20 dark:text-lime-400 dark:border-lime-500/50",
  "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/50",
];

// Light-mode score colors (for non-dark)
const SCORE_COLORS_LIGHT = [
  "",
  "bg-red-100 text-red-700 border-red-300",
  "bg-orange-100 text-orange-700 border-orange-300",
  "bg-yellow-100 text-yellow-700 border-yellow-300",
  "bg-lime-100 text-lime-700 border-lime-300",
  "bg-emerald-100 text-emerald-700 border-emerald-300",
];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AuditHistoryItem {
  id: number;
  area: string;
  date: string;
  overall_score: number;
  grade: string;
  scores: Record<string, number>;
}

interface TrendPoint {
  date: string;
  score: number;
}

type ViewMode = "audit" | "results" | "history";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function computeGrade(score: number): { letter: string; color: string } {
  if (score >= 90) return { letter: "A", color: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 80) return { letter: "B", color: "text-green-600 dark:text-green-400" };
  if (score >= 70) return { letter: "C", color: "text-yellow-600 dark:text-yellow-400" };
  if (score >= 55) return { letter: "D", color: "text-orange-600 dark:text-orange-400" };
  return { letter: "F", color: "text-red-600 dark:text-red-400" };
}

function getMaturityLevel(score: number): { level: number; labelKey: string; color: string } {
  if (score >= 90) return { level: 5, labelKey: "matWorldClass", color: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 75) return { level: 4, labelKey: "matSustainable", color: "text-green-600 dark:text-green-400" };
  if (score >= 60) return { level: 3, labelKey: "matStandardized", color: "text-yellow-600 dark:text-yellow-400" };
  if (score >= 40) return { level: 2, labelKey: "matDeveloping", color: "text-orange-600 dark:text-orange-400" };
  return { level: 1, labelKey: "matInitial", color: "text-red-600 dark:text-red-400" };
}

function scoreToTextColor(avg: number): string {
  if (avg < 2) return "text-red-600 dark:text-red-400";
  if (avg < 3) return "text-orange-600 dark:text-orange-400";
  if (avg < 4) return "text-yellow-600 dark:text-yellow-400";
  return "text-emerald-600 dark:text-emerald-400";
}

function getScoreGradient(pct: number): string {
  if (pct >= 80) return "from-emerald-500 to-green-500";
  if (pct >= 60) return "from-yellow-500 to-lime-500";
  if (pct >= 40) return "from-orange-500 to-amber-500";
  return "from-red-500 to-rose-500";
}

// ─── Gauge Component ───────────────────────────────────────────────────────────

function ScoreGauge({ score, size = 160, label }: { score: number; size?: number; label?: string }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius * 0.75; // 270 degree arc
  const offset = circumference - (score / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  const color = score >= 80 ? "#10b981" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-th-text-3"
          strokeWidth="10"
          strokeDasharray={`${circumference} ${circumference * 0.333}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {/* Filled arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${circumference} ${circumference * 0.333}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-th-text">{score}</span>
        {label && <span className="text-xs text-th-text-3 mt-0.5">{label}</span>}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SixSAudit() {
  const { t } = useI18n();
  const { printView, exportToExcel } = useExport();

  // Core audit state
  const [areaName, setAreaName] = useState("");
  const [activeCategory, setActiveCategory] = useState("sort");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [findings, setFindings] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("audit");

  // API data
  const [auditHistory, setAuditHistory] = useState<AuditHistoryItem[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // ─── Score Getters ─────────────────────────────────────────────────────────

  const setScore = (cat: string, qIdx: number, score: number) => {
    setScores((prev) => ({ ...prev, [`${cat}-${qIdx}`]: score }));
  };

  const getScore = (cat: string, qIdx: number): number => {
    return scores[`${cat}-${qIdx}`] ?? 0;
  };

  const getCategoryAvg = useCallback(
    (cat: string): number => {
      const questions = QUESTION_KEYS[cat];
      let total = 0;
      let count = 0;
      questions.forEach((_, i) => {
        const s = scores[`${cat}-${i}`] ?? 0;
        if (s > 0) {
          total += s;
          count++;
        }
      });
      return count > 0 ? total / count : 0;
    },
    [scores]
  );

  const getCategoryPct = useCallback(
    (cat: string): number => {
      const avg = getCategoryAvg(cat);
      return avg > 0 ? Math.round((avg / 5) * 100) : 0;
    },
    [getCategoryAvg]
  );

  const overallScore = useMemo(() => {
    const avgs = CATEGORY_KEYS.map((c) => getCategoryAvg(c.id)).filter((a) => a > 0);
    return avgs.length > 0 ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length / 5) * 100) : 0;
  }, [getCategoryAvg]);

  const overallAvg = useMemo(() => {
    const avgs = CATEGORY_KEYS.map((c) => getCategoryAvg(c.id)).filter((a) => a > 0);
    return avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
  }, [getCategoryAvg]);

  const grade = useMemo(() => computeGrade(overallScore), [overallScore]);
  const maturity = useMemo(() => getMaturityLevel(overallScore), [overallScore]);

  const categoryScoreMap = useMemo(() => {
    const map: Record<string, number> = {};
    CATEGORY_KEYS.forEach((c) => {
      map[c.id] = getCategoryPct(c.id);
    });
    return map;
  }, [getCategoryPct]);

  const categoryAvgMap = useMemo(() => {
    const map: Record<string, number> = {};
    CATEGORY_KEYS.forEach((c) => {
      map[c.id] = getCategoryAvg(c.id);
    });
    return map;
  }, [getCategoryAvg]);

  const completionCount = useMemo(() => {
    return Object.values(scores).filter((s) => s > 0).length;
  }, [scores]);

  const totalQuestions = 30;

  // ─── Action items: categories scoring below 3 ───────────────────────────────

  const actionItems = useMemo(() => {
    const items: { category: string; Icon: LucideIcon; avg: number; weakQuestions: { qKey: string; qIdx: number; score: number; finding: string }[] }[] = [];
    CATEGORY_KEYS.forEach((cat) => {
      const avg = categoryAvgMap[cat.id];
      if (avg > 0 && avg < 3) {
        const weakQuestions: { qKey: string; qIdx: number; score: number; finding: string }[] = [];
        QUESTION_KEYS[cat.id].forEach((qKey, qIdx) => {
          const s = scores[`${cat.id}-${qIdx}`] ?? 0;
          if (s > 0 && s < 3) {
            weakQuestions.push({
              qKey,
              qIdx,
              score: s,
              finding: findings[`${cat.id}-${qIdx}`] ?? "",
            });
          }
        });
        items.push({ category: cat.id, Icon: cat.Icon, avg, weakQuestions });
      }
    });
    return items;
  }, [categoryAvgMap, scores, findings]);

  // ─── Previous audit for radar overlay ──────────────────────────────────────

  const previousAuditScores = useMemo(() => {
    const matching = auditHistory.filter(
      (a) => !areaName || a.area.toLowerCase() === areaName.toLowerCase()
    );
    if (matching.length === 0) return null;
    const prev = matching[0];
    return CATEGORY_KEYS.map((c) => {
      const pctScore = prev.scores?.[c.id] ?? 0;
      return (pctScore / 100) * 5;
    });
  }, [auditHistory, areaName]);

  // ─── API: Load history + trend ─────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    try {
      const res = await advancedLeanApi.listSixSAudits();
      const items: AuditHistoryItem[] = Array.isArray(res.data) ? res.data : [];
      setAuditHistory(items);
    } catch {
      setAuditHistory([]);
    }
  }, []);

  const loadTrend = useCallback(async () => {
    try {
      const res = await advancedLeanApi.getSixSTrend(areaName || undefined);
      const items: TrendPoint[] = Array.isArray(res.data) ? res.data : [];
      setTrendData(items);
    } catch {
      setTrendData([]);
    }
  }, [areaName]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadHistory(), loadTrend()]).finally(() => setLoading(false));
  }, [loadHistory, loadTrend]);

  // ─── API: Save audit ───────────────────────────────────────────────────────

  const saveAudit = async () => {
    if (completionCount === 0) return;
    setSaving(true);
    setApiError(null);

    const payload = {
      area: areaName || "General",
      date: new Date().toISOString(),
      overall_score: overallScore,
      grade: grade.letter,
      scores: categoryScoreMap,
      details: Object.entries(scores).map(([key, score]) => {
        const [cat, qIdxStr] = key.split("-");
        const qIdx = parseInt(qIdxStr, 10);
        return {
          category: cat,
          question_key: QUESTION_KEYS[cat]?.[qIdx] ?? key,
          score,
          finding: findings[key] ?? "",
        };
      }),
    };

    try {
      await advancedLeanApi.createSixSAudit(payload);
      await loadHistory();
      await loadTrend();
      setViewMode("results");
    } catch {
      setApiError(t("maintenance.saveError") || "Failed to save audit. Results shown locally.");
      setViewMode("results");
    } finally {
      setSaving(false);
    }
  };

  // ─── Recharts Radar data ──────────────────────────────────────────────────

  const radarData = useMemo(() => {
    return CATEGORY_KEYS.map((c) => ({
      category: t(`maintenance.${c.shortKey}`),
      current: categoryAvgMap[c.id],
      previous: previousAuditScores
        ? previousAuditScores[CATEGORY_KEYS.findIndex((k) => k.id === c.id)]
        : 0,
      fullMark: 5,
    }));
  }, [categoryAvgMap, previousAuditScores, t]);

  // ─── Reset ─────────────────────────────────────────────────────────────────

  const resetAudit = () => {
    setScores({});
    setFindings({});
    setActiveCategory("sort");
    setViewMode("audit");
    setApiError(null);
  };

  // ─── RENDER: Loading ──────────────────────────────────────────────────────

  if (loading && viewMode === "history") {
    return (
      <div className="max-w-[1400px] mx-auto py-16 text-center">
        <div className="inline-block w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-th-text-3 animate-pulse">{t("maintenance.loading") || "Loading..."}</p>
      </div>
    );
  }

  // ─── RENDER: Results ───────────────────────────────────────────────────────

  if (viewMode === "results") {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Error banner */}
        {apiError && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {apiError}
          </div>
        )}

        {/* Header with overall gauge + grade */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ScoreGauge score={overallScore} size={160} label="/ 100" />
            <div className="text-center sm:text-left flex-1">
              <h2 className="text-2xl font-bold text-th-text flex items-center gap-2 justify-center sm:justify-start">
                <Sparkles className="w-6 h-6 text-brand-500" />
                {t("maintenance.auditResults", { area: areaName || "Area" })}
              </h2>
              <div className="flex items-center gap-3 mt-2 justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-th-bg-3 border border-th-border text-th-text text-sm font-bold">
                  {t("maintenance.grade") || "Grade"}: {grade.letter}
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-th-bg-3 border border-th-border text-th-text-2 text-sm">
                  {t("maintenance.maturityLevel", { level: String(maturity.level) })}: {t(`maintenance.${maturity.labelKey}`)}
                </span>
              </div>
              <p className="text-th-text-3 text-sm mt-2">
                {t("maintenance.overallAvg") || "Overall Avg"}: {overallAvg.toFixed(1)}/5 &middot; {completionCount}/{totalQuestions} {t("maintenance.questionsAnswered") || "questions answered"}
              </p>
            </div>
          </div>
        </div>

        {/* Radar Chart with Recharts */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
          <h3 className="font-semibold text-th-text text-center mb-4 text-sm flex items-center justify-center gap-2">
            <RadarIcon className="w-4 h-4 text-th-text-3" />
            {t("maintenance.radarOverview")}
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <ReRadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid strokeDasharray="3 3" stroke="#475569" strokeOpacity={0.3} />
              <PolarAngleAxis dataKey="category" tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: "#64748b", fontSize: 9 }} tickCount={6} />
              {previousAuditScores && (
                <Radar
                  name={t("maintenance.previousAudit") || "Previous"}
                  dataKey="previous"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                />
              )}
              <Radar
                name={t("maintenance.currentAudit") || "Current"}
                dataKey="current"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.25}
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
              />
            </ReRadarChart>
          </ResponsiveContainer>
          {previousAuditScores && (
            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-th-text-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-indigo-500 rounded inline-block" /> {t("maintenance.currentAudit") || "Current"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-500 rounded inline-block" /> {t("maintenance.previousAudit") || "Previous"}
              </span>
            </div>
          )}
        </div>

        {/* Category score cards - individual progress bars */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORY_KEYS.map((cat) => {
            const pct = categoryScoreMap[cat.id];
            const avg = categoryAvgMap[cat.id];
            return (
              <div
                key={cat.id}
                className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 text-center transition-all duration-200 hover:-translate-y-0.5"
              >
                <cat.Icon className={`w-6 h-6 mx-auto mb-1 ${cat.iconColor}`} />
                <div className="text-[10px] text-th-text-3 mb-1 font-semibold uppercase tracking-wider">
                  {t(`maintenance.${cat.shortKey}`)}
                </div>
                <div className={`text-2xl font-black ${scoreToTextColor(avg)}`}>
                  {avg > 0 ? avg.toFixed(1) : "--"}
                </div>
                <div className="text-xs text-th-text-3">{pct}%</div>
                <div className="mt-2 h-1.5 bg-th-bg-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${cat.color} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Items for categories below 3 */}
        {actionItems.length > 0 && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-5 dark:border-red-800 dark:bg-red-900/10">
            <h3 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {t("maintenance.actionItemsTitle") || "Action Items Required"}
            </h3>
            <div className="space-y-3">
              {actionItems.map((item) => {
                const catDef = CATEGORY_KEYS.find((c) => c.id === item.category)!;
                return (
                  <div key={item.category} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <item.Icon className={`w-4 h-4 ${catDef.iconColor}`} />
                      <span className="font-semibold text-sm text-th-text">
                        {t(`maintenance.${catDef.labelKey}`)}
                      </span>
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium ml-auto px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20">
                        {t("maintenance.avgScore") || "Avg"}: {item.avg.toFixed(1)}/5
                      </span>
                    </div>
                    {item.weakQuestions.length > 0 && (
                      <ul className="space-y-1.5">
                        {item.weakQuestions.map((wq) => (
                          <li key={wq.qKey} className="flex items-start gap-2 text-xs">
                            <span className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center font-bold text-white ${wq.score === 1 ? "bg-red-500" : "bg-orange-500"}`}>
                              {wq.score}
                            </span>
                            <span className="text-th-text-2">{t(`maintenance.${wq.qKey}`)}</span>
                            {wq.finding && (
                              <span className="text-th-text-3 italic ml-auto flex-shrink-0 max-w-[40%] truncate">
                                {wq.finding}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Trend chart with Recharts */}
        {trendData.length >= 2 && (
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
            <h3 className="font-semibold text-th-text text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-th-text-3" />
              {t("maintenance.trendTitle") || "Score Trend"}
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="trendGrad6s" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" strokeOpacity={0.2} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                  itemStyle={{ color: "#a5b4fc" }}
                />
                <Area type="monotone" dataKey="score" stroke="#6366f1" fill="url(#trendGrad6s)" strokeWidth={2} dot={{ r: 3, fill: "#6366f1", stroke: "#fff", strokeWidth: 1.5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={resetAudit}
            className="flex-1 min-w-[140px] bg-brand-600 text-white py-3 rounded-lg font-semibold hover:bg-brand-700 transition flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {t("maintenance.newAudit") || "New Audit"}
          </button>
          <button
            onClick={() => setViewMode("history")}
            className="flex-1 min-w-[140px] bg-th-bg-2 border border-th-border text-th-text py-3 rounded-lg font-semibold hover:bg-th-bg-3 transition flex items-center justify-center gap-2"
          >
            <History className="w-4 h-4" />
            {t("maintenance.viewHistory") || "View History"}
          </button>
          <button
            onClick={() => setViewMode("audit")}
            className="text-brand-600 hover:text-brand-700 dark:text-brand-400 text-sm font-medium self-center flex items-center gap-1 min-h-[44px] sm:min-h-0"
          >
            <ChevronLeft className="w-3 h-3" />
            {t("maintenance.backToAudit")}
          </button>
        </div>
      </div>
    );
  }

  // ─── RENDER: History ───────────────────────────────────────────────────────

  if (viewMode === "history") {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-th-text flex items-center gap-2">
            <History className="w-5 h-5 text-th-text-3" />
            {t("maintenance.auditHistory") || "Audit History"}
          </h2>
          <button
            onClick={() => setViewMode("audit")}
            className="text-brand-600 hover:text-brand-700 dark:text-brand-400 text-sm font-medium flex items-center gap-1 min-h-[44px] sm:min-h-0"
          >
            <ChevronLeft className="w-3 h-3" />
            {t("maintenance.backToAudit")}
          </button>
        </div>

        {/* Area filter for trend */}
        {auditHistory.length > 0 && (
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
            <label className="text-xs font-semibold text-th-text-2 block mb-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {t("maintenance.filterByArea") || "Filter trend by area"}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAreaName("")}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                  !areaName
                    ? "bg-brand-500/10 border-brand-500/50 text-brand-600 dark:text-brand-400 font-semibold"
                    : "border-th-border text-th-text-3 hover:border-brand-400"
                }`}
              >
                {t("maintenance.allAreas") || "All Areas"}
              </button>
              {Array.from(new Set(auditHistory.map((a) => a.area))).map((area) => (
                <button
                  key={area}
                  onClick={() => setAreaName(area)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    areaName === area
                      ? "bg-brand-500/10 border-brand-500/50 text-brand-600 dark:text-brand-400 font-semibold"
                      : "border-th-border text-th-text-3 hover:border-brand-400"
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trend with Recharts */}
        {trendData.length >= 2 && (
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
            <h3 className="font-semibold text-th-text text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-th-text-3" />
              {t("maintenance.trendTitle") || "Score Trend"}
              {areaName && <span className="text-th-text-3 font-normal ml-2">({areaName})</span>}
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="trendGrad6sHist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" strokeOpacity={0.2} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                  itemStyle={{ color: "#a5b4fc" }}
                />
                <Area type="monotone" dataKey="score" stroke="#6366f1" fill="url(#trendGrad6sHist)" strokeWidth={2} dot={{ r: 3, fill: "#6366f1", stroke: "#fff", strokeWidth: 1.5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* History list */}
        {auditHistory.length === 0 ? (
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-8 text-center">
            <p className="text-th-text-3">{t("maintenance.noHistory") || "No audits recorded yet."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {auditHistory
              .filter((a) => !areaName || a.area.toLowerCase() === areaName.toLowerCase())
              .map((audit, idx) => {
                const g = computeGrade(audit.overall_score);
                return (
                  <div
                    key={audit.id}
                    className={`rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 flex items-center gap-4 transition-all duration-200 ${idx % 2 === 0 ? "" : "bg-th-bg-3"}`}
                  >
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center font-black text-xl ${g.color} bg-th-bg-3`}
                    >
                      {g.letter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-th-text truncate">{audit.area}</div>
                      <div className="text-xs text-th-text-3">
                        {new Date(audit.date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-th-text">{audit.overall_score}%</div>
                      <div className={`text-xs font-semibold ${g.color}`}>
                        {t("maintenance.grade") || "Grade"}: {g.letter}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    );
  }

  // ─── RENDER: Audit Form ────────────────────────────────────────────────────

  return (
    <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true">
      {/* Export Toolbar */}
      <ExportToolbar
        onPrint={() => printView(t("common.titleSixS"))}
        onExportExcel={() =>
          exportToExcel({
            title: t("common.titleSixS"),
            columns: [
              t("maintenance.category") || "Category",
              t("maintenance.score") || "Score",
              t("maintenance.maxScore") || "Max Score",
              t("maintenance.notes") || "Notes",
            ],
            rows: CATEGORY_KEYS.map((cat) => [
              t(`maintenance.${cat.labelKey}`),
              String(categoryAvgMap[cat.id]?.toFixed(1) ?? "0"),
              "5",
              findings[`${cat.id}-0`] || "",
            ]),
          })
        }
      />

      {/* Area/Zone Selector */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
        <label className="text-xs font-semibold text-th-text-2 block mb-2 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {t("maintenance.auditArea")}
        </label>
        <input
          type="text"
          value={areaName}
          onChange={(e) => setAreaName(e.target.value)}
          placeholder={t("maintenance.auditAreaPlaceholder")}
          className="w-full px-4 py-2.5 border border-th-border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm bg-th-input text-th-text mb-3 transition"
        />
        <div className="flex flex-wrap gap-2">
          {AREA_PRESETS.map((area) => (
            <button
              key={area}
              onClick={() => setAreaName(area)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                areaName === area
                  ? "bg-brand-500/10 border-brand-500/50 text-brand-600 dark:text-brand-400 font-semibold"
                  : "border-th-border text-th-text-3 hover:border-brand-400 hover:text-brand-600"
              }`}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
        <div className="flex items-center justify-between text-xs text-th-text-2 mb-2">
          <span className="uppercase tracking-wider font-semibold">
            {t("maintenance.progress") || "Progress"}: {completionCount}/{totalQuestions}
          </span>
          <span className={`font-bold ${grade.color}`}>
            {overallScore > 0 ? `${overallScore}% (${grade.letter})` : "---"}
          </span>
        </div>
        <div className="h-2.5 bg-th-bg-3 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${getScoreGradient(overallScore)} transition-all duration-500`}
            style={{ width: `${(completionCount / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Live Radar Preview (collapsed by default, shown when enough data) */}
      {completionCount >= 6 && (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
          <h3 className="font-semibold text-th-text text-sm text-center mb-2 flex items-center justify-center gap-2">
            <RadarIcon className="w-4 h-4 text-th-text-3" />
            {t("maintenance.liveRadar") || "Live Radar Preview"}
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <ReRadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid strokeDasharray="3 3" stroke="#475569" strokeOpacity={0.3} />
              <PolarAngleAxis dataKey="category" tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: "#64748b", fontSize: 8 }} tickCount={6} />
              <Radar
                name="Current"
                dataKey="current"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.2}
                strokeWidth={2}
                dot={{ r: 3, fill: "#6366f1", stroke: "#fff", strokeWidth: 1.5 }}
              />
            </ReRadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {CATEGORY_KEYS.map((cat) => {
          const answered = QUESTION_KEYS[cat.id].filter((_, i) => (scores[`${cat.id}-${i}`] ?? 0) > 0).length;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 min-h-[44px] sm:min-h-0 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                isActive
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-th-bg-2 border border-th-border text-th-text-2 hover:bg-th-bg-3"
              }`}
            >
              <cat.Icon className={`w-4 h-4 ${isActive ? "text-white" : cat.iconColor}`} />
              <span className="hidden sm:inline">{t(`maintenance.${cat.shortKey}`)}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-lg ${
                  isActive
                    ? "bg-white/20"
                    : answered === 5
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                }`}
              >
                {answered}/5
              </span>
            </button>
          );
        })}
      </div>

      {/* Category description */}
      <div className="rounded-xl border border-th-border bg-th-bg-3 px-4 py-3">
        <p className="text-xs text-th-text-3">
          {t(`maintenance.${CATEGORY_KEYS.find((c) => c.id === activeCategory)?.descKey}`)}
        </p>
      </div>

      {/* Score legend */}
      <div className="flex items-center justify-center gap-3 text-xs text-th-text-3 flex-wrap">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`inline-flex w-6 h-6 items-center justify-center rounded text-xs font-bold border ${SCORE_COLORS[s]}`}>
              {s}
            </span>
            <span>{t(`maintenance.${SCORE_LABELS[s].key}`) || SCORE_LABELS[s].fallback}</span>
          </span>
        ))}
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {QUESTION_KEYS[activeCategory]?.map((qKey, qIdx) => {
          const currentScore = getScore(activeCategory, qIdx);
          return (
            <div
              key={qIdx}
              className={`rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 transition-all duration-200 ${
                currentScore > 0 ? "border-th-border" : ""
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-xs text-th-text-3 bg-th-bg-3 rounded-lg w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                  {qIdx + 1}
                </span>
                <p className="text-sm text-th-text leading-relaxed">{t(`maintenance.${qKey}`)}</p>
              </div>
              <div className="flex gap-2 ml-10 flex-wrap" role="radiogroup" aria-label={t(`maintenance.${qKey}`)}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    role="radio"
                    aria-checked={currentScore === s}
                    onClick={() => setScore(activeCategory, qIdx, s)}
                    title={t(`maintenance.${SCORE_LABELS[s].key}`) || SCORE_LABELS[s].fallback}
                    aria-label={`${s} - ${t(`maintenance.${SCORE_LABELS[s].key}`) || SCORE_LABELS[s].fallback}`}
                    className={`w-11 h-11 rounded-lg border-2 text-sm font-bold transition-all duration-200 ${
                      currentScore === s
                        ? `${SCORE_COLORS[s]} scale-110`
                        : "border-th-border text-th-text-3 hover:border-brand-400 hover:text-brand-600"
                    }`}
                  >
                    {s}
                  </button>
                ))}
                {currentScore > 0 && (
                  <span className={`text-xs self-center ml-2 font-semibold px-2 py-1 rounded-lg ${SCORE_COLORS[currentScore]}`}>
                    {t(`maintenance.${SCORE_LABELS[currentScore].key}`) || SCORE_LABELS[currentScore].fallback}
                  </span>
                )}
              </div>
              {/* Notes field for observations */}
              <div className="mt-3 ml-10">
                <input
                  type="text"
                  value={findings[`${activeCategory}-${qIdx}`] ?? ""}
                  onChange={(e) =>
                    setFindings((prev) => ({
                      ...prev,
                      [`${activeCategory}-${qIdx}`]: e.target.value,
                    }))
                  }
                  aria-label={`${t(`maintenance.${qKey}`)} - ${t("maintenance.findingPlaceholder") || "Note finding"}`}
                  placeholder={t("maintenance.findingPlaceholder") || "Note finding or observation..."}
                  className="w-full px-3 py-2 border border-th-border rounded-lg text-xs bg-th-input text-th-text focus:ring-2 focus:ring-brand-500 outline-none placeholder:text-th-text-3 transition"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation + Submit */}
      <div className="flex gap-3 flex-wrap">
        {/* Previous category */}
        {CATEGORY_KEYS.findIndex((c) => c.id === activeCategory) > 0 && (
          <button
            onClick={() => {
              const idx = CATEGORY_KEYS.findIndex((c) => c.id === activeCategory);
              setActiveCategory(CATEGORY_KEYS[idx - 1].id);
            }}
            className="px-4 py-3 bg-th-bg-2 border border-th-border text-th-text rounded-lg text-sm font-medium hover:bg-th-bg-3 transition flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> {t("maintenance.prevCategory") || "Previous"}
          </button>
        )}

        {/* Next category */}
        {CATEGORY_KEYS.findIndex((c) => c.id === activeCategory) <
        CATEGORY_KEYS.length - 1 ? (
          <button
            onClick={() => {
              const idx = CATEGORY_KEYS.findIndex((c) => c.id === activeCategory);
              setActiveCategory(CATEGORY_KEYS[idx + 1].id);
            }}
            className="flex-1 bg-brand-500/10 border border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 py-3 rounded-lg font-semibold hover:bg-brand-500/20 transition flex items-center justify-center gap-1"
          >
            {t("maintenance.nextCategory") || "Next"} <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={saveAudit}
            disabled={saving || completionCount === 0}
            className="flex-1 bg-brand-600 text-white py-3 rounded-lg font-semibold hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving
              ? t("maintenance.saving") || "Saving..."
              : t("maintenance.submitAudit") || "Submit Audit"}
          </button>
        )}

        {/* Quick view results */}
        {completionCount > 0 && (
          <button
            onClick={() => setViewMode("results")}
            className="px-4 py-3 text-brand-600 hover:text-brand-700 dark:text-brand-400 text-sm font-medium flex items-center gap-1"
          >
            <Eye className="w-4 h-4" />
            {t("maintenance.viewResults")}
          </button>
        )}

        {/* History */}
        <button
          onClick={() => setViewMode("history")}
          className="px-4 py-3 text-th-text-3 hover:text-th-text text-sm font-medium flex items-center gap-1"
        >
          <History className="w-4 h-4" />
          {t("maintenance.viewHistory") || "History"}
        </button>
      </div>
    </div>
  );
}
