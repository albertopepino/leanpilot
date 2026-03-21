'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useI18n } from '@/stores/useI18n';
import { adminApi, manufacturingApi, productionApi } from '@/lib/api';
import type { ProductionRecordCreate } from '@/lib/types';
import ToolInfoCard from "@/components/ui/ToolInfoCard";
import { TOOL_INFO } from "@/lib/toolInfo";

const HourlyProductionBoard = dynamic(
  () => import('@/components/lean/HourlyProductionBoard'),
  { loading: () => <ModeLoader /> }
);

type Mode = 'hourly' | 'shift' | 'daily';

const LS_KEY = 'leanpilot_prod_tracking_mode';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function ModeLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface FeedbackMsg {
  type: 'success' | 'error';
  text: string;
}

function FeedbackBanner({ msg }: { msg: FeedbackMsg | null }) {
  if (!msg) return null;
  const isOk = msg.type === 'success';
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
        isOk
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'
      }`}
    >
      {isOk ? (
        <CheckCircle className="w-4 h-4 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      {msg.text}
    </div>
  );
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-th-text-2 mb-1">
      {children}
    </label>
  );
}

function inputCls() {
  return 'w-full rounded-lg border border-th-border bg-th-bg-2 px-3 py-2 text-sm text-th-text focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none disabled:opacity-50';
}

// ---------------------------------------------------------------------------
// Hooks for shared dropdown data
// ---------------------------------------------------------------------------

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

function useDropdownData() {
  const [lines, setLines] = useState<LineOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [linesRes, productsRes] = await Promise.all([
          adminApi.listProductionLines(),
          manufacturingApi.listProducts(),
        ]);
        if (cancelled) return;
        const rawLines = linesRes.data ?? [];
        setLines(
          rawLines.map((l: { id: number; name: string; shifts?: { id: number; name: string; planned_minutes?: number }[] }) => ({
            id: l.id,
            name: l.name,
            shifts: (l.shifts ?? []).map((s) => ({
              id: s.id,
              name: s.name,
              planned_minutes: s.planned_minutes ?? undefined,
            })),
          }))
        );
        setProducts(
          (productsRes.data ?? []).map((p: { id: number; name: string; code: string }) => ({
            id: p.id,
            name: p.name,
            code: p.code,
          }))
        );
      } catch {
        // silently fail — dropdowns stay empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { lines, products, loading };
}

// ---------------------------------------------------------------------------
// Per-Shift Form — multi-row entry (line + product per row)
// ---------------------------------------------------------------------------

interface ShiftRow {
  key: number;
  lineId: number | '';
  shiftId: number | '';
  productId: number | '';
  totalPieces: number | '';
  goodPieces: number | '';
  plannedTime: number | '';
  downtime: number | '';
  cycleTime: number | '';
  notes: string;
}

let _rowKey = 1;
function emptyShiftRow(): ShiftRow {
  return { key: _rowKey++, lineId: '', shiftId: '', productId: '', totalPieces: '', goodPieces: '', plannedTime: 480, downtime: 0, cycleTime: '', notes: '' };
}

function ShiftForm() {
  const { t } = useI18n();
  const { lines, products, loading: ddLoading } = useDropdownData();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<ShiftRow[]>([emptyShiftRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMsg | null>(null);
  const [records, setRecords] = useState<ProductionRecord[]>([]);

  const updateRow = (idx: number, patch: Partial<ShiftRow>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const addRow = () => setRows(prev => [...prev, emptyShiftRow()]);
  const removeRow = (idx: number) => setRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await productionApi.listRecords();
      setRecords((res.data ?? []).slice(0, 10));
    } catch {}
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = rows.filter(r => r.lineId && r.totalPieces && r.goodPieces && r.cycleTime);
    if (valid.length === 0) {
      setFeedback({ type: 'error', text: t("dashboard.rowRequired") || 'At least one complete row is required.' });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    let ok = 0, fail = 0;
    for (const row of valid) {
      try {
        const actualRun = Number(row.plannedTime) - Number(row.downtime || 0);
        await productionApi.createRecord({
          production_line_id: Number(row.lineId),
          shift_id: row.shiftId ? Number(row.shiftId) : null,
          date,
          planned_production_time_min: Number(row.plannedTime),
          actual_run_time_min: actualRun > 0 ? actualRun : 0,
          total_pieces: Number(row.totalPieces),
          good_pieces: Number(row.goodPieces),
          ideal_cycle_time_sec: Number(row.cycleTime),
          notes: row.notes || null,
        });
        ok++;
      } catch { fail++; }
    }
    const savedMsg = fail === 0
      ? (t("dashboard.recordsSaved") || "{ok} record(s) saved").replace("{ok}", String(ok))
      : (t("dashboard.recordsSavedWithErrors") || "{ok} record(s) saved, {fail} failed").replace("{ok}", String(ok)).replace("{fail}", String(fail));
    setFeedback({ type: fail === 0 ? 'success' : 'error', text: savedMsg });
    if (ok > 0) { setRows([emptyShiftRow()]); fetchRecords(); }
    setSubmitting(false);
  }

  if (ddLoading) return <ModeLoader />;

  const cls = inputCls();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-th-text">{t("dashboard.shiftEntryTitle") || "Per-Shift Production Entry"}</h3>
          <div className="flex items-center gap-3">
            <Label htmlFor="sf-date">{t("common.date") || "Date"}</Label>
            <input id="sf-date" type="date" className={cls + " w-40"} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <FeedbackBanner msg={feedback} />

        <div className="overflow-x-auto mobile-scroll-table">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-th-border text-left text-xs uppercase text-th-text-3">
                <th className="px-2 py-2">{t("dashboard.colLine") || "Line"} *</th>
                <th className="px-2 py-2">{t("dashboard.colShift") || "Shift"}</th>
                <th className="px-2 py-2">{t("dashboard.colProduct") || "Product"}</th>
                <th className="px-2 py-2 w-20">{t("dashboard.colTotal") || "Total"} *</th>
                <th className="px-2 py-2 w-20">{t("dashboard.colGood") || "Good"} *</th>
                <th className="px-2 py-2 w-20">{t("dashboard.colPlanMin") || "Plan (min)"}</th>
                <th className="px-2 py-2 w-20">{t("dashboard.colDownMin") || "Down (min)"}</th>
                <th className="px-2 py-2 w-20">{t("dashboard.colCycleSec") || "Cycle (s)"} *</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const selLine = lines.find(l => l.id === row.lineId);
                const shifts = selLine?.shifts ?? [];
                return (
                  <tr key={row.key} className="border-b border-th-border/50">
                    <td className="px-1 py-1.5">
                      <select className={cls} value={row.lineId} onChange={(e) => updateRow(idx, { lineId: e.target.value ? Number(e.target.value) : '', shiftId: '' })}>
                        <option value="">--</option>
                        {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      <select className={cls} value={row.shiftId} onChange={(e) => updateRow(idx, { shiftId: e.target.value ? Number(e.target.value) : '' })} disabled={!row.lineId}>
                        <option value="">--</option>
                        {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      <select className={cls} value={row.productId} onChange={(e) => updateRow(idx, { productId: e.target.value ? Number(e.target.value) : '' })}>
                        <option value="">--</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1.5"><input type="number" min={0} className={cls} value={row.totalPieces} onChange={(e) => updateRow(idx, { totalPieces: e.target.value ? Number(e.target.value) : '' })} /></td>
                    <td className="px-1 py-1.5"><input type="number" min={0} className={cls} value={row.goodPieces} onChange={(e) => updateRow(idx, { goodPieces: e.target.value ? Number(e.target.value) : '' })} /></td>
                    <td className="px-1 py-1.5"><input type="number" min={0} className={cls} value={row.plannedTime} onChange={(e) => updateRow(idx, { plannedTime: e.target.value ? Number(e.target.value) : '' })} /></td>
                    <td className="px-1 py-1.5"><input type="number" min={0} className={cls} value={row.downtime} onChange={(e) => updateRow(idx, { downtime: e.target.value ? Number(e.target.value) : 0 })} /></td>
                    <td className="px-1 py-1.5"><input type="number" min={0} step="0.1" className={cls} value={row.cycleTime} onChange={(e) => updateRow(idx, { cycleTime: e.target.value ? Number(e.target.value) : '' })} /></td>
                    <td className="px-1 py-1.5 text-center">
                      {rows.length > 1 && (
                        <button type="button" onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <button type="button" onClick={addRow} className="text-sm text-brand-600 hover:text-brand-700 font-semibold">{t("dashboard.addRow") || "+ Add Row"}</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("dashboard.submitAll") || "Submit All"} ({rows.filter(r => r.lineId && r.totalPieces && r.goodPieces && r.cycleTime).length})
          </button>
        </div>
      </div>

      <RecentRecords records={records} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Daily Form — multi-row entry (line + product per row, no cycle time needed)
// ---------------------------------------------------------------------------

interface DailyRow {
  key: number;
  lineId: number | '';
  productId: number | '';
  totalPieces: number | '';
  goodPieces: number | '';
  availableTime: number | '';
  downtime: number | '';
}

function emptyDailyRow(): DailyRow {
  return { key: _rowKey++, lineId: '', productId: '', totalPieces: '', goodPieces: '', availableTime: 480, downtime: 0 };
}

function DailyForm() {
  const { t } = useI18n();
  const { lines, products, loading: ddLoading } = useDropdownData();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<DailyRow[]>([emptyDailyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMsg | null>(null);
  const [records, setRecords] = useState<ProductionRecord[]>([]);

  const updateRow = (idx: number, patch: Partial<DailyRow>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const addRow = () => setRows(prev => [...prev, emptyDailyRow()]);
  const removeRow = (idx: number) => setRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await productionApi.listRecords();
      setRecords((res.data ?? []).slice(0, 10));
    } catch {}
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = rows.filter(r => r.lineId && r.totalPieces && r.goodPieces && r.availableTime);
    if (valid.length === 0) {
      setFeedback({ type: 'error', text: t("dashboard.rowRequired") || 'At least one complete row is required.' });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    let ok = 0, fail = 0;
    for (const row of valid) {
      try {
        const actualRun = Number(row.availableTime) - Number(row.downtime || 0);
        const idealCycleTimeSec = Number(row.totalPieces) > 0
          ? Math.round(((actualRun > 0 ? actualRun : Number(row.availableTime)) * 60) / Number(row.totalPieces) * 100) / 100
          : 1;
        await productionApi.createRecord({
          production_line_id: Number(row.lineId),
          shift_id: null,
          date,
          planned_production_time_min: Number(row.availableTime),
          actual_run_time_min: actualRun > 0 ? actualRun : 0,
          total_pieces: Number(row.totalPieces),
          good_pieces: Number(row.goodPieces),
          ideal_cycle_time_sec: idealCycleTimeSec,
          notes: null,
        });
        ok++;
      } catch { fail++; }
    }
    const savedMsg = fail === 0
      ? (t("dashboard.recordsSaved") || "{ok} record(s) saved").replace("{ok}", String(ok))
      : (t("dashboard.recordsSavedWithErrors") || "{ok} record(s) saved, {fail} failed").replace("{ok}", String(ok)).replace("{fail}", String(fail));
    setFeedback({ type: fail === 0 ? 'success' : 'error', text: savedMsg });
    if (ok > 0) { setRows([emptyDailyRow()]); fetchRecords(); }
    setSubmitting(false);
  }

  if (ddLoading) return <ModeLoader />;

  const cls = inputCls();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-th-text">{t("dashboard.dailyEntryTitle") || "Daily Production Entry"}</h3>
          <div className="flex items-center gap-3">
            <Label htmlFor="df-date">{t("common.date") || "Date"}</Label>
            <input id="df-date" type="date" className={cls + " w-40"} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <FeedbackBanner msg={feedback} />

        <div className="overflow-x-auto mobile-scroll-table">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-th-border text-left text-xs uppercase text-th-text-3">
                <th className="px-2 py-2">{t("dashboard.colLine") || "Line"} *</th>
                <th className="px-2 py-2">{t("dashboard.colProduct") || "Product"}</th>
                <th className="px-2 py-2 w-20">{t("dashboard.colTotal") || "Total"} *</th>
                <th className="px-2 py-2 w-20">{t("dashboard.colGood") || "Good"} *</th>
                <th className="px-2 py-2 w-24">{t("dashboard.colAvailMin") || "Avail (min)"} *</th>
                <th className="px-2 py-2 w-20">{t("dashboard.colDownMin") || "Down (min)"}</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.key} className="border-b border-th-border/50">
                  <td className="px-1 py-1.5">
                    <select className={cls} value={row.lineId} onChange={(e) => updateRow(idx, { lineId: e.target.value ? Number(e.target.value) : '' })}>
                      <option value="">--</option>
                      {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1.5">
                    <select className={cls} value={row.productId} onChange={(e) => updateRow(idx, { productId: e.target.value ? Number(e.target.value) : '' })}>
                      <option value="">--</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1.5"><input type="number" min={0} className={cls} value={row.totalPieces} onChange={(e) => updateRow(idx, { totalPieces: e.target.value ? Number(e.target.value) : '' })} /></td>
                  <td className="px-1 py-1.5"><input type="number" min={0} className={cls} value={row.goodPieces} onChange={(e) => updateRow(idx, { goodPieces: e.target.value ? Number(e.target.value) : '' })} /></td>
                  <td className="px-1 py-1.5"><input type="number" min={0} className={cls} value={row.availableTime} onChange={(e) => updateRow(idx, { availableTime: e.target.value ? Number(e.target.value) : '' })} /></td>
                  <td className="px-1 py-1.5"><input type="number" min={0} className={cls} value={row.downtime} onChange={(e) => updateRow(idx, { downtime: e.target.value ? Number(e.target.value) : 0 })} /></td>
                  <td className="px-1 py-1.5 text-center">
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <button type="button" onClick={addRow} className="text-sm text-brand-600 hover:text-brand-700 font-semibold">{t("dashboard.addRow") || "+ Add Row"}</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("dashboard.submitAll") || "Submit All"} ({rows.filter(r => r.lineId && r.totalPieces && r.goodPieces && r.availableTime).length})
          </button>
        </div>
      </div>

      <RecentRecords records={records} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent records table (shared)
// ---------------------------------------------------------------------------

interface ProductionRecord { id: number; date: string; production_line_name?: string; production_line_id?: number; total_pieces: number; good_pieces: number; actual_run_time_min: number; notes?: string }

function RecentRecords({ records }: { records: ProductionRecord[] }) {
  const { t } = useI18n();
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6 text-center text-sm text-th-text-3">
        {t("dashboard.noRecords") || "No recent records found."}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
      <div className="px-6 py-3 border-b border-th-border">
        <h4 className="text-sm font-semibold text-th-text">{t("dashboard.recentRecords") || "Recent Records"}</h4>
      </div>
      <div className="overflow-x-auto mobile-scroll-table">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-th-border bg-th-bg-1">
              <th className="text-left px-4 py-2 font-medium text-th-text-2">{t("common.date")}</th>
              <th className="text-left px-4 py-2 font-medium text-th-text-2">{t("common.line") || "Line"}</th>
              <th className="text-right px-4 py-2 font-medium text-th-text-2">{t("common.total")}</th>
              <th className="text-right px-4 py-2 font-medium text-th-text-2">{t("dashboard.good") || "Good"}</th>
              <th className="text-right px-4 py-2 font-medium text-th-text-2">{t("dashboard.runMin") || "Run (min)"}</th>
              <th className="text-left px-4 py-2 font-medium text-th-text-2">{t("common.notes")}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-th-border last:border-0 hover:bg-th-bg-1/50">
                <td className="px-4 py-2 text-th-text">{r.date}</td>
                <td className="px-4 py-2 text-th-text">{r.production_line_name ?? r.production_line_id}</td>
                <td className="px-4 py-2 text-right text-th-text">{r.total_pieces}</td>
                <td className="px-4 py-2 text-right text-th-text">{r.good_pieces}</td>
                <td className="px-4 py-2 text-right text-th-text">{r.actual_run_time_min}</td>
                <td className="px-4 py-2 text-th-text-3 truncate max-w-[200px]">{r.notes ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const MODE_KEYS: { key: Mode; labelKey: string; fallback: string; emoji: string }[] = [
  { key: 'hourly', labelKey: 'dashboard.modeHourly', fallback: 'Hourly', emoji: '\u{1F4CA}' },
  { key: 'shift', labelKey: 'dashboard.modeShift', fallback: 'Per Shift', emoji: '\u{23F1}\uFE0F' },
  { key: 'daily', labelKey: 'dashboard.modeDaily', fallback: 'Daily', emoji: '\u{1F4C5}' },
];

export default function ProductionTracking() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('hourly');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY) as Mode | null;
      if (saved && ['hourly', 'shift', 'daily'].includes(saved)) setMode(saved);
    } catch {}
  }, []);

  const handleModeChange = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(LS_KEY, m);
    } catch {}
  };

  return (
    <div className="space-y-6">
      <ToolInfoCard info={TOOL_INFO.production} />
      {/* Mode selector — pill buttons */}
      <div className="flex flex-wrap gap-2">
        {MODE_KEYS.map((m) => {
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => handleModeChange(m.key)}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-th-bg-2 text-th-text-2 border border-th-border hover:bg-th-bg-1'
              }`}
            >
              <span className="text-base">{m.emoji}</span>
              {t(m.labelKey) || m.fallback}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <Suspense fallback={<ModeLoader />}>
        {mode === 'hourly' && <HourlyProductionBoard />}
        {mode === 'shift' && <ShiftForm />}
        {mode === 'daily' && <DailyForm />}
      </Suspense>
    </div>
  );
}
