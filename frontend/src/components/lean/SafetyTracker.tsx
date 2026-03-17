"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
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

type Severity = "grave" | "lieve" | "near_miss" | "first_aid";
type ViewMode = "counter" | "log" | "history" | "stats";

interface SafetyIncident {
  id: string;
  date: string;
  severity: Severity;
  line: string;
  area: string;
  description: string;
  actionsTaken: string;
  createdAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "leanpilot_safety_incidents";

const LINES = [
  "Assembly Line A",
  "Assembly Line B",
  "CNC Department",
  "Packaging",
  "Warehouse",
  "Paint Shop",
  "Shipping Dock",
];

const AREAS = [
  "Production Floor",
  "Machinery Zone",
  "Loading Area",
  "Storage Area",
  "Office Area",
  "Maintenance Bay",
];

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; border: string; glow: string }> = {
  grave:     { color: "#ef4444", bg: "bg-red-500/20",    border: "border-red-500/40",    glow: "shadow-red-500/20" },
  lieve:     { color: "#f59e0b", bg: "bg-amber-500/20",  border: "border-amber-500/40",  glow: "shadow-amber-500/20" },
  near_miss: { color: "#eab308", bg: "bg-yellow-500/20", border: "border-yellow-500/40", glow: "shadow-yellow-500/20" },
  first_aid: { color: "#22c55e", bg: "bg-emerald-500/20", border: "border-emerald-500/40", glow: "shadow-emerald-500/20" },
};

const CHART_COLORS = ["#ef4444", "#f59e0b", "#eab308", "#22c55e"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Demo Data ──────────────────────────────────────────────────────────────

function generateDemoIncidents(): SafetyIncident[] {
  const now = new Date();
  const demos: Omit<SafetyIncident, "id" | "createdAt">[] = [
    { date: daysAgo(now, 3),   severity: "first_aid", line: "Assembly Line A", area: "Production Floor", description: "Minor cut on hand during material handling", actionsTaken: "First aid applied, gloves requirement reinforced" },
    { date: daysAgo(now, 18),  severity: "near_miss", line: "CNC Department",  area: "Machinery Zone",  description: "Loose bolt on CNC guard detected during inspection", actionsTaken: "Guard re-secured, added to CILT checklist" },
    { date: daysAgo(now, 35),  severity: "lieve",     line: "Packaging",       area: "Loading Area",    description: "Operator tripped over misplaced pallet", actionsTaken: "5S audit initiated, floor markings refreshed" },
    { date: daysAgo(now, 52),  severity: "first_aid", line: "Paint Shop",      area: "Production Floor", description: "Mild irritation from solvent splash on forearm", actionsTaken: "PPE compliance check, chemical safety refresher training" },
    { date: daysAgo(now, 78),  severity: "near_miss", line: "Warehouse",       area: "Storage Area",    description: "Forklift near collision at blind corner", actionsTaken: "Convex mirrors installed, speed limit signs added" },
    { date: daysAgo(now, 95),  severity: "grave",     line: "Assembly Line B", area: "Machinery Zone",  description: "Finger caught in conveyor belt pinch point", actionsTaken: "Machine guarding upgraded, lockout/tagout procedure revised" },
    { date: daysAgo(now, 130), severity: "first_aid", line: "Shipping Dock",   area: "Loading Area",    description: "Back strain from improper lifting technique", actionsTaken: "Ergonomics training scheduled, lifting aids procured" },
    { date: daysAgo(now, 160), severity: "near_miss", line: "CNC Department",  area: "Maintenance Bay", description: "Oil spill not cleaned up, slip hazard", actionsTaken: "Spill kits relocated, cleaning SOP updated" },
    { date: daysAgo(now, 200), severity: "lieve",     line: "Assembly Line A", area: "Production Floor", description: "Small burn from hot soldering iron contact", actionsTaken: "Insulated tool holders installed, safety zone marked" },
    { date: daysAgo(now, 250), severity: "first_aid", line: "Packaging",       area: "Storage Area",    description: "Paper cut from cardboard box edge", actionsTaken: "Cut-resistant gloves provided for packaging team" },
  ];

  return demos.map((d, i) => ({
    ...d,
    id: `demo-${i + 1}`,
    createdAt: d.date,
  }));
}

function daysAgo(from: Date, n: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadIncidents(): SafetyIncident[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  // Seed demo data
  const demo = generateDemoIncidents();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
  return demo;
}

function saveIncidents(incidents: SafetyIncident[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
}

function calcDaysBetween(a: string, b: string): number {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.floor(Math.abs(msB - msA) / 86_400_000);
}

function uuid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SafetyTracker() {
  const { t } = useI18n();
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [view, setView] = useState<ViewMode>("counter");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [toast, setToast] = useState("");

  // Load on mount
  useEffect(() => {
    setIncidents(loadIncidents());
  }, []);

  // Persist
  const persist = useCallback((next: SafetyIncident[]) => {
    setIncidents(next);
    saveIncidents(next);
  }, []);

  // Show toast
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  // Filtered incidents
  const filtered = useMemo(() => {
    let list = [...incidents].sort((a, b) => b.date.localeCompare(a.date));
    if (filterFrom) list = list.filter((i) => i.date >= filterFrom);
    if (filterTo) list = list.filter((i) => i.date <= filterTo);
    return list;
  }, [incidents, filterFrom, filterTo]);

  // Streak calculations
  const { currentStreak, bestStreak, lastIncidentDate } = useMemo(() => {
    if (incidents.length === 0) return { currentStreak: 0, bestStreak: 0, lastIncidentDate: "" };
    const sorted = [...incidents].sort((a, b) => b.date.localeCompare(a.date));
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = sorted[0].date;
    const current = calcDaysBetween(lastDate, today);

    // Calculate best streak
    let best = current;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = calcDaysBetween(sorted[i].date, sorted[i + 1].date);
      if (gap > best) best = gap;
    }
    return { currentStreak: current, bestStreak: best, lastIncidentDate: lastDate };
  }, [incidents]);

  // Add incident
  const handleAdd = useCallback((inc: Omit<SafetyIncident, "id" | "createdAt">) => {
    const newInc: SafetyIncident = {
      ...inc,
      id: uuid(),
      createdAt: new Date().toISOString(),
    };
    persist([newInc, ...incidents]);
    showToast(t("safety.incidentSaved"));
    setView("counter");
  }, [incidents, persist, showToast, t]);

  // Delete incident
  const handleDelete = useCallback((id: string) => {
    if (!confirm(t("safety.deleteConfirm"))) return;
    persist(incidents.filter((i) => i.id !== id));
    showToast(t("safety.deleted"));
  }, [incidents, persist, showToast, t]);

  // View tabs
  const tabs: { key: ViewMode; label: string; icon: string }[] = [
    { key: "counter", label: t("safety.viewCounter"), icon: "🛡️" },
    { key: "log",     label: t("safety.viewLog"),     icon: "📝" },
    { key: "history", label: t("safety.viewHistory"), icon: "📋" },
    { key: "stats",   label: t("safety.viewStats"),   icon: "📊" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-top-2 fade-in duration-200">
          {toast}
        </div>
      )}

      {/* Date Range Filter */}
      <div className="bg-th-bg-2 rounded-2xl p-4 shadow-card border border-th-border flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-th-text-2">{t("safety.dateRangeFilter")}:</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-th-text-3">{t("safety.from")}</label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-th-border bg-th-input text-th-text text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-th-text-3">{t("safety.to")}</label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-th-border bg-th-input text-th-text text-sm"
          />
        </div>
        {(filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterFrom(""); setFilterTo(""); }}
            className="text-xs text-brand-500 hover:text-brand-400 font-medium"
          >
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
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              view === tab.key
                ? "bg-brand-600 text-white shadow-glow"
                : "bg-th-bg-2 text-th-text-2 border border-th-border hover:bg-th-bg-2/80"
            }`}
          >
            <span>{tab.icon}</span>
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
      {view === "log" && <LogForm t={t} onSubmit={handleAdd} />}
      {view === "history" && (
        <HistoryTable incidents={filtered} t={t} onDelete={handleDelete} />
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
      <div className="lg:col-span-2 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 shadow-xl border border-white/10 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
        {/* Ambient glow */}
        <div
          className="absolute inset-0 opacity-20 rounded-2xl"
          style={{ background: `radial-gradient(circle at 50% 40%, ${streakColor.glow}, transparent 70%)` }}
        />

        <h2 className="text-lg font-semibold text-white/70 mb-6 tracking-wide uppercase relative z-10">
          {t("safety.daysWithoutIncidents")}
        </h2>

        {/* SVG Radial Gauge */}
        <div className="relative w-64 h-64 z-10">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Background ring */}
            <circle
              cx="100" cy="100" r="85"
              fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12"
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
                stroke="rgba(255,255,255,0.15)" strokeWidth="1"
                transform={`rotate(${deg} 100 100)`}
              />
            ))}
          </svg>
          {/* Center number */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-7xl font-black tabular-nums ${streakColor.text}`} style={{ textShadow: `0 0 30px ${streakColor.glow}` }}>
              {animatedCount}
            </span>
            <span className="text-sm text-white/50 uppercase tracking-widest mt-1">{t("safety.days")}</span>
          </div>
        </div>

        {/* Last incident */}
        {lastIncidentDate && (
          <p className="text-sm text-white/40 mt-6 relative z-10">
            {t("safety.lastIncident")}: <span className="text-white/70 font-medium">{lastIncidentDate}</span>
          </p>
        )}
        {!lastIncidentDate && (
          <p className="text-sm text-white/40 mt-6 relative z-10">{t("safety.noIncidentsRecorded")}</p>
        )}
      </div>

      {/* Side cards */}
      <div className="space-y-6">
        {/* Current streak card */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl">🔥</div>
            <span className="text-sm font-medium text-white/60 uppercase tracking-wide">{t("safety.currentStreak")}</span>
          </div>
          <div className={`text-4xl font-black ${streakColor.text}`}>{currentStreak}</div>
          <div className="text-xs text-white/40 mt-1">{t("safety.days")}</div>
        </div>

        {/* Best streak card */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl">🏆</div>
            <span className="text-sm font-medium text-white/60 uppercase tracking-wide">{t("safety.bestStreak")}</span>
          </div>
          <div className="text-4xl font-black text-amber-400">{bestStreak}</div>
          <div className="text-xs text-white/40 mt-1">{t("safety.days")}</div>
        </div>

        {/* Severity legend */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-white/10">
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-4">{t("safety.severity")}</h3>
          <div className="space-y-3">
            {(["grave", "lieve", "near_miss", "first_aid"] as Severity[]).map((sev) => (
              <div key={sev} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SEVERITY_CONFIG[sev].color }} />
                <span className="text-sm text-white/70">{t(`safety.severity${sev.charAt(0).toUpperCase()}${sev.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`)}</span>
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
}: {
  t: (key: string) => string;
  onSubmit: (inc: Omit<SafetyIncident, "id" | "createdAt">) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [severity, setSeverity] = useState<Severity>("near_miss");
  const [line, setLine] = useState(LINES[0]);
  const [area, setArea] = useState(AREAS[0]);
  const [description, setDescription] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !description.trim()) {
      setError(t("safety.fillRequired"));
      return;
    }
    setError("");
    onSubmit({ date, severity, line, area, description: description.trim(), actionsTaken: actionsTaken.trim() });
    setDescription("");
    setActionsTaken("");
  };

  const severityOptions: { value: Severity; label: string }[] = [
    { value: "grave",     label: t("safety.severityGrave") },
    { value: "lieve",     label: t("safety.severityLieve") },
    { value: "near_miss", label: t("safety.severityNearMiss") },
    { value: "first_aid", label: t("safety.severityFirstAid") },
  ];

  const inputCls = "w-full px-4 py-3 rounded-xl border border-th-border bg-th-input text-th-text text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none";
  const labelCls = "text-xs font-medium text-th-text-2 mb-1.5 block";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-th-bg-2 rounded-2xl p-8 shadow-card border border-th-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-xl">🚨</div>
          <h2 className="text-lg font-bold text-th-text">{t("safety.logIncident")}</h2>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-xl mb-4">
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
              <select value={line} onChange={(e) => setLine(e.target.value)} className={inputCls}>
                {LINES.map((l) => (
                  <option key={l} value={l}>{l}</option>
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
            <label className={labelCls}>{t("safety.incidentDescription")} *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("safety.incidentDescriptionPlaceholder")}
              rows={3}
              className={inputCls + " resize-none"}
              required
            />
          </div>

          {/* Actions Taken */}
          <div>
            <label className={labelCls}>{t("safety.actionsTaken")}</label>
            <textarea
              value={actionsTaken}
              onChange={(e) => setActionsTaken(e.target.value)}
              placeholder={t("safety.actionsTakenPlaceholder")}
              rows={3}
              className={inputCls + " resize-none"}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-brand-600 to-brand-500 text-white py-3 rounded-xl font-semibold hover:shadow-glow transition-all text-sm"
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
  t,
  onDelete,
}: {
  incidents: SafetyIncident[];
  t: (key: string) => string;
  onDelete: (id: string) => void;
}) {
  const [sevFilter, setSevFilter] = useState<Severity | "">("");
  const [lineFilter, setLineFilter] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  const displayed = useMemo(() => {
    let list = [...incidents];
    if (sevFilter) list = list.filter((i) => i.severity === sevFilter);
    if (lineFilter) list = list.filter((i) => i.line === lineFilter);
    if (sortAsc) list.sort((a, b) => a.date.localeCompare(b.date));
    else list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }, [incidents, sevFilter, lineFilter, sortAsc]);

  const severityBadge = (sev: Severity) => {
    const cfg = SEVERITY_CONFIG[sev];
    const label =
      sev === "grave" ? t("safety.severityGrave")
      : sev === "lieve" ? t("safety.severityLieve")
      : sev === "near_miss" ? t("safety.severityNearMiss")
      : t("safety.severityFirstAid");
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.border} border`} style={{ color: cfg.color }}>
        {label}
      </span>
    );
  };

  const selectCls = "px-3 py-1.5 rounded-lg border border-th-border bg-th-input text-th-text text-sm";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-th-bg-2 rounded-2xl p-4 shadow-card border border-th-border flex flex-wrap items-center gap-4">
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value as Severity | "")} className={selectCls}>
          <option value="">{t("safety.allSeverities")}</option>
          <option value="grave">{t("safety.severityGrave")}</option>
          <option value="lieve">{t("safety.severityLieve")}</option>
          <option value="near_miss">{t("safety.severityNearMiss")}</option>
          <option value="first_aid">{t("safety.severityFirstAid")}</option>
        </select>
        <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)} className={selectCls}>
          <option value="">{t("safety.allLines")}</option>
          {LINES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="text-sm text-brand-500 hover:text-brand-400 font-medium"
        >
          {t("safety.sortByDate")} {sortAsc ? "↑" : "↓"}
        </button>
      </div>

      {/* Table */}
      {displayed.length === 0 ? (
        <div className="bg-th-bg-2 rounded-2xl p-12 text-center border border-th-border">
          <p className="text-th-text-3">{t("safety.noIncidents")}</p>
        </div>
      ) : (
        <div className="bg-th-bg-2 rounded-2xl shadow-card border border-th-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-th-border">
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("common.date")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("safety.severity")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("safety.productionLine")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("common.description")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("safety.actionsTaken")}</th>
                  <th className="text-center px-4 py-3 text-th-text-2 font-semibold">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((inc) => (
                  <tr key={inc.id} className="border-b border-th-border/50 hover:bg-th-bg-2/50 transition">
                    <td className="px-4 py-3 text-th-text whitespace-nowrap">{inc.date}</td>
                    <td className="px-4 py-3">{severityBadge(inc.severity)}</td>
                    <td className="px-4 py-3 text-th-text whitespace-nowrap">{inc.line}</td>
                    <td className="px-4 py-3 text-th-text max-w-xs truncate" title={inc.description}>{inc.description}</td>
                    <td className="px-4 py-3 text-th-text-2 max-w-xs truncate" title={inc.actionsTaken}>{inc.actionsTaken}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onDelete(inc.id)}
                        className="text-red-400 hover:text-red-300 transition text-xs font-medium"
                      >
                        {t("common.delete")}
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
  incidents: SafetyIncident[];
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
    const counts: Record<string, number> = { grave: 0, lieve: 0, near_miss: 0, first_aid: 0 };
    incidents.forEach((inc) => { counts[inc.severity]++; });
    return [
      { name: t("safety.severityGrave"),    value: counts.grave },
      { name: t("safety.severityLieve"),    value: counts.lieve },
      { name: t("safety.severityNearMiss"), value: counts.near_miss },
      { name: t("safety.severityFirstAid"), value: counts.first_aid },
    ].filter((d) => d.value > 0);
  }, [incidents, t]);

  // Incidents by line
  const byLine = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach((inc) => { counts[inc.line] = (counts[inc.line] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [incidents]);

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
      backgroundColor: "rgba(17,17,27,0.95)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      color: "#e0e0e0",
      fontSize: 12,
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Incidents by Month */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-white/10">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">{t("safety.incidentsByMonth")}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...chartTooltipStyle} />
            <Bar dataKey="count" name={t("safety.count")} fill="#3b82f6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Incidents by Severity */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-white/10">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">{t("safety.incidentsBySeverity")}</h3>
        {bySeverity.length === 0 ? (
          <div className="flex items-center justify-center h-[260px] text-white/30 text-sm">{t("safety.noIncidents")}</div>
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
                formatter={(value: string) => <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Incidents by Production Line */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-white/10">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">{t("safety.incidentsByLine")}</h3>
        {byLine.length === 0 ? (
          <div className="flex items-center justify-center h-[260px] text-white/30 text-sm">{t("safety.noIncidents")}</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byLine} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="count" name={t("safety.count")} fill="#8b5cf6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Year-over-Year */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-white/10">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">{t("safety.yearOverYear")}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={yoy}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...chartTooltipStyle} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>{value}</span>}
            />
            <Bar dataKey="thisYear" name={t("safety.thisYear")} fill="#10b981" radius={[6, 6, 0, 0]} />
            <Bar dataKey="lastYear" name={t("safety.lastYear")} fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
