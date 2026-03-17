"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { adminApi, manufacturingApi } from "@/lib/api";
import GroupPoliciesPanel from "./GroupPoliciesPanel";

type ExportState = "idle" | "loading" | "success" | "error";

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  factory_id: number | null;
  language: string;
  last_login_at: string | null;
  created_at: string | null;
  ai_consent: boolean;
  marketing_consent: boolean;
  is_deleted: boolean;
}

interface AuditEntry {
  id: number;
  action: string;
  resource_type: string;
  resource_id: string | null;
  user_email: string | null;
  detail: string | null;
  ip_address: string | null;
  timestamp: string;
  legal_basis: string | null;
}

type Tab = "users" | "audit" | "permissions" | "factory" | "setup" | "groups";

const ROLES = ["admin", "plant_manager", "line_supervisor", "operator", "viewer"];
const ROLE_LABEL_KEYS: Record<string, string> = {
  admin: "admin.roleAdmin",
  plant_manager: "admin.rolePlantManager",
  line_supervisor: "admin.roleLineSupervisor",
  operator: "admin.roleOperator",
  viewer: "admin.roleViewer",
};

const PERM_COLORS: Record<string, string> = {
  full: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  modify: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  view: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  hidden: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600",
};

const PERM_LABEL_KEYS: Record<string, string> = {
  full: "admin.permFull",
  modify: "admin.permModify",
  view: "admin.permView",
  hidden: "admin.permHidden",
};

const ALL_TABS = [
  "assessment", "dashboard", "hourly", "andon", "production",
  "five-why", "ishikawa", "pareto", "a3", "kaizen",
  "vsm", "smed", "gemba", "six-s", "tpm", "cilt",
  "copilot", "resources", "admin",
];

export default function AdminPanel() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [factory, setFactory] = useState<any>(null);
  const [permissions, setPermissions] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "", full_name: "", role: "operator", language: "en", password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [exportState, setExportState] = useState<ExportState>("idle");

  // Factory Setup state
  const [prodLines, setProdLines] = useState<any[]>([]);
  const [workCenters, setWorkCenters] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [editingLine, setEditingLine] = useState<any | null>(null);
  const [editingWC, setEditingWC] = useState<any | null>(null);
  const [editingShift, setEditingShift] = useState<any | null>(null);
  const [expandedLine, setExpandedLine] = useState<number | null>(null);
  const [showLineForm, setShowLineForm] = useState(false);
  const [showWCForm, setShowWCForm] = useState(false);
  const [showShiftForm, setShowShiftForm] = useState<number | null>(null); // line_id
  const [showProductForm, setShowProductForm] = useState(false);
  const [lineForm, setLineForm] = useState({ name: "", product_type: "", target_oee: 85, target_cycle_time_seconds: "" as any });
  const [wcForm, setWCForm] = useState({ name: "", description: "", machine_type: "", capacity_units_per_hour: "" as any, production_line_id: 0 });
  const [shiftForm, setShiftForm] = useState({ name: "", start_hour: 6, end_hour: 14, planned_minutes: 480 });
  const [productForm, setProductForm] = useState({ code: "", name: "", product_family: "", unit_of_measure: "pcs" });

  const loadUsers = useCallback(async () => {
    try {
      const res = await adminApi.listUsers();
      setUsers(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await adminApi.getAuditLogs({ limit: 50 });
      setAuditLogs(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadFactory = useCallback(async () => {
    try {
      const res = await adminApi.getFactory();
      setFactory(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadPermissions = useCallback(async () => {
    try {
      const res = await adminApi.getPermissions();
      setPermissions(res.data.permissions || {});
    } catch { /* ignore */ }
  }, []);

  const loadSetupData = useCallback(async () => {
    try {
      const [linesRes, wcRes, prodRes] = await Promise.all([
        adminApi.listProductionLines(),
        manufacturingApi.listWorkCenters(),
        manufacturingApi.listProducts(false),
      ]);
      setProdLines(linesRes.data || []);
      setWorkCenters(wcRes.data || []);
      setProducts(prodRes.data || []);
    } catch { /* ignore */ }
  }, []);

  const handleCreateLine = async () => {
    clearMessages(); setLoading(true);
    try {
      await adminApi.createProductionLine({
        name: lineForm.name,
        product_type: lineForm.product_type || null,
        target_oee: lineForm.target_oee,
        target_cycle_time_seconds: lineForm.target_cycle_time_seconds || null,
      });
      setSuccess(t("admin.lineCreated"));
      setShowLineForm(false);
      setLineForm({ name: "", product_type: "", target_oee: 85, target_cycle_time_seconds: "" });
      loadSetupData();
    } catch (err: any) { setError(err.response?.data?.detail || "Failed"); }
    setLoading(false);
  };

  const handleUpdateLine = async () => {
    if (!editingLine) return;
    clearMessages(); setLoading(true);
    try {
      await adminApi.updateProductionLine(editingLine.id, {
        name: lineForm.name,
        product_type: lineForm.product_type || null,
        target_oee: lineForm.target_oee,
        target_cycle_time_seconds: lineForm.target_cycle_time_seconds || null,
      });
      setSuccess(t("admin.lineUpdated"));
      setEditingLine(null);
      loadSetupData();
    } catch (err: any) { setError(err.response?.data?.detail || "Failed"); }
    setLoading(false);
  };

  const handleDeleteLine = async (id: number) => {
    if (!confirm(t("admin.confirmDeleteLine"))) return;
    try {
      await adminApi.deleteProductionLine(id);
      setSuccess(t("admin.lineDeleted"));
      loadSetupData();
    } catch (err: any) { setError(err.response?.data?.detail || "Failed"); }
  };

  const handleCreateShift = async (lineId: number) => {
    clearMessages(); setLoading(true);
    try {
      await adminApi.createShift({
        production_line_id: lineId,
        name: shiftForm.name,
        start_hour: shiftForm.start_hour,
        end_hour: shiftForm.end_hour,
        planned_minutes: shiftForm.planned_minutes,
      });
      setSuccess(t("admin.shiftCreated"));
      setShowShiftForm(null);
      setShiftForm({ name: "", start_hour: 6, end_hour: 14, planned_minutes: 480 });
      loadSetupData();
    } catch (err: any) { setError(err.response?.data?.detail || "Failed"); }
    setLoading(false);
  };

  const handleDeleteShift = async (id: number) => {
    if (!confirm(t("admin.confirmDeleteShift"))) return;
    try {
      await adminApi.deleteShift(id);
      setSuccess(t("admin.shiftDeleted"));
      loadSetupData();
    } catch (err: any) { setError(err.response?.data?.detail || "Failed"); }
  };

  const handleCreateWC = async () => {
    clearMessages(); setLoading(true);
    try {
      await manufacturingApi.createWorkCenter({
        name: wcForm.name,
        description: wcForm.description || null,
        machine_type: wcForm.machine_type || null,
        capacity_units_per_hour: wcForm.capacity_units_per_hour || null,
        production_line_id: wcForm.production_line_id,
      });
      setSuccess(t("admin.wcCreated"));
      setShowWCForm(false);
      setWCForm({ name: "", description: "", machine_type: "", capacity_units_per_hour: "", production_line_id: 0 });
      loadSetupData();
    } catch (err: any) { setError(err.response?.data?.detail || "Failed"); }
    setLoading(false);
  };

  const handleUpdateWC = async () => {
    if (!editingWC) return;
    clearMessages(); setLoading(true);
    try {
      await manufacturingApi.updateWorkCenter(editingWC.id, {
        name: wcForm.name,
        description: wcForm.description || null,
        machine_type: wcForm.machine_type || null,
        capacity_units_per_hour: wcForm.capacity_units_per_hour || null,
      });
      setSuccess(t("admin.wcUpdated"));
      setEditingWC(null);
      loadSetupData();
    } catch (err: any) { setError(err.response?.data?.detail || "Failed"); }
    setLoading(false);
  };

  const handleCreateProduct = async () => {
    clearMessages(); setLoading(true);
    try {
      await manufacturingApi.createProduct({
        code: productForm.code,
        name: productForm.name,
        product_family: productForm.product_family || null,
        unit_of_measure: productForm.unit_of_measure || "pcs",
      });
      setSuccess("Product created");
      setShowProductForm(false);
      setProductForm({ code: "", name: "", product_family: "", unit_of_measure: "pcs" });
      loadSetupData();
    } catch (err: any) { setError(err.response?.data?.detail || "Failed"); }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
    loadFactory();
    loadPermissions();
  }, [loadUsers, loadFactory, loadPermissions]);

  useEffect(() => {
    if (activeTab === "audit") loadAuditLogs();
    if (activeTab === "setup") loadSetupData();
  }, [activeTab, loadAuditLogs, loadSetupData]);

  const clearMessages = () => { setError(""); setSuccess(""); };

  const handleCreateUser = async () => {
    clearMessages();
    setLoading(true);
    try {
      await adminApi.createUser({
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        language: formData.language,
        password: formData.password || undefined,
      });
      setSuccess(t("admin.userCreated"));
      setShowUserForm(false);
      setFormData({ email: "", full_name: "", role: "operator", language: "en", password: "" });
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create user");
    }
    setLoading(false);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    clearMessages();
    setLoading(true);
    try {
      await adminApi.updateUser(editingUser.id, {
        full_name: formData.full_name,
        role: formData.role,
        language: formData.language,
      });
      setSuccess(t("admin.userUpdated"));
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update user");
    }
    setLoading(false);
  };

  const handleToggleActive = async (u: AdminUser) => {
    clearMessages();
    try {
      await adminApi.updateUser(u.id, { is_active: !u.is_active });
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update user");
    }
  };

  const handleResetPassword = async (u: AdminUser) => {
    clearMessages();
    try {
      const res = await adminApi.resetPassword(u.id);
      setTempPassword(res.data.temporary_password);
      setSuccess(t("admin.passwordResetSuccess"));
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to reset password");
    }
  };

  const openEditUser = (u: AdminUser) => {
    setEditingUser(u);
    setFormData({
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      language: u.language,
      password: "",
    });
    clearMessages();
  };

  const handleExportData = async () => {
    setExportState("loading");
    try {
      const res = await adminApi.exportData();
      const blob = new Blob([res.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `factory_export_${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportState("success");
      setTimeout(() => setExportState("idle"), 3000);
    } catch {
      setExportState("error");
      setTimeout(() => setExportState("idle"), 4000);
    }
  };

  const tabs: { id: Tab; labelKey: string }[] = [
    { id: "setup", labelKey: "admin.tabSetup" },
    { id: "users", labelKey: "admin.tabUsers" },
    { id: "groups", labelKey: "admin.tabGroups" },
    { id: "permissions", labelKey: "admin.tabPermissions" },
    { id: "audit", labelKey: "admin.tabAudit" },
    { id: "factory", labelKey: "admin.tabFactory" },
  ];

  return (
    <div className="space-y-6" role="region" aria-label="Admin Panel">
      {/* Tabs */}
      <div className="flex gap-1 bg-th-bg-3 rounded-xl p-1" role="tablist" aria-label="Admin sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => { setActiveTab(tab.id); clearMessages(); }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-brand-600 text-white shadow"
                : "text-th-text-2 hover:text-th-text hover:bg-th-bg-2"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-2 font-bold">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-sm text-emerald-700 dark:text-emerald-400 flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="ml-2 font-bold">✕</button>
        </div>
      )}

      {/* Temp password display */}
      {tempPassword && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">{t("admin.passwordResetSuccess")}</p>
          <div className="flex items-center gap-2">
            <code className="bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg text-sm font-mono border">{tempPassword}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(tempPassword); }}
              className="text-xs bg-amber-200 dark:bg-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-300 dark:hover:bg-amber-700 transition"
            >
              {t("admin.copyPassword")}
            </button>
            <button onClick={() => setTempPassword(null)} className="ml-auto text-amber-500 hover:text-amber-700">✕</button>
          </div>
        </div>
      )}

      {/* ---- USERS TAB ---- */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-th-text">{t("admin.usersTitle")}</h2>
              <p className="text-sm text-th-text-2">{t("admin.usersSubtitle")}</p>
            </div>
            <button
              onClick={() => { setShowUserForm(true); setEditingUser(null); setFormData({ email: "", full_name: "", role: "operator", language: "en", password: "" }); clearMessages(); }}
              className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow"
            >
              + {t("admin.addUser")}
            </button>
          </div>

          {/* User Form Modal */}
          {(showUserForm || editingUser) && (
            <div className="bg-th-bg-2 border border-th-border rounded-2xl p-6 space-y-4 shadow-lg">
              <h3 className="font-bold text-th-text">
                {editingUser ? t("admin.editUser") : t("admin.addUser")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!editingUser && (
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.fieldEmail")}</label>
                    <input
                      type="email" value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-xl px-3 py-2 text-sm text-th-text"
                      placeholder="user@company.com"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.fieldName")}</label>
                  <input
                    type="text" value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full bg-th-bg border border-th-border rounded-xl px-3 py-2 text-sm text-th-text"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.fieldRole")}</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-th-bg border border-th-border rounded-xl px-3 py-2 text-sm text-th-text"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{t(ROLE_LABEL_KEYS[r])}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.fieldLanguage")}</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full bg-th-bg border border-th-border rounded-xl px-3 py-2 text-sm text-th-text"
                  >
                    <option value="en">English</option>
                    <option value="it">Italiano</option>
                  </select>
                </div>
                {!editingUser && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.fieldPassword")}</label>
                    <input
                      type="text" value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-xl px-3 py-2 text-sm text-th-text font-mono"
                      placeholder={t("admin.fieldPasswordHint")}
                    />
                    <p className="text-xs text-th-text-3 mt-1">{t("admin.fieldPasswordHint")}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={editingUser ? handleUpdateUser : handleCreateUser}
                  disabled={loading}
                  className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {loading ? "..." : (editingUser ? t("common.save") : t("admin.addUser"))}
                </button>
                <button
                  onClick={() => { setShowUserForm(false); setEditingUser(null); }}
                  className="text-th-text-2 hover:text-th-text px-4 py-2 text-sm transition"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div className="bg-th-bg-2 border border-th-border rounded-2xl overflow-hidden shadow">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-th-border bg-th-bg-3">
                    <th className="text-left px-4 py-3 font-medium text-th-text-2">{t("admin.fieldName")}</th>
                    <th className="text-left px-4 py-3 font-medium text-th-text-2">{t("admin.fieldEmail")}</th>
                    <th className="text-left px-4 py-3 font-medium text-th-text-2">{t("admin.fieldRole")}</th>
                    <th className="text-left px-4 py-3 font-medium text-th-text-2">{t("admin.fieldStatus")}</th>
                    <th className="text-left px-4 py-3 font-medium text-th-text-2">{t("admin.fieldLastLogin")}</th>
                    <th className="text-right px-4 py-3 font-medium text-th-text-2">{t("admin.fieldActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-th-border last:border-0 hover:bg-th-bg-3/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                            {u.full_name?.charAt(0) || "?"}
                          </div>
                          <span className="font-medium text-th-text">{u.full_name}</span>
                          {u.id === user?.id && (
                            <span className="text-[10px] bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-1.5 py-0.5 rounded-full">YOU</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-th-text-2">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 px-2 py-1 rounded-full">
                          {t(ROLE_LABEL_KEYS[u.role] || "admin.roleViewer")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          u.is_active
                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                        }`}>
                          {u.is_active ? t("admin.statusActive") : t("admin.statusInactive")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-th-text-2 text-xs">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleDateString()
                          : t("admin.statusNever")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditUser(u)}
                            className="p-1.5 rounded-lg hover:bg-th-bg-3 text-th-text-2 hover:text-th-text transition"
                            title={t("admin.editUser")}
                          >✏️</button>
                          <button
                            onClick={() => handleResetPassword(u)}
                            className="p-1.5 rounded-lg hover:bg-th-bg-3 text-th-text-2 hover:text-th-text transition"
                            title={t("admin.resetPassword")}
                          >🔑</button>
                          {u.id !== user?.id && (
                            <button
                              onClick={() => handleToggleActive(u)}
                              className={`p-1.5 rounded-lg hover:bg-th-bg-3 transition ${
                                u.is_active ? "text-red-400 hover:text-red-600" : "text-emerald-400 hover:text-emerald-600"
                              }`}
                              title={u.is_active ? t("admin.deactivate") : t("admin.activate")}
                            >
                              {u.is_active ? "🚫" : "✅"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-th-text-2">
                        {t("admin.noUsers")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---- GROUPS TAB ---- */}
      {activeTab === "groups" && <GroupPoliciesPanel />}

      {/* ---- PERMISSIONS TAB ---- */}
      {activeTab === "permissions" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-th-text">{t("admin.permTitle")}</h2>
            <p className="text-sm text-th-text-2">{t("admin.permSubtitle")}</p>
          </div>

          <div className="bg-th-bg-2 border border-th-border rounded-2xl overflow-hidden shadow">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-th-border bg-th-bg-3">
                    <th className="text-left px-3 py-2.5 font-medium text-th-text-2 sticky left-0 bg-th-bg-3 z-10">{t("admin.permTab")}</th>
                    {ROLES.map((r) => (
                      <th key={r} className="text-center px-3 py-2.5 font-medium text-th-text-2 whitespace-nowrap">
                        {t(ROLE_LABEL_KEYS[r])}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_TABS.map((tabId) => (
                    <tr key={tabId} className="border-b border-th-border last:border-0">
                      <td className="px-3 py-2 font-medium text-th-text sticky left-0 bg-th-bg-2 z-10 capitalize">
                        {tabId.replace("-", " ")}
                      </td>
                      {ROLES.map((role) => {
                        const perm = permissions[role]?.[tabId] || "hidden";
                        return (
                          <td key={role} className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${PERM_COLORS[perm]}`}>
                              {t(PERM_LABEL_KEYS[perm])}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---- AUDIT TAB ---- */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-th-text">{t("admin.auditTitle")}</h2>
            <p className="text-sm text-th-text-2">{t("admin.auditSubtitle")}</p>
          </div>

          <div className="bg-th-bg-2 border border-th-border rounded-2xl overflow-hidden shadow">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-th-border bg-th-bg-3">
                    <th className="text-left px-4 py-3 font-medium text-th-text-2">{t("admin.auditTime")}</th>
                    <th className="text-left px-4 py-3 font-medium text-th-text-2">{t("admin.auditAction")}</th>
                    <th className="text-left px-4 py-3 font-medium text-th-text-2">{t("admin.auditUser")}</th>
                    <th className="text-left px-4 py-3 font-medium text-th-text-2">{t("admin.auditDetail")}</th>
                    <th className="text-left px-4 py-3 font-medium text-th-text-2">{t("admin.auditIp")}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-th-border last:border-0 hover:bg-th-bg-3/50">
                      <td className="px-4 py-3 text-xs text-th-text-2 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono bg-th-bg-3 px-2 py-0.5 rounded text-th-text">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-th-text-2">{log.user_email || "—"}</td>
                      <td className="px-4 py-3 text-xs text-th-text-2 max-w-xs truncate">{log.detail || "—"}</td>
                      <td className="px-4 py-3 text-xs text-th-text-3 font-mono">{log.ip_address || "—"}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-th-text-2">
                        {t("admin.auditNoEntries")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---- SETUP TAB ---- */}
      {activeTab === "setup" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-th-text">{t("admin.setupTitle")}</h2>
            <p className="text-sm text-th-text-2">{t("admin.setupSubtitle")}</p>
          </div>

          {/* ═══ PRODUCTION LINES ═══ */}
          <div className="bg-th-bg-2 border border-th-border rounded-2xl shadow overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-th-border bg-th-bg-3">
              <h3 className="font-bold text-th-text flex items-center gap-2">
                <span className="text-lg">🏭</span> {t("admin.sectionLines")}
                <span className="text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-2 py-0.5 rounded-full">{prodLines.length}</span>
              </h3>
              <button onClick={() => { setShowLineForm(true); setEditingLine(null); setLineForm({ name: "", product_type: "", target_oee: 85, target_cycle_time_seconds: "" }); clearMessages(); }}
                className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-xl text-sm font-semibold transition">
                {t("admin.addLine")}
              </button>
            </div>

            {/* Line Form */}
            {(showLineForm || editingLine) && (
              <div className="px-6 py-4 border-b border-th-border bg-blue-50/50 dark:bg-blue-950/20">
                <h4 className="font-semibold text-th-text mb-3">{editingLine ? t("admin.editLine") : t("admin.newLine")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.lineName")}</label>
                    <input type="text" value={lineForm.name} onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" placeholder={t("admin.lineNameHint")} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.lineProductType")}</label>
                    <input type="text" value={lineForm.product_type} onChange={(e) => setLineForm({ ...lineForm, product_type: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" placeholder={t("admin.lineProductTypeHint")} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.lineTargetOee")}</label>
                    <input type="number" value={lineForm.target_oee} onChange={(e) => setLineForm({ ...lineForm, target_oee: Number(e.target.value) })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.lineCycleTime")}</label>
                    <input type="number" value={lineForm.target_cycle_time_seconds} onChange={(e) => setLineForm({ ...lineForm, target_cycle_time_seconds: e.target.value ? Number(e.target.value) : "" })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={editingLine ? handleUpdateLine : handleCreateLine} disabled={loading || !lineForm.name}
                    className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                    {loading ? t("admin.savingDots") : t("common.save")}
                  </button>
                  <button onClick={() => { setShowLineForm(false); setEditingLine(null); }}
                    className="text-th-text-2 hover:text-th-text px-4 py-2 text-sm">{t("common.cancel")}</button>
                </div>
              </div>
            )}

            {/* Lines List */}
            <div className="divide-y divide-th-border">
              {prodLines.length === 0 && (
                <p className="px-6 py-8 text-center text-th-text-2 text-sm">{t("admin.noLines")}</p>
              )}
              {prodLines.map((line: any) => (
                <div key={line.id}>
                  {/* Line Row */}
                  <div className="flex items-center gap-4 px-6 py-3 hover:bg-th-bg-3/50 transition cursor-pointer" onClick={() => setExpandedLine(expandedLine === line.id ? null : line.id)}>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${line.is_active ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                      {line.is_active ? t("admin.lineActive") : t("admin.lineInactive")}
                    </span>
                    <div className="flex-1">
                      <span className="font-semibold text-th-text">{line.name}</span>
                      {line.product_type && <span className="ml-2 text-xs text-th-text-2">({line.product_type})</span>}
                    </div>
                    <span className="text-xs text-th-text-2">OEE: {line.target_oee}%</span>
                    {line.target_cycle_time_seconds && <span className="text-xs text-th-text-2">CT: {line.target_cycle_time_seconds}s</span>}
                    <span className="text-xs text-th-text-3">{line.shifts?.length || 0} shifts</span>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setEditingLine(line); setLineForm({ name: line.name, product_type: line.product_type || "", target_oee: line.target_oee || 85, target_cycle_time_seconds: line.target_cycle_time_seconds || "" }); clearMessages(); }}
                        className="p-1.5 rounded-lg hover:bg-th-bg-3 text-th-text-2 hover:text-th-text transition" title={t("admin.editLine")}>✏️</button>
                      <button onClick={() => handleDeleteLine(line.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition" title={t("admin.remove")}>🗑️</button>
                    </div>
                    <span className="text-th-text-3 text-sm">{expandedLine === line.id ? "▲" : "▼"}</span>
                  </div>

                  {/* Expanded: Shifts */}
                  {expandedLine === line.id && (
                    <div className="bg-th-bg-3/30 px-6 pb-4">
                      <div className="flex items-center justify-between mb-2 pt-2">
                        <h5 className="text-sm font-semibold text-th-text-2">{t("admin.sectionShifts")}</h5>
                        <button onClick={() => { setShowShiftForm(line.id); setShiftForm({ name: "", start_hour: 6, end_hour: 14, planned_minutes: 480 }); }}
                          className="text-brand-600 hover:text-brand-500 text-xs font-semibold">{t("admin.addShift")}</button>
                      </div>

                      {showShiftForm === line.id && (
                        <div className="bg-th-bg border border-th-border rounded-xl p-3 mb-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-th-text-2 mb-0.5">{t("admin.shiftName")}</label>
                              <input type="text" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                                className="w-full bg-th-bg-2 border border-th-border rounded-lg px-2 py-1.5 text-sm text-th-text" placeholder={t("admin.shiftNameHint")} />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-th-text-2 mb-0.5">{t("admin.shiftStart")}</label>
                              <input type="number" min={0} max={23} value={shiftForm.start_hour} onChange={(e) => setShiftForm({ ...shiftForm, start_hour: Number(e.target.value) })}
                                className="w-full bg-th-bg-2 border border-th-border rounded-lg px-2 py-1.5 text-sm text-th-text" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-th-text-2 mb-0.5">{t("admin.shiftEnd")}</label>
                              <input type="number" min={0} max={23} value={shiftForm.end_hour} onChange={(e) => setShiftForm({ ...shiftForm, end_hour: Number(e.target.value) })}
                                className="w-full bg-th-bg-2 border border-th-border rounded-lg px-2 py-1.5 text-sm text-th-text" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-th-text-2 mb-0.5">{t("admin.shiftPlannedMin")}</label>
                              <input type="number" value={shiftForm.planned_minutes} onChange={(e) => setShiftForm({ ...shiftForm, planned_minutes: Number(e.target.value) })}
                                className="w-full bg-th-bg-2 border border-th-border rounded-lg px-2 py-1.5 text-sm text-th-text" />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleCreateShift(line.id)} disabled={loading || !shiftForm.name}
                              className="bg-brand-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50">{t("common.save")}</button>
                            <button onClick={() => setShowShiftForm(null)} className="text-th-text-2 text-xs">{t("common.cancel")}</button>
                          </div>
                        </div>
                      )}

                      {(!line.shifts || line.shifts.length === 0) && !showShiftForm && (
                        <p className="text-xs text-th-text-3 py-2">{t("admin.noShifts")}</p>
                      )}
                      {line.shifts?.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-3 bg-th-bg border border-th-border rounded-lg px-3 py-2 mb-1">
                          <span className="text-sm font-medium text-th-text flex-1">{s.name}</span>
                          <span className="text-xs text-th-text-2">{String(s.start_hour).padStart(2, "0")}:00 – {String(s.end_hour).padStart(2, "0")}:00</span>
                          <span className="text-xs text-th-text-3">{s.planned_minutes} min</span>
                          <button onClick={() => handleDeleteShift(s.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ═══ WORK CENTERS / MACHINES ═══ */}
          <div className="bg-th-bg-2 border border-th-border rounded-2xl shadow overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-th-border bg-th-bg-3">
              <h3 className="font-bold text-th-text flex items-center gap-2">
                <span className="text-lg">⚙️</span> {t("admin.sectionWorkCenters")}
                <span className="text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-2 py-0.5 rounded-full">{workCenters.length}</span>
              </h3>
              <button onClick={() => { setShowWCForm(true); setEditingWC(null); setWCForm({ name: "", description: "", machine_type: "", capacity_units_per_hour: "", production_line_id: prodLines[0]?.id || 0 }); clearMessages(); }}
                className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-xl text-sm font-semibold transition" disabled={prodLines.length === 0}>
                {t("admin.addWorkCenter")}
              </button>
            </div>

            {(showWCForm || editingWC) && (
              <div className="px-6 py-4 border-b border-th-border bg-blue-50/50 dark:bg-blue-950/20">
                <h4 className="font-semibold text-th-text mb-3">{editingWC ? t("admin.editWorkCenter") : t("admin.newWorkCenter")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.wcName")}</label>
                    <input type="text" value={wcForm.name} onChange={(e) => setWCForm({ ...wcForm, name: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" placeholder={t("admin.wcNameHint")} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.wcMachineType")}</label>
                    <input type="text" value={wcForm.machine_type} onChange={(e) => setWCForm({ ...wcForm, machine_type: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" placeholder={t("admin.wcMachineTypeHint")} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.wcCapacity")}</label>
                    <input type="number" value={wcForm.capacity_units_per_hour} onChange={(e) => setWCForm({ ...wcForm, capacity_units_per_hour: e.target.value ? Number(e.target.value) : "" })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.wcLine")}</label>
                    <select value={wcForm.production_line_id} onChange={(e) => setWCForm({ ...wcForm, production_line_id: Number(e.target.value) })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text">
                      {prodLines.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.wcDescription")}</label>
                    <input type="text" value={wcForm.description} onChange={(e) => setWCForm({ ...wcForm, description: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={editingWC ? handleUpdateWC : handleCreateWC} disabled={loading || !wcForm.name || !wcForm.production_line_id}
                    className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                    {loading ? t("admin.savingDots") : t("common.save")}
                  </button>
                  <button onClick={() => { setShowWCForm(false); setEditingWC(null); }}
                    className="text-th-text-2 hover:text-th-text px-4 py-2 text-sm">{t("common.cancel")}</button>
                </div>
              </div>
            )}

            <div className="divide-y divide-th-border">
              {workCenters.length === 0 && (
                <p className="px-6 py-8 text-center text-th-text-2 text-sm">{t("admin.noWorkCenters")}</p>
              )}
              {workCenters.map((wc: any) => (
                <div key={wc.id} className="flex items-center gap-4 px-6 py-3 hover:bg-th-bg-3/50 transition">
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${wc.is_active !== false ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                    {wc.is_active !== false ? t("admin.lineActive") : t("admin.lineInactive")}
                  </span>
                  <div className="flex-1">
                    <span className="font-semibold text-th-text">{wc.name}</span>
                    {wc.machine_type && <span className="ml-2 text-xs bg-th-bg-3 px-1.5 py-0.5 rounded text-th-text-2">{wc.machine_type}</span>}
                  </div>
                  {wc.capacity_units_per_hour && <span className="text-xs text-th-text-2">{wc.capacity_units_per_hour} units/hr</span>}
                  <span className="text-xs text-th-text-3">{prodLines.find((l: any) => l.id === wc.production_line_id)?.name || "—"}</span>
                  <button onClick={() => { setEditingWC(wc); setWCForm({ name: wc.name, description: wc.description || "", machine_type: wc.machine_type || "", capacity_units_per_hour: wc.capacity_units_per_hour || "", production_line_id: wc.production_line_id }); clearMessages(); }}
                    className="p-1.5 rounded-lg hover:bg-th-bg-3 text-th-text-2 hover:text-th-text transition" title={t("admin.editWorkCenter")}>✏️</button>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ PRODUCTS ═══ */}
          <div className="bg-th-bg-2 border border-th-border rounded-2xl shadow overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-th-border bg-th-bg-3">
              <h3 className="font-bold text-th-text flex items-center gap-2">
                <span className="text-lg">📦</span> {t("admin.sectionProducts")}
                <span className="text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-2 py-0.5 rounded-full">{products.length}</span>
              </h3>
              <button onClick={() => { setShowProductForm(true); setProductForm({ code: "", name: "", product_family: "", unit_of_measure: "pcs" }); clearMessages(); }}
                className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-xl text-sm font-semibold transition">
                {t("admin.addProduct")}
              </button>
            </div>

            {showProductForm && (
              <div className="px-6 py-4 border-b border-th-border bg-blue-50/50 dark:bg-blue-950/20">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.productCode")}</label>
                    <input type="text" value={productForm.code} onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" placeholder="SKU-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.productName")}</label>
                    <input type="text" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.productFamily")}</label>
                    <input type="text" value={productForm.product_family} onChange={(e) => setProductForm({ ...productForm, product_family: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.productUom")}</label>
                    <select value={productForm.unit_of_measure} onChange={(e) => setProductForm({ ...productForm, unit_of_measure: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text">
                      <option value="pcs">pcs</option>
                      <option value="kg">kg</option>
                      <option value="liters">liters</option>
                      <option value="meters">meters</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleCreateProduct} disabled={loading || !productForm.name || !productForm.code}
                    className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                    {loading ? t("admin.savingDots") : t("common.save")}
                  </button>
                  <button onClick={() => setShowProductForm(false)} className="text-th-text-2 hover:text-th-text px-4 py-2 text-sm">{t("common.cancel")}</button>
                </div>
              </div>
            )}

            <div className="divide-y divide-th-border">
              {products.length === 0 && (
                <p className="px-6 py-8 text-center text-th-text-2 text-sm">{t("admin.noProducts")}</p>
              )}
              {products.map((p: any) => (
                <div key={p.id} className="flex items-center gap-4 px-6 py-3 hover:bg-th-bg-3/50 transition">
                  <span className="font-mono text-xs bg-th-bg-3 px-2 py-0.5 rounded text-th-text-2">{p.code}</span>
                  <span className="font-semibold text-th-text flex-1">{p.name}</span>
                  {p.product_family && <span className="text-xs text-th-text-2">{p.product_family}</span>}
                  <span className="text-xs text-th-text-3">{p.unit_of_measure}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- FACTORY TAB ---- */}
      {activeTab === "factory" && factory && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-th-text">{t("admin.factoryTitle")}</h2>
          <div className="bg-th-bg-2 border border-th-border rounded-2xl p-6 shadow space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-medium text-th-text-2 mb-1">{t("admin.factoryName")}</p>
                <p className="text-lg font-bold text-th-text">{factory.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-th-text-2 mb-1">{t("admin.factoryUsers")}</p>
                <p className="text-lg font-bold text-th-text">{factory.user_count}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-th-text-2 mb-1">{t("admin.factoryController")}</p>
                <p className="text-lg font-bold text-th-text">{factory.data_controller}</p>
              </div>
            </div>
          </div>

          {/* Data Export */}
          <div className="bg-th-bg-2 border border-th-border rounded-2xl p-6 shadow space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-th-text flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {t("admin.exportData")}
                </h3>
                <p className="text-sm text-th-text-2 mt-1">{t("admin.exportDataDesc")}</p>
              </div>
              <button
                onClick={handleExportData}
                disabled={exportState === "loading"}
                className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow ${
                  exportState === "success"
                    ? "bg-emerald-600 text-white"
                    : exportState === "error"
                    ? "bg-red-600 text-white"
                    : "bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50"
                }`}
              >
                {exportState === "loading" ? t("admin.exportDataLoading")
                  : exportState === "success" ? "✓ " + t("admin.exportDataSuccess")
                  : exportState === "error" ? t("admin.exportDataError")
                  : t("admin.exportDataButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
