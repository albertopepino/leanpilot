"use client";
import { useState, useCallback, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";

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

const DEMO_STEPS: VSMStep[] = [
  { process_name: "Stamping", cycle_time_sec: 12, changeover_time_min: 30, uptime_pct: 90, batch_size: 100, operators: 1, wip_before: 0, wait_time_hours: 24, is_bottleneck: false, is_kaizen_burst: false },
  { process_name: "Welding", cycle_time_sec: 46, changeover_time_min: 15, uptime_pct: 85, batch_size: 50, operators: 2, wip_before: 200, wait_time_hours: 48, is_bottleneck: true, is_kaizen_burst: true },
  { process_name: "Assembly", cycle_time_sec: 30, changeover_time_min: 0, uptime_pct: 98, batch_size: 1, operators: 3, wip_before: 50, wait_time_hours: 8, is_bottleneck: false, is_kaizen_burst: false },
  { process_name: "Packaging", cycle_time_sec: 18, changeover_time_min: 5, uptime_pct: 99, batch_size: 25, operators: 1, wip_before: 30, wait_time_hours: 4, is_bottleneck: false, is_kaizen_burst: false },
];

const DEMO_FUTURE_STEPS: VSMStep[] = [
  { process_name: "Stamping", cycle_time_sec: 10, changeover_time_min: 10, uptime_pct: 95, batch_size: 20, operators: 1, wip_before: 0, wait_time_hours: 4, is_bottleneck: false, is_kaizen_burst: false },
  { process_name: "Welding + Assembly", cycle_time_sec: 38, changeover_time_min: 5, uptime_pct: 92, batch_size: 1, operators: 2, wip_before: 20, wait_time_hours: 2, is_bottleneck: false, is_kaizen_burst: true },
  { process_name: "Packaging", cycle_time_sec: 15, changeover_time_min: 3, uptime_pct: 99, batch_size: 10, operators: 1, wip_before: 5, wait_time_hours: 1, is_bottleneck: false, is_kaizen_burst: false },
];

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
    <svg width="32" height="24" viewBox="0 0 32 24" className={`shrink-0 ${className}`}>
      <line x1="0" y1="12" x2="24" y2="12" stroke="currentColor" strokeWidth="2" className="text-th-text-2" />
      <polygon points="24,6 32,12 24,18" fill="currentColor" className="text-th-text-2" />
    </svg>
  );
}

function InventoryTriangle({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <div className="flex flex-col items-center justify-end min-w-[44px]">
      <svg width="28" height="24" viewBox="0 0 28 24" className="text-lean-orange">
        <polygon points="14,2 26,22 2,22" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="text-xs font-bold text-lean-orange">{count}</span>
      <span className="text-[9px] text-th-text-3">{label}</span>
    </div>
  );
}

function KaizenBurst({ tooltip }: { tooltip: string }) {
  return (
    <div className="absolute -top-3 -right-3 w-8 h-8" title={tooltip}>
      <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-lg">
        <polygon
          points="18,1 21,12 32,8 24,16 35,18 24,20 32,28 21,24 18,35 15,24 4,28 12,20 1,18 12,16 4,8 15,12"
          fill="#facc15" stroke="#eab308" strokeWidth="1"
        />
        <text x="18" y="21" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#92400e">K</text>
      </svg>
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
  const [title, setTitle] = useState("Demo Value Stream");
  const [productFamily, setProductFamily] = useState("Widget A");
  const [taktTime, setTaktTime] = useState<number>(60);
  const [customerDemand, setCustomerDemand] = useState<number>(480);

  /* ── Current vs Future state ── */
  const [mapState, setMapState] = useState<MapState>("current");
  const [currentSteps, setCurrentSteps] = useState<VSMStep[]>(DEMO_STEPS);
  const [futureSteps, setFutureSteps] = useState<VSMStep[]>(DEMO_FUTURE_STEPS);

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
      setCurrentSteps(map.steps ?? DEMO_STEPS);
      setFutureSteps((map as any).future_steps ?? DEMO_FUTURE_STEPS);
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
    <div className="space-y-6 max-w-7xl mx-auto" data-print-area="true">
      {/* ── Toast notification ── */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-gradient-to-r from-brand-600 to-blue-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm animate-slide-in font-medium">
          {toastMsg}
        </div>
      )}

      {/* ════════════════════ HEADER ════════════════════ */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl p-6 text-white shadow-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="6" height="10" rx="1" />
                <rect x="9" y="4" width="6" height="16" rx="1" />
                <rect x="16" y="9" width="6" height="6" rx="1" />
                <line x1="8" y1="12" x2="9" y2="12" />
                <line x1="15" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">{t("improvement.vsmTitle")}</h2>
              <p className="text-sm text-white/70">{t("improvement.vsmSubtitle")}</p>
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
              className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl text-sm font-medium transition disabled:opacity-50 border border-white/10"
            >
              {loadingList ? "..." : t("improvement.load")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-white hover:bg-white/90 text-blue-600 rounded-xl text-sm font-bold transition disabled:opacity-50 shadow-md"
            >
              {saving ? "..." : t("improvement.save")}
            </button>
          </div>
        </div>

        {/* Metadata inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={t("improvement.vsmTitlePlaceholder")}
            className="px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 text-sm focus:ring-2 focus:ring-white/30 outline-none transition"
          />
          <input
            type="text" value={productFamily} onChange={(e) => setProductFamily(e.target.value)}
            placeholder={t("improvement.productFamily")}
            className="px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 text-sm focus:ring-2 focus:ring-white/30 outline-none transition"
          />
          <input
            type="number" value={taktTime || ""} onChange={(e) => setTaktTime(Number(e.target.value))}
            placeholder={t("improvement.taktTimeSec")}
            className="px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 text-sm focus:ring-2 focus:ring-white/30 outline-none transition"
          />
          <input
            type="number" value={customerDemand || ""} onChange={(e) => setCustomerDemand(Number(e.target.value))}
            placeholder={t("improvement.customerDemandDay")}
            className="px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 text-sm focus:ring-2 focus:ring-white/30 outline-none transition"
          />
        </div>
      </div>

      {/* ════════════════════ LOAD PANEL ════════════════════ */}
      {showLoadPanel && (
        <div className="bg-th-bg-2 rounded-2xl p-5 shadow-card border border-th-border backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-th-text text-sm uppercase tracking-wider">{t("improvement.savedMaps")}</h3>
            <button onClick={() => setShowLoadPanel(false)} className="text-th-text-3 hover:text-th-text text-sm">&#10005;</button>
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
                  className="text-left p-3 rounded-xl border border-th-border hover:border-brand-500/50 hover:bg-brand-500/5 transition"
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
      <div className="flex items-center gap-1 bg-th-bg-2 rounded-xl p-1 w-fit border border-th-border shadow-card backdrop-blur-sm">
        <button
          onClick={() => setMapState("current")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
            mapState === "current"
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
              : "text-th-text-2 hover:bg-th-bg-3"
          }`}
        >
          {t("improvement.currentState")}
        </button>
        <button
          onClick={() => setMapState("future")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
            mapState === "future"
              ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md"
              : "text-th-text-2 hover:bg-th-bg-3"
          }`}
        >
          {t("improvement.futureState")}
        </button>
      </div>

      {/* ════════════════════ SUMMARY KPI CARDS ════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* PCE Gauge */}
        <div className="bg-th-bg-2 rounded-xl p-3 shadow-card border border-th-border flex flex-col items-center justify-center backdrop-blur-sm col-span-2 sm:col-span-1">
          <PCEGauge pce={m.pce} size={90} />
          <div className="text-[10px] text-th-text-3 mt-1 uppercase tracking-wider font-semibold">{t("improvement.pceRatio")}</div>
        </div>
        {/* Lead Time */}
        <div className="bg-th-bg-2 rounded-xl p-4 shadow-card border border-th-border text-center backdrop-blur-sm">
          <div className="text-[10px] text-th-text-3 mb-1 uppercase tracking-wider font-semibold">{t("improvement.leadTime")}</div>
          <div className="text-xl font-black text-lean-purple">{m.totalLeadDays.toFixed(2)} d</div>
        </div>
        {/* Processing Time */}
        <div className="bg-th-bg-2 rounded-xl p-4 shadow-card border border-th-border text-center backdrop-blur-sm">
          <div className="text-[10px] text-th-text-3 mb-1 uppercase tracking-wider font-semibold">{t("improvement.totalProcessing")}</div>
          <div className="text-xl font-black text-brand-600">{(m.totalProcessingSec / 60).toFixed(1)} min</div>
        </div>
        {/* Takt Time */}
        <div className="bg-th-bg-2 rounded-xl p-4 shadow-card border border-th-border text-center backdrop-blur-sm">
          <div className="text-[10px] text-th-text-3 mb-1 uppercase tracking-wider font-semibold">{t("improvement.taktTimeSec")}</div>
          <div className="text-xl font-black text-cyan-600 dark:text-cyan-400">{taktTime}s</div>
        </div>
        {/* Total Wait */}
        <div className="bg-th-bg-2 rounded-xl p-4 shadow-card border border-th-border text-center backdrop-blur-sm">
          <div className="text-[10px] text-th-text-3 mb-1 uppercase tracking-wider font-semibold">{t("improvement.totalWaitTime")}</div>
          <div className="text-xl font-black text-lean-orange">{m.totalWaitHrs.toFixed(1)} hrs</div>
        </div>
      </div>

      {/* ════════════════════ CURRENT vs FUTURE COMPARISON ════════════════════ */}
      {futureSteps.length > 0 && (
        <div className="bg-th-bg-2 rounded-2xl p-5 shadow-card border border-th-border backdrop-blur-sm">
          <h3 className="font-bold text-th-text text-xs mb-4 uppercase tracking-wider">{t("improvement.comparison")}</h3>
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
      <div className="bg-th-bg-2 rounded-2xl p-5 shadow-card border border-th-border overflow-x-auto backdrop-blur-sm">
        <div className="flex items-start gap-1 pb-4 min-w-max">
          {/* ── Supplier ── */}
          <div className="flex flex-col items-center shrink-0">
            <div className="w-28 bg-th-bg-3 rounded-xl p-3 border-2 border-dashed border-th-border text-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-1 text-th-text-2">
                <path d="M3 21V7l9-4 9 4v14" /><path d="M9 21V11h6v10" /><path d="M3 7l9 4 9-4" />
              </svg>
              <div className="text-xs font-semibold text-th-text-2">{t("improvement.supplier")}</div>
            </div>
            <div className="mt-1 text-[9px] text-blue-500 dark:text-blue-400 font-medium flex items-center gap-0.5">
              <span className="inline-block w-5 h-px bg-blue-400" />
              <span>MRP</span>
              <span>&rarr;</span>
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
                  <div className="text-[9px] text-blue-500 dark:text-blue-400 flex items-center gap-0.5">
                    <span className="inline-block w-3 h-px bg-blue-400 dark:bg-blue-500" />
                    <span>{idx === 0 ? "Schedule" : "Signal"}</span>
                    <span>&darr;</span>
                  </div>
                </div>

                <div
                  className={`relative w-52 rounded-xl p-3 shadow-card border-2 transition-all duration-200 ${
                    step.is_bottleneck
                      ? "border-red-500/60 bg-gradient-to-br from-red-500/10 to-rose-500/10 dark:from-red-950/30 dark:to-rose-950/30"
                      : mapState === "future"
                      ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 to-green-500/5 dark:from-emerald-950/20 dark:to-green-950/20"
                      : "border-th-border bg-th-bg-2"
                  } backdrop-blur-sm hover:shadow-card-hover`}
                >
                  {step.is_kaizen_burst && (
                    <KaizenBurst tooltip={t("improvement.kaizenBurst")} />
                  )}

                  {taktTime > 0 && (
                    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          step.cycle_time_sec <= taktTime ? "bg-gradient-to-r from-lean-green to-emerald-400" : "bg-gradient-to-r from-lean-red to-rose-400"
                        }`}
                        style={{ width: `${Math.min((step.cycle_time_sec / taktTime) * 100, 100)}%` }}
                      />
                    </div>
                  )}

                  <div className="absolute top-1 right-1 flex gap-0.5">
                    <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="text-th-text-3 hover:text-brand-500 text-xs disabled:opacity-20 p-0.5">&#8592;</button>
                    <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} className="text-th-text-3 hover:text-brand-500 text-xs disabled:opacity-20 p-0.5">&#8594;</button>
                    <button onClick={() => removeStep(idx)} className="text-th-text-3 hover:text-red-500 text-xs ml-1 p-0.5">&#10005;</button>
                  </div>

                  <input
                    type="text" value={step.process_name} onChange={(e) => updateStep(idx, "process_name", e.target.value)}
                    placeholder={t("improvement.processName")}
                    className="w-full text-sm font-bold text-th-text bg-transparent border-b border-th-border mb-2 mt-1 outline-none placeholder-th-text-3 focus:border-brand-500 transition"
                  />

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                    <label className="flex items-center gap-1">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.ct")}</span>
                      <input type="number" value={step.cycle_time_sec || ""} onChange={(e) => updateStep(idx, "cycle_time_sec", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-brand-500 transition" />
                      <span className="text-th-text-3">s</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.co")}</span>
                      <input type="number" value={step.changeover_time_min || ""} onChange={(e) => updateStep(idx, "changeover_time_min", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-brand-500 transition" />
                      <span className="text-th-text-3">m</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.upPct")}</span>
                      <input type="number" value={step.uptime_pct || ""} onChange={(e) => updateStep(idx, "uptime_pct", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-brand-500 transition" />
                      <span className="text-th-text-3">%</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.batchSize")}</span>
                      <input type="number" value={step.batch_size || ""} onChange={(e) => updateStep(idx, "batch_size", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-brand-500 transition" />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.ops")}</span>
                      <input type="number" value={step.operators || ""} onChange={(e) => updateStep(idx, "operators", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-brand-500 transition" />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.wip")}</span>
                      <input type="number" value={step.wip_before || ""} onChange={(e) => updateStep(idx, "wip_before", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-brand-500 transition" />
                    </label>
                    <label className="flex items-center gap-1 col-span-2">
                      <span className="text-th-text-3 w-7 font-semibold">{t("improvement.waitHours")}</span>
                      <input type="number" value={step.wait_time_hours || ""} onChange={(e) => updateStep(idx, "wait_time_hours", Number(e.target.value))}
                        className="w-12 bg-transparent border-b border-th-border outline-none text-th-text text-right focus:border-brand-500 transition" />
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
                className="w-28 h-[140px] border-2 border-dashed border-brand-400/50 dark:border-brand-600/50 rounded-xl flex flex-col items-center justify-center text-brand-500 hover:bg-brand-500/5 dark:hover:bg-brand-950/20 transition"
              >
                <span className="text-2xl leading-none">+</span>
                <span className="text-xs mt-1 font-medium">{t("improvement.addStep")}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center mt-14"><FlowArrow /></div>

          {/* ── Customer ── */}
          <div className="flex flex-col items-center shrink-0">
            <div className="mb-1 h-5 flex items-center">
              <div className="text-[9px] text-blue-500 dark:text-blue-400 flex items-center gap-0.5">
                <span>Order</span>
                <span>&darr;</span>
              </div>
            </div>
            <div className="w-28 bg-gradient-to-br from-emerald-500/10 to-green-500/10 dark:from-emerald-950/30 dark:to-green-950/30 rounded-xl p-3 border-2 border-dashed border-emerald-400 dark:border-emerald-700 text-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-1 text-emerald-600 dark:text-emerald-400">
                <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 16 0v1" />
              </svg>
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{t("improvement.customer")}</div>
              {customerDemand > 0 && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400">{customerDemand}/day</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════ TIMELINE BAR ════════════════════ */}
      <div className="bg-th-bg-2 rounded-2xl p-5 shadow-card border border-th-border backdrop-blur-sm">
        <h3 className="font-bold text-th-text text-xs mb-4 uppercase tracking-wider">{t("improvement.timeline")}</h3>

        <div className="flex items-end gap-0 w-full overflow-x-auto pb-2">
          {steps.map((step, idx) => {
            const barH = 80;
            return (
              <div key={idx} className="flex flex-col items-center flex-1 min-w-[60px]">
                <div className="flex gap-0.5 items-end" style={{ height: barH }}>
                  <div
                    className="w-4 bg-gradient-to-t from-lean-red/60 to-lean-red/40 rounded-t transition-all"
                    style={{ height: `${(step.wait_time_hours / maxWait) * barH}px` }}
                    title={`${t("improvement.waitHours")}: ${step.wait_time_hours}h`}
                  />
                  <div
                    className="w-4 bg-gradient-to-t from-lean-green/70 to-lean-green/50 rounded-t transition-all"
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
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="text-th-text-3 font-semibold uppercase tracking-wider text-[10px]">{t("improvement.valueAdd")}</div>
            <div className="font-black text-lean-green mt-1">{(m.totalValueAddSec / 60).toFixed(1)} min</div>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
            <div className="text-th-text-3 font-semibold uppercase tracking-wider text-[10px]">{t("improvement.nonValueAdd")}</div>
            <div className="font-black text-lean-red mt-1">{m.totalWaitHrs.toFixed(1)} hrs</div>
          </div>
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center">
            <div className="text-th-text-3 font-semibold uppercase tracking-wider text-[10px]">{t("improvement.changeover")}</div>
            <div className="font-black text-lean-orange mt-1">{(m.totalChangeoverSec / 60).toFixed(1)} min</div>
          </div>
        </div>
      </div>
    </div>
  );
}
