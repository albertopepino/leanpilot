"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi, adminApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import CreateLinkedAction from "@/components/ui/CreateLinkedAction";
import {
  Footprints,
  Eye,
  Camera,
  CheckCircle,
  Clock,
  AlertTriangle,
  MapPin,
  User,
  Shield,
  Target,
  Zap,
  Sparkles,
  Wrench,
  Info,
  AlertCircle,
  CircleDot,
  Plus,
  X,
  ClipboardList,
  FileText,
  CalendarDays,
  ArrowLeft,
  ChevronRight,
  Save,
  Loader2,
} from "lucide-react";

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

const CATEGORY_ICONS: Record<ObservationCategory, React.FC<{ className?: string }>> = {
  Safety: Shield,
  Quality: Target,
  Productivity: Zap,
  "5S": Sparkles,
  Maintenance: Wrench,
};

const CATEGORIES: { key: ObservationCategory; color: string; bg: string; tagBg: string }[] = [
  { key: "Safety", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800", tagBg: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800" },
  { key: "Quality", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800", tagBg: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800" },
  { key: "Productivity", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800", tagBg: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800" },
  { key: "5S", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800", tagBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" },
  { key: "Maintenance", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800", tagBg: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200 dark:border-purple-800" },
];

const SEVERITY_CONFIG: Record<Severity, { Icon: React.FC<{ className?: string }>; color: string; bg: string; labelKey: string; pulse: boolean }> = {
  info: { Icon: Info, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800", labelKey: "gembaSeverityInfo", pulse: false },
  warning: { Icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800", labelKey: "gembaSeverityWarning", pulse: false },
  critical: { Icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800", labelKey: "gembaSeverityCritical", pulse: true },
};

const ACTION_STATUS_CONFIG: Record<ActionStatus, { Icon: React.FC<{ className?: string }>; color: string; labelKey: string }> = {
  open: { Icon: Clock, color: "text-red-600 dark:text-red-400", labelKey: "gembaStatusOpen" },
  "in-progress": { Icon: CircleDot, color: "text-amber-600 dark:text-amber-400", labelKey: "gembaStatusInProgress" },
  done: { Icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", labelKey: "gembaStatusDone" },
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
  const newWalkRef = useRef<HTMLDivElement>(null);

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

  // ─── Start new walk handler
  const handleStartNewWalk = useCallback(() => {
    setView("new-walk");
    setSelectedWalk(null);
    // Reset the form for a fresh walk
    setObservations([]);
    setObsDescription("");
    setObsCategory("Safety");
    setObsSeverity("info");
    setObsPhoto("");
    setWalkArea(areas[0] || DEFAULT_AREAS[0]);
    setWalkDate(todayISO());
    setExpandedObsAction(null);
    setActionWhat("");
    setActionWho("");
    setActionWhen("");
    setSaveError("");
    setSaveSuccess(false);
    // Scroll the form into view after React re-renders
    setTimeout(() => {
      newWalkRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      descRef.current?.focus();
    }, 100);
  }, [areas]);

  // ─── Helpers
  const getCatConfig = (key: ObservationCategory) => CATEGORIES.find((c) => c.key === key)!;
  const totalActions = observations.reduce((s, o) => s + o.actions.length, 0);
  const closedActions = observations.reduce((s, o) => s + o.actions.filter((a) => a.status === "done").length, 0);

  // ─── Render
  return (
    <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true">
      {/* ═══════════════ Header ═══════════════════════════════════════════ */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
            <Footprints className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-th-text">{t("improvement.gembaTitle")}</h2>
            <p className="text-sm text-th-text-3">{t("improvement.gembaSubtitle")}</p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Gemba Walk views">
          {(
            [
              { key: "new-walk", labelKey: "gembaStartNew", Icon: Plus },
              { key: "history", labelKey: "gembaViewHistory", Icon: ClipboardList },
              { key: "action-tracker", labelKey: "gembaActionTracker", Icon: Zap },
            ] as { key: ViewMode; labelKey: string; Icon: React.FC<{ className?: string }> }[]
          ).map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => {
                if (v.key === "new-walk") {
                  handleStartNewWalk();
                } else {
                  setView(v.key);
                  setSelectedWalk(null);
                }
              }}
              className={`px-4 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                view === v.key
                  ? "bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800"
                  : "text-th-text-2 hover:bg-th-bg border border-th-border"
              }`}
            >
              <v.Icon className="w-4 h-4" /> {t(`improvement.${v.labelKey}`)}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════ Summary Dashboard ═════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { value: dashboardStats.walksThisMonth, label: t("improvement.gembaWalksThisMonth"), color: "text-teal-600 dark:text-teal-400", Icon: Footprints },
          { value: dashboardStats.totalObs, label: t("improvement.gembaTotalObs"), color: "text-blue-600 dark:text-blue-400", Icon: Eye },
          { value: dashboardStats.totalOpen, label: t("improvement.gembaOpenActions"), color: "text-red-600 dark:text-red-400", Icon: Clock },
          { value: dashboardStats.totalClosed, label: t("improvement.gembaClosedActions"), color: "text-emerald-600 dark:text-emerald-400", Icon: CheckCircle },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 text-center">
            <stat.Icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] text-th-text-3 mt-1 uppercase tracking-wider font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {dashboardStats.totalObs > 0 && (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
          <h3 className="font-semibold text-th-text mb-3 text-xs uppercase tracking-wider">{t("improvement.gembaObsByCategory")}</h3>
          <div className="grid grid-cols-5 gap-2">
            {CATEGORIES.map((cat) => {
              const CatIcon = CATEGORY_ICONS[cat.key];
              return (
                <div key={cat.key} className={`text-center p-3 rounded-lg ${cat.bg} border`}>
                  <CatIcon className={`w-5 h-5 mx-auto mb-1 ${cat.color}`} />
                  <div className={`text-lg font-bold ${cat.color}`}>{dashboardStats.catCounts[cat.key] || 0}</div>
                  <div className="text-[10px] text-th-text-3 leading-tight font-medium">
                    {t(`improvement.gembaCat${cat.key}`)}
                  </div>
                </div>
              );
            })}
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
        <div ref={newWalkRef} className="space-y-5">
          {/* Walk Metadata */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-th-text flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-th-text-3" />
              {t("improvement.gembaNewWalkTitle")}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-th-text-2 mb-1.5 block font-medium">{t("improvement.gembaArea")}</label>
                <select
                  value={walkArea}
                  onChange={(e) => setWalkArea(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-th-border rounded-lg bg-th-bg text-th-text focus:ring-2 focus:ring-teal-500 outline-none transition"
                >
                  {areas.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-th-text-2 mb-1.5 block font-medium">{t("improvement.gembaDate")}</label>
                <input
                  type="date"
                  value={walkDate}
                  onChange={(e) => setWalkDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-th-border rounded-lg bg-th-bg text-th-text focus:ring-2 focus:ring-teal-500 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Add Observation Form */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-th-text flex items-center gap-2 text-sm">
              <Eye className="w-4 h-4 text-th-text-3" />
              {t("improvement.gembaAddObservation")}
            </h3>

            {/* Category selector */}
            <div>
              <label className="text-xs text-th-text-2 mb-1.5 block font-medium">{t("improvement.category")}</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((cat) => {
                  const CatIcon = CATEGORY_ICONS[cat.key];
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setObsCategory(cat.key)}
                      className={`px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-xs border transition flex items-center gap-1.5 ${
                        obsCategory === cat.key
                          ? `${cat.tagBg} font-semibold`
                          : "bg-th-bg text-th-text-2 border-th-border hover:bg-th-bg-2"
                      }`}
                    >
                      <CatIcon className="w-3.5 h-3.5" /> {t(`improvement.gembaCat${cat.key}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-th-text-2 mb-1.5 block font-medium">{t("improvement.description")}</label>
              <textarea
                ref={descRef}
                value={obsDescription}
                onChange={(e) => setObsDescription(e.target.value)}
                rows={3}
                placeholder={t("improvement.describeObservation")}
                className="w-full px-3 py-2 text-sm border border-th-border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none resize-none bg-th-bg text-th-text transition"
              />
            </div>

            {/* Photo placeholder + Severity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-th-text-2 mb-1.5 block font-medium">{t("improvement.gembaPhotoPlaceholder")}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={obsPhoto}
                    onChange={(e) => setObsPhoto(e.target.value)}
                    placeholder={t("improvement.gembaPhotoHint")}
                    className="w-full px-3 py-2 pl-9 text-sm border border-th-border rounded-lg bg-th-bg text-th-text focus:ring-2 focus:ring-teal-500 outline-none transition"
                  />
                  <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-3" />
                </div>
              </div>
              <div>
                <label className="text-xs text-th-text-2 mb-1.5 block font-medium">{t("improvement.gembaSeverity")}</label>
                <div className="flex gap-2">
                  {(["info", "warning", "critical"] as Severity[]).map((sev) => {
                    const cfg = SEVERITY_CONFIG[sev];
                    return (
                      <button
                        key={sev}
                        onClick={() => setObsSeverity(sev)}
                        className={`flex-1 px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-xs border transition text-center flex items-center justify-center gap-1.5 ${
                          obsSeverity === sev
                            ? `${cfg.bg} font-semibold ${cfg.pulse ? "animate-pulse" : ""}`
                            : "bg-th-bg text-th-text-2 border-th-border hover:bg-th-bg-2"
                        }`}
                      >
                        <cfg.Icon className="w-3.5 h-3.5" /> {t(`improvement.${cfg.labelKey}`)}
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
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {t("improvement.gembaAddObs")}
              </button>
            </div>
          </div>

          {/* Observations List */}
          <div className="space-y-3">
            {observations.length === 0 && (
              <div className="text-center py-16 text-th-text-3 rounded-xl border border-th-border bg-th-bg-2 shadow-sm">
                <Footprints className="w-10 h-10 mx-auto mb-3 text-th-text-3 opacity-40" />
                <p className="text-sm">{t("improvement.emptyGemba")}</p>
              </div>
            )}

            {observations.map((obs, idx) => {
              const catCfg = getCatConfig(obs.category);
              const sevCfg = SEVERITY_CONFIG[obs.severity];
              const CatIcon = CATEGORY_ICONS[obs.category];

              return (
                <div key={obs.id} className={`rounded-xl border ${catCfg.bg} p-5 space-y-3 shadow-sm`}>
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    <CatIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${catCfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-bold text-th-text bg-th-bg-2 px-2 py-0.5 rounded-md border border-th-border">
                          #{idx + 1}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${catCfg.tagBg}`}>
                          {t(`improvement.gembaCat${obs.category}`)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-md flex items-center gap-1 ${sevCfg.bg} ${sevCfg.pulse ? "animate-pulse" : ""}`}>
                          <sevCfg.Icon className="w-3 h-3" /> {t(`improvement.${sevCfg.labelKey}`)}
                        </span>
                      </div>
                      <p className="text-sm text-th-text leading-relaxed">{obs.description}</p>
                      {obs.photoPlaceholder && (
                        <div className="mt-2 p-2.5 rounded-lg bg-th-bg border border-th-border flex items-center gap-2">
                          <Camera className="w-4 h-4 text-th-text-3 flex-shrink-0" />
                          <span className="text-xs text-th-text-2">{obs.photoPlaceholder}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeObservation(obs.id)}
                      className="text-th-text-3 hover:text-red-500 transition flex-shrink-0"
                      title={t("improvement.gembaRemove")}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Action items list */}
                  {obs.actions.length > 0 && (
                    <div className="ml-8 space-y-1.5">
                      {obs.actions.map((action) => {
                        const aCfg = ACTION_STATUS_CONFIG[action.status];
                        return (
                          <div key={action.id} className="flex items-center gap-2 text-xs bg-th-bg rounded-lg px-3 py-2 border border-th-border">
                            <button
                              onClick={() => cycleActionStatus(obs.id, action.id)}
                              title={t(`improvement.${aCfg.labelKey}`)}
                              className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                                action.status === "done"
                                  ? "text-emerald-500"
                                  : action.status === "in-progress"
                                  ? "text-amber-500"
                                  : "text-th-text-3 hover:text-teal-500"
                              }`}
                            >
                              <aCfg.Icon className="w-4 h-4" />
                            </button>
                            <span className={`flex-1 ${action.status === "done" ? "line-through text-th-text-3" : "text-th-text"}`}>
                              {action.what}
                            </span>
                            {action.who && (
                              <span className="text-th-text-3 hidden sm:flex items-center gap-1">
                                <User className="w-3 h-3" /> {action.who}
                              </span>
                            )}
                            {action.when && (
                              <span className="text-th-text-3 hidden sm:flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" /> {action.when}
                              </span>
                            )}
                            <button
                              onClick={() => removeActionFromObs(obs.id, action.id)}
                              className="text-th-text-3 hover:text-red-500 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add action form */}
                  <div className="ml-8">
                    {expandedObsAction === obs.id ? (
                      <div className="bg-th-bg rounded-lg p-4 space-y-2.5 border border-th-border">
                        <input
                          type="text"
                          value={actionWhat}
                          onChange={(e) => setActionWhat(e.target.value)}
                          autoFocus
                          placeholder={t("improvement.gembaActionWhat")}
                          className="w-full px-3 py-2 text-xs border border-th-border rounded-lg bg-th-bg text-th-text focus:ring-2 focus:ring-teal-500 outline-none transition"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={actionWho}
                            onChange={(e) => setActionWho(e.target.value)}
                            placeholder={t("improvement.gembaActionWho")}
                            className="px-3 py-2 text-xs border border-th-border rounded-lg bg-th-bg text-th-text focus:ring-2 focus:ring-teal-500 outline-none transition"
                          />
                          <input
                            type="date"
                            value={actionWhen}
                            onChange={(e) => setActionWhen(e.target.value)}
                            className="px-3 py-2 text-xs border border-th-border rounded-lg bg-th-bg text-th-text focus:ring-2 focus:ring-teal-500 outline-none transition"
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
                            className="px-4 py-1.5 min-h-[44px] sm:min-h-0 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                          >
                            {t("improvement.addAction")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setExpandedObsAction(obs.id)}
                        className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium flex items-center gap-1 min-h-[44px] sm:min-h-0"
                      >
                        <Plus className="w-3.5 h-3.5" /> {t("improvement.createAction")}
                      </button>
                    )}
                    {/* Cross-module: create linked item from this observation */}
                    <CreateLinkedAction
                      sourceModule="gemba"
                      sourceId={Number(obs.id) || idx + 1}
                      sourceLabel={obs.description}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save Walk */}
          {observations.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-end">
              {saveSuccess && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
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
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("improvement.gembaSaving")}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t("improvement.gembaSaveWalk")}
                  </>
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
                className="text-sm text-teal-600 dark:text-teal-400 hover:underline font-medium flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> {t("improvement.gembaBackToHistory")}
              </button>

              <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                  <MapPin className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <div>
                    <h3 className="font-bold text-th-text text-lg">{selectedWalk.area}</h3>
                    <p className="text-sm text-th-text-2 flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" /> {selectedWalk.date}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {(selectedWalk.observations ?? []).map((obs, idx) => {
                    const catCfg = CATEGORIES.find((c) => c.key === obs.category) ?? CATEGORIES[0];
                    const sevCfg = SEVERITY_CONFIG[obs.severity] ?? SEVERITY_CONFIG.info;
                    const CatIcon = CATEGORY_ICONS[obs.category] ?? CATEGORY_ICONS.Safety;
                    return (
                      <div key={obs.id ?? idx} className={`rounded-lg p-4 border ${catCfg.bg}`}>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <CatIcon className={`w-4 h-4 ${catCfg.color}`} />
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${catCfg.tagBg}`}>
                            {t(`improvement.gembaCat${obs.category}`)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-md flex items-center gap-1 ${sevCfg.bg}`}>
                            <sevCfg.Icon className="w-3 h-3" /> {t(`improvement.${sevCfg.labelKey}`)}
                          </span>
                        </div>
                        <p className="text-sm text-th-text">{obs.description}</p>
                        {obs.photoPlaceholder && (
                          <p className="text-xs text-th-text-3 mt-1 flex items-center gap-1">
                            <Camera className="w-3 h-3" /> {obs.photoPlaceholder}
                          </p>
                        )}
                        {(obs.actions ?? []).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {obs.actions.map((a, aIdx) => {
                              const aCfg = ACTION_STATUS_CONFIG[a.status] ?? ACTION_STATUS_CONFIG.open;
                              return (
                                <div key={a.id ?? aIdx} className="flex items-center gap-2 text-xs bg-th-bg rounded-lg px-3 py-1.5 border border-th-border">
                                  <aCfg.Icon className={`w-3.5 h-3.5 ${aCfg.color}`} />
                                  <span className={`flex-1 ${a.status === "done" ? "line-through text-th-text-3" : "text-th-text"}`}>
                                    {a.what}
                                  </span>
                                  {a.who && (
                                    <span className="text-th-text-3 flex items-center gap-1">
                                      <User className="w-3 h-3" /> {a.who}
                                    </span>
                                  )}
                                  {a.when && (
                                    <span className="text-th-text-3 flex items-center gap-1">
                                      <CalendarDays className="w-3 h-3" /> {a.when}
                                    </span>
                                  )}
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
            <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-th-border">
                <h3 className="font-semibold text-th-text flex items-center gap-2 text-sm">
                  <ClipboardList className="w-4 h-4 text-th-text-3" />
                  {t("improvement.gembaWalkHistory")}
                  <span className="text-xs font-normal text-th-text-3">({history.length})</span>
                </h3>
              </div>

              {loadingHistory ? (
                <div className="p-8 text-center text-th-text-3">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                  {t("improvement.gembaLoading")}
                </div>
              ) : historyError ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-red-600 dark:text-red-400 mb-2">{historyError}</p>
                  <button onClick={loadHistory} className="text-sm text-teal-600 dark:text-teal-400 hover:underline font-medium">
                    {t("improvement.gembaRetry")}
                  </button>
                </div>
              ) : history.length === 0 ? (
                <div className="p-8 text-center text-th-text-3 text-sm">
                  {t("improvement.gembaNoHistory")}
                </div>
              ) : (
                <div>
                  <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-2.5 bg-th-bg text-[10px] font-semibold text-th-text-3 border-b border-th-border uppercase tracking-wider">
                    <div className="col-span-2">{t("improvement.gembaDate")}</div>
                    <div className="col-span-4">{t("improvement.gembaArea")}</div>
                    <div className="col-span-2 text-center">{t("improvement.observations")}</div>
                    <div className="col-span-2 text-center">{t("improvement.gembaOpenActions")}</div>
                    <div className="col-span-2 text-right"></div>
                  </div>

                  <div className="divide-y divide-th-border">
                    {history.map((walk) => (
                      <button
                        key={walk.id}
                        onClick={() => setSelectedWalk(walk.raw)}
                        className="w-full grid grid-cols-1 md:grid-cols-12 gap-2 px-5 py-3 text-left hover:bg-th-bg transition items-center"
                      >
                        <div className="md:col-span-2 text-sm text-th-text flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-th-text-3" /> {walk.date}
                        </div>
                        <div className="md:col-span-4 text-sm font-medium text-th-text truncate flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-th-text-3 flex-shrink-0" /> {walk.area}
                        </div>
                        <div className="md:col-span-2 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-semibold text-xs border border-blue-200 dark:border-blue-800">
                            {walk.observationCount}
                          </span>
                        </div>
                        <div className="md:col-span-2 text-center">
                          {walk.openActions > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 font-semibold text-xs border border-red-200 dark:border-red-800">
                              {walk.openActions} {t("improvement.gembaStatusOpen")}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 font-semibold text-xs border border-green-200 dark:border-green-800">
                              {t("improvement.gembaAllClosed")}
                            </span>
                          )}
                        </div>
                        <div className="md:col-span-2 text-right text-xs text-teal-600 dark:text-teal-400 font-medium flex items-center justify-end gap-1">
                          {t("improvement.gembaViewDetails")} <ChevronRight className="w-3.5 h-3.5" />
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
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-th-border">
            <h3 className="font-semibold text-th-text flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-th-text-3" />
              {t("improvement.gembaActionTracker")}
              <span className="text-xs font-normal text-th-text-3">
                ({allOpenActions.length} {t("improvement.gembaStatusOpen")})
              </span>
            </h3>
          </div>

          {loadingHistory ? (
            <div className="p-8 text-center text-th-text-3">
              <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
              {t("improvement.gembaLoading")}
            </div>
          ) : allOpenActions.length === 0 ? (
            <div className="p-8 text-center text-th-text-3 text-sm">
              {t("improvement.gembaNoOpenActions")}
            </div>
          ) : (
            <div>
              <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-2.5 bg-th-bg text-[10px] font-semibold text-th-text-3 border-b border-th-border uppercase tracking-wider">
                <div className="col-span-1">{t("improvement.gembaStatus")}</div>
                <div className="col-span-3">{t("improvement.gembaActionWhat")}</div>
                <div className="col-span-2">{t("improvement.gembaActionWho")}</div>
                <div className="col-span-2">{t("improvement.gembaActionWhen")}</div>
                <div className="col-span-2">{t("improvement.gembaArea")}</div>
                <div className="col-span-2">{t("improvement.gembaDate")}</div>
              </div>

              <div className="divide-y divide-th-border">
                {allOpenActions.map((item, idx) => {
                  const aCfg = ACTION_STATUS_CONFIG[item.action.status] ?? ACTION_STATUS_CONFIG.open;
                  return (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 px-5 py-3 items-center hover:bg-th-bg transition">
                      <div className="md:col-span-1">
                        <aCfg.Icon className={`w-4 h-4 ${aCfg.color}`} />
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
