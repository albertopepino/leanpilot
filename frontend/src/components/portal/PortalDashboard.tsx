"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { portalApi } from "@/lib/api";
import { useI18n } from "@/stores/useI18n";
import type { PortalClientSummary, PortalClientCreate } from "@/lib/types";
import {
  Building2, Plus, X, Users, MapPin, Activity,
  ToggleLeft, ToggleRight, ChevronRight, Shield,
} from "lucide-react";

export default function PortalDashboard() {
  const { t } = useI18n();
  const router = useRouter();
  const [clients, setClients] = useState<PortalClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PortalClientCreate>({
    organization_name: "",
    slug: "",
    subscription_tier: "starter",
    max_sites: 1,
    max_users: 10,
    site_name: "",
    site_location: "",
    site_country: "",
    admin_email: "",
    admin_full_name: "",
    admin_password: "",
    admin_language: "en",
  });

  const loadClients = useCallback(async () => {
    try {
      const res = await portalApi.listClients();
      setClients(res.data || []);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleCreate = async () => {
    if (!form.organization_name || !form.slug || !form.site_name || !form.admin_email || !form.admin_full_name || !form.admin_password) return;
    setCreating(true);
    try {
      await portalApi.createClient(form);
      setShowCreate(false);
      setForm({
        organization_name: "", slug: "", subscription_tier: "starter",
        max_sites: 1, max_users: 10, site_name: "", site_location: "",
        site_country: "", admin_email: "", admin_full_name: "",
        admin_password: "", admin_language: "en",
      });
      loadClients();
    } catch {
      /* handled by interceptor */
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (orgId: number, currentActive: boolean) => {
    try {
      await portalApi.toggleStatus(orgId, !currentActive);
      loadClients();
    } catch {
      /* empty */
    }
  };

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (loading) {
    return (
      <div className="p-8 text-th-text-3">
        {t("common.loading") || "Loading..."}
      </div>
    );
  }

  const activeCount = clients.filter(c => c.is_active).length;
  const totalUsers = clients.reduce((sum, c) => sum + c.user_count, 0);
  const totalSites = clients.reduce((sum, c) => sum + c.site_count, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/30">
            <Shield className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-th-text">
              {t("portal.title") || "Client Portal"}
            </h1>
            <p className="text-sm text-th-text-3">
              {t("portal.subtitle") || "Manage your consulting clients"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition"
        >
          <Plus className="w-4 h-4" />
          {t("portal.newClient") || "New Client"}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-th-card rounded-xl border border-th-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-brand-500" />
            <span className="text-sm text-th-text-3">{t("portal.activeClients") || "Active Clients"}</span>
          </div>
          <p className="text-2xl font-bold text-th-text">{activeCount}</p>
        </div>
        <div className="bg-th-card rounded-xl border border-th-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-th-text-3">{t("portal.totalUsers") || "Total Users"}</span>
          </div>
          <p className="text-2xl font-bold text-th-text">{totalUsers}</p>
        </div>
        <div className="bg-th-card rounded-xl border border-th-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-th-text-3">{t("portal.totalSites") || "Total Sites"}</span>
          </div>
          <p className="text-2xl font-bold text-th-text">{totalSites}</p>
        </div>
      </div>

      {/* Client List */}
      {clients.length === 0 ? (
        <div className="bg-th-card rounded-xl border border-th-border p-12 text-center">
          <Building2 className="w-12 h-12 text-th-text-3 mx-auto mb-3 opacity-40" />
          <p className="text-th-text-3">{t("portal.noClients") || "No clients yet. Create your first client to get started."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(client => (
            <div
              key={client.id}
              className="bg-th-card rounded-xl border border-th-border p-4 hover:shadow-card-hover transition cursor-pointer"
              onClick={() => router.push(`/portal/${client.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                    {client.logo_url ? (
                      <img src={client.logo_url} alt="" className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <Building2 className="w-5 h-5 text-brand-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-th-text">{client.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        client.is_active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      }`}>
                        {client.is_active ? t("common.active") || "Active" : t("common.inactive") || "Inactive"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-th-bg-2 text-th-text-3 uppercase">
                        {client.subscription_tier}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-th-text-3 mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {client.site_count} {t("portal.sites") || "sites"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {client.user_count} {t("portal.users") || "users"}
                      </span>
                      {client.created_at && (
                        <span>
                          {t("portal.since") || "Since"} {new Date(client.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(client.id, client.is_active);
                    }}
                    className="p-2 rounded-lg hover:bg-th-bg-hover transition"
                    title={client.is_active ? t("portal.deactivate") || "Deactivate" : t("portal.activate") || "Activate"}
                  >
                    {client.is_active ? (
                      <ToggleRight className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-th-text-3" />
                    )}
                  </button>
                  <ChevronRight className="w-5 h-5 text-th-text-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Client Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-th-card rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-th-text">
                {t("portal.newClient") || "New Client"}
              </h2>
              <button onClick={() => setShowCreate(false)}>
                <X className="w-5 h-5 text-th-text-3" />
              </button>
            </div>

            {/* Organization */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-th-text-3 uppercase tracking-wider">
                {t("portal.organization") || "Organization"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm text-th-text-3 mb-1">{t("portal.orgName") || "Organization Name"}</label>
                  <input
                    value={form.organization_name}
                    onChange={e => {
                      const name = e.target.value;
                      setForm(p => ({ ...p, organization_name: name, slug: autoSlug(name) }));
                    }}
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                    placeholder="Acme Manufacturing"
                  />
                </div>
                <div>
                  <label className="block text-sm text-th-text-3 mb-1">Slug</label>
                  <input
                    value={form.slug}
                    onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text font-mono text-sm"
                    placeholder="acme-manufacturing"
                  />
                </div>
                <div>
                  <label className="block text-sm text-th-text-3 mb-1">{t("portal.tier") || "Tier"}</label>
                  <select
                    value={form.subscription_tier}
                    onChange={e => setForm(p => ({ ...p, subscription_tier: e.target.value }))}
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                  >
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="business">Business</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-th-text-3 mb-1">{t("portal.maxSites") || "Max Sites"}</label>
                  <input
                    type="number"
                    value={form.max_sites}
                    onChange={e => setForm(p => ({ ...p, max_sites: parseInt(e.target.value) || 1 }))}
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                    min={1}
                  />
                </div>
                <div>
                  <label className="block text-sm text-th-text-3 mb-1">{t("portal.maxUsers") || "Max Users"}</label>
                  <input
                    type="number"
                    value={form.max_users}
                    onChange={e => setForm(p => ({ ...p, max_users: parseInt(e.target.value) || 1 }))}
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                    min={1}
                  />
                </div>
              </div>
            </div>

            {/* First Site */}
            <div className="space-y-3 pt-3 border-t border-th-border">
              <p className="text-xs font-semibold text-th-text-3 uppercase tracking-wider">
                {t("portal.firstSite") || "First Site"}
              </p>
              <div>
                <label className="block text-sm text-th-text-3 mb-1">{t("portal.siteName") || "Site Name"}</label>
                <input
                  value={form.site_name}
                  onChange={e => setForm(p => ({ ...p, site_name: e.target.value }))}
                  className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                  placeholder="Main Plant"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-th-text-3 mb-1">{t("common.location") || "Location"}</label>
                  <input
                    value={form.site_location || ""}
                    onChange={e => setForm(p => ({ ...p, site_location: e.target.value }))}
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                    placeholder="Milan, IT"
                  />
                </div>
                <div>
                  <label className="block text-sm text-th-text-3 mb-1">{t("common.country") || "Country"}</label>
                  <input
                    value={form.site_country || ""}
                    onChange={e => setForm(p => ({ ...p, site_country: e.target.value }))}
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                    placeholder="IT"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            {/* Admin User */}
            <div className="space-y-3 pt-3 border-t border-th-border">
              <p className="text-xs font-semibold text-th-text-3 uppercase tracking-wider">
                {t("portal.adminUser") || "Admin User"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm text-th-text-3 mb-1">{t("common.fullName") || "Full Name"}</label>
                  <input
                    value={form.admin_full_name}
                    onChange={e => setForm(p => ({ ...p, admin_full_name: e.target.value }))}
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-th-text-3 mb-1">{t("common.email") || "Email"}</label>
                  <input
                    type="email"
                    value={form.admin_email}
                    onChange={e => setForm(p => ({ ...p, admin_email: e.target.value }))}
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                  />
                </div>
                <div>
                  <label className="block text-sm text-th-text-3 mb-1">{t("common.password") || "Password"}</label>
                  <input
                    type="password"
                    value={form.admin_password}
                    onChange={e => setForm(p => ({ ...p, admin_password: e.target.value }))}
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                  />
                </div>
                <div>
                  <label className="block text-sm text-th-text-3 mb-1">{t("common.language") || "Language"}</label>
                  <select
                    value={form.admin_language}
                    onChange={e => setForm(p => ({ ...p, admin_language: e.target.value }))}
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                  >
                    <option value="en">English</option>
                    <option value="it">Italiano</option>
                    <option value="de">Deutsch</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="pl">Polski</option>
                    <option value="sr">Srpski</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-th-border">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-th-border rounded-lg text-th-text-3 hover:bg-th-bg-hover transition"
              >
                {t("common.cancel") || "Cancel"}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
              >
                {creating ? t("common.creating") || "Creating..." : t("common.create") || "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
