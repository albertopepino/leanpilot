"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi, adminApi, manufacturingApi, productionApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
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
  Plus,
  ChevronLeft,
  ChevronRight,
  Factory,
  RefreshCw,
  Loader2,
  Grid3x3,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
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

// Map miss reasons to DowntimeEvent categories for OEE loss waterfall
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
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
];

const DEFAULT_TARGET = 50;
const REFRESH_INTERVAL_MS = 30_000;

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
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:00`;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function HourlyProductionBoard() {
  const { t, locale } = useI18n();
  const { printView, exportToExcel } = useExport();
  const dateLocale = locale === "it" ? "it-IT" : "en-GB";

  // --- State ---------------------------------------------------------------
  const [lines, setLines] = useState<LineOption[]>([]);
  const [linesLoading, setLinesLoading] = useState(true);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => toISODate(new Date()));
  const [slots, setSlots] = useState<HourlySlot[]>(() => buildEmptySlots());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quick-add states
  const [showAddLine, setShowAddLine] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newLineName, setNewLineName] = useState("");
  const [newProduct, setNewProduct] = useState({ code: "", name: "", unit_of_measure: "pcs" });
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  // --- Load lines from factory ---------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLinesLoading(true);
      try {
        const res = await adminApi.getFactory();
        const factory = res.data;
        const factoryLines = factory?.production_lines || factory?.lines || [];
        if (Array.isArray(factoryLines) && factoryLines.length > 0) {
          const mapped = factoryLines.map((l: any) => ({ id: l.id, name: l.name }));
          if (!cancelled) {
            setLines(mapped);
            setSelectedLineId(mapped[0].id);
          }
        } else {
          if (!cancelled) {
            setLines([]);
          }
        }
      } catch {
        if (!cancelled) {
          setLines([]);
        }
      } finally {
        if (!cancelled) setLinesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  // --- Fetch hourly data ---------------------------------------------------
  const fetchData = useCallback(async (lineId: number, date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await advancedLeanApi.getHourlyView(lineId, date);
      const data = res.data;
      if (data && Array.isArray(data.slots) && data.slots.length > 0) {
        const mapped: HourlySlot[] = data.slots.map((s: any) => ({
          hour: s.hour ?? "00:00",
          target: s.target ?? DEFAULT_TARGET,
          actual: s.actual ?? null,
          cumulativeTarget: 0,
          cumulativeActual: null,
          notes: s.notes ?? "",
          reasonCode: (s.reasonCode ?? s.reason_code ?? "") as MissReason,
          dirty: false,
        }));
        setSlots(recalcCumulatives(mapped));
      } else {
        setSlots(buildEmptySlots());
      }
    } catch {
      setSlots(buildEmptySlots());
      setError(t("dashboard.errorLoadingData"));
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [t]);

  // Fetch when line/date changes
  useEffect(() => {
    if (selectedLineId !== null) {
      fetchData(selectedLineId, selectedDate);
    }
  }, [selectedLineId, selectedDate, fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (selectedLineId === null) return;
    refreshTimer.current = setInterval(() => {
      fetchData(selectedLineId, selectedDate);
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [selectedLineId, selectedDate, fetchData]);

  // --- Slot editing --------------------------------------------------------
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

  // --- Create DowntimeEvent from miss reason --------------------------------
  const createDowntimeFromMiss = async (lineId: number, date: string, slot: HourlySlot) => {
    if (!slot.reasonCode || slot.actual === null || slot.actual >= slot.target) return;
    const category = MISS_REASON_TO_DOWNTIME_CATEGORY[slot.reasonCode] ?? "other";
    const hourNum = parseInt(slot.hour.split(":")[0], 10);
    const startTime = `${date}T${String(hourNum).padStart(2, "0")}:00:00`;
    const endTime = `${date}T${String(hourNum + 1).padStart(2, "0")}:00:00`;
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
      // Non-blocking: hourly data is already saved; downtime is best-effort
    }
  };

  // --- Save single row -----------------------------------------------------
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
      // Also create a DowntimeEvent for OEE loss waterfall
      await createDowntimeFromMiss(selectedLineId, selectedDate, slot);
      setSlots((prev) =>
        prev.map((s) => (s.hour === slot.hour ? { ...s, dirty: false } : s))
      );
    } catch {
      // keep dirty flag so user knows it wasn't saved
    } finally {
      setSaving(false);
    }
  };

  // --- Save all dirty rows -------------------------------------------------
  const saveAll = async () => {
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
        // Also create a DowntimeEvent for OEE loss waterfall
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

  // --- Quick-add handlers ---------------------------------------------------
  const handleAddLine = async () => {
    if (!newLineName.trim()) return;
    setQuickAddLoading(true);
    try {
      await adminApi.createProductionLine({ name: newLineName.trim() });
      // Re-fetch lines
      const res = await adminApi.getFactory();
      const factory = res.data;
      const factoryLines = factory?.production_lines || factory?.lines || [];
      if (Array.isArray(factoryLines) && factoryLines.length > 0) {
        const mapped = factoryLines.map((l: any) => ({ id: l.id, name: l.name }));
        setLines(mapped);
        // Select the newly added line (last one)
        setSelectedLineId(mapped[mapped.length - 1].id);
      }
      setNewLineName("");
      setShowAddLine(false);
    } catch {
      setError("Failed to create line");
      setTimeout(() => setError(null), 3000);
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.code.trim() || !newProduct.name.trim()) return;
    setQuickAddLoading(true);
    try {
      await manufacturingApi.createProduct(newProduct);
      setNewProduct({ code: "", name: "", unit_of_measure: "pcs" });
      setShowAddProduct(false);
    } catch {
      setError("Failed to create product");
      setTimeout(() => setError(null), 3000);
    } finally {
      setQuickAddLoading(false);
    }
  };

  // --- Computed KPIs -------------------------------------------------------
  const currentHour = getCurrentHour();

  const stats = useMemo(() => {
    const completed = slots.filter((s) => s.actual !== null);
    const totalTarget = completed.reduce((acc, s) => acc + s.target, 0);
    const totalActual = completed.reduce((acc, s) => acc + (s.actual ?? 0), 0);
    const wins = completed.filter((s) => (s.actual ?? 0) >= s.target).length;
    const losses = completed.length - wins;
    const variancePct = totalTarget > 0
      ? Math.round(((totalActual - totalTarget) / totalTarget) * 100)
      : 0;
    const cumDelta = totalActual - totalTarget;
    return { totalTarget, totalActual, wins, losses, variancePct, cumDelta, completedCount: completed.length };
  }, [slots]);

  const hasDirtyRows = slots.some((s) => s.dirty);

  // --- Date helpers --------------------------------------------------------
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(toISODate(d));
  };

  const displayDate = new Date(selectedDate + "T00:00:00").toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const isToday = selectedDate === toISODate(new Date());

  const selectedLine = lines.find((l) => l.id === selectedLineId);
  const lineName = selectedLine?.name ?? "";

  // --- Cumulative chart data -----------------------------------------------
  const chartData = useMemo(() => {
    return slots.map((s) => ({
      hour: s.hour,
      cumTarget: s.cumulativeTarget,
      cumActual: s.cumulativeActual,
    }));
  }, [slots]);

  const chartMax = useMemo(() => {
    let max = 0;
    for (const d of chartData) {
      if (d.cumTarget > max) max = d.cumTarget;
      if (d.cumActual !== null && d.cumActual > max) max = d.cumActual;
    }
    return max || 1;
  }, [chartData]);

  // --- Bar chart data for hourly comparison --------------------------------
  const barMax = useMemo(() => {
    let max = 0;
    for (const s of slots) {
      if (s.target > max) max = s.target;
      if (s.actual !== null && s.actual > max) max = s.actual;
    }
    return max || 1;
  }, [slots]);

  // --- Render --------------------------------------------------------------
  return (
    <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true" role="region" aria-label="Hourly Production Board">
      {/* ================================================================== */}
      {/* Control Bar                                                        */}
      {/* ================================================================== */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Line selector */}
        {linesLoading ? (
          <span className="text-sm text-th-text-2 animate-pulse">{t("dashboard.loadingLines")}</span>
        ) : lines.length === 0 ? (
          <span className="text-sm text-th-text-2">{t("dashboard.noLinesAvailable")}</span>
        ) : (
          <div className="flex items-center gap-1">
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
            <button
              onClick={() => setShowAddLine(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-dashed border-th-border text-th-text-2 hover:bg-th-bg-3 hover:text-brand-500 hover:border-brand-500/50 transition-all"
              title={t("dashboard.addLine") || "Add Line"}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAddProduct(true)}
              className="px-2.5 py-1.5 flex items-center gap-1 rounded-lg border border-dashed border-th-border text-th-text-2 hover:bg-th-bg-3 hover:text-brand-500 hover:border-brand-500/50 transition-all text-xs font-semibold"
              title={t("dashboard.addProduct") || "Add Product"}
            >
              <Package className="w-3.5 h-3.5" />
              {t("dashboard.product") || "Product"}
            </button>
          </div>
        )}

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftDate(-1)}
            className="px-2.5 py-2 rounded-lg border border-th-border bg-th-input text-th-text hover:bg-th-bg-3 transition-colors text-sm"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm border border-th-border rounded-lg px-3 py-2 bg-th-input text-th-text focus:ring-2 focus:ring-brand-500/50 outline-none"
          />
          <button
            onClick={() => shiftDate(1)}
            className="px-2.5 py-2 rounded-lg border border-th-border bg-th-input text-th-text hover:bg-th-bg-3 transition-colors text-sm"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(toISODate(new Date()))}
              className="ml-1 px-3 py-2 text-xs font-bold rounded-lg border border-brand-500/30 text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 transition-colors uppercase tracking-wider"
            >
              {t("dashboard.today")}
            </button>
          )}
        </div>

        {/* Export */}
        <ExportToolbar
          onPrint={() => printView(t("common.titleHourly"))}
          onExportExcel={() =>
            exportToExcel({
              title: t("common.titleHourly"),
              columns: [
                t("dashboard.hour") || "Hour",
                t("dashboard.target") || "Target",
                t("dashboard.actual") || "Actual",
                t("dashboard.difference") || "Difference",
                t("dashboard.missReason") || "Miss Reason",
              ],
              rows: slots.map((s) => [
                s.hour,
                String(s.target),
                String(s.actual ?? ""),
                s.actual != null ? String(s.actual - s.target) : "",
                s.reasonCode || "",
              ]),
            })
          }
        />

        <div className="ml-auto flex items-center gap-2 text-xs">
          {saving && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 font-semibold">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t("dashboard.saving")}
            </span>
          )}
          {saveSuccess && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-semibold">
              <CheckCircle className="w-3 h-3" />
              {t("dashboard.saveAllSuccess")}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-th-text-2" title={lastRefresh.toLocaleTimeString(dateLocale)}>
            <RefreshCw className="w-3 h-3" />
            {t("dashboard.autoRefresh")}
          </span>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Loading / Error states                                             */}
      {/* ================================================================== */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
            <span className="text-sm text-th-text-2 font-medium">{t("dashboard.loadingData")}</span>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </span>
          <button
            onClick={() => selectedLineId !== null && fetchData(selectedLineId, selectedDate)}
            className="px-3 py-1 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
          >
            {t("dashboard.retry")}
          </button>
        </div>
      )}

      {!loading && (
        <>
          {/* ================================================================ */}
          {/* KPI Banner                                                       */}
          {/* ================================================================ */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                stats.cumDelta >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
              }`}>
                <Clock className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-th-text tracking-tight">{t("dashboard.hourlyTitle")}</h2>
                <p className="text-sm text-th-text-2 mt-0.5 flex items-center gap-1.5">
                  <Factory className="w-3.5 h-3.5" />
                  {lineName} &mdash; {displayDate}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { val: stats.totalTarget, label: t("dashboard.totalTarget"), icon: Target },
                { val: stats.totalActual, label: t("dashboard.totalActual"), icon: Package },
                { val: `${stats.variancePct >= 0 ? "+" : ""}${stats.variancePct}%`, label: t("dashboard.overallVariance"), icon: stats.variancePct >= 0 ? TrendingUp : TrendingDown },
                { val: stats.wins, label: t("dashboard.hoursWon"), icon: CheckCircle },
                { val: stats.losses, label: t("dashboard.hoursLost"), icon: XCircle },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="rounded-xl border border-th-border bg-th-bg-3 p-3 text-center">
                    <div className="flex justify-center mb-1">
                      <Icon className="w-4 h-4 text-th-text-2" />
                    </div>
                    <div className="text-2xl font-bold text-th-text">{item.val}</div>
                    <div className="text-[10px] text-th-text-2 font-bold uppercase tracking-[0.1em] mt-0.5">{item.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================================================================ */}
          {/* Hourly Bar Chart                                                 */}
          {/* ================================================================ */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
            <h3 className="flex items-center gap-2 text-xs font-bold text-th-text-2 uppercase tracking-wider mb-4">
              <BarChart3 className="w-4 h-4" />
              {t("dashboard.cumulativeChart")}
            </h3>
            <div className="flex items-end gap-1.5 h-48">
              {chartData.map((d, idx) => {
                const targetH = (d.cumTarget / chartMax) * 100;
                const actualH = d.cumActual !== null ? (d.cumActual / chartMax) * 100 : 0;
                const ahead = d.cumActual !== null && d.cumActual >= d.cumTarget;
                return (
                  <div key={d.hour} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end group">
                    <div className="flex items-end gap-0.5 w-full h-full">
                      {/* Target bar */}
                      <div
                        className="flex-1 bg-th-bg-3 rounded-t transition-all duration-500"
                        style={{ height: `${targetH}%`, minHeight: "2px" }}
                        title={`${t("dashboard.hourlyTarget")}: ${d.cumTarget}`}
                      />
                      {/* Actual bar */}
                      <div
                        className={`flex-1 rounded-t transition-all duration-500 ${
                          d.cumActual === null
                            ? "bg-th-bg-3/50"
                            : ahead
                            ? "bg-emerald-500"
                            : "bg-red-500"
                        }`}
                        style={{ height: d.cumActual !== null ? `${actualH}%` : "2px", minHeight: "2px" }}
                        title={d.cumActual !== null ? `${t("dashboard.hourlyActual")}: ${d.cumActual}` : "--"}
                      />
                    </div>
                    <span className="text-[9px] text-th-text-2 leading-none mt-1 font-mono group-hover:text-th-text transition-colors">
                      {d.hour.slice(0, 2)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-6 mt-3 text-[10px] text-th-text-2 uppercase tracking-wider font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-th-bg-3 inline-block" />
                {t("dashboard.cumTarget")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                {t("dashboard.cumActual")}
              </span>
            </div>
          </div>

          {/* ================================================================ */}
          {/* Weekly Production Heatmap                                        */}
          {/* ================================================================ */}
          {(() => {
            // Build a 7-day heatmap from current slot data
            const today = new Date(selectedDate + "T00:00:00");
            const weekDays: { label: string; date: string; slots: HourlySlot[] }[] = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date(today);
              d.setDate(d.getDate() - i);
              const iso = toISODate(d);
              const dayLabel = d.toLocaleDateString(dateLocale, { weekday: "short", day: "numeric" });
              // Only the selected date has real slot data; others show empty placeholder
              weekDays.push({
                label: dayLabel,
                date: iso,
                slots: iso === selectedDate ? slots : [],
              });
            }
            const hours = DEFAULT_SHIFT_HOURS;

            return (
              <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
                <h3 className="flex items-center gap-2 text-xs font-bold text-th-text-2 uppercase tracking-wider mb-4">
                  <Grid3x3 className="w-4 h-4" />
                  {t("dashboard.weeklyHeatmap") || "Weekly Production Heatmap"}
                </h3>
                <div className="overflow-x-auto">
                  <div className="grid gap-px" style={{ gridTemplateColumns: `80px repeat(${hours.length}, 1fr)` }}>
                    {/* Header row — hours */}
                    <div className="text-[9px] text-th-text-2 font-mono p-1" />
                    {hours.map((h) => (
                      <div key={h} className="text-[9px] text-th-text-2 text-center font-mono p-1">
                        {h.slice(0, 2)}
                      </div>
                    ))}
                    {/* Data rows — one per day */}
                    {weekDays.map((day) => (
                      <>
                        <div key={day.date + "-label"} className="text-[10px] text-th-text-2 font-medium p-1 truncate flex items-center">
                          {day.label}
                        </div>
                        {hours.map((h) => {
                          const slot = day.slots.find((s) => s.hour === h);
                          const hasData = slot && slot.actual !== null;
                          const pct = hasData && slot.target > 0 ? (slot.actual! / slot.target) * 100 : 0;
                          let bg = "bg-th-bg-3/30";
                          if (hasData) {
                            if (pct >= 100) bg = "bg-emerald-500/80";
                            else if (pct >= 85) bg = "bg-emerald-500/40";
                            else if (pct >= 70) bg = "bg-amber-500/50";
                            else bg = "bg-red-500/50";
                          }
                          return (
                            <div
                              key={day.date + h}
                              className={`${bg} rounded-sm h-6 transition-colors`}
                              title={hasData ? `${slot.actual}/${slot.target} (${Math.round(pct)}%)` : "—"}
                            />
                          );
                        })}
                      </>
                    ))}
                  </div>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 mt-3 text-[9px] text-th-text-2 uppercase tracking-wider font-medium">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500/80 inline-block" />{">"}100%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500/40 inline-block" />85-99%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500/50 inline-block" />70-84%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500/50 inline-block" />{"<"}70%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-th-bg-3/30 inline-block" />{t("dashboard.noData") || "No data"}</span>
                </div>
              </div>
            );
          })()}

          {/* ================================================================ */}
          {/* Save All button                                                  */}
          {/* ================================================================ */}
          <div className="flex justify-end">
            <button
              onClick={saveAll}
              disabled={!hasDirtyRows || saving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-colors ${
                hasDirtyRows && !saving
                  ? "bg-brand-600 text-white hover:bg-brand-500"
                  : "bg-th-bg-3 text-th-text-2 cursor-not-allowed border border-th-border"
              }`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? t("dashboard.saving") : t("dashboard.saveAll")}
            </button>
          </div>

          {/* ================================================================ */}
          {/* Hour-by-Hour Table                                               */}
          {/* ================================================================ */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-th-bg-3 text-[10px] font-bold text-th-text-2 uppercase tracking-[0.12em]">
                  <th className="p-4 text-left">{t("dashboard.hour")}</th>
                  <th className="p-4 text-center">{t("dashboard.hourlyTarget")}</th>
                  <th className="p-4 text-center">{t("dashboard.hourlyActual")}</th>
                  <th className="p-4 text-center">{t("dashboard.cumTarget")}</th>
                  <th className="p-4 text-center">{t("dashboard.cumActual")}</th>
                  <th className="p-4 text-center">{t("dashboard.variance")}</th>
                  <th className="p-4 text-center">{t("dashboard.winLoss")}</th>
                  <th className="p-4 text-left">{t("dashboard.reasonCode")}</th>
                  <th className="p-4 text-left">{t("dashboard.notes")}</th>
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

                  return (
                    <tr
                      key={slot.hour}
                      className={`border-b border-th-border/50 transition-all duration-200 hover:bg-th-bg-3 ${
                        isCurrentHour
                          ? "bg-brand-500/10 ring-1 ring-inset ring-brand-500/30"
                          : !isFuture && isWin
                            ? "bg-emerald-500/[0.04]"
                            : !isFuture && isMiss
                              ? "bg-red-500/[0.04]"
                              : isFuture
                                ? "opacity-60"
                                : ""
                      }`}
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
                          className="w-16 text-center text-sm font-bold border border-th-border rounded-lg py-1.5 focus:ring-2 focus:ring-brand-500/50 outline-none bg-th-input text-th-text"
                          placeholder="--"
                        />
                      </td>

                      {/* Cumulative Target */}
                      <td className="p-4 text-center text-th-text-2 font-mono text-xs">
                        {slot.cumulativeTarget}
                      </td>

                      {/* Cumulative Actual */}
                      <td className="p-4 text-center font-mono text-xs">
                        {slot.cumulativeActual !== null ? (
                          <span className={`font-bold ${
                            slot.cumulativeActual >= slot.cumulativeTarget
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}>
                            {slot.cumulativeActual}
                          </span>
                        ) : (
                          <span className="text-th-text-3">--</span>
                        )}
                      </td>

                      {/* Variance */}
                      <td className="p-4 text-center text-sm font-bold">
                        {delta !== null ? (
                          <span className={
                            isWin
                              ? "text-emerald-600"
                              : "text-red-600"
                          }>
                            {delta >= 0 ? "+" : ""}{delta}
                          </span>
                        ) : (
                          <span className="text-th-text-3">--</span>
                        )}
                      </td>

                      {/* Win/Loss indicator */}
                      <td className="p-4 text-center">
                        {delta !== null ? (
                          isWin ? (
                            <span
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              title={t("dashboard.win")}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 text-red-600 border border-red-500/20"
                              title={t("dashboard.loss")}
                            >
                              <XCircle className="w-4 h-4" />
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-th-bg-3 text-th-text-3 text-xs border border-th-border">
                            --
                          </span>
                        )}
                      </td>

                      {/* Reason for miss */}
                      <td className="p-4">
                        {isMiss ? (
                          <select
                            value={slot.reasonCode}
                            onChange={(e) => {
                              updateSlot(idx, "reasonCode", e.target.value);
                              const updated = { ...slot, reasonCode: e.target.value as MissReason, dirty: true };
                              saveSlot(updated);
                            }}
                            className={`w-full text-xs border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-red-500/40 outline-none bg-th-input text-th-text ${
                              slot.reasonCode
                                ? "border-th-border"
                                : "border-red-500/30 animate-pulse"
                            }`}
                          >
                            <option value="">{t("dashboard.selectReason")}</option>
                            {MISS_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {t(`dashboard.reason_${r}`)}
                              </option>
                            ))}
                          </select>
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
                          className="w-full text-xs border border-th-border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-brand-500/50 outline-none bg-th-input text-th-text"
                          placeholder={t("dashboard.notesPlaceholder")}
                        />
                      </td>

                      {/* Per-row save indicator */}
                      <td className="p-4 text-center">
                        {slot.dirty && (
                          <button
                            onClick={() => saveSlot(slots[idx])}
                            disabled={saving}
                            className="p-1.5 rounded-lg text-brand-500 hover:bg-brand-500/10 transition-colors border border-transparent hover:border-brand-500/20"
                            title={t("dashboard.saveAll")}
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

          {/* ================================================================ */}
          {/* Summary Stats                                                    */}
          {/* ================================================================ */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
            <h3 className="flex items-center gap-2 text-xs font-bold text-th-text-2 uppercase tracking-wider mb-4">
              <Target className="w-4 h-4" />
              {t("dashboard.summaryStats")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <SummaryKpi value={String(stats.totalTarget)} label={t("dashboard.totalTarget")} color="slate" />
              <SummaryKpi value={String(stats.totalActual)} label={t("dashboard.totalActual")} color="slate" />
              <SummaryKpi
                value={`${stats.variancePct >= 0 ? "+" : ""}${stats.variancePct}%`}
                label={t("dashboard.overallVariance")}
                color={stats.variancePct >= 0 ? "emerald" : "red"}
              />
              <SummaryKpi value={String(stats.wins)} label={t("dashboard.hoursWon")} color="emerald" />
              <SummaryKpi value={String(stats.losses)} label={t("dashboard.hoursLost")} color="red" />
            </div>

            {/* Overall progress bar */}
            {stats.totalTarget > 0 && (
              <div className="mt-5">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-th-text-2 mb-2">
                  <span>{stats.totalActual} / {stats.totalTarget}</span>
                  <span>{Math.round((stats.totalActual / stats.totalTarget) * 100)}%</span>
                </div>
                <div className="w-full h-3 bg-th-bg-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      stats.totalActual >= stats.totalTarget
                        ? "bg-emerald-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min((stats.totalActual / stats.totalTarget) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ================================================================== */}
      {/* Quick-Add Line Modal                                               */}
      {/* ================================================================== */}
      {showAddLine && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddLine(false)}>
          <div className="bg-th-bg rounded-xl shadow-sm border border-th-border w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-th-border flex items-center gap-2">
              <Factory className="w-5 h-5 text-th-text-2" />
              <h3 className="font-bold text-th-text text-lg">{t("dashboard.addLine") || "Add Production Line"}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("dashboard.lineName") || "Line Name"} *</label>
                <input
                  type="text"
                  value={newLineName}
                  onChange={(e) => setNewLineName(e.target.value)}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text focus:ring-2 focus:ring-brand-500/50 outline-none"
                  placeholder={t("dashboard.lineNamePlaceholder") || "e.g. Assembly Line 3"}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddLine(); }}
                />
              </div>
            </div>
            <div className="p-5 border-t border-th-border flex gap-3 justify-end">
              <button onClick={() => setShowAddLine(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3">
                {t("common.cancel") || "Cancel"}
              </button>
              <button
                onClick={handleAddLine}
                disabled={!newLineName.trim() || quickAddLoading}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold"
              >
                {quickAddLoading ? t("common.saving") || "Saving..." : t("common.save") || "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Quick-Add Product Modal                                            */}
      {/* ================================================================== */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddProduct(false)}>
          <div className="bg-th-bg rounded-xl shadow-sm border border-th-border w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-th-border flex items-center gap-2">
              <Package className="w-5 h-5 text-th-text-2" />
              <h3 className="font-bold text-th-text text-lg">{t("dashboard.addProduct") || "Add Product"}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.productCode") || "Code"} *</label>
                <input
                  type="text"
                  value={newProduct.code}
                  onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text focus:ring-2 focus:ring-brand-500/50 outline-none"
                  placeholder="SKU-001"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.productName") || "Name"} *</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text focus:ring-2 focus:ring-brand-500/50 outline-none"
                  placeholder={t("manufacturing.productNamePlaceholder") || "Product name"}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.uom") || "UOM"}</label>
                <select
                  value={newProduct.unit_of_measure}
                  onChange={(e) => setNewProduct({ ...newProduct, unit_of_measure: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                >
                  <option value="pcs">pcs</option>
                  <option value="kg">kg</option>
                  <option value="liters">liters</option>
                  <option value="meters">meters</option>
                </select>
              </div>
            </div>
            <div className="p-5 border-t border-th-border flex gap-3 justify-end">
              <button onClick={() => setShowAddProduct(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3">
                {t("common.cancel") || "Cancel"}
              </button>
              <button
                onClick={handleAddProduct}
                disabled={!newProduct.code.trim() || !newProduct.name.trim() || quickAddLoading}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold"
              >
                {quickAddLoading ? t("common.saving") || "Saving..." : t("common.save") || "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -- Sub-components -------------------------------------------------------- */

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

  const borderMap = {
    slate: "border-l-slate-500",
    emerald: "border-l-emerald-500",
    red: "border-l-red-500",
  };

  return (
    <div className={`text-center border-l-4 ${borderMap[color]} rounded-xl border border-th-border bg-th-bg-3 p-3`}>
      <div className={`text-3xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-[10px] text-th-text-2 font-bold uppercase tracking-[0.1em] mt-1">{label}</div>
    </div>
  );
}
