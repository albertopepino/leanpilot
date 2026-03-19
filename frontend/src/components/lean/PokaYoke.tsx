"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Wrench,
  Eye,
  Filter,
  Trash2,
  Pencil,
  X,
  Activity,
  Zap,
  Hand,
  Info,
  Bell,
  Settings,
  BarChart3,
  Target,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DeviceType = "contact" | "fixed_value" | "motion_step" | "informational" | "warning" | "control";
type VerificationFrequency = "daily" | "weekly" | "monthly";
type DeviceStatus = "active" | "inactive" | "needs_repair";
type ViewMode = "dashboard" | "registry" | "form" | "verifications";

interface PokaYokeDevice {
  id: number;
  factory_id: number;
  production_line_id: number | null;
  name: string;
  device_type: DeviceType;
  location: string | null;
  process_step: string | null;
  description: string | null;
  installation_date: string | null;
  verification_frequency: VerificationFrequency;
  last_verified_at: string | null;
  effectiveness_rate: number | null;
  status: DeviceStatus;
  created_by_id: number;
  created_at: string;
  updated_at: string;
}

interface Verification {
  id: number;
  device_id: number;
  factory_id: number;
  verified_by_id: number;
  result: "PASS" | "FAIL";
  notes: string | null;
  verified_at: string;
  created_at: string;
}

interface Stats {
  total_devices: number;
  active_count: number;
  inactive_count: number;
  needs_repair_count: number;
  overdue_count: number;
  avg_effectiveness: number | null;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  recent_verifications: Verification[];
}

interface ProductionLine {
  id: number;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEVICE_TYPES: { key: DeviceType; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }[] = [
  { key: "contact",       icon: Hand,     color: "text-blue-400",   bg: "bg-blue-500/20 border-blue-500/30" },
  { key: "fixed_value",   icon: Shield,   color: "text-green-400",  bg: "bg-green-500/20 border-green-500/30" },
  { key: "motion_step",   icon: Activity, color: "text-amber-400",  bg: "bg-amber-500/20 border-amber-500/30" },
  { key: "informational", icon: Info,     color: "text-cyan-400",   bg: "bg-cyan-500/20 border-cyan-500/30" },
  { key: "warning",       icon: Bell,     color: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/30" },
  { key: "control",       icon: Settings, color: "text-purple-400", bg: "bg-purple-500/20 border-purple-500/30" },
];

const STATUS_CONFIG: Record<DeviceStatus, { labelKey: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  active:       { labelKey: "pokayoke.statusActive",      color: "text-green-400",  bg: "bg-green-500/20 border-green-500/30",  icon: ShieldCheck },
  inactive:     { labelKey: "pokayoke.statusInactive",    color: "text-gray-400",   bg: "bg-gray-500/20 border-gray-500/30",    icon: ShieldX },
  needs_repair: { labelKey: "pokayoke.statusNeedsRepair", color: "text-red-400",    bg: "bg-red-500/20 border-red-500/30",      icon: ShieldAlert },
};

const FREQUENCY_LABELS: Record<VerificationFrequency, string> = {
  daily: "pokayoke.freqDaily",
  weekly: "pokayoke.freqWeekly",
  monthly: "pokayoke.freqMonthly",
};

const FREQUENCY_MS: Record<VerificationFrequency, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

/* ------------------------------------------------------------------ */
/*  API helper                                                         */
/* ------------------------------------------------------------------ */

const API_BASE = "/api/v1";

function getHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("leanpilot_token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, { headers: getHeaders(), ...opts });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PokaYoke() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { printView, exportToExcel, exportToCSV } = useExport();

  const [view, setView] = useState<ViewMode>("dashboard");
  const [devices, setDevices] = useState<PokaYokeDevice[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLine, setFilterLine] = useState("");
  const [filterOverdue, setFilterOverdue] = useState(false);

  // Device form
  const [editingDevice, setEditingDevice] = useState<PokaYokeDevice | null>(null);
  const [form, setForm] = useState({
    name: "",
    device_type: "contact" as DeviceType,
    location: "",
    process_step: "",
    description: "",
    production_line_id: "",
    installation_date: "",
    verification_frequency: "weekly" as VerificationFrequency,
    status: "active" as DeviceStatus,
  });

  // Confirm dialog
  const [confirmDeleteDeviceId, setConfirmDeleteDeviceId] = useState<number | null>(null);

  // Verification
  const [verifyingDevice, setVerifyingDevice] = useState<PokaYokeDevice | null>(null);
  const [verifyForm, setVerifyForm] = useState({ result: "PASS" as "PASS" | "FAIL", notes: "" });
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);

  /* ---- Data fetching ---- */

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("device_type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (filterLine) params.set("line_id", filterLine);

      const [devRes, statsRes, lineRes] = await Promise.all([
        apiFetch<PokaYokeDevice[]>(`/pokayoke/devices?${params.toString()}`),
        apiFetch<Stats>("/pokayoke/stats"),
        apiFetch<any>("/admin/production-lines").catch(() => []),
      ]);
      setDevices(Array.isArray(devRes) ? devRes : []);
      setStats(statsRes ?? null);
      setLines(Array.isArray(lineRes) ? lineRes : lineRes?.lines || []);
    } catch (err) {
      console.error("Failed to fetch pokayoke data", err);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, filterLine]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ---- Helpers ---- */

  const isOverdue = (device: PokaYokeDevice): boolean => {
    if (device.status !== "active") return false;
    if (!device.last_verified_at) return true;
    const delta = FREQUENCY_MS[device.verification_frequency] || FREQUENCY_MS.weekly;
    return Date.now() > new Date(device.last_verified_at).getTime() + delta;
  };

  const lineMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const l of lines) m[l.id] = l.name;
    return m;
  }, [lines]);

  const filteredDevices = useMemo(() => {
    if (!filterOverdue) return devices;
    return devices.filter(isOverdue);
  }, [devices, filterOverdue]);

  /* ---- Device form handlers ---- */

  const resetForm = () => {
    setForm({
      name: "", device_type: "contact", location: "", process_step: "",
      description: "", production_line_id: "", installation_date: "",
      verification_frequency: "weekly", status: "active",
    });
    setEditingDevice(null);
    setError("");
  };

  const handleEditDevice = (device: PokaYokeDevice) => {
    setForm({
      name: device.name,
      device_type: device.device_type,
      location: device.location || "",
      process_step: device.process_step || "",
      description: device.description || "",
      production_line_id: device.production_line_id ? String(device.production_line_id) : "",
      installation_date: device.installation_date || "",
      verification_frequency: device.verification_frequency as VerificationFrequency,
      status: device.status as DeviceStatus,
    });
    setEditingDevice(device);
    setView("form");
  };

  const handleSubmitDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        device_type: form.device_type,
        location: form.location || null,
        process_step: form.process_step || null,
        description: form.description || null,
        production_line_id: form.production_line_id ? Number(form.production_line_id) : null,
        installation_date: form.installation_date || null,
        verification_frequency: form.verification_frequency,
        status: form.status,
      };

      if (editingDevice) {
        await apiFetch(`/pokayoke/devices/${editingDevice.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/pokayoke/devices", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      setView("registry");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to save device");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDevice = async (id: number) => {
    try {
      await apiFetch(`/pokayoke/devices/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Failed to delete device", err);
    }
  };

  /* ---- Verification handlers ---- */

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingDevice) return;
    setSaving(true);
    try {
      await apiFetch(`/pokayoke/devices/${verifyingDevice.id}/verify`, {
        method: "POST",
        body: JSON.stringify({
          result: verifyForm.result,
          notes: verifyForm.notes || null,
        }),
      });
      setVerifyingDevice(null);
      setVerifyForm({ result: "PASS", notes: "" });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setSaving(false);
    }
  };

  const fetchVerifications = async (deviceId: number) => {
    setSelectedDeviceId(deviceId);
    try {
      const data = await apiFetch<Verification[]>(`/pokayoke/devices/${deviceId}/verifications`);
      setVerifications(Array.isArray(data) ? data : []);
      setView("verifications");
    } catch (err) {
      console.error("Failed to fetch verifications", err);
    }
  };

  /* ---- Export handlers ---- */

  const handleExportExcel = () => {
    const columns = [
      { key: "name", header: t("pokayoke.deviceName"), width: 22 },
      { key: "device_type", header: t("pokayoke.deviceType"), width: 15 },
      { key: "location", header: t("pokayoke.location"), width: 18 },
      { key: "status", header: t("pokayoke.status"), width: 14 },
      { key: "frequency", header: t("pokayoke.verificationFreq"), width: 14 },
      { key: "last_verified", header: t("pokayoke.lastVerified"), width: 18 },
      { key: "effectiveness", header: t("pokayoke.effectiveness"), width: 14 },
      { key: "line", header: t("pokayoke.productionLine"), width: 18 },
    ];
    const rows = devices.map((d) => ({
      name: d.name,
      device_type: t(`pokayoke.type_${d.device_type}`) || d.device_type,
      location: d.location || "",
      status: t(STATUS_CONFIG[d.status]?.labelKey) || d.status,
      frequency: t(FREQUENCY_LABELS[d.verification_frequency]) || d.verification_frequency,
      last_verified: d.last_verified_at ? new Date(d.last_verified_at).toLocaleDateString() : t("pokayoke.never"),
      effectiveness: d.effectiveness_rate != null ? `${d.effectiveness_rate}%` : "N/A",
      line: d.production_line_id ? (lineMap[d.production_line_id] || `#${d.production_line_id}`) : "",
    }));
    exportToExcel({ filename: "pokayoke-devices", columns, rows, sheetName: "PokaYoke" });
  };

  const handleExportCSV = () => {
    const columns = [
      { key: "name", header: t("pokayoke.deviceName") },
      { key: "device_type", header: t("pokayoke.deviceType") },
      { key: "status", header: t("pokayoke.status") },
      { key: "effectiveness", header: t("pokayoke.effectiveness") },
    ];
    const rows = devices.map((d) => ({
      name: d.name,
      device_type: d.device_type,
      status: d.status,
      effectiveness: d.effectiveness_rate != null ? `${d.effectiveness_rate}%` : "N/A",
    }));
    exportToCSV({ filename: "pokayoke-devices", columns, rows });
  };

  const handlePrint = () => {
    printView({ title: t("pokayoke.title"), orientation: "landscape" });
  };

  /* ---- Render: KPIs ---- */

  const renderKPIs = () => {
    if (!stats) return null;
    const kpis = [
      { label: t("pokayoke.totalDevices"), value: stats.total_devices, icon: Shield, color: "text-blue-400" },
      { label: t("pokayoke.activeDevices"), value: stats.active_count, icon: ShieldCheck, color: "text-green-400" },
      { label: t("pokayoke.avgEffectiveness"), value: stats.avg_effectiveness != null ? `${stats.avg_effectiveness}%` : "N/A", icon: Target, color: "text-amber-400" },
      { label: t("pokayoke.overdueCount"), value: stats.overdue_count, icon: AlertTriangle, color: stats.overdue_count > 0 ? "text-red-400" : "text-green-400" },
    ];
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              <span className="text-xs uppercase tracking-wider text-th-text-3 font-semibold">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-th-text">{kpi.value}</p>
          </div>
        ))}
      </div>
    );
  };

  /* ---- Render: Dashboard ---- */

  const renderDashboard = () => {
    if (!stats) return null;

    const typeData = Object.entries(stats.by_type).map(([type, count]) => ({
      name: t(`pokayoke.type_${type}`) || type,
      count,
    }));

    const statusData = Object.entries(stats.by_status).map(([status, count]) => ({
      name: t(STATUS_CONFIG[status as DeviceStatus]?.labelKey) || status,
      count,
    }));

    return (
      <div>
        {renderKPIs()}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Devices by Type */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-th-text-2 mb-4">{t("pokayoke.devicesByType")}</h3>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={typeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,100,100,0.2)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" name={t("pokayoke.devices")} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-th-text-3">{t("pokayoke.noDataYet")}</div>
            )}
          </div>

          {/* Status Overview */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-th-text-2 mb-4">{t("pokayoke.statusOverview")}</h3>
            <div className="grid grid-cols-1 gap-3">
              {(["active", "inactive", "needs_repair"] as DeviceStatus[]).map((st) => {
                const conf = STATUS_CONFIG[st];
                const count = stats.by_status[st] || 0;
                const total = stats.total_devices || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={st}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-th-text-2 font-medium flex items-center gap-1.5">
                        <conf.icon className={`w-4 h-4 ${conf.color}`} />
                        {t(conf.labelKey)}
                      </span>
                      <span className="text-th-text-3">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2.5 bg-th-bg-3 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: conf.color === "text-green-400" ? "#22c55e" : conf.color === "text-red-400" ? "#ef4444" : "#9ca3af" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overdue Devices */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-th-text-2 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              {t("pokayoke.overdueDevices")}
            </h3>
            {stats.overdue_count === 0 ? (
              <div className="flex items-center gap-2 text-green-400 py-4">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{t("pokayoke.allUpToDate")}</span>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.filter(isOverdue).slice(0, 5).map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <div>
                      <span className="text-sm font-medium text-th-text">{d.name}</span>
                      <span className="text-xs text-th-text-3 ml-2">{d.location}</span>
                    </div>
                    <button
                      onClick={() => { setVerifyingDevice(d); setVerifyForm({ result: "PASS", notes: "" }); }}
                      className="text-xs font-medium text-blue-400 hover:text-blue-300"
                    >
                      {t("pokayoke.verifyNow")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Verifications */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-th-text-2 mb-4">{t("pokayoke.recentVerifications")}</h3>
            {stats.recent_verifications.length === 0 ? (
              <div className="text-center py-4 text-th-text-3 text-sm">{t("pokayoke.noVerifications")}</div>
            ) : (
              <div className="space-y-2">
                {stats.recent_verifications.map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-th-bg-3">
                    <div className="flex items-center gap-2">
                      {v.result === "PASS" ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-sm text-th-text-2">
                        Device #{v.device_id}
                      </span>
                    </div>
                    <span className="text-xs text-th-text-3">
                      {new Date(v.verified_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ---- Render: Registry ---- */

  const renderRegistry = () => (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-th-border bg-th-card text-sm px-3 py-2 text-th-text-2"
        >
          <option value="">{t("pokayoke.allTypes")}</option>
          {DEVICE_TYPES.map((dt) => (
            <option key={dt.key} value={dt.key}>{t(`pokayoke.type_${dt.key}`) || dt.key}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-th-border bg-th-card text-sm px-3 py-2 text-th-text-2"
        >
          <option value="">{t("pokayoke.allStatuses")}</option>
          {(["active", "inactive", "needs_repair"] as DeviceStatus[]).map((s) => (
            <option key={s} value={s}>{t(STATUS_CONFIG[s].labelKey)}</option>
          ))}
        </select>
        <select
          value={filterLine}
          onChange={(e) => setFilterLine(e.target.value)}
          className="rounded-lg border border-th-border bg-th-card text-sm px-3 py-2 text-th-text-2"
        >
          <option value="">{t("pokayoke.allLines")}</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-th-text-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filterOverdue}
            onChange={(e) => setFilterOverdue(e.target.checked)}
            className="rounded border-th-border"
          />
          {t("pokayoke.showOverdueOnly")}
        </label>
      </div>

      {/* Device Cards Grid */}
      <div data-print-area className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredDevices.length === 0 ? (
          <div className="col-span-full text-center py-12 text-th-text-3">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t("pokayoke.noDevicesFound")}</p>
          </div>
        ) : (
          filteredDevices.map((device) => {
            const typeConf = DEVICE_TYPES.find((dt) => dt.key === device.device_type);
            const statusConf = STATUS_CONFIG[device.status] || STATUS_CONFIG.active;
            const overdue = isOverdue(device);
            const TypeIcon = typeConf?.icon || Shield;

            return (
              <div
                key={device.id}
                className={`rounded-xl border bg-th-bg-2 shadow-sm p-4 transition hover:shadow-md ${
                  overdue ? "border-red-500/40 bg-red-500/5" : "border-th-border"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${typeConf?.bg || "bg-th-bg-3 border-th-border"}`}>
                      <TypeIcon className={`w-5 h-5 ${typeConf?.color || "text-th-text-3"}`} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-th-text truncate">{device.name}</h4>
                      <span className="text-[11px] text-th-text-3">{t(`pokayoke.type_${device.device_type}`) || device.device_type}</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusConf.bg} ${statusConf.color}`}>
                    <statusConf.icon className="w-3 h-3" />
                    {t(statusConf.labelKey)}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-th-text-3 mb-3">
                  {device.location && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-th-text-2">{t("pokayoke.location")}:</span>
                      {device.location}
                    </div>
                  )}
                  {device.process_step && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-th-text-2">{t("pokayoke.processStep")}:</span>
                      {device.process_step}
                    </div>
                  )}
                  {device.production_line_id && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-th-text-2">{t("pokayoke.productionLine")}:</span>
                      {lineMap[device.production_line_id] || `#${device.production_line_id}`}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-th-text-2">{t("pokayoke.frequency")}:</span>
                    {t(FREQUENCY_LABELS[device.verification_frequency])}
                  </div>
                </div>

                {/* Effectiveness */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-th-text-2 font-medium">{t("pokayoke.effectiveness")}</span>
                    <span className={`font-bold ${
                      (device.effectiveness_rate || 0) >= 90 ? "text-green-400" :
                      (device.effectiveness_rate || 0) >= 70 ? "text-amber-400" : "text-red-400"
                    }`}>
                      {device.effectiveness_rate != null ? `${device.effectiveness_rate}%` : "N/A"}
                    </span>
                  </div>
                  <div className="h-1.5 bg-th-bg-3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${device.effectiveness_rate || 0}%`,
                        backgroundColor: (device.effectiveness_rate || 0) >= 90 ? "#22c55e" :
                          (device.effectiveness_rate || 0) >= 70 ? "#f59e0b" : "#ef4444",
                      }}
                    />
                  </div>
                </div>

                {/* Last verified + overdue */}
                <div className={`flex items-center gap-1.5 text-xs mb-3 ${overdue ? "text-red-400 font-semibold" : "text-th-text-3"}`}>
                  <Clock className="w-3.5 h-3.5" />
                  {device.last_verified_at
                    ? `${t("pokayoke.lastVerified")}: ${new Date(device.last_verified_at).toLocaleDateString()}`
                    : t("pokayoke.neverVerified")
                  }
                  {overdue && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 border border-red-500/30">
                      {t("pokayoke.overdue")}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-th-border">
                  <button
                    onClick={() => { setVerifyingDevice(device); setVerifyForm({ result: "PASS", notes: "" }); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {t("pokayoke.verify")}
                  </button>
                  <button
                    onClick={() => fetchVerifications(device.id)}
                    className="p-2 rounded-lg text-th-text-3 hover:bg-th-bg-3 hover:text-blue-400 transition"
                    title={t("pokayoke.viewHistory")}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditDevice(device)}
                    className="p-2 rounded-lg text-th-text-3 hover:bg-th-bg-3 hover:text-blue-400 transition"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteDeviceId(device.id)}
                    className="p-2 rounded-lg text-th-text-3 hover:bg-th-bg-3 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  /* ---- Render: Device form ---- */

  const renderForm = () => (
    <form onSubmit={handleSubmitDevice} className="max-w-3xl mx-auto">
      {/* Device Type Selector */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 mb-6">
        <h3 className="text-sm font-semibold text-th-text-2 mb-4">{t("pokayoke.selectDeviceType")} *</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {DEVICE_TYPES.map((dt) => (
            <button
              key={dt.key}
              type="button"
              onClick={() => setForm((f) => ({ ...f, device_type: dt.key }))}
              className={`rounded-xl border-2 p-4 text-center transition-all hover:scale-[1.02] ${
                form.device_type === dt.key
                  ? `${dt.bg} border-opacity-100 ring-2 ring-offset-1 ring-offset-th-bg`
                  : "border-th-border hover:border-th-text-3"
              }`}
            >
              <dt.icon className={`w-8 h-8 mx-auto mb-2 ${dt.color}`} />
              <span className="text-xs font-semibold text-th-text-2">{t(`pokayoke.type_${dt.key}`) || dt.key}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Details */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-th-text-2 mb-2">{t("pokayoke.deviceDetails")}</h3>

        <div>
          <label className="block text-xs font-medium text-th-text-3 mb-1">{t("pokayoke.deviceName")} *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
            placeholder={t("pokayoke.deviceNamePlaceholder")}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("pokayoke.location")}</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
              placeholder={t("pokayoke.locationPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("pokayoke.processStep")}</label>
            <input
              type="text"
              value={form.process_step}
              onChange={(e) => setForm((f) => ({ ...f, process_step: e.target.value }))}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
              placeholder={t("pokayoke.processStepPlaceholder")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("pokayoke.productionLine")}</label>
            <select
              value={form.production_line_id}
              onChange={(e) => setForm((f) => ({ ...f, production_line_id: e.target.value }))}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
            >
              <option value="">{t("pokayoke.selectLine")}</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("pokayoke.installationDate")}</label>
            <input
              type="date"
              value={form.installation_date}
              onChange={(e) => setForm((f) => ({ ...f, installation_date: e.target.value }))}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("pokayoke.verificationFreq")}</label>
            <select
              value={form.verification_frequency}
              onChange={(e) => setForm((f) => ({ ...f, verification_frequency: e.target.value as VerificationFrequency }))}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
            >
              {(["daily", "weekly", "monthly"] as VerificationFrequency[]).map((freq) => (
                <option key={freq} value={freq}>{t(FREQUENCY_LABELS[freq])}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("pokayoke.status")}</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DeviceStatus }))}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
            >
              {(["active", "inactive", "needs_repair"] as DeviceStatus[]).map((s) => (
                <option key={s} value={s}>{t(STATUS_CONFIG[s].labelKey)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-th-text-3 mb-1">{t("pokayoke.description")}</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
            placeholder={t("pokayoke.descriptionPlaceholder")}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !form.name}
            className="flex-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-semibold transition-colors py-2.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t("pokayoke.saving") : editingDevice ? t("pokayoke.updateDevice") : t("pokayoke.addDevice")}
          </button>
          {editingDevice && (
            <button
              type="button"
              onClick={() => { resetForm(); setView("registry"); }}
              className="px-4 py-2.5 rounded-xl border border-th-border text-th-text-3 hover:bg-th-bg-hover transition text-sm font-medium"
            >
              {t("pokayoke.cancel")}
            </button>
          )}
        </div>
      </div>
    </form>
  );

  /* ---- Render: Verifications history ---- */

  const renderVerifications = () => (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setView("registry")}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          &larr; {t("pokayoke.backToRegistry")}
        </button>
        <h3 className="text-lg font-bold text-th-text">
          {t("pokayoke.verificationHistory")} — Device #{selectedDeviceId}
        </h3>
      </div>

      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-th-border bg-th-bg">
              <th className="text-left px-4 py-3 font-semibold text-th-text-3">{t("pokayoke.date")}</th>
              <th className="text-left px-4 py-3 font-semibold text-th-text-3">{t("pokayoke.result")}</th>
              <th className="text-left px-4 py-3 font-semibold text-th-text-3">{t("pokayoke.notes")}</th>
              <th className="text-left px-4 py-3 font-semibold text-th-text-3">{t("pokayoke.verifiedBy")}</th>
            </tr>
          </thead>
          <tbody>
            {verifications.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-th-text-3">
                  {t("pokayoke.noVerifications")}
                </td>
              </tr>
            ) : (
              verifications.map((v) => (
                <tr key={v.id} className="border-b border-th-border hover:bg-th-bg-hover transition">
                  <td className="px-4 py-3 text-th-text-2">
                    {new Date(v.verified_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full border ${
                      v.result === "PASS"
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                    }`}>
                      {v.result === "PASS" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {v.result}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-th-text-3 max-w-xs truncate">{v.notes || "-"}</td>
                  <td className="px-4 py-3 text-th-text-3">#{v.verified_by_id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ---- Render: Verification modal ---- */

  const renderVerifyModal = () => {
    if (!verifyingDevice) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setVerifyingDevice(null)}>
        <div className="bg-th-bg-2 border border-th-border rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-th-border">
            <h3 className="text-lg font-bold text-th-text">{t("pokayoke.verifyDevice")}</h3>
            <button onClick={() => setVerifyingDevice(null)} className="p-1 text-th-text-3 hover:text-th-text">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleVerify} className="p-5 space-y-4">
            <p className="text-sm text-th-text-2">
              <span className="font-semibold">{verifyingDevice.name}</span> — {verifyingDevice.location}
            </p>

            <div>
              <label className="block text-xs font-medium text-th-text-3 mb-2">{t("pokayoke.result")}</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setVerifyForm((f) => ({ ...f, result: "PASS" }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-bold transition ${
                    verifyForm.result === "PASS"
                      ? "bg-green-500/20 text-green-400 border-green-500/40"
                      : "border-th-border text-th-text-3"
                  }`}
                >
                  <CheckCircle className="w-5 h-5" />
                  {t("pokayoke.pass")}
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyForm((f) => ({ ...f, result: "FAIL" }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-bold transition ${
                    verifyForm.result === "FAIL"
                      ? "bg-red-500/20 text-red-400 border-red-500/40"
                      : "border-th-border text-th-text-3"
                  }`}
                >
                  <XCircle className="w-5 h-5" />
                  {t("pokayoke.fail")}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-th-text-3 mb-1">{t("pokayoke.notes")}</label>
              <textarea
                value={verifyForm.notes}
                onChange={(e) => setVerifyForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
                placeholder={t("pokayoke.notesPlaceholder")}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-semibold transition-colors py-2.5 px-4 disabled:opacity-50"
            >
              {saving ? t("pokayoke.saving") : t("pokayoke.submitVerification")}
            </button>
          </form>
        </div>
      </div>
    );
  };

  /* ---- Main render ---- */

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-th-text">{t("pokayoke.title")}</h1>
          <p className="text-sm text-th-text-3 mt-1">{t("pokayoke.subtitle")}</p>
        </div>

        <div className="flex items-center gap-3">
          <ExportToolbar
            onPrint={handlePrint}
            onExportExcel={handleExportExcel}
            onExportCSV={handleExportCSV}
          />

          {/* View tabs */}
          <div className="flex bg-th-bg-3 rounded-xl p-1 gap-1">
            {([
              { key: "dashboard" as ViewMode, label: t("pokayoke.dashboardTab"), icon: LayoutDashboard },
              { key: "registry" as ViewMode, label: t("pokayoke.registryTab"), icon: ClipboardList },
              { key: "form" as ViewMode, label: t("pokayoke.addDeviceTab"), icon: PlusCircle },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setView(tab.key); if (tab.key === "form") resetForm(); }}
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
      </div>

      {/* Loading */}
      {loading && view !== "form" ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {view === "dashboard" && renderDashboard()}
          {view === "registry" && renderRegistry()}
          {view === "form" && renderForm()}
          {view === "verifications" && renderVerifications()}
        </>
      )}

      {/* Verification modal */}
      {renderVerifyModal()}

      <ConfirmDialog
        open={confirmDeleteDeviceId !== null}
        title={t("common.confirmDelete")}
        message={t("pokayoke.confirmDelete")}
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteDeviceId !== null) handleDeleteDevice(confirmDeleteDeviceId);
          setConfirmDeleteDeviceId(null);
        }}
        onCancel={() => setConfirmDeleteDeviceId(null)}
      />
    </div>
  );
}
