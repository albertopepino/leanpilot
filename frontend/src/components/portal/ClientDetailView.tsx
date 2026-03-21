"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { portalApi } from "@/lib/api";
import { useI18n } from "@/stores/useI18n";
import type { PortalClientDetail, PortalClientHealth } from "@/lib/types";
import {
  ArrowLeft, Building2, Users, MapPin, Activity,
  Download, Trash2, Shield, Clock, BarChart3,
} from "lucide-react";

interface Props {
  orgId: number;
}

export default function ClientDetailView({ orgId }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [client, setClient] = useState<PortalClientDetail | null>(null);
  const [health, setHealth] = useState<PortalClientHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [erasing, setErasing] = useState(false);
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);

  const load = useCallback(async () => {
    try {
      const [clientRes, healthRes] = await Promise.all([
        portalApi.getClient(orgId),
        portalApi.getHealth(orgId),
      ]);
      setClient(clientRes.data);
      setHealth(healthRes.data);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGDPRExport = async () => {
    try {
      const res = await portalApi.gdprExport(orgId);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gdpr-export-${client?.slug || orgId}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* empty */
    }
  };

  const handleGDPRErase = async () => {
    setErasing(true);
    try {
      await portalApi.gdprErase(orgId);
      setShowEraseConfirm(false);
      load();
    } catch {
      /* empty */
    } finally {
      setErasing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-th-text-3">{t("common.loading") || "Loading..."}</div>;
  }

  if (!client) {
    return (
      <div className="p-8 text-center text-th-text-3">
        {t("portal.clientNotFound") || "Client not found"}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/portal")}
          className="p-2 rounded-lg hover:bg-th-bg-hover transition"
        >
          <ArrowLeft className="w-5 h-5 text-th-text-3" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-th-text">{client.name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
              client.is_active
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            }`}>
              {client.is_active ? t("common.active") || "Active" : t("common.inactive") || "Inactive"}
            </span>
          </div>
          <p className="text-sm text-th-text-3 font-mono">{client.slug} · {client.subscription_tier}</p>
        </div>
      </div>

      {/* Health Metrics */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard
            icon={<Users className="w-4 h-4 text-brand-500" />}
            label={t("portal.totalUsers") || "Total Users"}
            value={health.total_users}
          />
          <MetricCard
            icon={<Activity className="w-4 h-4 text-emerald-500" />}
            label={t("portal.active30d") || "Active (30d)"}
            value={health.active_users_30d}
          />
          <MetricCard
            icon={<BarChart3 className="w-4 h-4 text-amber-500" />}
            label={t("portal.latestOEE") || "Latest OEE"}
            value={health.latest_oee != null ? `${health.latest_oee.toFixed(1)}%` : "—"}
          />
          <MetricCard
            icon={<MapPin className="w-4 h-4 text-purple-500" />}
            label={t("portal.openItems") || "Open Items"}
            value={health.open_kaizen + health.open_ncrs}
          />
        </div>
      )}

      {/* Sites */}
      <div className="bg-th-card rounded-xl border border-th-border p-5">
        <h2 className="text-sm font-semibold text-th-text mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-th-text-3" />
          {t("portal.sites") || "Sites"} ({client.sites.length})
        </h2>
        {client.sites.length === 0 ? (
          <p className="text-sm text-th-text-3">{t("portal.noSites") || "No sites"}</p>
        ) : (
          <div className="space-y-2">
            {client.sites.map(site => (
              <div key={site.id} className="flex items-center justify-between p-3 rounded-lg bg-th-bg">
                <div>
                  <p className="text-sm font-medium text-th-text">{site.name}</p>
                  <p className="text-xs text-th-text-3">
                    {[site.location, site.country].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                {site.site_code && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-th-bg-2 text-th-text-3">
                    {site.site_code}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users */}
      <div className="bg-th-card rounded-xl border border-th-border p-5">
        <h2 className="text-sm font-semibold text-th-text mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-th-text-3" />
          {t("portal.users") || "Users"} ({client.users.length})
        </h2>
        {client.users.length === 0 ? (
          <p className="text-sm text-th-text-3">{t("portal.noUsers") || "No users"}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-th-text-3 border-b border-th-border">
                  <th className="pb-2 font-medium">{t("common.name") || "Name"}</th>
                  <th className="pb-2 font-medium">{t("common.email") || "Email"}</th>
                  <th className="pb-2 font-medium">{t("common.role") || "Role"}</th>
                  <th className="pb-2 font-medium">{t("common.status") || "Status"}</th>
                  <th className="pb-2 font-medium">{t("portal.lastLogin") || "Last Login"}</th>
                </tr>
              </thead>
              <tbody>
                {client.users.map(user => (
                  <tr key={user.id} className="border-b border-th-border/50">
                    <td className="py-2 text-th-text">{user.full_name}</td>
                    <td className="py-2 text-th-text-3">{user.email}</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 capitalize">
                        {user.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={`w-2 h-2 rounded-full inline-block ${user.is_active ? "bg-emerald-500" : "bg-red-400"}`} />
                    </td>
                    <td className="py-2 text-th-text-3 text-xs">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GDPR Actions */}
      <div className="bg-th-card rounded-xl border border-th-border p-5">
        <h2 className="text-sm font-semibold text-th-text mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-th-text-3" />
          {t("portal.gdprActions") || "GDPR Data Management"}
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGDPRExport}
            className="flex items-center gap-2 px-4 py-2 border border-th-border rounded-lg text-th-text hover:bg-th-bg-hover transition"
          >
            <Download className="w-4 h-4" />
            {t("portal.exportData") || "Export Data (Art. 20)"}
          </button>
          <button
            onClick={() => setShowEraseConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            <Trash2 className="w-4 h-4" />
            {t("portal.eraseData") || "Erase Data (Art. 17)"}
          </button>
        </div>
      </div>

      {/* Erase Confirmation */}
      {showEraseConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-th-card rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-red-600">
              {t("portal.eraseConfirmTitle") || "Confirm Data Erasure"}
            </h3>
            <p className="text-sm text-th-text">
              {t("portal.eraseConfirmMessage") || "This will permanently anonymize all personal data for this organization. This action cannot be undone. The organization will be deactivated."}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowEraseConfirm(false)}
                className="px-4 py-2 border border-th-border rounded-lg text-th-text-3"
              >
                {t("common.cancel") || "Cancel"}
              </button>
              <button
                onClick={handleGDPRErase}
                disabled={erasing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {erasing ? t("portal.erasing") || "Erasing..." : t("portal.confirmErase") || "Erase All Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-th-card rounded-xl border border-th-border p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-th-text-3">{label}</span>
      </div>
      <p className="text-xl font-bold text-th-text">{value}</p>
    </div>
  );
}
