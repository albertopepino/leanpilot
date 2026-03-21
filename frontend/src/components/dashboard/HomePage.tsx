"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { oeeApi, adminApi, leanApi, advancedLeanApi, manufacturingApi, qcApi } from "@/lib/api";
import GettingStartedChecklist from "@/components/onboarding/GettingStartedChecklist";
import WelcomeModal, { useWelcomeModal } from "@/components/onboarding/WelcomeModal";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Factory,
  Gauge,
  Lightbulb,
  Search,
  Settings,
  Shield,
  Target,
  TrendingUp,
  Users,
  Wrench,
  Zap,
  Package,
  FileWarning,
  Footprints,
  Bot,
  Settings2,
  Eye,
  EyeOff,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HomePageProps {
  onNavigate: (view: string) => void;
}

interface KpiData {
  oee: number | null;
  oeePrev: number | null;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  productionOutput: number | null;
  productionTarget: number | null;
  qualityRate: number | null;
  qualityPrev: number | null;
  activeAndon: number | null;
  oeeSparkline: { date: string; value: number }[];
  hourlyOutput: { hour: string; actual: number; target: number }[];
}

interface ActivityItem {
  id: string;
  type: "kaizen" | "five-why" | "qc" | "gemba" | "andon" | "ncr" | "capa" | "production";
  title: string;
  timestamp: string;
  icon: string;
}

interface OpenActions {
  capaOverdue: number;
  kaizenInProgress: number;
  ncrOpen: number;
  gembaFindings: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_COLORS = {
  good: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20", fill: "#10b981" },
  warning: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/20", fill: "#f59e0b" },
  critical: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/20", fill: "#ef4444" },
  info: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/20", fill: "#3b82f6" },
  neutral: { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", ring: "ring-slate-500/20", fill: "#64748b" },
} as const;

// SQCDP colors
const SQCDP = {
  S: { labelKey: "home.sqcdpSafety", color: "#22c55e", bg: "bg-green-500", lightBg: "bg-green-50 dark:bg-green-500/10", text: "text-green-700 dark:text-green-400", border: "border-green-200 dark:border-green-500/20" },
  Q: { labelKey: "home.sqcdpQuality", color: "#3b82f6", bg: "bg-blue-500", lightBg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-500/20" },
  C: { labelKey: "home.sqcdpCost", color: "#f59e0b", bg: "bg-amber-500", lightBg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20" },
  D: { labelKey: "home.sqcdpDelivery", color: "#8b5cf6", bg: "bg-violet-500", lightBg: "bg-violet-50 dark:bg-violet-500/10", text: "text-violet-700 dark:text-violet-400", border: "border-violet-200 dark:border-violet-500/20" },
  P: { labelKey: "home.sqcdpPeople", color: "#ec4899", bg: "bg-pink-500", lightBg: "bg-pink-50 dark:bg-pink-500/10", text: "text-pink-700 dark:text-pink-400", border: "border-pink-200 dark:border-pink-500/20" },
} as const;

/* ------------------------------------------------------------------ */
/*  Empty defaults                                                     */
/* ------------------------------------------------------------------ */

const EMPTY_KPI: KpiData = {
  oee: null,
  oeePrev: null,
  availability: null,
  performance: null,
  quality: null,
  productionOutput: null,
  productionTarget: null,
  qualityRate: null,
  qualityPrev: null,
  activeAndon: null,
  oeeSparkline: [],
  hourlyOutput: [],
};

const EMPTY_OPEN_ACTIONS: OpenActions = {
  capaOverdue: 0,
  kaizenInProgress: 0,
  ncrOpen: 0,
  gembaFindings: 0,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t("home.goodMorning");
  if (hour < 18) return t("home.goodAfternoon");
  return t("home.goodEvening");
}

function getStatus(value: number | null, thresholds: [number, number] = [85, 60]) {
  if (value === null) return STATUS_COLORS.neutral;
  if (value >= thresholds[0]) return STATUS_COLORS.good;
  if (value >= thresholds[1]) return STATUS_COLORS.warning;
  return STATUS_COLORS.critical;
}

function getTrend(current: number | null, prev: number | null) {
  if (current === null || prev === null) return { dir: "flat" as const, delta: 0 };
  const delta = current - prev;
  if (delta > 0.5) return { dir: "up" as const, delta };
  if (delta < -0.5) return { dir: "down" as const, delta };
  return { dir: "flat" as const, delta };
}

const LOCALE_MAP: Record<string, string> = {
  en: "en-US", it: "it-IT", de: "de-DE", es: "es-ES",
  fr: "fr-FR", pl: "pl-PL", sr: "sr-Latn",
};

function formatTodayDate(appLocale: string): string {
  const loc = LOCALE_MAP[appLocale] || "en-US";
  return new Date().toLocaleDateString(loc, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

const ACTIVITY_ICONS: Record<string, typeof Activity> = {
  kaizen: Lightbulb,
  qc: CheckCircle2,
  gemba: Footprints,
  "five-why": Search,
  andon: Zap,
  ncr: FileWarning,
  capa: Wrench,
  production: Package,
};

const ACTIVITY_COLORS: Record<string, string> = {
  kaizen: "text-amber-500",
  qc: "text-blue-500",
  gemba: "text-purple-500",
  "five-why": "text-cyan-500",
  andon: "text-rose-500",
  ncr: "text-orange-500",
  capa: "text-emerald-500",
  production: "text-indigo-500",
};

/* ------------------------------------------------------------------ */
/*  OEE Gauge Component                                                */
/* ------------------------------------------------------------------ */

function OEEGauge({ value, size = 180 }: { value: number | null; size?: number }) {
  const v = value ?? 0;
  const status = getStatus(v);
  const radius = (size - 24) / 2;
  const circumference = Math.PI * radius; // semicircle
  const offset = circumference - (v / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.6}`} className="overflow-visible">
        {/* Background arc */}
        <path
          d={`M ${12} ${size * 0.55} A ${radius} ${radius} 0 0 1 ${size - 12} ${size * 0.55}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          className="text-th-border"
        />
        {/* Value arc */}
        <path
          d={`M ${12} ${size * 0.55} A ${radius} ${radius} 0 0 1 ${size - 12} ${size * 0.55}`}
          fill="none"
          stroke={status.fill}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        {/* World class marker at 85% */}
        {(() => {
          const wcAngle = Math.PI * (1 - 0.85);
          const wx = center + radius * Math.cos(wcAngle);
          const wy = size * 0.55 - radius * Math.sin(wcAngle);
          return (
            <g>
              <line x1={wx} y1={wy - 6} x2={wx} y2={wy + 6} stroke="#10b981" strokeWidth="2" opacity="0.5" />
              <text x={wx} y={wy - 10} textAnchor="middle" className="fill-emerald-500 text-[8px] font-medium">85%</text>
            </g>
          );
        })()}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
        <span className={`text-3xl font-bold tracking-tight ${status.text}`}>
          {value !== null ? value.toFixed(1) : "—"}
        </span>
        <span className="text-[9px] font-medium text-th-text-3 uppercase tracking-widest mt-0.5">OEE %</span>
      </div>
      {/* Target and status labels */}
      <div className="flex flex-col items-center mt-2 gap-0.5">
        <OEEStatusLabel value={v} />
        <span className="text-[8px] text-th-text-3">Target: 85%</span>
      </div>
    </div>
  );
}

function OEEStatusLabel({ value }: { value: number }) {
  const { t } = useI18n();
  if (value >= 85) return <span className="text-[10px] font-semibold text-emerald-500">{t('common.oeeWorldClass')}</span>;
  if (value >= 70) return <span className="text-[10px] font-semibold text-blue-500">{t('common.oeeGood')}</span>;
  if (value >= 50) return <span className="text-[10px] font-semibold text-amber-500">{t('common.oeeNeedsImprovement')}</span>;
  return <span className="text-[10px] font-semibold text-rose-500">{t('common.oeeCritical')}</span>;
}

/* ------------------------------------------------------------------ */
/*  Sub-gauge for A/P/Q                                                */
/* ------------------------------------------------------------------ */

function MiniGauge({ label, value, icon: Icon }: { label: string; value: number | null; icon: typeof Gauge }) {
  const v = value ?? 0;
  const status = getStatus(v);
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (v / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
          <circle cx="34" cy="34" r={radius} fill="none" strokeWidth="5" stroke="currentColor" className="text-th-border" />
          <circle
            cx="34" cy="34" r={radius} fill="none" strokeWidth="5"
            stroke={status.fill}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${status.text}`}>{value !== null ? Math.round(v) : "—"}%</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Icon size={12} className="text-th-text-3" />
        <span className="text-[10px] font-medium text-th-text-3 uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SQCDP Card                                                         */
/* ------------------------------------------------------------------ */

function SQCDPCard({
  letter,
  label,
  metric,
  value,
  unit,
  status,
  onClick,
}: {
  letter: string;
  label: string;
  metric: string;
  value: string;
  unit?: string;
  status: "good" | "warning" | "critical";
  onClick?: () => void;
}) {
  const cfg = SQCDP[letter as keyof typeof SQCDP];
  const statusCfg = STATUS_COLORS[status];
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border ${cfg.border} ${cfg.lightBg} p-3 text-left transition-all duration-200 hover:shadow-md hover:scale-[1.01] group min-w-0`}
    >
      {/* Letter badge */}
      <div className={`absolute top-2 right-2 w-6 h-6 rounded-md ${cfg.bg} flex items-center justify-center`}>
        <span className="text-[10px] font-bold text-white">{letter}</span>
      </div>
      <p className={`text-[11px] font-semibold ${cfg.text} mb-1 leading-tight`}>{label}</p>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-xl font-bold ${statusCfg.text}`}>{value}</span>
        {unit && <span className="text-[9px] text-th-text-3 font-medium">{unit}</span>}
      </div>
      {/* Status dot */}
      <div className={`absolute bottom-2 right-2 w-2 h-2 rounded-full ${
        status === "good" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : "bg-rose-500"
      }`} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Metric Row (compact KPI)                                           */
/* ------------------------------------------------------------------ */

function MetricRow({
  icon: Icon,
  label,
  value,
  trend,
  onClick,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  trend?: { dir: "up" | "down" | "flat"; delta: number };
  onClick?: () => void;
}) {
  const TrendIcon = trend?.dir === "up" ? ArrowUp : trend?.dir === "down" ? ArrowDown : ArrowRight;
  const trendColor = trend?.dir === "up" ? "text-emerald-500" : trend?.dir === "down" ? "text-rose-500" : "text-th-text-3";
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 hover:bg-th-bg-hover rounded-lg transition-colors w-full text-left group"
    >
      <div className="w-8 h-8 rounded-lg bg-th-bg flex items-center justify-center border border-th-border shrink-0 group-hover:border-brand-500/30 transition-colors">
        <Icon size={15} className="text-th-text-2" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-th-text-3 truncate">{label}</p>
        <p className="text-sm font-semibold text-th-text">{value}</p>
      </div>
      {trend && (
        <div className={`flex items-center gap-0.5 ${trendColor}`}>
          <TrendIcon size={12} />
          <span className="text-[10px] font-medium">{Math.abs(trend.delta).toFixed(1)}%</span>
        </div>
      )}
      <ChevronRight size={14} className="text-th-text-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

type WidgetKey = "oee" | "sqcdp" | "hourlyOutput" | "quickActions" | "openActions" | "activityFeed";

const WIDGET_LABELS: Record<WidgetKey, string> = {
  oee: "OEE Command Center",
  sqcdp: "SQCDP Board",
  hourlyOutput: "Hourly Output",
  quickActions: "Quick Actions",
  openActions: "Open Actions",
  activityFeed: "Activity Feed",
};

const ALL_WIDGETS: WidgetKey[] = ["oee", "sqcdp", "hourlyOutput", "quickActions", "openActions", "activityFeed"];

function loadWidgetConfig(): Record<WidgetKey, boolean> {
  if (typeof window === "undefined") return Object.fromEntries(ALL_WIDGETS.map(w => [w, true])) as Record<WidgetKey, boolean>;
  try {
    const raw = localStorage.getItem("leanpilot_dashboard_widgets");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return Object.fromEntries(ALL_WIDGETS.map(w => [w, true])) as Record<WidgetKey, boolean>;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [kpi, setKpi] = useState<KpiData>(EMPTY_KPI);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [openActions, setOpenActions] = useState<OpenActions>(EMPTY_OPEN_ACTIONS);
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const { show: showWelcome, dismiss: dismissWelcome } = useWelcomeModal();
  const [widgets, setWidgets] = useState<Record<WidgetKey, boolean>>(loadWidgetConfig);
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);

  const toggleWidget = (key: WidgetKey) => {
    setWidgets(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("leanpilot_dashboard_widgets", JSON.stringify(next));
      return next;
    });
  };

  // Close widget config dropdown on outside click
  useEffect(() => {
    if (!showWidgetConfig) return;
    const handler = () => setShowWidgetConfig(false);
    const timer = setTimeout(() => document.addEventListener("click", handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener("click", handler); };
  }, [showWidgetConfig]);

  /* ---- Fetch data ---- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    let usedDemo = true;

    // OEE summary
    try {
      const linesRes = await adminApi.listProductionLines();
      const lines = linesRes.data;
      if (lines && lines.length > 0) {
        const lineId = lines[0].id;
        const [summaryRes, trendRes] = await Promise.all([
          oeeApi.getSummary(lineId, 2),
          oeeApi.getTrend(lineId, 7),
        ]);
        const summary = summaryRes.data;
        const trend = trendRes.data;

        const sparkline = (trend || []).map((p: { date?: string; oee?: number }) => ({
          date: p.date ? p.date.slice(0, 10).slice(5) : "",
          value: p.oee ?? 0,
        }));

        const yesterdayOee = trend && trend.length >= 2 ? trend[trend.length - 1]?.oee : summary?.avg_oee;
        const prevOee = trend && trend.length >= 2 ? trend[trend.length - 2]?.oee : null;
        const yesterdayQuality = trend && trend.length >= 2 ? trend[trend.length - 1]?.quality : summary?.avg_quality;
        const prevQuality = trend && trend.length >= 2 ? trend[trend.length - 2]?.quality : null;

        setKpi((prev) => ({
          ...prev,
          oee: yesterdayOee ?? prev.oee,
          oeePrev: prevOee ?? prev.oeePrev,
          availability: summary?.avg_availability ?? prev.availability,
          performance: summary?.avg_performance ?? prev.performance,
          quality: yesterdayQuality ?? prev.quality,
          qualityRate: yesterdayQuality ?? prev.qualityRate,
          qualityPrev: prevQuality ?? prev.qualityPrev,
          oeeSparkline: sparkline.length > 0 ? sparkline : prev.oeeSparkline,
        }));
        usedDemo = false;
      }
    } catch (err) {
      console.error("[HomePage] OEE data unavailable:", err);
    }

    // Production orders
    try {
      const ordersRes = await manufacturingApi.listOrders({ status: "in_progress" });
      const orders = ordersRes.data;
      if (orders && orders.length > 0) {
        let totalOutput = 0;
        let totalTarget = 0;
        for (const o of orders) {
          totalOutput += o.produced_qty ?? 0;
          totalTarget += o.planned_qty ?? 0;
        }
        setKpi((prev) => ({
          ...prev,
          productionOutput: totalOutput || prev.productionOutput,
          productionTarget: totalTarget || prev.productionTarget,
        }));
        usedDemo = false;
      }
    } catch (err) {
      console.error("[HomePage] Production orders unavailable:", err);
    }

    // Active andon alerts
    try {
      const andonRes = await advancedLeanApi.getAndonStatus();
      const andonData = andonRes.data;
      if (andonData) {
        const activeCount = Array.isArray(andonData) ? andonData.filter((a: { resolved_at?: string | null }) => !a.resolved_at).length : (andonData.active_count ?? 0);
        setKpi((prev) => ({ ...prev, activeAndon: activeCount }));
        usedDemo = false;
      }
    } catch (err) {
      console.error("[HomePage] Andon data unavailable:", err);
    }

    // Recent activities
    try {
      const recentActivities: ActivityItem[] = [];
      try {
        const kaizenRes = await leanApi.getKaizenBoard();
        const kaizenItems = kaizenRes.data?.items || kaizenRes.data || [];
        const sorted = [...kaizenItems].sort((a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3);
        for (const k of sorted) {
          recentActivities.push({ id: `kaizen-${k.id}`, type: "kaizen", title: k.title || k.description || "Kaizen item", timestamp: formatRelativeTime(k.created_at, locale), icon: "kaizen" });
        }
      } catch { /* skip */ }
      try {
        const gembaRes = await advancedLeanApi.listGembaWalks();
        const sorted = [...(gembaRes.data || [])].sort((a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 2);
        for (const g of sorted) {
          recentActivities.push({ id: `gemba-${g.id}`, type: "gemba", title: `Gemba Walk — ${g.area || g.title || ""}`, timestamp: formatRelativeTime(g.created_at, locale), icon: "gemba" });
        }
      } catch { /* skip */ }
      try {
        const fwRes = await leanApi.listFiveWhy();
        const sorted = [...(fwRes.data || [])].sort((a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 2);
        for (const f of sorted) {
          recentActivities.push({ id: `fw-${f.id}`, type: "five-why", title: f.problem_statement || "5 Why Analysis", timestamp: formatRelativeTime(f.created_at, locale), icon: "five-why" });
        }
      } catch { /* skip */ }
      if (recentActivities.length > 0) {
        recentActivities.sort((a, b) => {
          const parseMinutes = (ts: string): number => {
            const m = ts.match(/^(\d+)(m|h|d)\s/);
            if (!m) return Infinity;
            const n = parseInt(m[1], 10);
            if (m[2] === "m") return n;
            if (m[2] === "h") return n * 60;
            return n * 1440;
          };
          return parseMinutes(a.timestamp) - parseMinutes(b.timestamp);
        });
        setActivities(recentActivities.slice(0, 8));
        usedDemo = false;
      }
    } catch (err) {
      console.error("[HomePage] Activity feed unavailable:", err);
    }

    // Open action counts
    try {
      let capaOverdue = 0, kaizenInProgress = 0, ncrOpen = 0, gembaFindings = 0;
      try {
        const capaRes = await qcApi.listCAPAs({ status: "open" });
        const capas = capaRes.data || [];
        capaOverdue = capas.filter((c: { due_date?: string | null }) => c.due_date && new Date(c.due_date) < new Date()).length;
        if (capaOverdue === 0) capaOverdue = capas.length;
      } catch { /* skip */ }
      try {
        const kaizenRes = await leanApi.getKaizenBoard();
        const items = kaizenRes.data?.items || kaizenRes.data || [];
        kaizenInProgress = items.filter((k: { status: string }) => k.status === "in_progress" || k.status === "doing").length;
      } catch { /* skip */ }
      try {
        const ncrRes = await qcApi.listNCRs({ status: "open" });
        ncrOpen = (ncrRes.data || []).length;
      } catch { /* skip */ }
      try {
        const gembaRes = await advancedLeanApi.listGembaWalks();
        gembaFindings = (gembaRes.data || []).reduce((sum: number, g: { findings?: { status?: string; resolved?: boolean }[]; observations?: { status?: string; resolved?: boolean }[] }) => {
          const findings = g.findings || g.observations || [];
          return sum + (Array.isArray(findings) ? findings.filter((f) => f.status === "open" || !f.resolved).length : 0);
        }, 0);
      } catch { /* skip */ }
      if (capaOverdue || kaizenInProgress || ncrOpen || gembaFindings) {
        setOpenActions({ capaOverdue, kaizenInProgress, ncrOpen, gembaFindings });
        usedDemo = false;
      }
    } catch (err) {
      console.error("[HomePage] Open actions unavailable:", err);
    }

    setUsingDemo(usedDemo);
    setLoading(false);
  }, [locale]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const userName = user?.full_name?.split(" ")[0] || user?.full_name || "User";
  const oeeTrend = getTrend(kpi.oee, kpi.oeePrev);
  const qualityTrend = getTrend(kpi.qualityRate, kpi.qualityPrev);
  const outputPct = kpi.productionTarget ? Math.round(((kpi.productionOutput ?? 0) / kpi.productionTarget) * 100) : 0;

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      {/* Welcome modal for first-time users */}
      {showWelcome && (
        <WelcomeModal
          onClose={dismissWelcome}
          onTour={dismissWelcome}
          onSetup={() => { dismissWelcome(); onNavigate("setup-wizard"); }}
        />
      )}

      {/* ============================================================ */}
      {/*  TOP BAR: Greeting + Status                                   */}
      {/* ============================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-th-text tracking-tight">
            {getGreeting(t)}, {userName}
          </h1>
          <p className="text-xs text-th-text-3 mt-0.5">{formatTodayDate(locale)}</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-th-bg-2 border border-th-border">
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-[10px] text-th-text-3 font-medium">{t("home.loadingData")}</span>
            </div>
          )}
          {!loading && usingDemo && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">{t("dashboard.demoDataBadge")}</span>
            </div>
          )}
          {!loading && !usingDemo && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">{t("home.liveData") || "Live"}</span>
            </div>
          )}
          {/* Widget configurator */}
          <div className="relative">
            <button
              onClick={() => setShowWidgetConfig(!showWidgetConfig)}
              className="p-2 rounded-lg border border-th-border bg-th-bg-2 hover:bg-th-bg-3 text-th-text-2 transition-colors"
              title={t("home.configureWidgets") || "Configure widgets"}
            >
              <Settings2 size={14} />
            </button>
            {showWidgetConfig && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-th-bg border border-th-border rounded-xl shadow-xl z-50 p-3 space-y-1">
                <p className="text-[10px] font-semibold text-th-text-3 uppercase tracking-wider px-2 mb-2">
                  {t("home.showHideWidgets") || "Show / Hide Widgets"}
                </p>
                {ALL_WIDGETS.map((key) => (
                  <button
                    key={key}
                    onClick={() => toggleWidget(key)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-th-bg-2 text-left transition-colors"
                  >
                    {widgets[key] ? <Eye size={12} className="text-brand-500" /> : <EyeOff size={12} className="text-th-text-3" />}
                    <span className={`text-xs font-medium ${widgets[key] ? "text-th-text" : "text-th-text-3"}`}>
                      {WIDGET_LABELS[key]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Getting Started Checklist (shows only when setup incomplete) */}
      {/* ============================================================ */}
      <GettingStartedChecklist onNavigate={onNavigate} />

      {/* ============================================================ */}
      {/*  ROW 1: OEE Command Center + SQCDP                           */}
      {/* ============================================================ */}
      {(widgets.oee || widgets.sqcdp || widgets.hourlyOutput) && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* OEE Panel — 5 cols */}
        {widgets.oee && (
        <div className="lg:col-span-5 rounded-xl border border-th-border bg-th-bg-2 p-5 shadow-sm animate-card-enter animate-card-enter-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center">
                <Gauge size={14} className="text-brand-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-th-text">{t("home.kpiOEE") || "OEE"}</h2>
                <p className="text-[10px] text-th-text-3">{t("home.yesterdaySummary")}</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate("dashboard")}
              className="text-[10px] text-brand-500 hover:text-brand-600 font-medium flex items-center gap-0.5 transition-colors"
            >
              {t("home.actionOEEDesc") || "Details"} <ChevronRight size={12} />
            </button>
          </div>

          {/* Main gauge */}
          <div className="flex justify-center mb-4">
            <OEEGauge value={kpi.oee} size={200} />
          </div>

          {/* A / P / Q sub-gauges */}
          <div className="flex justify-center gap-6">
            <MiniGauge label={t("home.availability") || "Availability"} value={kpi.availability} icon={Clock} />
            <MiniGauge label={t("home.performanceLabel") || "Performance"} value={kpi.performance} icon={TrendingUp} />
            <MiniGauge label={t("home.qualityLabel") || "Quality"} value={kpi.quality} icon={CheckCircle2} />
          </div>

          {/* OEE Trend sparkline */}
          {kpi.oeeSparkline.length > 0 && (
            <div className="mt-4 pt-4 border-t border-th-border">
              <p className="text-[10px] text-th-text-3 font-medium uppercase tracking-wider mb-2">{t("home.weekTrend") || "7-Day Trend"}</p>
              <div className="h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={kpi.oeeSparkline} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="oeeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={getStatus(kpi.oee).fill} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={getStatus(kpi.oee).fill} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke={getStatus(kpi.oee).fill} strokeWidth={2} fill="url(#oeeGrad)" dot={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-primary)", borderRadius: "8px", fontSize: "11px", padding: "6px 10px" }}
                      labelStyle={{ fontWeight: 600 }}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, "OEE"]}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Right column: SQCDP + Production */}
        <div className={`${widgets.oee ? "lg:col-span-7" : "lg:col-span-12"} space-y-4 animate-card-enter animate-card-enter-2`}>
          {/* SQCDP Board */}
          {widgets.sqcdp && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-semibold text-th-text-3 uppercase tracking-wider">{t("home.sqcdpBoard") || "SQCDP Board"}</h2>
              <div className="flex-1 h-px bg-th-border" />
            </div>
            <div className="grid grid-cols-5 gap-2">
              <SQCDPCard
                letter="S" label={t("home.sqcdpSafety")}
                metric={t("home.daysNoIncident") || "Days w/o incident"}
                value={kpi.activeAndon !== null ? "0" : "—"} unit="days" status="good"
                onClick={() => onNavigate("safety")}
              />
              <SQCDPCard
                letter="Q" label={t("home.sqcdpQuality")}
                metric={t("home.defectRate") || "Defect rate"}
                value={kpi.qualityRate !== null ? (100 - kpi.qualityRate).toFixed(1) : "—"} unit="%" status={kpi.qualityRate && kpi.qualityRate >= 95 ? "good" : "warning"}
                onClick={() => onNavigate("dashboard")}
              />
              <SQCDPCard
                letter="C" label={t("home.sqcdpCost")}
                metric={t("home.scrapCost") || "Scrap cost"}
                value="—" status="good"
                onClick={() => onNavigate("waste")}
              />
              <SQCDPCard
                letter="D" label={t("home.sqcdpDelivery")}
                metric={t("home.onTimeDelivery") || "On-time delivery"}
                value={`${outputPct}`} unit="%" status={outputPct >= 90 ? "good" : outputPct >= 75 ? "warning" : "critical"}
                onClick={() => onNavigate("production")}
              />
              <SQCDPCard
                letter="P" label={t("home.sqcdpPeople")}
                metric={t("home.attendance") || "Attendance"}
                value="—" status="good"
                onClick={() => onNavigate("admin")}
              />
            </div>
          </div>
          )}

          {/* Production Output vs Target */}
          {widgets.hourlyOutput && (
          <div className="rounded-xl border border-th-border bg-th-bg-2 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <BarChart3 size={14} className="text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-th-text">{t("home.hourlyOutput") || "Hourly Output"}</h2>
                  <p className="text-[10px] text-th-text-3">{t("home.outputVsTarget") || "Actual vs Target"}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px]">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm bg-brand-500" />
                  <span className="text-th-text-3">{t("home.actual") || "Actual"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm bg-th-border" />
                  <span className="text-th-text-3">{t("common.target") || "Target"}</span>
                </div>
              </div>
            </div>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpi.hourlyOutput} barGap={2} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.5} vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-primary)", borderRadius: "8px", fontSize: "11px", padding: "6px 10px" }}
                    labelFormatter={(v) => `${v}:00`}
                  />
                  <Bar dataKey="target" fill="var(--border-primary)" radius={[3, 3, 0, 0]} barSize={14} />
                  <Bar dataKey="actual" radius={[3, 3, 0, 0]} barSize={14}>
                    {kpi.hourlyOutput.map((entry, index) => (
                      <Cell key={index} fill={entry.actual >= entry.target ? "#10b981" : entry.actual >= entry.target * 0.85 ? "#f59e0b" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Summary below chart */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-th-border">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] text-th-text-3">{t("home.totalOutput") || "Total Output"}</p>
                  <p className="text-lg font-bold text-th-text">{kpi.productionOutput?.toLocaleString() ?? "—"}</p>
                </div>
                <div className="h-8 w-px bg-th-border" />
                <div>
                  <p className="text-[10px] text-th-text-3">{t("common.target") || "Target"}</p>
                  <p className="text-lg font-bold text-th-text-2">{kpi.productionTarget?.toLocaleString() ?? "—"}</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="w-24 h-2 rounded-full bg-th-border overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${outputPct >= 90 ? "bg-emerald-500" : outputPct >= 75 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${Math.min(outputPct, 100)}%` }}
                  />
                </div>
                <span className={`text-sm font-bold ${outputPct >= 90 ? "text-emerald-500" : outputPct >= 75 ? "text-amber-500" : "text-rose-500"}`}>
                  {outputPct}%
                </span>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
      )}

      {/* ============================================================ */}
      {/*  ROW 2: Quick Actions + Open Actions + Activity               */}
      {/* ============================================================ */}
      {(widgets.quickActions || widgets.openActions || widgets.activityFeed) && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Quick Actions — compact grid */}
        {widgets.quickActions && (
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-th-border">
              <h3 className="text-xs font-semibold text-th-text uppercase tracking-wider">{t("home.quickActions")}</h3>
            </div>
            <div className="p-1">
              <MetricRow icon={ClipboardList} label={t("home.actionProduction") || "Production"} value="→" onClick={() => onNavigate("production")} />
              <MetricRow icon={Gauge} label={t("home.actionOEE") || "OEE"} value="→" onClick={() => onNavigate("dashboard")} />
              <MetricRow icon={Lightbulb} label={t("home.actionKaizen") || "Kaizen"} value="→" onClick={() => onNavigate("kaizen")} />
              <MetricRow icon={Footprints} label={t("home.actionGemba") || "Gemba"} value="→" onClick={() => onNavigate("gemba")} />
              <MetricRow icon={Zap} label={t("home.actionAndon") || "Andon"} value="→" onClick={() => onNavigate("andon")} />
              <MetricRow icon={Bot} label={t("home.actionCopilot") || "AI Copilot"} value="→" onClick={() => onNavigate("copilot")} />
            </div>
          </div>
        </div>
        )}

        {/* Open Actions — 3 cols */}
        {widgets.openActions && (
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-th-border">
              <h3 className="text-xs font-semibold text-th-text uppercase tracking-wider">{t("home.openActions")}</h3>
              <p className="text-[10px] text-th-text-3 mt-0.5">{t("home.openActionsDesc")}</p>
            </div>
            <div className="p-3 space-y-2">
              {[
                { label: t("home.capaActions"), count: openActions.capaOverdue, icon: Wrench, color: "rose", view: "capa" },
                { label: t("home.kaizenItems"), count: openActions.kaizenInProgress, icon: Lightbulb, color: "amber", view: "kaizen" },
                { label: t("home.ncrOpen"), count: openActions.ncrOpen, icon: FileWarning, color: "violet", view: "ncr" },
                { label: t("home.gembaFindings"), count: openActions.gembaFindings, icon: Footprints, color: "blue", view: "gemba" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.view}
                    onClick={() => onNavigate(item.view)}
                    className="flex items-center gap-3 w-full p-3 rounded-lg border border-th-border hover:border-brand-500/30 bg-th-bg hover:bg-th-bg-hover transition-all group"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-${item.color}-500/10`}>
                      <Icon size={16} className={`text-${item.color}-500`} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[10px] text-th-text-3">{item.label}</p>
                      <p className="text-lg font-bold text-th-text">{item.count}</p>
                    </div>
                    {item.count > 0 && (
                      <span className={`w-2 h-2 rounded-full bg-${item.color}-500 animate-pulse`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {/* Activity Feed — 6 cols */}
        {widgets.activityFeed && (
        <div className="lg:col-span-6">
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden h-full">
            <div className="px-4 py-3 border-b border-th-border flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-th-text uppercase tracking-wider">{t("home.recentActivity")}</h3>
                <p className="text-[10px] text-th-text-3 mt-0.5">{t("home.recentActivityDesc")}</p>
              </div>
              <Activity size={14} className="text-th-text-3" />
            </div>
            <div className="divide-y divide-th-border/50">
              {activities.map((item) => {
                const Icon = ACTIVITY_ICONS[item.type] || Activity;
                const iconColor = ACTIVITY_COLORS[item.type] || "text-th-text-3";
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-th-bg-hover transition-colors">
                    <div className={`w-8 h-8 rounded-lg bg-th-bg flex items-center justify-center border border-th-border shrink-0`}>
                      <Icon size={14} className={iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-th-text truncate">{item.title}</p>
                      <p className="text-[10px] text-th-text-3">{item.timestamp}</p>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider text-th-text-3 font-medium bg-th-bg px-2 py-0.5 rounded-full border border-th-border shrink-0">
                      {item.type}
                    </span>
                  </div>
                );
              })}
              {activities.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-th-text-3">{t("home.noActivity")}</div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
      )}

      {/* ============================================================ */}
      {/*  ROW 3: Lean Journey (DMAIC Progress)                         */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-th-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-brand-500" />
            <h3 className="text-xs font-semibold text-th-text uppercase tracking-wider">{t("home.leanJourney") || "Lean Journey"}</h3>
          </div>
          <button onClick={() => onNavigate("assessment")} className="text-[10px] text-brand-500 hover:text-brand-600 font-medium flex items-center gap-0.5 transition-colors">
            {t("home.viewAssessment") || "View Assessment"} <ChevronRight size={12} />
          </button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-5 gap-4">
            {[
              { phase: t("home.phaseDefine") || "Define", score: 72, color: "#3b82f6", modules: 4 },
              { phase: t("home.phaseMeasure") || "Measure", score: 85, color: "#10b981", modules: 6 },
              { phase: t("home.phaseAnalyze") || "Analyze", score: 58, color: "#f59e0b", modules: 8 },
              { phase: t("home.phaseImprove") || "Improve", score: 43, color: "#f97316", modules: 5 },
              { phase: t("home.phaseControl") || "Control", score: 35, color: "#ef4444", modules: 3 },
            ].map((p) => {
              const pct = p.score;
              return (
                <div key={p.phase} className="text-center">
                  {/* Horizontal bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-th-text">{p.phase}</span>
                      <span className="text-xs font-bold" style={{ color: p.color }}>{pct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-th-border overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                    </div>
                  </div>
                  <p className="text-[9px] text-th-text-3">{p.modules} {t("home.modules") || "modules"}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function formatRelativeTime(dateStr: string, appLocale?: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    const locale = appLocale
      ? (LOCALE_MAP[appLocale] || appLocale)
      : undefined;

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });

    if (diffMin < 1) return rtf.format(-diffSec, "second");
    if (diffMin < 60) return rtf.format(-diffMin, "minute");
    if (diffH < 24) return rtf.format(-diffH, "hour");
    if (diffD < 30) return rtf.format(-diffD, "day");
    const diffW = Math.floor(diffD / 7);
    if (diffD < 90) return rtf.format(-diffW, "week");
    const diffM = Math.floor(diffD / 30);
    return rtf.format(-diffM, "month");
  } catch {
    return dateStr;
  }
}
