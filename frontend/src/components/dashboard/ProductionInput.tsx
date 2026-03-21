"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { productionApi, adminApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import { Check, X } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface ProductionLine {
  id: number;
  name: string;
}

interface ProductionForm {
  production_line_id: number;
  shift: "morning" | "afternoon" | "night";
  date: string;
  planned_production_time_min: number;
  actual_run_time_min: number;
  total_pieces: number;
  good_pieces: number;
  ideal_cycle_time_sec: number;
  notes: string;
}

interface DowntimeEntry {
  type: "planned" | "unplanned";
  reason: string;
  duration_min: number;
  notes: string;
}

interface ScrapEntry {
  defect_type: string;
  quantity: number;
  notes: string;
}

interface ProductionRecord {
  id: number;
  production_line_id: number;
  date: string;
  shift?: string;
  planned_production_time_min: number;
  actual_run_time_min: number;
  total_pieces: number;
  good_pieces: number;
  ideal_cycle_time_sec: number;
  notes?: string;
  created_at?: string;
}

interface ValidationErrors {
  [key: string]: string;
}

interface Toast {
  type: "success" | "error";
  message: string;
}

/* ─── Constants ─────────────────────────────────────────────────────── */

const TODAY = () => new Date().toISOString().split("T")[0];

const INITIAL_FORM: ProductionForm = {
  production_line_id: 0,
  shift: "morning",
  date: TODAY(),
  planned_production_time_min: 480,
  actual_run_time_min: 0,
  total_pieces: 0,
  good_pieces: 0,
  ideal_cycle_time_sec: 0,
  notes: "",
};

const EMPTY_DOWNTIME: DowntimeEntry = {
  type: "unplanned",
  reason: "",
  duration_min: 0,
  notes: "",
};

const EMPTY_SCRAP: ScrapEntry = {
  defect_type: "",
  quantity: 0,
  notes: "",
};

const SHIFTS = ["morning", "afternoon", "night"] as const;

const DOWNTIME_REASONS = [
  "reason_breakdown",
  "reason_changeover",
  "reason_material",
  "reason_quality",
  "reason_speed_loss",
  "reason_minor_stop",
  "reason_planned",
  "reason_other",
] as const;

const DEFECT_TYPES = [
  "defect_dimensional",
  "defect_surface",
  "defect_assembly",
  "defect_material",
  "defect_contamination",
  "defect_other",
] as const;

/* ─── OEE Calculator ────────────────────────────────────────────────── */

function calculateOEE(form: {
  planned_production_time_min: number;
  actual_run_time_min: number;
  total_pieces: number;
  good_pieces: number;
  ideal_cycle_time_sec: number;
}) {
  const availability = Math.min(100,
    form.planned_production_time_min > 0
      ? (form.actual_run_time_min / form.planned_production_time_min) * 100
      : 0);
  const maxPieces =
    form.ideal_cycle_time_sec > 0
      ? (form.actual_run_time_min * 60) / form.ideal_cycle_time_sec
      : 0;
  const performance = Math.min(100, maxPieces > 0 ? (form.total_pieces / maxPieces) * 100 : 0);
  const quality = Math.min(100,
    form.total_pieces > 0 ? (form.good_pieces / form.total_pieces) * 100 : 0);
  const oee = (availability * performance * quality) / 10000;
  return { availability, performance, quality, oee };
}

function oeeColor(value: number): string {
  if (value >= 85) return "text-green-600 dark:text-green-400";
  if (value >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function oeeBarColor(value: number): string {
  if (value >= 85) return "bg-green-500";
  if (value >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

/* ─── Toast Component ───────────────────────────────────────────────── */

function ToastNotification({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const bg =
    toast.type === "success"
      ? "bg-green-600 dark:bg-green-700"
      : "bg-red-600 dark:bg-red-700";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed top-4 right-4 z-50 ${bg} text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in`}
    >
      {toast.type === "success" ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 text-white/70 hover:text-white transition"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────── */

export default function ProductionInput() {
  const { t } = useI18n();
  const { printView, exportToExcel, exportToCSV } = useExport();

  /* ── State ─────────────────────────────────────────────────────────── */

  // Production lines from factory API
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(true);

  // Form state
  const [form, setForm] = useState<ProductionForm>({ ...INITIAL_FORM });
  const [downtimeEntries, setDowntimeEntries] = useState<DowntimeEntry[]>([]);
  const [scrapEntries, setScrapEntries] = useState<ScrapEntry[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [recentRecords, setRecentRecords] = useState<ProductionRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Live OEE
  const oee = useMemo(() => calculateOEE(form), [
    form.planned_production_time_min,
    form.actual_run_time_min,
    form.total_pieces,
    form.good_pieces,
    form.ideal_cycle_time_sec,
  ]);

  /* ── Load production lines from factory API ─────────────────────── */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLinesLoading(true);
      try {
        const res = await adminApi.getFactory();
        const factory = res.data;
        const parsed: ProductionLine[] =
          factory?.production_lines ??
          factory?.lines ??
          (Array.isArray(factory) ? factory : []);
        if (!cancelled) {
          setLines(parsed);
          // Auto-select first line if form hasn't been set
          if (parsed.length > 0 && form.production_line_id === 0) {
            setForm((prev) => ({ ...prev, production_line_id: parsed[0].id }));
          }
        }
      } catch {
        // Factory endpoint might fail — fall back to empty
        if (!cancelled) setLines([]);
      } finally {
        if (!cancelled) setLinesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load recent records ────────────────────────────────────────── */

  const fetchRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const lineId = form.production_line_id || undefined;
      const res = await productionApi.listRecords(lineId);
      const data = Array.isArray(res.data) ? res.data : res.data?.records ?? [];
      setRecentRecords(data.slice(0, 10));
    } catch {
      // silently fail on load
    } finally {
      setLoadingRecords(false);
    }
  }, [form.production_line_id]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  /* ── Validation ─────────────────────────────────────────────────── */

  function validate(): ValidationErrors {
    const e: ValidationErrors = {};

    if (!form.production_line_id) {
      e.production_line_id = t("dashboard.validationRequired");
    }
    if (!form.date) {
      e.date = t("dashboard.validationRequired");
    } else if (form.date > TODAY()) {
      e.date = t("dashboard.validationFutureDate") || "Date cannot be in the future";
    }
    if (form.planned_production_time_min <= 0) {
      e.planned_production_time_min = t("dashboard.validationPositive");
    }
    if (form.actual_run_time_min <= 0) {
      e.actual_run_time_min = t("dashboard.validationPositive");
    }
    if (
      form.actual_run_time_min > form.planned_production_time_min &&
      form.planned_production_time_min > 0
    ) {
      e.actual_run_time_min = t("dashboard.validationRunExceedsPlanned");
    }
    if (form.total_pieces <= 0) {
      e.total_pieces = t("dashboard.validationPositive");
    }
    if (form.good_pieces <= 0) {
      e.good_pieces = t("dashboard.validationPositive");
    }
    if (form.good_pieces > form.total_pieces && form.total_pieces > 0) {
      e.good_pieces = t("dashboard.validationGoodExceedsTotal");
    }
    if (form.ideal_cycle_time_sec <= 0) {
      e.ideal_cycle_time_sec = t("dashboard.validationPositive");
    }

    // Validate downtime entries
    downtimeEntries.forEach((d, i) => {
      if (!d.reason) e[`downtime_${i}_reason`] = t("dashboard.validationRequired");
      if (d.duration_min <= 0)
        e[`downtime_${i}_duration`] = t("dashboard.validationPositive");
    });

    // Validate scrap entries
    scrapEntries.forEach((s, i) => {
      if (!s.defect_type) e[`scrap_${i}_type`] = t("dashboard.validationRequired");
      if (s.quantity <= 0) e[`scrap_${i}_qty`] = t("dashboard.validationPositive");
    });

    return e;
  }

  /* ── Save handler ───────────────────────────────────────────────── */

  async function handleSave() {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    try {
      // 1. Create production record
      const recordRes = await productionApi.createRecord(form);
      const recordId = recordRes.data?.id ?? recordRes.data?.record?.id;

      // 2. Create downtime entries
      for (const entry of downtimeEntries) {
        await productionApi.createDowntime({
          production_line_id: form.production_line_id,
          record_id: recordId,
          date: form.date,
          ...entry,
        });
      }

      // 3. Create scrap entries
      for (const entry of scrapEntries) {
        await productionApi.createScrap({
          production_line_id: form.production_line_id,
          record_id: recordId,
          date: form.date,
          ...entry,
        });
      }

      setToast({ type: "success", message: t("dashboard.saveSuccess") });
      handleReset();
      fetchRecords();
    } catch (err: unknown) {
      let message: string;
      const axiosErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
      const detail = axiosErr?.response?.data?.detail;
      if (Array.isArray(detail)) {
        message = detail.map((e: Record<string, string>) => e.msg || String(e)).join("; ");
      } else {
        message = (typeof detail === 'string' ? detail : null) ?? axiosErr?.message ?? t("dashboard.saveError");
      }
      setToast({ type: "error", message });
    } finally {
      setSaving(false);
    }
  }

  /* ── Reset handler ──────────────────────────────────────────────── */

  function handleReset() {
    const firstLineId = lines.length > 0 ? lines[0].id : 0;
    setForm({ ...INITIAL_FORM, date: TODAY(), production_line_id: firstLineId });
    setDowntimeEntries([]);
    setScrapEntries([]);
    setErrors({});
  }

  /* ── Downtime helpers ───────────────────────────────────────────── */

  function addDowntime() {
    setDowntimeEntries((prev) => [...prev, { ...EMPTY_DOWNTIME }]);
  }

  function updateDowntime(idx: number, patch: Partial<DowntimeEntry>) {
    setDowntimeEntries((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, ...patch } : d))
    );
  }

  function removeDowntime(idx: number) {
    setDowntimeEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  /* ── Scrap helpers ──────────────────────────────────────────────── */

  function addScrap() {
    setScrapEntries((prev) => [...prev, { ...EMPTY_SCRAP }]);
  }

  function updateScrap(idx: number, patch: Partial<ScrapEntry>) {
    setScrapEntries((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
  }

  function removeScrap(idx: number) {
    setScrapEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  /* ── Form field updater ─────────────────────────────────────────── */

  function updateField<K extends keyof ProductionForm>(
    key: K,
    value: ProductionForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  /* ── Shared class strings ───────────────────────────────────────── */

  const inputCls =
    "w-full px-3 py-2 border rounded-lg bg-th-input text-th-text focus:ring-2 focus:ring-brand-500 focus:outline-none transition";
  const labelCls = "block text-sm text-th-text-2 mb-1 font-medium";
  const errorCls = "text-xs text-red-500 mt-0.5";
  const cardCls = "bg-th-bg-2 p-6 rounded-xl shadow-sm border border-th-border";

  function fieldBorder(fieldKey: string) {
    return errors[fieldKey] ? "border-red-500" : "border-th-border";
  }

  /* ── Line name lookup ───────────────────────────────────────────── */

  function lineName(lineId: number): string {
    return lines.find((l) => l.id === lineId)?.name ?? `#${lineId}`;
  }

  /* ─── Render ──────────────────────────────────────────────────────── */

  return (
    <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true">
      {/* Toast */}
      {toast && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}

      {/* ── Production Form ─────────────────────────────────────────── */}
      <div className={cardCls}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-th-text">
            {t("dashboard.prodTitle")}
          </h3>
          <ExportToolbar
            onPrint={() => printView({ title: t("dashboard.prodTitle") || "Production Input", subtitle: form.date })}
            onExportExcel={() => exportToExcel({
              filename: `production_${form.date || "data"}`,
              sheetName: "Production",
              columns: [
                { key: "date", header: t("dashboard.date") || "Date", width: 12 },
                { key: "shift", header: t("dashboard.shift") || "Shift", width: 10 },
                { key: "plannedMin", header: t("dashboard.plannedTime") || "Planned (min)", width: 14 },
                { key: "runMin", header: t("dashboard.actualRunTime") || "Run (min)", width: 12 },
                { key: "totalPcs", header: t("dashboard.totalPieces") || "Total Pieces", width: 12 },
                { key: "goodPcs", header: t("dashboard.goodPieces") || "Good Pieces", width: 12 },
                { key: "oeeVal", header: "OEE %", width: 10, format: (v: unknown) => { const n = Number(v); return n > 0 ? `${n.toFixed(1)}%` : ""; } },
              ],
              rows: recentRecords.map((r) => ({
                date: r.date,
                shift: r.shift || "",
                plannedMin: r.planned_production_time_min,
                runMin: r.actual_run_time_min,
                totalPcs: r.total_pieces,
                goodPcs: r.good_pieces,
                oeeVal: (() => {
                  const o = calculateOEE(r);
                  return o.oee;
                })(),
              })),
            })}
            onExportCSV={() => exportToCSV({
              filename: `production_${form.date || "data"}`,
              columns: [
                { key: "date", header: t("dashboard.date") || "Date" },
                { key: "shift", header: t("dashboard.shift") || "Shift" },
                { key: "plannedMin", header: t("dashboard.plannedTime") || "Planned (min)" },
                { key: "runMin", header: t("dashboard.actualRunTime") || "Run (min)" },
                { key: "totalPcs", header: t("dashboard.totalPieces") || "Total Pieces" },
                { key: "goodPcs", header: t("dashboard.goodPieces") || "Good Pieces" },
              ],
              rows: recentRecords.map((r) => ({
                date: r.date,
                shift: r.shift || "",
                plannedMin: r.planned_production_time_min,
                runMin: r.actual_run_time_min,
                totalPcs: r.total_pieces,
                goodPcs: r.good_pieces,
              })),
            })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Production Line (from factory API) */}
          <div>
            <label htmlFor="prod-line" className={labelCls}>{t("dashboard.productionLine")} <span className="text-red-500">*</span></label>
            {linesLoading ? (
              <div className={`${inputCls} border-th-border flex items-center gap-2`}>
                <span className="inline-block h-3 w-3 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                <span className="text-sm text-th-text-2">{t("dashboard.loadingLines")}</span>
              </div>
            ) : lines.length === 0 ? (
              <div className={`${inputCls} border-th-border text-th-text-2 text-sm`}>
                {t("dashboard.noLinesAvailable")}
              </div>
            ) : (
              <select
                id="prod-line"
                value={form.production_line_id}
                onChange={(e) =>
                  updateField("production_line_id", Number(e.target.value))
                }
                aria-required="true"
                aria-invalid={errors.production_line_id ? "true" : undefined}
                className={`${inputCls} ${fieldBorder("production_line_id")}`}
              >
                <option value={0} disabled>
                  {t("dashboard.selectLine")}
                </option>
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </select>
            )}
            {errors.production_line_id && (
              <p className={errorCls}>{errors.production_line_id}</p>
            )}
          </div>

          {/* Shift Selector */}
          <div>
            <label className={labelCls}>{t("dashboard.shift")}</label>
            <select
              value={form.shift}
              onChange={(e) =>
                updateField("shift", e.target.value as ProductionForm["shift"])
              }
              className={`${inputCls} border-th-border`}
            >
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {t(`dashboard.shift${s.charAt(0).toUpperCase() + s.slice(1)}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className={labelCls}>{t("dashboard.date")} <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => updateField("date", e.target.value)}
              className={`${inputCls} ${fieldBorder("date")}`}
            />
            {errors.date && <p className={errorCls}>{errors.date}</p>}
          </div>

          {/* Planned Time */}
          <div>
            <label className={labelCls}>{t("dashboard.plannedTime")} <span className="text-red-500">*</span></label>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={form.planned_production_time_min || ""}
              onChange={(e) =>
                updateField("planned_production_time_min", Number(e.target.value))
              }
              className={`${inputCls} ${fieldBorder("planned_production_time_min")}`}
            />
            {errors.planned_production_time_min && (
              <p className={errorCls}>{errors.planned_production_time_min}</p>
            )}
          </div>

          {/* Actual Run Time */}
          <div>
            <label className={labelCls}>{t("dashboard.actualRunTime")} <span className="text-red-500">*</span></label>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={form.actual_run_time_min || ""}
              onChange={(e) =>
                updateField("actual_run_time_min", Number(e.target.value))
              }
              className={`${inputCls} ${fieldBorder("actual_run_time_min")}`}
            />
            {errors.actual_run_time_min && (
              <p className={errorCls}>{errors.actual_run_time_min}</p>
            )}
          </div>

          {/* Total Pieces */}
          <div>
            <label className={labelCls}>{t("dashboard.totalPieces")} <span className="text-red-500">*</span></label>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={form.total_pieces || ""}
              onChange={(e) =>
                updateField("total_pieces", Number(e.target.value))
              }
              className={`${inputCls} ${fieldBorder("total_pieces")}`}
            />
            {errors.total_pieces && (
              <p className={errorCls}>{errors.total_pieces}</p>
            )}
          </div>

          {/* Good Pieces */}
          <div>
            <label className={labelCls}>{t("dashboard.goodPieces")} <span className="text-red-500">*</span></label>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={form.good_pieces || ""}
              onChange={(e) =>
                updateField("good_pieces", Number(e.target.value))
              }
              className={`${inputCls} ${fieldBorder("good_pieces")}`}
            />
            {errors.good_pieces && (
              <p className={errorCls}>{errors.good_pieces}</p>
            )}
          </div>

          {/* Ideal Cycle Time */}
          <div>
            <label className={labelCls}>{t("dashboard.idealCycleTime")} <span className="text-red-500">*</span></label>
            <input
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              value={form.ideal_cycle_time_sec || ""}
              onChange={(e) =>
                updateField("ideal_cycle_time_sec", Number(e.target.value))
              }
              className={`${inputCls} ${fieldBorder("ideal_cycle_time_sec")}`}
            />
            {errors.ideal_cycle_time_sec && (
              <p className={errorCls}>{errors.ideal_cycle_time_sec}</p>
            )}
          </div>

          {/* Notes — full width */}
          <div className="sm:col-span-2">
            <label className={labelCls}>{t("dashboard.notes")}</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              className={`${inputCls} border-th-border`}
              placeholder={t("dashboard.optionalNotes")}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {saving
              ? t("dashboard.saving")
              : t("dashboard.saveProductionRecord")}
          </button>
          <button
            onClick={handleReset}
            type="button"
            className="px-6 py-2 rounded-lg border border-th-border text-th-text hover:bg-th-bg transition"
          >
            {t("dashboard.resetForm")}
          </button>
        </div>
      </div>

      {/* ── Live OEE Preview ────────────────────────────────────────── */}
      <div className={cardCls}>
        <h3 className="text-lg font-semibold mb-3 text-th-text">
          {t("dashboard.liveOeePreview")}
        </h3>
        {form.actual_run_time_min === 0 && form.total_pieces === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              t("dashboard.availability"),
              t("dashboard.performance"),
              t("dashboard.quality"),
              t("dashboard.oee"),
            ].map((label) => (
              <div key={label}>
                <p className="text-sm text-th-text-2 mb-1">{label}</p>
                <p className="text-xl font-bold text-th-text-2">&mdash;</p>
                <div className="mt-1 h-1.5 bg-th-bg rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gray-300" style={{ width: "0%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: t("dashboard.availability"), value: oee.availability },
              { label: t("dashboard.performance"), value: oee.performance },
              { label: t("dashboard.quality"), value: oee.quality },
              { label: t("dashboard.oee"), value: oee.oee, large: true },
            ].map(({ label, value, large }) => (
              <div key={label}>
                <p className="text-sm text-th-text-2 mb-1">{label}</p>
                <p
                  className={`${large ? "text-2xl" : "text-xl"} font-bold ${oeeColor(
                    value
                  )}`}
                >
                  {value.toFixed(1)}%
                </p>
                {/* Mini progress bar */}
                <div className="mt-1 h-1.5 bg-th-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${oeeBarColor(
                      value
                    )}`}
                    style={{ width: `${Math.min(value, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Downtime Events ─────────────────────────────────────────── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-th-text">
            {t("dashboard.downtimeEvents")}
          </h3>
          <button
            onClick={addDowntime}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium transition"
          >
            + {t("dashboard.addDowntime")}
          </button>
        </div>

        {downtimeEntries.length === 0 ? (
          <p className="text-sm text-th-text-2 italic">
            {t("dashboard.noDowntimeYet")}
          </p>
        ) : (
          <div className="space-y-4">
            {downtimeEntries.map((entry, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-3 bg-th-bg rounded-lg border border-th-border"
              >
                {/* Type */}
                <div className="sm:col-span-2">
                  <label className={labelCls}>
                    {t("dashboard.downtimeType")}
                  </label>
                  <select
                    value={entry.type}
                    onChange={(e) =>
                      updateDowntime(idx, {
                        type: e.target.value as "planned" | "unplanned",
                      })
                    }
                    className={`${inputCls} border-th-border`}
                  >
                    <option value="unplanned">
                      {t("dashboard.unplanned")}
                    </option>
                    <option value="planned">{t("dashboard.planned")}</option>
                  </select>
                </div>

                {/* Reason */}
                <div className="sm:col-span-3">
                  <label className={labelCls}>{t("dashboard.reasonCode")}</label>
                  <select
                    value={entry.reason}
                    onChange={(e) =>
                      updateDowntime(idx, { reason: e.target.value })
                    }
                    className={`${inputCls} ${fieldBorder(`downtime_${idx}_reason`)}`}
                  >
                    <option value="">{t("dashboard.selectReason")}</option>
                    {DOWNTIME_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {t(`dashboard.${r}`)}
                      </option>
                    ))}
                  </select>
                  {errors[`downtime_${idx}_reason`] && (
                    <p className={errorCls}>
                      {errors[`downtime_${idx}_reason`]}
                    </p>
                  )}
                </div>

                {/* Duration */}
                <div className="sm:col-span-2">
                  <label className={labelCls}>
                    {t("dashboard.durationMin")}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={entry.duration_min || ""}
                    onChange={(e) =>
                      updateDowntime(idx, {
                        duration_min: Number(e.target.value),
                      })
                    }
                    className={`${inputCls} ${fieldBorder(`downtime_${idx}_duration`)}`}
                  />
                  {errors[`downtime_${idx}_duration`] && (
                    <p className={errorCls}>
                      {errors[`downtime_${idx}_duration`]}
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="sm:col-span-4">
                  <label className={labelCls}>{t("dashboard.notes")}</label>
                  <input
                    type="text"
                    value={entry.notes}
                    onChange={(e) =>
                      updateDowntime(idx, { notes: e.target.value })
                    }
                    className={`${inputCls} border-th-border`}
                    placeholder={t("dashboard.optionalNotes")}
                  />
                </div>

                {/* Remove */}
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    onClick={() => removeDowntime(idx)}
                    className="text-red-500 hover:text-red-600 text-lg font-bold transition"
                    aria-label={t("dashboard.remove")}
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrap Entries ───────────────────────────────────────────── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-th-text">
            {t("dashboard.scrapEntries")}
          </h3>
          <button
            onClick={addScrap}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium transition"
          >
            + {t("dashboard.addScrap")}
          </button>
        </div>

        {scrapEntries.length === 0 ? (
          <p className="text-sm text-th-text-2 italic">
            {t("dashboard.noScrapYet")}
          </p>
        ) : (
          <div className="space-y-4">
            {scrapEntries.map((entry, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-3 bg-th-bg rounded-lg border border-th-border"
              >
                {/* Defect Type */}
                <div className="sm:col-span-4">
                  <label className={labelCls}>
                    {t("dashboard.defectType")}
                  </label>
                  <select
                    value={entry.defect_type}
                    onChange={(e) =>
                      updateScrap(idx, { defect_type: e.target.value })
                    }
                    className={`${inputCls} ${fieldBorder(`scrap_${idx}_type`)}`}
                  >
                    <option value="">{t("dashboard.selectDefect")}</option>
                    {DEFECT_TYPES.map((d) => (
                      <option key={d} value={d}>
                        {t(`dashboard.${d}`)}
                      </option>
                    ))}
                  </select>
                  {errors[`scrap_${idx}_type`] && (
                    <p className={errorCls}>{errors[`scrap_${idx}_type`]}</p>
                  )}
                </div>

                {/* Quantity */}
                <div className="sm:col-span-2">
                  <label className={labelCls}>
                    {t("dashboard.scrapQuantity")}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={entry.quantity || ""}
                    onChange={(e) =>
                      updateScrap(idx, { quantity: Number(e.target.value) })
                    }
                    className={`${inputCls} ${fieldBorder(`scrap_${idx}_qty`)}`}
                  />
                  {errors[`scrap_${idx}_qty`] && (
                    <p className={errorCls}>{errors[`scrap_${idx}_qty`]}</p>
                  )}
                </div>

                {/* Notes */}
                <div className="sm:col-span-5">
                  <label className={labelCls}>{t("dashboard.notes")}</label>
                  <input
                    type="text"
                    value={entry.notes}
                    onChange={(e) =>
                      updateScrap(idx, { notes: e.target.value })
                    }
                    className={`${inputCls} border-th-border`}
                    placeholder={t("dashboard.optionalNotes")}
                  />
                </div>

                {/* Remove */}
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    onClick={() => removeScrap(idx)}
                    className="text-red-500 hover:text-red-600 text-lg font-bold transition"
                    aria-label={t("dashboard.remove")}
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Records ──────────────────────────────────────────── */}
      <div className={cardCls}>
        <h3 className="text-lg font-semibold mb-4 text-th-text">
          {t("dashboard.recentRecords")}
        </h3>

        {loadingRecords ? (
          <div className="flex justify-center py-8">
            <span className="h-6 w-6 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
          </div>
        ) : recentRecords.length === 0 ? (
          <p className="text-sm text-th-text-2 italic">
            {t("dashboard.noRecordsYet")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-th-border text-th-text-2">
                  <th className="text-left py-2 px-2 font-medium">
                    {t("dashboard.date")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium">
                    {t("dashboard.productionLine")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium">
                    {t("dashboard.shift")}
                  </th>
                  <th className="text-right py-2 px-2 font-medium">
                    {t("dashboard.totalPieces")}
                  </th>
                  <th className="text-right py-2 px-2 font-medium">
                    {t("dashboard.goodPieces")}
                  </th>
                  <th className="text-right py-2 px-2 font-medium">
                    {t("dashboard.oee")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentRecords.map((rec) => {
                  const recOee = calculateOEE(rec);
                  return (
                    <tr
                      key={rec.id}
                      className="border-b border-th-border/50 hover:bg-th-bg/50 transition-colors"
                    >
                      <td className="py-2 px-2 text-th-text">{rec.date ? new Date(rec.date).toLocaleDateString() : "-"}</td>
                      <td className="py-2 px-2 text-th-text">
                        {lineName(rec.production_line_id)}
                      </td>
                      <td className="py-2 px-2 text-th-text capitalize">
                        {rec.shift
                          ? t(
                              `dashboard.shift${
                                rec.shift.charAt(0).toUpperCase() +
                                rec.shift.slice(1)
                              }`
                            )
                          : "-"}
                      </td>
                      <td className="py-2 px-2 text-right text-th-text">
                        {rec.total_pieces.toLocaleString()}
                      </td>
                      <td className="py-2 px-2 text-right text-th-text">
                        {rec.good_pieces.toLocaleString()}
                      </td>
                      <td
                        className={`py-2 px-2 text-right font-semibold ${oeeColor(
                          recOee.oee
                        )}`}
                      >
                        {recOee.oee.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
