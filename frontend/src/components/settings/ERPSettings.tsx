"use client";
import { useState, useEffect } from "react";
import { adminApi } from "@/lib/api";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/formatters";
import {
  Link2,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  Settings,
} from "lucide-react";

interface ERPIntegration {
  id: number;
  erp_type: string;
  display_name: string | null;
  is_active: boolean;
  host: string | null;
  port: number | null;
  database_name: string | null;
  username: string | null;
  has_password: boolean;
  has_api_key: boolean;
  sap_client: string | null;
  sap_system_number: string | null;
  oracle_service_name: string | null;
  sync_products: boolean | null;
  sync_production_orders: boolean | null;
  sync_inventory: boolean | null;
  sync_interval_minutes: number | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
}

const ERP_TYPES = [
  { value: "navision", label: "Microsoft Dynamics 365 Business Central (Navision)", color: "bg-blue-500" },
  { value: "sap", label: "SAP S/4HANA / Business One", color: "bg-sky-500" },
  { value: "oracle", label: "Oracle ERP Cloud / E-Business Suite", color: "bg-red-500" },
];

const inputCls = "w-full px-3 py-2 rounded-lg border bg-th-input border-th-input-border text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
const labelCls = "block text-xs font-medium text-th-text-2 mb-1";

export default function ERPSettings() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<ERPIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    erp_type: "navision",
    display_name: "",
    is_active: false,
    host: "",
    port: 443,
    database_name: "",
    username: "",
    password: "",
    api_key: "",
    sap_client: "",
    sap_system_number: "",
    oracle_service_name: "",
    sync_products: true,
    sync_production_orders: true,
    sync_inventory: false,
    sync_interval_minutes: 60,
  });

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    loadIntegrations();
  }, [isAdmin]);

  const loadIntegrations = async () => {
    try {
      const res = await adminApi.listERPIntegrations();
      setIntegrations(res.data ?? res);
    } catch (e) {
      setError(getErrorMessage(e, "Failed to load integrations"));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      erp_type: "navision", display_name: "", is_active: false,
      host: "", port: 443, database_name: "", username: "",
      password: "", api_key: "", sap_client: "", sap_system_number: "",
      oracle_service_name: "", sync_products: true, sync_production_orders: true,
      sync_inventory: false, sync_interval_minutes: 60,
    });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editId) {
        await adminApi.updateERPIntegration(editId, form);
      } else {
        await adminApi.createERPIntegration(form);
      }
      await loadIntegrations();
      resetForm();
    } catch (e) {
      setError(getErrorMessage(e, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this ERP integration?")) return;
    try {
      await adminApi.deleteERPIntegration(id);
      await loadIntegrations();
    } catch (e) {
      setError(getErrorMessage(e, "Failed to delete"));
    }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await adminApi.testERPConnection(id);
      const data = res.data ?? res;
      setTestResult({ id, success: data.success, message: data.message });
    } catch (e) {
      setTestResult({ id, success: false, message: getErrorMessage(e, "Connection failed") });
    } finally {
      setTesting(null);
    }
  };

  const handleSync = async (id: number) => {
    setSyncing(id);
    try {
      await adminApi.triggerERPSync(id);
      await loadIntegrations();
    } catch (e) {
      setError(getErrorMessage(e, "Sync failed"));
    } finally {
      setSyncing(null);
    }
  };

  const openEdit = (integration: ERPIntegration) => {
    setForm({
      erp_type: integration.erp_type,
      display_name: integration.display_name || "",
      is_active: integration.is_active,
      host: integration.host || "",
      port: integration.port || 443,
      database_name: integration.database_name || "",
      username: integration.username || "",
      password: "",
      api_key: "",
      sap_client: integration.sap_client || "",
      sap_system_number: integration.sap_system_number || "",
      oracle_service_name: integration.oracle_service_name || "",
      sync_products: integration.sync_products ?? true,
      sync_production_orders: integration.sync_production_orders ?? true,
      sync_inventory: integration.sync_inventory ?? false,
      sync_interval_minutes: integration.sync_interval_minutes ?? 60,
    });
    setEditId(integration.id);
    setShowForm(true);
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-th-text-3">
        <Link2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p>ERP integration settings are available to administrators only.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-th-text flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            ERP Integration
          </h3>
          <p className="text-sm text-th-text-3 mt-1">
            Connect to Navision, SAP, or Oracle to sync products, production orders, and inventory.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition"
          >
            <Plus className="w-4 h-4" />
            Add Integration
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Integration form */}
      {showForm && (
        <div className="rounded-xl border border-th-border bg-th-bg-2 p-6 space-y-4">
          <h4 className="text-sm font-bold text-th-text">
            {editId ? "Edit Integration" : "New Integration"}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>ERP System</label>
              <select
                value={form.erp_type}
                onChange={(e) => setForm({ ...form, erp_type: e.target.value })}
                className={inputCls}
              >
                {ERP_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Display Name</label>
              <input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="e.g. Production SAP"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Host / URL</label>
              <input
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="https://api.businesscentral.dynamics.com/..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Port</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 443 })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Database</label>
              <input
                value={form.database_name}
                onChange={(e) => setForm({ ...form, database_name: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Password {editId ? "(leave empty to keep)" : ""}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>API Key {editId ? "(leave empty to keep)" : ""}</label>
              <input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          {/* SAP-specific fields */}
          {form.erp_type === "sap" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>SAP Client</label>
                <input
                  value={form.sap_client}
                  onChange={(e) => setForm({ ...form, sap_client: e.target.value })}
                  placeholder="100"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>System Number</label>
                <input
                  value={form.sap_system_number}
                  onChange={(e) => setForm({ ...form, sap_system_number: e.target.value })}
                  placeholder="00"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Oracle-specific fields */}
          {form.erp_type === "oracle" && (
            <div>
              <label className={labelCls}>Oracle Service Name</label>
              <input
                value={form.oracle_service_name}
                onChange={(e) => setForm({ ...form, oracle_service_name: e.target.value })}
                placeholder="e.g. ORCL"
                className={inputCls}
              />
            </div>
          )}

          {/* Sync settings */}
          <div className="pt-3 border-t border-th-border">
            <h5 className="text-xs font-bold text-th-text-2 uppercase tracking-wide mb-3">Sync Settings</h5>
            <div className="flex flex-wrap gap-4">
              {[
                { key: "sync_products" as const, label: "Products" },
                { key: "sync_production_orders" as const, label: "Production Orders" },
                { key: "sync_inventory" as const, label: "Inventory" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-th-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    className="rounded border-th-border"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label className="text-xs text-th-text-2">Sync interval:</label>
              <select
                value={form.sync_interval_minutes}
                onChange={(e) => setForm({ ...form, sync_interval_minutes: parseInt(e.target.value) })}
                className="px-2 py-1 rounded border bg-th-input border-th-input-border text-th-text text-xs"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
                <option value={240}>4 hours</option>
                <option value={1440}>Daily</option>
              </select>
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2 text-sm text-th-text cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-th-border"
            />
            Enable integration
          </label>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !form.host}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editId ? "Update" : "Create"}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-lg bg-th-bg-3 text-th-text-2 text-sm font-medium hover:bg-th-bg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing integrations */}
      {integrations.length === 0 && !showForm ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-th-border bg-th-bg-2">
          <Settings className="w-12 h-12 mx-auto text-th-text-3 opacity-40 mb-3" />
          <p className="text-sm text-th-text-3">No ERP integrations configured yet.</p>
          <p className="text-xs text-th-text-3 mt-1">Click "Add Integration" to connect your ERP system.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration) => {
            const erpType = ERP_TYPES.find((t) => t.value === integration.erp_type);
            return (
              <div
                key={integration.id}
                className="rounded-xl border border-th-border bg-th-bg-2 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${integration.is_active ? "bg-emerald-500" : "bg-gray-400"}`} />
                    <div>
                      <h4 className="text-sm font-bold text-th-text">
                        {integration.display_name || erpType?.label || integration.erp_type.toUpperCase()}
                      </h4>
                      <p className="text-xs text-th-text-3">{integration.host}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTest(integration.id)}
                      disabled={testing === integration.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-th-bg-3 text-th-text-2 hover:bg-th-bg transition"
                    >
                      {testing === integration.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      Test
                    </button>
                    {integration.is_active && (
                      <button
                        onClick={() => handleSync(integration.id)}
                        disabled={syncing === integration.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 transition"
                      >
                        {syncing === integration.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Sync
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(integration)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-th-bg-3 text-th-text-2 hover:bg-th-bg transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(integration.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Test result */}
                {testResult && testResult.id === integration.id && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                    testResult.success
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                  }`}>
                    {testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {testResult.message}
                  </div>
                )}

                {/* Sync status */}
                {integration.last_sync_at && (
                  <div className="flex items-center gap-4 text-xs text-th-text-3">
                    <span>
                      Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                    </span>
                    <span className={`flex items-center gap-1 ${
                      integration.last_sync_status === "success" ? "text-emerald-600" :
                      integration.last_sync_status === "error" ? "text-red-600" : "text-amber-600"
                    }`}>
                      {integration.last_sync_status === "success" && <CheckCircle className="w-3 h-3" />}
                      {integration.last_sync_status === "error" && <XCircle className="w-3 h-3" />}
                      {integration.last_sync_status === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
                      {integration.last_sync_status}
                    </span>
                    {integration.last_sync_message && (
                      <span className="truncate max-w-[300px]">{integration.last_sync_message}</span>
                    )}
                  </div>
                )}

                {/* Sync config badges */}
                <div className="flex flex-wrap gap-1.5">
                  {integration.sync_products && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">Products</span>
                  )}
                  {integration.sync_production_orders && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">Production Orders</span>
                  )}
                  {integration.sync_inventory && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">Inventory</span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    Every {integration.sync_interval_minutes}min
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
