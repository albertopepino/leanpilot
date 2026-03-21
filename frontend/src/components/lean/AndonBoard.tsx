"use client";
import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi, adminApi } from "@/lib/api";
import DisplayModeWrapper from "@/components/ui/DisplayModeWrapper";
import ToolInfoCard from "@/components/ui/ToolInfoCard";
import { TOOL_INFO } from "@/lib/toolInfo";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Factory,
  Loader2,
  Monitor,

  PackageCheck,
  PauseCircle,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,

  Timer,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ types */

type AndonColor = "green" | "yellow" | "red" | "blue" | "gray";

interface AndonEvent {
  id: number;
  line_name: string;
  line_id?: number;
  production_line_id?: number;
  status: string;
  category?: string;
  reason?: string;
  severity?: string;
  description?: string;
  operator?: string;
  resolution_notes?: string;
  created_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
}

interface ProductionLine {
  id: number;
  name: string;
  description?: string;
  product_type?: string;
  is_active?: boolean;
}

interface LineCard {
  lineId: number;
  lineName: string;
  color: AndonColor;
  statusKey: string;
  poNumber: string;
  since: string; // ISO timestamp
  latestEvent?: AndonEvent;
}

/* --------------------------------------------------------------- helpers */

function normalizeColor(raw: string | undefined): AndonColor {
  if (!raw) return "gray";
  const c = raw.toLowerCase().trim();
  if (c === "green") return "green";
  if (c === "yellow") return "yellow";
  if (c === "red") return "red";
  if (c === "blue") return "blue";
  return "gray";
}

function statusKeyFromColor(color: AndonColor, reason?: string): string {
  if (reason) {
    const r = reason.toLowerCase();
    if (r.includes("changeover")) return "andonChangeover";
    if (r.includes("breakdown")) return "andonBreakdown";
    if (r.includes("maintenance")) return "andonMaintenance";
    if (r.includes("quality")) return "andonQualityHold";
    if (r.includes("minor")) return "andonMinorStop";
  }
  switch (color) {
    case "green": return "andonRunning";
    case "yellow": return "andonChangeover";
    case "red": return "andonStopped";
    case "blue": return "andonQualityHold";
    default: return "andonIdle";
  }
}

function extractPO(desc?: string): string {
  if (!desc) return "";
  // Try to find PO/WO/order numbers in common formats
  const match = desc.match(/\b(?:PO|WO|ORD|SO|MO)[-#]?\s*(\w[\w-]*)/i);
  return match ? match[0] : "";
}

function elapsedText(since: string, t: (k: string, r?: Record<string, string | number>) => string): string {
  const diffMs = Date.now() - new Date(since).getTime();
  if (diffMs < 0) return "--";
  const totalMin = Math.floor(diffMs / 60000);
  if (totalMin < 1) return t("common.andonJustNow");
  if (totalMin < 60) return t("common.andonMinAgo", { n: totalMin });
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return t("common.andonHourMinAgo", { h, m });
  const d = Math.floor(h / 24);
  return t("common.andonDaysAgo", { n: d });
}

/** Escalation thresholds (minutes) matching backend lean_advanced.py */
const ESCALATION_THRESHOLDS: Record<AndonColor, number | null> = {
  yellow: 10,
  red: 5,
  blue: 15,
  green: null,
  gray: null,
};

interface EscalationInfo {
  label: string;
  urgency: "ok" | "warning" | "danger" | "overdue";
}

function getEscalationInfo(
  color: AndonColor,
  since: string,
  t: (k: string, r?: Record<string, string | number>) => string,
): EscalationInfo | null {
  const threshold = ESCALATION_THRESHOLDS[color];
  if (threshold == null) return null;

  const elapsedMin = Math.floor((Date.now() - new Date(since).getTime()) / 60000);
  const remaining = threshold - elapsedMin;

  if (remaining <= 0) {
    const overdue = Math.abs(remaining);
    return {
      label: t("common.andonOverdueBy", { n: overdue }),
      urgency: "overdue",
    };
  }
  if (remaining <= 2) {
    return {
      label: t("common.andonEscalatesIn", { n: remaining }),
      urgency: "danger",
    };
  }
  if (remaining <= Math.ceil(threshold / 2)) {
    return {
      label: t("common.andonEscalatesIn", { n: remaining }),
      urgency: "warning",
    };
  }
  return {
    label: t("common.andonEscalatesIn", { n: remaining }),
    urgency: "ok",
  };
}

/* ---------------------------------------------------------- color config */

const COLOR_STYLES: Record<AndonColor, {
  border: string; bgClass: string;
  dot: string; textClass: string;
  pulse?: boolean;
}> = {
  green: {
    border: "border-emerald-500", bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
    dot: "bg-emerald-500", textClass: "text-emerald-700 dark:text-emerald-300",
  },
  yellow: {
    border: "border-amber-400", bgClass: "bg-amber-50 dark:bg-amber-950/40",
    dot: "bg-amber-400", textClass: "text-amber-700 dark:text-amber-300",
  },
  red: {
    border: "border-red-500", bgClass: "bg-red-50 dark:bg-red-950/40",
    dot: "bg-red-500", textClass: "text-red-700 dark:text-red-300",
    pulse: true,
  },
  blue: {
    border: "border-blue-500", bgClass: "bg-blue-50 dark:bg-blue-950/40",
    dot: "bg-blue-500", textClass: "text-blue-700 dark:text-blue-300",
  },
  gray: {
    border: "border-gray-300", bgClass: "bg-gray-50 dark:bg-gray-800/40",
    dot: "bg-gray-400", textClass: "text-gray-600 dark:text-gray-400",
  },
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  andonRunning: CheckCircle,
  andonChangeover: RefreshCw,
  andonMinorStop: AlertTriangle,
  andonStopped: XCircle,
  andonBreakdown: Zap,
  andonMaintenance: Wrench,
  andonQualityHold: ShieldAlert,
  andonIdle: PauseCircle,
};

/* =================================================================== */

/** Build a URL to SafetyTracker log form with pre-filled Andon data */
function buildSafetyReportUrl(ev: AndonEvent): string {
  const params = new URLSearchParams();
  params.set("tab", "safety-cross");
  params.set("andon_view", "log");
  if (ev.description) params.set("andon_desc", ev.description);
  if (ev.line_name) params.set("andon_line", ev.line_name);
  if (ev.production_line_id) params.set("andon_line_id", String(ev.production_line_id));
  else if (ev.line_id) params.set("andon_line_id", String(ev.line_id));
  if (ev.created_at) params.set("andon_date", ev.created_at.slice(0, 10));
  params.set("andon_event_id", String(ev.id));
  return `/operations/safety?${params.toString()}`;
}

function AndonBoardInner() {
  const { t } = useI18n();
  const router = useRouter();
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [events, setEvents] = useState<AndonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* -------------------------------------------------------------- fetch */

  const fetchData = useCallback(async () => {
    try {
      // Fetch production lines and andon status in parallel
      const [linesRes, statusRes] = await Promise.allSettled([
        adminApi.listProductionLines(),
        advancedLeanApi.getAndonStatus(),
      ]);

      if (linesRes.status === "fulfilled") {
        const linesData = linesRes.value.data;
        setLines(Array.isArray(linesData) ? linesData : linesData?.lines ?? []);
      }

      if (statusRes.status === "fulfilled") {
        const sd = statusRes.value.data;
        const evts: AndonEvent[] = Array.isArray(sd)
          ? sd
          : Array.isArray(sd?.lines) ? sd.lines : [];
        setEvents(evts);
      }

      setError(null);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      setError(t("common.failedToLoadData"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  // Listen for display-mode-refresh events to re-fetch data
  useEffect(() => {
    const handler = () => { fetchData(); };
    window.addEventListener("display-mode-refresh", handler);
    return () => window.removeEventListener("display-mode-refresh", handler);
  }, [fetchData]);

  // Force tick every 5s to update elapsed & escalation timers
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((p) => p + 1), 5000);
    return () => clearInterval(iv);
  }, []);

  /* -------------------------------------------------------------- cards */

  const cards: LineCard[] = useMemo(() => {
    // Build map: lineId -> latest unresolved event
    const eventMap = new Map<number, AndonEvent>();
    // Sort events newest first
    const sorted = [...events].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    for (const ev of sorted) {
      const lid = ev.production_line_id ?? ev.line_id;
      if (lid && !eventMap.has(lid)) {
        eventMap.set(lid, ev);
      }
    }

    return lines
      .filter((l) => l.is_active !== false)
      .map((line) => {
        const ev = eventMap.get(line.id);
        const color = ev ? normalizeColor(ev.status) : "gray";
        const statusKey = ev
          ? statusKeyFromColor(color, ev.reason ?? ev.category)
          : "andonIdle";
        const po = ev ? extractPO(ev.description) : "";
        return {
          lineId: line.id,
          lineName: line.name,
          color,
          statusKey,
          poNumber: po,
          since: ev?.created_at ?? new Date().toISOString(),
          latestEvent: ev,
        };
      });
  }, [lines, events]);

  const filteredCards = useMemo(() => {
    if (!searchQ.trim()) return cards;
    const q = searchQ.toLowerCase();
    return cards.filter(
      (c) =>
        c.lineName.toLowerCase().includes(q) ||
        t(`common.${c.statusKey}`).toLowerCase().includes(q) ||
        c.poNumber.toLowerCase().includes(q)
    );
  }, [cards, searchQ, t]);

  /* -------------------------------------------------------- recent list */

  const recentEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);
  }, [events]);

  /* ----------------------------------------------------------- summary */

  const summary = useMemo(() => {
    const counts: Record<AndonColor, number> = { green: 0, yellow: 0, red: 0, blue: 0, gray: 0 };
    for (const c of cards) counts[c.color]++;
    return counts;
  }, [cards]);

  /* =========================================================== render */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-th-bg text-th-text">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <span className="ml-3 text-lg">{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen transition-colors duration-300 bg-th-bg text-th-text"
    >
      <ToolInfoCard info={TOOL_INFO.andon} />
      {/* ──────── HEADER ──────── */}
      <div className="sticky top-0 z-20 border-b px-4 py-3 bg-th-card/95 border-th-border backdrop-blur">
        <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Title */}
          <div className="flex items-center gap-3">
            <Monitor className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                {t("common.andonLiveBoard")}
              </h1>
              <p className="text-xs text-th-text-3">
                {t("common.andonLastUpdate")}: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Summary pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["green", "yellow", "red", "blue", "gray"] as AndonColor[]).map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-th-bg-3 text-th-text-2"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${COLOR_STYLES[c].dot}`} />
                {summary[c]}
              </span>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-3" />
              <input
                type="text"
                placeholder={t("common.search")}
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-40 md:w-52 rounded-lg border text-sm bg-th-input border-th-input-border text-th-text placeholder-th-text-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg border transition-colors border-th-border hover:bg-th-bg-hover text-blue-600 dark:text-blue-400"
              title={t("common.retry")}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ──────── ERROR ──────── */}
      {error && (
        <div className="max-w-[1800px] mx-auto px-4 pt-4">
          <div className="rounded-lg p-3 text-sm flex items-center gap-2 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        </div>
      )}

      {/* ──────── GRID ──────── */}
      <div className="max-w-[1800px] mx-auto px-4 py-6">
        {filteredCards.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Factory className="w-16 h-16 text-th-text-3" />
            <p className="text-lg font-medium text-th-text-3">
              {t("common.andonNoLines")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {filteredCards.map((card) => {
              const cs = COLOR_STYLES[card.color];
              const Icon = STATUS_ICONS[card.statusKey] ?? PauseCircle;
              const isPulsing = card.color === "red";

              return (
                <div
                  key={card.lineId}
                  className={`relative rounded-xl border-2 overflow-hidden transition-all duration-300
                    ${cs.border} ${cs.bgClass}
                    ${isPulsing ? "animate-pulse-subtle" : ""}
                    hover:shadow-lg hover:scale-[1.01]`}
                >
                  {/* Status bar top */}
                  <div className={`h-1.5 ${cs.dot}`} />

                  <div className="p-4 md:p-5">
                    {/* Line name */}
                    <h2 className="text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight leading-tight mb-2 text-th-text">
                      {card.lineName}
                    </h2>

                    {/* Status row */}
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`w-6 h-6 ${cs.textClass}`} />
                      <span className={`text-base md:text-lg font-bold ${cs.textClass}`}>
                        {t(`common.${card.statusKey}`)}
                      </span>
                    </div>

                    {/* PO number */}
                    <div className="flex items-center gap-2 text-sm mb-2 text-th-text-2">
                      <PackageCheck className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        {card.poNumber || t("common.andonNoActivePO")}
                      </span>
                    </div>

                    {/* Time in state */}
                    <div className="flex items-center gap-2 text-sm text-th-text-2">
                      <Timer className="w-4 h-4 shrink-0" />
                      <span>{elapsedText(card.since, t)}</span>
                    </div>

                    {/* Escalation countdown badge */}
                    {(() => {
                      const esc = getEscalationInfo(card.color, card.since, t);
                      if (!esc) return null;
                      const urgencyStyles: Record<string, string> = {
                        ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                        warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                        danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
                        overdue: "bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-200 font-bold",
                      };
                      return (
                        <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${urgencyStyles[esc.urgency]}`}>
                          <AlertTriangle className="w-3 h-3" />
                          {esc.label}
                        </div>
                      );
                    })()}

                    {/* Operator badge */}
                    {card.latestEvent?.operator && (
                      <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-th-bg-3 text-th-text-2">
                        <Activity className="w-3 h-3" />
                        {card.latestEvent.operator}
                      </div>
                    )}

                    {/* Report Safety Incident button — shown on all non-green/non-gray cards */}
                    {card.latestEvent && card.color !== "green" && card.color !== "gray" && (
                      <button
                        onClick={() => router.push(buildSafetyReportUrl(card.latestEvent!))}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors bg-th-bg border-th-border text-th-text hover:bg-th-bg-hover"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {t("safety.reportSafetyIncident")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ──────── RECENT EVENTS ──────── */}
        {recentEvents.length > 0 && (
          <div className="mt-10">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-th-text">
              <Clock className="w-5 h-5" />
              {t("common.andonRecentEvents")}
            </h3>
            <div className="rounded-xl border overflow-hidden bg-th-card border-th-border">
              <div className="max-h-[400px] overflow-y-auto divide-y divide-th-border">
                {recentEvents.map((ev) => {
                  const ec = normalizeColor(ev.status);
                  const ecs = COLOR_STYLES[ec];
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-th-bg-hover"
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${ecs.dot}`} />
                      <span className="font-semibold min-w-[120px] text-th-text">
                        {ev.line_name}
                      </span>
                      <span className="flex-1 truncate text-th-text-2">
                        {ev.description || ev.reason || ev.category || "--"}
                      </span>
                      {ev.operator && (
                        <span className="hidden sm:inline text-xs text-th-text-3">
                          {ev.operator}
                        </span>
                      )}
                      <span className="text-xs whitespace-nowrap text-th-text-3">
                        {new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" "}
                        {new Date(ev.created_at).toLocaleDateString([], { day: "2-digit", month: "short" })}
                      </span>
                      {!ev.resolved_at && (
                        <button
                          onClick={() => router.push(buildSafetyReportUrl(ev))}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors bg-th-bg border-th-border text-th-text hover:bg-th-bg-hover whitespace-nowrap"
                          title={t("safety.reportSafetyIncident")}
                        >
                          <Shield className="w-3 h-3" />
                          <span className="hidden md:inline">{t("safety.reportSafetyIncident")}</span>
                        </button>
                      )}
                      {ev.resolved_at && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                          {t("common.andonResolved")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ──────── PULSE ANIMATION STYLE ──────── */}
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default function AndonBoard() {
  return (
    <Suspense fallback={null}>
      <AndonBoardWrapped />
    </Suspense>
  );
}

function AndonBoardWrapped() {
  const { t } = useI18n();
  return (
    <DisplayModeWrapper title={t("common.andonLiveBoard") || "Andon Board"} refreshInterval={15}>
      <AndonBoardInner />
    </DisplayModeWrapper>
  );
}
