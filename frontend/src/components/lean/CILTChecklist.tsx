"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import {
  ClipboardCheck,
  Droplets,
  Eye,
  Wrench,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  Plus,
  X,
  Settings,
  Play,
  TrendingUp,
  Loader2,
  Check,
  Sparkles,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CILTCategory = "C" | "I" | "L" | "T";
type CheckStatus = "ok" | "nok" | "pending";
type Frequency = "daily" | "weekly" | "monthly";
type MainView = "standards" | "execute";

interface CILTChecklistItem {
  id: string;
  task_description: string;
  category: CILTCategory;
  method: string;
  acceptance_criteria: string;
  time_estimate_minutes: number;
}

interface CILTStandard {
  id: string;
  name: string;
  equipment_area: string;
  frequency: Frequency;
  items: CILTChecklistItem[];
  created_at?: string;
}

interface CheckResult {
  item_id: string;
  status: CheckStatus;
  notes: string;
  timestamp: string;
}

interface ComplianceData {
  overall_rate: number;
  trend: { date: string; rate: number }[];
  overdue: { standard_id: string; standard_name: string; due_date: string }[];
}

interface NewItemForm {
  task_description: string;
  category: CILTCategory;
  method: string;
  acceptance_criteria: string;
  time_estimate_minutes: number;
}

interface NewStandardForm {
  name: string;
  equipment_area: string;
  frequency: Frequency;
  items: NewItemForm[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<CILTCategory, React.ReactNode> = {
  C: <Sparkles className="w-4 h-4" />,
  I: <Eye className="w-4 h-4" />,
  L: <Droplets className="w-4 h-4" />,
  T: <Wrench className="w-4 h-4" />,
};

const CATEGORY_ICONS_LG: Record<CILTCategory, React.ReactNode> = {
  C: <Sparkles className="w-5 h-5" />,
  I: <Eye className="w-5 h-5" />,
  L: <Droplets className="w-5 h-5" />,
  T: <Wrench className="w-5 h-5" />,
};

const CATEGORY_CONFIG: Record<
  CILTCategory,
  { label: string; color: string; bg: string; border: string; badge: string; gradient: string }
> = {
  C: {
    label: "Clean",
    color: "text-th-accent",
    bg: "bg-th-accent/10",
    border: "border-th-accent/30",
    badge: "bg-th-accent/15 text-th-accent border border-th-accent/30",
    gradient: "from-th-accent to-th-accent",
  },
  I: {
    label: "Inspect",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
    gradient: "from-emerald-500 to-emerald-500",
  },
  L: {
    label: "Lubricate",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
    gradient: "from-amber-500 to-amber-500",
  },
  T: {
    label: "Tighten",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30",
    gradient: "from-orange-500 to-orange-500",
  },
};

const FREQUENCY_OPTIONS: { value: Frequency; labelKey: string }[] = [
  { value: "daily", labelKey: "ciltFreqDaily" },
  { value: "weekly", labelKey: "ciltFreqWeekly" },
  { value: "monthly", labelKey: "ciltFreqMonthly" },
];

const EMPTY_ITEM: NewItemForm = {
  task_description: "",
  category: "C",
  method: "",
  acceptance_criteria: "",
  time_estimate_minutes: 5,
};

const EMPTY_STANDARD: NewStandardForm = {
  name: "",
  equipment_area: "",
  frequency: "daily",
  items: [{ ...EMPTY_ITEM }],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} />;
}

function categoryBadge(cat: CILTCategory, t: (k: string) => string) {
  const cfg = CATEGORY_CONFIG[cat];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
      {CATEGORY_ICONS[cat]} {t(`maintenance.ciltCat${cat}`)}
    </span>
  );
}

function frequencyBadge(freq: Frequency, t: (k: string) => string) {
  const colors: Record<Frequency, string> = {
    daily: "bg-th-accent/15 text-th-accent border border-th-accent/30",
    weekly: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30",
    monthly: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[freq]}`}>
      {t(`maintenance.ciltFreq${freq.charAt(0).toUpperCase() + freq.slice(1)}`)}
    </span>
  );
}

// Compliance Gauge
function ComplianceGauge({ rate }: { rate: number }) {
  const size = 120;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius * 0.75;
  const offset = circumference - (rate / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;
  const color = rate >= 90 ? "#10b981" : rate >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx} cy={cy} r={radius} fill="none"
          stroke="currentColor" className="text-th-text-3"
          strokeWidth="8" strokeDasharray={`${circumference} ${circumference * 0.333}`}
          strokeDashoffset={0} strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        <circle
          cx={cx} cy={cy} r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${circumference} ${circumference * 0.333}`}
          strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-th-text">{rate}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CILTChecklist() {
  const { t } = useI18n();
  const { printView, exportToExcel, exportToCSV } = useExport();

  // -- global state --
  const [mainView, setMainView] = useState<MainView>("execute");
  const [standards, setStandards] = useState<CILTStandard[]>([]);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- execute view state --
  const [selectedStandardId, setSelectedStandardId] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [submittingExecution, setSubmittingExecution] = useState(false);
  const [executionMsg, setExecutionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // -- standards view state --
  const [newStdForm, setNewStdForm] = useState<NewStandardForm>({ ...EMPTY_STANDARD });
  const [creatingStandard, setCreatingStandard] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // =========================================================================
  // API calls
  // =========================================================================

  const loadStandards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await advancedLeanApi.listCILTStandards();
      const data = (res as any)?.data;
      if (Array.isArray(data)) {
        setStandards(data);
      } else if (data && typeof data === "object" && Array.isArray(data.standards)) {
        setStandards(data.standards);
      }
    } catch (e: any) {
      setError(t("maintenance.ciltLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadCompliance = useCallback(async () => {
    try {
      const res = await advancedLeanApi.getCILTCompliance();
      const data = (res as any)?.data;
      if (data) {
        setCompliance({
          overall_rate: data.overall_rate ?? data.compliance_rate ?? 0,
          trend: Array.isArray(data.trend) ? data.trend : [],
          overdue: Array.isArray(data.overdue) ? data.overdue : [],
        });
      }
    } catch {
      // compliance is optional
    }
  }, []);

  useEffect(() => {
    loadStandards();
    loadCompliance();
  }, [loadStandards, loadCompliance]);

  // -- create standard --
  const handleCreateStandard = useCallback(async () => {
    if (!newStdForm.name.trim() || !newStdForm.equipment_area.trim()) return;
    if (newStdForm.items.length === 0 || !newStdForm.items[0].task_description.trim()) return;

    setCreatingStandard(true);
    setCreateMsg(null);
    try {
      await advancedLeanApi.createCILTStandard({
        name: newStdForm.name.trim(),
        equipment_area: newStdForm.equipment_area.trim(),
        frequency: newStdForm.frequency,
        items: newStdForm.items
          .filter((i) => i.task_description.trim())
          .map((i) => ({
            task_description: i.task_description.trim(),
            category: i.category,
            method: i.method.trim(),
            acceptance_criteria: i.acceptance_criteria.trim(),
            time_estimate_minutes: i.time_estimate_minutes,
          })),
      });
      setCreateMsg({ type: "ok", text: t("maintenance.ciltStdCreated") });
      setNewStdForm({ ...EMPTY_STANDARD, items: [{ ...EMPTY_ITEM }] });
      setShowCreateForm(false);
      await loadStandards();
    } catch {
      setCreateMsg({ type: "err", text: t("maintenance.ciltStdError") });
    } finally {
      setCreatingStandard(false);
    }
  }, [newStdForm, t, loadStandards]);

  // -- submit execution --
  const handleSubmitExecution = useCallback(async () => {
    if (!selectedStandardId) return;
    const completedChecks = Object.values(checks).filter((c) => c.status !== "pending");
    if (completedChecks.length === 0) return;

    setSubmittingExecution(true);
    setExecutionMsg(null);
    try {
      await advancedLeanApi.executeCILT({
        standard_id: selectedStandardId,
        checks: completedChecks.map((c) => ({
          item_id: c.item_id,
          status: c.status,
          notes: c.notes,
          timestamp: c.timestamp,
        })),
        executed_at: new Date().toISOString(),
      });
      setExecutionMsg({ type: "ok", text: t("maintenance.ciltExecuteSuccess") });
      setChecks({});
      await loadCompliance();
    } catch {
      setExecutionMsg({ type: "err", text: t("maintenance.ciltExecuteError") });
    } finally {
      setSubmittingExecution(false);
    }
  }, [selectedStandardId, checks, t, loadCompliance]);

  // =========================================================================
  // Check handlers
  // =========================================================================

  const toggleCheck = useCallback((itemId: string, status: CheckStatus) => {
    setChecks((prev) => {
      const existing = prev[itemId];
      const newStatus = existing?.status === status ? "pending" : status;
      return {
        ...prev,
        [itemId]: {
          item_id: itemId,
          status: newStatus,
          notes: existing?.notes || "",
          timestamp: new Date().toISOString(),
        },
      };
    });
  }, []);

  const setCheckNote = useCallback((itemId: string, notes: string) => {
    setChecks((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        item_id: itemId,
        status: prev[itemId]?.status || "nok",
        notes,
        timestamp: prev[itemId]?.timestamp || new Date().toISOString(),
      },
    }));
  }, []);

  // =========================================================================
  // Form helpers for standard creation
  // =========================================================================

  const addItem = useCallback(() => {
    setNewStdForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  }, []);

  const removeItem = useCallback((idx: number) => {
    setNewStdForm((f) => ({
      ...f,
      items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items,
    }));
  }, []);

  const updateItem = useCallback((idx: number, field: keyof NewItemForm, value: any) => {
    setNewStdForm((f) => ({
      ...f,
      items: f.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }));
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  // =========================================================================
  // Derived
  // =========================================================================

  const selectedStandard = useMemo(
    () => standards.find((s) => s.id === selectedStandardId) || null,
    [standards, selectedStandardId],
  );

  const executionProgress = useMemo(() => {
    if (!selectedStandard) return { total: 0, completed: 0, ok: 0, nok: 0, pct: 0 };
    const total = selectedStandard.items.length;
    const completed = Object.values(checks).filter((c) => c.status !== "pending").length;
    const ok = Object.values(checks).filter((c) => c.status === "ok").length;
    const nok = Object.values(checks).filter((c) => c.status === "nok").length;
    return { total, completed, ok, nok, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [selectedStandard, checks]);

  // Group items by category for execution view
  const groupedItems = useMemo(() => {
    if (!selectedStandard) return { C: [], I: [], L: [], T: [] } as Record<CILTCategory, CILTChecklistItem[]>;
    const groups: Record<CILTCategory, CILTChecklistItem[]> = { C: [], I: [], L: [], T: [] };
    selectedStandard.items.forEach((item) => {
      if (groups[item.category]) {
        groups[item.category].push(item);
      }
    });
    return groups;
  }, [selectedStandard]);

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true">
      {/* ================================================================== */}
      {/* HEADER                                                              */}
      {/* ================================================================== */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-th-accent/10 flex items-center justify-center text-th-accent">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-th-text">{t("maintenance.ciltTitle")}</h2>
            <p className="text-sm text-th-text-3">{t("maintenance.ciltSubtitle")}</p>
          </div>
          {loading && <Spinner className="w-5 h-5 text-th-text-3" />}
          <ExportToolbar
            onPrint={() => printView({ title: t("maintenance.ciltTitle") || "CILT Checklist" })}
            onExportExcel={() => {
              const selectedStd = standards.find((s) => s.id === selectedStandardId);
              const rows = selectedStd
                ? selectedStd.items.map((item) => {
                    const check = checks[item.id];
                    return {
                      task: item.task_description,
                      category: item.category,
                      method: item.method,
                      criteria: item.acceptance_criteria,
                      time: item.time_estimate_minutes,
                      status: check?.status || "pending",
                      notes: check?.notes || "",
                    };
                  })
                : [];
              exportToExcel({
                filename: `cilt_${selectedStd?.name || "checklist"}`,
                sheetName: "CILT",
                columns: [
                  { key: "task", header: t("maintenance.ciltTask") || "Task", width: 30 },
                  { key: "category", header: t("maintenance.ciltCategory") || "Category", width: 8 },
                  { key: "method", header: t("maintenance.ciltMethod") || "Method", width: 20 },
                  { key: "criteria", header: t("maintenance.ciltCriteria") || "Acceptance Criteria", width: 25 },
                  { key: "time", header: t("maintenance.ciltTime") || "Time (min)", width: 10 },
                  { key: "status", header: t("maintenance.ciltStatus") || "Status", width: 10 },
                  { key: "notes", header: t("maintenance.ciltNotes") || "Notes", width: 25 },
                ],
                rows,
                headerRows: selectedStd ? [[selectedStd.name, selectedStd.equipment_area, selectedStd.frequency]] : [],
              });
            }}
            onExportCSV={() => {
              const selectedStd = standards.find((s) => s.id === selectedStandardId);
              const rows = selectedStd
                ? selectedStd.items.map((item) => {
                    const check = checks[item.id];
                    return {
                      task: item.task_description,
                      category: item.category,
                      method: item.method,
                      criteria: item.acceptance_criteria,
                      time: item.time_estimate_minutes,
                      status: check?.status || "pending",
                      notes: check?.notes || "",
                    };
                  })
                : [];
              exportToCSV({
                filename: `cilt_${selectedStd?.name || "checklist"}`,
                columns: [
                  { key: "task", header: t("maintenance.ciltTask") || "Task" },
                  { key: "category", header: t("maintenance.ciltCategory") || "Category" },
                  { key: "method", header: t("maintenance.ciltMethod") || "Method" },
                  { key: "criteria", header: t("maintenance.ciltCriteria") || "Acceptance Criteria" },
                  { key: "status", header: t("maintenance.ciltStatus") || "Status" },
                  { key: "notes", header: t("maintenance.ciltNotes") || "Notes" },
                ],
                rows,
              });
            }}
          />
        </div>

        {/* View switch */}
        <div className="flex gap-2" role="tablist" aria-label={t("maintenance.ciltTitle")}>
          {(
            [
              { key: "execute" as MainView, labelKey: "ciltViewExecute", icon: <Play className="w-4 h-4" /> },
              { key: "standards" as MainView, labelKey: "ciltViewStandards", icon: <Settings className="w-4 h-4" /> },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={mainView === v.key}
              aria-controls={`cilt-panel-${v.key}`}
              onClick={() => setMainView(v.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                mainView === v.key
                  ? "bg-th-accent text-white"
                  : "bg-th-bg-3 text-th-text-2 hover:bg-th-bg-3/80 border border-th-border"
              }`}
            >
              {v.icon} {t(`maintenance.${v.labelKey}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button
            onClick={() => { setError(null); loadStandards(); }}
            className="ml-auto text-xs font-semibold underline"
          >
            {t("maintenance.ciltRetry")}
          </button>
        </div>
      )}

      {/* ================================================================== */}
      {/* COMPLIANCE DASHBOARD (always visible)                               */}
      {/* ================================================================== */}
      {compliance && (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
          <h3 className="text-xs font-bold text-th-text-2 mb-4 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            {t("maintenance.ciltComplianceTitle")}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Overall rate gauge */}
            <div className="flex flex-col items-center justify-center">
              <ComplianceGauge rate={compliance.overall_rate} />
              <div className="text-xs text-th-text-3 mt-2 font-medium">{t("maintenance.ciltComplianceRate")}</div>
            </div>

            {/* Trend sparkline (CSS bars) */}
            <div className="rounded-xl border border-th-border bg-th-bg-3 p-4">
              <div className="text-xs text-th-text-3 mb-2 font-semibold uppercase tracking-wider">{t("maintenance.ciltTrend")}</div>
              {compliance.trend.length > 0 ? (
                <div className="flex items-end gap-1 h-16">
                  {compliance.trend.slice(-14).map((pt, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-all duration-300 ${
                        pt.rate >= 90
                          ? "bg-emerald-500"
                          : pt.rate >= 70
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                      style={{ height: `${Math.max(pt.rate, 5)}%` }}
                      title={`${pt.date}: ${pt.rate}%`}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-xs text-th-text-3 italic">{t("maintenance.ciltNoData")}</div>
              )}
            </div>

            {/* Overdue */}
            <div className="rounded-xl border border-th-border bg-th-bg-3 p-4">
              <div className="text-xs text-th-text-3 mb-2 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                {t("maintenance.ciltOverdue")}
              </div>
              {compliance.overdue.length > 0 ? (
                <div className="space-y-1.5 max-h-20 overflow-y-auto">
                  {compliance.overdue.map((o, i) => (
                    <div
                      key={i}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 font-medium flex justify-between"
                    >
                      <span className="truncate">{o.standard_name}</span>
                      <span className="shrink-0 ml-2 font-mono">{o.due_date?.slice(5)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> {t("maintenance.ciltAllCurrent")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* STANDARDS VIEW (admin setup)                                        */}
      {/* ================================================================== */}
      {mainView === "standards" && (
        <div className="space-y-4">
          {/* Existing standards list */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-th-text uppercase tracking-wider flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-th-text-2" />
              {t("maintenance.ciltStandardsList")}
            </h3>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 rounded-lg bg-th-accent hover:bg-th-accent/90 text-white text-sm font-semibold transition flex items-center gap-1.5"
            >
              {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showCreateForm ? t("maintenance.ciltCancel") : t("maintenance.ciltNewStandard")}
            </button>
          </div>

          {loading && standards.length === 0 && (
            <div className="flex justify-center py-12">
              <Spinner className="w-8 h-8 text-th-text-3" />
            </div>
          )}

          {!loading && standards.length === 0 && !showCreateForm && (
            <div className="text-center py-12 text-th-text-3 rounded-xl border border-th-border bg-th-bg-2 shadow-sm">
              <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-th-text-3" />
              <p className="text-sm">{t("maintenance.ciltNoStandards")}</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-3 px-4 py-2 rounded-lg bg-th-accent/15 text-th-accent text-sm font-semibold hover:bg-th-accent/25 transition border border-th-accent/30"
              >
                {t("maintenance.ciltCreateFirst")}
              </button>
            </div>
          )}

          {/* Standards list */}
          {standards.length > 0 && (
            <div className="space-y-3">
              {standards.map((std) => (
                <div
                  key={std.id}
                  className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 hover:border-th-accent/30 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-sm text-th-text">{std.name}</h4>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-th-text-2 bg-th-bg-3 px-2.5 py-0.5 rounded-lg">
                          {std.equipment_area}
                        </span>
                        {frequencyBadge(std.frequency, t)}
                        <span className="text-xs text-th-text-3">
                          {std.items?.length || 0} {t("maintenance.ciltItems")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items summary by category */}
                  {std.items && std.items.length > 0 && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {(["C", "I", "L", "T"] as CILTCategory[]).map((cat) => {
                        const count = std.items.filter((i) => i.category === cat).length;
                        if (count === 0) return null;
                        return (
                          <span key={cat} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium ${CATEGORY_CONFIG[cat].badge}`}>
                            {CATEGORY_ICONS[cat]} {count}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Expandable items table */}
                  {std.items && std.items.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-xs text-th-accent cursor-pointer font-semibold hover:underline">
                        {t("maintenance.ciltShowItems")}
                      </summary>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-th-text-3 border-b border-th-border">
                              <th className="py-2 pr-2 font-semibold uppercase tracking-wider text-[10px]">{t("maintenance.ciltCategoryCol")}</th>
                              <th className="py-2 pr-2 font-semibold uppercase tracking-wider text-[10px]">{t("maintenance.ciltTaskCol")}</th>
                              <th className="py-2 pr-2 font-semibold uppercase tracking-wider text-[10px]">{t("maintenance.ciltMethodCol")}</th>
                              <th className="py-2 pr-2 font-semibold uppercase tracking-wider text-[10px]">{t("maintenance.ciltCriteriaCol")}</th>
                              <th className="py-2 font-semibold text-right uppercase tracking-wider text-[10px]">{t("maintenance.ciltTimeCol")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {std.items.map((item, idx) => (
                              <tr key={item.id} className={`border-b border-th-border/50 ${idx % 2 === 1 ? "bg-th-bg-3/50" : ""} hover:bg-th-bg-3 transition`}>
                                <td className="py-2 pr-2">{categoryBadge(item.category, t)}</td>
                                <td className="py-2 pr-2 text-th-text">{item.task_description}</td>
                                <td className="py-2 pr-2 text-th-text-2">{item.method || "\u2014"}</td>
                                <td className="py-2 pr-2 text-th-text-2">{item.acceptance_criteria || "\u2014"}</td>
                                <td className="py-2 text-right text-th-text-2">{item.time_estimate_minutes}m</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ---- Create Standard Form ---- */}
          {showCreateForm && (
            <div className="rounded-xl border border-th-accent/30 bg-th-bg-2 shadow-sm p-6 space-y-5">
              <h3 className="text-sm font-bold text-th-text uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-th-accent" />
                {t("maintenance.ciltCreateTitle")}
              </h3>

              {/* Standard info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1.5 uppercase tracking-wider">
                    {t("maintenance.ciltStdName")} *
                  </label>
                  <input
                    type="text"
                    value={newStdForm.name}
                    onChange={(e) => setNewStdForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t("maintenance.ciltStdNamePlaceholder")}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-th-border bg-th-input text-th-text outline-none focus:ring-2 focus:ring-th-accent/50 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1.5 uppercase tracking-wider">
                    {t("maintenance.ciltEquipmentArea")} *
                  </label>
                  <input
                    type="text"
                    value={newStdForm.equipment_area}
                    onChange={(e) => setNewStdForm((f) => ({ ...f, equipment_area: e.target.value }))}
                    placeholder={t("maintenance.ciltEquipmentAreaPlaceholder")}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-th-border bg-th-input text-th-text outline-none focus:ring-2 focus:ring-th-accent/50 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1.5 uppercase tracking-wider">
                    {t("maintenance.ciltFrequency")}
                  </label>
                  <select
                    value={newStdForm.frequency}
                    onChange={(e) => setNewStdForm((f) => ({ ...f, frequency: e.target.value as Frequency }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-th-border bg-th-input text-th-text outline-none focus:ring-2 focus:ring-th-accent/50 transition"
                  >
                    {FREQUENCY_OPTIONS.map((fo) => (
                      <option key={fo.value} value={fo.value}>
                        {t(`maintenance.${fo.labelKey}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checklist items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-th-text-2 uppercase tracking-wider">
                    {t("maintenance.ciltChecklistItems")}
                  </label>
                  <button
                    onClick={addItem}
                    className="text-xs px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg bg-th-accent/15 text-th-accent font-semibold hover:bg-th-accent/25 transition border border-th-accent/30 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> {t("maintenance.ciltAddItem")}
                  </button>
                </div>

                <div className="space-y-3">
                  {newStdForm.items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl p-4 border ${CATEGORY_CONFIG[item.category].bg} ${CATEGORY_CONFIG[item.category].border}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-th-text-2">
                          {t("maintenance.ciltItemNum")} {idx + 1}
                        </span>
                        {newStdForm.items.length > 1 && (
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 min-h-[44px] sm:min-h-0"
                          >
                            <X className="w-3 h-3" /> {t("maintenance.ciltRemove")}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Task description */}
                        <div className="md:col-span-2">
                          <label className="block text-xs text-th-text-3 mb-1">
                            {t("maintenance.ciltTaskDesc")} *
                          </label>
                          <input
                            type="text"
                            value={item.task_description}
                            onChange={(e) => updateItem(idx, "task_description", e.target.value)}
                            placeholder={t("maintenance.ciltTaskDescPlaceholder")}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-th-border bg-th-input text-th-text outline-none focus:ring-2 focus:ring-th-accent/50 transition"
                          />
                        </div>

                        {/* Category */}
                        <div>
                          <label className="block text-xs text-th-text-3 mb-1">{t("maintenance.ciltCategory")}</label>
                          <div className="flex gap-1">
                            {(["C", "I", "L", "T"] as CILTCategory[]).map((cat) => {
                              const cfg = CATEGORY_CONFIG[cat];
                              return (
                                <button
                                  key={cat}
                                  onClick={() => updateItem(idx, "category", cat)}
                                  className={`flex-1 px-2 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-xs font-semibold transition border flex items-center justify-center gap-1 ${
                                    item.category === cat
                                      ? `${cfg.badge} ring-2 ring-offset-1 ring-current`
                                      : "bg-th-bg-3 text-th-text-3 border-th-border hover:bg-th-bg-3"
                                  }`}
                                >
                                  {CATEGORY_ICONS[cat]} {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Time estimate */}
                        <div>
                          <label className="block text-xs text-th-text-3 mb-1">
                            {t("maintenance.ciltTimeMin")}
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={item.time_estimate_minutes}
                            onChange={(e) =>
                              updateItem(idx, "time_estimate_minutes", parseInt(e.target.value) || 1)
                            }
                            className="w-full px-3 py-2 text-sm rounded-lg border border-th-border bg-th-input text-th-text outline-none focus:ring-2 focus:ring-th-accent/50 transition"
                          />
                        </div>

                        {/* Method */}
                        <div>
                          <label className="block text-xs text-th-text-3 mb-1">{t("maintenance.ciltMethod")}</label>
                          <input
                            type="text"
                            value={item.method}
                            onChange={(e) => updateItem(idx, "method", e.target.value)}
                            placeholder={t("maintenance.ciltMethodPlaceholder")}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-th-border bg-th-input text-th-text outline-none focus:ring-2 focus:ring-th-accent/50 transition"
                          />
                        </div>

                        {/* Acceptance criteria */}
                        <div>
                          <label className="block text-xs text-th-text-3 mb-1">
                            {t("maintenance.ciltAcceptCriteria")}
                          </label>
                          <input
                            type="text"
                            value={item.acceptance_criteria}
                            onChange={(e) => updateItem(idx, "acceptance_criteria", e.target.value)}
                            placeholder={t("maintenance.ciltAcceptCriteriaPlaceholder")}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-th-border bg-th-input text-th-text outline-none focus:ring-2 focus:ring-th-accent/50 transition"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Create message */}
              {createMsg && (
                <div
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 ${
                    createMsg.type === "ok"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30"
                  }`}
                >
                  {createMsg.type === "ok" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {createMsg.text}
                </div>
              )}

              {/* Create button */}
              <div className="flex gap-3">
                <button
                  onClick={handleCreateStandard}
                  disabled={
                    creatingStandard ||
                    !newStdForm.name.trim() ||
                    !newStdForm.equipment_area.trim() ||
                    !newStdForm.items[0]?.task_description.trim()
                  }
                  className="px-6 py-2.5 rounded-lg bg-th-accent hover:bg-th-accent/90 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingStandard && <Spinner className="w-4 h-4 text-white" />}
                  {t("maintenance.ciltCreateBtn")}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewStdForm({ ...EMPTY_STANDARD, items: [{ ...EMPTY_ITEM }] });
                    setCreateMsg(null);
                  }}
                  className="px-6 py-2.5 rounded-lg bg-th-bg-3 hover:bg-th-bg-3/80 text-th-text text-sm font-semibold transition border border-th-border"
                >
                  {t("maintenance.ciltCancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* EXECUTE VIEW (operator daily use)                                    */}
      {/* ================================================================== */}
      {mainView === "execute" && (
        <div className="space-y-4">
          {/* Standard selector */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
            <label className="block text-xs font-semibold text-th-text-2 mb-3 uppercase tracking-wider">
              {t("maintenance.ciltSelectStandard")}
            </label>
            {standards.length === 0 ? (
              <div className="text-sm text-th-text-3 py-2">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> {t("maintenance.ciltLoading")}
                  </span>
                ) : (
                  <span>
                    {t("maintenance.ciltNoStandards")}{" "}
                    <button
                      onClick={() => setMainView("standards")}
                      className="text-th-accent underline font-medium"
                    >
                      {t("maintenance.ciltGoToStandards")}
                    </button>
                  </span>
                )}
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {standards.map((std) => (
                  <button
                    key={std.id}
                    onClick={() => {
                      setSelectedStandardId(std.id === selectedStandardId ? null : std.id);
                      setChecks({});
                      setExecutionMsg(null);
                      setCollapsedCategories({});
                    }}
                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition border ${
                      selectedStandardId === std.id
                        ? "bg-th-accent text-white border-th-accent"
                        : "bg-th-bg-3 text-th-text border-th-border hover:border-th-accent/40"
                    }`}
                  >
                    <div>{std.name}</div>
                    <div className={`text-xs mt-0.5 ${selectedStandardId === std.id ? "text-white/70" : "text-th-text-3"}`}>
                      {std.equipment_area} · {t(`maintenance.ciltFreq${std.frequency.charAt(0).toUpperCase() + std.frequency.slice(1)}`)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Execution checklist */}
          {selectedStandard && (
            <>
              {/* Progress bar */}
              <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-th-text">
                    {selectedStandard.name} — {selectedStandard.equipment_area}
                  </span>
                  <span className="text-lg font-black text-th-accent">
                    {executionProgress.pct}%
                  </span>
                </div>
                <div className="h-3 bg-th-bg-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${executionProgress.pct}%`,
                      background:
                        executionProgress.nok > 0
                          ? "linear-gradient(90deg, #10b981, #f59e0b)"
                          : "linear-gradient(90deg, #10b981, #14b8a6)",
                    }}
                  />
                </div>
                <div className="flex gap-4 mt-2.5 text-xs text-th-text-3">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 text-emerald-500" /> {executionProgress.ok} {t("maintenance.ciltOk")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <XCircle className="w-3 h-3 text-red-500" /> {executionProgress.nok} {t("maintenance.ciltNok")}
                  </span>
                  <span className="ml-auto font-medium">
                    {executionProgress.completed}/{executionProgress.total} {t("maintenance.ciltCompleted")}
                  </span>
                </div>
              </div>

              {/* Checklist items grouped by category */}
              <div className="space-y-4">
                {(["C", "I", "L", "T"] as CILTCategory[]).map((cat) => {
                  const items = groupedItems[cat];
                  if (!items || items.length === 0) return null;
                  const cfg = CATEGORY_CONFIG[cat];
                  const isCollapsed = collapsedCategories[cat] ?? false;
                  const catCompleted = items.filter((item) => checks[item.id]?.status && checks[item.id].status !== "pending").length;

                  return (
                    <div key={cat} className="rounded-xl border border-th-border overflow-hidden">
                      {/* Category header - collapsible */}
                      <button
                        onClick={() => toggleCategory(cat)}
                        className={`w-full flex items-center gap-3 px-5 py-3 ${cfg.bg} border-b ${cfg.border} transition hover:opacity-90`}
                      >
                        <span className={cfg.color}>{CATEGORY_ICONS_LG[cat]}</span>
                        <span className={`text-sm font-bold ${cfg.color} uppercase tracking-wider`}>
                          {t(`maintenance.ciltCat${cat}`)}
                        </span>
                        <span className="text-xs text-th-text-3 ml-1">
                          ({catCompleted}/{items.length})
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                          {/* Mini progress */}
                          <div className="w-16 h-1.5 bg-th-bg-3 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${cfg.gradient} transition-all duration-300`}
                              style={{ width: `${items.length > 0 ? (catCompleted / items.length) * 100 : 0}%` }}
                            />
                          </div>
                          <ChevronDown className={`w-4 h-4 text-th-text-3 transition-transform ${isCollapsed ? "" : "rotate-180"}`} />
                        </div>
                      </button>

                      {/* Items */}
                      {!isCollapsed && (
                        <div className="bg-th-bg-3/50">
                          {items.map((item, idx) => {
                            const check = checks[item.id];
                            const isDone = check && check.status !== "pending";
                            const isOk = check?.status === "ok";
                            const isNok = check?.status === "nok";

                            return (
                              <div
                                key={item.id}
                                className={`px-5 py-4 border-b border-th-border/50 transition-all duration-200 ${
                                  isOk
                                    ? "bg-emerald-500/5"
                                    : isNok
                                      ? "bg-red-500/5"
                                      : idx % 2 === 1 ? "bg-th-bg-3/50" : ""
                                } hover:bg-th-bg-3`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                  {/* Left: checkbox + info */}
                                  <div className="flex items-start gap-3 flex-1">
                                    <button
                                      onClick={() => toggleCheck(item.id, "ok")}
                                      className={`mt-0.5 w-7 h-7 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                                        isOk
                                          ? "bg-emerald-500 border-emerald-500 text-white"
                                          : "border-th-border hover:border-emerald-400"
                                      }`}
                                    >
                                      {isOk && <Check className="w-4 h-4" />}
                                    </button>
                                    <div className="flex-1">
                                      <div className={`font-semibold text-sm ${isDone ? (isOk ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400") : "text-th-text"}`}>
                                        {item.task_description}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {item.method && (
                                          <span className="text-xs text-th-text-3">
                                            {t("maintenance.ciltMethod")}: {item.method}
                                          </span>
                                        )}
                                        {item.acceptance_criteria && (
                                          <span className="text-xs text-th-text-3">
                                            | {item.acceptance_criteria}
                                          </span>
                                        )}
                                        <span className="text-xs text-th-text-3 flex items-center gap-1">
                                          <Clock className="w-3 h-3" /> {item.time_estimate_minutes}m
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right: OK / NOK toggle */}
                                  <div className="flex items-center gap-2 shrink-0" role="group" aria-label={`${item.task_description} - status`}>
                                    <button
                                      onClick={() => toggleCheck(item.id, "ok")}
                                      aria-pressed={isOk}
                                      aria-label={`${item.task_description} - OK`}
                                      className={`px-5 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                                        isOk
                                          ? "bg-emerald-500 text-white"
                                          : "bg-th-bg-3 text-th-text-3 hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-400 border border-th-border"
                                      }`}
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" /> OK
                                    </button>
                                    <button
                                      onClick={() => toggleCheck(item.id, "nok")}
                                      aria-pressed={isNok}
                                      aria-label={`${item.task_description} - NOK`}
                                      className={`px-5 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                                        isNok
                                          ? "bg-red-500 text-white"
                                          : "bg-th-bg-3 text-th-text-3 hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-400 border border-th-border"
                                      }`}
                                    >
                                      <XCircle className="w-3.5 h-3.5" /> NOK
                                    </button>
                                    {isDone && (
                                      <span className="text-[10px] text-th-text-3 font-mono ml-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(check.timestamp).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* NOK notes */}
                                {isNok && (
                                  <div className="mt-3 ml-10">
                                    <input
                                      type="text"
                                      value={check.notes}
                                      onChange={(e) => setCheckNote(item.id, e.target.value)}
                                      placeholder={t("maintenance.ciltDescribeIssue")}
                                      className="w-full px-3 py-2 text-sm border border-red-400/50 rounded-lg bg-red-500/5 focus:ring-2 focus:ring-red-500 outline-none text-th-text transition"
                                    />
                                  </div>
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

              {/* Execution message */}
              {executionMsg && (
                <div
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 ${
                    executionMsg.type === "ok"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30"
                  }`}
                >
                  {executionMsg.type === "ok" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {executionMsg.text}
                </div>
              )}

              {/* Submit execution */}
              {executionProgress.completed > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={handleSubmitExecution}
                    disabled={submittingExecution}
                    className="px-6 py-2.5 rounded-lg bg-th-accent hover:bg-th-accent/90 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {submittingExecution && <Spinner className="w-4 h-4 text-white" />}
                    {t("maintenance.ciltSubmitExecution")} ({executionProgress.completed}/{executionProgress.total})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
