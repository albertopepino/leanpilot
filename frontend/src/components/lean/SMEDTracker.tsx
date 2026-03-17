"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { leanApi, adminApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
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

function buildDemoSteps(t: (k: string) => string): SMEDStep[] {
  return [
    { id: uid(), order: 1, description: t("improvement.smedStop"), duration_seconds: 60, phase: "internal", can_be_externalized: false, improvement_notes: "" },
    { id: uid(), order: 2, description: t("improvement.smedRemove"), duration_seconds: 180, phase: "internal", can_be_externalized: false, improvement_notes: "" },
    { id: uid(), order: 3, description: t("improvement.smedClean"), duration_seconds: 120, phase: "internal", can_be_externalized: true, improvement_notes: "Can pre-clean while machine runs" },
    { id: uid(), order: 4, description: t("improvement.smedInstall"), duration_seconds: 240, phase: "internal", can_be_externalized: false, improvement_notes: "" },
    { id: uid(), order: 5, description: t("improvement.smedAdjust"), duration_seconds: 300, phase: "internal", can_be_externalized: false, improvement_notes: "" },
    { id: uid(), order: 6, description: t("improvement.smedPrepare"), duration_seconds: 180, phase: "external", can_be_externalized: false, improvement_notes: "" },
    { id: uid(), order: 7, description: t("improvement.smedTestRun"), duration_seconds: 120, phase: "internal", can_be_externalized: false, improvement_notes: "" },
  ];
}

const getDemoLines = (t: (k: string) => string): LineOption[] => [
  { id: 1, name: t("dashboard.demoLine1") },
  { id: 2, name: t("dashboard.demoLine2") },
];

/* ─── Component ──────────────────────────────────────────────────────── */

export default function SMEDTracker() {
  const { t } = useI18n();
  const { printView, exportToExcel, exportToCSV } = useExport();

  /* ── Factory / Lines ── */
  const [lines, setLines] = useState<LineOption[]>(() => getDemoLines(t));
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
        /* keep demo lines */
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
  const [isDemo, setIsDemo] = useState(false);

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

  /* ── Load demo data for quick-start ── */
  const loadDemoData = useCallback(() => {
    setSteps(buildDemoSteps(t));
    setIsDemo(true);
  }, [t]);

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
    setIsDemo(false);
    setChangeoverName("");
    setPotential(null);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  /* ── Render ── */

  /* Empty state */
  if (steps.length === 0) {
    return (
      <div className="space-y-6" data-print-area="true">
        <div className="bg-th-bg-2 p-10 rounded-2xl shadow-card border border-th-border text-center backdrop-blur-sm">
          <div className="text-5xl mb-4">{"\u23F1\uFE0F"}</div>
          <h3 className="text-xl font-bold text-th-text mb-2">
            {t("improvement.smedTitle")}
          </h3>
          <p className="text-sm text-th-text-2 mb-8 max-w-md mx-auto">
            {t("improvement.smedSubtitle")}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={startNewAnalysis}
              className="bg-gradient-to-r from-brand-600 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-brand-700 hover:to-blue-700 transition font-semibold shadow-glow"
            >
              {t("improvement.startNewAnalysis") || "Start New Analysis"}
            </button>
            <button
              onClick={loadDemoData}
              className="bg-th-bg-3 text-th-text-2 px-6 py-3 rounded-xl hover:bg-th-bg-3 border border-th-border transition font-semibold"
            >
              {t("improvement.loadDemoData") || "Load Demo Data"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-print-area="true">
      {/* ── Demo data banner ── */}
      {isDemo && (
        <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-sm backdrop-blur-sm">
          <span className="text-amber-700 dark:text-amber-400 font-medium">{"\u26A0\uFE0F"} {t("dashboard.demoDataBadge")} — {t("improvement.smedDemoHint") || "Demo data shown — create your first changeover analysis"}</span>
          <button onClick={startNewAnalysis} className="text-amber-600 dark:text-amber-400 hover:text-amber-800 font-semibold underline">
            {t("improvement.startNewAnalysis") || "Start New Analysis"}
          </button>
        </div>
      )}

      {/* ── Header & Config Card ── */}
      <div className="bg-th-bg-2 p-6 rounded-2xl shadow-card border border-th-border backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h3 className="text-lg font-bold mb-1 text-th-text flex items-center gap-2">
              {"\u23F1\uFE0F"} {t("improvement.smedTitle")}
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
              className="w-full px-3 py-2 border border-th-border rounded-xl bg-th-input text-th-text placeholder:text-th-text-3 focus:ring-2 focus:ring-brand-500 outline-none transition"
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
              className="w-full px-3 py-2 border border-th-border rounded-xl bg-th-input text-th-text disabled:opacity-50 focus:ring-2 focus:ring-brand-500 outline-none transition"
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
              min={0}
              value={baselineSeconds}
              onChange={(e) => setBaselineSeconds(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 border border-th-border rounded-xl bg-th-input text-th-text focus:ring-2 focus:ring-brand-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-th-text-2 mb-1.5 uppercase tracking-wider">
              {t("improvement.targetTime")} (s)
            </label>
            <input
              type="number"
              min={0}
              value={targetSeconds}
              onChange={(e) => setTargetSeconds(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 border border-th-border rounded-xl bg-th-input text-th-text focus:ring-2 focus:ring-brand-500 outline-none transition"
            />
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <SummaryCard label={t("improvement.baselineTime")} value={fmtSeconds(baselineSeconds)} sub={fmtMinutes(baselineSeconds)} color="gray" />
          <SummaryCard label={t("improvement.currentTime")} value={fmtSeconds(metrics.totalSec)} sub={`${metrics.internalCount + metrics.externalCount} ${t("improvement.steps")}`} color="blue" />
          <SummaryCard label={t("improvement.targetTime")} value={fmtSeconds(targetSeconds)} sub={fmtMinutes(targetSeconds)} color="green" />
          <SummaryCard label={t("improvement.potentialReduction")} value={`${metrics.reductionPct}%`} sub={`${fmtSeconds(metrics.internalSec)} \u2192 ${fmtSeconds(metrics.projectedInternalSec)}`} color="brand" />
        </div>

        {/* ── Gantt-style Step Chart with Recharts ── */}
        {ganttData.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-bold text-th-text-2 mb-3 uppercase tracking-wider">
              {t("improvement.timeBreakdown")}
            </h4>
            <ResponsiveContainer width="100%" height={Math.max(ganttData.length * 36 + 50, 180)}>
              <BarChart data={ganttData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" strokeOpacity={0.15} horizontal={false} />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => fmtSeconds(v)} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
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
          <h4 className="text-xs font-bold text-th-text-2 mb-3 uppercase tracking-wider">
            {t("improvement.potentialSavings")}
          </h4>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={beforeAfterData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" strokeOpacity={0.15} horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => fmtSeconds(v)} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }} width={60} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: 12 }}
                formatter={(value: number) => [fmtSeconds(value)]}
              />
              <Bar dataKey="internal" stackId="a" fill="#3b82f6" fillOpacity={0.8} radius={[0, 0, 0, 0]} name={t("improvement.internal")} />
              <Bar dataKey="external" stackId="a" fill="#10b981" fillOpacity={0.8} radius={[0, 6, 6, 0]} name={t("improvement.external")} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
            </BarChart>
          </ResponsiveContainer>

          {/* Savings highlight */}
          {metrics.reductionPct > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 text-center">
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                -{metrics.reductionPct}%
              </span>
              <span className="text-sm text-emerald-700 dark:text-emerald-400 ml-2">
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
                    ? "bg-emerald-500/5 dark:bg-emerald-500/5"
                    : step.can_be_externalized
                    ? "bg-orange-500/5 dark:bg-orange-500/5"
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
                        className="w-full px-2 py-1.5 border border-th-border rounded-lg bg-th-input text-th-text text-sm focus:ring-2 focus:ring-brand-500 outline-none transition"
                        placeholder={t("improvement.stepDescription")}
                      />
                    </td>
                    <td className="py-2.5 pr-2">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={step.duration_seconds}
                        onChange={(e) => updateStep(step.id, "duration_seconds", Math.max(0, Number(e.target.value)))}
                        className="w-full px-2 py-1.5 border border-th-border rounded-lg bg-th-input text-th-text text-sm text-right focus:ring-2 focus:ring-brand-500 outline-none transition"
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
                        className="w-full px-2 py-1.5 border border-th-border rounded-lg bg-th-input text-th-text text-sm focus:ring-2 focus:ring-brand-500 outline-none transition"
                        placeholder={step.can_be_externalized ? t("improvement.howToConvert") : t("improvement.improvementNotes")}
                      />
                    </td>
                    <td className="py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => moveStep(step.id, "up")} disabled={idx === 0} className="text-th-text-3 hover:text-th-text disabled:opacity-30 disabled:cursor-not-allowed text-sm leading-none px-1" title={t("improvement.moveUp")}>&#9650;</button>
                        <button onClick={() => moveStep(step.id, "down")} disabled={idx === steps.length - 1} className="text-th-text-3 hover:text-th-text disabled:opacity-30 disabled:cursor-not-allowed text-sm leading-none px-1" title={t("improvement.moveDown")}>&#9660;</button>
                      </div>
                    </td>
                    <td className="py-2.5 text-center">
                      <button onClick={() => removeStep(step.id)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-lg leading-none" title={t("common.remove")}>&times;</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button onClick={addStep} className="mt-3 text-sm text-brand-600 dark:text-brand-400 hover:underline font-semibold">
          + {t("improvement.addStep")}
        </button>

        {/* ── Save Actions ── */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleSave}
            disabled={saving || steps.length === 0}
            className="bg-gradient-to-r from-brand-600 to-blue-600 text-white px-6 py-2.5 rounded-xl hover:from-brand-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold shadow-glow flex items-center gap-2"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner />
                {t("common.saving")}
              </span>
            ) : (
              t("improvement.saveSmedAnalysis")
            )}
          </button>
          {saveSuccess && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium animate-slide-in">
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
        <div className="bg-th-bg-2 p-6 rounded-2xl shadow-card border border-th-border backdrop-blur-sm">
          <h4 className="text-xs font-bold text-th-text-2 mb-4 uppercase tracking-wider">
            {t("improvement.potentialAnalysis")}
          </h4>

          {potentialLoading ? (
            <div className="flex items-center gap-2 text-sm text-th-text-2">
              <Spinner />
              <span>{t("common.loading")}</span>
            </div>
          ) : potential ? (
            <div className="space-y-5">
              {/* Potential summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">{t("improvement.currentChangeover")}</p>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                    {potential.current_changeover_minutes}m
                  </p>
                </div>
                <div className="text-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">{t("improvement.projectedChangeover")}</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {potential.projected_changeover_minutes}m
                  </p>
                </div>
                <div className="text-center p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl">
                  <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">{t("improvement.reduction")}</p>
                  <p className="text-2xl font-black text-brand-600 dark:text-brand-400 mt-1">
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
                    className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-700"
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
                  <p className="text-xs font-semibold text-th-text-2 mb-2 uppercase tracking-wider">
                    {t("improvement.suggestions")}
                  </p>
                  <ul className="space-y-1.5">
                    {potential.suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-th-text-2 flex gap-2 items-start">
                        <span className="text-brand-500 mt-0.5 shrink-0">&#8227;</span>
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
        <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 dark:from-orange-950/30 dark:to-amber-950/30 p-6 rounded-2xl shadow-card border border-orange-500/20 dark:border-orange-700/40 backdrop-blur-sm">
          <h4 className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-3 uppercase tracking-wider">
            {t("improvement.conversionOpportunities")}
          </h4>
          <div className="space-y-2">
            {steps
              .filter((s) => s.phase === "internal" && s.can_be_externalized)
              .map((step) => (
                <div
                  key={step.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-th-bg-3 border border-orange-300/30 dark:border-orange-700/30"
                >
                  <span className="text-orange-600 dark:text-orange-400 text-lg leading-none mt-0.5">
                    &#x21C4;
                  </span>
                  <div className="flex-1">
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
                  <span className="text-th-text-3">&rarr;</span>
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

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: "gray" | "blue" | "green" | "brand";
}) {
  const gradients: Record<string, string> = {
    gray: "from-slate-500/10 to-gray-500/10 border-slate-500/20",
    blue: "from-blue-500/10 to-cyan-500/10 border-blue-500/20",
    green: "from-emerald-500/10 to-green-500/10 border-emerald-500/20",
    brand: "from-brand-500/10 to-purple-500/10 border-brand-500/20",
  };
  const text: Record<string, string> = {
    gray: "text-th-text-2",
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-emerald-600 dark:text-emerald-400",
    brand: "text-brand-600 dark:text-brand-400",
  };

  return (
    <div className={`text-center p-4 rounded-xl bg-gradient-to-br ${gradients[color]} border backdrop-blur-sm`}>
      <p className="text-[10px] text-th-text-3 uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-xl font-black ${text[color]} mt-1`}>{value}</p>
      <p className="text-[11px] text-th-text-3 mt-0.5">{sub}</p>
    </div>
  );
}
