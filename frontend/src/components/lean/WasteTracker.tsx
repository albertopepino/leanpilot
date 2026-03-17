"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { useCurrency } from "@/stores/useCurrency";
import { wasteApi, adminApi } from "@/lib/api";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Truck,
  Package,
  Move,
  Clock,
  Factory,
  Settings,
  AlertTriangle,
  Brain,
  BarChart3,
  DollarSign,
  Flame,
  Timer,
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type WasteType =
  | "transportation"
  | "inventory"
  | "motion"
  | "waiting"
  | "overproduction"
  | "overprocessing"
  | "defects"
  | "skills";

type Severity = "low" | "medium" | "high" | "critical";
type Status = "open" | "investigating" | "action_taken" | "resolved";
type ViewMode = "dashboard" | "log" | "form";

interface WasteEvent {
  id: number;
  factory_id: number;
  production_line_id: number | null;
  reported_by: number;
  waste_type: WasteType;
  category: string | null;
  description: string;
  estimated_cost: number;
  estimated_time_minutes: number;
  severity: Severity;
  status: Status;
  root_cause: string | null;
  countermeasure: string | null;
  linked_kaizen_id: number | null;
  date_occurred: string;
  created_at: string;
  updated_at: string;
}

interface WasteSummary {
  total_events: number;
  total_cost: number;
  total_time_minutes: number;
  by_type: { waste_type: string; count: number; total_cost: number; total_time_minutes: number }[];
  by_line: { production_line_id: number | null; count: number; total_cost: number }[];
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
}

interface ProductionLine {
  id: number;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const WASTE_TYPES: { key: WasteType; icon: React.ComponentType<{ className?: string; color?: string; size?: string | number }>; color: string; bgClass: string }[] = [
  { key: "transportation", icon: Truck,         color: "#ef4444", bgClass: "bg-red-500/20 border-red-500/40" },
  { key: "inventory",      icon: Package,       color: "#f59e0b", bgClass: "bg-amber-500/20 border-amber-500/40" },
  { key: "motion",         icon: Move,          color: "#8b5cf6", bgClass: "bg-violet-500/20 border-violet-500/40" },
  { key: "waiting",        icon: Clock,         color: "#6366f1", bgClass: "bg-indigo-500/20 border-indigo-500/40" },
  { key: "overproduction", icon: Factory,       color: "#ec4899", bgClass: "bg-pink-500/20 border-pink-500/40" },
  { key: "overprocessing", icon: Settings,      color: "#14b8a6", bgClass: "bg-teal-500/20 border-teal-500/40" },
  { key: "defects",        icon: AlertTriangle, color: "#dc2626", bgClass: "bg-red-600/20 border-red-600/40" },
  { key: "skills",         icon: Brain,         color: "#0ea5e9", bgClass: "bg-sky-500/20 border-sky-500/40" },
];

/** i18n keys for waste type labels — resolved at render time via t() */
const WASTE_LABEL_KEYS: Record<WasteType, string> = {
  transportation: "waste.transport",
  inventory: "waste.inventory",
  motion: "waste.motion",
  waiting: "waste.waiting",
  overproduction: "waste.overproduction",
  overprocessing: "waste.overprocessing",
  defects: "waste.defects",
  skills: "waste.skills",
};

const SEVERITY_CONFIG: Record<Severity, { labelKey: string; color: string; bg: string }> = {
  low:      { labelKey: "waste.severityLow",      color: "#22c55e", bg: "bg-green-500/20 text-green-400 border-green-500/30" },
  medium:   { labelKey: "waste.severityMedium",   color: "#f59e0b", bg: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  high:     { labelKey: "waste.severityHigh",     color: "#f97316", bg: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  critical: { labelKey: "waste.severityCritical", color: "#ef4444", bg: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const STATUS_CONFIG: Record<Status, { labelKey: string; bg: string }> = {
  open:         { labelKey: "waste.statusOpen",          bg: "bg-red-500/20 text-red-400 border-red-500/30" },
  investigating:{ labelKey: "waste.statusInvestigating", bg: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  action_taken: { labelKey: "waste.statusActionTaken",   bg: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  resolved:     { labelKey: "waste.statusResolved",      bg: "bg-green-500/20 text-green-400 border-green-500/30" },
};

const PIE_COLORS = ["#ef4444", "#f59e0b", "#8b5cf6", "#6366f1", "#ec4899", "#14b8a6", "#dc2626", "#0ea5e9"];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WasteTracker() {
  const { t } = useI18n();
  const { currency } = useCurrency();
  const currencySymbol = currency.symbol;

  const [view, setView] = useState<ViewMode>("dashboard");
  const [events, setEvents] = useState<WasteEvent[]>([]);
  const [summary, setSummary] = useState<WasteSummary | null>(null);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>("");

  // Filters
  const [filterType, setFilterType] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterLine, setFilterLine] = useState<string>("");

  // Form state
  const [form, setForm] = useState({
    waste_type: "" as string,
    production_line_id: "" as string,
    category: "",
    description: "",
    estimated_cost: "",
    estimated_time_minutes: "",
    severity: "medium" as Severity,
    root_cause: "",
    countermeasure: "",
    date_occurred: new Date().toISOString().split("T")[0],
  });

  // Edit mode
  const [editingId, setEditingId] = useState<number | null>(null);

  /* ---- Data fetching ---- */

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (filterType) params.waste_type = filterType;
      if (filterSeverity) params.severity = filterSeverity;
      if (filterStatus) params.status = filterStatus;
      if (filterLine) params.line_id = Number(filterLine);

      const [evRes, sumRes, lineRes] = await Promise.all([
        wasteApi.list(params),
        wasteApi.getSummary(),
        adminApi.listProductionLines().catch(() => ({ data: [] })),
      ]);
      setEvents(evRes.data || []);
      setSummary(sumRes.data || null);
      setLines(Array.isArray(lineRes.data) ? lineRes.data : (lineRes.data?.lines || []));
    } catch (err) {
      console.error("Failed to fetch waste data", err);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterSeverity, filterStatus, filterLine]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- Handlers ---- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.waste_type || !form.description || !form.date_occurred) {
      setFormError(t("waste.fillRequiredFields"));
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        waste_type: form.waste_type,
        production_line_id: form.production_line_id ? Number(form.production_line_id) : null,
        category: form.category || null,
        description: form.description,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : 0,
        estimated_time_minutes: form.estimated_time_minutes ? Number(form.estimated_time_minutes) : 0,
        severity: form.severity,
        root_cause: form.root_cause || null,
        countermeasure: form.countermeasure || null,
        date_occurred: form.date_occurred,
      };

      if (editingId) {
        await wasteApi.update(editingId, payload);
        setEditingId(null);
      } else {
        await wasteApi.create(payload);
      }
      resetForm();
      setView("log");
      fetchData();
    } catch (err) {
      console.error("Failed to save waste event", err);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      waste_type: "",
      production_line_id: "",
      category: "",
      description: "",
      estimated_cost: "",
      estimated_time_minutes: "",
      severity: "medium",
      root_cause: "",
      countermeasure: "",
      date_occurred: new Date().toISOString().split("T")[0],
    });
    setEditingId(null);
  };

  const handleEdit = (ev: WasteEvent) => {
    setForm({
      waste_type: ev.waste_type,
      production_line_id: ev.production_line_id ? String(ev.production_line_id) : "",
      category: ev.category || "",
      description: ev.description,
      estimated_cost: ev.estimated_cost ? String(ev.estimated_cost) : "",
      estimated_time_minutes: ev.estimated_time_minutes ? String(ev.estimated_time_minutes) : "",
      severity: ev.severity,
      root_cause: ev.root_cause || "",
      countermeasure: ev.countermeasure || "",
      date_occurred: ev.date_occurred,
    });
    setEditingId(ev.id);
    setView("form");
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("waste.confirmDelete"))) return;
    try {
      await wasteApi.remove(id);
      fetchData();
    } catch (err) {
      console.error("Failed to delete waste event", err);
    }
  };

  const handleStatusChange = async (id: number, newStatus: Status) => {
    try {
      await wasteApi.update(id, { status: newStatus });
      fetchData();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  /* ---- Derived data ---- */

  /** Resolve a waste type key to its i18n label */
  const wasteLabel = useCallback(
    (key: string) => t(WASTE_LABEL_KEYS[key as WasteType] || "") || key,
    [t],
  );

  const lineMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const l of lines) m[l.id] = l.name;
    return m;
  }, [lines]);

  const pieData = useMemo(() => {
    if (!summary) return [];
    return summary.by_type.map((bt) => ({
      name: wasteLabel(bt.waste_type),
      value: bt.count,
      cost: bt.total_cost,
    }));
  }, [summary, wasteLabel]);

  const barData = useMemo(() => {
    if (!summary) return [];
    return summary.by_line.map((bl) => ({
      name: bl.production_line_id ? (lineMap[bl.production_line_id] || `Line ${bl.production_line_id}`) : "Unassigned",
      count: bl.count,
      cost: bl.total_cost,
    }));
  }, [summary, lineMap]);

  const topWasteType = useMemo(() => {
    if (!summary || summary.by_type.length === 0) return "N/A";
    const sorted = [...summary.by_type].sort((a, b) => b.count - a.count);
    return wasteLabel(sorted[0].waste_type);
  }, [summary, wasteLabel]);

  /* ---- Render helpers ---- */

  const renderKPIs = () => {
    if (!summary) return null;
    const kpis: { label: string; value: string | number; icon: React.ComponentType<{ className?: string; color?: string; size?: string | number }> }[] = [
      { label: t("waste.totalEvents"), value: summary.total_events, icon: BarChart3 },
      { label: t("waste.totalCost"), value: `${currencySymbol}${summary.total_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign },
      { label: t("waste.topWasteType"), value: topWasteType, icon: Flame },
      { label: t("waste.totalTimeLost"), value: `${summary.total_time_minutes.toLocaleString()} min`, icon: Timer },
    ];
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className="w-5 h-5 text-th-text-3" />
              <span className="text-xs uppercase tracking-wider text-th-text-3 font-semibold">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-th-text">{kpi.value}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderDashboard = () => (
    <div>
      {renderKPIs()}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart — Waste by Type */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-th-text-2 mb-4">{t("waste.wasteByType")}</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string, props: any) => [`${value} events (${currencySymbol}${props.payload.cost.toLocaleString()})`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-th-text-3">{t("waste.noDataYet")}</div>
          )}
        </div>

        {/* Bar Chart — Waste by Line */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-th-text-2 mb-4">{t("waste.wasteByLine")}</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,100,100,0.2)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" name="Events" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cost" fill="#f59e0b" name={`Cost (${currencySymbol})`} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-th-text-3">{t("waste.noDataYet")}</div>
          )}
        </div>

        {/* Severity Distribution */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-th-text-2 mb-4">{t("waste.severityDistribution")}</h3>
          <div className="space-y-3">
            {(["critical", "high", "medium", "low"] as Severity[]).map((sev) => {
              const count = summary?.by_severity[sev] || 0;
              const total = summary?.total_events || 1;
              const pct = Math.round((count / total) * 100);
              const conf = SEVERITY_CONFIG[sev];
              return (
                <div key={sev}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-th-text-2 font-medium">{t(conf.labelKey)}</span>
                    <span className="text-th-text-3">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-th-bg-3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: conf.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-th-text-2 mb-4">{t("waste.statusOverview")}</h3>
          <div className="grid grid-cols-2 gap-3">
            {(["open", "investigating", "action_taken", "resolved"] as Status[]).map((st) => {
              const count = summary?.by_status[st] || 0;
              const conf = STATUS_CONFIG[st];
              return (
                <div key={st} className={`rounded-xl border p-3 text-center ${conf.bg}`}>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs font-medium mt-1">{t(conf.labelKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const renderLog = () => (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-th-border bg-th-card text-sm px-3 py-2 text-th-text-2"
        >
          <option value="">{t("waste.allTypes")}</option>
          {WASTE_TYPES.map((wt) => (
            <option key={wt.key} value={wt.key}>
              {wasteLabel(wt.key)}
            </option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-lg border border-th-border bg-th-card text-sm px-3 py-2 text-th-text-2"
        >
          <option value="">{t("waste.allSeverities")}</option>
          {(["low", "medium", "high", "critical"] as Severity[]).map((s) => (
            <option key={s} value={s}>{t(SEVERITY_CONFIG[s].labelKey)}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-th-border bg-th-card text-sm px-3 py-2 text-th-text-2"
        >
          <option value="">{t("waste.allStatuses")}</option>
          {(["open", "investigating", "action_taken", "resolved"] as Status[]).map((s) => (
            <option key={s} value={s}>{t(STATUS_CONFIG[s].labelKey)}</option>
          ))}
        </select>
        <select
          value={filterLine}
          onChange={(e) => setFilterLine(e.target.value)}
          className="rounded-lg border border-th-border bg-th-card text-sm px-3 py-2 text-th-text-2"
        >
          <option value="">{t("waste.allLines")}</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Events Table */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-th-border bg-th-bg">
                <th className="text-left px-4 py-3 font-semibold text-th-text-3">{t("waste.date")}</th>
                <th className="text-left px-4 py-3 font-semibold text-th-text-3">{t("waste.type")}</th>
                <th className="text-left px-4 py-3 font-semibold text-th-text-3">{t("waste.description")}</th>
                <th className="text-left px-4 py-3 font-semibold text-th-text-3">{t("waste.line")}</th>
                <th className="text-left px-4 py-3 font-semibold text-th-text-3">{t("waste.cost")}</th>
                <th className="text-left px-4 py-3 font-semibold text-th-text-3">{t("waste.severity")}</th>
                <th className="text-left px-4 py-3 font-semibold text-th-text-3">{t("waste.status")}</th>
                <th className="text-left px-4 py-3 font-semibold text-th-text-3">{t("waste.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-th-text-3">
                    {t("waste.noEventsFound")}
                  </td>
                </tr>
              ) : (
                events.map((ev) => {
                  const wt = WASTE_TYPES.find((w) => w.key === ev.waste_type);
                  const sevConf = SEVERITY_CONFIG[ev.severity] || SEVERITY_CONFIG.medium;
                  const statConf = STATUS_CONFIG[ev.status] || STATUS_CONFIG.open;
                  return (
                    <tr key={ev.id} className="border-b border-th-border hover:bg-th-bg-hover transition">
                      <td className="px-4 py-3 text-th-text-2 whitespace-nowrap">{ev.date_occurred}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {wt ? <wt.icon className="w-4 h-4 text-th-text-3" /> : "?"}
                          <span className="text-th-text-2">{wasteLabel(ev.waste_type)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-th-text-3 max-w-xs truncate" title={ev.description}>{ev.description}</td>
                      <td className="px-4 py-3 text-th-text-3 whitespace-nowrap">
                        {ev.production_line_id ? (lineMap[ev.production_line_id] || `#${ev.production_line_id}`) : "-"}
                      </td>
                      <td className="px-4 py-3 text-th-text-2 whitespace-nowrap font-medium">
                        {ev.estimated_cost > 0 ? `${currencySymbol}${ev.estimated_cost.toLocaleString()}` : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full border ${sevConf.bg}`}>
                          {t(sevConf.labelKey)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={ev.status}
                          onChange={(e) => handleStatusChange(ev.id, e.target.value as Status)}
                          className={`text-xs font-semibold rounded-full border px-2 py-0.5 cursor-pointer ${statConf.bg} bg-transparent`}
                        >
                          {(["open", "investigating", "action_taken", "resolved"] as Status[]).map((s) => (
                            <option key={s} value={s}>{t(STATUS_CONFIG[s].labelKey)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleEdit(ev)}
                          className="text-blue-500 hover:text-blue-400 text-xs font-medium mr-3"
                        >
                          {t("waste.edit")}
                        </button>
                        <button
                          onClick={() => handleDelete(ev.id)}
                          className="text-red-500 hover:text-red-400 text-xs font-medium"
                        >
                          {t("waste.delete")}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
      {/* Waste Type Selector — visual cards */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 mb-6">
        <h3 className="text-sm font-semibold text-th-text-2 mb-4">
          {t("waste.selectWasteType")} <span className="text-red-500">*</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {WASTE_TYPES.map((wt) => (
            <button
              key={wt.key}
              type="button"
              onClick={() => setForm((f) => ({ ...f, waste_type: wt.key }))}
              className={`rounded-xl border-2 p-4 text-center transition-all hover:scale-[1.02] ${
                form.waste_type === wt.key
                  ? `${wt.bgClass} border-opacity-100 ring-2 ring-offset-1 ring-offset-th-bg`
                  : "border-th-border hover:border-th-text-3"
              }`}
              style={form.waste_type === wt.key ? { "--tw-ring-color": wt.color } as React.CSSProperties : {}}
            >
              <wt.icon className="w-8 h-8 mx-auto mb-2" color={wt.color} />
              <span className="text-xs font-semibold text-th-text-2">{wasteLabel(wt.key)}</span>
            </button>
          ))}
        </div>
        {!form.waste_type && (
          <p className="text-xs text-red-500 mt-2">{t("waste.pleaseSelectType")}</p>
        )}
      </div>

      {/* Details */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-th-text-2 mb-2">{t("waste.eventDetails")}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("waste.dateOccurred")} *</label>
            <input
              type="date"
              value={form.date_occurred}
              onChange={(e) => setForm((f) => ({ ...f, date_occurred: e.target.value }))}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("waste.productionLine")}</label>
            <select
              value={form.production_line_id}
              onChange={(e) => setForm((f) => ({ ...f, production_line_id: e.target.value }))}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
            >
              <option value="">{t("waste.optional")}</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-th-text-3 mb-1">{t("waste.description")} *</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
            placeholder={t("waste.descriptionPlaceholder")}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("waste.category")}</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
              placeholder={t("waste.categoryPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("waste.estimatedCost")} ({currencySymbol})</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.estimated_cost}
              onChange={(e) => setForm((f) => ({ ...f, estimated_cost: e.target.value }))}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("waste.timeLost")}</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={form.estimated_time_minutes}
              onChange={(e) => setForm((f) => ({ ...f, estimated_time_minutes: e.target.value }))}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-th-text-3 mb-1">{t("waste.severity")}</label>
          <div className="flex gap-2">
            {(["low", "medium", "high", "critical"] as Severity[]).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setForm((f) => ({ ...f, severity: sev }))}
                className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition ${
                  form.severity === sev
                    ? SEVERITY_CONFIG[sev].bg + " border-opacity-100"
                    : "border-th-border text-th-text-3"
                }`}
              >
                {t(SEVERITY_CONFIG[sev].labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-th-text-3 mb-1">{t("waste.rootCauseOptional")}</label>
          <textarea
            value={form.root_cause}
            onChange={(e) => setForm((f) => ({ ...f, root_cause: e.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
            placeholder={t("waste.rootCausePlaceholder")}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-th-text-3 mb-1">{t("waste.countermeasureOptional")}</label>
          <textarea
            value={form.countermeasure}
            onChange={(e) => setForm((f) => ({ ...f, countermeasure: e.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
            placeholder={t("waste.countermeasurePlaceholder")}
          />
        </div>

        {formError && (
          <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !form.waste_type || !form.description}
            className="flex-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-semibold transition-colors py-2.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t("waste.saving") : editingId ? t("waste.updateEvent") : t("waste.logWaste")}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 rounded-xl border border-th-border text-th-text-3 hover:bg-th-bg-hover transition text-sm font-medium"
            >
              {t("waste.cancel")}
            </button>
          )}
        </div>
      </div>
    </form>
  );

  /* ---- Main render ---- */

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-th-text">
            {t("waste.title")}
          </h1>
          <p className="text-sm text-th-text-3 mt-1">
            {t("waste.trackAndEliminate")}
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex bg-th-bg-3 rounded-xl p-1 gap-1">
          {([
            { key: "dashboard" as ViewMode, label: t("waste.dashboardTab"), icon: LayoutDashboard },
            { key: "log" as ViewMode, label: t("waste.logTab"), icon: ClipboardList },
            { key: "form" as ViewMode, label: t("waste.reportWasteTab"), icon: PlusCircle },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setView(tab.key); if (tab.key !== "form") resetForm(); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                view === tab.key
                  ? "bg-th-card text-th-text shadow-sm"
                  : "text-th-text-3 hover:text-th-text-2"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && view !== "form" ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {view === "dashboard" && renderDashboard()}
          {view === "log" && renderLog()}
          {view === "form" && renderForm()}
        </>
      )}
    </div>
  );
}
