"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useI18n } from "@/stores/useI18n";
import { qcApi, adminApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";

const SPCCharts = dynamic(() => import("@/components/quality/SPCCharts"), {
  loading: () => <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>,
});
const PokaYoke = dynamic(() => import("@/components/lean/PokaYoke"), {
  loading: () => <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>,
});
const QCPolicyRepository = dynamic(() => import("@/components/manufacturing/QCPolicyRepository"), {
  loading: () => <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>,
});
import {
  ClipboardCheck,
  AlertTriangle,
  ShieldAlert,
  Wrench,
  BarChart3,
  FileText,
  List,
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  CheckCircle,
  Clock,
  Search,
  Filter,
  TrendingUp,
  PieChart as PieChartIcon,
  Loader2,
  Eye,
  ArrowRight,
  Activity,
  ShieldCheck,
  BookOpen,
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
  LineChart,
  Line,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

type TabKey = "overview" | "ncr" | "capa" | "defect_catalog" | "inspections" | "spc" | "poka_yoke" | "qc_policies";
type NCRStatus = "open" | "investigating" | "contained" | "closed";
type CAPAStatus = "open" | "in_progress" | "verification" | "closed";

interface NCR {
  id: number;
  ncr_number: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  production_line_id: number | null;
  product_id: number | null;
  quantity_affected: number | null;
  disposition: string | null;
  root_cause: string | null;
  detected_at: string;
  closed_at: string | null;
  created_at: string;
}

interface CAPA {
  id: number;
  capa_number: string;
  capa_type: string;
  title: string;
  description: string;
  root_cause: string | null;
  status: string;
  priority: string;
  ncr_id: number | null;
  owner_id: number | null;
  due_date: string | null;
  implemented_at: string | null;
  verified_at: string | null;
  effectiveness_result: string | null;
  created_at: string;
}

interface DefectEntry {
  id: number;
  code: string;
  name: string;
  severity: string;
  category: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface QCRecord {
  id: number;
  template_id: number;
  production_line_id: number;
  check_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  overall_score_pct: number | null;
  sample_size: number | null;
  notes: string | null;
  created_at: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: "#ef4444", bg: "bg-red-500/15", border: "border-red-500/30" },
  major: { color: "#f59e0b", bg: "bg-amber-500/15", border: "border-amber-500/30" },
  minor: { color: "#22c55e", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
};

const NCR_STATUS_COLORS: Record<string, string> = {
  open: "bg-red-500/15 text-red-500 border-red-500/30",
  investigating: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  contained: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  closed: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
};

const CAPA_STATUS_COLORS: Record<string, string> = {
  open: "bg-red-500/15 text-red-500 border-red-500/30",
  in_progress: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  verification: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  closed: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-emerald-500",
};

const CHART_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

// ─── Component ──────────────────────────────────────────────────────────────

export default function QCDashboard() {
  const { t } = useI18n();
  const { printView, exportToExcel } = useExport();

  // Data
  const [ncrs, setNcrs] = useState<NCR[]>([]);
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [defects, setDefects] = useState<DefectEntry[]>([]);
  const [records, setRecords] = useState<QCRecord[]>([]);
  const [templates, setTemplates] = useState<{ id: number; name: string; check_type: string }[]>([]);
  const [productionLines, setProductionLines] = useState<{ id: number; name: string }[]>([]);

  // UI State
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Filters
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterLine, setFilterLine] = useState<number | "">("");
  const [filterSeverity, setFilterSeverity] = useState("");

  // Modals
  const [showNCRModal, setShowNCRModal] = useState(false);
  const [showCAPAModal, setShowCAPAModal] = useState(false);
  const [expandedNCR, setExpandedNCR] = useState<number | null>(null);
  const [expandedCAPA, setExpandedCAPA] = useState<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  // ─── Data Fetching ──────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [ncrRes, capaRes, defRes, recRes, tplRes] = await Promise.all([
        qcApi.listNCRs(),
        qcApi.listCAPAs(),
        qcApi.listDefects({ active_only: true }),
        qcApi.listRecords(),
        qcApi.listTemplates().catch(() => ({ data: [] })),
      ]);
      setTemplates(Array.isArray(tplRes.data) ? tplRes.data : []);
      setNcrs(ncrRes.data ?? []);
      setCapas(capaRes.data ?? []);
      setDefects(defRes.data ?? []);
      setRecords(recRes.data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.getFactory();
        const factory = res.data ?? res;
        setProductionLines(factory?.production_lines ?? []);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Filtered Data ──────────────────────────────────────────────────

  const filteredNCRs = useMemo(() => {
    let list = [...ncrs];
    if (filterFrom) list = list.filter((n) => n.detected_at >= filterFrom);
    if (filterTo) list = list.filter((n) => n.detected_at <= filterTo + "T23:59:59");
    if (filterLine) list = list.filter((n) => n.production_line_id === filterLine);
    if (filterSeverity) list = list.filter((n) => n.severity === filterSeverity);
    return list.sort((a, b) => b.detected_at.localeCompare(a.detected_at));
  }, [ncrs, filterFrom, filterTo, filterLine, filterSeverity]);

  const filteredCAPAs = useMemo(() => {
    let list = [...capas];
    if (filterFrom) list = list.filter((c) => c.created_at >= filterFrom);
    if (filterTo) list = list.filter((c) => c.created_at <= filterTo + "T23:59:59");
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [capas, filterFrom, filterTo]);

  const filteredRecords = useMemo(() => {
    let list = [...records];
    if (filterFrom) list = list.filter((r) => r.started_at >= filterFrom);
    if (filterTo) list = list.filter((r) => r.started_at <= filterTo + "T23:59:59");
    if (filterLine) list = list.filter((r) => r.production_line_id === filterLine);
    return list.sort((a, b) => b.started_at.localeCompare(a.started_at));
  }, [records, filterFrom, filterTo, filterLine]);

  // ─── Overview KPIs ──────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalInspections = records.length;
    const passed = records.filter((r) => r.status === "passed" || r.status === "completed").length;
    const passRate = totalInspections > 0 ? (passed / totalInspections * 100) : 0;
    const openNCRs = ncrs.filter((n) => n.status !== "closed").length;
    const openCAPAs = capas.filter((c) => c.status !== "closed").length;

    // Avg defects per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentNCRs = ncrs.filter((n) => new Date(n.detected_at) >= thirtyDaysAgo).length;
    const avgDefectsDay = recentNCRs / 30;

    return { totalInspections, passRate, openNCRs, openCAPAs, avgDefectsDay };
  }, [records, ncrs, capas]);

  // ─── Chart Data ─────────────────────────────────────────────────────

  const passRateTrend = useMemo(() => {
    const byDay: Record<string, { pass: number; total: number }> = {};
    records.forEach((r) => {
      const day = r.started_at.slice(0, 10);
      if (!byDay[day]) byDay[day] = { pass: 0, total: 0 };
      byDay[day].total++;
      if (r.status === "passed" || r.status === "completed") byDay[day].pass++;
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([day, data]) => ({
        date: day.slice(5),
        rate: data.total > 0 ? Math.round(data.pass / data.total * 100) : 0,
      }));
  }, [records]);

  const defectsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    defects.forEach((d) => {
      const cat = d.category || t("quality.uncategorized");
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [defects, t]);

  const ncrBySeverity = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, major: 0, minor: 0 };
    ncrs.forEach((n) => { counts[n.severity] = (counts[n.severity] || 0) + 1; });
    return [
      { name: t("quality.critical"), value: counts.critical },
      { name: t("quality.major"), value: counts.major },
      { name: t("quality.minor"), value: counts.minor },
    ].filter((d) => d.value > 0);
  }, [ncrs, t]);

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleNCRStatusChange = useCallback(async (id: number, newStatus: string) => {
    try {
      await qcApi.updateNCR(id, { status: newStatus });
      showToast(t("quality.statusUpdated"));
      fetchData();
    } catch {
      showToast(t("common.saveFailed"));
    }
  }, [fetchData, showToast, t]);

  const handleCAPAStatusChange = useCallback(async (id: number, newStatus: string) => {
    try {
      await qcApi.updateCAPA(id, { status: newStatus });
      showToast(t("quality.statusUpdated"));
      fetchData();
    } catch {
      showToast(t("common.saveFailed"));
    }
  }, [fetchData, showToast, t]);

  const lineNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    productionLines.forEach((l) => { map[l.id] = l.name; });
    return map;
  }, [productionLines]);

  // ─── Tab Config ─────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: t("quality.tabOverview"), icon: <BarChart3 className="w-4 h-4" /> },
    { key: "ncr", label: t("quality.tabNCR"), icon: <ShieldAlert className="w-4 h-4" /> },
    { key: "capa", label: t("quality.tabCAPA"), icon: <Wrench className="w-4 h-4" /> },
    { key: "defect_catalog", label: t("quality.tabDefectCatalog"), icon: <List className="w-4 h-4" /> },
    { key: "inspections", label: t("quality.tabInspections"), icon: <ClipboardCheck className="w-4 h-4" /> },
    { key: "spc", label: t("common.tabSPCCharts"), icon: <Activity className="w-4 h-4" /> },
    { key: "poka_yoke", label: t("common.tabPokaYoke"), icon: <ShieldCheck className="w-4 h-4" /> },
    { key: "qc_policies", label: t("common.tabQCPolicies"), icon: <BookOpen className="w-4 h-4" /> },
  ];

  const chartTooltipStyle = {
    contentStyle: {
      backgroundColor: "var(--color-th-bg-2, rgba(17,17,27,0.95))",
      border: "1px solid var(--color-th-border, rgba(255,255,255,0.1))",
      borderRadius: 12,
      color: "var(--color-th-text, #e0e0e0)",
      fontSize: 12,
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-top-2 fade-in duration-200">
          <CheckCircle className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-th-text-3" />
          <span className="text-sm font-medium text-th-text-2">{t("quality.filters")}:</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-th-text-3">{t("quality.from")}</label>
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-th-border bg-th-bg text-th-text text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-th-text-3">{t("quality.to")}</label>
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-th-border bg-th-bg text-th-text text-sm" />
        </div>
        <select value={filterLine} onChange={(e) => setFilterLine(e.target.value ? Number(e.target.value) : "")}
          className="px-3 py-1.5 rounded-lg border border-th-border bg-th-bg text-th-text text-sm">
          <option value="">{t("quality.allLines")}</option>
          {productionLines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-th-border bg-th-bg text-th-text text-sm">
          <option value="">{t("quality.allSeverities")}</option>
          <option value="critical">{t("quality.critical")}</option>
          <option value="major">{t("quality.major")}</option>
          <option value="minor">{t("quality.minor")}</option>
        </select>
        {(filterFrom || filterTo || filterLine || filterSeverity) && (
          <button onClick={() => { setFilterFrom(""); setFilterTo(""); setFilterLine(""); setFilterSeverity(""); }}
            className="flex items-center gap-1 text-xs text-th-text-3 hover:text-th-text-2 font-medium">
            <X className="w-3 h-3" /> {t("quality.clearFilters")}
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === tb.key
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-th-bg-2 text-th-text-2 border border-th-border hover:bg-th-bg"
            }`}>
            {tb.icon}
            {tb.label}
          </button>
        ))}
      </div>

      {/* Export */}
      <ExportToolbar
        onPrint={() => printView(t("quality.dashboardTitle"))}
        onExportExcel={() =>
          exportToExcel({
            title: t("quality.dashboardTitle"),
            columns: [t("quality.ncrNumber"), t("quality.title"), t("quality.severity"), t("quality.status"), t("quality.date")],
            rows: filteredNCRs.map((n) => [n.ncr_number, n.title, n.severity, n.status, n.detected_at.slice(0, 10)]),
          })
        }
      />

      {/* Views */}
      {tab === "overview" && (
        <OverviewView
          kpis={kpis} passRateTrend={passRateTrend} defectsByCategory={defectsByCategory}
          ncrBySeverity={ncrBySeverity} chartTooltipStyle={chartTooltipStyle} t={t}
        />
      )}
      {tab === "ncr" && (
        <NCRView
          ncrs={filteredNCRs} lineNameMap={lineNameMap}
          expandedNCR={expandedNCR} setExpandedNCR={setExpandedNCR}
          onStatusChange={handleNCRStatusChange}
          onCreateClick={() => setShowNCRModal(true)}
          t={t}
        />
      )}
      {tab === "capa" && (
        <CAPAView
          capas={filteredCAPAs} ncrs={ncrs}
          expandedCAPA={expandedCAPA} setExpandedCAPA={setExpandedCAPA}
          onStatusChange={handleCAPAStatusChange}
          onCreateClick={() => setShowCAPAModal(true)}
          t={t}
        />
      )}
      {tab === "defect_catalog" && <DefectCatalogView defects={defects} t={t} />}
      {tab === "inspections" && (
        <InspectionsView
          records={filteredRecords}
          lineNameMap={lineNameMap}
          productionLines={productionLines}
          onStartCheck={async (lineId: number, templateId: number, checkType: string) => {
            try {
              await qcApi.startCheck({ production_line_id: lineId, template_id: templateId, check_type: checkType });
              showToast(t("quality.inspectionStarted") || "Inspection started");
              fetchData();
            } catch { showToast(t("quality.inspectionStartFailed") || "Failed to start inspection"); }
          }}
          templates={templates}
          t={t}
        />
      )}
      {tab === "spc" && <SPCCharts />}
      {tab === "poka_yoke" && <PokaYoke />}
      {tab === "qc_policies" && <QCPolicyRepository />}

      {/* NCR Modal */}
      {showNCRModal && (
        <NCRCreateModal
          productionLines={productionLines}
          onClose={() => setShowNCRModal(false)}
          onCreated={() => { setShowNCRModal(false); showToast(t("quality.ncrCreated")); fetchData(); }}
          t={t}
        />
      )}

      {/* CAPA Modal */}
      {showCAPAModal && (
        <CAPACreateModal
          ncrs={ncrs}
          productionLines={productionLines}
          onClose={() => setShowCAPAModal(false)}
          onCreated={() => { setShowCAPAModal(false); showToast(t("quality.capaCreated")); fetchData(); }}
          t={t}
        />
      )}
    </div>
  );
}

// ─── Overview View ──────────────────────────────────────────────────────────

function OverviewView({
  kpis, passRateTrend, defectsByCategory, ncrBySeverity, chartTooltipStyle, t,
}: {
  kpis: { totalInspections: number; passRate: number; openNCRs: number; openCAPAs: number; avgDefectsDay: number };
  passRateTrend: { date: string; rate: number }[];
  defectsByCategory: { name: string; value: number }[];
  ncrBySeverity: { name: string; value: number }[];
  chartTooltipStyle: { contentStyle: React.CSSProperties };
  t: (key: string, r?: Record<string, string | number>) => string;
}) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: t("quality.totalInspections"), value: kpis.totalInspections, icon: <ClipboardCheck className="w-4 h-4 text-blue-500" />, color: "text-blue-500" },
          { label: t("quality.passRate"), value: `${kpis.passRate.toFixed(1)}%`, icon: <CheckCircle className="w-4 h-4 text-emerald-500" />, color: "text-emerald-500" },
          { label: t("quality.openNCRs"), value: kpis.openNCRs, icon: <ShieldAlert className="w-4 h-4 text-red-500" />, color: "text-red-500" },
          { label: t("quality.openCAPAs"), value: kpis.openCAPAs, icon: <Wrench className="w-4 h-4 text-amber-500" />, color: "text-amber-500" },
          { label: t("quality.avgDefectsDay"), value: kpis.avgDefectsDay.toFixed(1), icon: <TrendingUp className="w-4 h-4 text-purple-500" />, color: "text-purple-500" },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              {kpi.icon}
              <span className="text-xs text-th-text-3 uppercase tracking-wider font-medium">{kpi.label}</span>
            </div>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pass Rate Trend */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-th-text-3" />
            <h3 className="text-sm font-semibold text-th-text-2 uppercase tracking-wide">{t("quality.passRateTrend")}</h3>
          </div>
          {passRateTrend.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-th-text-3 text-sm">{t("quality.noData")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={passRateTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-th-border, rgba(255,255,255,0.06))" />
                <XAxis dataKey="date" tick={{ fill: "var(--color-th-text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--color-th-text-3)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip {...chartTooltipStyle} />
                <Line type="monotone" dataKey="rate" stroke="#22c55e" strokeWidth={2.5} dot={{ fill: "#22c55e", r: 3 }} name={t("quality.passRate")} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* NCR by Severity */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-th-text-3" />
            <h3 className="text-sm font-semibold text-th-text-2 uppercase tracking-wide">{t("quality.ncrBySeverity")}</h3>
          </div>
          {ncrBySeverity.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-th-text-3 text-sm">{t("quality.noData")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={ncrBySeverity} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" nameKey="name" stroke="none">
                  {ncrBySeverity.map((_, idx) => <Cell key={idx} fill={["#ef4444", "#f59e0b", "#22c55e"][idx % 3]} />)}
                </Pie>
                <Tooltip {...chartTooltipStyle} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8}
                  formatter={(value: string) => <span className="text-th-text-2 text-xs">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Defects by Category */}
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-4 h-4 text-th-text-3" />
            <h3 className="text-sm font-semibold text-th-text-2 uppercase tracking-wide">{t("quality.defectsByCategory")}</h3>
          </div>
          {defectsByCategory.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-th-text-3 text-sm">{t("quality.noData")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={defectsByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-th-border, rgba(255,255,255,0.06))" />
                <XAxis dataKey="name" tick={{ fill: "var(--color-th-text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--color-th-text-3)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...chartTooltipStyle} />
                <Bar dataKey="value" name={t("quality.count")} radius={[6, 6, 0, 0]}>
                  {defectsByCategory.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NCR View ───────────────────────────────────────────────────────────────

function NCRView({
  ncrs, lineNameMap, expandedNCR, setExpandedNCR, onStatusChange, onCreateClick, t,
}: {
  ncrs: NCR[];
  lineNameMap: Record<number, string>;
  expandedNCR: number | null;
  setExpandedNCR: (id: number | null) => void;
  onStatusChange: (id: number, status: string) => void;
  onCreateClick: () => void;
  t: (key: string) => string;
}) {
  const ncrStatuses: NCRStatus[] = ["open", "investigating", "contained", "closed"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-th-text">{t("quality.ncrManagement")}</h3>
        <button onClick={onCreateClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all">
          <Plus className="w-4 h-4" /> {t("quality.createNCR")}
        </button>
      </div>

      {ncrs.length === 0 ? (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-12 text-center">
          <p className="text-th-text-3">{t("quality.noNCRs")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-th-border">
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.ncrNumber")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.title")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.severity")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.status")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.line")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.date")}</th>
                  <th className="text-center px-4 py-3 text-th-text-2 font-semibold">{t("quality.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {ncrs.map((ncr) => (
                  <>
                    <tr key={ncr.id} className="border-b border-th-border/50 hover:bg-th-bg transition cursor-pointer"
                      onClick={() => setExpandedNCR(expandedNCR === ncr.id ? null : ncr.id)}>
                      <td className="px-4 py-3 text-th-text font-mono text-xs">{ncr.ncr_number}</td>
                      <td className="px-4 py-3 text-th-text max-w-xs truncate" title={ncr.title}>{ncr.title}</td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={ncr.severity} t={t} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ncr.status} colorMap={NCR_STATUS_COLORS} t={t} prefix="quality.ncrStatus" />
                      </td>
                      <td className="px-4 py-3 text-th-text whitespace-nowrap">{ncr.production_line_id ? lineNameMap[ncr.production_line_id] ?? "-" : "-"}</td>
                      <td className="px-4 py-3 text-th-text whitespace-nowrap">{ncr.detected_at.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-center">
                        {expandedNCR === ncr.id ? <ChevronUp className="w-4 h-4 text-th-text-3 inline" /> : <ChevronDown className="w-4 h-4 text-th-text-3 inline" />}
                      </td>
                    </tr>
                    {expandedNCR === ncr.id && (
                      <tr key={`${ncr.id}-detail`} className="border-b border-th-border/50 bg-th-bg">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-3">
                            <p className="text-sm text-th-text-2"><strong>{t("quality.description")}:</strong> {ncr.description}</p>
                            {ncr.root_cause && <p className="text-sm text-th-text-2"><strong>{t("quality.rootCause")}:</strong> {ncr.root_cause}</p>}
                            {ncr.disposition && <p className="text-sm text-th-text-2"><strong>{t("quality.disposition")}:</strong> {ncr.disposition}</p>}
                            {ncr.quantity_affected && <p className="text-sm text-th-text-2"><strong>{t("quality.quantityAffected")}:</strong> {ncr.quantity_affected}</p>}
                            <div className="flex gap-2 mt-2">
                              {ncrStatuses.filter((s) => s !== ncr.status).map((s) => (
                                <button key={s} onClick={(e) => { e.stopPropagation(); onStatusChange(ncr.id, s); }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-th-bg-2 border border-th-border text-th-text-2 hover:bg-th-bg-3 transition">
                                  <ArrowRight className="w-3 h-3 inline mr-1" />
                                  {t(`quality.ncrStatus${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CAPA View ──────────────────────────────────────────────────────────────

function CAPAView({
  capas, ncrs, expandedCAPA, setExpandedCAPA, onStatusChange, onCreateClick, t,
}: {
  capas: CAPA[];
  ncrs: NCR[];
  expandedCAPA: number | null;
  setExpandedCAPA: (id: number | null) => void;
  onStatusChange: (id: number, status: string) => void;
  onCreateClick: () => void;
  t: (key: string) => string;
}) {
  const capaStatuses: CAPAStatus[] = ["open", "in_progress", "verification", "closed"];
  const now = new Date().toISOString();

  const ncrMap = useMemo(() => {
    const map: Record<number, string> = {};
    ncrs.forEach((n) => { map[n.id] = n.ncr_number; });
    return map;
  }, [ncrs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-th-text">{t("quality.capaTracker")}</h3>
        <button onClick={onCreateClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all">
          <Plus className="w-4 h-4" /> {t("quality.createCAPA")}
        </button>
      </div>

      {capas.length === 0 ? (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-12 text-center">
          <p className="text-th-text-3">{t("quality.noCAPAs")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-th-border">
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.capaNumber")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.type")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.title")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.status")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.priority")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.dueDate")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.linkedNCR")}</th>
                  <th className="text-center px-4 py-3 text-th-text-2 font-semibold">{t("quality.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {capas.map((capa) => {
                  const isOverdue = capa.due_date && capa.status !== "closed" && capa.due_date < now;
                  return (
                    <>
                      <tr key={capa.id}
                        className={`border-b border-th-border/50 hover:bg-th-bg transition cursor-pointer ${isOverdue ? "bg-red-500/5" : ""}`}
                        onClick={() => setExpandedCAPA(expandedCAPA === capa.id ? null : capa.id)}>
                        <td className="px-4 py-3 text-th-text font-mono text-xs">{capa.capa_number}</td>
                        <td className="px-4 py-3 text-th-text whitespace-nowrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            capa.capa_type === "corrective" ? "bg-blue-500/15 text-blue-500" : "bg-purple-500/15 text-purple-500"
                          }`}>{t(`quality.capaType${capa.capa_type.charAt(0).toUpperCase()}${capa.capa_type.slice(1)}`)}</span>
                        </td>
                        <td className="px-4 py-3 text-th-text max-w-xs truncate" title={capa.title}>{capa.title}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={capa.status} colorMap={CAPA_STATUS_COLORS} t={t} prefix="quality.capaStatus" />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${PRIORITY_COLORS[capa.priority] || "text-th-text-2"}`}>
                            {t(`quality.priority${capa.priority.charAt(0).toUpperCase()}${capa.priority.slice(1)}`)}
                          </span>
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap ${isOverdue ? "text-red-500 font-semibold" : "text-th-text"}`}>
                          {capa.due_date ? capa.due_date.slice(0, 10) : "-"}
                          {isOverdue && <span className="ml-1 text-[10px] uppercase">{t("quality.overdue")}</span>}
                        </td>
                        <td className="px-4 py-3 text-th-text-2 text-xs">{capa.ncr_id ? ncrMap[capa.ncr_id] ?? "-" : "-"}</td>
                        <td className="px-4 py-3 text-center">
                          {expandedCAPA === capa.id ? <ChevronUp className="w-4 h-4 text-th-text-3 inline" /> : <ChevronDown className="w-4 h-4 text-th-text-3 inline" />}
                        </td>
                      </tr>
                      {expandedCAPA === capa.id && (
                        <tr key={`${capa.id}-detail`} className="border-b border-th-border/50 bg-th-bg">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="space-y-3">
                              <p className="text-sm text-th-text-2"><strong>{t("quality.description")}:</strong> {capa.description}</p>
                              {capa.root_cause && <p className="text-sm text-th-text-2"><strong>{t("quality.rootCause")}:</strong> {capa.root_cause}</p>}
                              {capa.effectiveness_result && <p className="text-sm text-th-text-2"><strong>{t("quality.effectiveness")}:</strong> {capa.effectiveness_result}</p>}
                              {capa.verified_at && <p className="text-sm text-th-text-2"><strong>{t("quality.verifiedAt")}:</strong> {capa.verified_at.slice(0, 10)}</p>}
                              <div className="flex gap-2 mt-2">
                                {capaStatuses.filter((s) => s !== capa.status).map((s) => (
                                  <button key={s} onClick={(e) => { e.stopPropagation(); onStatusChange(capa.id, s); }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-th-bg-2 border border-th-border text-th-text-2 hover:bg-th-bg-3 transition">
                                    <ArrowRight className="w-3 h-3 inline mr-1" />
                                    {t(`quality.capaStatus${s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")}`)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Defect Catalog View ────────────────────────────────────────────────────

function DefectCatalogView({ defects, t }: { defects: DefectEntry[]; t: (key: string) => string }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-th-text">{t("quality.defectCatalog")}</h3>
      {defects.length === 0 ? (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-12 text-center">
          <p className="text-th-text-3">{t("quality.noDefects")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-th-border">
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.code")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.name")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.severity")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.category")}</th>
                </tr>
              </thead>
              <tbody>
                {defects.map((d) => (
                  <tr key={d.id} className="border-b border-th-border/50 hover:bg-th-bg transition">
                    <td className="px-4 py-3 text-th-text font-mono text-xs">{d.code}</td>
                    <td className="px-4 py-3 text-th-text">{d.name}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={d.severity} t={t} /></td>
                    <td className="px-4 py-3 text-th-text-2">{d.category || "-"}</td>
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

// ─── Inspections View ───────────────────────────────────────────────────────

function InspectionsView({
  records, lineNameMap, productionLines, onStartCheck, templates, t,
}: {
  records: QCRecord[];
  lineNameMap: Record<number, string>;
  productionLines: { id: number; name: string }[];
  onStartCheck: (lineId: number, templateId: number, checkType: string) => void;
  templates: { id: number; name: string; check_type: string }[];
  t: (key: string) => string;
}) {
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState<number>(0);
  const [selectedTemplate, setSelectedTemplate] = useState<number>(0);

  const statusColors: Record<string, string> = {
    in_progress: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    completed: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    passed: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    failed: "bg-red-500/15 text-red-500 border-red-500/30",
    voided: "bg-gray-500/15 text-gray-500 border-gray-500/30",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-th-text">{t("quality.inspections")}</h3>
        <button
          onClick={() => setShowStartModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          {t("quality.startInspection") || "Start Inspection"}
        </button>
      </div>

      {/* Start Inspection Modal */}
      {showStartModal && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-800 p-4 space-y-3">
          <h4 className="font-semibold text-th-text">{t("quality.startInspection") || "Start New Inspection"}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-th-text-2 mb-1">{t("quality.line") || "Production Line"}</label>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text"
              >
                <option value={0}>{t("common.select") || "Select..."}</option>
                {productionLines.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-th-text-2 mb-1">{t("quality.template") || "QC Template"}</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text"
              >
                <option value={0}>{t("quality.noTemplate") || "No template"}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.check_type})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              disabled={!selectedLine || !selectedTemplate}
              onClick={() => {
                const tpl = templates.find((t) => t.id === selectedTemplate);
                onStartCheck(selectedLine, selectedTemplate, tpl?.check_type || "in_process");
                setShowStartModal(false);
                setSelectedLine(0);
                setSelectedTemplate(0);
              }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
            >
              <CheckCircle className="w-4 h-4 inline mr-1" />
              {t("quality.beginCheck") || "Begin Check"}
            </button>
            <button
              onClick={() => setShowStartModal(false)}
              className="px-4 py-2 border border-th-border text-th-text rounded-lg hover:bg-th-bg-3 transition text-sm"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-12 text-center">
          <p className="text-th-text-3">{t("quality.noInspections")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-th-border">
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">ID</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.checkType")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.line")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.status")}</th>
                  <th className="text-right px-4 py-3 text-th-text-2 font-semibold">{t("quality.score")}</th>
                  <th className="text-left px-4 py-3 text-th-text-2 font-semibold">{t("quality.date")}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-th-border/50 hover:bg-th-bg transition">
                    <td className="px-4 py-3 text-th-text font-mono text-xs">#{r.id}</td>
                    <td className="px-4 py-3 text-th-text whitespace-nowrap">{r.check_type}</td>
                    <td className="px-4 py-3 text-th-text whitespace-nowrap">{lineNameMap[r.production_line_id] ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${statusColors[r.status] || "bg-th-bg-2 text-th-text-2 border-th-border"}`}>
                        {t(`quality.inspStatus${r.status.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-th-text tabular-nums">{r.overall_score_pct != null ? `${r.overall_score_pct.toFixed(1)}%` : "-"}</td>
                    <td className="px-4 py-3 text-th-text whitespace-nowrap">{r.started_at.slice(0, 10)}</td>
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

// ─── Shared Badge Components ────────────────────────────────────────────────

function SeverityBadge({ severity, t }: { severity: string; t: (key: string) => string }) {
  const cfg = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.minor;
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${cfg.bg} ${cfg.border} border`}
      style={{ color: cfg.color }}>
      {t(`quality.${severity}`)}
    </span>
  );
}

function StatusBadge({ status, colorMap, t, prefix }: {
  status: string; colorMap: Record<string, string>; t: (key: string) => string; prefix: string;
}) {
  const cls = colorMap[status] || "bg-th-bg-2 text-th-text-2 border-th-border";
  const key = `${prefix}${status.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")}`;
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${cls}`}>
      {t(key)}
    </span>
  );
}

// ─── NCR Create Modal ───────────────────────────────────────────────────────

function NCRCreateModal({
  productionLines, onClose, onCreated, t,
}: {
  productionLines: { id: number; name: string }[];
  onClose: () => void;
  onCreated: () => void;
  t: (key: string) => string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [lineId, setLineId] = useState<number | "">(productionLines[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError(t("quality.fillRequired"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await qcApi.createNCR({
        title: title.trim(),
        description: description.trim(),
        severity,
        production_line_id: lineId ? Number(lineId) : null,
        quantity_affected: quantity ? Number(quantity) : null,
      });
      onCreated();
    } catch {
      setError(t("common.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-lg border border-th-border bg-th-bg text-th-text text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none";
  const labelCls = "text-xs font-medium text-th-text-2 mb-1.5 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-th-bg-2 rounded-2xl border border-th-border shadow-xl w-full max-w-lg p-8 mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-th-text">{t("quality.createNCR")}</h2>
          <button onClick={onClose} className="text-th-text-3 hover:text-th-text"><X className="w-5 h-5" /></button>
        </div>
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-2 rounded-lg mb-4">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>{t("quality.title")} *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>{t("quality.description")} *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls + " resize-none"} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("quality.severity")}</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputCls}>
                <option value="minor">{t("quality.minor")}</option>
                <option value="major">{t("quality.major")}</option>
                <option value="critical">{t("quality.critical")}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("quality.line")}</label>
              <select value={lineId} onChange={(e) => setLineId(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
                <option value="">{t("quality.none")}</option>
                {productionLines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>{t("quality.quantityAffected")}</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} min="0" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-lg font-semibold transition-all text-sm disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
            {t("quality.createNCR")}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── CAPA Create Modal ──────────────────────────────────────────────────────

function CAPACreateModal({
  ncrs, productionLines, onClose, onCreated, t,
}: {
  ncrs: NCR[];
  productionLines: { id: number; name: string }[];
  onClose: () => void;
  onCreated: () => void;
  t: (key: string) => string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [capaType, setCapaType] = useState("corrective");
  const [priority, setPriority] = useState("medium");
  const [ncrId, setNcrId] = useState<number | "">();
  const [lineId, setLineId] = useState<number | "">(productionLines[0]?.id ?? "");
  const [rootCause, setRootCause] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError(t("quality.fillRequired"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await qcApi.createCAPA({
        title: title.trim(),
        description: description.trim(),
        capa_type: capaType,
        priority,
        ncr_id: ncrId ? Number(ncrId) : null,
        production_line_id: lineId ? Number(lineId) : null,
        root_cause: rootCause.trim() || null,
        due_date: dueDate || null,
      });
      onCreated();
    } catch {
      setError(t("common.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-lg border border-th-border bg-th-bg text-th-text text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none";
  const labelCls = "text-xs font-medium text-th-text-2 mb-1.5 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-th-bg-2 rounded-2xl border border-th-border shadow-xl w-full max-w-lg p-8 mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-th-text">{t("quality.createCAPA")}</h2>
          <button onClick={onClose} className="text-th-text-3 hover:text-th-text"><X className="w-5 h-5" /></button>
        </div>
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-2 rounded-lg mb-4">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>{t("quality.title")} *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>{t("quality.description")} *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls + " resize-none"} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("quality.type")}</label>
              <select value={capaType} onChange={(e) => setCapaType(e.target.value)} className={inputCls}>
                <option value="corrective">{t("quality.capaTypeCorrective")}</option>
                <option value="preventive">{t("quality.capaTypePreventive")}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("quality.priority")}</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                <option value="low">{t("quality.priorityLow")}</option>
                <option value="medium">{t("quality.priorityMedium")}</option>
                <option value="high">{t("quality.priorityHigh")}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("quality.linkedNCR")}</label>
              <select value={ncrId ?? ""} onChange={(e) => setNcrId(e.target.value ? Number(e.target.value) : undefined)} className={inputCls}>
                <option value="">{t("quality.none")}</option>
                {ncrs.map((n) => <option key={n.id} value={n.id}>{n.ncr_number} - {n.title}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("quality.line")}</label>
              <select value={lineId} onChange={(e) => setLineId(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
                <option value="">{t("quality.none")}</option>
                {productionLines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>{t("quality.rootCause")}</label>
            <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} className={inputCls + " resize-none"} />
          </div>
          <div>
            <label className={labelCls}>{t("quality.dueDate")}</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-lg font-semibold transition-all text-sm disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
            {t("quality.createCAPA")}
          </button>
        </form>
      </div>
    </div>
  );
}
