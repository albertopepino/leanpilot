"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import {
  Activity,
  BarChart3,
  Settings2,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Filter,
  X,
  Loader2,
  TrendingUp,
  Target,
  Gauge,
  Sigma,
  FileInput,
  Database,
  Info,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

type ChartType = "xbar_r" | "xbar_s" | "p" | "np" | "c" | "u";
type DataSource = "manual" | "api";

interface ControlLimits {
  ucl: number;
  cl: number;
  lcl: number;
}

interface Violation {
  rule: number;
  rule_name: string;
  point_index: number;
  subgroup_index: number;
  value: number;
}

interface ChartData {
  chart_label: string;
  values: number[];
  control_limits: ControlLimits;
  violations: Violation[];
}

interface ProcessCapability {
  cp: number | null;
  cpk: number | null;
  pp: number | null;
  ppk: number | null;
  sigma_level: number | null;
  mean: number;
  std_dev: number;
  usl: number | null;
  lsl: number | null;
}

interface SPCResult {
  chart_type: string;
  subgroup_size: number;
  total_subgroups: number;
  charts: ChartData[];
  capability: ProcessCapability | null;
  pct_in_control: number;
  subgroup_labels: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CHART_TYPES: { key: ChartType; labelKey: string; description: string }[] = [
  { key: "xbar_r", labelKey: "spc.xbarR", description: "Variable data - Means & Ranges" },
  { key: "xbar_s", labelKey: "spc.xbarS", description: "Variable data - Means & Std Dev" },
  { key: "p", labelKey: "spc.pChart", description: "Proportion defective" },
  { key: "np", labelKey: "spc.npChart", description: "Number defective" },
  { key: "c", labelKey: "spc.cChart", description: "Count of defects" },
  { key: "u", labelKey: "spc.uChart", description: "Defects per unit" },
];

const RULE_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f59e0b",
  3: "#8b5cf6",
  4: "#ec4899",
};

const RULE_DESCRIPTIONS: Record<number, string> = {
  1: "Beyond 3-sigma",
  2: "9 consecutive same side",
  3: "6 consecutive trend",
  4: "14 alternating",
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function SPCCharts() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { printView, exportToExcel } = useExport();

  // Configuration
  const [chartType, setChartType] = useState<ChartType>("xbar_r");
  const [subgroupSize, setSubgroupSize] = useState(5);
  const [usl, setUsl] = useState<string>("");
  const [lsl, setLsl] = useState<string>("");
  const [dataSource, setDataSource] = useState<DataSource>("manual");

  // Data
  const [manualInput, setManualInput] = useState("");
  const [spcResult, setSpcResult] = useState<SPCResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API data source
  const [apiLineId, setApiLineId] = useState<string>("");
  const [apiDateFrom, setApiDateFrom] = useState("");
  const [apiDateTo, setApiDateTo] = useState("");
  const [productionLines, setProductionLines] = useState<{ id: number; name: string }[]>([]);

  // Load production lines
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("leanpilot_token");
        const res = await fetch("/api/v1/admin/factory", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProductionLines(data?.production_lines ?? []);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // ─── Parse Manual Data ──────────────────────────────────────────────

  const parseManualData = useCallback((): { measurements: number[][]; sampleSizes: number[] } | null => {
    if (!manualInput.trim()) return null;

    const lines = manualInput.trim().split("\n").filter((l) => l.trim());
    const measurements: number[][] = [];
    const sampleSizes: number[] = [];

    for (const line of lines) {
      const vals = line.split(/[,;\t\s]+/).map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v));
      if (vals.length === 0) continue;

      if (chartType === "p" || chartType === "np" || chartType === "c" || chartType === "u") {
        // Attribute charts: each line is one value (defectives/defects)
        // For p/u charts with variable sample size: "value,sample_size"
        if (chartType === "p" || chartType === "u") {
          measurements.push([vals[0]]);
          sampleSizes.push(vals[1] || subgroupSize);
        } else {
          measurements.push([vals[0]]);
        }
      } else {
        // Variable charts: each line is one subgroup
        measurements.push(vals);
      }
    }

    return measurements.length > 0 ? { measurements, sampleSizes } : null;
  }, [manualInput, chartType, subgroupSize]);

  // ─── Calculate SPC ──────────────────────────────────────────────────

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSpcResult(null);

    try {
      const token = localStorage.getItem("leanpilot_token");
      let measurements: number[][] = [];
      let sampleSizes: number[] | undefined;
      let labels: string[] = [];

      if (dataSource === "manual") {
        const parsed = parseManualData();
        if (!parsed || parsed.measurements.length < 2) {
          setError(t("spc.needMoreData"));
          setLoading(false);
          return;
        }
        measurements = parsed.measurements;
        sampleSizes = parsed.sampleSizes.length > 0 ? parsed.sampleSizes : undefined;
        labels = measurements.map((_, i) => `SG ${i + 1}`);
      } else {
        // Fetch from API
        const params = new URLSearchParams();
        if (apiLineId) params.set("line_id", apiLineId);
        if (apiDateFrom) params.set("date_from", apiDateFrom);
        if (apiDateTo) params.set("date_to", apiDateTo);
        params.set("subgroup_size", String(subgroupSize));

        const dataRes = await fetch(`/api/v1/spc/data?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!dataRes.ok) throw new Error("Failed to fetch SPC data");
        const apiData = await dataRes.json();

        if (!apiData.measurements || apiData.measurements.length < 2) {
          setError(t("spc.needMoreData"));
          setLoading(false);
          return;
        }
        measurements = apiData.measurements;
        labels = apiData.subgroup_labels || [];
      }

      // Call calculate endpoint
      const body: any = {
        chart_type: chartType,
        measurements,
        subgroup_size: subgroupSize,
      };
      if (usl) body.usl = parseFloat(usl);
      if (lsl) body.lsl = parseFloat(lsl);
      if (sampleSizes && sampleSizes.length > 0) body.sample_sizes = sampleSizes;

      const calcRes = await fetch("/api/v1/spc/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!calcRes.ok) {
        const errData = await calcRes.json().catch(() => ({}));
        throw new Error(errData.detail || "Calculation failed");
      }

      const result: SPCResult = await calcRes.json();
      result.subgroup_labels = labels;
      setSpcResult(result);
    } catch (err: any) {
      setError(err.message || t("spc.calculationError"));
    } finally {
      setLoading(false);
    }
  }, [dataSource, parseManualData, chartType, subgroupSize, usl, lsl, apiLineId, apiDateFrom, apiDateTo, t]);

  // ─── KPI values ─────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    if (!spcResult) return null;
    const cap = spcResult.capability;
    return {
      cp: cap?.cp,
      cpk: cap?.cpk,
      pctInControl: spcResult.pct_in_control,
      totalSubgroups: spcResult.total_subgroups,
      sigmaLevel: cap?.sigma_level,
    };
  }, [spcResult]);

  // ─── All violations aggregated ──────────────────────────────────────

  const allViolations = useMemo(() => {
    if (!spcResult) return [];
    const viols: Violation[] = [];
    for (const chart of spcResult.charts) {
      viols.push(...chart.violations);
    }
    return viols;
  }, [spcResult]);

  const chartTooltipStyle = {
    contentStyle: {
      backgroundColor: "var(--color-th-bg-2, rgba(17,17,27,0.95))",
      border: "1px solid var(--color-th-border, rgba(255,255,255,0.1))",
      borderRadius: 12,
      color: "var(--color-th-text, #e0e0e0)",
      fontSize: 12,
    },
  };

  const isVariableChart = chartType === "xbar_r" || chartType === "xbar_s";

  return (
    <div className="max-w-[1400px] mx-auto space-y-6" data-print-area="true">
      {/* Header */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-th-text tracking-tight">{t("spc.title")}</h2>
            <p className="text-sm text-th-text-3 mt-0.5">{t("spc.subtitle")}</p>
          </div>
        </div>

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <KPICard icon={<Target className="w-3.5 h-3.5 text-blue-500" />} label={t("spc.cp")}
              value={kpis.cp != null ? kpis.cp.toFixed(3) : "--"} color="text-blue-500" />
            <KPICard icon={<Gauge className="w-3.5 h-3.5 text-emerald-500" />} label={t("spc.cpk")}
              value={kpis.cpk != null ? kpis.cpk.toFixed(3) : "--"}
              color={kpis.cpk != null ? (kpis.cpk >= 1.33 ? "text-emerald-500" : kpis.cpk >= 1.0 ? "text-amber-500" : "text-red-500") : "text-th-text-3"} />
            <KPICard icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-500" />} label={t("spc.pctInControl")}
              value={`${kpis.pctInControl.toFixed(1)}%`}
              color={kpis.pctInControl >= 95 ? "text-emerald-500" : kpis.pctInControl >= 80 ? "text-amber-500" : "text-red-500"} />
            <KPICard icon={<BarChart3 className="w-3.5 h-3.5 text-purple-500" />} label={t("spc.totalSubgroups")}
              value={String(kpis.totalSubgroups)} color="text-purple-500" />
            <KPICard icon={<Sigma className="w-3.5 h-3.5 text-indigo-500" />} label={t("spc.sigmaLevel")}
              value={kpis.sigmaLevel != null ? kpis.sigmaLevel.toFixed(2) : "--"} color="text-indigo-500" />
          </div>
        )}
      </div>

      {/* Export */}
      <ExportToolbar
        onPrint={() => printView(t("spc.title"))}
        onExportExcel={() => {
          if (!spcResult || !spcResult.charts?.length) return;
          const chartData = spcResult.charts[0];
          exportToExcel({
            title: t("spc.title"),
            columns: [t("spc.subgroup"), t("spc.value"), "UCL", "CL", "LCL"],
            rows: chartData.values.map((v, i) => [
              spcResult.subgroup_labels[i] || `SG ${i + 1}`,
              v.toFixed(4),
              chartData.control_limits.ucl.toFixed(4),
              chartData.control_limits.cl.toFixed(4),
              chartData.control_limits.lcl.toFixed(4),
            ]),
          });
        }}
      />

      {/* Configuration */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 space-y-4">
        {/* Chart Type */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-th-text-3 mb-2 font-medium uppercase tracking-wider">
            <Settings2 className="w-3.5 h-3.5" />
            {t("spc.chartType")}
          </div>
          <div className="flex flex-wrap gap-2">
            {CHART_TYPES.map((ct) => (
              <button key={ct.key} onClick={() => { setChartType(ct.key); setSpcResult(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  chartType === ct.key
                    ? "bg-indigo-500 text-white"
                    : "bg-th-bg-3 text-th-text-2 border border-th-border hover:bg-th-bg-hover"
                }`}
                title={ct.description}>
                {t(ct.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Row */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-medium text-th-text-2 mb-1.5 block">{t("spc.subgroupSize")}</label>
            <input type="number" value={subgroupSize} onChange={(e) => setSubgroupSize(Math.max(2, Math.min(25, Number(e.target.value))))}
              min={2} max={25}
              className="w-24 px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm" />
          </div>
          {isVariableChart && (
            <>
              <div>
                <label className="text-xs font-medium text-th-text-2 mb-1.5 block">{t("spc.usl")}</label>
                <input type="number" step="any" value={usl} onChange={(e) => setUsl(e.target.value)}
                  placeholder="--"
                  className="w-28 px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-th-text-2 mb-1.5 block">{t("spc.lsl")}</label>
                <input type="number" step="any" value={lsl} onChange={(e) => setLsl(e.target.value)}
                  placeholder="--"
                  className="w-28 px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm" />
              </div>
            </>
          )}
        </div>

        {/* Data Source */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-th-text-3 mb-2 font-medium uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            {t("spc.dataSource")}
          </div>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setDataSource("manual")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dataSource === "manual" ? "bg-indigo-500 text-white" : "bg-th-bg-3 text-th-text-2 border border-th-border hover:bg-th-bg-hover"
              }`}>
              <FileInput className="w-4 h-4" /> {t("spc.manualEntry")}
            </button>
            <button onClick={() => setDataSource("api")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dataSource === "api" ? "bg-indigo-500 text-white" : "bg-th-bg-3 text-th-text-2 border border-th-border hover:bg-th-bg-hover"
              }`}>
              <Database className="w-4 h-4" /> {t("spc.fromInspections")}
            </button>
          </div>

          {dataSource === "manual" ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-th-text-3" />
                <span className="text-xs text-th-text-3">
                  {isVariableChart ? t("spc.manualHintVariable") : t("spc.manualHintAttribute")}
                </span>
              </div>
              <textarea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={isVariableChart
                  ? "10.2, 10.1, 10.3, 10.0, 10.2\n10.1, 10.4, 10.0, 10.3, 10.1\n..."
                  : "3\n5\n2\n4\n1\n..."}
                rows={8}
                className="w-full px-4 py-3 rounded-lg border border-th-border bg-th-bg text-th-text text-sm font-mono resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-xs font-medium text-th-text-2 mb-1.5 block">{t("spc.productionLine")}</label>
                <select value={apiLineId} onChange={(e) => setApiLineId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm min-w-[180px]">
                  <option value="">{t("spc.allLines")}</option>
                  {productionLines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-th-text-2 mb-1.5 block">{t("spc.dateFrom")}</label>
                <input type="date" value={apiDateFrom} onChange={(e) => setApiDateFrom(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-th-text-2 mb-1.5 block">{t("spc.dateTo")}</label>
                <input type="date" value={apiDateTo} onChange={(e) => setApiDateTo(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm" />
              </div>
            </div>
          )}
        </div>

        {/* Calculate Button */}
        <button onClick={handleCalculate} disabled={loading}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          {t("spc.calculate")}
        </button>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-2 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {spcResult && (
        <>
          {/* Charts */}
          {spcResult.charts.map((chart, idx) => (
            <SPCChartPanel
              key={idx}
              chart={chart}
              labels={spcResult.subgroup_labels}
              chartTooltipStyle={chartTooltipStyle}
              t={t}
            />
          ))}

          {/* Process Capability */}
          {spcResult.capability && (
            <CapabilityPanel capability={spcResult.capability} t={t} />
          )}

          {/* Violations Table */}
          {allViolations.length > 0 && (
            <ViolationsTable violations={allViolations} labels={spcResult.subgroup_labels} t={t} />
          )}
        </>
      )}
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-3.5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-th-text-3 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

// ─── SPC Chart Panel ────────────────────────────────────────────────────────

function SPCChartPanel({
  chart, labels, chartTooltipStyle, t,
}: {
  chart: ChartData;
  labels: string[];
  chartTooltipStyle: any;
  t: (key: string) => string;
}) {
  const violationIndices = useMemo(() => {
    const set = new Set<number>();
    chart.violations.forEach((v) => set.add(v.point_index));
    return set;
  }, [chart.violations]);

  const violationRuleMap = useMemo(() => {
    const map: Record<number, number[]> = {};
    chart.violations.forEach((v) => {
      if (!map[v.point_index]) map[v.point_index] = [];
      if (!map[v.point_index].includes(v.rule)) map[v.point_index].push(v.rule);
    });
    return map;
  }, [chart.violations]);

  const data = useMemo(() => {
    return chart.values.map((v, i) => ({
      name: labels[i] || `${i + 1}`,
      value: v,
      isViolation: violationIndices.has(i),
      rules: violationRuleMap[i] || [],
    }));
  }, [chart.values, labels, violationIndices, violationRuleMap]);

  const { ucl, cl, lcl } = chart.control_limits;

  // Y-axis domain with some padding
  const allVals = [...chart.values, ucl, lcl];
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const padding = (yMax - yMin) * 0.15 || 1;

  return (
    <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-th-text-2 uppercase tracking-wide">
          {t("spc.chartLabel")} — {chart.chart_label}
        </h3>
        <span className="text-xs text-th-text-3 ml-auto">
          UCL: {ucl.toFixed(4)} | CL: {cl.toFixed(4)} | LCL: {lcl.toFixed(4)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 20, right: 40, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-th-border, rgba(255,255,255,0.06))" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(0, Math.floor(data.length / 20))}
          />
          <YAxis
            domain={[yMin - padding, yMax + padding]}
            tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload;
              return (
                <div className="rounded-xl border border-th-border bg-th-bg-2 px-4 py-3 shadow-sm text-sm">
                  <p className="font-bold text-th-text mb-1">{d.name}</p>
                  <p className="text-th-text-2">{t("spc.value")}: <span className="font-semibold text-th-text">{d.value.toFixed(4)}</span></p>
                  {d.isViolation && (
                    <p className="text-red-500 font-semibold mt-1">
                      {d.rules.map((r: number) => `Rule ${r}`).join(", ")}
                    </p>
                  )}
                </div>
              );
            }}
          />
          {/* Control limit lines */}
          <ReferenceLine y={ucl} stroke="#ef4444" strokeDasharray="8 4" strokeWidth={2}
            label={{ value: "UCL", position: "insideTopRight", fill: "#ef4444", fontSize: 11, fontWeight: 700 }} />
          <ReferenceLine y={cl} stroke="#3b82f6" strokeWidth={2}
            label={{ value: "CL", position: "insideTopRight", fill: "#3b82f6", fontSize: 11, fontWeight: 700 }} />
          <ReferenceLine y={lcl} stroke="#ef4444" strokeDasharray="8 4" strokeWidth={2}
            label={{ value: "LCL", position: "insideBottomRight", fill: "#ef4444", fontSize: 11, fontWeight: 700 }} />

          {/* Data line */}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#6366f1"
            strokeWidth={2}
            dot={(props: any) => {
              const { cx, cy, payload } = props;
              if (payload.isViolation) {
                const ruleColor = payload.rules.length > 0 ? RULE_COLORS[payload.rules[0]] || "#ef4444" : "#ef4444";
                return (
                  <g key={`dot-${props.index}`}>
                    <circle cx={cx} cy={cy} r={7} fill={ruleColor} stroke="#fff" strokeWidth={2} />
                    <text x={cx} y={cy - 12} textAnchor="middle" fill={ruleColor} fontSize={9} fontWeight={700}>
                      R{payload.rules[0]}
                    </text>
                  </g>
                );
              }
              return <circle key={`dot-${props.index}`} cx={cx} cy={cy} r={3} fill="#6366f1" stroke="#fff" strokeWidth={1.5} />;
            }}
            activeDot={{ fill: "#6366f1", stroke: "#fff", strokeWidth: 2, r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-th-border flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-th-text-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-500" />
          <span className="font-medium">{t("spc.dataPoints")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0 border-t-2 border-dashed border-red-500" />
          <span className="font-medium">UCL / LCL</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0 border-t-2 border-blue-500" />
          <span className="font-medium">{t("spc.centerLine")}</span>
        </div>
        {[1, 2, 3, 4].map((rule) => (
          <div key={rule} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: RULE_COLORS[rule] }} />
            <span className="font-medium">{t(`spc.rule${rule}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Capability Panel ───────────────────────────────────────────────────────

function CapabilityPanel({ capability, t }: { capability: ProcessCapability; t: (key: string) => string }) {
  const capColor = (val: number | null) => {
    if (val == null) return "text-th-text-3";
    if (val >= 1.33) return "text-emerald-500";
    if (val >= 1.0) return "text-amber-500";
    return "text-red-500";
  };

  const capLabel = (val: number | null) => {
    if (val == null) return "--";
    if (val >= 1.67) return t("spc.excellent");
    if (val >= 1.33) return t("spc.capable");
    if (val >= 1.0) return t("spc.marginal");
    return t("spc.incapable");
  };

  return (
    <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-4 h-4 text-emerald-500" />
        <h3 className="text-sm font-semibold text-th-text-2 uppercase tracking-wide">{t("spc.processCapability")}</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: "Cp", value: capability.cp },
          { label: "Cpk", value: capability.cpk },
          { label: "Pp", value: capability.pp },
          { label: "Ppk", value: capability.ppk },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-xs text-th-text-3 uppercase tracking-wider font-medium mb-1">{item.label}</div>
            <div className={`text-2xl font-bold ${capColor(item.value)}`}>
              {item.value != null ? item.value.toFixed(3) : "--"}
            </div>
            <div className={`text-[10px] font-medium ${capColor(item.value)}`}>{capLabel(item.value)}</div>
          </div>
        ))}
        <div className="text-center">
          <div className="text-xs text-th-text-3 uppercase tracking-wider font-medium mb-1">{t("spc.mean")}</div>
          <div className="text-2xl font-bold text-th-text">{capability.mean.toFixed(4)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-th-text-3 uppercase tracking-wider font-medium mb-1">{t("spc.stdDev")}</div>
          <div className="text-2xl font-bold text-th-text">{capability.std_dev.toFixed(4)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-th-text-3 uppercase tracking-wider font-medium mb-1">{t("spc.specLimits")}</div>
          <div className="text-sm font-bold text-th-text">
            {capability.lsl != null ? capability.lsl.toFixed(2) : "--"} / {capability.usl != null ? capability.usl.toFixed(2) : "--"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Violations Table ───────────────────────────────────────────────────────

function ViolationsTable({ violations, labels, t }: { violations: Violation[]; labels: string[]; t: (key: string) => string }) {
  return (
    <div className="rounded-xl border border-th-border border-l-4 border-l-red-500 bg-th-bg-2 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <h3 className="text-sm font-semibold text-th-text-2 uppercase tracking-wide">
          {t("spc.outOfControl")} ({violations.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-th-border">
              <th className="text-left px-4 py-2 text-th-text-2 font-semibold">{t("spc.rule")}</th>
              <th className="text-left px-4 py-2 text-th-text-2 font-semibold">{t("spc.ruleDescription")}</th>
              <th className="text-left px-4 py-2 text-th-text-2 font-semibold">{t("spc.subgroup")}</th>
              <th className="text-right px-4 py-2 text-th-text-2 font-semibold">{t("spc.value")}</th>
            </tr>
          </thead>
          <tbody>
            {violations.map((v, i) => (
              <tr key={i} className="border-b border-th-border/50 hover:bg-th-bg transition">
                <td className="px-4 py-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: RULE_COLORS[v.rule] || "#ef4444" }}>
                    {v.rule}
                  </span>
                </td>
                <td className="px-4 py-2 text-th-text">{t(`spc.rule${v.rule}Desc`)}</td>
                <td className="px-4 py-2 text-th-text">{labels[v.point_index] || `SG ${v.point_index + 1}`}</td>
                <td className="px-4 py-2 text-right text-th-text font-mono tabular-nums">{v.value.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
