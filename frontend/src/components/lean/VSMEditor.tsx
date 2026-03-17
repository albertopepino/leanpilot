"use client";
import { useState, useCallback, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import {
  Map,
  ArrowRight,
  Warehouse,
  Clock,
  Timer,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Save,
  FolderOpen,
  X,
  Users,
  Zap,
  BarChart3,
  Activity,
  Gauge,
  Package,
} from "lucide-react";

/* ──────────────────────────── Types ──────────────────────────── */

interface VSMStep {
  process_name: string;
  cycle_time_sec: number;
  changeover_time_min: number;
  uptime_pct: number;
  batch_size: number;
  operators: number;
  wip_before: number;
  wait_time_hours: number;
  is_bottleneck: boolean;
  is_kaizen_burst: boolean;
}

type MapState = "current" | "future";

interface VSMMap {
  id?: number;
  title: string;
  product_family: string;
  takt_time_sec: number;
  customer_demand_per_day: number;
  steps: VSMStep[];
}

interface SavedVSM extends VSMMap {
  id: number;
  created_at?: string;
}

/* ──────────────────────────── Constants ──────────────────────── */

const EMPTY_STEP: VSMStep = {
  process_name: "",
  cycle_time_sec: 0,
  changeover_time_min: 0,
  uptime_pct: 95,
  batch_size: 1,
  operators: 1,
  wip_before: 0,
  wait_time_hours: 0,
  is_bottleneck: false,
  is_kaizen_burst: false,
};

/* Demo step arrays removed — component starts empty */

/* ──────────────────────────── Helpers ─────────────────────────── */

function calcMetrics(steps: VSMStep[]) {
  const totalProcessingSec = steps.reduce((s, st) => s + st.cycle_time_sec, 0);
  const totalWaitHrs = steps.reduce((s, st) => s + st.wait_time_hours, 0);
  const totalLeadDays = totalWaitHrs / 24 + totalProcessingSec / 86400;
  const pce = totalLeadDays > 0 ? ((totalProcessingSec / 86400) / totalLeadDays) * 100 : 0;
  const totalValueAddSec = totalProcessingSec;
  const totalNonValueAddSec = totalWaitHrs * 3600;
  const totalChangeoverSec = steps.reduce((s, st) => s + st.changeover_time_min * 60, 0);
  return { totalProcessingSec, totalWaitHrs, totalLeadDays, pce, totalValueAddSec, totalNonValueAddSec, totalChangeoverSec };
}

/* ──────────────────────── Inline sub-components ──────────────── */

function FlowArrow({ className = "" }: { className?: string }) {
  return (
    <div className={`shrink-0 flex items-center ${className}`}>
      <ArrowRight className="w-6 h-6 text-th-text-2" />
    </div>
  );
}

function InventoryTriangle({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <div className="flex flex-col items-center justify-end min-w-[44px]">
      <Package className="w-6 h-6 text-lean-orange" />
      <span className="text-xs font-bold text-lean-orange">{count}</span>
      <span className="text-[9px] text-th-text-3">{label}</span>
    </div>
  );
}

function KaizenBurst({ tooltip }: { tooltip: string }) {
  return (
    <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center shadow-md" title={tooltip}>
      <Zap className="w-4 h-4 text-yellow-800" />
    </div>
  );
}

/** PCE Gauge */
function PCEGauge({ pce, size = 100 }: { pce: number; size?: number }) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius * 0.75;
  const offset = circumference - (Math.min(pce, 100) / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;
  const color = pce >= 25 ? "#10b981" : pce >= 10 ? "#eab308" : "#ef4444";

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
        <span className="text-xl font-black" style={{ color }}>{pce.toFixed(1)}%</span>
        <span className="text-[9px] text-th-text-3 font-semibold">PCE</span>
      </div>
    </div>
  );
}

/* ──────────────────────────── Component ──────────────────────── */

export default function VSMEditor() {
  const { t } = useI18n();
  const { printView, exportToExcel, exportToCSV } = useExport();

  /* ── Map metadata ── */
  const [title, setTitle] = useState("");
  const [productFamily, setProductFamily] = useState("");
  const [taktTime, setTaktTime] = useState<number>(60);
  const [customerDemand, setCustomerDemand] = useState<number>(480);

  /* ── Current vs Future state ── */
  const [mapState, setMapState] = useState<MapState>("current");
  const [currentSteps, setCurrentSteps] = useState<VSMStep[]>([]);
  const [futureSteps, setFutureSteps] = useState<VSMStep[]>([]);

  /* ── Persistence ── */
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [savedMaps, setSavedMaps] = useState<SavedVSM[]>([]);
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  /* ── Active steps accessor ── */
  const steps = mapState === "current" ? currentSteps : futureSteps;
  const setSteps = mapState === "current" ? setCurrentSteps : setFutureSteps;

  /* ── Metrics ── */
  const m = useMemo(() => calcMetrics(steps), [steps]);
  const mCurrent = useMemo(() => calcMetrics(currentSteps), [currentSteps]);
  const mFuture = useMemo(() => calcMetrics(futureSteps), [futureSteps]);

  /* ── Toast ── */
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  /* ── Step CRUD ── */
  const addStep = useCallback(() => {
    setSteps((prev) => [...prev, { ...EMPTY_STEP }]);
  }, [setSteps]);

  const updateStep = useCallback(
    (idx: number, field: keyof VSMStep, value: string | number | boolean) => {
      setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
    },
    [setSteps],
  );

  const removeStep = useCallback(
    (idx: number) => {
      setSteps((prev) => prev.filter((_, i) => i !== idx));
    },
    [setSteps],
  );

  const moveStep = useCallback(
    (idx: number, dir: -1 | 1) => {
      setSteps((prev) => {
        const next = [...prev];
        const target = idx + dir;
        if (target < 0 || target >= next.length) return prev;
        [next[idx], next[target]] = [next[target], next[idx]];
        return next;
      });
    },
    [setSteps],
  );

  /* ── Save / Load ── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        title,
        product_family: productFamily,
        takt_time_sec: taktTime,
        customer_demand_per_day: customerDemand,
        steps: currentSteps,
        future_steps: futureSteps,
      };
      await advancedLeanApi.createVSM(payload);
      toast(t("improvement.vsmSaved"));
    } catch {
      toast(t("improvement.vsmSaveError"));
    } finally {
      setSaving(false);
    }
  }, [title, productFamily, taktTime, customerDemand, currentSteps, futureSteps, t, toast]);

  const handleLoadList = useCallback(async () => {
    setLoadingList(true);
    setShowLoadPanel(true);
    try {
      const res = await advancedLeanApi.listVSM();
      setSavedMaps(res.data ?? []);
    } catch {
      setSavedMaps([]);
      toast(t("improvement.vsmLoadError"));
    } finally {
      setLoadingList(false);
    }
  }, [t, toast]);

  const handleSelectMap = useCallback(
    (map: SavedVSM) => {
      setTitle(map.title);
      setProductFamily(map.product_family);
      setTaktTime(map.takt_time_sec);
      setCustomerDemand(map.customer_demand_per_day);
      setCurrentSteps(map.steps ?? []);
      setFutureSteps((map as any).future_steps ?? []);
      setShowLoadPanel(false);
      setMapState("current");
      toast(t("improvement.vsmLoaded"));
    },
    [t, toast],
  );

  /* ── Derived values for timeline ── */
  const maxCT = useMemo(() => Math.max(...steps.map((s) => s.cycle_time_sec), 1), [steps]);
  const maxWait = useMemo(() => Math.max(...steps.map((s) => s.wait_time_hours), 1), [steps]);

  /* ──────────────────────────── Render ────────────────────────── */
  return (
    <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true">
      {/* ── Toast notification ── */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-th-brand text-white px-5 py-3 rounded-lg shadow-sm text-sm animate-slide-in font-medium">
          {toastMsg}
        </div>
      )}

      {/* ════════════════════ HEADER ════════════════════ */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-th-bg-3 rounded-lg flex items-center justify-center border border-th-border">
              <Map className="w-5 h-5 text-th-brand" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-th-text">{t("improvement.vsmTitle")}</h2>
              <p className="text-sm text-th-text-3">{t("improvement.vsmSubtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportToolbar
              onPrint={() => printView({ title: t("improvement.vsmTitle") || "Value Stream Map", subtitle: title })}
              onExportExcel={() => exportToExcel({
                filename: `vsm_${title || "map"}`,
                sheetName: "VSM",
                columns: [
                  { key: "process", header: t("improvement.processName") || "Process", width: 20 },
                  { key: "cycleTime", header: t("improvement.cycleTimeSec") || "Cycle Time (s)", width: 14 },
                  { key: "changeoverMin", header: t("improvement.changeoverMin") || "Changeover (min)", width: 15 },
                  { key: "uptime", header: t("improvement.uptimePct") || "Uptime %", width: 10 },
                  { key: "operators", header: t("improvement.operators") || "Operators", width: 10 },
                  { key: "wipBefore", header: t("improvement.wipBefore") || "WIP Before", width: 10 },
                  { key: "waitHours", header: t("improvement.waitTimeHours") || "Wait (hrs)", width: 10 },
                  { key: "bottleneck", header: t("improvement.bottleneck") || "Bottleneck", width: 10 },
                ],
                rows: steps.map((s) => ({
                  process: s.process_name,
                  cycleTime: s.cycle_time_sec,
                  changeoverMin: s.changeover_time_min,
                  uptime: s.uptime_pct,
                  operators: s.operators,
                  wipBefore: s.wip_before,
                  waitHours: s.wait_time_hours,
                  bottleneck: s.is_bottleneck ? "Yes" : "",
                })),
                headerRows: [
                  [t("improvement.taktTime") || "Takt Time (s)", String(taktTime)],
                  [t("improvement.totalLeadTime") || "Lead Time (days)", String(m.totalLeadDays.toFixed(2))],
                  [t("improvement.pce") || "PCE %", String(m.pce.toFixed(1))],
                ],
              })}
              onExportCSV={() => exportToCSV({
                filename: `vsm_${title || "map"}`,
                columns: [
                  { key: "process", header: t("improvement.processName") || "Process" },
                  { key: "cycleTime", header: t("improvement.cycleTimeSec") || "Cycle Time (s)" },
                  { key: "changeoverMin", header: t("improvement.changeoverMin") || "Changeover (min)" },
                  { key: "uptime", header: t("improvement.uptimePct") || "Uptime %" },
                  { key: "operators", header: t("improvement.operators") || "Operators" },
                  { key: "wipBefore", header: t("improvement.wipBefore") || "WIP Before" },
                  { key: "waitHours", header: t("improvement.waitTimeHours") || "Wait (hrs)" },
                  { key: "bottleneck", header: t("improvement.bottleneck") || "Bottleneck" },
                ],
                rows: steps.map((s) => ({
                  process: s.process_name,
                  cycleTime: s.cycle_time_sec,
                  changeoverMin: s.changeover_time_min,
                  uptime: s.uptime_pct,
                  operators: s.operators,
                  wipBefore: s.wip_before,
                  waitHours: s.wait_time_hours,
                  bottleneck: s.is_bottleneck ? "Yes" : "",
                })),
              })}
            />
            <button
              onClick={handleLoadList}
              disabled={loadingList}
              className="flex items-center gap-1.5 px-3 py-2 bg-th-bg-3 hover:bg-th-bg-4 rounded-lg text-sm font-medium transition disabled:opacity-50 border border-th-border text-th-text"
            >
              <FolderOpen className="w-4 h-4" />
              {loadingList ? "..." : t("improvement.load")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-th-brand hover:bg-th-brand-hover text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "..." : t("improvement.save")}
            </button>
          </div>
        </div>

        {/* Metadata inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={t("improvement.vsmTitlePlaceholder")}
            className="px-3 py-2 bg-th-bg-3 border border-th-border rounded-lg text-th-text placeholder-th-text-3 text-sm focus:ring-2 focus:ring-th-brand/30 outline-none transition"
          />
          <input
            type="text" value={productFamily} onChange={(e) => setProductFamily(e.target.value)}
            placeholder={t("improvement.productFamily")}
            className="px-3 py-2 bg-th-bg-3 border border-th-border rounded-lg text-th-text placeholder-th-text-3 text-sm focus:ring-2 focus:ring-th-brand/30 outline-none transition"
          />
          <input
            type="number" inputMode="decimal" value={taktTime || ""} onChange={(e) => setTaktTime(Number(e.target.value))}
            placeholder={t("improvement.taktTimeSec")}
            className="px-3 py-2 bg-th-bg-3 border border-th-border rounded-lg text-th-text placeholder-th-text-3 text-sm focus:ring-2 focus:ring-th-brand/30 outline-none transition"
          />
          <input
            type="number" inputMode="numeric" value={customerDemand || ""} onChange={(e) => setCustomerDemand(Number(e.target.value))}
            placeholder={t("improvement.customerDemandDay")}
            className="px-3 py-2 bg-th-bg-3 border border-th-border rounded-lg text-th-text placeholder-th-text-3 text-sm focus:ring-2 focus:ring-th-brand/30 outline-none transition"
          />
        </div>
      </div>

      {/* ════════════════════ LOAD PANEL ════════════════════ */}
      {showLoadPanel && (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 font-bold text-th-text text-sm uppercase tracking-wider">
              <FolderOpen className="w-4 h-4 text-th-text-2" />
              {t("improvement.savedMaps")}
            </h3>
            <button onClick={() => setShowLoadPanel(false)} className="text-th-text-3 hover:text-th-text p-1 rounded-lg hover:bg-th-bg-3 transition" aria-label={t("common.close")}>
              <X className="w-4 h-4" />
            </button>
          </div>
          {loadingList ? (
            <p className="text-sm text-th-text-3 animate-pulse">{t("improvement.loading")}</p>
          ) : savedMaps.length === 0 ? (
            <p className="text-sm text-th-text-3">{t("improvement.noSavedMaps")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {savedMaps.map((sm) => (
                <button
                  key={sm.id} onClick={() => handleSelectMap(sm)}
                  className="text-left p-3 rounded-lg border border-th-border hover:border-th-brand/50 hover:bg-th-bg-3 transition"
                >
                  <div className="font-semibold text-sm text-th-text">{sm.title}</div>
                  <div className="text-xs text-th-text-3">
                    {sm.product_family} &middot; {sm.steps?.length ?? 0} {t("improvement.step")}
                    {sm.created_at && ` \u00B7 ${new Date(sm.created_at).toLocaleDateString()}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ CURRENT / FUTURE TOGGLE ════════════════════ */}
      <div className="flex items-center gap-1 rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-1 w-fit">
        <button
          onClick={() => setMapState("current")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
            mapState === "current"
              ? "bg-th-brand text-white shadow-sm"
              : "text-th-text-2 hover:bg-th-bg-3"
          }`}
        >
          {t("improvement.currentState")}
        </button>
        <button
          onClick={() => setMapState("future")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
            mapState === "future"
              ? "bg-th-brand text-white shadow-sm"
              : "text-th-text-2 hover:bg-th-bg-3"
          }`}
        >
          {t("improvement.futureState")}
        </button>
      </div>

      {/* ════════════════════ SUMMARY KPI CARDS ════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* PCE Gauge */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-3 flex flex-col items-center justify-center col-span-2 sm:col-span-1">
          <PCEGauge pce={m.pce} size={90} />
          <div className="text-[10px] text-th-text-3 mt-1 uppercase tracking-wider font-semibold">{t("improvement.pceRatio")}</div>
        </div>
        {/* Lead Time */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 text-center">
          <Timer className="w-4 h-4 text-th-text-3 mx-auto mb-1" />
          <div className="text-[10px] text-th-text-3 mb-1 uppercase tracking-wider font-semibold">{t("improvement.leadTime")}</div>
          <div className="text-xl font-black text-th-text">{m.totalLeadDays.toFixed(2)} d</div>
        </div>
        {/* Processing Time */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 text-center">
          <Activity className="w-4 h-4 text-th-text-3 mx-auto mb-1" />
          <div className="text-[10px] text-th-text-3 mb-1 uppercase tracking-wider font-semibold">{t("improvement.totalProcessing")}</div>
          <div className="text-xl font-black text-th-text">{(m.totalProcessingSec / 60).toFixed(1)} min</div>
        </div>
        {/* Takt Time */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 text-center">
          <Clock className="w-4 h-4 text-th-text-3 mx-auto mb-1" />
          <div className="text-[10px] text-th-text-3 mb-1 uppercase tracking-wider font-semibold">{t("improvement.taktTimeSec")}</div>
          <div className="text-xl font-black text-th-text">{taktTime}s</div>
        </div>
        {/* Total Wait */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 text-center">
          <Gauge className="w-4 h-4 text-th-text-3 mx-auto mb-1" />
          <div className="text-[10px] text-th-text-3 mb-1 uppercase tracking-wider font-semibold">{t("improvement.totalWaitTime")}</div>
          <div className="text-xl font-black text-lean-orange">{m.totalWaitHrs.toFixed(1)} hrs</div>
        </div>
      </div>

      {/* ════════════════════ CURRENT vs FUTURE COMPARISON ════════════════════ */}
      {futureSteps.length > 0 && (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
          <h3 className="flex items-center gap-2 font-bold text-th-text text-xs mb-4 uppercase tracking-wider">
            <BarChart3 className="w-4 h-4 text-th-text-2" />
            {t("improvement.comparison")}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            {[
              { label: t("improvement.leadTime"), cur: `${mCurrent.totalLeadDays.toFixed(2)} d`, fut: `${mFuture.totalLeadDays.toFixed(2)} d`, good: mFuture.totalLeadDays < mCurrent.totalLeadDays },
              { label: t("improvement.pceRatio"), cur: `${mCurrent.pce.toFixed(1)}%`, fut: `${mFuture.pce.toFixed(1)}%`, good: mFuture.pce > mCurrent.pce },
              { label: t("improvement.totalProcessing"), cur: `${(mCurrent.totalProcessingSec / 60).toFixed(1)} min`, fut: `${(mFuture.totalProcessingSec / 60).toFixed(1)} min`, good: mFuture.totalProcessingSec < mCurrent.totalProcessingSec },
              { label: t("improvement.totalWaitTime"), cur: `${mCurrent.totalWaitHrs.toFixed(1)} hrs`, fut: `${mFuture.totalWaitHrs.toFixed(1)} hrs`, good: mFuture.totalWaitHrs < mCurrent.totalWaitHrs },
            ].map((row, i) => (
              <div key={i} className="p-4 rounded-xl bg-th-bg-3 border border-th-border">
                <div className="text-th-text-3 mb-2 font-semibold uppercase tracking-wider text-[10px]">{row.label}</div>
                <div className="text-th-text font-bold text-sm">{row.cur}</div>
                <div className="text-th-text-3 my-1">&darr;</div>
                <div className={`font-black text-sm ${row.good ? "text-lean-green" : "text-lean-red"}`}>
                  {row.fut} {row.good ? "\u2193" : "\u2191"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════ VISUAL FLOW DIAGRAM ════════════════════ */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 overflow-x-auto">
        <div className="flex items-start gap-1 pb-4 min-w-max">
          {/* ── Supplier ── */}
          <div className="flex flex-col items-center shrink-0">
            <div className="w-28 bg-th-bg-3 rounded-xl p-3 border-2 border-dashed border-th-border text-center">
              <Warehouse className="w-6 h-6 mx-auto mb-1 text-th-text-2" />
              <div className="text-xs font-semibold text-th-text-2">{t("improvement.supplier")}</div>
            </div>
            <div className="mt-1 text-[9px] text-th-text-3 font-medium flex items-center gap-0.5">
              <span className="inline-block w-5 h-px bg-th-text-3" />
              <span>MRP</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* ── Process steps ── */}
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-1 shrink-0">
              {(step.wip_before > 0 || step.wait_time_hours > 0) && (
                <div className="flex flex-col items-center justify-end mt-6 min-w-[44px] gap-0.5">
                  <InventoryTriangle count={step.wip_before} label={t("improvement.wip")} />
                  {step.wait_time_hours > 0 && (
                    <div className="text-[10px] text-th-text-3">{step.wait_time_hours}h</div>
                  )}
                </div>
              )}

              <div className="flex items-center mt-14">
                <FlowArrow />
              </div>

              {/* Step card */}
              <div className="flex flex-col items-center shrink-0">
                <div className="mb-1 h-5 flex items-center">
                  <div className="text-[9px] text-th-text-3 flex items-center gap-0.5">
                    <span className="inline-block w-3 h-px bg-th-text-3" />
                    <span>{idx === 0 ? "Schedule" : "Signal"}</span>
                  </div>
                </div>

                <div
                  className={`relative w-52 rounded-xl p-3 shadow-sm border transition-all duration-200 ${
                    step.is_bottleneck
                      ? "border-lean-red/40 bg-th-bg-2"
                      : mapState === "future"
                      ? "border-lean-green/40 bg-th-bg-2"
                      : "border-th-border bg-th-bg-2"
                  } hover:shadow-md`}
                >
                  {step.is_kaizen_burst && (
                    <KaizenBurst tooltip={t("improvement.kaizenBurst")} />
                  )}

                  {taktTime > 0 && (
                    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          step.cycle_time_sec <= taktTime ? "bg-lean-green" : "bg-lean-red"
                        }`}
                        style={{ width: `${Math.min((step.cycle_time_sec / taktTime) * 100, 100)}%` }}
                      />
                    </div>
                  )}

                  <div className="absolute top-1 right-1 flex gap-0.5">
                    <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="text-th-text-3 hover:text-th-brand disabled:opacity-20 p-0.5 rounded" aria-label={t("common.moveLeft")}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} className="text-th-text-3 hover:text-th-brand disabled:opacity-20 p-0.5 rounded" aria-label={t("common.moveRight")}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeStep(idx)} className="text-th-text-3 hover:text-lean-red ml-0.5 p-0.5 rounded" aria-label={t("common.remove")}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="text" value={step.process_name} onChange={(e) => updateStep(idx, "process_name", e.target.value)}
                    placeholder={t("improvement.processName")}
                    className="w-full text-sm font-bold text-th-text bg-transparent border-b border-th-border mb-2 mt-1 outline-none placeholder-th-text-3 focus:border-th-brand transition"
                  />

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                    <label className="flex items-center gap-1">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.ct")}</span>
                      <input type="number" inputMode="decimal" value={step.cycle_time_sec || ""} onChange={(e) => updateStep(idx, "cycle_time_sec", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-th-brand transition" />
                      <span className="text-th-text-3">s</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.co")}</span>
                      <input type="number" inputMode="decimal" value={step.changeover_time_min || ""} onChange={(e) => updateStep(idx, "changeover_time_min", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-th-brand transition" />
                      <span className="text-th-text-3">m</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.upPct")}</span>
                      <input type="number" inputMode="decimal" value={step.uptime_pct || ""} onChange={(e) => updateStep(idx, "uptime_pct", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-th-brand transition" />
                      <span className="text-th-text-3">%</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.batchSize")}</span>
                      <input type="number" inputMode="numeric" value={step.batch_size || ""} onChange={(e) => updateStep(idx, "batch_size", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-th-brand transition" />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.ops")}</span>
                      <input type="number" inputMode="numeric" value={step.operators || ""} onChange={(e) => updateStep(idx, "operators", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-th-brand transition" />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.wip")}</span>
                      <input type="number" inputMode="numeric" value={step.wip_before || ""} onChange={(e) => updateStep(idx, "wip_before", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-th-brand transition" />
                    </label>
                    <label className="flex items-center gap-1 col-span-2">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.waitHours")}</span>
                      <input type="number" inputMode="decimal" value={step.wait_time_hours || ""} onChange={(e) => updateStep(idx, "wait_time_hours", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-th-brand transition" />
                      <span className="text-th-text-3">h</span>
                    </label>
                  </div>

                  <div className="flex gap-3 mt-2 pt-1 border-t border-th-border">
                    <label className="flex items-center gap-1 text-[10px] text-th-text-2 cursor-pointer select-none">
                      <input type="checkbox" checked={step.is_bottleneck} onChange={(e) => updateStep(idx, "is_bottleneck", e.target.checked)} className="w-3 h-3 accent-red-500 rounded" />
                      {t("improvement.bottleneck")}
                    </label>
                    <label className="flex items-center gap-1 text-[10px] text-th-text-2 cursor-pointer select-none">
                      <input type="checkbox" checked={step.is_kaizen_burst} onChange={(e) => updateStep(idx, "is_kaizen_burst", e.target.checked)} className="w-3 h-3 accent-yellow-500 rounded" />
                      {t("improvement.kaizen")}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* ── Add step button ── */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center mt-14"><FlowArrow /></div>
            <div className="flex flex-col items-center mt-6">
              <div className="h-5" />
              <button
                onClick={addStep}
                className="w-28 h-[140px] border-2 border-dashed border-th-border rounded-xl flex flex-col items-center justify-center text-th-text-2 hover:bg-th-bg-3 transition"
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">{t("improvement.addStep")}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center mt-14"><FlowArrow /></div>

          {/* ── Customer ── */}
          <div className="flex flex-col items-center shrink-0">
            <div className="mb-1 h-5 flex items-center">
              <div className="text-[9px] text-th-text-3 flex items-center gap-0.5">
                <span>Order</span>
              </div>
            </div>
            <div className="w-28 bg-th-bg-3 rounded-xl p-3 border-2 border-dashed border-th-border text-center">
              <Users className="w-6 h-6 mx-auto mb-1 text-th-text-2" />
              <div className="text-xs font-semibold text-th-text-2">{t("improvement.customer")}</div>
              {customerDemand > 0 && (
                <div className="text-xs text-th-text-3">{customerDemand}/day</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════ TIMELINE BAR ════════════════════ */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
        <h3 className="flex items-center gap-2 font-bold text-th-text text-xs mb-4 uppercase tracking-wider">
          <BarChart3 className="w-4 h-4 text-th-text-2" />
          {t("improvement.timeline")}
        </h3>

        <div className="flex items-end gap-0 w-full overflow-x-auto pb-2">
          {steps.map((step, idx) => {
            const barH = 80;
            return (
              <div key={idx} className="flex flex-col items-center flex-1 min-w-[60px]">
                <div className="flex gap-0.5 items-end" style={{ height: barH }}>
                  <div
                    className="w-4 bg-lean-red/50 rounded-t transition-all"
                    style={{ height: `${(step.wait_time_hours / maxWait) * barH}px` }}
                    title={`${t("improvement.waitHours")}: ${step.wait_time_hours}h`}
                  />
                  <div
                    className="w-4 bg-lean-green/60 rounded-t transition-all"
                    style={{ height: `${(step.cycle_time_sec / maxCT) * barH}px` }}
                    title={`${t("improvement.ct")}: ${step.cycle_time_sec}s`}
                  />
                </div>
                {taktTime > 0 && step.cycle_time_sec > taktTime && (
                  <div className="w-full border-t-2 border-dashed border-red-400 mt-px" />
                )}
                <div className="text-[9px] text-th-text-3 mt-1 text-center truncate w-full px-0.5 font-medium">
                  {step.process_name || `#${idx + 1}`}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 mt-3 text-xs text-th-text-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-lean-green/70 rounded" />
            <span>{t("improvement.valueAdd")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-lean-red/60 rounded" />
            <span>{t("improvement.nonValueAdd")}</span>
          </div>
          {taktTime > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 border-t-2 border-dashed border-red-400" />
              <span>{t("improvement.taktLine")}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
          <div className="p-3 rounded-xl border border-th-border bg-th-bg-3 text-center">
            <div className="text-th-text-3 font-semibold uppercase tracking-wider text-[10px]">{t("improvement.valueAdd")}</div>
            <div className="font-black text-lean-green mt-1">{(m.totalValueAddSec / 60).toFixed(1)} min</div>
          </div>
          <div className="p-3 rounded-xl border border-th-border bg-th-bg-3 text-center">
            <div className="text-th-text-3 font-semibold uppercase tracking-wider text-[10px]">{t("improvement.nonValueAdd")}</div>
            <div className="font-black text-lean-red mt-1">{m.totalWaitHrs.toFixed(1)} hrs</div>
          </div>
          <div className="p-3 rounded-xl border border-th-border bg-th-bg-3 text-center">
            <div className="text-th-text-3 font-semibold uppercase tracking-wider text-[10px]">{t("improvement.changeover")}</div>
            <div className="font-black text-lean-orange mt-1">{(m.totalChangeoverSec / 60).toFixed(1)} min</div>
          </div>
        </div>
      </div>
    </div>
  );
}
