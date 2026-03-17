"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { leanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import {
  ClipboardList,
  Star,
  Target,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Award,
  Sparkles,
  Eye,
  FileText,
  Lightbulb,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  RotateCcw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type NavId =
  | "six-s" | "dashboard" | "hourly" | "andon" | "production"
  | "five-why" | "ishikawa" | "pareto" | "a3"
  | "kaizen" | "vsm" | "smed" | "gemba"
  | "tpm" | "cilt" | "copilot";

interface AnswerOption {
  level: number;
  labelKey: string;
  descKey: string;
}

interface QuestionDef {
  id: string;
  questionKey: string;
  options: AnswerOption[];
}

interface CategoryDef {
  id: string;
  titleKey: string;
  descKey: string;
  icon: React.ReactNode;
  color: string;
  colorDark: string;
  questions: QuestionDef[];
  recommendedTools: { navId: NavId; nameKey: string }[];
}

interface AssessmentResult {
  answers: Record<string, number>;
  categoryScores: { id: string; titleKey: string; score: number; level: number }[];
  overallScore: number;
  overallLevel: number;
  completedAt: string;
}

type WizardPhase = "loading" | "results" | "wizard";

// ─── Category Icon Map (for results rendering) ──────────────────────────────
const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  workplace: <Sparkles className="w-4 h-4" />,
  visual: <BarChart3 className="w-4 h-4" />,
  standard: <FileText className="w-4 h-4" />,
  improvement: <Lightbulb className="w-4 h-4" />,
  problem: <Search className="w-4 h-4" />,
  tpmEquip: <Settings className="w-4 h-4" />,
};

// ─── Maturity Level Helpers ──────────────────────────────────────────────────
const MATURITY_NAMES: Record<number, { nameKey: string; color: string; bg: string; border: string }> = {
  1: { nameKey: "levelBeginner",    color: "text-red-600 dark:text-red-400",     bg: "bg-red-50 dark:bg-red-950/30",       border: "border-red-200 dark:border-red-800" },
  2: { nameKey: "levelDeveloping",  color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30",  border: "border-orange-200 dark:border-orange-800" },
  3: { nameKey: "levelProficient",  color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/30",     border: "border-blue-200 dark:border-blue-800" },
  4: { nameKey: "levelAdvanced",    color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800" },
};

function scoreToLevel(score: number): number {
  if (score <= 1.5) return 1;
  if (score <= 2.5) return 2;
  if (score <= 3.25) return 3;
  return 4;
}

// ─── Category & Question Data ────────────────────────────────────────────────
const CATEGORIES: CategoryDef[] = [
  {
    id: "workplace",
    titleKey: "catWorkplace",
    descKey: "catWorkplaceDesc",
    icon: <Sparkles className="w-5 h-5" />,
    color: "text-amber-600",
    colorDark: "dark:text-amber-400",
    questions: [
      {
        id: "wp1", questionKey: "wp1Q",
        options: [
          { level: 1, labelKey: "wp1L1", descKey: "wp1D1" },
          { level: 2, labelKey: "wp1L2", descKey: "wp1D2" },
          { level: 3, labelKey: "wp1L3", descKey: "wp1D3" },
          { level: 4, labelKey: "wp1L4", descKey: "wp1D4" },
        ],
      },
      {
        id: "wp2", questionKey: "wp2Q",
        options: [
          { level: 1, labelKey: "wp2L1", descKey: "wp2D1" },
          { level: 2, labelKey: "wp2L2", descKey: "wp2D2" },
          { level: 3, labelKey: "wp2L3", descKey: "wp2D3" },
          { level: 4, labelKey: "wp2L4", descKey: "wp2D4" },
        ],
      },
      {
        id: "wp3", questionKey: "wp3Q",
        options: [
          { level: 1, labelKey: "wp3L1", descKey: "wp3D1" },
          { level: 2, labelKey: "wp3L2", descKey: "wp3D2" },
          { level: 3, labelKey: "wp3L3", descKey: "wp3D3" },
          { level: 4, labelKey: "wp3L4", descKey: "wp3D4" },
        ],
      },
    ],
    recommendedTools: [
      { navId: "six-s", nameKey: "toolSixS" },
      { navId: "gemba", nameKey: "toolGemba" },
    ],
  },
  {
    id: "visual",
    titleKey: "catVisual",
    descKey: "catVisualDesc",
    icon: <BarChart3 className="w-5 h-5" />,
    color: "text-blue-600",
    colorDark: "dark:text-blue-400",
    questions: [
      {
        id: "vm1", questionKey: "vm1Q",
        options: [
          { level: 1, labelKey: "vm1L1", descKey: "vm1D1" },
          { level: 2, labelKey: "vm1L2", descKey: "vm1D2" },
          { level: 3, labelKey: "vm1L3", descKey: "vm1D3" },
          { level: 4, labelKey: "vm1L4", descKey: "vm1D4" },
        ],
      },
      {
        id: "vm2", questionKey: "vm2Q",
        options: [
          { level: 1, labelKey: "vm2L1", descKey: "vm2D1" },
          { level: 2, labelKey: "vm2L2", descKey: "vm2D2" },
          { level: 3, labelKey: "vm2L3", descKey: "vm2D3" },
          { level: 4, labelKey: "vm2L4", descKey: "vm2D4" },
        ],
      },
      {
        id: "vm3", questionKey: "vm3Q",
        options: [
          { level: 1, labelKey: "vm3L1", descKey: "vm3D1" },
          { level: 2, labelKey: "vm3L2", descKey: "vm3D2" },
          { level: 3, labelKey: "vm3L3", descKey: "vm3D3" },
          { level: 4, labelKey: "vm3L4", descKey: "vm3D4" },
        ],
      },
    ],
    recommendedTools: [
      { navId: "dashboard", nameKey: "toolOee" },
      { navId: "andon", nameKey: "toolAndon" },
      { navId: "hourly", nameKey: "toolHourly" },
    ],
  },
  {
    id: "standard",
    titleKey: "catStandard",
    descKey: "catStandardDesc",
    icon: <FileText className="w-5 h-5" />,
    color: "text-violet-600",
    colorDark: "dark:text-violet-400",
    questions: [
      {
        id: "sw1", questionKey: "sw1Q",
        options: [
          { level: 1, labelKey: "sw1L1", descKey: "sw1D1" },
          { level: 2, labelKey: "sw1L2", descKey: "sw1D2" },
          { level: 3, labelKey: "sw1L3", descKey: "sw1D3" },
          { level: 4, labelKey: "sw1L4", descKey: "sw1D4" },
        ],
      },
      {
        id: "sw2", questionKey: "sw2Q",
        options: [
          { level: 1, labelKey: "sw2L1", descKey: "sw2D1" },
          { level: 2, labelKey: "sw2L2", descKey: "sw2D2" },
          { level: 3, labelKey: "sw2L3", descKey: "sw2D3" },
          { level: 4, labelKey: "sw2L4", descKey: "sw2D4" },
        ],
      },
      {
        id: "sw3", questionKey: "sw3Q",
        options: [
          { level: 1, labelKey: "sw3L1", descKey: "sw3D1" },
          { level: 2, labelKey: "sw3L2", descKey: "sw3D2" },
          { level: 3, labelKey: "sw3L3", descKey: "sw3D3" },
          { level: 4, labelKey: "sw3L4", descKey: "sw3D4" },
        ],
      },
    ],
    recommendedTools: [
      { navId: "production", nameKey: "toolProduction" },
      { navId: "smed", nameKey: "toolSmed" },
    ],
  },
  {
    id: "improvement",
    titleKey: "catImprovement",
    descKey: "catImprovementDesc",
    icon: <Lightbulb className="w-5 h-5" />,
    color: "text-emerald-600",
    colorDark: "dark:text-emerald-400",
    questions: [
      {
        id: "ci1", questionKey: "ci1Q",
        options: [
          { level: 1, labelKey: "ci1L1", descKey: "ci1D1" },
          { level: 2, labelKey: "ci1L2", descKey: "ci1D2" },
          { level: 3, labelKey: "ci1L3", descKey: "ci1D3" },
          { level: 4, labelKey: "ci1L4", descKey: "ci1D4" },
        ],
      },
      {
        id: "ci2", questionKey: "ci2Q",
        options: [
          { level: 1, labelKey: "ci2L1", descKey: "ci2D1" },
          { level: 2, labelKey: "ci2L2", descKey: "ci2D2" },
          { level: 3, labelKey: "ci2L3", descKey: "ci2D3" },
          { level: 4, labelKey: "ci2L4", descKey: "ci2D4" },
        ],
      },
      {
        id: "ci3", questionKey: "ci3Q",
        options: [
          { level: 1, labelKey: "ci3L1", descKey: "ci3D1" },
          { level: 2, labelKey: "ci3L2", descKey: "ci3D2" },
          { level: 3, labelKey: "ci3L3", descKey: "ci3D3" },
          { level: 4, labelKey: "ci3L4", descKey: "ci3D4" },
        ],
      },
    ],
    recommendedTools: [
      { navId: "kaizen", nameKey: "toolKaizen" },
      { navId: "vsm", nameKey: "toolVsm" },
      { navId: "gemba", nameKey: "toolGemba" },
    ],
  },
  {
    id: "problem",
    titleKey: "catProblem",
    descKey: "catProblemDesc",
    icon: <Search className="w-5 h-5" />,
    color: "text-rose-600",
    colorDark: "dark:text-rose-400",
    questions: [
      {
        id: "ps1", questionKey: "ps1Q",
        options: [
          { level: 1, labelKey: "ps1L1", descKey: "ps1D1" },
          { level: 2, labelKey: "ps1L2", descKey: "ps1D2" },
          { level: 3, labelKey: "ps1L3", descKey: "ps1D3" },
          { level: 4, labelKey: "ps1L4", descKey: "ps1D4" },
        ],
      },
      {
        id: "ps2", questionKey: "ps2Q",
        options: [
          { level: 1, labelKey: "ps2L1", descKey: "ps2D1" },
          { level: 2, labelKey: "ps2L2", descKey: "ps2D2" },
          { level: 3, labelKey: "ps2L3", descKey: "ps2D3" },
          { level: 4, labelKey: "ps2L4", descKey: "ps2D4" },
        ],
      },
      {
        id: "ps3", questionKey: "ps3Q",
        options: [
          { level: 1, labelKey: "ps3L1", descKey: "ps3D1" },
          { level: 2, labelKey: "ps3L2", descKey: "ps3D2" },
          { level: 3, labelKey: "ps3L3", descKey: "ps3D3" },
          { level: 4, labelKey: "ps3L4", descKey: "ps3D4" },
        ],
      },
    ],
    recommendedTools: [
      { navId: "five-why", nameKey: "toolFiveWhy" },
      { navId: "ishikawa", nameKey: "toolIshikawa" },
      { navId: "pareto", nameKey: "toolPareto" },
      { navId: "a3", nameKey: "toolA3" },
    ],
  },
  {
    id: "tpmEquip",
    titleKey: "catTPM",
    descKey: "catTPMDesc",
    icon: <Settings className="w-5 h-5" />,
    color: "text-cyan-600",
    colorDark: "dark:text-cyan-400",
    questions: [
      {
        id: "tp1", questionKey: "tp1Q",
        options: [
          { level: 1, labelKey: "tp1L1", descKey: "tp1D1" },
          { level: 2, labelKey: "tp1L2", descKey: "tp1D2" },
          { level: 3, labelKey: "tp1L3", descKey: "tp1D3" },
          { level: 4, labelKey: "tp1L4", descKey: "tp1D4" },
        ],
      },
      {
        id: "tp2", questionKey: "tp2Q",
        options: [
          { level: 1, labelKey: "tp2L1", descKey: "tp2D1" },
          { level: 2, labelKey: "tp2L2", descKey: "tp2D2" },
          { level: 3, labelKey: "tp2L3", descKey: "tp2D3" },
          { level: 4, labelKey: "tp2L4", descKey: "tp2D4" },
        ],
      },
      {
        id: "tp3", questionKey: "tp3Q",
        options: [
          { level: 1, labelKey: "tp3L1", descKey: "tp3D1" },
          { level: 2, labelKey: "tp3L2", descKey: "tp3D2" },
          { level: 3, labelKey: "tp3L3", descKey: "tp3D3" },
          { level: 4, labelKey: "tp3L4", descKey: "tp3D4" },
        ],
      },
    ],
    recommendedTools: [
      { navId: "tpm", nameKey: "toolTpm" },
      { navId: "cilt", nameKey: "toolCilt" },
    ],
  },
];

const TOTAL_QUESTIONS = CATEGORIES.reduce((s, c) => s + c.questions.length, 0);

// ─── Radar Chart (pure SVG) ─────────────────────────────────────────────────
function RadarChart({ scores, labels }: { scores: number[]; labels: string[] }) {
  const cx = 150, cy = 150, r = 110;
  const n = scores.length;
  const angleStep = (2 * Math.PI) / n;

  function polarToCart(angle: number, radius: number) {
    return {
      x: cx + radius * Math.cos(angle - Math.PI / 2),
      y: cy + radius * Math.sin(angle - Math.PI / 2),
    };
  }

  const gridLevels = [1, 2, 3, 4];

  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-[320px] mx-auto">
      {/* Grid rings */}
      {gridLevels.map((lvl) => {
        const rad = (lvl / 4) * r;
        const pts = Array.from({ length: n }, (_, i) => {
          const p = polarToCart(i * angleStep, rad);
          return `${p.x},${p.y}`;
        }).join(" ");
        return (
          <polygon
            key={lvl}
            points={pts}
            fill="none"
            className="stroke-th-border"
            strokeWidth={lvl === 4 ? 1.5 : 0.5}
            strokeDasharray={lvl < 4 ? "3,3" : "none"}
          />
        );
      })}

      {/* Axis lines */}
      {Array.from({ length: n }, (_, i) => {
        const p = polarToCart(i * angleStep, r);
        return (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y}
            className="stroke-th-border" strokeWidth={0.5} />
        );
      })}

      {/* Data polygon */}
      {(() => {
        const pts = scores.map((s, i) => {
          const rad = (s / 4) * r;
          const p = polarToCart(i * angleStep, rad);
          return `${p.x},${p.y}`;
        }).join(" ");
        return (
          <>
            <polygon points={pts} fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth={2} />
            {scores.map((s, i) => {
              const rad = (s / 4) * r;
              const p = polarToCart(i * angleStep, rad);
              return <circle key={i} cx={p.x} cy={p.y} r={4} fill="#6366f1" />;
            })}
          </>
        );
      })()}

      {/* Labels */}
      {labels.map((label, i) => {
        const p = polarToCart(i * angleStep, r + 22);
        const anchor = p.x < cx - 10 ? "end" : p.x > cx + 10 ? "start" : "middle";
        return (
          <text key={i} x={p.x} y={p.y}
            textAnchor={anchor} dominantBaseline="central"
            className="fill-th-text-2 text-[9px] font-medium"
          >
            {label.length > 16 ? label.slice(0, 14) + "..." : label}
          </text>
        );
      })}

      {/* Level numbers */}
      {gridLevels.map((lvl) => {
        const p = polarToCart(0, (lvl / 4) * r);
        return (
          <text key={lvl} x={p.x + 6} y={p.y - 4}
            className="fill-th-text-3 text-[8px]">{lvl}</text>
        );
      })}
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function LeanAssessment() {
  const { t } = useI18n();
  const { printView, exportToExcel, exportToCSV } = useExport();
  const [phase, setPhase] = useState<WizardPhase>("loading");
  const [currentStep, setCurrentStep] = useState(0); // 0-5 for categories
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load latest assessment on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await leanApi.getLatestAssessment();
        if (!cancelled && res.data) {
          // Normalize backend response to AssessmentResult format
          const raw = res.data;
          const data: AssessmentResult = {
            answers: raw.answers || {},
            categoryScores: Array.isArray(raw.categoryScores) ? raw.categoryScores : [],
            overallScore: raw.overallScore ?? raw.overall_score ?? 0,
            overallLevel: raw.overallLevel ?? raw.overall_level ?? 1,
            completedAt: raw.completedAt ?? raw.completed_at ?? raw.created_at ?? "",
          };
          // Validate overallLevel is 1-4
          if (data.overallLevel < 1 || data.overallLevel > 4) {
            data.overallLevel = scoreToLevel(data.overallScore);
          }
          setResult(data);
          setPhase("results");
        } else if (!cancelled) {
          setPhase("wizard");
        }
      } catch {
        if (!cancelled) setPhase("wizard");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Answer a question ────────────────────────────────────────────────────
  const handleAnswer = useCallback((questionId: string, level: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: level }));
  }, []);

  // ── Check if current section is complete ─────────────────────────────────
  const currentCategory = CATEGORIES[currentStep];
  const sectionComplete = currentCategory?.questions.every((q) => answers[q.id] !== undefined) ?? false;

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === TOTAL_QUESTIONS;

  // ── Navigate sections ────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (sectionComplete) {
      setCompletedSteps((prev) => new Set(prev).add(currentStep));
    }
    if (currentStep < CATEGORIES.length - 1) {
      setCurrentStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep, sectionComplete]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep]);

  const jumpToStep = useCallback((step: number) => {
    if (step <= currentStep || completedSteps.has(step) || completedSteps.has(step - 1) || step === 0) {
      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep, completedSteps]);

  // ── Compute results ──────────────────────────────────────────────────────
  const computeResults = useCallback((): AssessmentResult => {
    const categoryScores = CATEGORIES.map((cat) => {
      const catAnswers = cat.questions.map((q) => answers[q.id] || 1);
      const avg = catAnswers.reduce((s, v) => s + v, 0) / catAnswers.length;
      return {
        id: cat.id,
        titleKey: cat.titleKey,
        score: Math.round(avg * 100) / 100,
        level: scoreToLevel(avg),
      };
    });

    const overallAvg = categoryScores.reduce((s, c) => s + c.score, 0) / categoryScores.length;

    return {
      answers,
      categoryScores,
      overallScore: Math.round(overallAvg * 100) / 100,
      overallLevel: scoreToLevel(overallAvg),
      completedAt: new Date().toISOString(),
    };
  }, [answers]);

  // ── Submit assessment ────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const computed = computeResults();
    setSaving(true);
    setError(null);
    try {
      await leanApi.saveAssessment(computed);
      setResult(computed);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err?.response?.data?.detail || t("assessment.saveError"));
    } finally {
      setSaving(false);
    }
  }, [computeResults, t]);

  // ── Retake ───────────────────────────────────────────────────────────────
  const handleRetake = useCallback(() => {
    setAnswers({});
    setCompletedSteps(new Set());
    setCurrentStep(0);
    setResult(null);
    setPhase("wizard");
  }, []);

  // ── Prioritized recommendations (sorted by lowest score) ────────────────
  const recommendations = useMemo(() => {
    if (!result || !Array.isArray(result.categoryScores)) return [];
    const sorted = [...result.categoryScores].sort((a, b) => a.score - b.score);
    return sorted
      .map((cs) => {
        const cat = CATEGORIES.find((c) => c.id === cs.id);
        if (!cat) return null;
        return { ...cs, icon: cat.icon, tools: cat.recommendedTools, color: cat.color, colorDark: cat.colorDark };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [result]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-th-accent animate-spin" />
          <span className="text-sm text-th-text-3">{t("assessment.loading")}</span>
        </div>
      </div>
    );
  }

  // ── Results view ─────────────────────────────────────────────────────────
  if (phase === "results" && result) {
    const overall = MATURITY_NAMES[result.overallLevel] || MATURITY_NAMES[1];
    return (
      <div className="max-w-[1400px] mx-auto space-y-6 p-4 sm:p-6" data-print-area="true">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-end">
            <ExportToolbar
              onPrint={() => printView({ title: t("assessment.resultsTitle") || "Lean Assessment Results", subtitle: t("assessment.completedOn", { date: new Date(result.completedAt).toLocaleDateString() }) })}
              onExportExcel={() => exportToExcel({
                filename: "lean_assessment",
                sheetName: "Assessment",
                columns: [
                  { key: "category", header: t("assessment.category") || "Category", width: 25 },
                  { key: "score", header: t("assessment.score") || "Score", width: 10, format: (v: number) => v.toFixed(1) },
                  { key: "level", header: t("assessment.level") || "Level", width: 10 },
                  { key: "maturity", header: t("assessment.maturityLevel") || "Maturity", width: 18, format: (v: number) => t(`assessment.${MATURITY_NAMES[v]?.nameKey}`) || MATURITY_NAMES[v]?.nameKey || "" },
                ],
                rows: (result.categoryScores || []).map((cs) => ({
                  category: t(`assessment.${cs.titleKey}`) || cs.titleKey,
                  score: cs.score,
                  level: cs.level,
                  maturity: cs.level,
                })),
                headerRows: [
                  [t("assessment.overallScore") || "Overall Score", result.overallScore.toFixed(1)],
                  [t("assessment.overallLevel") || "Overall Level", t(`assessment.${MATURITY_NAMES[result.overallLevel]?.nameKey}`) || ""],
                ],
              })}
              onExportCSV={() => exportToCSV({
                filename: "lean_assessment",
                columns: [
                  { key: "category", header: t("assessment.category") || "Category" },
                  { key: "score", header: t("assessment.score") || "Score", format: (v: number) => v.toFixed(1) },
                  { key: "level", header: t("assessment.level") || "Level" },
                  { key: "maturity", header: t("assessment.maturityLevel") || "Maturity", format: (v: number) => t(`assessment.${MATURITY_NAMES[v]?.nameKey}`) || "" },
                ],
                rows: (result.categoryScores || []).map((cs) => ({
                  category: t(`assessment.${cs.titleKey}`) || cs.titleKey,
                  score: cs.score,
                  level: cs.level,
                  maturity: cs.level,
                })),
              })}
            />
          </div>
          <div className="flex items-center justify-center gap-2">
            <ClipboardList className="w-6 h-6 text-th-accent" />
            <h1 className="text-2xl sm:text-3xl font-bold text-th-text">
              {t("assessment.resultsTitle")}
            </h1>
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
                <div className={`text-3xl font-bold ${overall.color}`}>
                  {result.overallScore.toFixed(1)}
                </div>
                <div className="text-xs text-th-text-3">{t("assessment.outOf4")}</div>
              </div>
            </div>
            <div className="text-center sm:text-left flex-1">
              <div className={`text-xl font-bold ${overall.color}`}>
                {t(`assessment.${overall.nameKey}`)}
              </div>
              <p className="text-sm text-th-text-2 mt-1">
                {t(`assessment.${overall.nameKey}Desc`)}
              </p>
            </div>
          </div>
        </div>

        {/* Category Scores + Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score bars */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-th-accent" />
              <h2 className="text-lg font-semibold text-th-text">
                {t("assessment.categoryScores")}
              </h2>
            </div>
            <div className="space-y-4">
              {(result.categoryScores || []).map((cs) => {
                const cat = CATEGORIES.find((c) => c.id === cs.id);
                if (!cat) return null;
                const lvl = MATURITY_NAMES[cs.level] || MATURITY_NAMES[1];
                const pct = ((cs.score - 1) / 3) * 100;
                return (
                  <div key={cs.id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-th-text flex items-center gap-1.5">
                        <span className={`${cat.color} ${cat.colorDark}`}>{CATEGORY_ICON_MAP[cs.id] || <Target className="w-4 h-4" />}</span>
                        {t(`assessment.${cs.titleKey}`)}
                      </span>
                      <span className={`text-xs font-semibold ${lvl.color}`}>
                        {cs.score.toFixed(1)} / 4
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-th-bg-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          backgroundColor: cs.level === 1 ? "#ef4444" : cs.level === 2 ? "#f97316" : cs.level === 3 ? "#3b82f6" : "#10b981",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Radar chart */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 flex items-center justify-center">
            <RadarChart
              scores={(result.categoryScores || []).map((cs) => cs.score)}
              labels={(result.categoryScores || []).map((cs) => {
                const translated = t(`assessment.${cs.titleKey}`);
                // If translation returns the key itself, try to extract a readable name
                if (translated.startsWith("assessment.")) {
                  const cat = CATEGORIES.find(c => c.id === cs.id);
                  return cat ? t(`assessment.${cat.titleKey}`) : cs.titleKey.replace("cat", "");
                }
                return translated;
              })}
            />
          </div>
        </div>

        {/* Prioritized Recommendations */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-th-accent" />
            <h2 className="text-lg font-semibold text-th-text">
              {t("assessment.recommendations")}
            </h2>
          </div>
          <p className="text-sm text-th-text-3 mb-4">
            {t("assessment.recommendationsDesc")}
          </p>
          <div className="space-y-3">
            {recommendations.map((rec, idx) => {
              const lvl = MATURITY_NAMES[rec.level];
              const isPriority = idx < 2;
              return (
                <div
                  key={rec.id}
                  className={`rounded-xl p-4 border transition ${
                    isPriority
                      ? `${lvl.bg} ${lvl.border}`
                      : "bg-th-bg-3 border-th-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {isPriority ? (
                        <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                      ) : (
                        <span className={`${rec.color} ${rec.colorDark}`}>{rec.icon}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-th-text text-sm">
                          {t(`assessment.${rec.titleKey}`)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lvl.bg} ${lvl.color}`}>
                          {t(`assessment.${lvl.nameKey}`)} ({rec.score.toFixed(1)})
                        </span>
                        {isPriority && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-medium">
                            {t("assessment.priority")}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {rec.tools.map((tool) => (
                          <span
                            key={tool.navId}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                          >
                            {t(`assessment.${tool.nameKey}`)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Retake button */}
        <div className="text-center pt-2 pb-4">
          <button
            onClick={handleRetake}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold border border-th-border text-th-text-2 bg-th-bg-2 hover:bg-th-bg-3 transition"
          >
            <RotateCcw className="w-4 h-4" />
            {t("assessment.retake")}
          </button>
        </div>
      </div>
    );
  }

  // ── Wizard view ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-6">
      {/* Title */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <ClipboardList className="w-6 h-6 text-th-accent" />
          <h1 className="text-2xl font-bold text-th-text">
            {t("assessment.title")}
          </h1>
        </div>
        <p className="text-sm text-th-text-3 max-w-lg mx-auto">
          {t("assessment.subtitle")}
        </p>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
        {/* Step indicators */}
        <div className="flex items-center justify-between mb-3">
          {CATEGORIES.map((cat, idx) => {
            const isActive = idx === currentStep;
            const isDone = completedSteps.has(idx);
            const isAccessible = idx <= currentStep || isDone || completedSteps.has(idx - 1) || idx === 0;
            return (
              <button
                key={cat.id}
                onClick={() => isAccessible && jumpToStep(idx)}
                disabled={!isAccessible}
                className={`flex flex-col items-center gap-1 transition group flex-1 ${
                  !isAccessible ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                }`}
                title={t(`assessment.${cat.titleKey}`)}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isActive
                      ? "bg-indigo-500 text-white ring-2 ring-indigo-300 dark:ring-indigo-700 scale-110"
                      : isDone
                        ? "bg-emerald-500 text-white"
                        : "bg-th-bg-3 text-th-text-3"
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : cat.icon}
                </div>
                <span className={`text-[10px] leading-tight text-center hidden sm:block ${
                  isActive ? "text-indigo-600 dark:text-indigo-400 font-semibold" : "text-th-text-3"
                }`}>
                  {t(`assessment.${cat.titleKey}`)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Overall progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-th-bg-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${(answeredCount / TOTAL_QUESTIONS) * 100}%` }}
            />
          </div>
          <span className="text-xs text-th-text-3 whitespace-nowrap">
            {answeredCount}/{TOTAL_QUESTIONS}
          </span>
        </div>
      </div>

      {/* Section header */}
      <div className="flex items-center gap-3">
        <span className={`${currentCategory.color} ${currentCategory.colorDark}`}>
          {currentCategory.icon}
        </span>
        <div>
          <h2 className="text-lg font-bold text-th-text">
            {t(`assessment.${currentCategory.titleKey}`)}
          </h2>
          <p className="text-sm text-th-text-3">
            {t(`assessment.${currentCategory.descKey}`)}
          </p>
        </div>
        <span className="ml-auto text-xs text-th-text-3 bg-th-bg-2 border border-th-border rounded-full px-3 py-1">
          {t("assessment.sectionOf", { current: String(currentStep + 1) })}
        </span>
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {currentCategory.questions.map((q, qi) => {
          const selected = answers[q.id];
          return (
            <div key={q.id} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">
                  {currentStep * 3 + qi + 1}
                </span>
                <h3 className="text-sm font-semibold text-th-text leading-snug pt-0.5">
                  {t(`assessment.${q.questionKey}`)}
                </h3>
              </div>

              <div className="space-y-2.5 ml-10">
                {q.options.map((opt) => {
                  const isSelected = selected === opt.level;
                  return (
                    <button
                      key={opt.level}
                      onClick={() => handleAnswer(q.id, opt.level)}
                      className={`w-full text-left rounded-lg p-3.5 border-2 transition-all ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/20 shadow-sm"
                          : "border-th-border bg-th-bg-2 hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-th-bg-3"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Level indicator */}
                        <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-500 text-white"
                            : "border-th-border text-th-text-3"
                        }`}>
                          {isSelected ? <Check className="w-3 h-3" /> : opt.level}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${
                            isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-th-text"
                          }`}>
                            {t(`assessment.${opt.labelKey}`)}
                          </div>
                          <div className="text-xs text-th-text-3 mt-0.5 leading-relaxed">
                            {t(`assessment.${opt.descKey}`)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
            currentStep === 0
              ? "opacity-30 cursor-not-allowed text-th-text-3"
              : "text-th-text-2 bg-th-bg-2 border border-th-border hover:bg-th-bg-3"
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          {t("assessment.prevSection")}
        </button>

        {currentStep < CATEGORIES.length - 1 ? (
          <button
            onClick={goNext}
            disabled={!sectionComplete}
            className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
              sectionComplete
                ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm"
                : "opacity-40 cursor-not-allowed bg-indigo-500/50 text-white/70"
            }`}
          >
            {t("assessment.nextSection")}
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || saving}
            className={`inline-flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold transition ${
              allAnswered && !saving
                ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm"
                : "opacity-40 cursor-not-allowed bg-emerald-500/50 text-white/70"
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("assessment.saving")}
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {t("assessment.seeResults")}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
