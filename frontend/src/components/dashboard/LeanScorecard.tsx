"use client";
import { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { leanApi, advancedLeanApi, oeeApi } from "@/lib/api";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Lightbulb, Footprints, Sparkles, HelpCircle, FileSpreadsheet, Map,
  BarChart3, Search, Settings, Target, type LucideIcon,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CategoryScore {
  id: string;
  titleKey: string;
  score: number;
  level: number;
}

interface AssessmentResult {
  categoryScores: CategoryScore[];
  overallScore: number;
  overallLevel: number;
  completedAt: string;
}

interface DMAICScore {
  phase: string;
  score: number;
  fullMark: number;
}

interface ModuleStat {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  count: number;
  color: string;
}

interface TrendPoint {
  month: string;
  score: number;
}

interface QuickWin {
  area: string;
  score: number;
  suggestion: string;
  icon: LucideIcon;
}

// ─── Empty defaults ──────────────────────────────────────────────────────────
const EMPTY_ASSESSMENT: AssessmentResult = {
  overallScore: 0,
  overallLevel: 0,
  completedAt: "",
  categoryScores: [],
};

const EMPTY_DMAIC: DMAICScore[] = [
  { phase: "Define", score: 0, fullMark: 100 },
  { phase: "Measure", score: 0, fullMark: 100 },
  { phase: "Analyze", score: 0, fullMark: 100 },
  { phase: "Improve", score: 0, fullMark: 100 },
  { phase: "Control", score: 0, fullMark: 100 },
];

const EMPTY_MODULES: ModuleStat[] = [
  { id: "kaizen", labelKey: "scorecard.kaizenEvents", icon: Lightbulb, count: 0, color: "text-amber-500" },
  { id: "gemba", labelKey: "scorecard.gembaWalks", icon: Footprints, count: 0, color: "text-blue-500" },
  { id: "sixS", labelKey: "scorecard.sixSAudits", icon: Sparkles, count: 0, color: "text-emerald-500" },
  { id: "fiveWhy", labelKey: "scorecard.fiveWhyAnalyses", icon: HelpCircle, count: 0, color: "text-red-500" },
  { id: "a3", labelKey: "scorecard.a3Reports", icon: FileSpreadsheet, count: 0, color: "text-violet-500" },
  { id: "vsm", labelKey: "scorecard.vsmMaps", icon: Map, count: 0, color: "text-cyan-500" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Convert assessment score (1-4) to percentage (0-100) */
function scoreTo100(score: number): number {
  return Math.round(((score - 1) / 3) * 100);
}

/** Map category scores to DMAIC phases */
function categoriesToDMAIC(cats: CategoryScore[]): DMAICScore[] {
  const findScore = (id: string) => cats.find((c) => c.id === id)?.score ?? 2;
  return [
    { phase: "Define", score: scoreTo100((findScore("standard") + findScore("visual")) / 2), fullMark: 100 },
    { phase: "Measure", score: scoreTo100(findScore("visual")), fullMark: 100 },
    { phase: "Analyze", score: scoreTo100(findScore("problem")), fullMark: 100 },
    { phase: "Improve", score: scoreTo100(findScore("improvement")), fullMark: 100 },
    { phase: "Control", score: scoreTo100((findScore("workplace") + findScore("tpmEquip")) / 2), fullMark: 100 },
  ];
}

// ─── Circular Gauge (SVG) ────────────────────────────────────────────────────
function CircularGauge({ score, size = 180 }: { score: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circumference - (pct / 100) * circumference;

  const color =
    pct < 30 ? "#ef4444" :
    pct < 50 ? "#f97316" :
    pct < 70 ? "#3b82f6" :
    "#10b981";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* Background ring */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" strokeWidth={12}
        className="stroke-th-border"
      />
      {/* Progress ring */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" strokeWidth={12}
        stroke={color}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-1000 ease-out"
      />
      {/* Score text */}
      <text
        x={size / 2} y={size / 2 - 8}
        textAnchor="middle" dominantBaseline="central"
        className="fill-th-text text-3xl font-bold"
        style={{ fontSize: "2rem", fontWeight: 700 }}
      >
        {pct}
      </text>
      <text
        x={size / 2} y={size / 2 + 18}
        textAnchor="middle" dominantBaseline="central"
        className="fill-th-text-3 text-xs"
        style={{ fontSize: "0.75rem" }}
      >
        / 100
      </text>
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function LeanScorecard() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [modules, setModules] = useState<ModuleStat[]>(EMPTY_MODULES);
  const [trend] = useState<TrendPoint[]>([]);
  const trendIsDemo = false;
  const [usingDemo, setUsingDemo] = useState(false);

  // ── Fetch data ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        // Fetch assessment
        let assessData: AssessmentResult | null = null;
        try {
          const res = await leanApi.getLatestAssessment();
          if (res.data) {
            const raw = res.data;
            assessData = {
              categoryScores: Array.isArray(raw.categoryScores) ? raw.categoryScores : [],
              overallScore: raw.overallScore ?? raw.overall_score ?? 0,
              overallLevel: raw.overallLevel ?? raw.overall_level ?? 1,
              completedAt: raw.completedAt ?? raw.completed_at ?? "",
            };
          }
        } catch {
          // Will use demo
        }

        // Fetch module counts in parallel
        const counts: Partial<Record<string, number>> = {};
        const fetchers = [
          leanApi.getKaizenBoard().then((r) => {
            const items = r.data?.items || r.data?.board || r.data || [];
            counts.kaizen = Array.isArray(items) ? items.length : 0;
          }).catch(() => {}),
          advancedLeanApi.listGembaWalks().then((r) => {
            const items = r.data || [];
            counts.gemba = Array.isArray(items) ? items.length : 0;
          }).catch(() => {}),
          advancedLeanApi.listSixSAudits().then((r) => {
            const items = r.data || [];
            counts.sixS = Array.isArray(items) ? items.length : 0;
          }).catch(() => {}),
          leanApi.listFiveWhy().then((r) => {
            const items = r.data || [];
            counts.fiveWhy = Array.isArray(items) ? items.length : 0;
          }).catch(() => {}),
          advancedLeanApi.listA3().then((r) => {
            const items = r.data || [];
            counts.a3 = Array.isArray(items) ? items.length : 0;
          }).catch(() => {}),
          advancedLeanApi.listVSM().then((r) => {
            const items = r.data || [];
            counts.vsm = Array.isArray(items) ? items.length : 0;
          }).catch(() => {}),
        ];

        await Promise.allSettled(fetchers);

        if (cancelled) return;

        if (assessData && assessData.categoryScores.length > 0) {
          setAssessment(assessData);
        } else {
          setAssessment(EMPTY_ASSESSMENT);
          setUsingDemo(true);
        }

        // Merge real counts into module stats
        const hasAnyCounts = Object.values(counts).some((v) => v !== undefined && v > 0);
        if (hasAnyCounts) {
          setModules((prev) =>
            prev.map((m) => ({
              ...m,
              count: counts[m.id] !== undefined ? counts[m.id]! : m.count,
            }))
          );
        }
      } catch {
        if (!cancelled) {
          setAssessment(EMPTY_ASSESSMENT);
          setUsingDemo(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const overallPct = useMemo(
    () => assessment ? scoreTo100(assessment.overallScore) : 0,
    [assessment]
  );

  const dmaicData = useMemo(
    () => assessment ? categoriesToDMAIC(assessment.categoryScores) : EMPTY_DMAIC,
    [assessment]
  );

  const quickWins = useMemo<QuickWin[]>(() => {
    if (!assessment) return [];
    const ICONS: Record<string, LucideIcon> = {
      workplace: Sparkles, visual: BarChart3, standard: FileSpreadsheet,
      improvement: Lightbulb, problem: Search, tpmEquip: Settings,
    };
    const SUGGESTIONS: Record<string, string> = {
      workplace: "scorecard.suggestWorkplace",
      visual: "scorecard.suggestVisual",
      standard: "scorecard.suggestStandard",
      improvement: "scorecard.suggestImprovement",
      problem: "scorecard.suggestProblem",
      tpmEquip: "scorecard.suggestTPM",
    };
    return [...assessment.categoryScores]
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((cs) => ({
        area: t(`assessment.${cs.titleKey}`) || cs.titleKey,
        score: cs.score,
        suggestion: t(SUGGESTIONS[cs.id] || "scorecard.suggestDefault"),
        icon: ICONS[cs.id] || Lightbulb,
      }));
  }, [assessment, t]);

  // ── Maturity label ────────────────────────────────────────────────────────
  const maturityLabel = useMemo(() => {
    if (overallPct < 25) return { key: "scorecard.levelBeginner", color: "text-red-500" };
    if (overallPct < 50) return { key: "scorecard.levelDeveloping", color: "text-orange-500" };
    if (overallPct < 75) return { key: "scorecard.levelProficient", color: "text-blue-500" };
    return { key: "scorecard.levelAdvanced", color: "text-emerald-500" };
  }, [overallPct]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-th-text-3">{t("scorecard.loading")}</span>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-th-text">
          {t("scorecard.title")}
        </h1>
        <p className="text-sm text-th-text-3 max-w-lg mx-auto">
          {t("scorecard.subtitle")}
        </p>
        {usingDemo && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            {t("scorecard.demoNote")}
          </p>
        )}
      </div>

      {/* ─── Row 1: Overall Score + DMAIC Radar ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall Maturity Score */}
        <div className="bg-th-bg-2 rounded-xl border border-th-border p-6 shadow-card flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold text-th-text mb-4">
            {t("scorecard.overallMaturity")}
          </h2>
          <CircularGauge score={overallPct} size={180} />
          <div className={`mt-4 text-lg font-bold ${maturityLabel.color}`}>
            {t(maturityLabel.key)}
          </div>
          <p className="text-xs text-th-text-3 mt-1">
            {assessment
              ? t("scorecard.rawScore", { score: assessment.overallScore.toFixed(1) })
              : ""}
          </p>
        </div>

        {/* DMAIC Radar Chart */}
        <div className="bg-th-bg-2 rounded-xl border border-th-border p-6 shadow-card">
          <h2 className="text-lg font-semibold text-th-text mb-4">
            {t("scorecard.dmaicPhases")}
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={dmaicData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="var(--color-th-border, #e5e7eb)" />
              <PolarAngleAxis
                dataKey="phase"
                tick={{ fill: "var(--color-th-text-2, #6b7280)", fontSize: 12, fontWeight: 600 }}
              />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Row 2: Module Usage Stats ─── */}
      <div className="bg-th-bg-2 rounded-xl border border-th-border p-6 shadow-card">
        <h2 className="text-lg font-semibold text-th-text mb-4">
          {t("scorecard.moduleUsage")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {modules.map((mod) => (
            <div
              key={mod.id}
              className="bg-th-bg rounded-xl border border-th-border p-4 text-center hover:shadow-md transition"
            >
              <div className={`mb-2 ${mod.color}`}><mod.icon size={24} /></div>
              <div className="text-2xl font-bold text-th-text">{mod.count}</div>
              <div className="text-xs text-th-text-3 mt-1 leading-tight">
                {t(mod.labelKey)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Row 3: Improvement Trend + Quick Wins ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Line Chart */}
        <div className="bg-th-bg-2 rounded-xl border border-th-border p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-th-text">
              {t("scorecard.improvementTrend")}
            </h2>
            {trendIsDemo && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-medium">
                {t("scorecard.demoNote") || "Demo data"}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-th-border, #e5e7eb)" />
              <XAxis
                dataKey="month"
                tick={{ fill: "var(--color-th-text-3, #9ca3af)", fontSize: 12 }}
                axisLine={{ stroke: "var(--color-th-border, #e5e7eb)" }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "var(--color-th-text-3, #9ca3af)", fontSize: 12 }}
                axisLine={{ stroke: "var(--color-th-border, #e5e7eb)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-th-bg-2, #fff)",
                  border: "1px solid var(--color-th-border, #e5e7eb)",
                  borderRadius: "0.75rem",
                  fontSize: "0.75rem",
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#6366f1" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-th-text-3 text-center mt-2">
            {t("scorecard.trendNote")}
          </p>
        </div>

        {/* Quick Wins */}
        <div className="bg-th-bg-2 rounded-xl border border-th-border p-6 shadow-card">
          <h2 className="text-lg font-semibold text-th-text mb-4">
            {t("scorecard.quickWins")}
          </h2>
          <p className="text-sm text-th-text-3 mb-4">
            {t("scorecard.quickWinsDesc")}
          </p>
          <div className="space-y-3">
            {quickWins.map((win, idx) => {
              const urgency = win.score <= 1.5 ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20" :
                              win.score <= 2.5 ? "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/20" :
                              "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20";
              return (
                <div
                  key={idx}
                  className={`rounded-xl p-4 border ${urgency} transition`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 text-th-text-2"><win.icon size={20} /></span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-th-text text-sm">
                          {win.area}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-th-bg-3 text-th-text-2 font-medium">
                          {win.score.toFixed(1)} / 4.0
                        </span>
                        {idx === 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-medium">
                            {t("scorecard.topPriority")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-th-text-3 mt-1 leading-relaxed">
                        {win.suggestion}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Category Breakdown ─── */}
      {assessment && (
        <div className="bg-th-bg-2 rounded-xl border border-th-border p-6 shadow-card">
          <h2 className="text-lg font-semibold text-th-text mb-4">
            {t("scorecard.categoryBreakdown")}
          </h2>
          <div className="space-y-3">
            {assessment.categoryScores.map((cs) => {
              const pct = scoreTo100(cs.score);
              const barColor =
                cs.level === 1 ? "#ef4444" :
                cs.level === 2 ? "#f97316" :
                cs.level === 3 ? "#3b82f6" :
                "#10b981";
              return (
                <div key={cs.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-th-text">
                      {t(`assessment.${cs.titleKey}`) || cs.titleKey}
                    </span>
                    <span className="text-xs font-semibold text-th-text-2">
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-th-bg-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
