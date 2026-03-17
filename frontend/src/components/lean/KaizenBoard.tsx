"use client";
import { useState, useEffect, useCallback, useRef, type DragEvent } from "react";
import { useI18n } from "@/stores/useI18n";
import { useCurrency } from "@/stores/useCurrency";
import { leanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import LinkedItemBadge from "@/components/ui/LinkedItemBadge";
import CreateLinkedAction from "@/components/ui/CreateLinkedAction";
import { useLinkedItems } from "@/hooks/useLinkedItems";
import { viewToRoute } from "@/lib/routes";
import { Lightbulb, ClipboardList, Wrench, CheckCircle, Trophy, Sparkles, Zap, ShieldCheck, Coins, XCircle, type LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type KaizenStatus =
  | "idea"
  | "planned"
  | "in_progress"
  | "completed"
  | "verified"
  | "rejected";

type Priority = "critical" | "high" | "medium" | "low";
type Category = "quality" | "productivity" | "safety" | "cost";

interface KaizenItem {
  id: number;
  title: string;
  description?: string;
  status: KaizenStatus;
  priority: Priority;
  category: Category;
  area?: string;
  owner?: string;
  expected_savings_eur?: number;
  actual_savings_eur?: number;
  expected_impact?: string;
  target_date?: string;
  created_at?: string;
  before_photo_url?: string;
  after_photo_url?: string;
  effort_level?: string;
  impact_level?: string;
  is_blitz?: boolean;
  standardized?: boolean;
  source_type?: string;
}

type BoardViewMode = "kanban" | "matrix";

interface KaizenSavings {
  total_expected: number;
  total_actual: number;
  completed_count?: number;
  by_category: Record<string, { expected: number; actual: number }>;
}

interface ColumnDef {
  key: KaizenStatus;
  labelKey: string;
  color: string;
  borderColor: string;
  emptyKey: string;
  dotColor: string;
  glowBorder: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COLUMNS: ColumnDef[] = [
  {
    key: "idea",
    labelKey: "statusIdeas",
    color: "bg-th-bg-3",
    borderColor: "border-slate-300 dark:border-slate-600",
    emptyKey: "emptyIdea",
    dotColor: "bg-slate-400",
    glowBorder: "border-l-slate-400",
  },
  {
    key: "planned",
    labelKey: "statusPlanned",
    color: "bg-blue-50/50 dark:bg-blue-950/20",
    borderColor: "border-blue-300 dark:border-blue-700",
    emptyKey: "emptyPlanned",
    dotColor: "bg-blue-500",
    glowBorder: "border-l-blue-500",
  },
  {
    key: "in_progress",
    labelKey: "statusInProgress",
    color: "bg-amber-50/50 dark:bg-amber-950/20",
    borderColor: "border-amber-300 dark:border-amber-700",
    emptyKey: "emptyInProgress",
    dotColor: "bg-amber-500",
    glowBorder: "border-l-amber-500",
  },
  {
    key: "completed",
    labelKey: "statusCompleted",
    color: "bg-emerald-50/50 dark:bg-emerald-950/20",
    borderColor: "border-emerald-300 dark:border-emerald-700",
    emptyKey: "emptyCompleted",
    dotColor: "bg-emerald-500",
    glowBorder: "border-l-emerald-500",
  },
  {
    key: "verified",
    labelKey: "statusVerified",
    color: "bg-green-50/50 dark:bg-green-950/20",
    borderColor: "border-green-300 dark:border-green-700",
    emptyKey: "emptyVerified",
    dotColor: "bg-green-600",
    glowBorder: "border-l-green-600",
  },
  {
    key: "rejected",
    labelKey: "statusRejected",
    color: "bg-red-50/50 dark:bg-red-950/20",
    borderColor: "border-red-300 dark:border-red-700",
    emptyKey: "emptyRejected",
    dotColor: "bg-red-500",
    glowBorder: "border-l-red-500",
  },
];

const STATUS_FLOW: Record<KaizenStatus, KaizenStatus[]> = {
  idea: ["planned", "rejected"],
  planned: ["in_progress", "rejected"],
  in_progress: ["completed", "rejected"],
  completed: ["verified", "rejected"],
  verified: [],
  rejected: ["idea"],
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  planned: "moveToPlanned",
  in_progress: "moveToInProgress",
  completed: "moveToCompleted",
  verified: "moveToVerified",
  rejected: "moveToRejected",
  idea: "statusIdeas",
};

const CATEGORIES: Category[] = ["quality", "productivity", "safety", "cost"];
const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

const PRIORITY_STYLES: Record<Priority, { badge: string; dot: string; glow: string }> = {
  critical: {
    badge: "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20",
    dot: "bg-red-500",
    glow: "shadow-[0_0_8px_rgba(239,68,68,0.4)]",
  },
  high: {
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
    dot: "bg-amber-500",
    glow: "",
  },
  medium: {
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
    dot: "bg-blue-500",
    glow: "",
  },
  low: {
    badge: "bg-slate-500/10 text-th-text-2 border border-slate-500/20",
    dot: "bg-slate-400",
    glow: "",
  },
};

const CATEGORY_STYLES: Record<Category, { icon: LucideIcon; color: string }> = {
  quality: { icon: Sparkles, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" },
  productivity: { icon: Zap, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  safety: { icon: ShieldCheck, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  cost: { icon: Coins, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
};

const COLUMN_ICONS: Record<KaizenStatus, LucideIcon> = {
  idea: Lightbulb,
  planned: ClipboardList,
  in_progress: Wrench,
  completed: CheckCircle,
  verified: Trophy,
  rejected: XCircle,
};

/* ------------------------------------------------------------------ */
/*  Empty defaults                                                     */
/* ------------------------------------------------------------------ */

const EMPTY_SAVINGS: KaizenSavings = {
  total_expected: 0,
  total_actual: 0,
  completed_count: 0,
  by_category: {
    productivity: { expected: 0, actual: 0 },
    quality: { expected: 0, actual: 0 },
    cost: { expected: 0, actual: 0 },
    safety: { expected: 0, actual: 0 },
  },
};

/* ------------------------------------------------------------------ */
/*  Priority badge                                                     */
/* ------------------------------------------------------------------ */

function PriorityBadge({
  priority,
  t,
}: {
  priority: Priority;
  t: (k: string) => string;
}) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${style.badge} ${priority === "critical" ? "animate-pulse-slow" : ""}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${priority === "critical" ? style.glow : ""}`} />
      {t(
        `improvement.priority${
          priority.charAt(0).toUpperCase() + priority.slice(1)
        }`
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Category badge                                                     */
/* ------------------------------------------------------------------ */

function CategoryBadge({
  category,
  t,
}: {
  category: string;
  t: (k: string) => string;
}) {
  const style = CATEGORY_STYLES[category as Category] ?? { icon: Sparkles, color: "bg-th-bg-3 text-th-text-2 border border-th-border" };
  const CatIcon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${style.color}`}>
      {typeof CatIcon !== "string" && <CatIcon size={10} />}
      {t(
        `improvement.cat${
          category.charAt(0).toUpperCase() + category.slice(1)
        }`
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function BoardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Savings bar skeleton */}
      <div className="bg-th-bg-2 rounded-xl border border-th-border p-4 space-y-3">
        <div className="flex justify-between">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="flex gap-4">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full" />
      </div>

      {/* Column skeletons */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-3 min-h-[280px] bg-th-bg-3 space-y-3 border border-th-border"
          >
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
            {Array.from({ length: 2 - (i % 2) }).map((_, j) => (
              <div
                key={j}
                className="bg-th-bg-2 rounded-lg p-3 space-y-2 border border-th-border"
              >
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="flex gap-2">
                  <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Savings summary bar                                                */
/* ------------------------------------------------------------------ */

function SavingsBar({
  savings,
  completedCount,
  t,
  sym,
}: {
  savings: KaizenSavings;
  completedCount: number;
  t: (k: string) => string;
  sym: string;
}) {
  const pct =
    savings.total_expected > 0
      ? Math.min(
          100,
          Math.round((savings.total_actual / savings.total_expected) * 100)
        )
      : 0;

  return (
    <div className="bg-th-bg-2 backdrop-blur-sm rounded-xl border border-th-border p-5 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="font-semibold text-sm text-th-text uppercase tracking-wider">
          {t("improvement.savingsTracker")}
        </h3>
        <div className="flex flex-wrap gap-5 text-sm">
          <span className="text-th-text-3">
            {t("improvement.estimated")}:{" "}
            <span className="font-bold text-th-text text-lg">
              {sym}{savings.total_expected.toLocaleString()}
            </span>
          </span>
          <span className="text-th-text-3">
            {t("improvement.actual")}:{" "}
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">
              {sym}{savings.total_actual.toLocaleString()}
            </span>
          </span>
          <span className="text-th-text-3">
            {t("improvement.completedCount")}:{" "}
            <span className="font-bold text-th-text text-lg">{completedCount}</span>
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative w-full bg-th-input rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-700 ${pct > 70 ? "shadow-[0_0_12px_rgba(16,185,129,0.4)]" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-th-text-3 mt-1.5 text-right font-medium">
        {pct}% {t("improvement.realized")}
      </p>

      {/* Category breakdown */}
      {Object.keys(savings.by_category).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {Object.entries(savings.by_category).map(([cat, v]) => {
            const catPct = v.expected > 0 ? Math.round((v.actual / v.expected) * 100) : 0;
            return (
              <div
                key={cat}
                className="bg-th-bg-3 rounded-xl p-3 text-center border border-th-border hover:shadow-md transition-shadow"
              >
                <p className="text-xs text-th-text-3 truncate font-medium uppercase tracking-wider">
                  {t(
                    `improvement.cat${
                      cat.charAt(0).toUpperCase() + cat.slice(1)
                    }`
                  )}
                </p>
                <p className="text-lg font-bold text-th-text mt-1">
                  {sym}{v.actual.toLocaleString()}
                </p>
                <div className="w-full bg-th-input rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, catPct)}%` }}
                  />
                </div>
                <p className="text-[10px] text-th-text-3 mt-1">
                  / {sym}{v.expected.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Kaizen modal                                                */
/* ------------------------------------------------------------------ */

interface CreateFormData {
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  expected_impact: string;
  expected_savings_eur: string;
  target_date: string;
  owner: string;
  area: string;
  before_photo_url: string;
  after_photo_url: string;
  effort_level: string;
  impact_level: string;
  is_blitz: boolean;
}

const EMPTY_FORM: CreateFormData = {
  title: "",
  description: "",
  category: "quality",
  priority: "medium",
  expected_impact: "",
  expected_savings_eur: "",
  target_date: "",
  owner: "",
  area: "",
  before_photo_url: "",
  after_photo_url: "",
  effort_level: "",
  impact_level: "",
  is_blitz: false,
};

function CreateKaizenModal({
  onClose,
  onSubmit,
  t,
  submitting,
  sym,
}: {
  onClose: () => void;
  onSubmit: (data: CreateFormData) => void;
  t: (k: string) => string;
  submitting: boolean;
  sym: string;
}) {
  const [form, setForm] = useState<CreateFormData>({ ...EMPTY_FORM });
  const set = (field: Exclude<keyof CreateFormData, "is_blitz">, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSubmit(form);
  };

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg-2 text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-colors";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("improvement.newKaizen")}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-th-bg rounded-t-xl md:rounded-xl shadow-xl border border-th-border w-full md:max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-th-border rounded-full mx-auto mb-3 md:hidden" />
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold text-th-text">
            {t("improvement.newKaizen")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-th-text-3 hover:text-th-text text-xl leading-none p-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg hover:bg-th-bg-3 transition"
          >
            &times;
          </button>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="kaizen-title" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
            {t("improvement.title")} *
          </label>
          <input
            id="kaizen-title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className={inputCls}
            required
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="kaizen-description" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
            {t("improvement.description")}
          </label>
          <textarea
            id="kaizen-description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Category */}
          <div>
            <label htmlFor="kaizen-category" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
              {t("improvement.category")}
            </label>
            <select
              id="kaizen-category"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className={inputCls}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(
                    `improvement.cat${
                      c.charAt(0).toUpperCase() + c.slice(1)
                    }`
                  )}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="kaizen-priority" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
              {t("improvement.priority")}
            </label>
            <select
              id="kaizen-priority"
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
              className={inputCls}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(
                    `improvement.priority${
                      p.charAt(0).toUpperCase() + p.slice(1)
                    }`
                  )}
                </option>
              ))}
            </select>
          </div>

          {/* Expected impact */}
          <div>
            <label htmlFor="kaizen-impact" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
              {t("improvement.expectedImpact")}
            </label>
            <select
              id="kaizen-impact"
              value={form.expected_impact}
              onChange={(e) => set("expected_impact", e.target.value)}
              className={inputCls}
            >
              <option value="">{"\u2014"}</option>
              <option value="high">{t("improvement.impactHigh")}</option>
              <option value="medium">{t("improvement.impactMedium")}</option>
              <option value="low">{t("improvement.impactLow")}</option>
            </select>
          </div>

          {/* Expected savings */}
          <div>
            <label htmlFor="kaizen-savings" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
              {t("improvement.expectedSavings")} ({sym})
            </label>
            <input
              id="kaizen-savings"
              type="number"
              inputMode="decimal"
              min={0}
              value={form.expected_savings_eur}
              onChange={(e) => set("expected_savings_eur", e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Target date */}
          <div>
            <label htmlFor="kaizen-target-date" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
              {t("improvement.targetDate")}
            </label>
            <input
              id="kaizen-target-date"
              type="date"
              value={form.target_date}
              onChange={(e) => set("target_date", e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Area */}
          <div>
            <label htmlFor="kaizen-area" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
              {t("improvement.area")}
            </label>
            <input
              id="kaizen-area"
              value={form.area}
              onChange={(e) => set("area", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Owner */}
        <div>
          <label htmlFor="kaizen-owner" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
            {t("improvement.owner")}
          </label>
          <input
            id="kaizen-owner"
            value={form.owner}
            onChange={(e) => set("owner", e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Effort / Impact / Blitz */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="kaizen-effort" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
              {t("improvement.effortLevel") || "Effort Level"}
            </label>
            <select
              id="kaizen-effort"
              value={form.effort_level}
              onChange={(e) => set("effort_level", e.target.value)}
              className={inputCls}
            >
              <option value="">{"\u2014"}</option>
              <option value="low">{t("improvement.effortLow") || "Low"}</option>
              <option value="medium">{t("improvement.effortMedium") || "Medium"}</option>
              <option value="high">{t("improvement.effortHigh") || "High"}</option>
            </select>
          </div>
          <div>
            <label htmlFor="kaizen-impact-level" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
              {t("improvement.impactLevel") || "Impact Level"}
            </label>
            <select
              id="kaizen-impact-level"
              value={form.impact_level}
              onChange={(e) => set("impact_level", e.target.value)}
              className={inputCls}
            >
              <option value="">{"\u2014"}</option>
              <option value="low">{t("improvement.impactLow") || "Low"}</option>
              <option value="medium">{t("improvement.impactMedium") || "Medium"}</option>
              <option value="high">{t("improvement.impactHigh") || "High"}</option>
            </select>
          </div>
        </div>

        {/* Blitz checkbox */}
        <label htmlFor="kaizen-blitz" className="flex items-center gap-2 cursor-pointer">
          <input
            id="kaizen-blitz"
            type="checkbox"
            checked={form.is_blitz}
            onChange={(e) => setForm((prev) => ({ ...prev, is_blitz: e.target.checked }))}
            className="w-4 h-4 rounded border-th-border text-brand-500 focus:ring-brand-500/50"
          />
          <span className="text-sm text-th-text font-medium">
            {t("improvement.isBlitz") || "Kaizen Blitz (rapid event)"}
          </span>
        </label>

        {/* Before/After photo URLs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="kaizen-before-photo" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
              {t("improvement.beforePhoto") || "Before Photo URL"}
            </label>
            <input
              id="kaizen-before-photo"
              type="url"
              placeholder="https://..."
              value={form.before_photo_url}
              onChange={(e) => set("before_photo_url", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="kaizen-after-photo" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
              {t("improvement.afterPhoto") || "After Photo URL"}
            </label>
            <input
              id="kaizen-after-photo"
              type="url"
              placeholder="https://..."
              value={form.after_photo_url}
              onChange={(e) => set("after_photo_url", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-3 border-t border-th-border/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-th-bg-3 text-th-text text-sm hover:bg-th-bg-2 transition"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting || !form.title.trim()}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-semibold hover:from-brand-600 hover:to-brand-700 transition-all disabled:opacity-50 shadow-lg shadow-brand-500/20"
          >
            {submitting ? t("common.saving") : t("common.create")}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Linked-items row (reused across modals)                            */
/* ------------------------------------------------------------------ */

function LinkedItemsRow({ module, itemId, t }: { module: string; itemId: number; t: (k: string) => string }) {
  const { linkedItems } = useLinkedItems(module, itemId);
  if (linkedItems.length === 0) return null;

  const moduleLabel = (m: string) =>
    m.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex flex-wrap gap-1.5">
      {linkedItems.map((link, i) => {
        const isSource = link.sourceModule === module && link.sourceId === itemId;
        const otherModule = isSource ? link.targetModule : link.sourceModule;
        const otherId = isSource ? link.targetId : link.sourceId;
        return (
          <LinkedItemBadge
            key={i}
            moduleType={otherModule}
            moduleId={otherId}
            label={moduleLabel(otherModule)}
            href={viewToRoute(otherModule)}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card detail / status update modal                                  */
/* ------------------------------------------------------------------ */

function CardDetailModal({
  item,
  onClose,
  onStatusChange,
  onMarkStandardized,
  t,
  updating,
  sym,
}: {
  item: KaizenItem;
  onClose: () => void;
  onStatusChange: (
    id: number,
    newStatus: KaizenStatus,
    savings?: number
  ) => void;
  onMarkStandardized?: (id: number) => void;
  t: (k: string) => string;
  updating: boolean;
  sym: string;
}) {
  const [confirmTarget, setConfirmTarget] = useState<KaizenStatus | null>(null);
  const [actualSavings, setActualSavings] = useState("");
  const [editingSavings, setEditingSavings] = useState(false);
  const [editSavingsValue, setEditSavingsValue] = useState(
    String(item.actual_savings_eur ?? "")
  );
  const nextStatuses = STATUS_FLOW[item.status] ?? [];
  const needsSavings = confirmTarget === "completed";
  const needsStandardize = (confirmTarget === "completed" || confirmTarget === "verified") && !item.standardized;

  const handleSavingsUpdate = () => {
    const val = editSavingsValue !== "" ? Number(editSavingsValue) : undefined;
    if (val != null && !isNaN(val)) {
      onStatusChange(item.id, item.status, val);
    }
    setEditingSavings(false);
  };

  const handleConfirm = () => {
    if (!confirmTarget) return;
    const savings = needsSavings && actualSavings ? Number(actualSavings) : undefined;
    onStatusChange(item.id, confirmTarget, savings);
  };

  const col = COLUMNS.find((c) => c.key === item.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className={`bg-th-bg rounded-t-xl md:rounded-xl shadow-xl border-l-4 ${col?.glowBorder ?? "border-l-slate-400"} border border-th-border w-full md:max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-th-border rounded-full mx-auto mb-3 md:hidden" />
        {/* Header */}
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold text-th-text">{item.title}</h3>
          <button
            onClick={onClose}
            className="text-th-text-3 hover:text-th-text text-xl leading-none p-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg hover:bg-th-bg-3 transition"
          >
            &times;
          </button>
        </div>

        {/* Description */}
        {item.description && (
          <p className="text-sm text-th-text-2 bg-th-bg-3 rounded-lg p-3 border border-th-border">{item.description}</p>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-th-text-3 text-xs uppercase tracking-wider font-medium">{t("improvement.category")}</span>
            <div className="mt-1">
              <CategoryBadge category={item.category} t={t} />
            </div>
          </div>
          <div>
            <span className="text-th-text-3 text-xs uppercase tracking-wider font-medium">{t("improvement.priority")}</span>
            <div className="mt-1">
              <PriorityBadge priority={item.priority} t={t} />
            </div>
          </div>
          <div>
            <span className="text-th-text-3 text-xs uppercase tracking-wider font-medium">{t("improvement.owner")}</span>
            <div className="mt-1 text-th-text font-semibold">
              {item.owner ?? "\u2014"}
            </div>
          </div>
          <div>
            <span className="text-th-text-3 text-xs uppercase tracking-wider font-medium">{t("improvement.area")}</span>
            <div className="mt-1 text-th-text font-semibold">
              {item.area ?? "\u2014"}
            </div>
          </div>
          {item.target_date && (
            <div>
              <span className="text-th-text-3 text-xs uppercase tracking-wider font-medium">
                {t("improvement.targetDate")}
              </span>
              <div className="mt-1 text-th-text font-semibold">
                {item.target_date}
              </div>
            </div>
          )}
          {item.created_at && (
            <div>
              <span className="text-th-text-3 text-xs uppercase tracking-wider font-medium">
                {t("improvement.createdAt")}
              </span>
              <div className="mt-1 text-th-text font-semibold">
                {new Date(item.created_at).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>

        {/* Savings */}
        <div className="border-t border-th-border/50 pt-4 space-y-2">
          {item.expected_savings_eur != null && (
            <div className="flex items-center justify-between bg-th-bg-3 rounded-lg px-4 py-2 border border-th-border">
              <span className="text-sm text-th-text-3">{t("improvement.estimated")}</span>
              <span className="text-lg font-bold text-th-text">
                {sym}{item.expected_savings_eur.toLocaleString()}
              </span>
            </div>
          )}
          {item.actual_savings_eur != null && !editingSavings && (
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/5 rounded-lg px-4 py-2 border border-emerald-200/50 dark:border-emerald-500/10">
              <span className="text-sm text-emerald-700 dark:text-emerald-400">{t("improvement.actual")}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {sym}{item.actual_savings_eur.toLocaleString()}
                </span>
                {(item.status === "completed" || item.status === "verified") && (
                  <button
                    onClick={() => {
                      setEditSavingsValue(String(item.actual_savings_eur ?? ""));
                      setEditingSavings(true);
                    }}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 px-1.5 py-0.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition"
                    title={t("common.edit") || "Edit"}
                    aria-label={t("common.edit") || "Edit savings"}
                  >
                    <span aria-hidden="true">&#9998;</span>
                  </button>
                )}
              </div>
            </div>
          )}
          {editingSavings && (
            <div className="bg-emerald-50 dark:bg-emerald-500/5 rounded-lg px-4 py-3 border border-emerald-200/50 dark:border-emerald-500/10 space-y-2">
              <label htmlFor="kaizen-actual-savings" className="block text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                {t("improvement.actual")}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 text-sm">{sym}</span>
                <input
                  id="kaizen-actual-savings"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={editSavingsValue}
                  onChange={(e) => setEditSavingsValue(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-th-border bg-th-bg-2 text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingSavings(false)}
                  className="px-3 py-1.5 rounded-lg bg-th-bg-3 text-th-text text-xs hover:bg-th-bg-2 transition"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleSavingsUpdate}
                  disabled={updating}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition disabled:opacity-50"
                >
                  {updating ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          )}
          {item.actual_savings_eur == null && (item.status === "completed" || item.status === "verified") && !editingSavings && (
            <button
              onClick={() => {
                setEditSavingsValue("");
                setEditingSavings(true);
              }}
              className="w-full text-left bg-emerald-50/50 dark:bg-emerald-500/5 rounded-lg px-4 py-2 border border-dashed border-emerald-300 dark:border-emerald-700 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition"
            >
              + {t("improvement.addActualSavings") || "Add actual savings"}
            </button>
          )}
        </div>

        {/* Status change section */}
        {nextStatuses.length > 0 && !confirmTarget && (
          <div className="border-t border-th-border/50 pt-4">
            <p className="text-xs font-medium text-th-text-3 mb-3 uppercase tracking-wider">
              {t("improvement.updateStatus")}
            </p>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((ns) => (
                <button
                  key={ns}
                  onClick={() => setConfirmTarget(ns)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    ns === "rejected"
                      ? "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20"
                      : "bg-brand-500/10 text-brand-700 dark:text-brand-400 border border-brand-500/20 hover:bg-brand-500/20"
                  }`}
                >
                  {t(`improvement.${NEXT_STATUS_LABEL[ns] ?? ns}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Confirmation */}
        {confirmTarget && (
          <div className="border-t border-th-border/50 pt-4 space-y-3">
            <p className="text-sm text-th-text">
              {t("improvement.confirmMoveDesc")}{" "}
              <span className="font-bold">
                {t(
                  `improvement.${
                    COLUMNS.find((c) => c.key === confirmTarget)?.labelKey ?? confirmTarget
                  }`
                )}
              </span>
              ?
            </p>

            {/* Savings prompt when completing */}
            {needsSavings && (
              <div>
                <label htmlFor="kaizen-savings-prompt" className="block text-xs font-medium text-th-text-3 mb-1.5 uppercase tracking-wider">
                  {t("improvement.savingsPrompt")}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-th-text-2 text-sm">{sym}</span>
                  <input
                    id="kaizen-savings-prompt"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={actualSavings}
                    onChange={(e) => setActualSavings(e.target.value)}
                    placeholder={
                      item.expected_savings_eur?.toLocaleString() ?? "0"
                    }
                    className="flex-1 px-3 py-2 rounded-lg border border-th-border bg-th-bg-2 text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-colors"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Standardize warning */}
            {needsStandardize && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-700 rounded-lg p-3 space-y-2">
                <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                  {t("improvement.standardizeWarning") || "This kaizen has not been standardized. Please mark it as standardized before closing."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onMarkStandardized?.(item.id);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition"
                >
                  {t("improvement.markStandardized") || "Mark as Standardized"}
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setConfirmTarget(null);
                  setActualSavings("");
                }}
                className="px-4 py-2 rounded-lg bg-th-bg-3 text-th-text text-sm hover:bg-th-bg-2 transition"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleConfirm}
                disabled={updating || needsStandardize}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-semibold hover:from-brand-600 hover:to-brand-700 transition-all disabled:opacity-50 shadow"
              >
                {updating ? t("common.saving") : t("improvement.confirmMove")}
              </button>
            </div>
          </div>
        )}

        {/* Cross-module links */}
        {!confirmTarget && (
          <div className="border-t border-th-border/50 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-th-text-3 uppercase tracking-wider">
                {t("crossModule.linkedItems") || "Linked items"}
              </p>
              <CreateLinkedAction sourceModule="kaizen" sourceId={item.id} sourceLabel={item.title} />
            </div>
            <LinkedItemsRow module="kaizen" itemId={item.id} t={t} />
          </div>
        )}

        {/* Close */}
        {!confirmTarget && (
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-th-bg-3 text-th-text text-sm hover:bg-th-bg-2 transition"
            >
              {t("common.close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function KaizenBoard() {
  const { t } = useI18n();
  const sym = useCurrency((s) => s.currency.symbol);
  const { printView, exportToExcel } = useExport();

  const [items, setItems] = useState<KaizenItem[]>([]);
  const [savings, setSavings] = useState<KaizenSavings>(EMPTY_SAVINGS);
  const [loading, setLoading] = useState(true);
  const isDemo = false; // demo fallbacks removed — kept for guard clauses
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KaizenItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<Category | "">("");
  const [filterPriority, setFilterPriority] = useState<Priority | "">("");
  const [viewMode, setViewMode] = useState<BoardViewMode>("kanban");

  // Drag state
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<KaizenStatus | null>(null);
  const dragCounter = useRef<Record<string, number>>({});

  /* ---- Data fetching ---- */

  const fetchBoard = useCallback(async () => {
    try {
      const res = await leanApi.getKaizenBoard();
      const data = res.data;
      let parsed: KaizenItem[] = [];
      if (Array.isArray(data) && data.length > 0) {
        parsed = data;
      } else if (
        data?.items &&
        Array.isArray(data.items) &&
        data.items.length > 0
      ) {
        parsed = data.items;
      } else if (data && typeof data === "object" && !Array.isArray(data)) {
        for (const key of Object.keys(data)) {
          const arr = data[key];
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item && typeof item === "object" && item.id) {
                parsed.push({ ...item, status: item.status ?? key });
              }
            }
          }
        }
      }
      setItems(parsed);
    } catch {
      setItems([]);
    }
  }, [t]);

  const fetchSavings = useCallback(async () => {
    try {
      const res = await leanApi.getKaizenSavings();
      const d = res.data;
      if (d && (typeof d.total_expected === "number" || typeof d.expected_savings_eur === "number")) {
        setSavings({
          total_expected: d.total_expected ?? d.expected_savings_eur ?? 0,
          total_actual: d.total_actual ?? d.actual_savings_eur ?? 0,
          completed_count: d.completed_count ?? 0,
          by_category: d.by_category ?? {},
        });
      }
    } catch {
      /* keep demo savings */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchBoard(), fetchSavings()]);
  }, [fetchBoard, fetchSavings]);

  useEffect(() => {
    refreshAll().finally(() => setLoading(false));
  }, [refreshAll]);

  /* ---- Create ---- */

  const handleCreate = async (form: CreateFormData) => {
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        area: form.area.trim() || undefined,
        category: form.category,
        priority: form.priority,
        expected_savings_eur: form.expected_savings_eur
          ? Number(form.expected_savings_eur)
          : undefined,
        expected_impact: form.expected_impact || undefined,
        target_date: form.target_date || undefined,
        owner: form.owner.trim() || undefined,
        before_photo_url: form.before_photo_url.trim() || undefined,
        after_photo_url: form.after_photo_url.trim() || undefined,
        effort_level: form.effort_level || undefined,
        impact_level: form.impact_level || undefined,
        is_blitz: form.is_blitz || undefined,
      };
      const res = await leanApi.createKaizen(payload);
      const created: KaizenItem = res.data ?? {
        ...payload,
        id: Date.now(),
        status: "idea" as KaizenStatus,
      };
      setItems((prev) => [...prev, created]);
      setShowForm(false);
      fetchSavings();
    } catch {
      const local: KaizenItem = {
        id: Date.now(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        area: form.area.trim() || undefined,
        category: form.category as Category,
        priority: form.priority as Priority,
        expected_savings_eur: form.expected_savings_eur
          ? Number(form.expected_savings_eur)
          : undefined,
        owner: form.owner.trim() || undefined,
        status: "idea",
        created_at: new Date().toISOString(),
      };
      setItems((prev) => [...prev, local]);
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- Status change ---- */

  const handleStatusChange = async (
    id: number,
    newStatus: KaizenStatus,
    actualSavingsVal?: number
  ) => {
    setUpdating(true);
    const item = items.find((i) => i.id === id);
    if (!item) {
      setUpdating(false);
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: newStatus,
              actual_savings_eur:
                actualSavingsVal != null
                  ? actualSavingsVal
                  : i.actual_savings_eur,
            }
          : i
      )
    );
    setSelectedItem(null);

    if (isDemo) {
      setUpdating(false);
      return;
    }

    try {
      const res = await leanApi.updateKaizenStatus(id, newStatus, actualSavingsVal);
      // Sync savings fields from server response into local state
      const serverData = res.data;
      if (serverData) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === id
              ? {
                  ...i,
                  actual_savings_eur: serverData.actual_savings_eur ?? i.actual_savings_eur,
                  expected_savings_eur: serverData.expected_savings_eur ?? i.expected_savings_eur,
                }
              : i
          )
        );
      }
      await fetchSavings();
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: item.status } : i))
      );
    } finally {
      setUpdating(false);
    }
  };

  /* ---- Drag & drop ---- */

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: number) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    setDraggedId(null);
    setDragOverCol(null);
    dragCounter.current = {};
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  };

  const handleDragEnter = (
    e: DragEvent<HTMLDivElement>,
    colKey: KaizenStatus
  ) => {
    e.preventDefault();
    dragCounter.current[colKey] = (dragCounter.current[colKey] || 0) + 1;
    setDragOverCol(colKey);
  };

  const handleDragLeave = (
    _e: DragEvent<HTMLDivElement>,
    colKey: KaizenStatus
  ) => {
    dragCounter.current[colKey] = (dragCounter.current[colKey] || 0) - 1;
    if (dragCounter.current[colKey] <= 0) {
      dragCounter.current[colKey] = 0;
      if (dragOverCol === colKey) setDragOverCol(null);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (
    e: DragEvent<HTMLDivElement>,
    targetStatus: KaizenStatus
  ) => {
    e.preventDefault();
    setDragOverCol(null);
    dragCounter.current = {};

    const id = Number(e.dataTransfer.getData("text/plain"));
    if (!id) return;

    const item = items.find((i) => i.id === id);
    if (!item || item.status === targetStatus) return;

    if (targetStatus === "completed") {
      setSelectedItem(item);
      return;
    }

    await handleStatusChange(id, targetStatus);
  };

  /* ---- Mark as standardized ---- */

  const handleMarkStandardized = (id: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, standardized: true } : i))
    );
    // Also update selectedItem so the modal re-renders
    setSelectedItem((prev) => prev && prev.id === id ? { ...prev, standardized: true } : prev);
  };

  /* ---- Derived / filtered ---- */

  const filteredItems = items.filter((i) => {
    if (filterCategory && i.category !== filterCategory) return false;
    if (filterPriority && i.priority !== filterPriority) return false;
    return true;
  });

  const completedCount = items.filter(
    (i) => i.status === "completed" || i.status === "verified"
  ).length;

  /* ---- Render ---- */

  if (loading) {
    return <BoardSkeleton />;
  }

  const selectCls =
    "px-3 py-1.5 rounded-lg border border-th-border bg-th-bg-2 text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-colors";

  return (
    <div className="space-y-5" data-print-area="true" role="region" aria-label="Kaizen Board">
      {/* ---- Empty state message ---- */}
      {!loading && items.length === 0 && (
        <div className="px-4 py-6 bg-th-bg-2 border border-th-border rounded-xl text-center text-sm text-th-text-2">
          {t("improvement.noKaizenYet") || "No data yet. Start by creating your first Kaizen improvement."}
        </div>
      )}

      {/* ---- Kaizen Funnel ---- */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 p-5 shadow-card">
        <h3 className="text-sm font-bold text-th-text mb-3">{t("improvement.kaizenFunnel") || "Kaizen Funnel"}</h3>
        <div className="flex items-end gap-1 h-20">
          {COLUMNS.map((col) => {
            const count = filteredItems.filter((i) => i.status === col.key).length;
            const maxCount = Math.max(1, ...COLUMNS.map((c) => filteredItems.filter((i) => i.status === c.key).length));
            const heightPct = Math.max(8, (count / maxCount) * 100);
            return (
              <div key={col.key} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-th-text tabular-nums">{count}</span>
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: col.color,
                    opacity: 0.85,
                  }}
                />
                <span className="text-[9px] text-th-text-3 font-medium truncate w-full text-center">
                  {t(`improvement.${col.labelKey}`)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-th-border">
          <span className="text-xs text-th-text-2">
            {t("improvement.totalItems") || "Total"}: <span className="font-bold text-th-text">{filteredItems.length}</span>
          </span>
          <span className="text-xs text-th-text-2">
            {t("improvement.completionRate") || "Completed"}: <span className="font-bold text-emerald-500">
              {filteredItems.length > 0 ? ((filteredItems.filter((i) => i.status === "completed" || i.status === "verified").length / filteredItems.length) * 100).toFixed(0) : 0}%
            </span>
          </span>
        </div>
      </div>

      {/* ---- Header bar ---- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as Category | "")}
            className={selectCls}
          >
            <option value="">{t("improvement.allCategories")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(
                  `improvement.cat${
                    c.charAt(0).toUpperCase() + c.slice(1)
                  }`
                )}
              </option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as Priority | "")}
            className={selectCls}
          >
            <option value="">{t("improvement.allPriorities")}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(
                  `improvement.priority${
                    p.charAt(0).toUpperCase() + p.slice(1)
                  }`
                )}
              </option>
            ))}
          </select>

          {/* Quick stats */}
          <div className="bg-th-bg-2 px-4 py-2 rounded-lg border border-th-border text-sm backdrop-blur-sm">
            <span className="text-th-text-3">
              {t("improvement.totalIdeas")}:
            </span>{" "}
            <span className="font-bold text-th-text text-lg">{items.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-th-border overflow-hidden">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "kanban"
                  ? "bg-brand-500 text-white"
                  : "bg-th-bg-2 text-th-text-2 hover:bg-th-bg-3"
              }`}
            >
              {t("improvement.boardView") || "Board"}
            </button>
            <button
              onClick={() => setViewMode("matrix")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "matrix"
                  ? "bg-brand-500 text-white"
                  : "bg-th-bg-2 text-th-text-2 hover:bg-th-bg-3"
              }`}
            >
              {t("improvement.matrixView") || "Matrix"}
            </button>
          </div>
          <ExportToolbar
            onPrint={() => printView(t("common.titleKaizen"))}
            onExportExcel={() =>
              exportToExcel({
                title: t("common.titleKaizen"),
                columns: [
                  t("improvement.title") || "Title",
                  t("improvement.status") || "Status",
                  t("improvement.priority") || "Priority",
                  t("improvement.category") || "Category",
                  t("improvement.responsible") || "Responsible",
                  t("improvement.expectedSavings") || "Expected Savings (EUR)",
                  t("improvement.actualSavings") || "Actual Savings (EUR)",
                ],
                rows: filteredItems.map((item) => [
                  item.title,
                  item.status,
                  item.priority,
                  item.category,
                  item.owner,
                  String(item.expected_savings_eur ?? ""),
                  String(item.actual_savings_eur ?? ""),
                ]),
              })
            }
          />
          <button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-brand-500 to-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-brand-600 hover:to-brand-700 transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40"
          >
            <span className="text-lg leading-none">+</span>
            {t("improvement.newKaizen")}
          </button>
        </div>
      </div>

      {/* ---- Savings summary ---- */}
      <SavingsBar
        savings={savings}
        completedCount={completedCount}
        t={t}
        sym={sym}
      />

      {/* ---- Impact/Effort Matrix View ---- */}
      {viewMode === "matrix" && (
        <div className="grid grid-cols-2 gap-3 pb-4">
          {/* Matrix header labels */}
          <div className="col-span-2 grid grid-cols-[80px_1fr_1fr] gap-3">
            <div />
            <div className="text-center text-xs font-bold text-th-text-2 uppercase tracking-wider py-1">
              {t("improvement.lowEffort") || "Low Effort"}
            </div>
            <div className="text-center text-xs font-bold text-th-text-2 uppercase tracking-wider py-1">
              {t("improvement.highEffort") || "High Effort"}
            </div>
          </div>

          {/* High Impact row */}
          <div className="col-span-2 grid grid-cols-[80px_1fr_1fr] gap-3">
            <div className="flex items-center justify-center">
              <span className="text-xs font-bold text-th-text-2 uppercase tracking-wider [writing-mode:vertical-lr] rotate-180">
                {t("improvement.highImpact") || "High Impact"}
              </span>
            </div>
            {/* Quick Wins - High Impact / Low Effort */}
            <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 min-h-[200px]">
              <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-1">
                {"★"} {t("improvement.quickWins") || "Quick Wins"}
              </h4>
              <div className="space-y-2">
                {filteredItems
                  .filter((i) => {
                    const impact = i.impact_level || i.expected_impact || "";
                    const effort = i.effort_level || "";
                    return (impact === "high" || impact === "medium") && (effort === "low" || effort === "");
                  })
                  .map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="bg-th-bg-2 p-2.5 rounded-lg border border-th-border cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all"
                    >
                      <p className="text-sm font-medium text-th-text line-clamp-1">{item.title}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <PriorityBadge priority={item.priority} t={t} />
                        <CategoryBadge category={item.category} t={t} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            {/* Major Projects - High Impact / High Effort */}
            <div className="rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/20 p-4 min-h-[200px]">
              <h4 className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-3">
                {t("improvement.majorProjects") || "Major Projects"}
              </h4>
              <div className="space-y-2">
                {filteredItems
                  .filter((i) => {
                    const impact = i.impact_level || i.expected_impact || "";
                    const effort = i.effort_level || "";
                    return (impact === "high" || impact === "medium") && (effort === "high" || effort === "medium");
                  })
                  .map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="bg-th-bg-2 p-2.5 rounded-lg border border-th-border cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all"
                    >
                      <p className="text-sm font-medium text-th-text line-clamp-1">{item.title}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <PriorityBadge priority={item.priority} t={t} />
                        <CategoryBadge category={item.category} t={t} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Low Impact row */}
          <div className="col-span-2 grid grid-cols-[80px_1fr_1fr] gap-3">
            <div className="flex items-center justify-center">
              <span className="text-xs font-bold text-th-text-2 uppercase tracking-wider [writing-mode:vertical-lr] rotate-180">
                {t("improvement.lowImpact") || "Low Impact"}
              </span>
            </div>
            {/* Fill-ins - Low Impact / Low Effort */}
            <div className="rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50/30 dark:bg-slate-950/20 p-4 min-h-[200px]">
              <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-3">
                {t("improvement.fillIns") || "Fill-ins"}
              </h4>
              <div className="space-y-2">
                {filteredItems
                  .filter((i) => {
                    const impact = i.impact_level || i.expected_impact || "";
                    const effort = i.effort_level || "";
                    return (impact === "low" || impact === "") && (effort === "low" || effort === "");
                  })
                  .map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="bg-th-bg-2 p-2.5 rounded-lg border border-th-border cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all"
                    >
                      <p className="text-sm font-medium text-th-text line-clamp-1">{item.title}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <PriorityBadge priority={item.priority} t={t} />
                        <CategoryBadge category={item.category} t={t} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            {/* Thankless - Low Impact / High Effort */}
            <div className="rounded-xl border-2 border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-950/20 p-4 min-h-[200px]">
              <h4 className="text-sm font-bold text-red-600 dark:text-red-400 mb-3">
                {t("improvement.thankless") || "Thankless Tasks"}
              </h4>
              <div className="space-y-2">
                {filteredItems
                  .filter((i) => {
                    const impact = i.impact_level || i.expected_impact || "";
                    const effort = i.effort_level || "";
                    return (impact === "low" || impact === "") && (effort === "high" || effort === "medium");
                  })
                  .map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="bg-th-bg-2 p-2.5 rounded-lg border border-th-border cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all"
                    >
                      <p className="text-sm font-medium text-th-text line-clamp-1">{item.title}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <PriorityBadge priority={item.priority} t={t} />
                        <CategoryBadge category={item.category} t={t} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Kanban board ---- */}
      {viewMode === "kanban" && <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 pb-4">
        {COLUMNS.map((col) => {
          const colItems = filteredItems.filter((i) => i.status === col.key);
          const isDropTarget = dragOverCol === col.key;

          return (
            <div
              key={col.key}
              className={`rounded-xl p-3 min-h-[320px] border-2 transition-all duration-300 ${
                col.color
              } ${
                isDropTarget
                  ? "border-brand-500 ring-2 ring-brand-300/50 dark:ring-brand-700/50 scale-[1.01] shadow-lg"
                  : "border-transparent"
              }`}
              onDragEnter={(e) => handleDragEnter(e, col.key)}
              onDragLeave={(e) => handleDragLeave(e, col.key)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-th-text flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: "currentColor" }}>
                    <span className={`block w-2 h-2 rounded-full ${col.dotColor}`} />
                  </span>
                  <span className="uppercase tracking-wider text-xs">{t(`improvement.${col.labelKey}`)}</span>
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-th-bg-3 text-th-text-2 border border-th-border">
                  {colItems.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {colItems.map((item) => {
                  const prStyle = PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.low;
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedItem(item)}
                      className={`group relative bg-th-bg-2 backdrop-blur-sm p-3.5 rounded-xl border-l-[3px] ${col.glowBorder} border border-th-border cursor-grab hover:shadow-lg hover:scale-[1.02] transition-all duration-300 select-none ${
                        draggedId === item.id ? "opacity-40" : ""
                      } ${item.priority === "critical" ? "animate-glow-pulse-red" : ""}`}
                    >
                      {/* Title */}
                      <p className="font-semibold text-sm text-th-text leading-snug line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {item.title}
                      </p>

                      {/* Priority + Category */}
                      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                        <PriorityBadge priority={item.priority} t={t} />
                        <CategoryBadge category={item.category} t={t} />
                      </div>

                      {/* Savings */}
                      {item.expected_savings_eur != null && (
                        <p className="text-xs text-th-text-3 mt-2 font-medium">
                          {sym}{item.expected_savings_eur.toLocaleString()}
                          {item.actual_savings_eur != null && (
                            <span className="text-emerald-600 dark:text-emerald-400 ml-1.5 font-bold">
                              &rarr; {sym}
                              {item.actual_savings_eur.toLocaleString()}
                            </span>
                          )}
                        </p>
                      )}

                      {/* Owner */}
                      {item.owner && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-th-text-3">
                          <div className="w-4 h-4 rounded-full bg-brand-500/10 flex items-center justify-center text-[8px] font-bold text-brand-500">
                            {item.owner.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{item.owner}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Empty state */}
                {colItems.length === 0 && (
                  <div className="text-center py-10 px-2">
                    <div className="flex justify-center mb-1.5 opacity-30 text-th-text-3">
                      {(() => { const ColIcon = COLUMN_ICONS[col.key]; return ColIcon ? <ColIcon size={28} /> : null; })()}
                    </div>
                    <p className="text-xs text-th-text-3 italic">
                      {t(`improvement.${col.emptyKey}`)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>}

      {/* ---- Modals ---- */}
      {showForm && (
        <CreateKaizenModal
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
          t={t}
          submitting={submitting}
          sym={sym}
        />
      )}
      {selectedItem && (
        <CardDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onStatusChange={handleStatusChange}
          onMarkStandardized={handleMarkStandardized}
          t={t}
          updating={updating}
          sym={sym}
        />
      )}
    </div>
  );
}
