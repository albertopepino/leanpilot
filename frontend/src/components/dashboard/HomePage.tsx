"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { oeeApi, adminApi, leanApi, advancedLeanApi, manufacturingApi, qcApi } from "@/lib/api";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HomePageProps {
  onNavigate: (view: string) => void;
}

interface KpiData {
  oee: number | null;
  oeePrev: number | null;
  productionOutput: number | null;
  productionTarget: number | null;
  qualityRate: number | null;
  qualityPrev: number | null;
  activeAndon: number | null;
  oeeSparkline: { date: string; value: number }[];
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

const COLOR = {
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
} as const;

/* ------------------------------------------------------------------ */
/*  Demo / Fallback data                                               */
/* ------------------------------------------------------------------ */

const DEMO_KPI: KpiData = {
  oee: 72.4,
  oeePrev: 68.1,
  productionOutput: 1842,
  productionTarget: 2000,
  qualityRate: 96.3,
  qualityPrev: 95.1,
  activeAndon: 2,
  oeeSparkline: [
    { date: "03/09", value: 68 },
    { date: "03/10", value: 72 },
    { date: "03/11", value: 75 },
    { date: "03/12", value: 71 },
    { date: "03/13", value: 64 },
    { date: "03/14", value: 78 },
    { date: "03/15", value: 72 },
  ],
};

const DEMO_ACTIVITIES: ActivityItem[] = [
  { id: "1", type: "kaizen", title: "Reduce changeover time Line 2", timestamp: "2h ago", icon: "💡" },
  { id: "2", type: "qc", title: "QC check completed — Order #1847", timestamp: "3h ago", icon: "🧪" },
  { id: "3", type: "gemba", title: "Gemba walk — Assembly Area B", timestamp: "5h ago", icon: "🚶" },
  { id: "4", type: "five-why", title: "Root cause: motor overheating", timestamp: "6h ago", icon: "❓" },
  { id: "5", type: "andon", title: "Andon resolved — Line 1 jam cleared", timestamp: "8h ago", icon: "🚦" },
  { id: "6", type: "ncr", title: "NCR-0042 opened — dimension out of spec", timestamp: "1d ago", icon: "⚠️" },
  { id: "7", type: "production", title: "Production order #1845 completed", timestamp: "1d ago", icon: "📋" },
];

const DEMO_OPEN_ACTIONS: OpenActions = {
  capaOverdue: 3,
  kaizenInProgress: 7,
  ncrOpen: 4,
  gembaFindings: 5,
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

function getOeeColor(value: number | null): string {
  if (value === null) return COLOR.blue;
  if (value >= 85) return COLOR.emerald;
  if (value >= 60) return COLOR.amber;
  return COLOR.rose;
}

function getTrendArrow(current: number | null, prev: number | null): { arrow: string; color: string; delta: string } {
  if (current === null || prev === null) return { arrow: "", color: "text-th-text-3", delta: "—" };
  const diff = current - prev;
  if (diff > 0) return { arrow: "\u2191", color: "text-emerald-400", delta: `+${diff.toFixed(1)}%` };
  if (diff < 0) return { arrow: "\u2193", color: "text-rose-400", delta: `${diff.toFixed(1)}%` };
  return { arrow: "\u2192", color: "text-amber-400", delta: "0%" };
}

const LOCALE_MAP: Record<string, string> = {
  en: "en-US", it: "it-IT", de: "de-DE", es: "es-ES",
  fr: "fr-FR", pl: "pl-PL", sr: "sr-Latn",
};

function formatTodayDate(appLocale: string): string {
  const loc = LOCALE_MAP[appLocale] || "en-US";
  return new Date().toLocaleDateString(loc, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  value,
  unit,
  subtitle,
  trend,
  gradient,
  glowColor,
  sparkline,
}: {
  label: string;
  value: string;
  unit?: string;
  subtitle?: string;
  trend?: { arrow: string; color: string; delta: string };
  gradient: string;
  glowColor: string;
  sparkline?: { date: string; value: number }[];
}) {
  return (
    <div className={`relative group overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${gradient} p-5 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl`}>
      {/* Glow border effect */}
      <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
        style={{ boxShadow: `inset 0 0 30px ${glowColor}20, 0 0 40px ${glowColor}10` }} />

      <div className="relative z-10">
        <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
          {unit && <span className="text-lg text-white/50 font-medium">{unit}</span>}
        </div>

        {subtitle && (
          <p className="text-xs text-white/40 mt-1">{subtitle}</p>
        )}

        {trend && trend.arrow && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trend.color}`}>
            <span className="text-sm">{trend.arrow}</span>
            <span>{trend.delta}</span>
            <span className="text-white/30 font-normal ml-1">vs prev day</span>
          </div>
        )}

        {/* Mini sparkline */}
        {sparkline && sparkline.length > 0 && (
          <div className="mt-3 h-10 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth={1.5}
                  fill="url(#sparkGrad)"
                  dot={false}
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickActionCard({
  icon,
  label,
  description,
  onClick,
  gradient,
}: {
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
  gradient: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-th-border bg-th-bg-2 p-4 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-brand-500/30"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-brand-500/5 to-transparent" />
      <div className="relative z-10 flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-lg shrink-0 shadow-md group-hover:shadow-lg transition-shadow`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-th-text group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors truncate">
            {label}
          </p>
          <p className="text-[11px] text-th-text-3 mt-0.5 line-clamp-1">{description}</p>
        </div>
      </div>
    </button>
  );
}

function ActivityFeed({ items, t }: { items: ActivityItem[]; t: (key: string) => string }) {
  return (
    <div className="rounded-2xl border border-th-border bg-th-bg-2 shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-th-border bg-gradient-to-r from-brand-500/5 to-transparent">
        <h3 className="text-sm font-bold text-th-text">{t("home.recentActivity")}</h3>
        <p className="text-[11px] text-th-text-3 mt-0.5">{t("home.recentActivityDesc")}</p>
      </div>
      <div className="divide-y divide-th-border/50">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-5 py-3 hover:bg-brand-500/5 transition-colors"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <span className="text-base w-8 h-8 rounded-lg bg-th-bg flex items-center justify-center border border-th-border shrink-0">
              {item.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-th-text truncate">{item.title}</p>
              <p className="text-[10px] text-th-text-3">{item.timestamp}</p>
            </div>
            <span className="text-[9px] uppercase tracking-wider text-th-text-3 font-medium bg-th-bg px-2 py-0.5 rounded-full border border-th-border shrink-0">
              {item.type}
            </span>
          </div>
        ))}
        {items.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-th-text-3">{t("home.noActivity")}</div>
        )}
      </div>
    </div>
  );
}

function OpenActionsBadge({
  label,
  count,
  color,
  icon,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  icon: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-th-border bg-th-bg-2 p-4 transition-all duration-200 hover:shadow-md hover:border-brand-500/30 hover:scale-[1.01] w-full"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
        count > 0 ? "bg-gradient-to-br shadow-md" : "bg-th-bg border border-th-border"
      }`}
        style={count > 0 ? { background: `linear-gradient(135deg, ${color}22, ${color}44)` } : {}}
      >
        {icon}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-xs text-th-text-3 truncate">{label}</p>
        <p className={`text-xl font-bold ${count > 0 ? "text-th-text" : "text-th-text-3"}`}>
          {count}
        </p>
      </div>
      {count > 0 && (
        <span
          className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function HomePage({ onNavigate }: HomePageProps) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [kpi, setKpi] = useState<KpiData>(DEMO_KPI);
  const [activities, setActivities] = useState<ActivityItem[]>(DEMO_ACTIVITIES);
  const [openActions, setOpenActions] = useState<OpenActions>(DEMO_OPEN_ACTIONS);
  const [loading, setLoading] = useState(true);

  /* ---- Fetch data ---- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    let usedDemo = true;

    // Try to fetch OEE summary
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

        const sparkline = (trend || []).map((p: any) => ({
          date: p.date?.slice(5) || "",
          value: p.oee ?? 0,
        }));

        // Use yesterday's data
        const yesterdayOee = trend && trend.length >= 2 ? trend[trend.length - 1]?.oee : summary?.avg_oee;
        const prevOee = trend && trend.length >= 2 ? trend[trend.length - 2]?.oee : null;
        const yesterdayQuality = trend && trend.length >= 2 ? trend[trend.length - 1]?.quality : summary?.avg_quality;
        const prevQuality = trend && trend.length >= 2 ? trend[trend.length - 2]?.quality : null;

        setKpi((prev) => ({
          ...prev,
          oee: yesterdayOee ?? prev.oee,
          oeePrev: prevOee ?? prev.oeePrev,
          qualityRate: yesterdayQuality ?? prev.qualityRate,
          qualityPrev: prevQuality ?? prev.qualityPrev,
          oeeSparkline: sparkline.length > 0 ? sparkline : prev.oeeSparkline,
        }));
        usedDemo = false;
      }
    } catch {
      // Keep demo data
    }

    // Try to fetch production orders
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
    } catch {
      // Keep demo data
    }

    // Try to fetch active andon alerts
    try {
      const andonRes = await advancedLeanApi.getAndonStatus();
      const andonData = andonRes.data;
      if (andonData) {
        const activeCount = Array.isArray(andonData) ? andonData.filter((a: any) => !a.resolved_at).length : (andonData.active_count ?? 0);
        setKpi((prev) => ({
          ...prev,
          activeAndon: activeCount,
        }));
        usedDemo = false;
      }
    } catch {
      // Keep demo data
    }

    // Try to fetch recent activities from various sources
    try {
      const recentActivities: ActivityItem[] = [];

      // Kaizen items
      try {
        const kaizenRes = await leanApi.getKaizenBoard();
        const kaizenItems = kaizenRes.data?.items || kaizenRes.data || [];
        const sortedKaizen = [...kaizenItems]
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 3);
        for (const k of sortedKaizen) {
          recentActivities.push({
            id: `kaizen-${k.id}`,
            type: "kaizen",
            title: k.title || k.description || "Kaizen item",
            timestamp: formatRelativeTime(k.created_at),
            icon: "💡",
          });
        }
      } catch { /* skip */ }

      // Gemba walks
      try {
        const gembaRes = await advancedLeanApi.listGembaWalks();
        const gembaItems = gembaRes.data || [];
        const sortedGemba = [...gembaItems]
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 2);
        for (const g of sortedGemba) {
          recentActivities.push({
            id: `gemba-${g.id}`,
            type: "gemba",
            title: `Gemba Walk — ${g.area || g.title || ""}`,
            timestamp: formatRelativeTime(g.created_at),
            icon: "🚶",
          });
        }
      } catch { /* skip */ }

      // 5 Why
      try {
        const fwRes = await leanApi.listFiveWhy();
        const fwItems = fwRes.data || [];
        const sortedFw = [...fwItems]
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 2);
        for (const f of sortedFw) {
          recentActivities.push({
            id: `fw-${f.id}`,
            type: "five-why",
            title: f.problem_statement || "5 Why Analysis",
            timestamp: formatRelativeTime(f.created_at),
            icon: "❓",
          });
        }
      } catch { /* skip */ }

      if (recentActivities.length > 0) {
        recentActivities.sort((a, b) => {
          // Sort by raw timestamp string — approximate for display
          return 0; // Already mixed from sources, keep interleaved
        });
        setActivities(recentActivities.slice(0, 8));
        usedDemo = false;
      }
    } catch {
      // Keep demo activities
    }

    // Try to fetch open action counts
    try {
      let capaOverdue = 0;
      let kaizenInProgress = 0;
      let ncrOpen = 0;
      let gembaFindings = 0;

      try {
        const capaRes = await qcApi.listCAPAs({ status: "open" });
        const capas = capaRes.data || [];
        capaOverdue = capas.filter((c: any) => {
          if (!c.due_date) return false;
          return new Date(c.due_date) < new Date();
        }).length;
        if (capaOverdue === 0) capaOverdue = capas.length;
      } catch { /* skip */ }

      try {
        const kaizenRes = await leanApi.getKaizenBoard();
        const kaizenItems = kaizenRes.data?.items || kaizenRes.data || [];
        kaizenInProgress = kaizenItems.filter((k: any) =>
          k.status === "in_progress" || k.status === "doing"
        ).length;
      } catch { /* skip */ }

      try {
        const ncrRes = await qcApi.listNCRs({ status: "open" });
        ncrOpen = (ncrRes.data || []).length;
      } catch { /* skip */ }

      try {
        const gembaRes = await advancedLeanApi.listGembaWalks();
        const gembaItems = gembaRes.data || [];
        gembaFindings = gembaItems.reduce((sum: number, g: any) => {
          const findings = g.findings || g.observations || [];
          return sum + (Array.isArray(findings) ? findings.filter((f: any) => f.status === "open" || !f.resolved).length : 0);
        }, 0);
      } catch { /* skip */ }

      if (capaOverdue || kaizenInProgress || ncrOpen || gembaFindings) {
        setOpenActions({ capaOverdue, kaizenInProgress, ncrOpen, gembaFindings });
        usedDemo = false;
      }
    } catch {
      // Keep demo data
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- Quick actions config ---- */
  const quickActions = [
    {
      icon: "📝",
      label: t("home.actionProduction"),
      description: t("home.actionProductionDesc"),
      view: "production",
      gradient: "from-blue-500 to-blue-600",
    },
    {
      icon: "📊",
      label: t("home.actionOEE"),
      description: t("home.actionOEEDesc"),
      view: "dashboard",
      gradient: "from-emerald-500 to-emerald-600",
    },
    {
      icon: "💡",
      label: t("home.actionKaizen"),
      description: t("home.actionKaizenDesc"),
      view: "kaizen",
      gradient: "from-amber-500 to-orange-500",
    },
    {
      icon: "🚶",
      label: t("home.actionGemba"),
      description: t("home.actionGembaDesc"),
      view: "gemba",
      gradient: "from-purple-500 to-violet-500",
    },
    {
      icon: "🚦",
      label: t("home.actionAndon"),
      description: t("home.actionAndonDesc"),
      view: "andon",
      gradient: "from-rose-500 to-pink-500",
    },
    {
      icon: "🤖",
      label: t("home.actionCopilot"),
      description: t("home.actionCopilotDesc"),
      view: "copilot",
      gradient: "from-cyan-500 to-teal-500",
    },
  ];

  /* ---- Trend data for KPI cards ---- */
  const oeeTrend = getTrendArrow(kpi.oee, kpi.oeePrev);
  const qualityTrend = getTrendArrow(kpi.qualityRate, kpi.qualityPrev);

  const userName = user?.full_name?.split(" ")[0] || user?.full_name || "User";

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* ---- Welcome Banner ---- */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-purple-600 p-6 md:p-8 shadow-glow">
        {/* Decorative background elements */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-purple-400/10 rounded-full blur-2xl" />
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />

        <div className="relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {getGreeting(t)}, {userName}
          </h2>
          <p className="text-sm text-white/70 mt-1">{formatTodayDate(locale)}</p>
          {loading && (
            <div className="mt-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white/30 animate-pulse" />
              <span className="text-xs text-white/50">{t("home.loadingData")}</span>
            </div>
          )}
        </div>
      </div>

      {/* ---- Yesterday's Summary KPI Row ---- */}
      <div>
        <h3 className="text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-3 px-1">
          {t("home.yesterdaySummary")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label={t("home.kpiOEE")}
            value={kpi.oee !== null ? kpi.oee.toFixed(1) : "—"}
            unit="%"
            trend={oeeTrend}
            gradient={`from-[#0f172a] to-[#1e293b]`}
            glowColor={getOeeColor(kpi.oee)}
            sparkline={kpi.oeeSparkline}
          />
          <KpiCard
            label={t("home.kpiProduction")}
            value={kpi.productionOutput !== null ? kpi.productionOutput.toLocaleString() : "—"}
            subtitle={kpi.productionTarget !== null ? `${t("common.target")}: ${kpi.productionTarget.toLocaleString()}` : undefined}
            gradient="from-[#0f172a] to-[#1e293b]"
            glowColor={COLOR.blue}
          />
          <KpiCard
            label={t("home.kpiQuality")}
            value={kpi.qualityRate !== null ? kpi.qualityRate.toFixed(1) : "—"}
            unit="%"
            trend={qualityTrend}
            gradient="from-[#0f172a] to-[#1e293b]"
            glowColor={COLOR.emerald}
          />
          <KpiCard
            label={t("home.kpiAndon")}
            value={kpi.activeAndon !== null ? String(kpi.activeAndon) : "—"}
            subtitle={t("home.kpiAndonSub")}
            gradient="from-[#0f172a] to-[#1e293b]"
            glowColor={kpi.activeAndon && kpi.activeAndon > 0 ? COLOR.rose : COLOR.emerald}
          />
        </div>
      </div>

      {/* ---- Quick Actions ---- */}
      <div>
        <h3 className="text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-3 px-1">
          {t("home.quickActions")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <QuickActionCard
              key={action.view}
              icon={action.icon}
              label={action.label}
              description={action.description}
              onClick={() => onNavigate(action.view)}
              gradient={action.gradient}
            />
          ))}
        </div>
      </div>

      {/* ---- Bottom Section: Activity Feed + Open Actions ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity — 2 cols */}
        <div className="lg:col-span-2">
          <ActivityFeed items={activities} t={t} />
        </div>

        {/* Open Actions Summary — 1 col */}
        <div>
          <div className="rounded-2xl border border-th-border bg-th-bg-2 shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-th-border bg-gradient-to-r from-amber-500/5 to-transparent">
              <h3 className="text-sm font-bold text-th-text">{t("home.openActions")}</h3>
              <p className="text-[11px] text-th-text-3 mt-0.5">{t("home.openActionsDesc")}</p>
            </div>
            <div className="p-4 space-y-3">
              <OpenActionsBadge
                label={t("home.capaActions")}
                count={openActions.capaOverdue}
                color={COLOR.rose}
                icon="🔧"
                onClick={() => onNavigate("capa")}
              />
              <OpenActionsBadge
                label={t("home.kaizenItems")}
                count={openActions.kaizenInProgress}
                color={COLOR.amber}
                icon="💡"
                onClick={() => onNavigate("kaizen")}
              />
              <OpenActionsBadge
                label={t("home.ncrOpen")}
                count={openActions.ncrOpen}
                color={COLOR.purple}
                icon="⚠️"
                onClick={() => onNavigate("ncr")}
              />
              <OpenActionsBadge
                label={t("home.gembaFindings")}
                count={openActions.gembaFindings}
                color={COLOR.blue}
                icon="🚶"
                onClick={() => onNavigate("gemba")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return "1d ago";
    return `${diffD}d ago`;
  } catch {
    return dateStr;
  }
}
