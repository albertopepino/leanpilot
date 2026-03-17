"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { safetyApi, adminApi } from "@/lib/api";
import type { SafetyIncidentResponse, SafetyStats } from "@/lib/types";
import {
  Shield,
  AlertTriangle,
  Flame,
  Trophy,
  ClipboardList,
  FileText,
  BarChart3,
  Calendar,
  ArrowUpDown,
  Trash2,
  X,
  CheckCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

type Severity = "minor" | "moderate" | "serious" | "critical";
type IncidentType = "injury" | "near_miss" | "first_aid" | "property_damage" | "environmental";
type ViewMode = "counter" | "log" | "history" | "stats";

// ─── Constants ──────────────────────────────────────────────────────────────

const AREAS = [
  "Production Floor",
  "Machinery Zone",
  "Loading Area",
  "Storage Area",
  "Office Area",
  "Maintenance Bay",
];

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; border: string }> = {
  critical: { color: "#ef4444", bg: "bg-red-500/15",     border: "border-red-500/30" },
  serious:  { color: "#f59e0b", bg: "bg-amber-500/15",   border: "border-amber-500/30" },
  moderate: { color: "#eab308", bg: "bg-yellow-500/15",  border: "border-yellow-500/30" },
  minor:    { color: "#22c55e", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
};

const INCIDENT_TYPES: IncidentType[] = ["injury", "near_miss", "first_aid", "property_damage", "environmental"];

const CHART_COLORS = ["#ef4444", "#f59e0b", "#eab308", "#22c55e"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Component ──────────────────────────────────────────────────────────────

export default function SafetyTracker() {
  const { t } = useI18n();
  const [incidents, setIncidents] = useState<SafetyIncidentResponse[]>([]);
  const [stats, setStats] = useState<SafetyStats | null>(null);
  const [productionLines, setProductionLines] = useState<{id: number; name: string}[]>([]);
  const [view, setView] = useState<ViewMode>("counter");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  // Show toast
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [incRes, statsRes] = await Promise.all([
        safetyApi.listIncidents({
          date_from: filterFrom || undefined,
          date_to: filterTo || undefined,
        }),
        safetyApi.getStats(),
      ]);
      setIncidents(incRes.data ?? []);
      setStats(statsRes.data ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [filterFrom, filterTo]);

  // Load production lines + initial data
  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.getFactory();
        const factory = res.data ?? res;
        const lines = factory?.production_lines ?? [];
        setProductionLines(lines);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered incidents (already filtered by API, but we sort client-side)
  const filtered = useMemo(() => {
    return [...incidents].sort((a, b) => b.date.localeCompare(a.date));
  }, [incidents]);

  // Streak calculations from stats
  const currentStreak = stats?.days_without_incident ?? 0;
  const lastIncidentDate = incidents.length > 0 ? incidents[0]?.date ?? "" : "";

  // Best streak: computed client-side from incident dates
  const bestStreak = useMemo(() => {
    if (incidents.length === 0) return 0;
    const sorted = [...incidents].sort((a, b) => b.date.localeCompare(a.date));
    const today = new Date().toISOString().slice(0, 10);
    let best = currentStreak;
    for (let i = 0; i < sorted.length - 1; i++) {
      const d1 = new Date(sorted[i].date).getTime();
      const d2 = new Date(sorted[i + 1].date).getTime();
      const gap = Math.floor(Math.abs(d2 - d1) / 86_400_000);
      if (gap > best) best = gap;
    }
    return best;
  }, [incidents, currentStreak]);

  // Add incident
  const handleAdd = useCallback(async (data: {
    date: string;
    incident_type: string;
    severity: string;
    title: string;
    description: string;
    location: string;
    production_line_id: number | null;
    corrective_action: string;
  }) => {
    try {
      await safetyApi.createIncident({
        date: data.date,
        incident_type: data.incident_type,
        severity: data.severity,
        title: data.title,
        description: data.description || null,
        location: data.location || null,
        production_line_id: data.production_line_id,
        corrective_action: data.corrective_action || null,
      });
      showToast(t("safety.incidentSaved"));
      setView("counter");
      fetchData();
    } catch {
      showToast(t("common.saveFailed"));
    }
  }, [fetchData, showToast, t]);

  // Delete incident
  const handleDelete = useCallback(async (id: number) => {
    if (!confirm(t("safety.deleteConfirm"))) return;
    try {
      await safetyApi.deleteIncident(id);
      showToast(t("safety.deleted"));
      fetchData();
    } catch {
      showToast(t("common.saveFailed"));
    }
  }, [fetchData, showToast, t]);

  // View tabs
  const tabs: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: "counter", label: t("safety.viewCounter"), icon: <Shield className="w-4 h-4" /> },
    { key: "log",     label: t("safety.viewLog"),     icon: <FileText className="w-4 h-4" /> },
    { key: "history", label: t("safety.viewHistory"), icon: <ClipboardList className="w-4 h-4" /> },
    { key: "stats",   label: t("safety.viewStats"),   icon: <BarChart3 className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-top-2 fade-in duration-200">
          <CheckCircle className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* Date Range Filter */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-th-text-3" />
          <span className="text-sm font-medium text-th-text-2">{t("safety.dateRangeFilter")}:</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-th-text-3">{t("safety.from")}</label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-th-border bg-th-bg text-th-text text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-th-text-3">{t("safety.to")}</label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-th-border bg-th-bg text-th-text text-sm"
          />
        </div>
        {(filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterFrom(""); setFilterTo(""); }}
            className="flex items-center gap-1 text-xs text-th-text-3 hover:text-th-text-2 font-medium"
          >
            <X className="w-3 h-3" />
            {t("safety.clearFilter")}
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              view === tab.key
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-th-bg-2 text-th-text-2 border border-th-border hover:bg-th-bg"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Views */}
      {view === "counter" && (
        <CounterView
          currentStreak={currentStreak}
          bestStreak={bestStreak}
          lastIncidentDate={lastIncidentDate}
          t={t}
        />
      )}
      {view === "log" && (
        <LogForm
          t={t}
          onSubmit={handleAdd}
          productionLines={productionLines}
        />
      )}
      {view === "history" && (
        <HistoryTable
          incidents={filtered}
          productionLines={productionLines}
          t={t}
          onDelete={handleDelete}
        />
      )}
      {view === "stats" && <StatsView incidents={filtered} t={t} />}
    </div>
  );
}

// ─── Counter View ───────────────────────────────────────────────────────────

function CounterView({
  currentStreak,
  bestStreak,
  lastIncidentDate,
  t,
}: {
  currentStreak: number;
  bestStreak: number;
  lastIncidentDate: string;
  t: (key: string) => string;
}) {
  const [animatedCount, setAnimatedCount] = useState(0);

  useEffect(() => {
    if (currentStreak === 0) { setAnimatedCount(0); return; }
    let frame = 0;
    const total = Math.min(currentStreak, 60); // frames
    const step = currentStreak / total;
    const iv = setInterval(() => {
      frame++;
      setAnimatedCount(Math.min(Math.round(step * frame), currentStreak));
      if (frame >= total) clearInterval(iv);
    }, 25);
    return () => clearInterval(iv);
  }, [currentStreak]);

  // Color based on streak
  const streakColor =
    currentStreak >= 30
      ? { ring: "#22c55e", glow: "rgba(34,197,94,0.3)", text: "text-emerald-400", label: "#22c55e" }
      : currentStreak >= 10
        ? { ring: "#f59e0b", glow: "rgba(245,158,11,0.3)", text: "text-amber-400", label: "#f59e0b" }
        : { ring: "#ef4444", glow: "rgba(239,68,68,0.3)", text: "text-red-400", label: "#ef4444" };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main gauge */}
      <div className="lg:col-span-2 rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-8 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
        {/* Ambient glow */}
        <div
          className="absolute inset-0 opacity-20 rounded-xl"
          style={{ background: `radial-gradient(circle at 50% 40%, ${streakColor.glow}, transparent 70%)` }}
        />

        <h2 className="text-lg font-semibold text-th-text-2 mb-6 tracking-wide uppercase relative z-10">
          {t("safety.daysWithoutIncidents")}
        </h2>

        {/* SVG Radial Gauge */}
        <div className="relative w-64 h-64 z-10">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Background ring */}
            <circle
              cx="100" cy="100" r="85"
              fill="none" stroke="currentColor" strokeWidth="12" className="text-th-border"
            />
            {/* Progress ring */}
            <circle
              cx="100" cy="100" r="85"
              fill="none"
              stroke={streakColor.ring}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${Math.min((animatedCount / 365) * 534, 534)} 534`}
              transform="rotate(-90 100 100)"
              style={{ transition: "stroke-dasharray 0.3s ease", filter: `drop-shadow(0 0 8px ${streakColor.glow})` }}
            />
            {/* Decorative ticks */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <line
                key={deg}
                x1="100" y1="22" x2="100" y2="28"
                stroke="currentColor" strokeWidth="1" className="text-th-border"
                transform={`rotate(${deg} 100 100)`}
              />
            ))}
          </svg>
          {/* Center number */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-7xl font-black tabular-nums ${streakColor.text}`} style={{ textShadow: `0 0 30px ${streakColor.glow}` }}>
              {animatedCount}
            </span>
            <span className="text-sm text-th-text-3 uppercase tracking-widest mt-1">{t("safety.days")}</span>
          </div>
        </div>

        {/* Last incident */}
        {lastIncidentDate && (
          <p className="text-sm text-th-text-3 mt-6 relative z-10 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            {t("safety.lastIncident")}: <span className="text-th-text-2 font-medium">{lastIncidentDate}</span>
          </p>
        )}
        {!lastIncidentDate && (
          <p className="text-sm text-th-text-3 mt-6 relative z-10">{t("safety.noIncidentsRecorded")}</p>
        )}
      </div>

      {/* Side cards */}
      <div className="space-y-6">
        {/* Current streak card */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Flame className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-sm font-medium text-th-text-2 uppercase tracking-wide">{t("safety.currentStreak")}</span>
          </div>
          <div className={`text-4xl font-black ${streakColor.text}`}>{currentStreak}</div>
          <div className="text-xs text-th-text-3 mt-1">{t("safety.days")}</div>
        </div>

        {/* Best streak card */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm font-medium text-th-text-2 uppercase tracking-wide">{t("safety.bestStreak")}</span>
          </div>
          <div className="text-4xl font-black text-amber-400">{bestStreak}</div>
          <div className="text-xs text-th-text-3 mt-1">{t("safety.days")}</div>
        </div>

        {/* Severity legend */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-th-text-3" />
            <h3 className="text-sm font-medium text-th-text-2 uppercase tracking-wide">{t("safety.severity")}</h3>
          </div>
          <div className="space-y-3">
            {(["critical", "serious", "moderate", "minor"] as Severity[]).map((sev) => (
              <div key={sev} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SEVERITY_CONFIG[sev].color }} />
                <span className="text-sm text-th-text-2">{t(`safety.severity${sev.charAt(0).toUpperCase()}${sev.slice(1)}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Log Form ───────────────────────────────────────────────────────────────

function LogForm({
  t,
  onSubmit,
  productionLines,
}: {
  t: (key: string) => string;
  onSubmit: (data: {
    date: string;
    incident_type: string;
    severity: string;
    title: string;
    description: string;
    location: string;
    production_line_id: number | null;
    corrective_action: string;
  }) => void;
  productionLines: { id: number; name: string }[];
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [incidentType, setIncidentType] = useState<IncidentType>("near_miss");
  const [severity, setSeverity] = useState<Severity>("minor");
  const [title, setTitle] = useState("");
  const [lineId, setLineId] = useState<number | null>(productionLines[0]?.id ?? null);
  const [area, setArea] = useState(AREAS[0]);
  const [description, setDescription] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !title.trim()) {
      setError(t("safety.fillRequired"));
      return;
    }
    setError("");
    onSubmit({
      date,
      incident_type: incidentType,
      severity,
      title: title.trim(),
      description: description.trim(),
      location: area,
      production_line_id: lineId,
      corrective_action: correctiveAction.trim(),
    });
    setTitle("");
    setDescription("");
    setCorrectiveAction("");
  };

  const severityOptions: { value: Severity; label: string }[] = [
    { value: "critical", label: t("safety.severityCritical") },
    { value: "serious",  label: t("safety.severitySerious") },
    { value: "moderate", label: t("safety.severityModerate") },
    { value: "minor",    label: t("safety.severityMinor") },
  ];

  const typeOptions: { value: IncidentType; label: string }[] = [
    { value: "injury",          label: t("safety.typeInjury") },
    { value: "near_miss",       label: t("safety.typeNearMiss") },
    { value: "first_aid",       label: t("safety.typeFirstAid") },
    { value: "property_damage", label: t("safety.typePropertyDamage") },
    { value: "environmental",   label: t("safety.typeEnvironmental") },
  ];

  const inputCls = "w-full px-4 py-3 rounded-lg border border-th-border bg-th-bg text-th-text text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none";
  const labelCls = "text-xs font-medium text-th-text-2 mb-1.5 block";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-th-text">{t("safety.logIncident")}</h2>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Date */}
            <div>
              <label className={labelCls}>{t("safety.incidentDate")} *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
            </div>

            {/* Title */}
            <div>
              <label className={labelCls}>{t("safety.incidentTitle")} *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("safety.incidentTitlePlaceholder")}
                className={inputCls}
                required
              />
            </div>

            {/* Incident Type */}
            <div>
              <label className={labelCls}>{t("safety.incidentType")}</label>
              <select value={incidentType} onChange={(e) => setIncidentType(e.target.value as IncidentType)} className={inputCls}>
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className={labelCls}>{t("safety.severity")} *</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className={inputCls}>
                {severityOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Production Line */}
            <div>
              <label className={labelCls}>{t("safety.productionLine")}</label>
              <select
                value={lineId ?? ""}
                onChange={(e) => setLineId(e.target.value ? Number(e.target.value) : null)}
                className={inputCls}
              >
                <option value="">{t("safety.allLines")}</option>
                {productionLines.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Area */}
            <div>
              <label className={labelCls}>{t("safety.areaZone")}</label>
              <select value={area} onChange={(e) => setArea(e.target.value)} className={inputCls}>
                {AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>{t("safety.incidentDescription")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("safety.incidentDescriptionPlaceholder")}
              rows={3}
              className={inputCls + " resize-none"}
            />
          </div>

          {/* Corrective Action */}
          <div>
            <label className={labelCls}>{t("safety.actionsTaken")}</label>
            <textarea
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              placeholder={t("safety.actionsTakenPlaceholder")}
              rows={3}
              className={inputCls + " resize-none"}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-lg font-semibold transition-all text-sm"
          >
            {t("safety.submitIncident")}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── History Table ──────────────────────────────────────────────────────────

function HistoryTable({
  incidents,
  productionLines,
  t,
  onDelete,
}: {
  incidents: SafetyIncidentResponse[];
  productionLines: { id: number; name: string }[];
  t: (key: string) => string;
  onDelete: (id: number) => void;
}) {
  const [sevFilter, setSevFilter] = useState<Severity | "">("");
  const [lineFilter, setLineFilter] = useState<number | "">("");
  const [sortAsc, setSortAsc] = useState(false);

  const lineNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    productionLines.forEach((l) => { map[l.id] = l.name; });
    return map;
  }, [productionLines]);

  const displayed = useMemo(() => {
    let list = [...incidents];
    if (sevFilter) list = list.filter((i) => i.severity === sevFilter);
    if (lineFilter) list = list.filter((i) => i.production_line_id === lineFilter);
    if (sortAsc) list.sort((a, b) => a.date.localeCompare(b.date));
    else list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }, [incidents, sevFilter, lineFilter, sortAsc]);

  const severityBadge = (sev: string) => {
    const cfg = SEVERITY_CONFIG[sev as Severity] ?? SEVERITY_CONFIG.minor;
    const label = t(`safety.severity${sev.charAt(0).toUpperCase()}${sev.slice(1)}`);
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${cfg.bg} ${cfg.border} border`} style={{ color: cfg.color }}>
        {label}
      </span>
    );
  };

  const selectCls = "px-3 py-1.5 rounded-lg border border-th-border bg-th-bg text-th-text text-sm";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 flex flex-wrap items-center gap-4">
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value as Severity | "")} className={selectCls}>
          <option value="">{t("safety.allSeverities")}</option>
          <option value="critical">{t("safety.severityCritical")}</option>
          <option value="serious">{t("safety.severitySerious")}</option>
          <option value="moderate">{t("safety.severityModerate")}</option>
          <option value="minor">{t("safety.severityMinor")}</option>
        </select>
        <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value ? Number(e.target.value) : "")} className={selectCls}>
          <option value="">{t("safety.allLines")}</option>
          {productionLines.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center gap-1.5 text-sm text-th-text-2 hover:text-th-text font-medium"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {t("safety.sortByDate")}
        </button>
      </div>

      {/* Table */}
      {displayed.length === 0 ? (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-12 text-center">
          <p className="text-th-text-3">{t("safety.noIncidents")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-th-border">
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("common.date")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("safety.severity")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("safety.incidentType")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("safety.productionLine")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("common.description")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("safety.actionsTaken")}</th>
                  <th className="text-center px-4 py-3 text-th-text-2 font-semibold">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((inc) => (
                  <tr key={inc.id} className="border-b border-th-border/50 hover:bg-th-bg transition">
                    <td className="px-4 py-3 text-th-text whitespace-nowrap">{inc.date}</td>
                    <td className="px-4 py-3">{severityBadge(inc.severity)}</td>
                    <td className="px-4 py-3 text-th-text whitespace-nowrap">{t(`safety.type${inc.incident_type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("")}`)}</td>
                    <td className="px-4 py-3 text-th-text whitespace-nowrap">{inc.production_line_id ? (lineNameMap[inc.production_line_id] ?? "-") : "-"}</td>
                    <td className="px-4 py-3 text-th-text max-w-xs truncate" title={inc.title}>{inc.title}</td>
                    <td className="px-4 py-3 text-th-text-2 max-w-xs truncate" title={inc.corrective_action ?? ""}>{inc.corrective_action ?? ""}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onDelete(inc.id)}
                        className="text-red-400 hover:text-red-300 transition p-1"
                        title={t("common.delete")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stats View ─────────────────────────────────────────────────────────────

function StatsView({
  incidents,
  t,
}: {
  incidents: SafetyIncidentResponse[];
  t: (key: string) => string;
}) {
  // Incidents by month
  const byMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach((inc) => {
      const key = inc.date.slice(0, 7); // YYYY-MM
      counts[key] = (counts[key] || 0) + 1;
    });
    // Last 12 months
    const result: { month: string; count: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = MONTH_NAMES[d.getMonth()];
      result.push({ month: label, count: counts[key] || 0 });
    }
    return result;
  }, [incidents]);

  // Incidents by severity
  const bySeverity = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    incidents.forEach((inc) => { counts[inc.severity] = (counts[inc.severity] || 0) + 1; });
    return [
      { name: t("safety.severityCritical"), value: counts.critical },
      { name: t("safety.severitySerious"),  value: counts.serious },
      { name: t("safety.severityModerate"), value: counts.moderate },
      { name: t("safety.severityMinor"),    value: counts.minor },
    ].filter((d) => d.value > 0);
  }, [incidents, t]);

  // Incidents by type
  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach((inc) => { counts[inc.incident_type] = (counts[inc.incident_type] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, count]) => ({ name: t(`safety.type${name.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("")}`), count }))
      .sort((a, b) => b.count - a.count);
  }, [incidents, t]);

  // Year-over-year
  const yoy = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;
    const result: { month: string; thisYear: number; lastYear: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const tyKey = `${thisYear}-${String(m + 1).padStart(2, "0")}`;
      const lyKey = `${lastYear}-${String(m + 1).padStart(2, "0")}`;
      const tyCount = incidents.filter((i) => i.date.startsWith(tyKey)).length;
      const lyCount = incidents.filter((i) => i.date.startsWith(lyKey)).length;
      result.push({ month: MONTH_NAMES[m], thisYear: tyCount, lastYear: lyCount });
    }
    return result;
  }, [incidents]);

  const chartTooltipStyle = {
    contentStyle: {
      backgroundColor: "var(--color-th-bg-2, rgba(17,17,27,0.95))",
      border: "1px solid var(--color-th-border, rgba(255,255,255,0.1))",
      borderRadius: 12,
      color: "var(--color-th-text, #e0e0e0)",
      fontSize: 12,
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Incidents by Month */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-th-text-3" />
          <h3 className="text-sm font-semibold text-th-text-2 uppercase tracking-wide">{t("safety.incidentsByMonth")}</h3>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-th-border, rgba(255,255,255,0.06))" />
            <XAxis dataKey="month" tick={{ fill: "var(--color-th-text-3, rgba(255,255,255,0.5))", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--color-th-text-3, rgba(255,255,255,0.5))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...chartTooltipStyle} />
            <Bar dataKey="count" name={t("safety.count")} fill="#3b82f6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Incidents by Severity */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-th-text-3" />
          <h3 className="text-sm font-semibold text-th-text-2 uppercase tracking-wide">{t("safety.incidentsBySeverity")}</h3>
        </div>
        {bySeverity.length === 0 ? (
          <div className="flex items-center justify-center h-[260px] text-th-text-3 text-sm">{t("safety.noIncidents")}</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={bySeverity}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                stroke="none"
              >
                {bySeverity.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...chartTooltipStyle} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => <span className="text-th-text-2 text-xs">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Incidents by Type */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-4 h-4 text-th-text-3" />
          <h3 className="text-sm font-semibold text-th-text-2 uppercase tracking-wide">{t("safety.incidentsByType")}</h3>
        </div>
        {byType.length === 0 ? (
          <div className="flex items-center justify-center h-[260px] text-th-text-3 text-sm">{t("safety.noIncidents")}</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-th-border, rgba(255,255,255,0.06))" />
              <XAxis type="number" tick={{ fill: "var(--color-th-text-3, rgba(255,255,255,0.5))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "var(--color-th-text-3, rgba(255,255,255,0.5))", fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="count" name={t("safety.count")} fill="#8b5cf6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Year-over-Year */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-th-text-3" />
          <h3 className="text-sm font-semibold text-th-text-2 uppercase tracking-wide">{t("safety.yearOverYear")}</h3>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={yoy}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-th-border, rgba(255,255,255,0.06))" />
            <XAxis dataKey="month" tick={{ fill: "var(--color-th-text-3, rgba(255,255,255,0.5))", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--color-th-text-3, rgba(255,255,255,0.5))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...chartTooltipStyle} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => <span className="text-th-text-2 text-xs">{value}</span>}
            />
            <Bar dataKey="thisYear" name={t("safety.thisYear")} fill="#10b981" radius={[6, 6, 0, 0]} />
            <Bar dataKey="lastYear" name={t("safety.lastYear")} fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
