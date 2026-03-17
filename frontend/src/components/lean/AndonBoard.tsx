"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi, adminApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";

/* -- types ----------------------------------------------------------------- */

type AndonStatus = "green" | "yellow" | "red" | "blue";
type Severity = "low" | "medium" | "high" | "critical";
type Category = "quality" | "equipment" | "material" | "safety" | "other";

interface AndonEvent {
  id: number;
  line_name: string;
  line_id?: number;
  status: AndonStatus;
  category?: Category;
  reason?: Category; // backend may use "reason" key
  severity?: Severity;
  description?: string;
  operator?: string;
  resolution_notes?: string;
  created_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
}

interface AndonKpis {
  avg_acknowledge_min: number;
  avg_resolve_min: number;
  open_count: number;
  today_total: number;
  escalated_count: number;
}

interface AndonStatusResponse {
  lines: AndonEvent[];
  kpis?: AndonKpis;
}

/* -- constants ------------------------------------------------------------- */

const STATUS_CFG: Record<
  AndonStatus,
  {
    labelKey: string;
    descKey: string;
    bg: string;
    text: string;
    glow: string;
    ring: string;
    lightColor: string;
    lightGlow: string;
    borderAccent: string;
  }
> = {
  green: {
    labelKey: "running",
    descKey: "runningDesc",
    bg: "bg-emerald-500",
    text: "text-white",
    glow: "shadow-[0_0_30px_rgba(16,185,129,0.5)]",
    ring: "ring-emerald-500",
    lightColor: "bg-emerald-400",
    lightGlow: "shadow-[0_0_40px_12px_rgba(16,185,129,0.6)]",
    borderAccent: "border-l-emerald-500",
  },
  yellow: {
    labelKey: "caution",
    descKey: "cautionDesc",
    bg: "bg-amber-400",
    text: "text-gray-900",
    glow: "shadow-[0_0_30px_rgba(245,158,11,0.5)]",
    ring: "ring-amber-400",
    lightColor: "bg-amber-400",
    lightGlow: "shadow-[0_0_40px_12px_rgba(245,158,11,0.6)]",
    borderAccent: "border-l-amber-400",
  },
  red: {
    labelKey: "stopped",
    descKey: "stoppedDesc",
    bg: "bg-red-500",
    text: "text-white",
    glow: "shadow-[0_0_30px_rgba(239,68,68,0.6)]",
    ring: "ring-red-500",
    lightColor: "bg-red-500",
    lightGlow: "shadow-[0_0_40px_12px_rgba(239,68,68,0.7)]",
    borderAccent: "border-l-red-500",
  },
  blue: {
    labelKey: "changeover",
    descKey: "changeoverDesc",
    bg: "bg-blue-500",
    text: "text-white",
    glow: "shadow-[0_0_30px_rgba(59,130,246,0.5)]",
    ring: "ring-blue-500",
    lightColor: "bg-blue-500",
    lightGlow: "shadow-[0_0_40px_12px_rgba(59,130,246,0.6)]",
    borderAccent: "border-l-blue-500",
  },
};

const SEVERITY_BADGE: Record<Severity, string> = {
  low: "bg-slate-500/10 text-th-text-2 border border-slate-500/20",
  medium: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  high: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  critical: "bg-red-500/10 text-red-400 border border-red-500/20",
};

const CATEGORY_ICONS: Record<Category, string> = {
  quality: "\u{1F50D}",
  equipment: "\u{2699}",
  material: "\u{1F4E6}",
  safety: "\u{26A0}",
  other: "\u{1F4CB}",
};

const ESCALATION_YELLOW_MIN = 15;
const ESCALATION_RED_MIN = 30;
const REFRESH_MS = 15_000;
const ELAPSED_TICK_MS = 30_000;

const EMPTY_KPIS: AndonKpis = {
  avg_acknowledge_min: 0,
  avg_resolve_min: 0,
  open_count: 0,
  today_total: 0,
  escalated_count: 0,
};

/* -- demo data ------------------------------------------------------------- */

const buildDemoEvents = (t: (k: string) => string): AndonEvent[] => {
  const now = Date.now();
  const ago = (m: number) => new Date(now - m * 60_000).toISOString();
  return [
    { id: 1, line_name: t("dashboard.demoLine1"), status: "green", created_at: ago(120) },
    {
      id: 2,
      line_name: t("dashboard.demoLine2"),
      status: "red",
      category: "equipment",
      severity: "high",
      description: t("dashboard.demoIssueJig"),
      operator: "Marco R.",
      created_at: ago(37),
    },
    {
      id: 3,
      line_name: t("dashboard.demoWeldA"),
      status: "yellow",
      category: "quality",
      severity: "medium",
      description: t("dashboard.demoIssueWire"),
      created_at: ago(18),
    },
    { id: 4, line_name: t("dashboard.demoWeldB"), status: "green", created_at: ago(90) },
    {
      id: 5,
      line_name: t("dashboard.demoPaint"),
      status: "blue",
      category: "other",
      severity: "low",
      description: t("dashboard.demoIssueChangeover"),
      created_at: ago(25),
    },
    { id: 6, line_name: t("dashboard.demoPackaging"), status: "green", created_at: ago(60) },
    { id: 7, line_name: t("dashboard.demoCNC"), status: "green", created_at: ago(45) },
    {
      id: 8,
      line_name: t("dashboard.demoQualityLab"),
      status: "yellow",
      category: "quality",
      severity: "medium",
      description: t("dashboard.demoIssueInspection"),
      created_at: ago(42),
    },
    {
      id: 9,
      line_name: t("dashboard.demoLine1"),
      status: "green",
      category: "material",
      severity: "low",
      description: t("dashboard.demoIssueChangeover"),
      resolved_at: ago(10),
      created_at: ago(95),
      resolution_notes: "Restocked from warehouse B",
    },
  ];
};

const DEMO_KPIS: AndonKpis = {
  avg_acknowledge_min: 3.2,
  avg_resolve_min: 18.5,
  open_count: 3,
  today_total: 7,
  escalated_count: 1,
};

/* -- helpers --------------------------------------------------------------- */

function elapsedMin(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

function fmtDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }
  return `${minutes}m`;
}

function resolutionMin(created: string, resolved: string): number {
  return Math.max(0, Math.floor((new Date(resolved).getTime() - new Date(created).getTime()) / 60_000));
}

function escalationTier(mins: number): "none" | "yellow" | "red" {
  if (mins >= ESCALATION_RED_MIN) return "red";
  if (mins >= ESCALATION_YELLOW_MIN) return "yellow";
  return "none";
}

function eventCategory(ev: AndonEvent): Category {
  return ev.category ?? ev.reason ?? "other";
}

function playAlertBeep() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = "square";
    osc1.frequency.value = 880;
    osc1.connect(gain);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.25);

    const osc2 = ctx.createOscillator();
    osc2.type = "square";
    osc2.frequency.value = 1100;
    osc2.connect(gain);
    osc2.start(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.6);

    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio unavailable -- silent fallback */
  }
}

/* -- CSS keyframes injected once ------------------------------------------- */

const STYLE_ID = "__andon-pulse-keyframes";
function ensurePulseStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes andon-pulse-ring {
      0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
      70%  { box-shadow: 0 0 0 12px rgba(239,68,68,0); }
      100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    }
    .andon-pulse-red {
      animation: andon-pulse-ring 1.5s ease-out infinite;
    }
    @keyframes andon-flash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    .andon-flash-new {
      animation: andon-flash 0.8s ease-in-out 3;
    }
    @keyframes andon-light-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.1); }
    }
    .andon-light-active {
      animation: andon-light-pulse 1.5s ease-in-out infinite;
    }
    @keyframes andon-border-glow {
      0%, 100% { border-color: rgba(239, 68, 68, 0.3); }
      50% { border-color: rgba(239, 68, 68, 0.8); }
    }
    .andon-border-pulse {
      animation: andon-border-glow 2s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

/* =========================================================================
   MAIN COMPONENT
   ========================================================================= */

export default function AndonBoard() {
  const { t } = useI18n();
  const { printView, exportToExcel, exportToCSV } = useExport();

  /* -- state -- */
  const [events, setEvents] = useState<AndonEvent[]>([]);
  const [kpis, setKpis] = useState<AndonKpis>(EMPTY_KPIS);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState("");

  const [soundOn, setSoundOn] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<AndonEvent | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // trigger form fields
  const [formLineId, setFormLineId] = useState<number>(0);
  const [formLine, setFormLine] = useState("");
  const [formCategory, setFormCategory] = useState<Category>("equipment");
  const [formSeverity, setFormSeverity] = useState<"red" | "yellow">("yellow");
  const [formDesc, setFormDesc] = useState("");
  const [productionLines, setProductionLines] = useState<{id: number; name: string}[]>([]);

  // force re-render for elapsed timers
  const [, setTick] = useState(0);

  const prevRedIds = useRef<Set<number>>(new Set());
  const newRedIds = useRef<Set<number>>(new Set());

  /* -- inject pulse CSS -- */
  useEffect(() => {
    ensurePulseStyles();
  }, []);

  /* -- fetch data -- */
  const fetchData = useCallback(async () => {
    try {
      const res = await advancedLeanApi.getAndonStatus();
      const raw: AndonStatusResponse = res.data ?? res;
      const lines: AndonEvent[] = Array.isArray(raw) ? raw : (raw.lines ?? []);
      if (lines.length === 0) throw new Error("empty");

      // detect new RED events for sound + flash
      const currentRedIds = new Set(
        lines.filter((e) => e.status === "red" && !e.resolved_at).map((e) => e.id),
      );
      const freshReds = new Set<number>();
      currentRedIds.forEach((id) => {
        if (!prevRedIds.current.has(id)) freshReds.add(id);
      });
      if (freshReds.size > 0 && soundOn) playAlertBeep();
      prevRedIds.current = currentRedIds;
      newRedIds.current = freshReds;
      // clear flash after 3s
      if (freshReds.size > 0) {
        setTimeout(() => {
          newRedIds.current = new Set();
        }, 3000);
      }

      setEvents(lines);
      if (raw.kpis) setKpis(raw.kpis);
      setIsDemo(false);
      setError(null);
    } catch {
      setEvents(buildDemoEvents(t));
      setKpis(DEMO_KPIS);
      setIsDemo(true);
      setError(null); // demo is a graceful fallback, not an error
    } finally {
      setLoading(false);
    }
  }, [t, soundOn]);

  /* -- effects -- */
  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(iv);
  }, [fetchData]);

  // real-time clock
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // elapsed timer tick
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), ELAPSED_TICK_MS);
    return () => clearInterval(iv);
  }, []);

  // load production lines for trigger form
  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.getFactory();
        const factory = res.data ?? res;
        const lines = factory?.production_lines ?? [];
        setProductionLines(lines);
        if (lines.length > 0 && formLineId === 0) setFormLineId(lines[0].id);
      } catch { /* ignore */ }
    })();
  }, []);

  /* -- handlers -- */
  const handleTrigger = async () => {
    if (!formLineId) return;
    setSubmitting(true);
    try {
      await advancedLeanApi.createAndonEvent({
        production_line_id: formLineId,
        reason: formCategory,
        status: formSeverity,
        description: formDesc.trim() || undefined,
      });
      setShowTriggerModal(false);
      setFormDesc("");
      setFormSeverity("yellow");
      setFormCategory("equipment");
      await fetchData();
    } catch {
      setError(t("dashboard.andonTriggerError"));
      setTimeout(() => setError(null), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setResolvingId(resolveTarget.id);
    try {
      await advancedLeanApi.resolveAndon(resolveTarget.id, resolveNotes || undefined);
      setResolveTarget(null);
      setResolveNotes("");
      await fetchData();
    } catch {
      setError(t("dashboard.andonResolveError"));
      setTimeout(() => setError(null), 4000);
    } finally {
      setResolvingId(null);
    }
  };

  /* -- derived data -- */
  const statusCounts: Record<AndonStatus, number> = { green: 0, yellow: 0, red: 0, blue: 0 };
  events.forEach((e) => {
    if (!e.resolved_at) statusCounts[e.status]++;
  });

  const activeEvents = useMemo(
    () =>
      events
        .filter((e) => e.status !== "green" && !e.resolved_at)
        .sort((a, b) => {
          const sa = a.severity === "critical" ? 0 : a.severity === "high" ? 1 : 2;
          const sb = b.severity === "critical" ? 0 : b.severity === "high" ? 1 : 2;
          if (sa !== sb) return sa - sb;
          return elapsedMin(b.created_at) - elapsedMin(a.created_at);
        }),
    [events],
  );

  const resolvedEvents = useMemo(
    () =>
      events
        .filter((e) => e.resolved_at)
        .sort((a, b) => new Date(b.resolved_at!).getTime() - new Date(a.resolved_at!).getTime()),
    [events],
  );

  const categoryStats = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach((e) => {
      if (e.status !== "green") {
        const cat = eventCategory(e);
        map[cat] = (map[cat] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [events]);

  const lineNames = useMemo(() => Array.from(new Set(events.map((e) => e.line_name))), [events]);

  const CATEGORIES: { key: Category; labelKey: string }[] = [
    { key: "quality", labelKey: "dashboard.andonReasonQuality" },
    { key: "equipment", labelKey: "dashboard.andonReasonBreakdown" },
    { key: "material", labelKey: "dashboard.andonReasonMaterial" },
    { key: "safety", labelKey: "dashboard.andonReasonSafety" },
    { key: "other", labelKey: "dashboard.andonReasonOther" },
  ];

  /* -- loading state -- */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin" />
            <div className="absolute inset-0 w-16 h-16 rounded-full bg-red-500/10 animate-pulse" />
          </div>
          <span className="text-sm font-medium text-th-text-2 uppercase tracking-wider">{t("dashboard.andonLoading")}</span>
        </div>
      </div>
    );
  }

  /* =========================================================================
     RENDER
     ========================================================================= */
  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-print-area="true" role="region" aria-label="Andon Board">
      {/* -- demo data banner -- */}
      {isDemo && (
        <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-sm backdrop-blur-sm">
          <span className="text-amber-600 dark:text-amber-400 font-medium">{"\u26A0\uFE0F"} {t("dashboard.demoDataBadge")} — {t("dashboard.usingDemoData")}</span>
          <button onClick={() => fetchData()} className="text-amber-500 hover:text-amber-300 font-semibold underline transition-colors duration-300">
            {t("dashboard.retry")}
          </button>
        </div>
      )}

      {/* -- error toast -- */}
      {error && (
        <div role="alert" aria-live="assertive" className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-between backdrop-blur-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-300 font-bold transition-colors">
            &times;
          </button>
        </div>
      )}

      {/* ======= CONTROL ROOM HEADER ======= */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-gray-900 to-slate-950 dark:from-slate-950 dark:via-gray-950 dark:to-black rounded-2xl p-6 text-white border border-th-border/50">
        {/* Subtle grid overlay for control room feel */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-red-500/20 to-amber-500/20 rounded-xl flex items-center justify-center text-3xl select-none border border-th-border backdrop-blur-sm">
                {"\u{1F6A6}"}
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{t("dashboard.andonTitle")}</h2>
                <p className="text-sm text-th-text-2 mt-0.5">{t("dashboard.andonSubtitle")}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Sound toggle */}
              <button
                onClick={() => setSoundOn((p) => !p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 border ${
                  soundOn
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                    : "bg-slate-800/50 text-th-text-2 border-slate-700/50 hover:bg-slate-700/50"
                }`}
                title={soundOn ? t("dashboard.andonSoundOn") : t("dashboard.andonSoundOff")}
              >
                {soundOn ? "\u{1F514}" : "\u{1F515}"}{" "}
                {soundOn ? t("dashboard.andonSoundOn") : t("dashboard.andonSoundOff")}
              </button>

              {/* History toggle */}
              <button
                onClick={() => setShowHistory((p) => !p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 border ${
                  showHistory
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25"
                    : "bg-slate-800/50 text-th-text-2 border-slate-700/50 hover:bg-slate-700/50"
                }`}
              >
                {"\u{1F4CB}"} {t("dashboard.andonHistory")}
              </button>

              {/* Trigger Andon */}
              <button
                onClick={() => setShowTriggerModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)]"
              >
                <span className="text-lg leading-none">{"\u26A0"}</span>
                {t("dashboard.andonTriggerAlert")}
              </button>

              {/* Real-time Clock */}
              <div className="text-right ml-2">
                <div className="text-4xl font-mono font-bold tracking-widest text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                  {clock}
                </div>
                <div className="text-[10px] text-th-text-2 uppercase tracking-widest mt-0.5">
                  {t("dashboard.factoryFloorLive")}
                  {isDemo && (
                    <span className="ml-2 text-amber-400">({t("dashboard.andonDemoMode")})</span>
                  )}
                </div>
              </div>

              <ExportToolbar
                className="ml-2"
                onPrint={() => printView({ title: t("dashboard.andonTitle") || "Andon Board" })}
                onExportExcel={() => exportToExcel({
                  filename: "andon_events",
                  sheetName: "Andon",
                  columns: [
                    { key: "line", header: t("dashboard.productionLine") || "Line", width: 18 },
                    { key: "status", header: t("dashboard.andonStatus") || "Status", width: 10 },
                    { key: "category", header: t("dashboard.andonCategory") || "Category", width: 14 },
                    { key: "description", header: t("dashboard.andonDescription") || "Description", width: 30 },
                    { key: "created", header: t("dashboard.andonCreatedAt") || "Created At", width: 18 },
                    { key: "resolved", header: t("dashboard.andonResolvedAt") || "Resolved At", width: 18 },
                  ],
                  rows: events.map((e) => ({
                    line: e.line_name,
                    status: e.status,
                    category: e.category || e.reason || "",
                    description: e.description || "",
                    created: e.created_at ? new Date(e.created_at).toLocaleString() : "",
                    resolved: e.resolved_at ? new Date(e.resolved_at).toLocaleString() : "",
                  })),
                  headerRows: [
                    [t("dashboard.andonOpenCount") || "Open Events", String(kpis.open_count)],
                    [t("dashboard.andonAvgResolve") || "Avg Resolve (min)", String(kpis.avg_resolve_min.toFixed(1))],
                  ],
                })}
                onExportCSV={() => exportToCSV({
                  filename: "andon_events",
                  columns: [
                    { key: "line", header: t("dashboard.productionLine") || "Line" },
                    { key: "status", header: t("dashboard.andonStatus") || "Status" },
                    { key: "category", header: t("dashboard.andonCategory") || "Category" },
                    { key: "description", header: t("dashboard.andonDescription") || "Description" },
                    { key: "created", header: t("dashboard.andonCreatedAt") || "Created At" },
                    { key: "resolved", header: t("dashboard.andonResolvedAt") || "Resolved At" },
                  ],
                  rows: events.map((e) => ({
                    line: e.line_name,
                    status: e.status,
                    category: e.category || e.reason || "",
                    description: e.description || "",
                    created: e.created_at ? new Date(e.created_at).toLocaleString() : "",
                    resolved: e.resolved_at ? new Date(e.resolved_at).toLocaleString() : "",
                  })),
                })}
              />
            </div>
          </div>

          {/* -- Dramatic Traffic Light Status Summary -- */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(["green", "yellow", "red", "blue"] as AndonStatus[]).map((s) => {
              const cfg = STATUS_CFG[s];
              const count = statusCounts[s];
              const isActive = count > 0 && s !== "green";
              const isRedAlert = s === "red" && count > 0;

              return (
                <div
                  key={s}
                  className={`relative rounded-xl p-5 text-center transition-all duration-300 border overflow-hidden ${
                    isRedAlert
                      ? "bg-red-500/15 border-red-500/40 andon-pulse-red"
                      : isActive
                        ? `bg-th-input border-th-border ${cfg.glow}`
                        : "bg-th-bg-3 border-th-border"
                  }`}
                >
                  {/* Large traffic light circle */}
                  <div className="flex justify-center mb-3">
                    <div
                      className={`w-12 h-12 rounded-full ${
                        count > 0 ? cfg.lightColor : "bg-slate-700"
                      } ${count > 0 ? cfg.lightGlow : ""} ${
                        isActive ? "andon-light-active" : ""
                      } transition-all duration-500`}
                    />
                  </div>
                  <div className={`text-4xl font-bold ${count > 0 ? "text-white" : "text-th-text-3"} transition-colors`}>
                    {count}
                  </div>
                  <div className={`text-[10px] font-bold uppercase tracking-[0.15em] mt-1 ${
                    count > 0 ? "text-th-text" : "text-th-text-3"
                  }`}>
                    {t(`dashboard.${cfg.labelKey}`)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ======= KPI CARDS ======= */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <KpiCard
          label={t("dashboard.andonTodayTotal")}
          value={String(kpis.today_total)}
          icon={"\u{1F4CA}"}
          accentColor="slate"
        />
        <KpiCard
          label={t("dashboard.andonOpenAlerts")}
          value={String(kpis.open_count)}
          icon={"\u{1F6A8}"}
          accentColor="red"
          pulse={kpis.open_count > 0}
        />
        <KpiCard
          label={t("dashboard.andonAvgAck")}
          value={`${kpis.avg_acknowledge_min.toFixed(1)}m`}
          icon={"\u{23F1}"}
          accentColor="blue"
        />
        <KpiCard
          label={t("dashboard.andonAvgResolve")}
          value={`${kpis.avg_resolve_min.toFixed(1)}m`}
          icon={"\u{1F527}"}
          accentColor="emerald"
        />
        <KpiCard
          label={t("dashboard.andonEscalated")}
          value={String(kpis.escalated_count)}
          icon={"\u{26A0}"}
          accentColor="amber"
          pulse={kpis.escalated_count > 0}
        />
      </div>

      {/* ======= EVENTS BY CATEGORY ======= */}
      {categoryStats.length > 0 && (
        <div className="bg-th-bg-2 backdrop-blur-sm border border-th-border  rounded-xl p-5">
          <h3 className="text-xs font-bold text-th-text-2 uppercase tracking-[0.15em] mb-4">
            {t("dashboard.andonByCategory")}
          </h3>
          <div className="flex flex-wrap gap-3">
            {categoryStats.map(([cat, count]) => (
              <div
                key={cat}
                className="flex items-center gap-3 bg-th-bg-3 hover:bg-th-bg-3 rounded-lg px-4 py-3 border border-th-border transition-all duration-300 hover:scale-[1.02]"
              >
                <span className="text-xl">{CATEGORY_ICONS[cat as Category] ?? "\u{1F4CB}"}</span>
                <div>
                  <div className="text-[10px] text-th-text-2 uppercase tracking-wider font-medium">
                    {t(`dashboard.andonReason${cat.charAt(0).toUpperCase() + cat.slice(1)}`)}
                  </div>
                  <div className="text-xl font-bold text-th-text">{count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======= LINE STATUS CARDS (monitoring panels) ======= */}
      <div>
        <h3 className="text-xs font-bold text-th-text-2 uppercase tracking-[0.15em] mb-4">
          {t("dashboard.andonLineStatus")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {events
            .filter((e) => !e.resolved_at)
            .map((ev) => {
              const cfg = STATUS_CFG[ev.status];
              const hasIssue = ev.status !== "green";
              const elapsed = hasIssue ? elapsedMin(ev.created_at) : 0;
              const tier = hasIssue ? escalationTier(elapsed) : "none";
              const isNewRed = newRedIds.current.has(ev.id);

              return (
                <div
                  key={ev.id}
                  className={`group rounded-2xl overflow-hidden transition-all duration-300 border-l-4 ${cfg.borderAccent} ${
                    hasIssue
                      ? `bg-th-bg-2 border border-l-4 ${
                          ev.status === "red" ? "border-red-500/30 andon-border-pulse" : "border-th-border"
                        }`
                      : "bg-th-bg-2 border border-l-4 border-th-border"
                  } ${tier === "red" ? "andon-pulse-red" : ""} ${
                    tier === "yellow" ? "ring-1 ring-amber-400/40" : ""
                  } ${isNewRed ? "andon-flash-new" : ""} backdrop-blur-sm hover:scale-[1.02] hover:shadow-lg`}
                >
                  {/* Status bar */}
                  <div className={`${cfg.bg} ${cfg.text} px-4 py-3 flex items-center justify-between`}>
                    <span className="font-bold text-xs uppercase tracking-[0.12em]">
                      {t(`dashboard.${cfg.labelKey}`)}
                    </span>
                    <div className="flex items-center gap-2">
                      {ev.severity && (
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${SEVERITY_BADGE[ev.severity]}`}
                        >
                          {t(
                            `dashboard.andonSeverity${ev.severity.charAt(0).toUpperCase() + ev.severity.slice(1)}`,
                          )}
                        </span>
                      )}
                      {/* Animated traffic light dot */}
                      <span className="relative">
                        <span className={`inline-block w-4 h-4 rounded-full border-2 border-white/40 ${cfg.bg}`} />
                        {hasIssue && (
                          <span className={`absolute inset-0 w-4 h-4 rounded-full ${cfg.bg} animate-ping opacity-40`} />
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    <h4 className="font-bold text-th-text mb-1.5 text-sm tracking-tight">{ev.line_name}</h4>
                    {hasIssue ? (
                      <div className="space-y-2.5">
                        {ev.description && (
                          <p className="text-xs text-th-text-2 line-clamp-2">{ev.description}</p>
                        )}
                        {eventCategory(ev) !== "other" && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-th-bg-3 text-th-text font-medium border border-th-border">
                            <span>{CATEGORY_ICONS[eventCategory(ev)]}</span>
                            {t(
                              `dashboard.andonReason${eventCategory(ev).charAt(0).toUpperCase() + eventCategory(ev).slice(1)}`,
                            )}
                          </span>
                        )}

                        {/* Elapsed + escalation bar */}
                        <div className="flex items-center gap-2 text-[10px] text-th-text-2">
                          <span
                            className={`font-mono font-bold text-xs ${
                              tier === "red"
                                ? "text-red-400 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]"
                                : tier === "yellow"
                                  ? "text-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]"
                                  : "text-th-text"
                            }`}
                          >
                            {fmtDuration(elapsed)}
                          </span>
                          {ev.operator && <span className="text-th-text-2">{ev.operator}</span>}
                        </div>
                        {elapsed > 0 && (
                          <div className="w-full h-2 rounded-full bg-slate-800 dark:bg-slate-900 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                tier === "red"
                                  ? "bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                  : tier === "yellow"
                                    ? "bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                                    : "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                              }`}
                              style={{
                                width: `${Math.min(100, (elapsed / ESCALATION_RED_MIN) * 100)}%`,
                              }}
                            />
                          </div>
                        )}

                        {/* Resolve */}
                        <button
                          onClick={() => {
                            setResolveTarget(ev);
                            setResolveNotes("");
                          }}
                          disabled={resolvingId === ev.id}
                          className="mt-1 w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:from-gray-600 disabled:to-gray-600 text-white text-xs font-bold rounded-lg transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                        >
                          {resolvingId === ev.id
                            ? t("dashboard.andonResolving")
                            : `\u2713 ${t("dashboard.andonResolve")}`}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">
                        {t(`dashboard.${cfg.descKey}`)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ======= ACTIVE ISSUES TABLE ======= */}
      {activeEvents.length > 0 ? (
        <div className="bg-red-50 dark:bg-gradient-to-br dark:from-red-950/40 dark:to-slate-950/60 border border-red-200 dark:border-red-500/20 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="font-bold text-red-600 dark:text-red-400 flex items-center gap-3 mb-5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="uppercase tracking-[0.1em] text-sm">{t("dashboard.activeStoppages")} ({activeEvents.length})</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] text-red-600/70 dark:text-red-400/70 uppercase tracking-[0.12em]">
                  <th className="pb-3 pr-4 font-semibold">{t("dashboard.andonTableLine")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("dashboard.andonSeverity")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("dashboard.andonReason")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("dashboard.andonDescription")}</th>
                  <th className="pb-3 pr-4 font-semibold">{t("dashboard.andonElapsed")}</th>
                  <th className="pb-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {activeEvents.map((ev) => {
                  const elapsed = elapsedMin(ev.created_at);
                  const tier = escalationTier(elapsed);
                  return (
                    <tr key={ev.id} className="border-b border-th-border/50 hover:bg-th-bg-3 transition-colors duration-200">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="relative">
                            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_CFG[ev.status].bg} inline-block`} />
                            {ev.status === "red" && (
                              <span className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${STATUS_CFG[ev.status].bg} animate-ping opacity-50`} />
                            )}
                          </span>
                          <span className="font-bold text-th-text">{ev.line_name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {ev.severity && (
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${SEVERITY_BADGE[ev.severity]}`}>
                            {t(`dashboard.andonSeverity${ev.severity.charAt(0).toUpperCase() + ev.severity.slice(1)}`)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-th-text-2">
                        {CATEGORY_ICONS[eventCategory(ev)]}{" "}
                        {t(`dashboard.andonReason${eventCategory(ev).charAt(0).toUpperCase() + eventCategory(ev).slice(1)}`)}
                      </td>
                      <td className="py-3 pr-4 text-xs text-th-text-2 max-w-[200px] truncate">
                        {ev.description ?? "-"}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-mono font-bold ${
                          tier === "red"
                            ? "text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                            : tier === "yellow"
                              ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]"
                              : "text-th-text"
                        }`}>
                          {fmtDuration(elapsed)}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => {
                            setResolveTarget(ev);
                            setResolveNotes("");
                          }}
                          disabled={resolvingId === ev.id}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:from-gray-600 disabled:to-gray-600 text-white text-xs font-bold rounded-lg transition-all duration-300"
                        >
                          {resolvingId === ev.id
                            ? "..."
                            : `\u2713 ${t("dashboard.andonResolve")}`}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 dark:bg-gradient-to-br dark:from-emerald-950/20 dark:to-slate-950/20 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-6 text-center backdrop-blur-sm">
          <div className="flex items-center justify-center gap-3">
            <span className="relative flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/30 animate-ping" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
            </span>
            <p className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-[0.1em] text-sm">
              {t("dashboard.andonNoActiveAlerts")}
            </p>
          </div>
        </div>
      )}

      {/* ======= HISTORY (resolved events) ======= */}
      {showHistory && (
        <div className="bg-th-bg-2 border border-th-border rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="font-bold text-th-text flex items-center gap-2 mb-5 text-sm uppercase tracking-[0.1em]">
            {"\u{1F4CB}"} {t("dashboard.andonHistory")} ({resolvedEvents.length})
          </h3>
          {resolvedEvents.length === 0 ? (
            <p className="text-sm text-th-text-2 text-center py-6">
              {t("dashboard.andonNoHistory")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] text-th-text-2 uppercase tracking-[0.12em]">
                    <th className="pb-3 pr-4 font-semibold">{t("dashboard.andonTableLine")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("dashboard.andonReason")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("dashboard.andonDescription")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("dashboard.andonResolutionTime")}</th>
                    <th className="pb-3 pr-4 font-semibold">{t("dashboard.andonResolutionNotes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedEvents.map((ev) => {
                    const resMins = ev.resolved_at
                      ? resolutionMin(ev.created_at, ev.resolved_at)
                      : 0;
                    return (
                      <tr key={ev.id} className="border-b border-th-border/50 hover:bg-th-bg-3 transition-colors duration-200">
                        <td className="py-3 pr-4 font-medium text-th-text">{ev.line_name}</td>
                        <td className="py-3 pr-4 text-xs text-th-text-2">
                          {CATEGORY_ICONS[eventCategory(ev)]}{" "}
                          {t(`dashboard.andonReason${eventCategory(ev).charAt(0).toUpperCase() + eventCategory(ev).slice(1)}`)}
                        </td>
                        <td className="py-3 pr-4 text-xs text-th-text-2 max-w-[200px] truncate">
                          {ev.description ?? "-"}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs font-mono text-emerald-400 font-bold">
                            {fmtDuration(resMins)}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-th-text-2 max-w-[200px] truncate">
                          {ev.resolution_notes ?? "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======= TRIGGER ANDON MODAL ======= */}
      {showTriggerModal && (
        <ModalOverlay onClose={() => setShowTriggerModal(false)}>
          <div className="bg-th-bg-2 rounded-2xl shadow-2xl border border-th-border w-full max-w-lg mx-4">
            <div className="p-6 border-b border-th-border">
              <h3 className="font-bold text-th-text text-lg flex items-center gap-2">
                <span>{"\u26A0"}</span> {t("dashboard.andonTriggerAlert")}
              </h3>
            </div>

            <div className="p-6 space-y-5">
              {/* Line selector */}
              <div>
                <label className="block text-[10px] font-bold text-th-text-2 uppercase tracking-[0.12em] mb-1.5">
                  {t("dashboard.andonSelectLine")}
                </label>
                <select
                  value={formLineId}
                  onChange={(e) => setFormLineId(Number(e.target.value))}
                  className="w-full border border-th-border rounded-lg px-3 py-2.5 text-sm bg-th-input text-th-text focus:ring-2 focus:ring-red-500/50 focus:outline-none backdrop-blur-sm"
                  autoFocus
                >
                  {productionLines.length === 0 && (
                    <option value={0}>{t("dashboard.andonSelectLine")}</option>
                  )}
                  {productionLines.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              {/* Severity (red / yellow) */}
              <div>
                <label className="block text-[10px] font-bold text-th-text-2 uppercase tracking-[0.12em] mb-1.5">
                  {t("dashboard.andonSeverity")}
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormSeverity("red")}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 border-2 ${
                      formSeverity === "red"
                        ? "bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                        : "bg-th-input border-th-border text-th-text-2 hover:border-red-500/30"
                    }`}
                  >
                    {"\u{1F534}"} {t("dashboard.stopped")} (RED)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSeverity("yellow")}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 border-2 ${
                      formSeverity === "yellow"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                        : "bg-th-input border-th-border text-th-text-2 hover:border-amber-500/30"
                    }`}
                  >
                    {"\u{1F7E1}"} {t("dashboard.caution")} (YELLOW)
                  </button>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[10px] font-bold text-th-text-2 uppercase tracking-[0.12em] mb-1.5">
                  {t("dashboard.andonReason")}
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setFormCategory(c.key)}
                      className={`py-2.5 rounded-lg text-center text-xs font-semibold transition-all duration-300 border ${
                        formCategory === c.key
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                          : "bg-th-input border-th-border text-th-text-2 hover:bg-th-bg-3"
                      }`}
                    >
                      <div className="text-lg mb-0.5">{CATEGORY_ICONS[c.key]}</div>
                      {t(c.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-th-text-2 uppercase tracking-[0.12em] mb-1.5">
                  {t("dashboard.andonDescription")}
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  className="w-full border border-th-border rounded-lg px-3 py-2.5 text-sm bg-th-input text-th-text focus:ring-2 focus:ring-red-500/50 focus:outline-none resize-none backdrop-blur-sm"
                  placeholder={t("dashboard.andonDescription")}
                />
              </div>
            </div>

            <div className="p-6 border-t border-th-border flex gap-3 justify-end">
              <button
                onClick={() => setShowTriggerModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3 transition-all duration-300"
              >
                {t("dashboard.andonCancel")}
              </button>
              <button
                onClick={handleTrigger}
                disabled={!formLineId || submitting}
                className="px-5 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg text-sm font-bold transition-all duration-300 flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                {submitting && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {t("dashboard.andonSubmit")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ======= RESOLVE MODAL ======= */}
      {resolveTarget && (
        <ModalOverlay onClose={() => setResolveTarget(null)}>
          <div className="bg-th-bg-2 rounded-2xl shadow-2xl border border-th-border w-full max-w-md mx-4">
            <div className="p-6 border-b border-th-border">
              <h3 className="font-bold text-th-text text-lg flex items-center gap-2">
                <span>{"\u2705"}</span> {t("dashboard.andonResolve")}
              </h3>
              <p className="text-sm text-th-text-2 mt-1">
                {resolveTarget.line_name} &mdash; {resolveTarget.description ?? ""}
              </p>
              <p className="text-xs text-th-text-2 mt-1">
                {t("dashboard.andonElapsed")}: <span className="font-mono font-bold text-amber-400">{fmtDuration(elapsedMin(resolveTarget.created_at))}</span>
              </p>
            </div>

            <div className="p-6">
              <label className="block text-[10px] font-bold text-th-text-2 uppercase tracking-[0.12em] mb-1.5">
                {t("dashboard.andonResolutionNotes")}
              </label>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                rows={3}
                className="w-full border border-th-border rounded-lg px-3 py-2.5 text-sm bg-th-input text-th-text focus:ring-2 focus:ring-emerald-500/50 focus:outline-none resize-none backdrop-blur-sm"
                placeholder={t("dashboard.andonResolutionNotes")}
                autoFocus
              />
            </div>

            <div className="p-6 border-t border-th-border flex gap-3 justify-end">
              <button
                onClick={() => setResolveTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3 transition-all duration-300"
              >
                {t("dashboard.andonCancel")}
              </button>
              <button
                onClick={handleResolve}
                disabled={resolvingId === resolveTarget.id}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg text-sm font-bold transition-all duration-300 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                {resolvingId === resolveTarget.id && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {`\u2713 ${t("dashboard.andonResolve")}`}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/* -- sub-components -------------------------------------------------------- */

function KpiCard({
  label,
  value,
  icon,
  accentColor,
  pulse = false,
}: {
  label: string;
  value: string;
  icon: string;
  accentColor: "slate" | "red" | "blue" | "emerald" | "amber";
  pulse?: boolean;
}) {
  const borderColors: Record<string, string> = {
    slate: "border-l-slate-400",
    red: "border-l-red-500",
    blue: "border-l-blue-500",
    emerald: "border-l-emerald-500",
    amber: "border-l-amber-500",
  };

  const glowColors: Record<string, string> = {
    slate: "",
    red: "text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]",
    blue: "text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]",
    emerald: "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]",
    amber: "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]",
  };

  const pulseAnim: Record<string, string> = {
    slate: "",
    red: "animate-glow-pulse-red",
    blue: "animate-glow-pulse",
    emerald: "animate-glow-pulse",
    amber: "animate-glow-pulse-amber",
  };

  return (
    <div className={`kpi-card-premium bg-th-bg-2 backdrop-blur-sm border border-th-border rounded-xl p-5 text-center border-l-4 ${borderColors[accentColor]} ${pulse ? pulseAnim[accentColor] : ""}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`text-3xl font-bold text-th-text ${glowColors[accentColor]}`}>{value}</div>
      <div className="text-[10px] text-th-text-2 font-bold mt-1 uppercase tracking-[0.1em]">{label}</div>
    </div>
  );
}

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      {/* content */}
      <div className="relative z-10 animate-slide-in">{children}</div>
    </div>
  );
}
