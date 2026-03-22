"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/stores/useI18n";
import {
  advancedLeanApi,
  adminApi,
  manufacturingApi,
  productionApi,
} from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import DisplayModeWrapper from "@/components/ui/DisplayModeWrapper";
import {
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Save,
  ChevronLeft,
  ChevronRight,
  Factory,
  RefreshCw,
  Loader2,
  CalendarDays,
  Timer,
  LayoutList,
  ExternalLink,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "hourly" | "shift" | "daily";

type MissReason =
  | ""
  | "equipment"
  | "material"
  | "quality"
  | "personnel"
  | "changeover"
  | "breakdown"
  | "speed_loss"
  | "minor_stop"
  | "planned"
  | "other";

interface HourlySlot {
  hour: string;
  target: number;
  actual: number | null;
  cumulativeTarget: number;
  cumulativeActual: number | null;
  notes: string;
  reasonCode: MissReason;
  dirty: boolean;
}

interface LineOption {
  id: number;
  name: string;
  shifts: ShiftOption[];
}

interface ShiftOption {
  id: number;
  name: string;
  planned_minutes?: number;
}

interface ProductOption {
  id: number;
  name: string;
  code: string;
}

interface ProductionRecord {
  id: number;
  date: string;
  production_line_name?: string;
  production_line_id?: number;
  shift_id?: number | null;
  total_pieces: number;
  good_pieces: number;
  actual_run_time_min: number;
  planned_production_time_min?: number;
  ideal_cycle_time_sec?: number;
  notes?: string;
}

interface ShiftRow {
  key: number;
  lineId: number | "";
  shiftId: number | "";
  productId: number | "";
  totalPieces: number | "";
  goodPieces: number | "";
  plannedTime: number | "";
  downtime: number | "";
  cycleTime: number | "";
  notes: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LS_KEY = "leanpilot_prod_monitor_view";

const MISS_REASONS: MissReason[] = [
  "equipment",
  "material",
  "quality",
  "personnel",
  "changeover",
  "breakdown",
  "speed_loss",
  "minor_stop",
  "planned",
  "other",
];

const MISS_REASON_TO_DOWNTIME_CATEGORY: Record<string, string> = {
  equipment: "unplanned",
  material: "material",
  quality: "quality",
  personnel: "other",
  changeover: "changeover",
  breakdown: "maintenance",
  speed_loss: "unplanned",
  minor_stop: "unplanned",
  planned: "planned",
  other: "other",
};

const DEFAULT_SHIFT_HOURS = [
  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00",
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00", "23:00",
];

const DEFAULT_TARGET = 50;
const REFRESH_MS = 30_000;

const VIEW_TABS: { key: ViewMode; labelKey: string; fallback: string; Icon: typeof Clock }[] = [
  { key: "hourly", labelKey: "production.hourlyView", fallback: "Hourly", Icon: Clock },
  { key: "shift", labelKey: "production.shiftView", fallback: "Shift", Icon: Timer },
  { key: "daily", labelKey: "production.dailyView", fallback: "Daily", Icon: CalendarDays },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getCurrentHour(): string {
  return `${String(new Date().getHours()).padStart(2, "0")}:00`;
}

function buildEmptySlots(): HourlySlot[] {
  let cumTarget = 0;
  return DEFAULT_SHIFT_HOURS.map((hour) => {
    cumTarget += DEFAULT_TARGET;
    return {
      hour,
      target: DEFAULT_TARGET,
      actual: null,
      cumulativeTarget: cumTarget,
      cumulativeActual: null,
      notes: "",
      reasonCode: "" as MissReason,
      dirty: false,
    };
  });
}

function recalcCumulatives(slots: HourlySlot[]): HourlySlot[] {
  let cumTarget = 0;
  let cumActual = 0;
  let hasActual = false;
  return slots.map((s) => {
    cumTarget += s.target;
    if (s.actual !== null) {
      cumActual += s.actual;
      hasActual = true;
    }
    return {
      ...s,
      cumulativeTarget: cumTarget,
      cumulativeActual: hasActual ? cumActual : null,
    };
  });
}

function inputCls() {
  return "w-full rounded-lg border border-th-border bg-th-bg-2 px-3 py-2 text-sm text-th-text focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none disabled:opacity-50";
}

let _rowKey = 0;
function nextRowKey() { return ++_rowKey; }
function emptyShiftRow(): ShiftRow {
  return {
    key: nextRowKey(),
    lineId: "",
    shiftId: "",
    productId: "",
    totalPieces: "",
    goodPieces: "",
    plannedTime: 480,
    downtime: 0,
    cycleTime: "",
    notes: "",
  };
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

interface FeedbackMsg {
  type: "success" | "error";
  text: string;
}

function FeedbackBanner({ msg }: { msg: FeedbackMsg | null }) {
  if (!msg) return null;
  const isOk = msg.type === "success";
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
        isOk
          ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
          : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
      }`}
    >
      {isOk ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      {msg.text}
    </div>
  );
}

function SummaryKpi({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: "slate" | "emerald" | "red";
}) {
  const colorMap = {
    slate: "text-th-text",
    emerald: "text-emerald-600",
    red: "text-red-600",
  };
  return (
    <div className="rounded-xl border border-th-border bg-th-bg-3 p-3 text-center">
      <div className={`text-2xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-[10px] text-th-text-2 font-bold uppercase tracking-[0.1em] mt-0.5">
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ProductionMonitor() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { printView, exportToExcel } = useExport();
  const dateLocale = locale === "it" ? "it-IT" : "en-GB";

  // --- Shared state ---
  const [view, setView] = useState<ViewMode>("hourly");
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [lines, setLines] = useState<LineOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [linesLoading, setLinesLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState<{ id: number; order_number: string; product_name: string | null; planned_quantity: number; actual_quantity_good: number; ideal_cycle_time_sec: number | null }[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Hourly-specific state
  const [slots, setSlots] = useState<HourlySlot[]>(() => buildEmptySlots());
  const [hourlyLoading, setHourlyLoading] = useState(false);
  const [hourlyError, setHourlyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentHourRef = useRef<HTMLTableRowElement | null>(null);

  // Shift-specific state
  const [shiftRows, setShiftRows] = useState<ShiftRow[]>([emptyShiftRow()]);
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [shiftFeedback, setShiftFeedback] = useState<FeedbackMsg | null>(null);

  // Daily/records state
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  // --- Restore saved view ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY) as ViewMode | null;
      if (saved && ["hourly", "shift", "daily"].includes(saved)) setView(saved);
    } catch {}
  }, []);

  const handleViewChange = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem(LS_KEY, v); } catch {}
  };

  // --- Load lines & products ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLinesLoading(true);
      try {
        const [factoryRes, productsRes] = await Promise.all([
          adminApi.getFactory(),
          manufacturingApi.listProducts(),
        ]);
        if (cancelled) return;
        const factory = factoryRes.data;
        const rawLines = factory?.production_lines || factory?.lines || [];
        if (Array.isArray(rawLines) && rawLines.length > 0) {
          const mapped: LineOption[] = rawLines.map(
            (l: { id: number; name: string; shifts?: { id: number; name: string; planned_minutes?: number }[] }) => ({
              id: l.id,
              name: l.name,
              shifts: (l.shifts ?? []).map((s) => ({
                id: s.id,
                name: s.name,
                planned_minutes: s.planned_minutes ?? undefined,
              })),
            })
          );
          setLines(mapped);
          setSelectedLineId(mapped[0].id);
        }
        setProducts(
          (productsRes.data ?? []).map((p: { id: number; name: string; code: string }) => ({
            id: p.id,
            name: p.name,
            code: p.code,
          }))
        );
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLinesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // --- Date navigation ---
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(toISODate(d));
  };

  const isToday = selectedDate === toISODate(new Date());
  const displayDate = new Date(selectedDate + "T00:00:00").toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // =========================================================================
  // HOURLY VIEW
  // =========================================================================

  const fetchHourly = useCallback(
    async (lineId: number, date: string) => {
      setHourlyLoading(true);
      setHourlyError(null);
      try {
        const res = await advancedLeanApi.getHourlyView(lineId, date);
        const data = res.data;
        if (data && Array.isArray(data.slots) && data.slots.length > 0) {
          const mapped: HourlySlot[] = data.slots.map(
            (s: { hour?: string; target?: number; actual?: number | null; notes?: string; reasonCode?: string; reason_code?: string }) => ({
              hour: s.hour ?? "00:00",
              target: s.target ?? DEFAULT_TARGET,
              actual: s.actual ?? null,
              cumulativeTarget: 0,
              cumulativeActual: null,
              notes: s.notes ?? "",
              reasonCode: (s.reasonCode ?? s.reason_code ?? "") as MissReason,
              dirty: false,
            })
          );
          setSlots(recalcCumulatives(mapped));
        } else {
          setSlots(buildEmptySlots());
        }
      } catch {
        setSlots(buildEmptySlots());
        setHourlyError(t("production.monitorErrorLoading") || "Failed to load hourly data.");
      } finally {
        setHourlyLoading(false);
        setLastRefresh(new Date());
      }
    },
    [t]
  );

  // Fetch active production orders when line changes
  useEffect(() => {
    if (selectedLineId === null) { setActiveOrders([]); return; }
    productionApi.activeOrders(selectedLineId)
      .then((res) => setActiveOrders(Array.isArray(res.data) ? res.data : []))
      .catch(() => setActiveOrders([]));
  }, [selectedLineId]);

  // Fetch hourly when line/date changes (only in hourly view)
  useEffect(() => {
    if (view === "hourly" && selectedLineId !== null) {
      fetchHourly(selectedLineId, selectedDate);
    }
  }, [view, selectedLineId, selectedDate, fetchHourly]);

  // Auto-refresh for hourly
  useEffect(() => {
    if (view !== "hourly" || selectedLineId === null) return;
    refreshTimer.current = setInterval(() => {
      fetchHourly(selectedLineId, selectedDate);
    }, REFRESH_MS);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [view, selectedLineId, selectedDate, fetchHourly]);

  // Auto-scroll to current hour
  useEffect(() => {
    if (view === "hourly" && !hourlyLoading && currentHourRef.current) {
      currentHourRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [view, hourlyLoading, slots]);

  // Slot editing
  const updateSlot = (idx: number, field: "actual" | "notes" | "reasonCode", value: string) => {
    setSlots((prev) => {
      const updated = prev.map((s, i) => {
        if (i !== idx) return s;
        if (field === "actual") {
          const actual = value === "" ? null : Number(value);
          const needsReason = actual !== null && actual < s.target;
          return { ...s, actual, reasonCode: needsReason ? s.reasonCode : ("" as MissReason), dirty: true };
        }
        return { ...s, [field]: value, dirty: true };
      });
      return recalcCumulatives(updated);
    });
  };

  const createDowntimeFromMiss = async (lineId: number, date: string, slot: HourlySlot) => {
    if (!slot.reasonCode || slot.actual === null || slot.actual >= slot.target) return;
    const category = MISS_REASON_TO_DOWNTIME_CATEGORY[slot.reasonCode] ?? "other";
    const hourNum = parseInt(slot.hour.split(":")[0], 10);
    const startTime = `${date}T${String(hourNum).padStart(2, "0")}:00:00`;
    const endHour = (hourNum + 1) % 24;
    const endDate = hourNum === 23 ? (() => { const d = new Date(date); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })() : date;
    const endTime = `${endDate}T${String(endHour).padStart(2, "0")}:00:00`;
    try {
      await productionApi.createDowntime({
        production_line_id: lineId,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: 60,
        category,
        reason: slot.reasonCode,
        notes: slot.notes || `Hourly board miss: target ${slot.target}, actual ${slot.actual}`,
      });
    } catch {
      // best-effort
    }
  };

  const saveSlot = async (slot: HourlySlot) => {
    if (selectedLineId === null) return;
    setSaving(true);
    try {
      await advancedLeanApi.logHourly({
        lineId: selectedLineId,
        date: selectedDate,
        hour: slot.hour,
        target: slot.target,
        actual: slot.actual,
        notes: slot.notes,
        reasonCode: slot.reasonCode || null,
      });
      await createDowntimeFromMiss(selectedLineId, selectedDate, slot);
      setSlots((prev) =>
        prev.map((s) => (s.hour === slot.hour ? { ...s, dirty: false } : s))
      );
    } catch {
      // keep dirty
    } finally {
      setSaving(false);
    }
  };

  const saveAllDirty = async () => {
    if (selectedLineId === null) return;
    const dirtySlots = slots.filter((s) => s.dirty);
    if (dirtySlots.length === 0) return;
    setSaving(true);
    setSaveSuccess(false);
    let hadError = false;
    for (const slot of dirtySlots) {
      try {
        await advancedLeanApi.logHourly({
          lineId: selectedLineId,
          date: selectedDate,
          hour: slot.hour,
          target: slot.target,
          actual: slot.actual,
          notes: slot.notes,
          reasonCode: slot.reasonCode || null,
        });
        await createDowntimeFromMiss(selectedLineId, selectedDate, slot);
        setSlots((prev) =>
          prev.map((s) => (s.hour === slot.hour ? { ...s, dirty: false } : s))
        );
      } catch {
        hadError = true;
      }
    }
    setSaving(false);
    if (!hadError) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // Hourly KPIs
  const currentHour = getCurrentHour();
  const hasDirtyRows = slots.some((s) => s.dirty);

  const hourlyStats = useMemo(() => {
    const completed = slots.filter((s) => s.actual !== null);
    const totalTarget = completed.reduce((acc, s) => acc + s.target, 0);
    const totalActual = completed.reduce((acc, s) => acc + (s.actual ?? 0), 0);
    const wins = completed.filter((s) => (s.actual ?? 0) >= s.target).length;
    const losses = completed.length - wins;
    const variancePct =
      totalTarget > 0 ? Math.round(((totalActual - totalTarget) / totalTarget) * 100) : 0;
    const cumDelta = totalActual - totalTarget;
    return { totalTarget, totalActual, wins, losses, variancePct, cumDelta, completedCount: completed.length };
  }, [slots]);

  // Chart data
  const chartData = useMemo(
    () =>
      slots.map((s) => ({
        hour: s.hour,
        cumTarget: s.cumulativeTarget,
        cumActual: s.cumulativeActual,
      })),
    [slots]
  );

  const chartMax = useMemo(() => {
    let max = 0;
    for (const d of chartData) {
      if (d.cumTarget > max) max = d.cumTarget;
      if (d.cumActual !== null && d.cumActual > max) max = d.cumActual;
    }
    return max || 1;
  }, [chartData]);

  // =========================================================================
  // SHIFT VIEW
  // =========================================================================

  const updateShiftRow = (idx: number, patch: Partial<ShiftRow>) => {
    setShiftRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addShiftRow = () => setShiftRows((prev) => [...prev, emptyShiftRow()]);
  const removeShiftRow = (idx: number) =>
    setShiftRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const handleShiftSubmit = async () => {
    const valid = shiftRows.filter(
      (r) => r.lineId && r.totalPieces && r.goodPieces && r.cycleTime
    );
    if (valid.length === 0) {
      setShiftFeedback({ type: "error", text: t("production.monitorAtLeastOneRow") || "At least one complete row is required." });
      return;
    }
    setShiftSubmitting(true);
    setShiftFeedback(null);
    let ok = 0;
    let fail = 0;
    for (const row of valid) {
      try {
        const actualRun = Number(row.plannedTime) - Number(row.downtime || 0);
        await productionApi.createRecord({
          production_line_id: Number(row.lineId),
          shift_id: row.shiftId ? Number(row.shiftId) : null,
          date: selectedDate,
          planned_production_time_min: Number(row.plannedTime),
          actual_run_time_min: actualRun > 0 ? actualRun : 0,
          total_pieces: Number(row.totalPieces),
          good_pieces: Number(row.goodPieces),
          ideal_cycle_time_sec: Number(row.cycleTime),
          notes: row.notes || null,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setShiftFeedback({
      type: fail === 0 ? "success" : "error",
      text: `${ok} ${t("production.monitorRecordsSaved") || "record(s) saved"}${fail > 0 ? `, ${fail} ${t("production.monitorFailed") || "failed"}` : ""}.`,
    });
    if (ok > 0) {
      setShiftRows([emptyShiftRow()]);
      fetchRecords();
    }
    setShiftSubmitting(false);
  };

  // =========================================================================
  // DAILY VIEW
  // =========================================================================

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const res = await productionApi.listRecords();
      setRecords((res.data ?? []).slice(0, 20));
    } catch {
      // silently fail
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "shift" || view === "daily") {
      fetchRecords();
    }
  }, [view, fetchRecords]);

  // Group records by date for daily summary
  const dailySummary = useMemo(() => {
    const grouped: Record<string, { date: string; totalPieces: number; goodPieces: number; runMin: number; plannedMin: number; recordCount: number }> = {};
    for (const r of records) {
      if (!grouped[r.date]) {
        grouped[r.date] = { date: r.date, totalPieces: 0, goodPieces: 0, runMin: 0, plannedMin: 0, recordCount: 0 };
      }
      const g = grouped[r.date];
      g.totalPieces += r.total_pieces;
      g.goodPieces += r.good_pieces;
      g.runMin += r.actual_run_time_min;
      g.plannedMin += r.planned_production_time_min ?? 0;
      g.recordCount += 1;
    }
    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  }, [records]);

  // --- Selected line name ---
  const selectedLine = lines.find((l) => l.id === selectedLineId);
  const lineName = selectedLine?.name ?? "";

  // =========================================================================
  // RENDER
  // =========================================================================

  const cls = inputCls();

  return (
    <DisplayModeWrapper
      title={t("production.monitorTitle") || "Production Monitor"}
      refreshInterval={30}
    >
      <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true">
        {/* ================================================================ */}
        {/* Tab Selector + Controls                                         */}
        {/* ================================================================ */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View tabs */}
          <div className="flex gap-1 bg-th-bg-2 border border-th-border rounded-xl p-1">
            {VIEW_TABS.map((tab) => {
              const active = view === tab.key;
              const TabIcon = tab.Icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleViewChange(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-th-text-2 hover:bg-th-bg-3 hover:text-th-text"
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  {t(tab.labelKey) || tab.fallback}
                </button>
              );
            })}
          </div>

          {/* Line selector */}
          {linesLoading ? (
            <span className="text-sm text-th-text-2 animate-pulse">
              {t("production.monitorLoadingLines") || "Loading lines..."}
            </span>
          ) : lines.length > 0 ? (
            <select
              value={selectedLineId ?? ""}
              onChange={(e) => setSelectedLineId(Number(e.target.value))}
              aria-label="Production line"
              className="text-sm font-semibold border border-th-border rounded-lg px-3 py-2 bg-th-bg-2 text-th-text focus:ring-2 focus:ring-brand-500/50 outline-none"
            >
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-th-text-3">
              {t("production.monitorNoLines") || "No lines configured"}
            </span>
          )}

          {/* Production Order selector */}
          {activeOrders.length > 0 && (
            <select
              value={selectedOrderId ?? ""}
              onChange={(e) => setSelectedOrderId(e.target.value ? Number(e.target.value) : null)}
              aria-label="Production Order"
              className="text-sm border border-th-border rounded-lg px-3 py-2 bg-th-bg-2 text-th-text focus:ring-2 focus:ring-brand-500/50 outline-none"
            >
              <option value="">{t("production.noOrder") || "No order"}</option>
              {activeOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.product_name || "?"} ({o.actual_quantity_good}/{o.planned_quantity})
                </option>
              ))}
            </select>
          )}

          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftDate(-1)}
              className="px-2.5 py-2 rounded-lg border border-th-border bg-th-bg-2 text-th-text hover:bg-th-bg-3 transition-colors text-sm"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm border border-th-border rounded-lg px-3 py-2 bg-th-bg-2 text-th-text focus:ring-2 focus:ring-brand-500/50 outline-none"
            />
            <button
              onClick={() => shiftDate(1)}
              className="px-2.5 py-2 rounded-lg border border-th-border bg-th-bg-2 text-th-text hover:bg-th-bg-3 transition-colors text-sm"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(toISODate(new Date()))}
                className="ml-1 px-3 py-2 text-xs font-bold rounded-lg border border-brand-500/30 text-brand-500 bg-brand-500/10 hover:bg-brand-500/20 transition-colors uppercase tracking-wider"
              >
                {t("common.today") || "Today"}
              </button>
            )}
          </div>

          {/* Export (hourly view only) */}
          {view === "hourly" && (
            <ExportToolbar
              onPrint={() => printView(t("production.monitorTitle") || "Production Monitor")}
              onExportExcel={() =>
                exportToExcel({
                  title: `${t("production.monitorTitle") || "Production Monitor"} - ${lineName}`,
                  columns: [
                    t("dashboard.hour") || "Hour",
                    t("dashboard.target") || "Target",
                    t("dashboard.actual") || "Actual",
                    t("dashboard.difference") || "Diff",
                    t("dashboard.cumTarget") || "Cum Target",
                    t("dashboard.cumActual") || "Cum Actual",
                    t("dashboard.reasonCode") || "Reason",
                  ],
                  rows: slots.map((s) => [
                    s.hour,
                    String(s.target),
                    String(s.actual ?? ""),
                    s.actual != null ? String(s.actual - s.target) : "",
                    String(s.cumulativeTarget),
                    s.cumulativeActual != null ? String(s.cumulativeActual) : "",
                    s.reasonCode || "",
                  ]),
                })
              }
            />
          )}

          {/* Status indicators */}
          <div className="ml-auto flex items-center gap-2 text-xs">
            {saving && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 font-semibold">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t("common.saving") || "Saving..."}
              </span>
            )}
            {saveSuccess && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-semibold">
                <CheckCircle className="w-3 h-3" />
                {t("common.saved") || "Saved"}
              </span>
            )}
            {view === "hourly" && (
              <span
                className="inline-flex items-center gap-1.5 text-th-text-2"
                title={lastRefresh.toLocaleTimeString(dateLocale)}
              >
                <RefreshCw className="w-3 h-3" />
                {t("common.autoRefresh") || "Auto-refresh"}
              </span>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* HOURLY VIEW                                                     */}
        {/* ================================================================ */}
        {view === "hourly" && (
          <>
            {hourlyLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                <span className="ml-3 text-sm text-th-text-2 font-medium">
                  {t("common.loading") || "Loading..."}
                </span>
              </div>
            )}

            {hourlyError && !hourlyLoading && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  {hourlyError}
                </span>
                <button
                  onClick={() => selectedLineId !== null && fetchHourly(selectedLineId, selectedDate)}
                  className="px-3 py-1 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
                >
                  {t("common.retry") || "Retry"}
                </button>
              </div>
            )}

            {!hourlyLoading && (
              <>
                {/* KPI Banner */}
                <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
                  <div className="flex items-center gap-4 mb-5">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        hourlyStats.cumDelta >= 0
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-red-500/10 text-red-600"
                      }`}
                    >
                      <Clock className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-th-text tracking-tight">
                        {t("production.monitorHourlyTitle") || "Hourly Production"}
                      </h2>
                      <p className="text-sm text-th-text-2 mt-0.5 flex items-center gap-1.5">
                        <Factory className="w-3.5 h-3.5" />
                        {lineName} &mdash; {displayDate}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { val: hourlyStats.totalTarget, label: t("dashboard.totalTarget") || "Target", icon: Target },
                      { val: hourlyStats.totalActual, label: t("dashboard.totalActual") || "Actual", icon: Package },
                      {
                        val: `${hourlyStats.variancePct >= 0 ? "+" : ""}${hourlyStats.variancePct}%`,
                        label: t("dashboard.overallVariance") || "Variance",
                        icon: hourlyStats.variancePct >= 0 ? TrendingUp : TrendingDown,
                      },
                      { val: hourlyStats.wins, label: t("dashboard.hoursWon") || "Won", icon: CheckCircle },
                      { val: hourlyStats.losses, label: t("dashboard.hoursLost") || "Lost", icon: XCircle },
                    ].map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div key={idx} className="rounded-xl border border-th-border bg-th-bg-3 p-3 text-center">
                          <div className="flex justify-center mb-1">
                            <Icon className="w-4 h-4 text-th-text-2" />
                          </div>
                          <div className="text-2xl font-bold text-th-text">{item.val}</div>
                          <div className="text-[10px] text-th-text-2 font-bold uppercase tracking-[0.1em] mt-0.5">
                            {item.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cumulative SVG Line Chart */}
                <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
                  <h3 className="flex items-center gap-2 text-xs font-bold text-th-text-2 uppercase tracking-wider mb-4">
                    <BarChart3 className="w-4 h-4" />
                    {t("production.monitorCumulativeChart") || "Cumulative Target vs Actual"}
                  </h3>
                  <div className="relative w-full h-52">
                    <svg viewBox="0 0 600 200" className="w-full h-full" preserveAspectRatio="none">
                      {/* Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                        <line
                          key={frac}
                          x1={40} y1={10 + (1 - frac) * 180}
                          x2={590} y2={10 + (1 - frac) * 180}
                          stroke="currentColor" className="text-th-border"
                          strokeWidth={0.5} strokeDasharray={frac === 0 ? "none" : "4,4"}
                        />
                      ))}
                      {/* Target line */}
                      <polyline
                        fill="none" stroke="#6b7280" strokeWidth={2} strokeDasharray="6,4"
                        points={chartData
                          .map((d, i) => {
                            const x = 40 + (i / Math.max(chartData.length - 1, 1)) * 550;
                            const y = 190 - (d.cumTarget / chartMax) * 180;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                      />
                      {/* Actual line */}
                      {(() => {
                        const actualPoints = chartData
                          .map((d, i) =>
                            d.cumActual !== null
                              ? {
                                  x: 40 + (i / Math.max(chartData.length - 1, 1)) * 550,
                                  y: 190 - (d.cumActual / chartMax) * 180,
                                  val: d.cumActual,
                                  target: d.cumTarget,
                                }
                              : null
                          )
                          .filter(Boolean) as { x: number; y: number; val: number; target: number }[];
                        if (actualPoints.length === 0) return null;
                        return (
                          <>
                            <polyline
                              fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
                              stroke={
                                actualPoints[actualPoints.length - 1].val >= actualPoints[actualPoints.length - 1].target
                                  ? "#10b981"
                                  : "#ef4444"
                              }
                              points={actualPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                            />
                            {actualPoints.map((p, i) => (
                              <circle
                                key={i} cx={p.x} cy={p.y} r={4}
                                fill={p.val >= p.target ? "#10b981" : "#ef4444"}
                                stroke="white" strokeWidth={1.5}
                              />
                            ))}
                          </>
                        );
                      })()}
                      {/* X-axis labels */}
                      {chartData.map((d, i) => {
                        const x = 40 + (i / Math.max(chartData.length - 1, 1)) * 550;
                        return (
                          <text key={d.hour} x={x} y={198} textAnchor="middle" fontSize={9} fill="currentColor" className="text-th-text-3">
                            {d.hour.slice(0, 2)}
                          </text>
                        );
                      })}
                    </svg>
                  </div>
                  <div className="flex items-center gap-6 mt-2 text-[10px] text-th-text-2 uppercase tracking-wider font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-6 border-t-2 border-dashed border-gray-500 inline-block" />
                      {t("dashboard.cumTarget") || "Cum. Target"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-6 border-t-2 border-emerald-500 inline-block" />
                      {t("dashboard.cumActual") || "Cum. Actual"}
                    </span>
                  </div>
                </div>

                {/* Save All */}
                <div className="flex justify-end">
                  <button
                    onClick={saveAllDirty}
                    disabled={!hasDirtyRows || saving}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-colors ${
                      hasDirtyRows && !saving
                        ? "bg-brand-600 text-white hover:bg-brand-500"
                        : "bg-th-bg-3 text-th-text-2 cursor-not-allowed border border-th-border"
                    }`}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? (t("common.saving") || "Saving...") : (t("common.saveAll") || "Save All")}
                  </button>
                </div>

                {/* Hour-by-Hour Table */}
                <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-th-bg-3 text-[10px] font-bold text-th-text-2 uppercase tracking-[0.12em]">
                        <th className="p-4 text-left">{t("dashboard.hour") || "Hour"}</th>
                        <th className="p-4 text-center">{t("dashboard.target") || "Target"}</th>
                        <th className="p-4 text-center">{t("dashboard.actual") || "Actual"}</th>
                        <th className="p-4 text-center">{t("dashboard.difference") || "Diff"}</th>
                        <th className="p-4 text-center">{t("dashboard.cumTarget") || "Cum Target"}</th>
                        <th className="p-4 text-center">{t("dashboard.cumActual") || "Cum Actual"}</th>
                        <th className="p-4 text-left">{t("dashboard.reasonCode") || "Reason"}</th>
                        <th className="p-4 text-left">{t("dashboard.notes") || "Notes"}</th>
                        <th className="p-4 text-center w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {slots.map((slot, idx) => {
                        const delta = slot.actual !== null ? slot.actual - slot.target : null;
                        const isWin = delta !== null && delta >= 0;
                        const isMiss = delta !== null && delta < 0;
                        const isFuture = slot.actual === null;
                        const isCurrentHour = isToday && slot.hour === currentHour;

                        const andonClass = (() => {
                          if (isCurrentHour) return "bg-brand-500/10 ring-1 ring-inset ring-brand-500/30";
                          if (isFuture) return "bg-gray-500/[0.04] opacity-60";
                          if (slot.actual === null) return "";
                          const pct = slot.target > 0 ? (slot.actual / slot.target) * 100 : 0;
                          if (pct >= 100) return "bg-emerald-500/[0.08] border-l-4 border-l-emerald-500";
                          if (pct >= 80) return "bg-amber-500/[0.08] border-l-4 border-l-amber-400";
                          return "bg-red-500/[0.08] border-l-4 border-l-red-500";
                        })();

                        return (
                          <tr
                            key={slot.hour}
                            ref={isCurrentHour ? currentHourRef : undefined}
                            className={`border-b border-th-border/50 transition-all duration-200 hover:bg-th-bg-3 ${andonClass}`}
                          >
                            {/* Hour */}
                            <td className="p-4 font-mono font-bold text-th-text whitespace-nowrap text-sm">
                              {slot.hour}
                              {isCurrentHour && (
                                <span className="ml-2 relative inline-flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500" />
                                </span>
                              )}
                            </td>

                            {/* Target */}
                            <td className="p-4 text-center text-th-text-2 font-medium">{slot.target}</td>

                            {/* Actual (editable) */}
                            <td className="p-4 text-center">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={slot.actual ?? ""}
                                onChange={(e) => updateSlot(idx, "actual", e.target.value)}
                                onBlur={() => { if (slot.dirty) saveSlot(slots[idx]); }}
                                className="w-16 text-center text-sm font-bold border border-th-border rounded-lg py-1.5 focus:ring-2 focus:ring-brand-500/50 outline-none bg-th-bg-2 text-th-text"
                                placeholder="--"
                              />
                            </td>

                            {/* Diff */}
                            <td className="p-4 text-center text-sm font-bold">
                              {delta !== null ? (
                                <span className={isWin ? "text-emerald-600" : "text-red-600"}>
                                  {delta >= 0 ? "+" : ""}{delta}
                                </span>
                              ) : (
                                <span className="text-th-text-3">--</span>
                              )}
                            </td>

                            {/* Cumulative Target */}
                            <td className="p-4 text-center text-th-text-2 font-mono text-xs">
                              {slot.cumulativeTarget}
                            </td>

                            {/* Cumulative Actual */}
                            <td className="p-4 text-center font-mono text-xs">
                              {slot.cumulativeActual !== null ? (
                                <span
                                  className={`font-bold ${
                                    slot.cumulativeActual >= slot.cumulativeTarget
                                      ? "text-emerald-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {slot.cumulativeActual}
                                </span>
                              ) : (
                                <span className="text-th-text-3">--</span>
                              )}
                            </td>

                            {/* Reason (links to Andon on red rows) */}
                            <td className="p-4">
                              {isMiss ? (
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={slot.reasonCode}
                                    onChange={(e) => {
                                      updateSlot(idx, "reasonCode", e.target.value);
                                      const updated = { ...slot, reasonCode: e.target.value as MissReason, dirty: true };
                                      saveSlot(updated);
                                    }}
                                    className={`flex-1 text-xs border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-red-500/40 outline-none bg-th-bg-2 text-th-text ${
                                      slot.reasonCode ? "border-th-border" : "border-red-500/30 animate-pulse"
                                    }`}
                                  >
                                    <option value="">{t("dashboard.selectReason") || "Select reason"}</option>
                                    {MISS_REASONS.map((r) => (
                                      <option key={r} value={r}>
                                        {t(`dashboard.reason_${r}`) || r}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => router.push("/operations/andon")}
                                    className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                                    title={t("production.monitorLogAndon") || "Log in Andon Board"}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-th-text-3">--</span>
                              )}
                            </td>

                            {/* Notes */}
                            <td className="p-4">
                              <input
                                type="text"
                                value={slot.notes}
                                onChange={(e) => updateSlot(idx, "notes", e.target.value)}
                                onBlur={() => { if (slot.dirty) saveSlot(slots[idx]); }}
                                className="w-full text-xs border border-th-border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-brand-500/50 outline-none bg-th-bg-2 text-th-text"
                                placeholder={t("dashboard.notesPlaceholder") || "Notes..."}
                              />
                            </td>

                            {/* Save indicator */}
                            <td className="p-4 text-center">
                              {slot.dirty && (
                                <button
                                  onClick={() => saveSlot(slots[idx])}
                                  disabled={saving}
                                  className="p-1.5 rounded-lg text-brand-500 hover:bg-brand-500/10 transition-colors border border-transparent hover:border-brand-500/20"
                                  title={t("common.save") || "Save"}
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary Stats */}
                <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
                  <h3 className="flex items-center gap-2 text-xs font-bold text-th-text-2 uppercase tracking-wider mb-4">
                    <Target className="w-4 h-4" />
                    {t("production.monitorSummary") || "Summary"}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <SummaryKpi value={String(hourlyStats.totalTarget)} label={t("dashboard.totalTarget") || "Target"} color="slate" />
                    <SummaryKpi value={String(hourlyStats.totalActual)} label={t("dashboard.totalActual") || "Actual"} color="slate" />
                    <SummaryKpi
                      value={`${hourlyStats.variancePct >= 0 ? "+" : ""}${hourlyStats.variancePct}%`}
                      label={t("dashboard.overallVariance") || "Variance"}
                      color={hourlyStats.variancePct >= 0 ? "emerald" : "red"}
                    />
                    <SummaryKpi value={String(hourlyStats.wins)} label={t("dashboard.hoursWon") || "Won"} color="emerald" />
                    <SummaryKpi value={String(hourlyStats.losses)} label={t("dashboard.hoursLost") || "Lost"} color="red" />
                  </div>

                  {hourlyStats.totalTarget > 0 && (
                    <div className="mt-5">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-th-text-2 mb-2">
                        <span>{hourlyStats.totalActual} / {hourlyStats.totalTarget}</span>
                        <span>{Math.round((hourlyStats.totalActual / hourlyStats.totalTarget) * 100)}%</span>
                      </div>
                      <div className="w-full h-3 bg-th-bg-3 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            hourlyStats.totalActual >= hourlyStats.totalTarget ? "bg-emerald-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min((hourlyStats.totalActual / hourlyStats.totalTarget) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* SHIFT VIEW                                                      */}
        {/* ================================================================ */}
        {view === "shift" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-th-text">
                  {t("production.monitorShiftEntry") || "Per-Shift Production Entry"}
                </h3>
                <span className="text-sm text-th-text-2">{displayDate}</span>
              </div>

              <FeedbackBanner msg={shiftFeedback} />

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-th-border text-left text-xs uppercase text-th-text-3">
                      <th className="px-2 py-2">{t("common.line") || "Line"} *</th>
                      <th className="px-2 py-2">{t("production.monitorShift") || "Shift"}</th>
                      <th className="px-2 py-2">{t("dashboard.product") || "Product"}</th>
                      <th className="px-2 py-2 w-20">{t("common.total") || "Total"} *</th>
                      <th className="px-2 py-2 w-20">{t("dashboard.good") || "Good"} *</th>
                      <th className="px-2 py-2 w-20">{t("production.monitorPlanMin") || "Plan (min)"}</th>
                      <th className="px-2 py-2 w-20">{t("production.monitorDownMin") || "Down (min)"}</th>
                      <th className="px-2 py-2 w-20">{t("production.monitorCycleSec") || "Cycle (s)"} *</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftRows.map((row, idx) => {
                      const selLine = lines.find((l) => l.id === row.lineId);
                      const shifts = selLine?.shifts ?? [];
                      return (
                        <tr key={row.key} className="border-b border-th-border/50">
                          <td className="px-1 py-1.5">
                            <select
                              className={cls}
                              value={row.lineId}
                              onChange={(e) =>
                                updateShiftRow(idx, {
                                  lineId: e.target.value ? Number(e.target.value) : "",
                                  shiftId: "",
                                })
                              }
                            >
                              <option value="">--</option>
                              {lines.map((l) => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-1 py-1.5">
                            <select
                              className={cls}
                              value={row.shiftId}
                              onChange={(e) =>
                                updateShiftRow(idx, { shiftId: e.target.value ? Number(e.target.value) : "" })
                              }
                              disabled={!row.lineId}
                            >
                              <option value="">--</option>
                              {shifts.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-1 py-1.5">
                            <select
                              className={cls}
                              value={row.productId}
                              onChange={(e) =>
                                updateShiftRow(idx, { productId: e.target.value ? Number(e.target.value) : "" })
                              }
                            >
                              <option value="">--</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-1 py-1.5">
                            <input
                              type="number" min={0} className={cls} value={row.totalPieces}
                              onChange={(e) => updateShiftRow(idx, { totalPieces: e.target.value ? Number(e.target.value) : "" })}
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <input
                              type="number" min={0} className={cls} value={row.goodPieces}
                              onChange={(e) => updateShiftRow(idx, { goodPieces: e.target.value ? Number(e.target.value) : "" })}
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <input
                              type="number" min={0} className={cls} value={row.plannedTime}
                              onChange={(e) => updateShiftRow(idx, { plannedTime: e.target.value ? Number(e.target.value) : "" })}
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <input
                              type="number" min={0} className={cls} value={row.downtime}
                              onChange={(e) => updateShiftRow(idx, { downtime: e.target.value ? Number(e.target.value) : 0 })}
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <input
                              type="number" min={0} step="0.1" className={cls} value={row.cycleTime}
                              onChange={(e) => updateShiftRow(idx, { cycleTime: e.target.value ? Number(e.target.value) : "" })}
                            />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            {shiftRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeShiftRow(idx)}
                                className="text-red-400 hover:text-red-600 text-lg leading-none"
                              >
                                &times;
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={addShiftRow}
                  className="text-sm text-brand-600 hover:text-brand-700 font-semibold"
                >
                  + {t("production.monitorAddRow") || "Add Row"}
                </button>
                <button
                  onClick={handleShiftSubmit}
                  disabled={shiftSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {shiftSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("production.monitorSubmitAll") || "Submit All"} (
                  {shiftRows.filter((r) => r.lineId && r.totalPieces && r.goodPieces && r.cycleTime).length}
                  )
                </button>
              </div>
            </div>

            {/* Recent records */}
            <RecentRecordsTable records={records} loading={recordsLoading} />
          </div>
        )}

        {/* ================================================================ */}
        {/* DAILY VIEW                                                      */}
        {/* ================================================================ */}
        {view === "daily" && (
          <div className="space-y-6">
            {/* Daily summary cards */}
            <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-th-text flex items-center gap-2">
                  <LayoutList className="w-5 h-5 text-th-text-2" />
                  {t("production.monitorDailySummary") || "Daily Production Summary"}
                </h3>
                <button
                  onClick={() => router.push("/operations/home")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-th-border text-th-text-2 hover:bg-th-bg-3 transition-colors"
                >
                  {t("production.monitorViewOEE") || "View OEE Dashboard"}
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {recordsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                </div>
              ) : dailySummary.length === 0 ? (
                <div className="text-center py-10 text-sm text-th-text-3">
                  {t("production.monitorNoRecords") || "No production records found."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-th-bg-3 text-[10px] font-bold text-th-text-2 uppercase tracking-[0.12em]">
                        <th className="p-3 text-left">{t("common.date") || "Date"}</th>
                        <th className="p-3 text-right">{t("production.monitorRecords") || "Records"}</th>
                        <th className="p-3 text-right">{t("common.total") || "Total Pcs"}</th>
                        <th className="p-3 text-right">{t("dashboard.good") || "Good Pcs"}</th>
                        <th className="p-3 text-right">{t("production.monitorYield") || "Yield %"}</th>
                        <th className="p-3 text-right">{t("production.monitorRunMin") || "Run (min)"}</th>
                        <th className="p-3 text-right">{t("production.monitorPlannedMin") || "Planned (min)"}</th>
                        <th className="p-3 text-right">{t("production.monitorAvailability") || "Avail %"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySummary.map((day) => {
                        const yieldPct = day.totalPieces > 0 ? Math.round((day.goodPieces / day.totalPieces) * 100) : 0;
                        const availPct = day.plannedMin > 0 ? Math.round((day.runMin / day.plannedMin) * 100) : 0;
                        return (
                          <tr key={day.date} className="border-b border-th-border/50 hover:bg-th-bg-3 transition-colors">
                            <td className="p-3 font-medium text-th-text">{day.date}</td>
                            <td className="p-3 text-right text-th-text-2">{day.recordCount}</td>
                            <td className="p-3 text-right font-bold text-th-text">{day.totalPieces.toLocaleString()}</td>
                            <td className="p-3 text-right text-th-text">{day.goodPieces.toLocaleString()}</td>
                            <td className="p-3 text-right">
                              <span
                                className={`font-bold ${
                                  yieldPct >= 95 ? "text-emerald-600" : yieldPct >= 85 ? "text-amber-500" : "text-red-600"
                                }`}
                              >
                                {yieldPct}%
                              </span>
                            </td>
                            <td className="p-3 text-right text-th-text-2">{day.runMin}</td>
                            <td className="p-3 text-right text-th-text-2">{day.plannedMin}</td>
                            <td className="p-3 text-right">
                              <span
                                className={`font-bold ${
                                  availPct >= 90 ? "text-emerald-600" : availPct >= 75 ? "text-amber-500" : "text-red-600"
                                }`}
                              >
                                {availPct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Daily cumulative bar chart */}
            {dailySummary.length > 0 && (
              <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
                <h3 className="flex items-center gap-2 text-xs font-bold text-th-text-2 uppercase tracking-wider mb-4">
                  <BarChart3 className="w-4 h-4" />
                  {t("production.monitorDailyChart") || "Daily Output (Total vs Good)"}
                </h3>
                <div className="flex items-end gap-2 h-44">
                  {dailySummary
                    .slice()
                    .reverse()
                    .map((day) => {
                      const maxPieces = Math.max(...dailySummary.map((d) => d.totalPieces), 1);
                      const totalH = (day.totalPieces / maxPieces) * 100;
                      const goodH = (day.goodPieces / maxPieces) * 100;
                      return (
                        <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end group">
                          <div className="flex items-end gap-0.5 w-full h-full">
                            <div
                              className="flex-1 bg-th-bg-3 rounded-t transition-all duration-500"
                              style={{ height: `${totalH}%`, minHeight: "2px" }}
                              title={`Total: ${day.totalPieces}`}
                            />
                            <div
                              className="flex-1 bg-emerald-500 rounded-t transition-all duration-500"
                              style={{ height: `${goodH}%`, minHeight: "2px" }}
                              title={`Good: ${day.goodPieces}`}
                            />
                          </div>
                          <span className="text-[9px] text-th-text-2 leading-none mt-1 font-mono group-hover:text-th-text transition-colors">
                            {day.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                </div>
                <div className="flex items-center gap-6 mt-3 text-[10px] text-th-text-2 uppercase tracking-wider font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-th-bg-3 inline-block" />
                    {t("common.total") || "Total"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                    {t("dashboard.good") || "Good"}
                  </span>
                </div>
              </div>
            )}

            {/* All records table */}
            <RecentRecordsTable records={records} loading={recordsLoading} />
          </div>
        )}
      </div>
    </DisplayModeWrapper>
  );
}

// ---------------------------------------------------------------------------
// Recent Records Table (shared between shift & daily)
// ---------------------------------------------------------------------------

function RecentRecordsTable({
  records,
  loading,
}: {
  records: ProductionRecord[];
  loading: boolean;
}) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6 text-center text-sm text-th-text-3">
        {t("production.monitorNoRecords") || "No recent records found."}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
      <div className="px-6 py-3 border-b border-th-border">
        <h4 className="text-sm font-semibold text-th-text">
          {t("production.monitorRecentRecords") || "Recent Records"}
        </h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-th-border bg-th-bg-3">
              <th className="text-left px-4 py-2 font-medium text-th-text-2">{t("common.date") || "Date"}</th>
              <th className="text-left px-4 py-2 font-medium text-th-text-2">{t("common.line") || "Line"}</th>
              <th className="text-right px-4 py-2 font-medium text-th-text-2">{t("common.total") || "Total"}</th>
              <th className="text-right px-4 py-2 font-medium text-th-text-2">{t("dashboard.good") || "Good"}</th>
              <th className="text-right px-4 py-2 font-medium text-th-text-2">{t("production.monitorRunMin") || "Run (min)"}</th>
              <th className="text-left px-4 py-2 font-medium text-th-text-2">{t("common.notes") || "Notes"}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-th-border last:border-0 hover:bg-th-bg-3/50">
                <td className="px-4 py-2 text-th-text">{r.date}</td>
                <td className="px-4 py-2 text-th-text">{r.production_line_name ?? r.production_line_id}</td>
                <td className="px-4 py-2 text-right text-th-text">{r.total_pieces}</td>
                <td className="px-4 py-2 text-right text-th-text">{r.good_pieces}</td>
                <td className="px-4 py-2 text-right text-th-text">{r.actual_run_time_min}</td>
                <td className="px-4 py-2 text-th-text-3 truncate max-w-[200px]">{r.notes ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
