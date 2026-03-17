"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi, adminApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";

// ─── Types ──────────────────────────────────────────────────────────────────

type ViewMode = "new-walk" | "history" | "action-tracker";
type ObservationCategory = "Safety" | "Quality" | "Productivity" | "5S" | "Maintenance";
type Severity = "info" | "warning" | "critical";
type ActionStatus = "open" | "in-progress" | "done";

interface ActionItem {
  id: string;
  what: string;
  who: string;
  when: string;
  status: ActionStatus;
}

interface Observation {
  id: string;
  description: string;
  category: ObservationCategory;
  severity: Severity;
  photoPlaceholder: string;
  actions: ActionItem[];
}

interface GembaWalkData {
  id?: string | number;
  area: string;
  date: string;
  observations: Observation[];
  created_at?: string;
}

interface WalkHistoryItem {
  id: string | number;
  area: string;
  date: string;
  observationCount: number;
  openActions: number;
  totalActions: number;
  raw: GembaWalkData;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_AREAS = [
  "Warehouse",
  "Packaging",
  "Quality Lab",
  "Shipping Dock",
  "Maintenance Shop",
  "Office / Admin",
];

const CATEGORIES: { key: ObservationCategory; icon: string; color: string; bg: string; gradient: string; tagBg: string }[] = [
  { key: "Safety", icon: "\uD83D\uDEE1\uFE0F", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10 dark:bg-red-950/30 border-red-500/30 dark:border-red-700/50", gradient: "from-red-500 to-rose-500", tagBg: "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30" },
  { key: "Quality", icon: "\uD83C\uDFAF", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 dark:bg-blue-950/30 border-blue-500/30 dark:border-blue-700/50", gradient: "from-blue-500 to-cyan-500", tagBg: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30" },
  { key: "Productivity", icon: "\u26A1", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 dark:bg-amber-950/30 border-amber-500/30 dark:border-amber-700/50", gradient: "from-amber-500 to-yellow-500", tagBg: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30" },
  { key: "5S", icon: "\uD83E\uDDF9", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/30 dark:border-emerald-700/50", gradient: "from-emerald-500 to-green-500", tagBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30" },
  { key: "Maintenance", icon: "\uD83D\uDD27", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10 dark:bg-purple-950/30 border-purple-500/30 dark:border-purple-700/50", gradient: "from-purple-500 to-violet-500", tagBg: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30" },
];

const SEVERITY_CONFIG: Record<Severity, { icon: string; color: string; bg: string; labelKey: string; pulse: boolean }> = {
  info: { icon: "\u2139\uFE0F", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/15 border border-blue-500/30", labelKey: "gembaSeverityInfo", pulse: false },
  warning: { icon: "\u26A0\uFE0F", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/15 border border-amber-500/30", labelKey: "gembaSeverityWarning", pulse: false },
  critical: { icon: "\uD83D\uDD34", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/15 border border-red-500/30", labelKey: "gembaSeverityCritical", pulse: true },
};

const ACTION_STATUS_CONFIG: Record<ActionStatus, { icon: string; color: string; labelKey: string }> = {
  open: { icon: "\u25CB", color: "text-red-600 dark:text-red-400", labelKey: "gembaStatusOpen" },
  "in-progress": { icon: "\u25D0", color: "text-amber-600 dark:text-amber-400", labelKey: "gembaStatusInProgress" },
  done: { icon: "\u25CF", color: "text-emerald-600 dark:text-emerald-400", labelKey: "gembaStatusDone" },
};

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function GembaWalk() {
  const { t } = useI18n();
  const { printView, exportToExcel } = useExport();

  // ── Areas (loaded from factory + defaults)
  const [areas, setAreas] = useState<string[]>(DEFAULT_AREAS);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.getFactory();
        const f = res.data;
        if (f?.lines && Array.isArray(f.lines) && f.lines.length > 0) {
          const lineNames = f.lines.map((l: any) => l.name);
          const merged = [...lineNames, ...DEFAULT_AREAS];
          setAreas(merged);
          setWalkArea((prev) => prev || merged[0]);
        }
      } catch {
        // keep defaults
      }
    })();
  }, []);

  // ── View state
  const [view, setView] = useState<ViewMode>("new-walk");

  // ── New Walk form state
  const [walkArea, setWalkArea] = useState(DEFAULT_AREAS[0]);
  const [walkDate, setWalkDate] = useState(todayISO());
  const [observations, setObservations] = useState<Observation[]>([]);

  // ── Current observation being built
  const [obsDescription, setObsDescription] = useState("");
  const [obsCategory, setObsCategory] = useState<ObservationCategory>("Safety");
  const [obsSeverity, setObsSeverity] = useState<Severity>("info");
  const [obsPhoto, setObsPhoto] = useState("");
  const descRef = useRef<HTMLTextAreaElement>(null);

  // ── Action form per observation
  const [expandedObsAction, setExpandedObsAction] = useState<string | null>(null);
  const [actionWhat, setActionWhat] = useState("");
  const [actionWho, setActionWho] = useState("");
  const [actionWhen, setActionWhen] = useState("");

  // ── History + detail state
  const [history, setHistory] = useState<WalkHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [selectedWalk, setSelectedWalk] = useState<GembaWalkData | null>(null);

  // ── Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ─── Derived: summary dashboard
  const dashboardStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const thisMonthWalks = history.filter((w) => w.date >= monthStart);

    const catCounts: Record<ObservationCategory, number> = { Safety: 0, Quality: 0, Productivity: 0, "5S": 0, Maintenance: 0 };
    let totalOpen = 0;
    let totalClosed = 0;
    let totalObs = 0;

    for (const w of history) {
      totalObs += w.observationCount;
      totalOpen += w.openActions;
      totalClosed += w.totalActions - w.openActions;
      if (w.raw.observations) {
        for (const obs of w.raw.observations) {
          if (obs.category in catCounts) catCounts[obs.category]++;
        }
      }
    }

    return { walksThisMonth: thisMonthWalks.length, catCounts, totalOpen, totalClosed, totalObs };
  }, [history]);

  // ── All open actions across walks
  const allOpenActions = useMemo(() => {
    const result: { walkArea: string; walkDate: string; obsDesc: string; action: ActionItem }[] = [];
    for (const w of history) {
      for (const obs of w.raw.observations ?? []) {
        for (const a of obs.actions ?? []) {
          if (a.status !== "done") {
            result.push({ walkArea: w.area, walkDate: w.date, obsDesc: obs.description, action: a });
          }
        }
      }
    }
    return result;
  }, [history]);

  // ─── API: Load History
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError("");
    try {
      const res = await advancedLeanApi.listGembaWalks();
      const items: any[] = Array.isArray(res.data) ? res.data : [];
      setHistory(
        items.map((w: any) => {
          const obs: Observation[] = w.observations ?? [];
          let openCount = 0;
          let totalAct = 0;
          for (const o of obs) {
            for (const a of o.actions ?? []) {
              totalAct++;
              if (a.status !== "done") openCount++;
            }
          }
          return {
            id: w.id ?? uid(),
            area: w.area ?? "-",
            date: w.date ?? w.created_at?.slice(0, 10) ?? "-",
            observationCount: obs.length,
            openActions: openCount,
            totalActions: totalAct,
            raw: w,
          };
        })
      );
    } catch (err: any) {
      setHistoryError(err?.message ?? t("improvement.gembaLoadError"));
    } finally {
      setLoadingHistory(false);
    }
  }, [t]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ─── API: Save Walk
  const saveWalk = async () => {
    if (observations.length === 0) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      await advancedLeanApi.createGembaWalk({
        area: walkArea,
        duration_min: null,
        theme: null,
        summary: observations.map((o) => o.description).join("; "),
        observations: observations.map((o) => ({
          observation_type: o.category?.toLowerCase() || "concern",
          description: o.description,
          location: walkArea,
          action_required: o.actions.length > 0,
          assigned_to: o.actions[0]?.who || null,
          due_date: o.actions[0]?.when || null,
          priority: o.severity === "critical" ? "high" : o.severity === "warning" ? "medium" : "low",
        })),
      });
      setSaveSuccess(true);
      setObservations([]);
      setObsDescription("");
      setObsCategory("Safety");
      setObsSeverity("info");
      setObsPhoto("");
      setWalkArea(areas[0] || "");
      setWalkDate(todayISO());
      loadHistory();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err?.message ?? t("improvement.gembaSaveError"));
    } finally {
      setSaving(false);
    }
  };

  // ─── Observation Handlers
  const addObservation = () => {
    if (!obsDescription.trim()) return;
    const obs: Observation = {
      id: uid(),
      description: obsDescription.trim(),
      category: obsCategory,
      severity: obsSeverity,
      photoPlaceholder: obsPhoto.trim(),
      actions: [],
    };
    setObservations((prev) => [...prev, obs]);
    setObsDescription("");
    setObsSeverity("info");
    setObsPhoto("");
    descRef.current?.focus();
  };

  const removeObservation = (id: string) => {
    setObservations((prev) => prev.filter((o) => o.id !== id));
  };

  // ─── Action Item Handlers
  const addActionToObs = (obsId: string) => {
    if (!actionWhat.trim()) return;
    const action: ActionItem = { id: uid(), what: actionWhat.trim(), who: actionWho.trim(), when: actionWhen, status: "open" };
    setObservations((prev) =>
      prev.map((o) => (o.id === obsId ? { ...o, actions: [...o.actions, action] } : o))
    );
    setActionWhat("");
    setActionWho("");
    setActionWhen("");
    setExpandedObsAction(null);
  };

  const removeActionFromObs = (obsId: string, actionId: string) => {
    setObservations((prev) =>
      prev.map((o) =>
        o.id === obsId ? { ...o, actions: o.actions.filter((a) => a.id !== actionId) } : o
      )
    );
  };

  const cycleActionStatus = (obsId: string, actionId: string) => {
    setObservations((prev) =>
      prev.map((o) =>
        o.id === obsId
          ? {
              ...o,
              actions: o.actions.map((a) => {
                if (a.id !== actionId) return a;
                const next: ActionStatus = a.status === "open" ? "in-progress" : a.status === "in-progress" ? "done" : "open";
                return { ...a, status: next };
              }),
            }
          : o
      )
    );
  };

  // ─── Helpers
  const getCatConfig = (key: ObservationCategory) => CATEGORIES.find((c) => c.key === key)!;
  const totalActions = observations.reduce((s, o) => s + o.actions.length, 0);
  const closedActions = observations.reduce((s, o) => s + o.actions.filter((a) => a.status === "done").length, 0);

  // ─── Render
  return (
    <div className="space-y-6 max-w-5xl mx-auto" data-print-area="true">
      {/* ═══════════════ Header ═══════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-2xl p-6 text-white shadow-glow-green">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center text-2xl backdrop-blur-sm border border-white/20">
            \uD83D\uDEB6
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{t("improvement.gembaTitle")}</h2>
            <p className="text-sm text-white/70">{t("improvement.gembaSubtitle")}</p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Gemba Walk views">
          {(
            [
              { key: "new-walk", labelKey: "gembaStartNew", icon: "+" },
              { key: "history", labelKey: "gembaViewHistory", icon: "\uD83D\uDCCB" },
              { key: "action-tracker", labelKey: "gembaActionTracker", icon: "\u26A1" },
            ] as { key: ViewMode; labelKey: string; icon: string }[]
          ).map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => {
                setView(v.key);
                setSelectedWalk(null);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition touch-check ${
                view === v.key
                  ? "bg-white/90 text-teal-700 shadow-md"
                  : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/10"
              }`}
            >
              {v.icon} {t(`improvement.${v.labelKey}`)}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════ Summary Dashboard ═════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { value: dashboardStats.walksThisMonth, label: t("improvement.gembaWalksThisMonth"), color: "text-teal-600 dark:text-teal-400", border: "border-teal-500/20" },
          { value: dashboardStats.totalObs, label: t("improvement.gembaTotalObs"), color: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
          { value: dashboardStats.totalOpen, label: t("improvement.gembaOpenActions"), color: "text-red-600 dark:text-red-400", border: "border-red-500/20" },
          { value: dashboardStats.totalClosed, label: t("improvement.gembaClosedActions"), color: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20" },
        ].map((stat, i) => (
          <div key={i} className={`bg-th-bg-2 rounded-xl p-4 border ${stat.border} text-center backdrop-blur-sm shadow-card`}>
            <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] text-th-text-3 mt-1 uppercase tracking-wider font-semibold">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {dashboardStats.totalObs > 0 && (
        <div className="bg-th-bg-2 rounded-xl p-4 shadow-card border border-th-border backdrop-blur-sm">
          <h3 className="font-bold text-th-text mb-3 text-xs uppercase tracking-wider">{t("improvement.gembaObsByCategory")}</h3>
          <div className="grid grid-cols-5 gap-2">
            {CATEGORIES.map((cat) => (
              <div key={cat.key} className={`text-center p-3 rounded-xl ${cat.bg} border`}>
                <div className="text-lg">{cat.icon}</div>
                <div className={`text-lg font-black ${cat.color}`}>{dashboardStats.catCounts[cat.key] || 0}</div>
                <div className="text-[10px] text-th-text-3 leading-tight font-medium">
                  {t(`improvement.gembaCat${cat.key}`)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ Export Toolbar ═════════════════════════════════════ */}
      <ExportToolbar
        onPrint={() => printView(t("common.titleGemba"))}
        onExportExcel={() =>
          exportToExcel({
            title: t("common.titleGemba"),
            columns: [
              t("improvement.gembaCategory") || "Category",
              t("improvement.gembaObservation") || "Observation",
              t("improvement.gembaSeverity") || "Severity",
              t("improvement.gembaActions") || "Actions",
            ],
            rows: observations.map((obs) => [
              obs.category,
              obs.description,
              obs.severity,
              obs.actions?.map((a) => a.what).join("; ") ?? "",
            ]),
          })
        }
      />

      {/* ═══════════════ NEW WALK VIEW ═════════════════════════════════════ */}
      {view === "new-walk" && (
        <div className="space-y-5">
          {/* Walk Metadata */}
          <div className="bg-th-bg-2 rounded-2xl p-5 shadow-card border border-th-border space-y-4 backdrop-blur-sm">
            <h3 className="font-bold text-th-text flex items-center gap-2 text-sm uppercase tracking-wider">
              \uD83D\uDCDD {t("improvement.gembaNewWalkTitle")}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-th-text-2 mb-1.5 block font-semibold uppercase tracking-wider">{t("improvement.gembaArea")}</label>
                <select
                  value={walkArea}
                  onChange={(e) => setWalkArea(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800/60 text-th-text focus:ring-2 focus:ring-teal-500 outline-none transition"
                >
                  {areas.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-th-text-2 mb-1.5 block font-semibold uppercase tracking-wider">{t("improvement.gembaDate")}</label>
                <input
                  type="date"
                  value={walkDate}
                  onChange={(e) => setWalkDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800/60 text-th-text focus:ring-2 focus:ring-teal-500 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Add Observation Form */}
          <div className="bg-th-bg-2 rounded-2xl p-5 shadow-card border border-th-border space-y-4 backdrop-blur-sm">
            <h3 className="font-bold text-th-text flex items-center gap-2 text-sm uppercase tracking-wider">
              \uD83D\uDC41\uFE0F {t("improvement.gembaAddObservation")}
            </h3>

            {/* Category selector */}
            <div>
              <label className="text-xs text-th-text-2 mb-1.5 block font-semibold uppercase tracking-wider">{t("improvement.category")}</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setObsCategory(cat.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs border transition ${
                      obsCategory === cat.key
                        ? `${cat.tagBg} font-semibold shadow-sm`
                        : "bg-slate-100 dark:bg-slate-700/50 text-th-text-2 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600"
                    }`}
                  >
                    {cat.icon} {t(`improvement.gembaCat${cat.key}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-th-text-2 mb-1.5 block font-semibold uppercase tracking-wider">{t("improvement.description")}</label>
              <textarea
                ref={descRef}
                value={obsDescription}
                onChange={(e) => setObsDescription(e.target.value)}
                rows={3}
                placeholder={t("improvement.describeObservation")}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none resize-none bg-white dark:bg-slate-800/60 text-th-text transition"
              />
            </div>

            {/* Photo placeholder + Severity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-th-text-2 mb-1.5 block font-semibold uppercase tracking-wider">{t("improvement.gembaPhotoPlaceholder")}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={obsPhoto}
                    onChange={(e) => setObsPhoto(e.target.value)}
                    placeholder={t("improvement.gembaPhotoHint")}
                    className="w-full px-3 py-2 pl-9 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800/60 text-th-text focus:ring-2 focus:ring-teal-500 outline-none transition"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-3">\uD83D\uDCF7</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-th-text-2 mb-1.5 block font-semibold uppercase tracking-wider">{t("improvement.gembaSeverity")}</label>
                <div className="flex gap-2">
                  {(["info", "warning", "critical"] as Severity[]).map((sev) => {
                    const cfg = SEVERITY_CONFIG[sev];
                    return (
                      <button
                        key={sev}
                        onClick={() => setObsSeverity(sev)}
                        className={`flex-1 px-3 py-1.5 rounded-xl text-xs border transition text-center ${
                          obsSeverity === sev
                            ? `${cfg.bg} ${cfg.color} font-semibold shadow-sm ${cfg.pulse ? "animate-pulse" : ""}`
                            : "bg-slate-100 dark:bg-slate-700/50 text-th-text-2 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600"
                        }`}
                      >
                        {cfg.icon} {t(`improvement.${cfg.labelKey}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={addObservation}
                disabled={!obsDescription.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-semibold text-sm hover:from-teal-600 hover:to-emerald-600 shadow-glow-green transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("improvement.gembaAddObs")}
              </button>
            </div>
          </div>

          {/* Observations List */}
          <div className="space-y-3">
            {observations.length === 0 && (
              <div className="text-center py-16 text-th-text-3 bg-th-bg-2 rounded-2xl border border-th-border backdrop-blur-sm">
                <div className="text-5xl mb-3">\uD83D\uDEB6</div>
                <p className="text-sm">{t("improvement.emptyGemba")}</p>
              </div>
            )}

            {observations.map((obs, idx) => {
              const catCfg = getCatConfig(obs.category);
              const sevCfg = SEVERITY_CONFIG[obs.severity];

              return (
                <div key={obs.id} className={`rounded-2xl p-5 border ${catCfg.bg} space-y-3 backdrop-blur-sm shadow-card transition-all duration-200 hover:shadow-card-hover`}>
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{catCfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-bold text-th-text bg-white/60 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                          #{idx + 1}
                        </span>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${catCfg.tagBg}`}>
                          {t(`improvement.gembaCat${obs.category}`)}
                        </span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full ${sevCfg.bg} ${sevCfg.color} ${sevCfg.pulse ? "animate-pulse" : ""}`}>
                          {sevCfg.icon} {t(`improvement.${sevCfg.labelKey}`)}
                        </span>
                      </div>
                      <p className="text-sm text-th-text leading-relaxed">{obs.description}</p>
                      {obs.photoPlaceholder && (
                        <div className="mt-2 p-3 rounded-xl bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 flex items-center gap-2">
                          <span className="text-2xl">\uD83D\uDCF7</span>
                          <span className="text-xs text-th-text-2">{obs.photoPlaceholder}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeObservation(obs.id)}
                      className="text-th-text-3 hover:text-red-500 text-lg transition flex-shrink-0"
                      title={t("improvement.gembaRemove")}
                    >
                      \u00D7
                    </button>
                  </div>

                  {/* Action items list */}
                  {obs.actions.length > 0 && (
                    <div className="ml-10 space-y-1.5">
                      {obs.actions.map((action) => {
                        const aCfg = ACTION_STATUS_CONFIG[action.status];
                        return (
                          <div key={action.id} className="flex items-center gap-2 text-xs bg-white/50 dark:bg-white/5 rounded-xl px-3 py-2.5 border border-white/20 dark:border-white/10">
                            <button
                              onClick={() => cycleActionStatus(obs.id, action.id)}
                              title={t(`improvement.${aCfg.labelKey}`)}
                              className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all font-bold text-[11px] ${
                                action.status === "done"
                                  ? "bg-emerald-500 border-emerald-500 text-white shadow-md"
                                  : action.status === "in-progress"
                                  ? "bg-amber-400 border-amber-400 text-white shadow-md"
                                  : "border-slate-300 dark:border-slate-600 hover:border-teal-400"
                              }`}
                            >
                              {aCfg.icon}
                            </button>
                            <span className={`flex-1 ${action.status === "done" ? "line-through text-th-text-3" : "text-th-text"}`}>
                              {action.what}
                            </span>
                            {action.who && <span className="text-th-text-3 hidden sm:inline">\uD83D\uDC64 {action.who}</span>}
                            {action.when && <span className="text-th-text-3 hidden sm:inline">\uD83D\uDCC5 {action.when}</span>}
                            <button
                              onClick={() => removeActionFromObs(obs.id, action.id)}
                              className="text-th-text-3 hover:text-red-500 transition"
                            >
                              \u00D7
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add action form */}
                  <div className="ml-10">
                    {expandedObsAction === obs.id ? (
                      <div className="bg-white/60 dark:bg-white/5 rounded-xl p-4 space-y-2.5 border border-white/20 dark:border-white/10">
                        <input
                          type="text"
                          value={actionWhat}
                          onChange={(e) => setActionWhat(e.target.value)}
                          autoFocus
                          placeholder={t("improvement.gembaActionWhat")}
                          className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800/60 text-th-text focus:ring-2 focus:ring-teal-500 outline-none transition"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={actionWho}
                            onChange={(e) => setActionWho(e.target.value)}
                            placeholder={t("improvement.gembaActionWho")}
                            className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800/60 text-th-text focus:ring-2 focus:ring-teal-500 outline-none transition"
                          />
                          <input
                            type="date"
                            value={actionWhen}
                            onChange={(e) => setActionWhen(e.target.value)}
                            className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800/60 text-th-text focus:ring-2 focus:ring-teal-500 outline-none transition"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => { setExpandedObsAction(null); setActionWhat(""); setActionWho(""); setActionWhen(""); }}
                            className="px-3 py-1.5 text-xs text-th-text-3 hover:text-th-text transition"
                          >
                            {t("improvement.gembaCancel")}
                          </button>
                          <button
                            onClick={() => addActionToObs(obs.id)}
                            disabled={!actionWhat.trim()}
                            className="px-4 py-1.5 text-xs bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-emerald-600 transition disabled:opacity-50"
                          >
                            {t("improvement.addAction")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setExpandedObsAction(obs.id)}
                        className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-semibold"
                      >
                        + {t("improvement.createAction")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save Walk */}
          {observations.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-end">
              {saveSuccess && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium animate-slide-in">
                  {t("improvement.gembaSavedOk")}
                </span>
              )}
              {saveError && (
                <span className="text-sm text-red-600 dark:text-red-400 font-medium">{saveError}</span>
              )}
              <div className="text-xs text-th-text-3">
                {observations.length} {t("improvement.observations")} &middot; {totalActions} {t("improvement.actionItems")} ({closedActions} {t("improvement.gembaStatusDone")})
              </div>
              <button
                onClick={saveWalk}
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-semibold text-sm hover:from-teal-600 hover:to-emerald-600 shadow-glow-green transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {t("improvement.gembaSaving")}
                  </>
                ) : (
                  <>{t("improvement.gembaSaveWalk")}</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ HISTORY VIEW ═════════════════════════════════════ */}
      {view === "history" && (
        <div className="space-y-4">
          {selectedWalk ? (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedWalk(null)}
                className="text-sm text-teal-600 dark:text-teal-400 hover:underline font-semibold"
              >
                &larr; {t("improvement.gembaBackToHistory")}
              </button>

              <div className="bg-th-bg-2 rounded-2xl p-5 shadow-card border border-th-border backdrop-blur-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-3xl">\uD83D\uDCCD</div>
                  <div>
                    <h3 className="font-bold text-th-text text-lg">{selectedWalk.area}</h3>
                    <p className="text-sm text-th-text-2">\uD83D\uDCC5 {selectedWalk.date}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {(selectedWalk.observations ?? []).map((obs, idx) => {
                    const catCfg = CATEGORIES.find((c) => c.key === obs.category) ?? CATEGORIES[0];
                    const sevCfg = SEVERITY_CONFIG[obs.severity] ?? SEVERITY_CONFIG.info;
                    return (
                      <div key={obs.id ?? idx} className={`rounded-xl p-4 border ${catCfg.bg} backdrop-blur-sm`}>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm">{catCfg.icon}</span>
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${catCfg.tagBg}`}>
                            {t(`improvement.gembaCat${obs.category}`)}
                          </span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full ${sevCfg.bg} ${sevCfg.color}`}>
                            {sevCfg.icon} {t(`improvement.${sevCfg.labelKey}`)}
                          </span>
                        </div>
                        <p className="text-sm text-th-text">{obs.description}</p>
                        {obs.photoPlaceholder && (
                          <p className="text-xs text-th-text-3 mt-1">\uD83D\uDCF7 {obs.photoPlaceholder}</p>
                        )}
                        {(obs.actions ?? []).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {obs.actions.map((a, aIdx) => {
                              const aCfg = ACTION_STATUS_CONFIG[a.status] ?? ACTION_STATUS_CONFIG.open;
                              return (
                                <div key={a.id ?? aIdx} className="flex items-center gap-2 text-xs bg-white/50 dark:bg-white/5 rounded-lg px-3 py-1.5">
                                  <span className={aCfg.color}>{aCfg.icon}</span>
                                  <span className={`flex-1 ${a.status === "done" ? "line-through text-th-text-3" : "text-th-text"}`}>
                                    {a.what}
                                  </span>
                                  {a.who && <span className="text-th-text-3">\uD83D\uDC64 {a.who}</span>}
                                  {a.when && <span className="text-th-text-3">\uD83D\uDCC5 {a.when}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-th-bg-2 rounded-2xl shadow-card border border-th-border overflow-hidden backdrop-blur-sm">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/50">
                <h3 className="font-bold text-th-text flex items-center gap-2 text-sm uppercase tracking-wider">
                  \uD83D\uDCCB {t("improvement.gembaWalkHistory")}
                  <span className="text-xs font-normal text-th-text-3 normal-case">({history.length})</span>
                </h3>
              </div>

              {loadingHistory ? (
                <div className="p-8 text-center text-th-text-3">
                  <span className="inline-block w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-teal-500 rounded-full animate-spin mr-2" />
                  {t("improvement.gembaLoading")}
                </div>
              ) : historyError ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-red-600 dark:text-red-400 mb-2">{historyError}</p>
                  <button onClick={loadHistory} className="text-sm text-teal-600 dark:text-teal-400 hover:underline font-semibold">
                    {t("improvement.gembaRetry")}
                  </button>
                </div>
              ) : history.length === 0 ? (
                <div className="p-8 text-center text-th-text-3 text-sm">
                  {t("improvement.gembaNoHistory")}
                </div>
              ) : (
                <div>
                  <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-2.5 bg-slate-50 dark:bg-slate-800/40 text-[10px] font-bold text-th-text-3 border-b border-slate-200 dark:border-slate-700/50 uppercase tracking-wider">
                    <div className="col-span-2">{t("improvement.gembaDate")}</div>
                    <div className="col-span-4">{t("improvement.gembaArea")}</div>
                    <div className="col-span-2 text-center">{t("improvement.observations")}</div>
                    <div className="col-span-2 text-center">{t("improvement.gembaOpenActions")}</div>
                    <div className="col-span-2 text-right"></div>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
                    {history.map((walk, idx) => (
                      <button
                        key={walk.id}
                        onClick={() => setSelectedWalk(walk.raw)}
                        className={`w-full grid grid-cols-1 md:grid-cols-12 gap-2 px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/20 transition items-center ${idx % 2 === 1 ? "bg-slate-50/30 dark:bg-slate-800/10" : ""}`}
                      >
                        <div className="md:col-span-2 text-sm text-th-text">\uD83D\uDCC5 {walk.date}</div>
                        <div className="md:col-span-4 text-sm font-medium text-th-text truncate">\uD83D\uDCCD {walk.area}</div>
                        <div className="md:col-span-2 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs border border-blue-500/20">
                            {walk.observationCount}
                          </span>
                        </div>
                        <div className="md:col-span-2 text-center">
                          {walk.openActions > 0 ? (
                            <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-xs border border-red-500/20 animate-pulse">
                              {walk.openActions} {t("improvement.gembaStatusOpen")}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20">
                              {t("improvement.gembaAllClosed")}
                            </span>
                          )}
                        </div>
                        <div className="md:col-span-2 text-right text-xs text-teal-600 dark:text-teal-400 font-semibold">
                          {t("improvement.gembaViewDetails")} &rarr;
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ ACTION TRACKER VIEW ═══════════════════════════════ */}
      {view === "action-tracker" && (
        <div className="bg-th-bg-2 rounded-2xl shadow-card border border-th-border overflow-hidden backdrop-blur-sm">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/50">
            <h3 className="font-bold text-th-text flex items-center gap-2 text-sm uppercase tracking-wider">
              \u26A1 {t("improvement.gembaActionTracker")}
              <span className="text-xs font-normal text-th-text-3 normal-case">
                ({allOpenActions.length} {t("improvement.gembaStatusOpen")})
              </span>
            </h3>
          </div>

          {loadingHistory ? (
            <div className="p-8 text-center text-th-text-3">
              <span className="inline-block w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-teal-500 rounded-full animate-spin mr-2" />
              {t("improvement.gembaLoading")}
            </div>
          ) : allOpenActions.length === 0 ? (
            <div className="p-8 text-center text-th-text-3 text-sm">
              {t("improvement.gembaNoOpenActions")}
            </div>
          ) : (
            <div>
              <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-2.5 bg-slate-50 dark:bg-slate-800/40 text-[10px] font-bold text-th-text-3 border-b border-slate-200 dark:border-slate-700/50 uppercase tracking-wider">
                <div className="col-span-1">{t("improvement.gembaStatus")}</div>
                <div className="col-span-3">{t("improvement.gembaActionWhat")}</div>
                <div className="col-span-2">{t("improvement.gembaActionWho")}</div>
                <div className="col-span-2">{t("improvement.gembaActionWhen")}</div>
                <div className="col-span-2">{t("improvement.gembaArea")}</div>
                <div className="col-span-2">{t("improvement.gembaDate")}</div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {allOpenActions.map((item, idx) => {
                  const aCfg = ACTION_STATUS_CONFIG[item.action.status] ?? ACTION_STATUS_CONFIG.open;
                  return (
                    <div key={idx} className={`grid grid-cols-1 md:grid-cols-12 gap-2 px-5 py-3.5 items-center hover:bg-slate-50 dark:hover:bg-slate-700/20 transition ${idx % 2 === 1 ? "bg-slate-50/30 dark:bg-slate-800/10" : ""}`}>
                      <div className="md:col-span-1">
                        <span className={`text-sm ${aCfg.color}`}>{aCfg.icon}</span>
                      </div>
                      <div className="md:col-span-3 text-sm text-th-text font-medium">{item.action.what}</div>
                      <div className="md:col-span-2 text-xs text-th-text-2">{item.action.who || "-"}</div>
                      <div className="md:col-span-2 text-xs text-th-text-2">{item.action.when || "-"}</div>
                      <div className="md:col-span-2 text-xs text-th-text-3">{item.walkArea}</div>
                      <div className="md:col-span-2 text-xs text-th-text-3">{item.walkDate}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
