"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import {
  Settings,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Clock,
  Wrench,
  Calendar,
  ClipboardList,
  ChevronLeft,
  Plus,
  X,
  FileText,
  Loader2,
  BarChart3,
  MapPin,
  Activity,
  Columns3,
  GraduationCap,
  ShieldCheck,
  Briefcase,
  Target,
  BookOpen,
  HeartPulse,
} from "lucide-react";

/* ───────── Types ───────── */

interface Equipment {
  id: number;
  name: string;
  type: string;
  location: string;
  criticality: "A" | "B" | "C";
  status: "running" | "maintenance" | "breakdown";
  oee: number;
  mtbf_hours: number;
  mttr_hours: number;
  next_pm: string;
  last_maintenance: string;
  maintenance_interval_days: number;
}

interface MaintenanceLog {
  id: number;
  equipment_id: number;
  date: string;
  type: "PM" | "CM" | "Autonomous";
  description: string;
  duration_hours: number;
  technician: string;
  parts_replaced: string;
}

/* Demo / fallback data removed — component relies on API data */

/* ───────── Style maps ───────── */

const statusStyleMap: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  running: {
    bg: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-700 dark:text-green-400",
    dot: "bg-emerald-500",
    border: "border-green-200 dark:border-green-800",
  },
  maintenance: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500 animate-pulse",
    border: "border-amber-200 dark:border-amber-800",
  },
  breakdown: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500 animate-pulse-slow",
    border: "border-red-200 dark:border-red-800",
  },
};
const defaultStatusStyle = {
  bg: "bg-gray-50 dark:bg-gray-900/20",
  text: "text-gray-700 dark:text-gray-400",
  dot: "bg-gray-500",
  border: "border-gray-200 dark:border-gray-800",
};
function getStatusStyle(status: string | undefined | null) {
  if (!status) return defaultStatusStyle;
  return statusStyleMap[status.toLowerCase()] || defaultStatusStyle;
}

const critColor: Record<string, string> = {
  A: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800",
  B: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800",
  C: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800",
};

const maintTypeStyle: Record<string, string> = {
  PM: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800",
  CM: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800",
  Autonomous: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200 dark:border-purple-800",
};

/* ───────── Helpers ───────── */

type TabId = "equipment" | "pillars" | "calendar" | "history";

function getHealthColor(nextPm: string | undefined | null): "green" | "yellow" | "red" {
  if (!nextPm) return "red";
  const now = Date.now();
  const pmDate = new Date(nextPm).getTime();
  const daysUntilPm = (pmDate - now) / 86_400_000;
  if (daysUntilPm < 0) return "red";
  if (daysUntilPm <= 3) return "yellow";
  return "green";
}

const healthDot: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500 animate-pulse",
  red: "bg-red-500 animate-pulse-slow",
};

function buildCalendarDays(equipment: Equipment[]): { date: string; items: Equipment[] }[] {
  const today = new Date();
  const days: { date: string; items: Equipment[] }[] = [];
  for (let d = 0; d < 28; d++) {
    const day = new Date(today);
    day.setDate(today.getDate() + d);
    const iso = day.toISOString().slice(0, 10);
    days.push({ date: iso, items: equipment.filter((eq) => eq.next_pm === iso) });
  }
  return days;
}

function formatDate(iso: string): string {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

/* ───────── Component ───────── */

export default function TPMDashboard() {
  const { t } = useI18n();
  const { printView, exportToExcel } = useExport();

  /* -- state -- */
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [selectedTab, setSelectedTab] = useState<TabId>("equipment");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const usingDemo = false; // demo fallbacks removed

  // Add-equipment form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEq, setNewEq] = useState({
    name: "",
    type: "",
    location: "",
    criticality: "B" as "A" | "B" | "C",
    maintenance_interval_days: 30,
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Log-maintenance modal
  const [showLogForm, setShowLogForm] = useState(false);
  const [logEqId, setLogEqId] = useState<number | null>(null);
  const [newLog, setNewLog] = useState({
    type: "PM" as MaintenanceLog["type"],
    description: "",
    duration_hours: 1,
    technician: "",
    parts_replaced: "",
  });
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  // Overdue PM alerts
  const [overdueList, setOverdueList] = useState<{id: number; name: string; location: string | null; criticality: string; next_planned_maintenance: string | null; maintenance_interval_days: number | null; last_maintenance_date: string | null}[]>([]);

  // Equipment detail view
  const [detailEqId, setDetailEqId] = useState<number | null>(null);

  // History filter
  const [historyEqId, setHistoryEqId] = useState<number | null>(null);

  /* -- data fetching -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eqRes, overdueRes] = await Promise.all([
        advancedLeanApi.listEquipment(),
        advancedLeanApi.getOverdueEquipment().catch(() => ({ data: [] })),
      ]);
      const rawItems = eqRes.data?.data ?? eqRes.data ?? [];
      const items: Equipment[] = Array.isArray(rawItems) ? rawItems : [];
      setEquipment(items);
      const rawOverdue = overdueRes.data?.data ?? overdueRes.data ?? [];
      setOverdueList(Array.isArray(rawOverdue) ? rawOverdue : []);
    } catch {
      setEquipment([]);
      setMaintenanceLogs([]);
      setOverdueList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* -- derived KPIs -- */
  const totalEquipment = equipment.length;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const overduePMs = useMemo(
    () => equipment.filter((e) => getHealthColor(e.next_pm) === "red").length,
    [equipment],
  );

  const completedThisMonth = useMemo(() => {
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    return maintenanceLogs.filter((l) => l.date >= monthStart).length;
  }, [maintenanceLogs, now]);

  const avgMTBF = useMemo(() => {
    if (!equipment.length) return 0;
    return Math.round(equipment.reduce((s, e) => s + e.mtbf_hours, 0) / equipment.length);
  }, [equipment]);

  const avgMTTR = useMemo(() => {
    if (!equipment.length) return 0;
    return +(equipment.reduce((s, e) => s + e.mttr_hours, 0) / equipment.length).toFixed(1);
  }, [equipment]);

  const statusCounts = useMemo(() => {
    const counts = { running: 0, maintenance: 0, breakdown: 0 };
    equipment.forEach((e) => {
      const s = e.status || "running"; if (s in counts) counts[s as keyof typeof counts]++;
    });
    return counts;
  }, [equipment]);

  const calendarDays = useMemo(() => buildCalendarDays(equipment), [equipment]);

  const filteredLogs = useMemo(
    () =>
      (historyEqId
        ? maintenanceLogs.filter((l) => l.equipment_id === historyEqId)
        : maintenanceLogs
      ).sort((a, b) => b.date.localeCompare(a.date)),
    [maintenanceLogs, historyEqId],
  );

  const detailEquipment = useMemo(
    () => (detailEqId ? equipment.find((e) => e.id === detailEqId) ?? null : null),
    [equipment, detailEqId],
  );

  const detailLogs = useMemo(
    () =>
      detailEqId
        ? maintenanceLogs
            .filter((l) => l.equipment_id === detailEqId)
            .sort((a, b) => b.date.localeCompare(a.date))
        : [],
    [maintenanceLogs, detailEqId],
  );

  /* -- handlers -- */
  const handleAddEquipment = async () => {
    if (!newEq.name.trim()) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const payload = {
        name: newEq.name,
        type: newEq.type || "General",
        location: newEq.location || "Unassigned",
        criticality: newEq.criticality,
        status: "running",
        oee: 0,
        mtbf_hours: 0,
        mttr_hours: 0,
        maintenance_interval_days: newEq.maintenance_interval_days,
        last_maintenance: todayIso,
        next_pm: new Date(Date.now() + newEq.maintenance_interval_days * 86_400_000)
          .toISOString()
          .slice(0, 10),
      };
      const res = await advancedLeanApi.createEquipment(payload);
      const created = res.data?.data ?? res.data;
      if (created?.id) {
        setEquipment((prev) => [...prev, created as Equipment]);
      } else {
        throw new Error("no_id");
      }
    } catch {
      const localId = Math.max(0, ...equipment.map((e) => e.id)) + 1;
      setEquipment((prev) => [
        ...prev,
        {
          id: localId,
          name: newEq.name,
          type: newEq.type || "General",
          location: newEq.location || "Unassigned",
          criticality: newEq.criticality,
          status: "running",
          oee: 0,
          mtbf_hours: 0,
          mttr_hours: 0,
          maintenance_interval_days: newEq.maintenance_interval_days,
          last_maintenance: todayIso,
          next_pm: new Date(Date.now() + newEq.maintenance_interval_days * 86_400_000)
            .toISOString()
            .slice(0, 10),
        },
      ]);
    } finally {
      setNewEq({ name: "", type: "", location: "", criticality: "B", maintenance_interval_days: 30 });
      setShowAddForm(false);
      setAddLoading(false);
    }
  };

  const handleLogMaintenance = async () => {
    if (!logEqId || !newLog.description.trim()) return;
    setLogLoading(true);
    setLogError(null);
    try {
      await advancedLeanApi.logMaintenance({
        equipment_id: logEqId,
        date: todayIso,
        type: newLog.type,
        description: newLog.description,
        duration_hours: newLog.duration_hours,
        technician: newLog.technician,
        parts_replaced: newLog.parts_replaced,
      });
    } catch {
      // offline: proceed with local add
    }
    const localId = Math.max(0, ...maintenanceLogs.map((l) => l.id)) + 1;
    setMaintenanceLogs((prev) => [
      ...prev,
      {
        id: localId,
        equipment_id: logEqId,
        date: todayIso,
        type: newLog.type,
        description: newLog.description,
        duration_hours: newLog.duration_hours,
        technician: newLog.technician,
        parts_replaced: newLog.parts_replaced,
      },
    ]);
    setEquipment((prev) =>
      prev.map((eq) => {
        if (eq.id !== logEqId) return eq;
        const nextPm = new Date(Date.now() + eq.maintenance_interval_days * 86_400_000)
          .toISOString()
          .slice(0, 10);
        return { ...eq, last_maintenance: todayIso, next_pm: nextPm };
      }),
    );
    // Remove from overdue list since maintenance was just logged
    setOverdueList((prev) => prev.filter((eq) => eq.id !== logEqId));
    setNewLog({ type: "PM", description: "", duration_hours: 1, technician: "", parts_replaced: "" });
    setShowLogForm(false);
    setLogEqId(null);
    setLogLoading(false);
  };

  const openLogForEquipment = (eqId: number) => {
    setLogEqId(eqId);
    setLogError(null);
    setShowLogForm(true);
  };

  const closeLogForm = () => {
    setShowLogForm(false);
    setLogEqId(null);
    setLogError(null);
    setNewLog({ type: "PM", description: "", duration_hours: 1, technician: "", parts_replaced: "" });
  };

  /* -- tab definitions -- */
  const tabs: { id: TabId; labelKey: string; fallback: string; icon: React.ReactNode }[] = [
    { id: "equipment", labelKey: "tpmEquipmentTab", fallback: "Equipment", icon: <Settings className="w-4 h-4" /> },
    { id: "pillars", labelKey: "tpmPillarsTab", fallback: "8 Pillars", icon: <Columns3 className="w-4 h-4" /> },
    { id: "calendar", labelKey: "tpmCalendarTab", fallback: "PM Calendar", icon: <Calendar className="w-4 h-4" /> },
    { id: "history", labelKey: "tpmHistoryTab", fallback: "History", icon: <ClipboardList className="w-4 h-4" /> },
  ];

  /* -- shared input class -- */
  const inputCls =
    "px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-colors";

  /* ───────── Render ───────── */
  return (
    <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true" role="region" aria-label="TPM Dashboard">

      {/* ── Header ── */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Wrench className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-th-text tracking-tight">{t("maintenance.tpmTitle") || "TPM Dashboard"}</h2>
            <p className="text-sm text-th-text-3 mt-0.5">{t("maintenance.tpmSubtitle") || "Total Productive Maintenance"}</p>
          </div>
          {usingDemo && (
            <span className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full px-3 py-1">
              {t("maintenance.demoMode") || "Demo"}
            </span>
          )}
        </div>

        {/* Status distribution bar */}
        <div className="mt-5">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-th-text-3">
              {t("maintenance.tpmFleetHealth") || "Fleet Health"}
            </span>
            <div className="flex-1 h-px bg-th-border" />
          </div>
          <div className="flex gap-4 flex-wrap">
            {[
              { key: "running", count: statusCounts.running, color: "emerald", label: t("maintenance.statusRunning") || "Running" },
              { key: "maintenance", count: statusCounts.maintenance, color: "amber", label: t("maintenance.statusMaintenance") || "Maintenance" },
              { key: "breakdown", count: statusCounts.breakdown, color: "red", label: t("maintenance.statusBreakdown") || "Breakdown" },
            ].map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${s.key === "running" ? "bg-emerald-500" : s.key === "maintenance" ? "bg-amber-500 animate-pulse" : "bg-red-500 animate-pulse-slow"}`} />
                <span className="text-th-text-2 text-sm">{s.label}</span>
                <span className="text-th-text font-bold text-sm">{s.count}</span>
              </div>
            ))}
          </div>
          {/* Visual bar */}
          <div className="mt-3 h-2 rounded-full bg-th-bg overflow-hidden flex border border-th-border">
            {totalEquipment > 0 && (
              <>
                <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(statusCounts.running / totalEquipment) * 100}%` }} />
                <div className="h-full bg-amber-500 transition-all duration-700" style={{ width: `${(statusCounts.maintenance / totalEquipment) * 100}%` }} />
                <div className="h-full bg-red-500 transition-all duration-700" style={{ width: `${(statusCounts.breakdown / totalEquipment) * 100}%` }} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Export Toolbar ── */}
      <ExportToolbar
        onPrint={() => printView(t("common.titleTpm"))}
        onExportExcel={() =>
          exportToExcel({
            title: t("common.titleTpm"),
            columns: [
              t("maintenance.tpmEqName") || "Equipment",
              t("maintenance.tpmEqLocation") || "Location",
              t("maintenance.tpmLastMaintenance") || "Last Maintenance",
              t("maintenance.tpmStatus") || "Status",
              "MTBF (h)",
              "MTTR (h)",
            ],
            rows: equipment.map((eq) => [
              eq.name,
              eq.location,
              eq.last_maintenance,
              eq.status,
              String(eq.mtbf_hours),
              String(eq.mttr_hours),
            ]),
          })
        }
      />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          {
            labelKey: "tpmTotalEquipment",
            value: totalEquipment,
            fallback: "Total Equipment",
            color: "blue",
            icon: <Settings className="w-5 h-5" />,
          },
          {
            labelKey: "tpmOverduePMs",
            value: overduePMs,
            fallback: "Overdue PMs",
            color: overduePMs > 0 ? "red" : "emerald",
            icon: <AlertTriangle className="w-5 h-5" />,
          },
          {
            labelKey: "tpmCompletedMonth",
            value: completedThisMonth,
            fallback: "Completed This Month",
            color: "emerald",
            icon: <CheckCircle className="w-5 h-5" />,
          },
          {
            labelKey: "tpmAvgMTBF",
            value: `${avgMTBF}h`,
            fallback: "Avg MTBF",
            color: "indigo",
            icon: <TrendingUp className="w-5 h-5" />,
          },
          {
            labelKey: "tpmAvgMTTR",
            value: `${avgMTTR}h`,
            fallback: "Avg MTTR",
            color: "amber",
            icon: <Clock className="w-5 h-5" />,
          },
        ].map((kpi) => (
          <div
            key={kpi.labelKey}
            className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-3xl font-bold text-th-text leading-none">{kpi.value}</div>
                <div className="text-xs text-th-text-3 mt-1.5 uppercase tracking-wider font-medium">{t(`maintenance.${kpi.labelKey}`) || kpi.fallback}</div>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                kpi.color === "blue" ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" :
                kpi.color === "red" ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" :
                kpi.color === "emerald" ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" :
                kpi.color === "indigo" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400" :
                "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
              }`}>
                {kpi.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1.5 p-1 rounded-xl border border-th-border bg-th-bg-2 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setSelectedTab(tab.id); setDetailEqId(null); }}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              selectedTab === tab.id
                ? "bg-th-bg text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-th-text-3 hover:text-th-text hover:bg-th-bg/50"
            }`}
          >
            {tab.icon}
            {t(`maintenance.${tab.labelKey}`) || tab.fallback}
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <span className="ml-4 text-th-text-2 text-sm">{t("maintenance.loading") || "Loading..."}</span>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400 text-sm flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 dark:hover:text-red-300 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Overdue PM Alerts ── */}
      {!loading && overdueList.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                {t("maintenance.tpmOverdueAlerts") || "Overdue PM Alerts"}
              </h3>
              <p className="text-xs text-red-600 dark:text-red-400/80">
                {overdueList.length} {overdueList.length === 1
                  ? (t("maintenance.tpmEquipmentOverdue") || "equipment has overdue preventive maintenance")
                  : (t("maintenance.tpmEquipmentOverduePlural") || "equipment have overdue preventive maintenance")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {overdueList.map((eq) => (
              <div
                key={eq.id}
                className="flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-red-950/30 px-3 py-2 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                onClick={() => { setSelectedTab("equipment"); setDetailEqId(eq.id); }}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-red-700 dark:text-red-400 truncate">{eq.name}</div>
                  <div className="text-xs text-red-500 dark:text-red-400/70">
                    {t("maintenance.tpmDueSince") || "Due since"} {eq.next_planned_maintenance ? formatDate(eq.next_planned_maintenance) : "\u2014"}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); openLogForEquipment(eq.id); }}
                  className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition flex-shrink-0"
                >
                  {t("maintenance.tpmLogMaintenance") || "Log PM"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ TAB: Equipment Registry ═══════════ */}
      {!loading && selectedTab === "equipment" && !detailEqId && (
        <div className="space-y-4">
          {/* Add equipment button */}
          <div className="flex justify-end">
            <button
              onClick={() => { setShowAddForm(!showAddForm); setAddError(null); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {t("maintenance.tpmAddEquipment") || "Add Equipment"}
            </button>
          </div>

          {/* Add equipment form */}
          {showAddForm && (
            <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 space-y-4">
              <h3 className="font-semibold text-th-text uppercase tracking-wider text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-th-text-3" />
                {t("maintenance.tpmAddEquipment") || "Add Equipment"}
              </h3>
              {addError && (
                <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder={t("maintenance.tpmEqName") || "Equipment Name"}
                  value={newEq.name}
                  onChange={(e) => setNewEq({ ...newEq, name: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="text"
                  placeholder={t("maintenance.tpmEqType") || "Type (CNC, Press, Robot...)"}
                  value={newEq.type}
                  onChange={(e) => setNewEq({ ...newEq, type: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="text"
                  placeholder={t("maintenance.tpmEqLocation") || "Location"}
                  value={newEq.location}
                  onChange={(e) => setNewEq({ ...newEq, location: e.target.value })}
                  className={inputCls}
                />
                <select
                  value={newEq.criticality}
                  onChange={(e) => setNewEq({ ...newEq, criticality: e.target.value as "A" | "B" | "C" })}
                  className={inputCls}
                >
                  <option value="A">{t("maintenance.critA") || "A - Critical"}</option>
                  <option value="B">{t("maintenance.critB") || "B - Important"}</option>
                  <option value="C">{t("maintenance.critC") || "C - Standard"}</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    placeholder={t("maintenance.tpmIntervalDays") || "PM Interval (days)"}
                    value={newEq.maintenance_interval_days}
                    onChange={(e) => setNewEq({ ...newEq, maintenance_interval_days: Number(e.target.value) || 30 })}
                    className={inputCls + " flex-1"}
                  />
                  <span className="text-xs text-th-text-3 whitespace-nowrap">{t("maintenance.days") || "days"}</span>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowAddForm(false); setAddError(null); }}
                  className="px-4 py-2 rounded-lg text-sm text-th-text-2 hover:bg-th-bg transition"
                >
                  {t("common.cancel") || "Cancel"}
                </button>
                <button
                  onClick={handleAddEquipment}
                  disabled={addLoading || !newEq.name.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {addLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("maintenance.saving") || "Saving..."}
                    </span>
                  ) : (
                    t("common.save") || "Save"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Equipment cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {equipment.map((eq) => {
              const health = getHealthColor(eq.next_pm);
              const st = getStatusStyle(eq.status);
              return (
                <div
                  key={eq.id}
                  onClick={() => setDetailEqId(eq.id)}
                  className="group rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 cursor-pointer hover:shadow-md transition-all duration-200"
                >
                  {/* Status indicator */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`relative w-2.5 h-2.5 rounded-full ${st.dot}`}>
                        {(eq.status || "running") !== "running" && (
                          <span className={`absolute inset-0 rounded-full ${st.dot} animate-ping opacity-50`} />
                        )}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text} border ${st.border}`}>
                        {t(`maintenance.status${(eq.status || "running").charAt(0).toUpperCase() + (eq.status || "running").slice(1)}`) || eq.status}
                      </span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${critColor[eq.criticality] || critColor["C"]}`}>
                      {eq.criticality}
                    </span>
                  </div>

                  {/* Name + location */}
                  <h4 className="text-base font-bold text-th-text mb-0.5 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{eq.name}</h4>
                  <p className="text-xs text-th-text-3 mb-3">{eq.type} &middot; {eq.location}</p>

                  {/* KPI row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-th-bg rounded-lg p-2 text-center border border-th-border">
                      <div className={`text-lg font-bold ${eq.oee >= 85 ? "text-green-600 dark:text-green-400" : eq.oee >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                        {eq.oee}%
                      </div>
                      <div className="text-[9px] text-th-text-3 uppercase tracking-wider font-medium">OEE</div>
                    </div>
                    <div className="bg-th-bg rounded-lg p-2 text-center border border-th-border">
                      <div className="text-lg font-bold text-th-text">{eq.mtbf_hours}h</div>
                      <div className="text-[9px] text-th-text-3 uppercase tracking-wider font-medium">MTBF</div>
                    </div>
                    <div className="bg-th-bg rounded-lg p-2 text-center border border-th-border">
                      <div className="text-lg font-bold text-th-text">{eq.mttr_hours}h</div>
                      <div className="text-[9px] text-th-text-3 uppercase tracking-wider font-medium">MTTR</div>
                    </div>
                  </div>

                  {/* Next PM */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-th-text-3">{t("maintenance.nextPm") || "Next PM"}</span>
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${healthDot[health]}`} />
                      <span className={`font-semibold ${health === "red" ? "text-red-600 dark:text-red-400" : health === "yellow" ? "text-amber-600 dark:text-amber-400" : "text-th-text-2"}`}>
                        {formatDate(eq.next_pm)}
                      </span>
                    </span>
                  </div>

                  {/* Action */}
                  <div className="mt-3 pt-3 border-t border-th-border">
                    <button
                      onClick={(e) => { e.stopPropagation(); openLogForEquipment(eq.id); }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      title={t("maintenance.tpmLogMaintenance") || "Log Maintenance"}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      {t("maintenance.tpmLogMaintenance") || "Log PM"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {equipment.length === 0 && (
            <div className="text-center py-16 text-th-text-3 text-sm">
              {t("maintenance.tpmNoEquipment") || "No equipment registered. Add your first machine above."}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Equipment Detail View ═══════════ */}
      {!loading && selectedTab === "equipment" && detailEqId && detailEquipment && (
        <div className="space-y-4">
          {/* Back button */}
          <button
            onClick={() => setDetailEqId(null)}
            className="flex items-center gap-1.5 text-sm text-th-text-3 hover:text-amber-500 transition group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            {t("maintenance.tpmBackToList") || "Back to equipment list"}
          </button>

          {/* Equipment info card */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-start gap-5">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-th-text">{detailEquipment.name}</h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${critColor[detailEquipment.criticality]}`}>
                    {t(`maintenance.crit${detailEquipment.criticality}`) || `Criticality ${detailEquipment.criticality}`}
                  </span>
                  {(() => {
                    const st = getStatusStyle(detailEquipment.status);
                    return (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text} border ${st.border}`}>
                        {t(`maintenance.status${(detailEquipment.status || "running").charAt(0).toUpperCase() + (detailEquipment.status || "running").slice(1)}`) || detailEquipment.status}
                      </span>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-th-text-3 text-xs uppercase tracking-wider font-medium flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {t("maintenance.tpmEqType") || "Type"}
                    </div>
                    <div className="text-th-text font-semibold mt-0.5">{detailEquipment.type}</div>
                  </div>
                  <div>
                    <div className="text-th-text-3 text-xs uppercase tracking-wider font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {t("maintenance.tpmEqLocation") || "Location"}
                    </div>
                    <div className="text-th-text font-semibold mt-0.5">{detailEquipment.location}</div>
                  </div>
                  <div>
                    <div className="text-th-text-3 text-xs uppercase tracking-wider font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {t("maintenance.tpmLastMaintenance") || "Last Maintenance"}
                    </div>
                    <div className="text-th-text font-semibold mt-0.5">{formatDate(detailEquipment.last_maintenance)}</div>
                  </div>
                  <div>
                    <div className="text-th-text-3 text-xs uppercase tracking-wider font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t("maintenance.tpmIntervalDays") || "PM Interval"}
                    </div>
                    <div className="text-th-text font-semibold mt-0.5">{detailEquipment.maintenance_interval_days} {t("maintenance.days") || "days"}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-center">
                {[
                  {
                    value: `${detailEquipment.oee}%`,
                    label: "OEE",
                    colorClass: detailEquipment.oee >= 85 ? "text-green-600 dark:text-green-400" : detailEquipment.oee >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400",
                  },
                  { value: `${detailEquipment.mtbf_hours}h`, label: "MTBF", colorClass: "text-th-text" },
                  { value: `${detailEquipment.mttr_hours}h`, label: "MTTR", colorClass: "text-th-text" },
                ].map((m) => (
                  <div key={m.label} className="bg-th-bg rounded-xl px-5 py-3 min-w-[90px] border border-th-border">
                    <div className={`text-2xl font-bold ${m.colorClass}`}>{m.value}</div>
                    <div className="text-[10px] text-th-text-3 uppercase tracking-wider font-medium mt-0.5">{m.label}</div>
                  </div>
                ))}
                <div className="bg-th-bg rounded-xl px-5 py-3 min-w-[90px] border border-th-border">
                  {(() => {
                    const h = getHealthColor(detailEquipment.next_pm);
                    return (
                      <>
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${healthDot[h]}`} />
                          <span className={`text-sm font-bold ${h === "red" ? "text-red-600 dark:text-red-400" : h === "yellow" ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                            {formatDate(detailEquipment.next_pm)}
                          </span>
                        </div>
                        <div className="text-[10px] text-th-text-3 uppercase tracking-wider font-medium mt-0.5">{t("maintenance.nextPm") || "Next PM"}</div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => openLogForEquipment(detailEquipment.id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
              >
                <Wrench className="w-4 h-4" />
                {t("maintenance.tpmLogMaintenance") || "Log Maintenance"}
              </button>
            </div>
          </div>

          {/* Upcoming PM schedule - timeline */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
            <h4 className="font-semibold text-th-text mb-4 uppercase tracking-wider text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-th-text-3" />
              {t("maintenance.tpmUpcomingPM") || "Upcoming PM Schedule"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((mult) => {
                const nextDate = new Date(detailEquipment.next_pm);
                nextDate.setDate(nextDate.getDate() + mult * detailEquipment.maintenance_interval_days);
                const iso = nextDate.toISOString().slice(0, 10);
                const isPast = iso < todayIso;
                return (
                  <div
                    key={mult}
                    className={`relative rounded-xl p-4 text-center border transition-all ${
                      isPast
                        ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                        : mult === 0
                          ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
                          : "border-th-border bg-th-bg"
                    }`}
                  >
                    {isPast && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                    <div className="font-bold text-th-text">{formatDate(iso)}</div>
                    <div className={`text-xs mt-1 font-medium ${isPast ? "text-red-600 dark:text-red-400" : mult === 0 ? "text-amber-600 dark:text-amber-400" : "text-th-text-3"}`}>
                      {isPast
                        ? t("maintenance.tpmOverdue") || "OVERDUE"
                        : mult === 0
                          ? t("maintenance.tpmNextScheduled") || "Next Scheduled"
                          : `+${mult * detailEquipment.maintenance_interval_days} ${t("maintenance.days") || "days"}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Maintenance history for this equipment */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
            <h4 className="font-semibold text-th-text mb-4 uppercase tracking-wider text-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-th-text-3" />
              {t("maintenance.tpmMaintenanceHistory") || "Maintenance History"}
            </h4>
            {detailLogs.length === 0 ? (
              <p className="text-sm text-th-text-3">{t("maintenance.tpmNoLogs") || "No maintenance logs recorded for this equipment."}</p>
            ) : (
              <div className="space-y-2">
                {detailLogs.map((log) => (
                  <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-th-border bg-th-bg hover:bg-th-bg-2 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-th-text font-medium">{log.description}</div>
                      {log.parts_replaced && (
                        <div className="text-xs text-th-text-3 mt-0.5">
                          {t("maintenance.tpmPartsReplaced") || "Parts"}: {log.parts_replaced}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs items-center">
                      <span className={`px-2.5 py-1 rounded-full font-semibold ${maintTypeStyle[log.type]}`}>{log.type}</span>
                      <span className="text-th-text-2">{formatDate(log.date)}</span>
                      <span className="text-th-text-2">{log.duration_hours}h</span>
                      <span className="text-th-text-3">{log.technician}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ TAB: 8 Pillars Overview ═══════════ */}
      {!loading && selectedTab === "pillars" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-th-text text-lg uppercase tracking-wider flex items-center gap-2">
            <Columns3 className="w-5 h-5 text-th-text-3" />
            {t("maintenance.tpmPillarsTitle") || "The 8 Pillars of TPM"}
          </h3>
          <p className="text-sm text-th-text-3">{t("maintenance.tpmPillarsDesc") || "Total Productive Maintenance is built on 8 foundational pillars. Each pillar addresses a specific area of manufacturing excellence."}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              { key: "autonomous", icon: <Wrench className="w-6 h-6" />, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-200 dark:border-blue-800", descKey: "tpmPillarAutonomousDesc", linkTab: "equipment" as TabId },
              { key: "planned", icon: <Calendar className="w-6 h-6" />, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-800", descKey: "tpmPillarPlannedDesc", linkTab: "calendar" as TabId },
              { key: "quality", icon: <ShieldCheck className="w-6 h-6" />, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-200 dark:border-purple-800", descKey: "tpmPillarQualityDesc", linkTab: null },
              { key: "focused", icon: <Target className="w-6 h-6" />, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-200 dark:border-amber-800", descKey: "tpmPillarFocusedDesc", linkTab: null },
              { key: "early", icon: <Activity className="w-6 h-6" />, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-200 dark:border-cyan-800", descKey: "tpmPillarEarlyDesc", linkTab: null },
              { key: "training", icon: <GraduationCap className="w-6 h-6" />, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-200 dark:border-indigo-800", descKey: "tpmPillarTrainingDesc", linkTab: null },
              { key: "safety", icon: <HeartPulse className="w-6 h-6" />, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-200 dark:border-red-800", descKey: "tpmPillarSafetyDesc", linkTab: null },
              { key: "office", icon: <Briefcase className="w-6 h-6" />, color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-200 dark:border-slate-800", descKey: "tpmPillarOfficeDesc", linkTab: null },
            ]).map((pillar) => (
              <div
                key={pillar.key}
                className={`rounded-xl border ${pillar.border} bg-th-bg-2 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow`}
              >
                <div className={`w-12 h-12 rounded-xl ${pillar.bg} flex items-center justify-center ${pillar.color}`}>
                  {pillar.icon}
                </div>
                <h4 className="text-sm font-bold text-th-text">
                  {t(`maintenance.pillar${pillar.key.charAt(0).toUpperCase() + pillar.key.slice(1)}`) || pillar.key}
                </h4>
                <p className="text-xs text-th-text-3 flex-1 leading-relaxed">
                  {t(`maintenance.${pillar.descKey}`) || ""}
                </p>
                {pillar.linkTab && (
                  <button
                    onClick={() => setSelectedTab(pillar.linkTab!)}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline self-start mt-1"
                  >
                    {t("common.openTool") || "Open Tool"} &rarr;
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ TAB: PM Calendar ═══════════ */}
      {!loading && selectedTab === "calendar" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-th-text text-lg uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-5 h-5 text-th-text-3" />
            {t("maintenance.tpmPmCalendar") || "Preventive Maintenance Calendar"}
          </h3>
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 overflow-x-auto">
            <div className="grid grid-cols-7 gap-1.5 min-w-[500px]">
              {/* Day-of-week header */}
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-th-text-3 py-2 uppercase tracking-wider">
                  {t(`maintenance.day${d}`) || d}
                </div>
              ))}
              {/* Pad first row to correct weekday */}
              {(() => {
                const firstDay = new Date(calendarDays[0]?.date);
                const dayOfWeek = (firstDay.getDay() + 6) % 7;
                return Array.from({ length: dayOfWeek }).map((_, i) => <div key={`pad-${i}`} />);
              })()}
              {calendarDays.map(({ date, items }) => {
                const isToday = date === todayIso;
                const hasPm = items.length > 0;
                const hasOverdue = items.some((eq) => getHealthColor(eq.next_pm) === "red");
                return (
                  <div
                    key={date}
                    className={`rounded-lg p-1.5 min-h-[68px] text-center border transition-all text-xs ${
                      isToday
                        ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300/50"
                        : hasPm
                          ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
                          : "border-th-border bg-th-bg"
                    }`}
                  >
                    <div className={`font-bold mb-1 ${isToday ? "text-amber-600 dark:text-amber-400" : "text-th-text"}`}>
                      {new Date(date).getDate()}
                    </div>
                    {items.map((eq) => (
                      <div
                        key={eq.id}
                        className={`text-[9px] leading-tight truncate rounded px-1 py-0.5 mb-0.5 cursor-pointer hover:opacity-80 transition ${
                          hasOverdue
                            ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                        }`}
                        title={eq.name}
                        onClick={() => { setSelectedTab("equipment"); setDetailEqId(eq.id); }}
                      >
                        {eq.name}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-th-text-3">
            {t("maintenance.tpmCalendarHint") || "Blue = scheduled PM. Red = overdue. Click equipment name to view details."}
          </p>
        </div>
      )}

      {/* ═══════════ TAB: Maintenance History ═══════════ */}
      {!loading && selectedTab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <h3 className="font-semibold text-th-text text-lg uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-th-text-3" />
              {t("maintenance.tpmHistoryTitle") || "Maintenance History"}
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={historyEqId ?? ""}
                onChange={(e) => setHistoryEqId(e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              >
                <option value="">{t("maintenance.tpmAllEquipment") || "All Equipment"}</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>{eq.name}</option>
                ))}
              </select>
              <button
                onClick={() => openLogForEquipment(equipment[0]?.id ?? 0)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                {t("maintenance.tpmLogMaintenance") || "Log PM"}
              </button>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 text-th-text-3 opacity-30" />
              <p className="text-th-text-3 text-sm">{t("maintenance.tpmNoLogs") || "No maintenance logs yet."}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-th-bg text-th-text-3 text-xs uppercase tracking-wider border-b border-th-border">
                      <th className="text-left px-4 py-3 font-semibold">{t("maintenance.tpmDate") || "Date"}</th>
                      <th className="text-left px-4 py-3 font-semibold">{t("maintenance.tpmEqName") || "Equipment"}</th>
                      <th className="text-center px-4 py-3 font-semibold">{t("maintenance.tpmType") || "Type"}</th>
                      <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">{t("maintenance.tpmDescription") || "Description"}</th>
                      <th className="text-center px-4 py-3 font-semibold hidden md:table-cell">{t("maintenance.tpmDuration") || "Duration"}</th>
                      <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">{t("maintenance.tpmPartsReplaced") || "Parts Replaced"}</th>
                      <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">{t("maintenance.tpmTechnician") || "Technician"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => {
                      const eq = equipment.find((e) => e.id === log.equipment_id);
                      return (
                        <tr key={log.id} className="border-b border-th-border hover:bg-th-bg transition-colors">
                          <td className="px-4 py-3 text-th-text-2 whitespace-nowrap">{formatDate(log.date)}</td>
                          <td className="px-4 py-3 font-medium text-th-text">
                            <button
                              onClick={() => { setSelectedTab("equipment"); setDetailEqId(log.equipment_id); }}
                              className="hover:text-amber-500 transition text-left"
                            >
                              {eq?.name ?? `#${log.equipment_id}`}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${maintTypeStyle[log.type]}`}>
                              {log.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-th-text-2 hidden sm:table-cell max-w-[240px] truncate">{log.description}</td>
                          <td className="px-4 py-3 text-center text-th-text-2 hidden md:table-cell">{log.duration_hours}h</td>
                          <td className="px-4 py-3 text-th-text-3 hidden lg:table-cell">{log.parts_replaced || "\u2014"}</td>
                          <td className="px-4 py-3 text-th-text-3 hidden md:table-cell">{log.technician}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Modal: Log Maintenance ═══════════ */}
      {showLogForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className="rounded-xl border border-th-border bg-th-bg-2 shadow-lg w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-th-text text-lg flex items-center gap-2">
                <Wrench className="w-5 h-5 text-th-text-3" />
                {t("maintenance.tpmLogMaintenance") || "Log Maintenance"}
              </h3>
              <button onClick={closeLogForm} className="text-th-text-3 hover:text-th-text transition p-1 rounded-lg hover:bg-th-bg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {logError && (
              <p className="text-sm text-red-600 dark:text-red-400">{logError}</p>
            )}

            <div className="space-y-3">
              {/* Equipment selector */}
              <div>
                <label className="block text-xs text-th-text-3 mb-1.5 font-medium uppercase tracking-wider">{t("maintenance.tpmSelectEquipment") || "Equipment"}</label>
                <select
                  value={logEqId ?? ""}
                  onChange={(e) => setLogEqId(Number(e.target.value))}
                  className={inputCls + " w-full"}
                >
                  <option value="" disabled>{t("maintenance.tpmSelectEquipment") || "Select equipment..."}</option>
                  {equipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>{eq.name}</option>
                  ))}
                </select>
              </div>

              {/* Maintenance type */}
              <div>
                <label className="block text-xs text-th-text-3 mb-1.5 font-medium uppercase tracking-wider">{t("maintenance.tpmMaintenanceType") || "Maintenance Type"}</label>
                <select
                  value={newLog.type}
                  onChange={(e) => setNewLog({ ...newLog, type: e.target.value as MaintenanceLog["type"] })}
                  className={inputCls + " w-full"}
                >
                  <option value="PM">{t("maintenance.maintPM") || "PM - Preventive Maintenance"}</option>
                  <option value="CM">{t("maintenance.maintCM") || "CM - Corrective Maintenance"}</option>
                  <option value="Autonomous">{t("maintenance.maintAutonomous") || "Autonomous Maintenance"}</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-th-text-3 mb-1.5 font-medium uppercase tracking-wider">{t("maintenance.tpmLogDescription") || "Description"}</label>
                <textarea
                  placeholder={t("maintenance.tpmLogDescriptionPlaceholder") || "Describe the maintenance performed..."}
                  value={newLog.description}
                  onChange={(e) => setNewLog({ ...newLog, description: e.target.value })}
                  rows={3}
                  className={inputCls + " w-full resize-none"}
                />
              </div>

              {/* Duration + Technician */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-th-text-3 mb-1.5 font-medium uppercase tracking-wider">{t("maintenance.tpmLogDuration") || "Duration (hours)"}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0.1}
                    step={0.5}
                    value={newLog.duration_hours}
                    onChange={(e) => setNewLog({ ...newLog, duration_hours: Number(e.target.value) || 0.5 })}
                    className={inputCls + " w-full"}
                  />
                </div>
                <div>
                  <label className="block text-xs text-th-text-3 mb-1.5 font-medium uppercase tracking-wider">{t("maintenance.tpmLogTechnician") || "Technician"}</label>
                  <input
                    type="text"
                    placeholder={t("maintenance.tpmLogTechnicianPlaceholder") || "Name"}
                    value={newLog.technician}
                    onChange={(e) => setNewLog({ ...newLog, technician: e.target.value })}
                    className={inputCls + " w-full"}
                  />
                </div>
              </div>

              {/* Parts replaced */}
              <div>
                <label className="block text-xs text-th-text-3 mb-1.5 font-medium uppercase tracking-wider">{t("maintenance.tpmPartsReplaced") || "Parts Replaced"}</label>
                <input
                  type="text"
                  placeholder={t("maintenance.tpmPartsReplacedPlaceholder") || "e.g., Bearing SKF 6205, O-ring set"}
                  value={newLog.parts_replaced}
                  onChange={(e) => setNewLog({ ...newLog, parts_replaced: e.target.value })}
                  className={inputCls + " w-full"}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-th-border">
              <button
                onClick={closeLogForm}
                className="px-4 py-2 rounded-lg text-sm text-th-text-2 hover:bg-th-bg transition"
              >
                {t("common.cancel") || "Cancel"}
              </button>
              <button
                onClick={handleLogMaintenance}
                disabled={logLoading || !newLog.description.trim() || !logEqId}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm"
              >
                {logLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("maintenance.saving") || "Saving..."}
                  </span>
                ) : (
                  t("maintenance.tpmSaveLog") || "Save Log"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
