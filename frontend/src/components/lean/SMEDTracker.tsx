"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { leanApi, adminApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import {
  RefreshCw,
  Clock,
  Timer,
  ArrowRightLeft,
  CheckCircle,
  Play,
  TrendingDown,
  BarChart3,
  Plus,
  ChevronUp,
  ChevronDown,
  X,
  AlertTriangle,
  Save,
  Loader2,
  Lightbulb,
  Target,
  Gauge,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend,
} from "recharts";

/* ─── Types ──────────────────────────────────────────────────────────── */

interface SMEDStep {
  id: string;
  order: number;
  description: string;
  duration_seconds: number;
  phase: "internal" | "external";
  can_be_externalized: boolean;
  improvement_notes: string;
}

interface LineOption {
  id: number;
  name: string;
}

interface SmedPotential {
  current_changeover_minutes: number;
  projected_changeover_minutes: number;
  reduction_percent: number;
  suggestions: string[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

let _idCounter = 0;
const uid = () => `step-${Date.now()}-${++_idCounter}`;

const fmtSeconds = (s: number): string => {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
};

const fmtMinutes = (s: number): string => {
  const m = (s / 60).toFixed(1);
  return `${m}m`;
};

const pct = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 100) : 0;

/* Demo step/line builders removed — component relies on API data */

/* ─── Component ──────────────────────────────────────────────────────── */

export default function SMEDTracker() {
  const { t } = useI18n();
  const { printView, exportToExcel, exportToCSV } = useExport();

  /* ── Factory / Lines ── */
  const [lines, setLines] = useState<LineOption[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<number>(1);
  const [linesLoading, setLinesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLinesLoading(true);
      try {
        const res = await adminApi.getFactory();
        const data = res.data;
        const apiLines: LineOption[] =
          (data?.lines ?? data?.production_lines ?? []).map((l: any) => ({
            id: l.id,
            name: l.name,
          }));
        if (!cancelled && apiLines.length > 0) {
          setLines(apiLines);
          setSelectedLineId(apiLines[0].id);
        }
      } catch {
        /* API unavailable — lines remain empty */
      } finally {
        if (!cancelled) setLinesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  /* ── Core state ── */
  const [changeoverName, setChangeoverName] = useState("");
  const [baselineSeconds, setBaselineSeconds] = useState(1200);
  const [targetSeconds, setTargetSeconds] = useState(600);
  const [steps, setSteps] = useState<SMEDStep[]>([]);
  /* isDemo state removed — no more demo fallbacks */

  /* ── API state ── */
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [potential, setPotential] = useState<SmedPotential | null>(null);
  const [potentialLoading, setPotentialLoading] = useState(false);

  /* ── Derived metrics ── */
  const metrics = useMemo(() => {
    const internalSteps = steps.filter((s) => s.phase === "internal");
    const externalSteps = steps.filter((s) => s.phase === "external");
    const convertible = internalSteps.filter((s) => s.can_be_externalized);

    const internalSec = internalSteps.reduce((a, s) => a + s.duration_seconds, 0);
    const externalSec = externalSteps.reduce((a, s) => a + s.duration_seconds, 0);
    const convertibleSec = convertible.reduce((a, s) => a + s.duration_seconds, 0);
    const totalSec = internalSec + externalSec;
    const projectedInternalSec = internalSec - convertibleSec;

    const internalPct = pct(internalSec, totalSec);
    const externalPct = pct(externalSec, totalSec);
    const reductionPct = pct(convertibleSec, internalSec);

    return {
      totalSec,
      internalSec,
      externalSec,
      convertibleSec,
      projectedInternalSec,
      internalPct,
      externalPct,
      reductionPct,
      internalCount: internalSteps.length,
      externalCount: externalSteps.length,
      convertibleCount: convertible.length,
    };
  }, [steps]);

  /* ── Step CRUD ── */
  const addStep = useCallback(() => {
    setSteps((prev) => [
      ...prev,
      {
        id: uid(),
        order: prev.length + 1,
        description: "",
        duration_seconds: 60,
        phase: "internal",
        can_be_externalized: false,
        improvement_notes: "",
      },
    ]);
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i + 1 }))
    );
  }, []);

  const updateStep = useCallback(
    (id: string, field: keyof SMEDStep, value: string | number | boolean) => {
      setSteps((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const updated = { ...s, [field]: value };
          if (field === "phase" && value === "external") {
            updated.can_be_externalized = false;
            updated.improvement_notes = "";
          }
          return updated;
        })
      );
    },
    []
  );

  const moveStep = useCallback((id: string, direction: "up" | "down") => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  }, []);

  /* ── Save to API ── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const payload = {
      name: changeoverName || "Untitled Changeover",
      line_id: selectedLineId,
      baseline_seconds: baselineSeconds,
      target_seconds: targetSeconds,
      steps: steps.map(({ id: _id, ...rest }) => rest),
    };

    try {
      const res = await leanApi.createSmed(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);

      const savedId = res?.data?.id;
      if (savedId) {
        setPotentialLoading(true);
        try {
          const potRes = await leanApi.getSmedPotential(savedId);
          setPotential(potRes?.data ?? null);
        } catch {
          setPotential(buildLocalPotential());
        } finally {
          setPotentialLoading(false);
        }
      }
    } catch (err: any) {
      console.error("SMED save failed", err);
      setSaveError(err?.message || t("common.saveFailed"));
      setPotential(buildLocalPotential());
    } finally {
      setSaving(false);
    }
  }, [changeoverName, selectedLineId, baselineSeconds, targetSeconds, steps, t, metrics]);

  const buildLocalPotential = useCallback(
    (): SmedPotential => ({
      current_changeover_minutes: Math.round(metrics.internalSec / 60),
      projected_changeover_minutes: Math.round(metrics.projectedInternalSec / 60),
      reduction_percent: metrics.reductionPct,
      suggestions: [
        t("improvement.smedSuggestion1"),
        t("improvement.smedSuggestion2"),
      ],
    }),
    [metrics, t]
  );

  /* ── Recharts data ── */
  const ganttData = useMemo(() => {
    return steps.map((step) => ({
      name: step.description || `#${step.order}`,
      duration: step.duration_seconds,
      phase: step.phase,
      canExternalize: step.can_be_externalized,
    }));
  }, [steps]);

  const beforeAfterData = useMemo(() => {
    return [
      { name: t("improvement.before"), internal: metrics.internalSec, external: metrics.externalSec },
      { name: t("improvement.after"), internal: metrics.projectedInternalSec, external: metrics.externalSec + metrics.convertibleSec },
    ];
  }, [metrics, t]);

  /* ── Start fresh analysis ── */
  const startNewAnalysis = useCallback(() => {
    setSteps([{
      id: uid(),
      order: 1,
      description: "",
      duration_seconds: 60,
      phase: "internal",
      can_be_externalized: false,
      improvement_notes: "",
    }]);
    setChangeoverName("");
    setPotential(null);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  /* ── Render ── */

  /* Empty state */
  if (steps.length === 0) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true">
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-10 text-center">
          <RefreshCw className="w-10 h-10 text-th-text-3 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-th-text mb-2">
            {t("improvement.smedTitle")}
          </h3>
          <p className="text-sm text-th-text-2 mb-8 max-w-md mx-auto">
            {t("improvement.smedSubtitle")}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={startNewAnalysis}
              className="bg-th-brand text-white px-6 py-3 rounded-lg hover:opacity-90 transition font-semibold flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {t("improvement.startNewAnalysis") || "Start New Analysis"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true">
      {/* ── Header & Config Card ── */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h3 className="text-lg font-bold mb-1 text-th-text flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-th-text-2" />
              {t("improvement.smedTitle")}
            </h3>
            <p className="text-sm text-th-text-2">
              {t("improvement.smedSubtitle")}
            </p>
          </div>
          <ExportToolbar
            onPrint={() => printView({ title: t("improvement.smedTitle") || "SMED Tracker", subtitle: changeoverName })}
            onExportExcel={() => exportToExcel({
              filename: `smed_${changeoverName || "changeover"}`,
              sheetName: "SMED",
              columns: [
                { key: "order", header: "#", width: 5 },
                { key: "description", header: t("improvement.stepDescription") || "Step", width: 30 },
                { key: "phase", header: t("improvement.phase") || "Phase", width: 12 },
                { key: "duration", header: t("improvement.duration") || "Duration", width: 12, format: (v: number) => fmtSeconds(v) },
                { key: "canExternalize", header: t("improvement.canExternalize") || "Can Externalize", width: 15 },
                { key: "notes", header: t("improvement.improvementNotes") || "Improvement Notes", width: 30 },
              ],
              rows: steps.map((s) => ({
                order: s.order,
                description: s.description,
                phase: s.phase,
                duration: s.duration_seconds,
                canExternalize: s.can_be_externalized ? "Yes" : "No",
                notes: s.improvement_notes,
              })),
              headerRows: [
                [t("improvement.changeoverName") || "Changeover", changeoverName],
                [t("improvement.totalTime") || "Total Time", fmtSeconds(metrics.totalSec)],
              ],
            })}
            onExportCSV={() => exportToCSV({
              filename: `smed_${changeoverName || "changeover"}`,
              columns: [
                { key: "order", header: "#" },
                { key: "description", header: t("improvement.stepDescription") || "Step" },
                { key: "phase", header: t("improvement.phase") || "Phase" },
                { key: "duration", header: t("improvement.duration") || "Duration", format: (v: number) => fmtSeconds(v) },
                { key: "canExternalize", header: t("improvement.canExternalize") || "Can Externalize" },
                { key: "notes", header: t("improvement.improvementNotes") || "Improvement Notes" },
              ],
              rows: steps.map((s) => ({
                order: s.order,
                description: s.description,
                phase: s.phase,
                duration: s.duration_seconds,
                canExternalize: s.can_be_externalized ? "Yes" : "No",
                notes: s.improvement_notes,
              })),
            })}
          />
        </div>

        {/* Changeover name + Line selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-th-text-2 mb-1.5 uppercase tracking-wider">
              {t("improvement.changeoverName")}
            </label>
            <input
              type="text"
              value={changeoverName}
              onChange={(e) => setChangeoverName(e.target.value)}
              className="w-full px-3 py-2 border border-th-border rounded-lg bg-th-input text-th-text placeholder:text-th-text-3 focus:ring-2 focus:ring-th-brand outline-none transition"
              placeholder={t("improvement.changeoverName")}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-th-text-2 mb-1.5 uppercase tracking-wider">
              {t("improvement.productionLine")}
            </label>
            <select
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(Number(e.target.value))}
              disabled={linesLoading}
              className="w-full px-3 py-2 border border-th-border rounded-lg bg-th-input text-th-text disabled:opacity-50 focus:ring-2 focus:ring-th-brand outline-none transition"
            >
              {lines.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Baseline / Target time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-th-text-2 mb-1.5 uppercase tracking-wider">
              {t("improvement.baselineTime")} (s)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={baselineSeconds}
              onChange={(e) => setBaselineSeconds(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 border border-th-border rounded-lg bg-th-input text-th-text focus:ring-2 focus:ring-th-brand outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-th-text-2 mb-1.5 uppercase tracking-wider">
              {t("improvement.targetTime")} (s)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={targetSeconds}
              onChange={(e) => setTargetSeconds(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 border border-th-border rounded-lg bg-th-input text-th-text focus:ring-2 focus:ring-th-brand outline-none transition"
            />
          </div>
        </div>

        {/* ── SMED Stage 0-3 Guide ── */}
        <div className="mb-6 p-4 rounded-xl border border-th-border bg-th-bg-3/50">
          <h4 className="text-xs font-bold text-th-text-2 mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" />
            {t("improvement.smedStagesGuide")}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {([
              { num: 0, color: "bg-slate-500", border: "border-slate-500/20", text: "text-slate-600 dark:text-slate-400" },
              { num: 1, color: "bg-blue-500", border: "border-blue-500/20", text: "text-blue-600 dark:text-blue-400" },
              { num: 2, color: "bg-amber-500", border: "border-amber-500/20", text: "text-amber-600 dark:text-amber-400" },
              { num: 3, color: "bg-emerald-500", border: "border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
            ] as const).map((stage) => (
              <div key={stage.num} className={`flex items-start gap-3 p-3 rounded-lg border ${stage.border} bg-th-bg-2`}>
                <div className={`w-7 h-7 rounded-full ${stage.color} text-white flex items-center justify-center text-xs font-black shrink-0`}>
                  {stage.num}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${stage.text}`}>
                    {t(`improvement.smedStage${stage.num}Title`)}
                  </p>
                  <p className="text-[10px] text-th-text-3 mt-0.5 leading-tight">
                    {t(`improvement.smedStage${stage.num}Desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <SummaryCard icon={<Clock className="w-4 h-4" />} label={t("improvement.baselineTime")} value={fmtSeconds(baselineSeconds)} sub={fmtMinutes(baselineSeconds)} color="gray" />
          <SummaryCard icon={<Timer className="w-4 h-4" />} label={t("improvement.currentTime")} value={fmtSeconds(metrics.totalSec)} sub={`${metrics.internalCount + metrics.externalCount} ${t("improvement.steps")}`} color="blue" />
          <SummaryCard icon={<Target className="w-4 h-4" />} label={t("improvement.targetTime")} value={fmtSeconds(targetSeconds)} sub={fmtMinutes(targetSeconds)} color="green" />
          <SummaryCard icon={<TrendingDown className="w-4 h-4" />} label={t("improvement.potentialReduction")} value={`${metrics.reductionPct}%`} sub={`${fmtSeconds(metrics.internalSec)} → ${fmtSeconds(metrics.projectedInternalSec)}`} color="brand" />
        </div>

        {/* ── Internal / External / Conversion Visual Summary ── */}
        {steps.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-th-border bg-th-bg-3/50">
            <h4 className="text-xs font-bold text-th-text-2 mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              {t("improvement.externalizationSummary") || "Externalization Summary"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              {/* Total Internal */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="w-3 h-10 rounded bg-blue-500" />
                <div>
                  <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">{t("improvement.totalInternal") || "Total Internal"}</p>
                  <p className="text-lg font-black text-blue-600 dark:text-blue-400">{fmtSeconds(metrics.internalSec)}</p>
                  <p className="text-[10px] text-th-text-3">{metrics.internalCount} {t("improvement.steps")} &middot; {metrics.internalPct}%</p>
                </div>
              </div>
              {/* Total External */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-3 h-10 rounded bg-emerald-500" />
                <div>
                  <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">{t("improvement.totalExternal") || "Total External"}</p>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{fmtSeconds(metrics.externalSec)}</p>
                  <p className="text-[10px] text-th-text-3">{metrics.externalCount} {t("improvement.steps")} &middot; {metrics.externalPct}%</p>
                </div>
              </div>
              {/* Conversion Ratio */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="w-3 h-10 rounded bg-orange-500" />
                <div>
                  <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">{t("improvement.conversionRatio") || "Conversion Ratio"}</p>
                  <p className="text-lg font-black text-orange-600 dark:text-orange-400">{metrics.reductionPct}%</p>
                  <p className="text-[10px] text-th-text-3">{metrics.convertibleCount} {t("improvement.canExternalize")} &middot; {fmtSeconds(metrics.convertibleSec)}</p>
                </div>
              </div>
            </div>
            {/* Stacked bar showing proportions */}
            {metrics.totalSec > 0 && (
              <div className="space-y-1.5">
                <div className="h-4 rounded-full overflow-hidden flex">
                  {/* Must-remain internal (red) */}
                  {(metrics.internalSec - metrics.convertibleSec) > 0 && (
                    <div
                      className="h-full bg-red-500/80 transition-all duration-500"
                      style={{ width: `${pct(metrics.internalSec - metrics.convertibleSec, metrics.totalSec)}%` }}
                      title={`${t("improvement.mustRemainInternal") || "Must remain internal"}: ${fmtSeconds(metrics.internalSec - metrics.convertibleSec)}`}
                    />
                  )}
                  {/* Can be externalized (amber) */}
                  {metrics.convertibleSec > 0 && (
                    <div
                      className="h-full bg-amber-500/80 transition-all duration-500"
                      style={{ width: `${pct(metrics.convertibleSec, metrics.totalSec)}%` }}
                      title={`${t("improvement.canExternalize")}: ${fmtSeconds(metrics.convertibleSec)}`}
                    />
                  )}
                  {/* Already external (green) */}
                  {metrics.externalSec > 0 && (
                    <div
                      className="h-full bg-emerald-500/80 transition-all duration-500"
                      style={{ width: `${pct(metrics.externalSec, metrics.totalSec)}%` }}
                      title={`${t("improvement.external")}: ${fmtSeconds(metrics.externalSec)}`}
                    />
                  )}
                </div>
                <div className="flex gap-4 text-[10px] text-th-text-3 font-medium">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500/80 inline-block" />{t("improvement.mustRemainInternal") || "Must remain internal"}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500/80 inline-block" />{t("improvement.canExternalize")}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/80 inline-block" />{t("improvement.external")}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Gantt-style Step Chart with Recharts ── */}
        {ganttData.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-bold text-th-text-2 mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              {t("improvement.timeBreakdown")}
            </h4>
            <ResponsiveContainer width="100%" height={Math.max(ganttData.length * 36 + 50, 180)}>
              <BarChart data={ganttData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" strokeOpacity={0.15} horizontal={false} />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => fmtSeconds(v)} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-primary)', borderRadius: '8px', fontSize: 12, color: 'var(--text-primary)' }}
                  labelStyle={{ color: "var(--text-secondary)" }}
                  formatter={(value: number, _name: string, entry: any) => [
                    fmtSeconds(value),
                    entry.payload.phase === "internal" ? t("improvement.internal") : t("improvement.external"),
                  ]}
                />
                <Bar dataKey="duration" radius={[0, 6, 6, 0]} maxBarSize={24}>
                  {ganttData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.phase === "external"
                          ? "#10b981"
                          : entry.canExternalize
                          ? "#f97316"
                          : "#3b82f6"
                      }
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex gap-4 mt-2 text-xs text-th-text-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
                {t("improvement.internal")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-orange-500 inline-block" />
                {t("improvement.canExternalize")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                {t("improvement.external")}
              </span>
            </div>
          </div>
        )}

        {/* ── Before/After Comparison Chart ── */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-th-text-2 mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" />
            {t("improvement.potentialSavings")}
          </h4>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={beforeAfterData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" strokeOpacity={0.15} horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => fmtSeconds(v)} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }} width={60} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-primary)', borderRadius: '8px', fontSize: 12, color: 'var(--text-primary)' }}
                formatter={(value: number) => [fmtSeconds(value)]}
              />
              <Bar dataKey="internal" stackId="a" fill="#3b82f6" fillOpacity={0.8} radius={[0, 0, 0, 0]} name={t("improvement.internal")} />
              <Bar dataKey="external" stackId="a" fill="#10b981" fillOpacity={0.8} radius={[0, 6, 6, 0]} name={t("improvement.external")} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
            </BarChart>
          </ResponsiveContainer>

          {/* Savings highlight */}
          {metrics.reductionPct > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center flex items-center justify-center gap-2">
              <TrendingDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                -{metrics.reductionPct}%
              </span>
              <span className="text-sm text-emerald-700 dark:text-emerald-400">
                {t("improvement.potentialReduction")} ({fmtSeconds(metrics.convertibleSec)} {t("improvement.canExternalize")})
              </span>
            </div>
          )}
        </div>

        {/* ── Steps Analysis Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-th-text-3 border-b border-th-border">
                <th className="pb-2 w-10 text-xs font-semibold uppercase tracking-wider">#</th>
                <th className="pb-2 text-xs font-semibold uppercase tracking-wider">{t("improvement.step")}</th>
                <th className="pb-2 w-28 text-xs font-semibold uppercase tracking-wider">{t("improvement.duration")} (s)</th>
                <th className="pb-2 w-32 text-xs font-semibold uppercase tracking-wider">{t("improvement.phase")}</th>
                <th className="pb-2 w-24 text-center text-xs font-semibold uppercase tracking-wider">{t("improvement.externalizable")}</th>
                <th className="pb-2 text-xs font-semibold uppercase tracking-wider">{t("improvement.improvementNotes")}</th>
                <th className="pb-2 w-20 text-center text-xs font-semibold uppercase tracking-wider">{t("improvement.reorder")}</th>
                <th className="pb-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {steps.map((step, idx) => {
                const rowBg =
                  step.phase === "external"
                    ? "bg-emerald-500/8 border-l-2 border-l-emerald-500"
                    : step.can_be_externalized
                    ? "bg-amber-500/8 border-l-2 border-l-amber-500"
                    : step.phase === "internal"
                    ? "bg-red-500/5 border-l-2 border-l-red-400/50"
                    : idx % 2 === 1
                    ? "bg-th-bg-3/50"
                    : "";
                const phaseBadge =
                  step.phase === "internal"
                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30";

                return (
                  <tr key={step.id} className={`border-b border-th-border/50 ${rowBg} hover:bg-th-bg-3/50 transition`}>
                    <td className="py-2.5 text-th-text-3 font-mono text-xs">{idx + 1}</td>
                    <td className="py-2.5 pr-2">
                      <input
                        type="text"
                        value={step.description}
                        onChange={(e) => updateStep(step.id, "description", e.target.value)}
                        className="w-full px-2 py-1.5 border border-th-border rounded-lg bg-th-input text-th-text text-sm focus:ring-2 focus:ring-th-brand outline-none transition"
                        placeholder={t("improvement.stepDescription")}
                      />
                    </td>
                    <td className="py-2.5 pr-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={step.duration_seconds}
                        onChange={(e) => updateStep(step.id, "duration_seconds", Math.max(0, Number(e.target.value)))}
                        className="w-full px-2 py-1.5 border border-th-border rounded-lg bg-th-input text-th-text text-sm text-right focus:ring-2 focus:ring-th-brand outline-none transition"
                      />
                    </td>
                    <td className="py-2.5 pr-2">
                      <select
                        value={step.phase}
                        onChange={(e) => updateStep(step.id, "phase", e.target.value as "internal" | "external")}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs font-semibold ${phaseBadge}`}
                      >
                        <option value="internal">{t("improvement.internal")}</option>
                        <option value="external">{t("improvement.external")}</option>
                      </select>
                    </td>
                    <td className="py-2.5 text-center">
                      {step.phase === "internal" ? (
                        <input
                          type="checkbox"
                          checked={step.can_be_externalized}
                          onChange={() => updateStep(step.id, "can_be_externalized", !step.can_be_externalized)}
                          className="w-4 h-4 accent-orange-500 rounded"
                        />
                      ) : (
                        <span className="text-th-text-3">-</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-2">
                      <input
                        type="text"
                        value={step.improvement_notes}
                        onChange={(e) => updateStep(step.id, "improvement_notes", e.target.value)}
                        className="w-full px-2 py-1.5 border border-th-border rounded-lg bg-th-input text-th-text text-sm focus:ring-2 focus:ring-th-brand outline-none transition"
                        placeholder={step.can_be_externalized ? t("improvement.howToConvert") : t("improvement.improvementNotes")}
                      />
                    </td>
                    <td className="py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => moveStep(step.id, "up")} disabled={idx === 0} className="text-th-text-3 hover:text-th-text disabled:opacity-30 disabled:cursor-not-allowed p-0.5" title={t("improvement.moveUp")} aria-label={t("improvement.moveUp")}>
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button onClick={() => moveStep(step.id, "down")} disabled={idx === steps.length - 1} className="text-th-text-3 hover:text-th-text disabled:opacity-30 disabled:cursor-not-allowed p-0.5" title={t("improvement.moveDown")} aria-label={t("improvement.moveDown")}>
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 text-center">
                      <button onClick={() => removeStep(step.id)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-0.5" title={t("common.remove")} aria-label={t("common.remove")}>
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button onClick={addStep} className="mt-3 text-sm text-th-text-2 hover:text-th-text font-semibold flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          {t("improvement.addStep")}
        </button>

        {/* ── Save Actions ── */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleSave}
            disabled={saving || steps.length === 0}
            className="bg-th-brand text-white px-6 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("common.saving")}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t("improvement.saveSmedAnalysis")}
              </>
            )}
          </button>
          {saveSuccess && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 animate-slide-in">
              <CheckCircle className="w-4 h-4" />
              {t("common.saved")}
            </span>
          )}
          {saveError && (
            <span className="text-sm text-red-600 dark:text-red-400">{saveError}</span>
          )}
        </div>
      </div>

      {/* ── Improvement Potential Panel ── */}
      {(potential || potentialLoading) && (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
          <h4 className="text-xs font-bold text-th-text-2 mb-4 uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5" />
            {t("improvement.potentialAnalysis")}
          </h4>

          {potentialLoading ? (
            <div className="flex items-center gap-2 text-sm text-th-text-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t("common.loading")}</span>
            </div>
          ) : potential ? (
            <div className="space-y-5">
              {/* Potential summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-xl border border-th-border bg-blue-500/10">
                  <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">{t("improvement.currentChangeover")}</p>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                    {potential.current_changeover_minutes}m
                  </p>
                </div>
                <div className="text-center p-4 rounded-xl border border-th-border bg-emerald-500/10">
                  <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">{t("improvement.projectedChangeover")}</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {potential.projected_changeover_minutes}m
                  </p>
                </div>
                <div className="text-center p-4 rounded-xl border border-th-border bg-th-brand/10">
                  <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">{t("improvement.reduction")}</p>
                  <p className="text-2xl font-black text-th-text mt-1">
                    {potential.reduction_percent}%
                  </p>
                </div>
              </div>

              {/* Reduction bar */}
              <div>
                <div className="flex justify-between text-xs text-th-text-3 mb-1 font-medium">
                  <span>{t("improvement.before")}</span>
                  <span>{t("improvement.after")}</span>
                </div>
                <div className="h-4 bg-blue-500/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                    style={{
                      width: `${
                        potential.current_changeover_minutes > 0
                          ? (potential.projected_changeover_minutes / potential.current_changeover_minutes) * 100
                          : 100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Suggestions */}
              {potential.suggestions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-th-text-2 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" />
                    {t("improvement.suggestions")}
                  </p>
                  <ul className="space-y-1.5">
                    {potential.suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-th-text-2 flex gap-2 items-start">
                        <CheckCircle className="w-3.5 h-3.5 text-th-text-3 mt-0.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Conversion Opportunities Panel ── */}
      {steps.some((s) => s.phase === "internal" && s.can_be_externalized) && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 shadow-sm p-6">
          <h4 className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            {t("improvement.conversionOpportunities")}
          </h4>
          <div className="space-y-2">
            {steps
              .filter((s) => s.phase === "internal" && s.can_be_externalized)
              .map((step) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-th-bg-2 border border-th-border"
                >
                  <ArrowRightLeft className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-th-text">
                      {step.description}{" "}
                      <span className="text-th-text-3">({fmtSeconds(step.duration_seconds)})</span>
                    </p>
                    {step.improvement_notes && (
                      <p className="text-xs text-th-text-2 mt-0.5">{step.improvement_notes}</p>
                    )}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                    {t("improvement.internal")}
                  </span>
                  <ArrowRight className="w-4 h-4 text-th-text-3 shrink-0" />
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {t("improvement.external")}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function SummaryCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: "gray" | "blue" | "green" | "brand";
}) {
  const bg: Record<string, string> = {
    gray: "bg-th-bg-3 border-th-border",
    blue: "bg-blue-500/10 border-blue-500/20",
    green: "bg-emerald-500/10 border-emerald-500/20",
    brand: "bg-th-brand/10 border-th-border",
  };
  const text: Record<string, string> = {
    gray: "text-th-text-2",
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-emerald-600 dark:text-emerald-400",
    brand: "text-th-text",
  };

  return (
    <div className={`text-center p-4 rounded-xl border ${bg[color]}`}>
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <span className="text-th-text-3">{icon}</span>
        <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">{label}</p>
      </div>
      <p className={`text-xl font-black ${text[color]}`}>{value}</p>
      <p className="text-[11px] text-th-text-3 mt-0.5">{sub}</p>
    </div>
  );
}
