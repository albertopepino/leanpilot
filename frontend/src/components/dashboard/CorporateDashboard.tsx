"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useSite } from "@/stores/useSite";
import { organizationApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import type { SiteDashboardSummary } from "@/lib/types";
import {
  Building2,
  Shield,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ─── Component ─── */
export default function CorporateDashboard() {
  const { t } = useI18n();
  const { sites, setActiveSite } = useSite();
  const router = useRouter();
  const [summaries, setSummaries] = useState<SiteDashboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await organizationApi.getMyOrg();
      const orgId = res.data?.id;
      if (orgId) {
        const dashRes = await organizationApi.getDashboard(orgId);
        setSummaries(dashRes.data?.sites ?? dashRes.data ?? []);
      }
    } catch (err: unknown) {
      // 404 = user not associated with an organization — show fallback without error
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404) {
        setError(t("common.failedToLoadData") || "Failed to load data");
      }
      // Use fallback summaries from sites list when API not available
      // Access via getState() to avoid stale closure / infinite re-render loop
      const currentSites = useSite.getState().sites;
      setSummaries(
        currentSites.map((s) => ({
          id: s.id,
          name: s.name,
          site_code: s.site_code,
          location: null,
          country: null,
          oee: null,
          safety_days: null,
          open_ncrs: null,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleSiteClick(siteId: number) {
    setActiveSite(siteId);
    router.push("/operations/home");
  }

  const oeeChartData = summaries
    .filter((s) => s.oee !== null)
    .map((s) => ({
      name: s.site_code || s.name,
      oee: Number(((s.oee ?? 0) * 100).toFixed(1)),
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-text">
            {t("dashboard.corporateTitle") || "Corporate Dashboard"}
          </h1>
          <p className="text-sm text-th-text-3 mt-1">
            {t("dashboard.siteComparison") || "Cross-site performance comparison"}
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-th-bg-hover hover:bg-th-border text-th-text-2 text-sm transition-colors"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? (t("common.loading") || "Loading...") : (t("common.retry") || "Refresh")}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Site cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {summaries.map((site) => (
          <button
            key={site.id}
            onClick={() => handleSiteClick(site.id)}
            className="bg-th-card border border-th-border rounded-xl p-4 text-left hover:border-brand-500/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 size={16} className="text-th-text-3 shrink-0" />
                <h3 className="font-semibold text-th-text truncate">{site.name}</h3>
              </div>
              {site.site_code && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-600 dark:text-brand-400 leading-none shrink-0">
                  {site.site_code}
                </span>
              )}
            </div>

            {/* OEE */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-th-text-3 mb-1">
                <span>{t("dashboard.oee") || "OEE"}</span>
                <span className="font-bold text-th-text">
                  {site.oee !== null ? `${(site.oee * 100).toFixed(1)}%` : "--"}
                </span>
              </div>
              <div className="w-full h-2 bg-th-bg-hover rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    site.oee !== null && site.oee >= 0.85
                      ? "bg-emerald-500"
                      : site.oee !== null && site.oee >= 0.65
                        ? "bg-amber-400"
                        : "bg-rose-500"
                  }`}
                  style={{ width: site.oee !== null ? `${site.oee * 100}%` : "0%" }}
                />
              </div>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="text-center">
                <Shield size={12} className="text-emerald-500 mx-auto mb-0.5" />
                <div className="text-xs font-bold text-th-text">{site.safety_days ?? "--"}</div>
                <div className="text-[9px] text-th-text-3">
                  {t("common.navSafety") || "Safety"}
                </div>
              </div>
              <div className="text-center">
                <AlertTriangle size={12} className="text-rose-500 mx-auto mb-0.5" />
                <div className="text-xs font-bold text-th-text">{site.open_ncrs ?? 0}</div>
                <div className="text-[9px] text-th-text-3">
                  {t("common.navNCR") || "NCRs"}
                </div>
              </div>
            </div>

            {/* Navigate hint */}
            <div className="flex items-center justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight size={14} className="text-brand-500" />
            </div>
          </button>
        ))}

        {summaries.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-th-text-3">
            {t("common.noData") || "No data"}
          </div>
        )}
      </div>

      {/* Charts row */}
      {oeeChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* OEE by site bar chart */}
          <div className="bg-th-card border border-th-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-th-text mb-4">
              {t("dashboard.oeeBysite") || "OEE by Site"}
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={oeeChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "OEE"]}
                    contentStyle={{
                      borderRadius: 8,
                      fontSize: 12,
                      border: "1px solid var(--border-primary)",
                      backgroundColor: "var(--card-bg)",
                    }}
                  />
                  <Bar dataKey="oee" fill="var(--color-brand-500, #3b82f6)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cross-site escalations */}
          <div className="bg-th-card border border-th-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-th-text mb-4">
              {t("dashboard.crossSiteEscalations") || "Cross-Site Escalations"}
            </h2>
            <div className="space-y-3">
              {summaries
                .filter((s) => (s.open_ncrs ?? 0) > 0)
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-th-bg-hover"
                  >
                    {s.site_code && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 leading-none shrink-0">
                        {s.site_code}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-th-text font-medium truncate">{s.name}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {(s.open_ncrs ?? 0) > 0 && (
                        <span className="text-rose-500 font-semibold">
                          {s.open_ncrs} NCR
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              {summaries.every((s) => (s.open_ncrs ?? 0) === 0) && (
                <div className="text-center py-8 text-th-text-3 text-sm">
                  {t("common.noData") || "No escalations"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
