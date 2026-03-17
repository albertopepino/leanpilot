"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";

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

/* ───────── Demo / fallback data ───────── */

const demoEquipment: Equipment[] = [
  { id: 1, name: "CNC Lathe #1", type: "CNC", location: "Machining Bay A", criticality: "A", status: "running", oee: 87, mtbf_hours: 720, mttr_hours: 2.5, next_pm: "2026-03-20", last_maintenance: "2026-03-01", maintenance_interval_days: 30 },
  { id: 2, name: "Hydraulic Press #2", type: "Press", location: "Forming Line B", criticality: "A", status: "running", oee: 82, mtbf_hours: 480, mttr_hours: 4, next_pm: "2026-03-15", last_maintenance: "2026-02-15", maintenance_interval_days: 28 },
  { id: 3, name: "Welding Robot #1", type: "Robot", location: "Assembly Cell 1", criticality: "B", status: "maintenance", oee: 74, mtbf_hours: 360, mttr_hours: 3, next_pm: "2026-03-13", last_maintenance: "2026-03-10", maintenance_interval_days: 14 },
  { id: 4, name: "Conveyor Belt #3", type: "Conveyor", location: "Packaging Area", criticality: "C", status: "running", oee: 95, mtbf_hours: 1200, mttr_hours: 1, next_pm: "2026-04-01", last_maintenance: "2026-03-01", maintenance_interval_days: 60 },
  { id: 5, name: "Paint Booth #1", type: "Booth", location: "Finishing Dept", criticality: "B", status: "breakdown", oee: 65, mtbf_hours: 200, mttr_hours: 6, next_pm: "2026-03-14", last_maintenance: "2026-03-12", maintenance_interval_days: 21 },
  { id: 6, name: "Injection Molder #4", type: "Molder", location: "Plastics Wing", criticality: "A", status: "running", oee: 91, mtbf_hours: 550, mttr_hours: 3.5, next_pm: "2026-03-25", last_maintenance: "2026-03-05", maintenance_interval_days: 30 },
];

const demoLogs: MaintenanceLog[] = [
  { id: 1, equipment_id: 1, date: "2026-03-10", type: "PM", description: "Spindle bearing replacement and lubrication", duration_hours: 2, technician: "M. Rossi", parts_replaced: "Bearing SKF 6205" },
  { id: 2, equipment_id: 2, date: "2026-03-08", type: "CM", description: "Hydraulic seal repair after pressure drop", duration_hours: 4, technician: "L. Bianchi", parts_replaced: "Hydraulic seal kit HS-220" },
  { id: 3, equipment_id: 3, date: "2026-03-13", type: "PM", description: "Welding tip calibration and wire feed check", duration_hours: 1.5, technician: "G. Verdi", parts_replaced: "" },
  { id: 4, equipment_id: 5, date: "2026-03-12", type: "CM", description: "Paint nozzle replacement due to clogging", duration_hours: 3, technician: "A. Neri", parts_replaced: "Nozzle assembly NZ-100" },
  { id: 5, equipment_id: 1, date: "2026-02-20", type: "Autonomous", description: "Operator daily cleaning and vibration check", duration_hours: 0.5, technician: "F. Conti", parts_replaced: "" },
  { id: 6, equipment_id: 4, date: "2026-03-01", type: "PM", description: "Belt tension adjustment and roller inspection", duration_hours: 1, technician: "M. Rossi", parts_replaced: "" },
  { id: 7, equipment_id: 6, date: "2026-03-05", type: "PM", description: "Mold cavity cleaning and injection pressure calibration", duration_hours: 2.5, technician: "L. Bianchi", parts_replaced: "O-ring set OR-440" },
  { id: 8, equipment_id: 2, date: "2026-02-15", type: "Autonomous", description: "Operator pre-shift hydraulic fluid level check", duration_hours: 0.3, technician: "P. Gialli", parts_replaced: "" },
];

/* ───────── Style maps ───────── */

const statusStyleMap: Record<string, { bg: string; text: string; dot: string; border: string; glow: string }> = {
  running: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    border: "border-emerald-500/30",
    glow: "shadow-[0_0_12px_rgba(16,185,129,0.3)]",
  },
  maintenance: {
    bg: "bg-amber-500/10 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500 animate-pulse",
    border: "border-amber-500/30",
    glow: "shadow-[0_0_12px_rgba(245,158,11,0.3)]",
  },
  breakdown: {
    bg: "bg-red-500/10 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500 animate-pulse-slow",
    border: "border-red-500/30",
    glow: "shadow-[0_0_12px_rgba(239,68,68,0.4)]",
  },
};
const defaultStatusStyle = {
  bg: "bg-gray-500/10 dark:bg-gray-500/10",
  text: "text-gray-700 dark:text-gray-400",
  dot: "bg-gray-500",
  border: "border-gray-500/30",
  glow: "",
};
function getStatusStyle(status: string | undefined | null) {
  if (!status) return defaultStatusStyle;
  return statusStyleMap[status.toLowerCase()] || defaultStatusStyle;
}

const critColor: Record<string, string> = {
  A: "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20",
  B: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20",
  C: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20",
};

const maintTypeStyle: Record<string, string> = {
  PM: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20",
  CM: "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20",
  Autonomous: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/20",
};

/* ───────── Helpers ───────── */

type TabId = "equipment" | "calendar" | "history";

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
  const [usingDemo, setUsingDemo] = useState(false);

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

  // Equipment detail view
  const [detailEqId, setDetailEqId] = useState<number | null>(null);

  // History filter
  const [historyEqId, setHistoryEqId] = useState<number | null>(null);

  /* -- data fetching -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await advancedLeanApi.listEquipment();
      const items: Equipment[] = res.data?.data ?? res.data ?? [];
      if (items.length > 0) {
        setEquipment(items);
        setUsingDemo(false);
      } else {
        setEquipment(demoEquipment);
        setMaintenanceLogs(demoLogs);
        setUsingDemo(true);
      }
    } catch {
      setEquipment(demoEquipment);
      setMaintenanceLogs(demoLogs);
      setUsingDemo(true);
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
  const tabs: { id: TabId; labelKey: string; fallback: string; icon: string }[] = [
    { id: "equipment", labelKey: "tpmEquipmentTab", fallback: "Equipment", icon: "\u2699\uFE0F" },
    { id: "calendar", labelKey: "tpmCalendarTab", fallback: "PM Calendar", icon: "\uD83D\uDCC5" },
    { id: "history", labelKey: "tpmHistoryTab", fallback: "History", icon: "\uD83D\uDCCB" },
  ];

  /* -- shared input class -- */
  const inputCls =
    "px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-colors";

  /* ───────── Render ───────── */
  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-print-area="true" role="region" aria-label="TPM Dashboard">

      {/* ── Header with equipment health overview ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-950 border border-white/10 p-6 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-white tracking-tight">{t("maintenance.tpmTitle") || "TPM Dashboard"}</h2>
            <p className="text-sm text-white/60 mt-0.5">{t("maintenance.tpmSubtitle") || "Total Productive Maintenance"}</p>
          </div>
          {usingDemo && (
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-3 py-1 backdrop-blur-sm">
              {t("maintenance.demoMode") || "Demo"}
            </span>
          )}
        </div>

        {/* Status distribution bar */}
        <div className="relative mt-5">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-white/50">
              {t("maintenance.tpmFleetHealth") || "Fleet Health"}
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <div className="flex gap-4 flex-wrap">
            {[
              { key: "running", count: statusCounts.running, color: "emerald", label: t("maintenance.statusRunning") || "Running" },
              { key: "maintenance", count: statusCounts.maintenance, color: "amber", label: t("maintenance.statusMaintenance") || "Maintenance" },
              { key: "breakdown", count: statusCounts.breakdown, color: "red", label: t("maintenance.statusBreakdown") || "Breakdown" },
            ].map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${s.key === "running" ? "bg-emerald-400" : s.key === "maintenance" ? "bg-amber-400 animate-pulse" : "bg-red-400 animate-pulse-slow"}`} />
                <span className="text-white/80 text-sm">{s.label}</span>
                <span className="text-white font-bold text-sm">{s.count}</span>
              </div>
            ))}
          </div>
          {/* Visual bar */}
          <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden flex">
            {totalEquipment > 0 && (
              <>
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700" style={{ width: `${(statusCounts.running / totalEquipment) * 100}%` }} />
                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700" style={{ width: `${(statusCounts.maintenance / totalEquipment) * 100}%` }} />
                <div className="h-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-700" style={{ width: `${(statusCounts.breakdown / totalEquipment) * 100}%` }} />
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
            borderColor: "border-l-blue-500",
            glowClass: "",
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
          },
          {
            labelKey: "tpmOverduePMs",
            value: overduePMs,
            fallback: "Overdue PMs",
            color: overduePMs > 0 ? "red" : "emerald",
            borderColor: overduePMs > 0 ? "border-l-red-500" : "border-l-emerald-500",
            glowClass: overduePMs > 0 ? "animate-glow-pulse-red" : "",
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            labelKey: "tpmCompletedMonth",
            value: completedThisMonth,
            fallback: "Completed This Month",
            color: "emerald",
            borderColor: "border-l-emerald-500",
            glowClass: "",
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            labelKey: "tpmAvgMTBF",
            value: `${avgMTBF}h`,
            fallback: "Avg MTBF",
            color: "indigo",
            borderColor: "border-l-indigo-500",
            glowClass: "",
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            ),
          },
          {
            labelKey: "tpmAvgMTTR",
            value: `${avgMTTR}h`,
            fallback: "Avg MTTR",
            color: "amber",
            borderColor: "border-l-amber-500",
            glowClass: "",
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
        ].map((kpi) => (
          <div
            key={kpi.labelKey}
            className={`kpi-card-premium relative bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-xl p-4 border-l-4 ${kpi.borderColor} border border-slate-200/50 dark:border-white/5 shadow-card hover:shadow-card-hover ${kpi.glowClass}`}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-3xl font-bold text-th-text leading-none animate-count-up">{kpi.value}</div>
                <div className="text-xs text-th-text-3 mt-1.5 uppercase tracking-wider font-medium">{t(`maintenance.${kpi.labelKey}`) || kpi.fallback}</div>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                kpi.color === "blue" ? "bg-blue-500/10 text-blue-500 dark:text-blue-400" :
                kpi.color === "red" ? "bg-red-500/10 text-red-500 dark:text-red-400" :
                kpi.color === "emerald" ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" :
                kpi.color === "indigo" ? "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400" :
                "bg-amber-500/10 text-amber-500 dark:text-amber-400"
              }`}>
                {kpi.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setSelectedTab(tab.id); setDetailEqId(null); }}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              selectedTab === tab.id
                ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-md"
                : "text-th-text-3 hover:text-th-text hover:bg-white/50 dark:hover:bg-white/5"
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {t(`maintenance.${tab.labelKey}`) || tab.fallback}
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-amber-500/20 rounded-full" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <span className="ml-4 text-th-text-2 text-sm">{t("maintenance.loading") || "Loading..."}</span>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm flex items-center gap-3 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 dark:hover:text-red-300 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* ═══════════ TAB: Equipment Registry ═══════════ */}
      {!loading && selectedTab === "equipment" && !detailEqId && (
        <div className="space-y-4">
          {/* Add equipment button */}
          <div className="flex justify-end">
            <button
              onClick={() => { setShowAddForm(!showAddForm); setAddError(null); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all duration-300 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
            >
              <span className="text-lg leading-none">+</span>
              {t("maintenance.tpmAddEquipment") || "Add Equipment"}
            </button>
          </div>

          {/* Add equipment form */}
          {showAddForm && (
            <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-xl p-5 shadow-card border border-slate-200/50 dark:border-white/5 space-y-4">
              <h3 className="font-semibold text-th-text uppercase tracking-wider text-sm">{t("maintenance.tpmAddEquipment") || "Add Equipment"}</h3>
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
                  className="px-4 py-2 rounded-lg text-sm text-th-text-2 hover:bg-th-bg-3 transition"
                >
                  {t("common.cancel") || "Cancel"}
                </button>
                <button
                  onClick={handleAddEquipment}
                  disabled={addLoading || !newEq.name.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-all shadow"
                >
                  {addLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                  className={`group relative bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-xl border-l-4 ${
                    eq.status === "running" ? "border-l-emerald-500" : eq.status === "maintenance" ? "border-l-amber-500" : "border-l-red-500"
                  } border border-slate-200/50 dark:border-white/5 p-5 cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ${st.glow}`}
                >
                  {/* Status indicator */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`relative w-3 h-3 rounded-full ${st.dot}`}>
                        {(eq.status || "running") !== "running" && (
                          <span className={`absolute inset-0 rounded-full ${st.dot} animate-ping opacity-50`} />
                        )}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text} ${st.border}`}>
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
                    <div className="bg-slate-100/80 dark:bg-white/5 rounded-lg p-2 text-center">
                      <div className={`text-lg font-bold ${eq.oee >= 85 ? "text-emerald-600 dark:text-emerald-400" : eq.oee >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                        {eq.oee}%
                      </div>
                      <div className="text-[9px] text-th-text-3 uppercase tracking-wider font-medium">OEE</div>
                    </div>
                    <div className="bg-slate-100/80 dark:bg-white/5 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-th-text">{eq.mtbf_hours}h</div>
                      <div className="text-[9px] text-th-text-3 uppercase tracking-wider font-medium">MTBF</div>
                    </div>
                    <div className="bg-slate-100/80 dark:bg-white/5 rounded-lg p-2 text-center">
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
                  <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-white/5">
                    <button
                      onClick={(e) => { e.stopPropagation(); openLogForEquipment(eq.id); }}
                      className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                      title={t("maintenance.tpmLogMaintenance") || "Log Maintenance"}
                    >
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
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t("maintenance.tpmBackToList") || "Back to equipment list"}
          </button>

          {/* Equipment info card */}
          <div className={`relative bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-xl p-6 border-l-4 ${
            detailEquipment.status === "running" ? "border-l-emerald-500" : detailEquipment.status === "maintenance" ? "border-l-amber-500" : "border-l-red-500"
          } border border-slate-200/50 dark:border-white/5 shadow-lg`}>
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
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text} ${st.border}`}>
                        {t(`maintenance.status${(detailEquipment.status || "running").charAt(0).toUpperCase() + (detailEquipment.status || "running").slice(1)}`) || detailEquipment.status}
                      </span>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-th-text-3 text-xs uppercase tracking-wider font-medium">{t("maintenance.tpmEqType") || "Type"}</div>
                    <div className="text-th-text font-semibold mt-0.5">{detailEquipment.type}</div>
                  </div>
                  <div>
                    <div className="text-th-text-3 text-xs uppercase tracking-wider font-medium">{t("maintenance.tpmEqLocation") || "Location"}</div>
                    <div className="text-th-text font-semibold mt-0.5">{detailEquipment.location}</div>
                  </div>
                  <div>
                    <div className="text-th-text-3 text-xs uppercase tracking-wider font-medium">{t("maintenance.tpmLastMaintenance") || "Last Maintenance"}</div>
                    <div className="text-th-text font-semibold mt-0.5">{formatDate(detailEquipment.last_maintenance)}</div>
                  </div>
                  <div>
                    <div className="text-th-text-3 text-xs uppercase tracking-wider font-medium">{t("maintenance.tpmIntervalDays") || "PM Interval"}</div>
                    <div className="text-th-text font-semibold mt-0.5">{detailEquipment.maintenance_interval_days} {t("maintenance.days") || "days"}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-center">
                {[
                  {
                    value: `${detailEquipment.oee}%`,
                    label: "OEE",
                    colorClass: detailEquipment.oee >= 85 ? "text-emerald-600 dark:text-emerald-400" : detailEquipment.oee >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400",
                  },
                  { value: `${detailEquipment.mtbf_hours}h`, label: "MTBF", colorClass: "text-th-text" },
                  { value: `${detailEquipment.mttr_hours}h`, label: "MTTR", colorClass: "text-th-text" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-100/80 dark:bg-white/5 rounded-xl px-5 py-3 min-w-[90px] border border-slate-200/50 dark:border-white/5">
                    <div className={`text-2xl font-bold ${m.colorClass}`}>{m.value}</div>
                    <div className="text-[10px] text-th-text-3 uppercase tracking-wider font-medium mt-0.5">{m.label}</div>
                  </div>
                ))}
                <div className="bg-slate-100/80 dark:bg-white/5 rounded-xl px-5 py-3 min-w-[90px] border border-slate-200/50 dark:border-white/5">
                  {(() => {
                    const h = getHealthColor(detailEquipment.next_pm);
                    return (
                      <>
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${healthDot[h]}`} />
                          <span className={`text-sm font-bold ${h === "red" ? "text-red-600 dark:text-red-400" : h === "yellow" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
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
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20"
              >
                {t("maintenance.tpmLogMaintenance") || "Log Maintenance"}
              </button>
            </div>
          </div>

          {/* Upcoming PM schedule - timeline */}
          <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-xl p-5 border border-slate-200/50 dark:border-white/5 shadow-card">
            <h4 className="font-semibold text-th-text mb-4 uppercase tracking-wider text-sm">{t("maintenance.tpmUpcomingPM") || "Upcoming PM Schedule"}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((mult) => {
                const nextDate = new Date(detailEquipment.next_pm);
                nextDate.setDate(nextDate.getDate() + mult * detailEquipment.maintenance_interval_days);
                const iso = nextDate.toISOString().slice(0, 10);
                const isPast = iso < todayIso;
                return (
                  <div
                    key={mult}
                    className={`relative rounded-xl p-4 text-center border-l-4 transition-all ${
                      isPast
                        ? "border-l-red-500 bg-red-500/5 dark:bg-red-500/5 border border-red-500/20"
                        : mult === 0
                          ? "border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/5 border border-amber-500/20"
                          : "border-l-slate-300 dark:border-l-slate-600 bg-slate-100/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5"
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
          <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-xl p-5 border border-slate-200/50 dark:border-white/5 shadow-card">
            <h4 className="font-semibold text-th-text mb-4 uppercase tracking-wider text-sm">{t("maintenance.tpmMaintenanceHistory") || "Maintenance History"}</h4>
            {detailLogs.length === 0 ? (
              <p className="text-sm text-th-text-3">{t("maintenance.tpmNoLogs") || "No maintenance logs recorded for this equipment."}</p>
            ) : (
              <div className="space-y-2">
                {detailLogs.map((log) => (
                  <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
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

      {/* ═══════════ TAB: PM Calendar ═══════════ */}
      {!loading && selectedTab === "calendar" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-th-text text-lg uppercase tracking-wider">{t("maintenance.tpmPmCalendar") || "Preventive Maintenance Calendar"}</h3>
          <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-200/50 dark:border-white/5 p-4 shadow-card overflow-x-auto">
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
                        ? "border-amber-400/50 bg-amber-500/5 dark:bg-amber-500/5 ring-1 ring-amber-400/30 shadow-sm"
                        : hasPm
                          ? "border-blue-400/30 bg-blue-500/5 dark:bg-blue-500/5"
                          : "border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-white/[0.02]"
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
                            ? "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                            : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20"
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
            <h3 className="font-semibold text-th-text text-lg uppercase tracking-wider">{t("maintenance.tpmHistoryTitle") || "Maintenance History"}</h3>
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
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all shadow whitespace-nowrap"
              >
                + {t("maintenance.tpmLogMaintenance") || "Log PM"}
              </button>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-xl p-12 border border-slate-200/50 dark:border-white/5 text-center shadow-card">
              <svg className="w-12 h-12 mx-auto mb-3 text-th-text-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-th-text-3 text-sm">{t("maintenance.tpmNoLogs") || "No maintenance logs yet."}</p>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-200/50 dark:border-white/5 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-white/5 text-th-text-3 text-xs uppercase tracking-wider">
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
                        <tr key={log.id} className="border-b border-slate-200/50 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
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
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-white/10 w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-th-text text-lg">{t("maintenance.tpmLogMaintenance") || "Log Maintenance"}</h3>
              <button onClick={closeLogForm} className="text-th-text-3 hover:text-th-text transition p-1 rounded-lg hover:bg-th-bg-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
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

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-200/50 dark:border-white/5">
              <button
                onClick={closeLogForm}
                className="px-4 py-2 rounded-lg text-sm text-th-text-2 hover:bg-th-bg-3 transition"
              >
                {t("common.cancel") || "Cancel"}
              </button>
              <button
                onClick={handleLogMaintenance}
                disabled={logLoading || !newLog.description.trim() || !logEqId}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-all shadow"
              >
                {logLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
