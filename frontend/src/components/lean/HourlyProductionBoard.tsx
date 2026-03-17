"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi, adminApi, manufacturingApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";

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
          // Fallback demo lines
          if (!cancelled) {
            setLines([
              { id: 1, name: t("dashboard.demoLine1") },
              { id: 2, name: t("dashboard.demoLine2") },
            ]);
            setSelectedLineId(1);
          }
        }
      } catch {
        if (!cancelled) {
          setLines([
            { id: 1, name: t("dashboard.demoLine1") },
            { id: 2, name: t("dashboard.demoLine2") },
          ]);
          setSelectedLineId(1);
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
    <div className="space-y-6 max-w-6xl mx-auto" data-print-area="true" role="region" aria-label="Hourly Production Board">
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
              className="text-sm font-semibold border border-th-border rounded-xl px-3 py-2 bg-th-bg-2 text-th-text focus:ring-2 focus:ring-brand-500/50 outline-none backdrop-blur-sm"
            >
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowAddLine(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-dashed border-th-border text-th-text-2 hover:bg-th-bg-3 hover:text-brand-500 hover:border-brand-500/50 transition-all text-lg font-bold"
              title={t("dashboard.addLine") || "Add Line"}
            >
              +
            </button>
            <button
              onClick={() => setShowAddProduct(true)}
              className="px-2.5 py-1.5 flex items-center gap-1 rounded-lg border border-dashed border-th-border text-th-text-2 hover:bg-th-bg-3 hover:text-brand-500 hover:border-brand-500/50 transition-all text-xs font-semibold"
              title={t("dashboard.addProduct") || "Add Product"}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t("dashboard.product") || "Product"}
            </button>
          </div>
        )}

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftDate(-1)}
            className="px-2.5 py-2 rounded-lg border border-th-border bg-th-input text-th-text hover:bg-th-bg-3 transition-all duration-300 text-sm"
            aria-label="Previous day"
          >
            &#8592;
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm border border-th-border rounded-xl px-3 py-2 bg-th-input text-th-text focus:ring-2 focus:ring-brand-500/50 outline-none backdrop-blur-sm"
          />
          <button
            onClick={() => shiftDate(1)}
            className="px-2.5 py-2 rounded-lg border border-th-border bg-th-input text-th-text hover:bg-th-bg-3 transition-all duration-300 text-sm"
            aria-label="Next day"
          >
            &#8594;
          </button>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(toISODate(new Date()))}
              className="ml-1 px-3 py-2 text-xs font-bold rounded-xl border border-brand-500/30 text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 transition-all duration-300 uppercase tracking-wider"
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
            <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold animate-pulse">
              {t("dashboard.saving")}
            </span>
          )}
          {saveSuccess && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
              {t("dashboard.saveAllSuccess")}
            </span>
          )}
          <span className="text-th-text-2" title={lastRefresh.toLocaleTimeString(dateLocale)}>
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
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-th-text-2 font-medium">{t("dashboard.loadingData")}</span>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between backdrop-blur-sm">
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          <button
            onClick={() => selectedLineId !== null && fetchData(selectedLineId, selectedDate)}
            className="px-3 py-1 text-sm font-semibold rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400 transition-all duration-300"
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
          <div
            className={`relative overflow-hidden rounded-2xl p-6 text-white ${
              stats.cumDelta >= 0
                ? "bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500"
                : "bg-gradient-to-r from-red-600 via-red-500 to-rose-500"
            }`}
          >
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 bg-white/15 rounded-xl flex items-center justify-center text-3xl backdrop-blur-sm border border-white/10">
                  &#9201;
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold tracking-tight">{t("dashboard.hourlyTitle")}</h2>
                  <p className="text-sm text-white/70 mt-0.5">
                    {lineName} &mdash; {displayDate}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { val: stats.totalTarget, label: t("dashboard.totalTarget") },
                  { val: stats.totalActual, label: t("dashboard.totalActual") },
                  { val: `${stats.variancePct >= 0 ? "+" : ""}${stats.variancePct}%`, label: t("dashboard.overallVariance") },
                  { val: stats.wins, label: t("dashboard.hoursWon") },
                  { val: stats.losses, label: t("dashboard.hoursLost") },
                ].map((item, idx) => (
                  <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10 hover:bg-white/15 transition-all duration-300">
                    <div className="text-2xl font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{item.val}</div>
                    <div className="text-[10px] text-white/60 font-bold uppercase tracking-[0.1em] mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* Hourly Bar Chart                                                 */}
          {/* ================================================================ */}
          <div className="bg-th-bg-2 rounded-2xl backdrop-blur-sm border border-th-border p-5">
            <h3 className="text-[10px] font-bold text-th-text-2 uppercase tracking-[0.15em] mb-4">
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
                            ? "bg-gradient-to-t from-emerald-600 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                            : "bg-gradient-to-t from-red-600 to-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
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
                <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-emerald-600 to-teal-400 inline-block" />
                {t("dashboard.cumActual")}
              </span>
            </div>
          </div>

          {/* ================================================================ */}
          {/* Save All button                                                  */}
          {/* ================================================================ */}
          <div className="flex justify-end">
            <button
              onClick={saveAll}
              disabled={!hasDirtyRows || saving}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
                hasDirtyRows && !saving
                  ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)]"
                  : "bg-th-bg-3 text-th-text-2 cursor-not-allowed border border-th-border"
              }`}
            >
              {saving ? t("dashboard.saving") : t("dashboard.saveAll")}
            </button>
          </div>

          {/* ================================================================ */}
          {/* Hour-by-Hour Table                                               */}
          {/* ================================================================ */}
          <div className="bg-th-bg-2 rounded-2xl backdrop-blur-sm border border-th-border overflow-x-auto">
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
                          min={0}
                          value={slot.actual ?? ""}
                          onChange={(e) => updateSlot(idx, "actual", e.target.value)}
                          onBlur={() => { if (slot.dirty) saveSlot(slots[idx]); }}
                          className="w-16 text-center text-sm font-bold border border-th-border rounded-lg py-1.5 focus:ring-2 focus:ring-brand-500/50 outline-none bg-th-input text-th-text backdrop-blur-sm"
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
                              ? "text-emerald-600 dark:text-emerald-400 dark:drop-shadow-[0_0_4px_rgba(16,185,129,0.4)]"
                              : "text-red-600 dark:text-red-400 dark:drop-shadow-[0_0_4px_rgba(239,68,68,0.4)]"
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
                              ? "text-emerald-600 dark:text-emerald-400 dark:drop-shadow-[0_0_4px_rgba(16,185,129,0.4)]"
                              : "text-red-600 dark:text-red-400 dark:drop-shadow-[0_0_4px_rgba(239,68,68,0.4)]"
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
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-base font-bold dark:shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                              title={t("dashboard.win")}
                            >
                              &#10003;
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20 text-base font-bold dark:shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                              title={t("dashboard.loss")}
                            >
                              &#10007;
                            </span>
                          )
                        ) : (
                          <span className="inline-block w-8 h-8 rounded-lg bg-th-bg-3 text-th-text-3 text-center leading-8 text-xs border border-th-border">
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
                            className={`w-full text-xs border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-red-500/40 outline-none bg-th-input text-th-text backdrop-blur-sm ${
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
                          className="w-full text-xs border border-th-border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-brand-500/50 outline-none bg-th-input text-th-text backdrop-blur-sm"
                          placeholder={t("dashboard.notesPlaceholder")}
                        />
                      </td>

                      {/* Per-row save indicator */}
                      <td className="p-4 text-center">
                        {slot.dirty && (
                          <button
                            onClick={() => saveSlot(slots[idx])}
                            disabled={saving}
                            className="p-1.5 rounded-lg text-brand-400 hover:bg-brand-500/10 transition-all duration-300 border border-transparent hover:border-brand-500/20"
                            title={t("dashboard.saveAll")}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
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
          <div className="bg-th-bg-2 rounded-2xl backdrop-blur-sm border border-th-border p-6">
            <h3 className="text-[10px] font-bold text-th-text-2 uppercase tracking-[0.15em] mb-4">
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
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                        : "bg-gradient-to-r from-red-500 to-rose-400 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
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
          <div className="bg-th-bg rounded-2xl shadow-xl border border-th-border w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-th-border">
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
          <div className="bg-th-bg rounded-2xl shadow-xl border border-th-border w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-th-border">
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
    emerald: "text-emerald-600 dark:text-emerald-400 dark:drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]",
    red: "text-red-600 dark:text-red-400 dark:drop-shadow-[0_0_6px_rgba(239,68,68,0.4)]",
  };

  const borderMap = {
    slate: "border-l-slate-500",
    emerald: "border-l-emerald-500",
    red: "border-l-red-500",
  };

  return (
    <div className={`text-center border-l-4 ${borderMap[color]} bg-th-bg-3 rounded-lg p-3 hover:bg-th-bg transition-all duration-300`}>
      <div className={`text-3xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-[10px] text-th-text-2 font-bold uppercase tracking-[0.1em] mt-1">{label}</div>
    </div>
  );
}
