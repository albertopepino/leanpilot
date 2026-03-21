// ─── Assessment Data: 12 categories, 53 questions, 5-level Likert scale ──────
// Based on Shingo Model & Toyota Production System

export type NavId =
  | "six-s" | "dashboard" | "hourly" | "andon" | "production"
  | "five-why" | "ishikawa" | "pareto" | "a3"
  | "kaizen" | "vsm" | "smed" | "gemba"
  | "tpm" | "cilt" | "copilot" | "safety" | "kanban";

export interface AnswerOption {
  level: number;
  labelKey: string;
  descKey: string;
}

export interface QuestionDef {
  id: string;
  questionKey: string;
  options: AnswerOption[];
}

export interface CategoryDef {
  id: string;
  titleKey: string;
  descKey: string;
  iconName: string;
  color: string;
  colorDark: string;
  questions: QuestionDef[];
  recommendedTools: { navId: NavId; nameKey: string }[];
  actionKey: string;
}

export interface AssessmentResult {
  answers: Record<string, number>;
  categoryScores: { id: string; titleKey: string; score: number; level: number }[];
  overallScore: number;
  overallLevel: number;
  completedAt: string;
}

export type WizardPhase = "loading" | "results" | "wizard";
export type ResultsTab = "results" | "history" | "actionPlan" | "scoreboard";

// ─── Maturity Level Config (5-level Likert) ─────────────────────────────────
// Level 1: Ad Hoc          - No formal system
// Level 2: Basic/Reactive  - Initial attempts
// Level 3: Standardized    - Formal processes in place
// Level 4: Managed/Proactive - Measured and improved
// Level 5: World Class     - Best-in-class, benchmarked
export const MATURITY_NAMES: Record<number, { nameKey: string; color: string; bg: string; border: string }> = {
  1: { nameKey: "levelAdHoc",        color: "text-red-600 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-950/30",         border: "border-red-200 dark:border-red-800" },
  2: { nameKey: "levelReactive",     color: "text-orange-600 dark:text-orange-400",   bg: "bg-orange-50 dark:bg-orange-950/30",   border: "border-orange-200 dark:border-orange-800" },
  3: { nameKey: "levelStandardized", color: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-950/30",       border: "border-blue-200 dark:border-blue-800" },
  4: { nameKey: "levelManaged",      color: "text-teal-600 dark:text-teal-400",       bg: "bg-teal-50 dark:bg-teal-950/30",       border: "border-teal-200 dark:border-teal-800" },
  5: { nameKey: "levelWorldClass",   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800" },
};

export function scoreToLevel(score: number): number {
  if (score < 1.5) return 1;
  if (score < 2.5) return 2;
  if (score < 3.5) return 3;
  if (score < 4.5) return 4;
  return 5;
}

// Helper to generate 5-level options for a question prefix
function q5(prefix: string): AnswerOption[] {
  return [
    { level: 1, labelKey: `${prefix}L1`, descKey: `${prefix}D1` },
    { level: 2, labelKey: `${prefix}L2`, descKey: `${prefix}D2` },
    { level: 3, labelKey: `${prefix}L3`, descKey: `${prefix}D3` },
    { level: 4, labelKey: `${prefix}L4`, descKey: `${prefix}D4` },
    { level: 5, labelKey: `${prefix}L5`, descKey: `${prefix}D5` },
  ];
}

// ─── 12 Categories, 53 Questions ────────────────────────────────────────────
export const CATEGORIES: CategoryDef[] = [
  // ── 1. Workplace / 5S (5 questions) ──
  {
    id: "workplace", titleKey: "catWorkplace", descKey: "catWorkplaceDesc",
    iconName: "Sparkles", color: "text-amber-600", colorDark: "dark:text-amber-400",
    actionKey: "actionWorkplace",
    questions: [
      { id: "wp1", questionKey: "wp1Q", options: q5("wp1") },
      { id: "wp2", questionKey: "wp2Q", options: q5("wp2") },
      { id: "wp3", questionKey: "wp3Q", options: q5("wp3") },
      { id: "wp4", questionKey: "wp4Q", options: q5("wp4") },
      { id: "wp5", questionKey: "wp5Q", options: q5("wp5") },
    ],
    recommendedTools: [
      { navId: "six-s", nameKey: "toolSixS" },
      { navId: "gemba", nameKey: "toolGemba" },
    ],
  },
  // ── 2. Visual Management (5 questions) ──
  {
    id: "visual", titleKey: "catVisual", descKey: "catVisualDesc",
    iconName: "BarChart3", color: "text-blue-600", colorDark: "dark:text-blue-400",
    actionKey: "actionVisual",
    questions: [
      { id: "vm1", questionKey: "vm1Q", options: q5("vm1") },
      { id: "vm2", questionKey: "vm2Q", options: q5("vm2") },
      { id: "vm3", questionKey: "vm3Q", options: q5("vm3") },
      { id: "vm4", questionKey: "vm4Q", options: q5("vm4") },
      { id: "vm5", questionKey: "vm5Q", options: q5("vm5") },
    ],
    recommendedTools: [
      { navId: "dashboard", nameKey: "toolOee" },
      { navId: "andon", nameKey: "toolAndon" },
      { navId: "hourly", nameKey: "toolHourly" },
    ],
  },
  // ── 3. Standard Work (5 questions) ──
  {
    id: "standard", titleKey: "catStandard", descKey: "catStandardDesc",
    iconName: "FileText", color: "text-violet-600", colorDark: "dark:text-violet-400",
    actionKey: "actionStandard",
    questions: [
      { id: "sw1", questionKey: "sw1Q", options: q5("sw1") },
      { id: "sw2", questionKey: "sw2Q", options: q5("sw2") },
      { id: "sw3", questionKey: "sw3Q", options: q5("sw3") },
      { id: "sw4", questionKey: "sw4Q", options: q5("sw4") },
      { id: "sw5", questionKey: "sw5Q", options: q5("sw5") },
    ],
    recommendedTools: [
      { navId: "production", nameKey: "toolProduction" },
      { navId: "smed", nameKey: "toolSmed" },
    ],
  },
  // ── 4. Continuous Improvement / Kaizen (5 questions) ──
  {
    id: "improvement", titleKey: "catImprovement", descKey: "catImprovementDesc",
    iconName: "Lightbulb", color: "text-emerald-600", colorDark: "dark:text-emerald-400",
    actionKey: "actionImprovement",
    questions: [
      { id: "ci1", questionKey: "ci1Q", options: q5("ci1") },
      { id: "ci2", questionKey: "ci2Q", options: q5("ci2") },
      { id: "ci3", questionKey: "ci3Q", options: q5("ci3") },
      { id: "ci4", questionKey: "ci4Q", options: q5("ci4") },
      { id: "ci5", questionKey: "ci5Q", options: q5("ci5") },
    ],
    recommendedTools: [
      { navId: "kaizen", nameKey: "toolKaizen" },
      { navId: "vsm", nameKey: "toolVsm" },
      { navId: "gemba", nameKey: "toolGemba" },
    ],
  },
  // ── 5. Problem Solving (5 questions) ──
  {
    id: "problem", titleKey: "catProblem", descKey: "catProblemDesc",
    iconName: "Search", color: "text-rose-600", colorDark: "dark:text-rose-400",
    actionKey: "actionProblem",
    questions: [
      { id: "ps1", questionKey: "ps1Q", options: q5("ps1") },
      { id: "ps2", questionKey: "ps2Q", options: q5("ps2") },
      { id: "ps3", questionKey: "ps3Q", options: q5("ps3") },
      { id: "ps4", questionKey: "ps4Q", options: q5("ps4") },
      { id: "ps5", questionKey: "ps5Q", options: q5("ps5") },
    ],
    recommendedTools: [
      { navId: "five-why", nameKey: "toolFiveWhy" },
      { navId: "ishikawa", nameKey: "toolIshikawa" },
      { navId: "pareto", nameKey: "toolPareto" },
      { navId: "a3", nameKey: "toolA3" },
    ],
  },
  // ── 6. TPM / Equipment (5 questions) ──
  {
    id: "tpmEquip", titleKey: "catTPM", descKey: "catTPMDesc",
    iconName: "Settings", color: "text-cyan-600", colorDark: "dark:text-cyan-400",
    actionKey: "actionTPM",
    questions: [
      { id: "tp1", questionKey: "tp1Q", options: q5("tp1") },
      { id: "tp2", questionKey: "tp2Q", options: q5("tp2") },
      { id: "tp3", questionKey: "tp3Q", options: q5("tp3") },
      { id: "tp4", questionKey: "tp4Q", options: q5("tp4") },
      { id: "tp5", questionKey: "tp5Q", options: q5("tp5") },
    ],
    recommendedTools: [
      { navId: "tpm", nameKey: "toolTpm" },
      { navId: "cilt", nameKey: "toolCilt" },
      { navId: "dashboard", nameKey: "toolOee" },
    ],
  },
  // ── 7. Flow & Pull (4 questions) ──
  {
    id: "flow", titleKey: "catFlow", descKey: "catFlowDesc",
    iconName: "ArrowRightLeft", color: "text-purple-600", colorDark: "dark:text-purple-400",
    actionKey: "actionFlow",
    questions: [
      { id: "fl1", questionKey: "fl1Q", options: q5("fl1") },
      { id: "fl2", questionKey: "fl2Q", options: q5("fl2") },
      { id: "fl3", questionKey: "fl3Q", options: q5("fl3") },
      { id: "fl4", questionKey: "fl4Q", options: q5("fl4") },
    ],
    recommendedTools: [
      { navId: "vsm", nameKey: "toolVsm" },
      { navId: "kanban", nameKey: "toolKanban" },
      { navId: "production", nameKey: "toolProduction" },
    ],
  },
  // ── 8. Quality at Source (4 questions) ──
  {
    id: "quality", titleKey: "catQuality", descKey: "catQualityDesc",
    iconName: "Shield", color: "text-indigo-600", colorDark: "dark:text-indigo-400",
    actionKey: "actionQuality",
    questions: [
      { id: "qs1", questionKey: "qs1Q", options: q5("qs1") },
      { id: "qs2", questionKey: "qs2Q", options: q5("qs2") },
      { id: "qs3", questionKey: "qs3Q", options: q5("qs3") },
      { id: "qs4", questionKey: "qs4Q", options: q5("qs4") },
    ],
    recommendedTools: [
      { navId: "pareto", nameKey: "toolPareto" },
      { navId: "ishikawa", nameKey: "toolIshikawa" },
    ],
  },
  // ── 9. Safety Culture (4 questions) ──
  {
    id: "safety", titleKey: "catSafety", descKey: "catSafetyDesc",
    iconName: "ShieldCheck", color: "text-red-600", colorDark: "dark:text-red-400",
    actionKey: "actionSafety",
    questions: [
      { id: "sc1", questionKey: "sc1Q", options: q5("sc1") },
      { id: "sc2", questionKey: "sc2Q", options: q5("sc2") },
      { id: "sc3", questionKey: "sc3Q", options: q5("sc3") },
      { id: "sc4", questionKey: "sc4Q", options: q5("sc4") },
    ],
    recommendedTools: [
      { navId: "safety", nameKey: "toolSafety" },
      { navId: "gemba", nameKey: "toolGemba" },
    ],
  },
  // ── 10. Leadership & People Development (4 questions) ──
  {
    id: "leadership", titleKey: "catLeadership", descKey: "catLeadershipDesc",
    iconName: "Users", color: "text-sky-600", colorDark: "dark:text-sky-400",
    actionKey: "actionLeadership",
    questions: [
      { id: "ld1", questionKey: "ld1Q", options: q5("ld1") },
      { id: "ld2", questionKey: "ld2Q", options: q5("ld2") },
      { id: "ld3", questionKey: "ld3Q", options: q5("ld3") },
      { id: "ld4", questionKey: "ld4Q", options: q5("ld4") },
    ],
    recommendedTools: [
      { navId: "gemba", nameKey: "toolGemba" },
      { navId: "kaizen", nameKey: "toolKaizen" },
    ],
  },
  // ── 11. Supply Chain & Logistics (3 questions) ──
  {
    id: "supply", titleKey: "catSupply", descKey: "catSupplyDesc",
    iconName: "Truck", color: "text-lime-600", colorDark: "dark:text-lime-400",
    actionKey: "actionSupply",
    questions: [
      { id: "sl1", questionKey: "sl1Q", options: q5("sl1") },
      { id: "sl2", questionKey: "sl2Q", options: q5("sl2") },
      { id: "sl3", questionKey: "sl3Q", options: q5("sl3") },
    ],
    recommendedTools: [
      { navId: "kanban", nameKey: "toolKanban" },
      { navId: "vsm", nameKey: "toolVsm" },
    ],
  },
  // ── 12. Digital & Industry 4.0 (3 questions) ──
  {
    id: "digital", titleKey: "catDigital", descKey: "catDigitalDesc",
    iconName: "Cpu", color: "text-pink-600", colorDark: "dark:text-pink-400",
    actionKey: "actionDigital",
    questions: [
      { id: "dg1", questionKey: "dg1Q", options: q5("dg1") },
      { id: "dg2", questionKey: "dg2Q", options: q5("dg2") },
      { id: "dg3", questionKey: "dg3Q", options: q5("dg3") },
    ],
    recommendedTools: [
      { navId: "dashboard", nameKey: "toolOee" },
      { navId: "copilot", nameKey: "toolCopilot" },
    ],
  },
];

export const TOTAL_QUESTIONS = CATEGORIES.reduce((s, c) => s + c.questions.length, 0);

// Map category iconNames to lucide icon indices (used by components)
export const CATEGORY_ICON_NAMES = CATEGORIES.map((c) => c.iconName);
