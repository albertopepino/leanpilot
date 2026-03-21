"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { adminApi, manufacturingApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/formatters";
import GroupPoliciesPanel from "./GroupPoliciesPanel";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { useToast } from "@/stores/useToast";
import {
  Shield, Users, Building, Key, Activity, Database, Settings,
  Plus, Trash2, Edit3, Lock, Download, X, CheckCircle, XCircle,
  Factory, Cog, Package, Clock, ChevronUp, ChevronDown, Copy,
  UserPlus, RotateCcw, Ban, Check,
} from "lucide-react";

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

interface ProductionLine {
  id: number;
  name: string;
  product_type: string | null;
  target_oee: number;
  target_cycle_time_seconds: number | null;
  is_active: boolean;
  shifts?: Shift[];
}

interface Shift {
  id: number;
  name: string;
  start_hour: number;
  end_hour: number;
  planned_minutes: number;
  production_line_id: number;
}

interface WorkCenter {
  id: number;
  name: string;
  description: string | null;
  machine_type: string | null;
  capacity_units_per_hour: number | null;
  production_line_id: number;
  is_active?: boolean;
}

interface Product {
  id: number;
  code: string;
  name: string;
  product_family: string | null;
  unit_of_measure: string;
  is_active: boolean;
}

interface FactoryData {
  id: number;
  name: string;
  timezone: string | null;
  production_lines?: ProductionLine[];
  user_count?: number;
  data_controller?: string;
  [key: string]: unknown;
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
  full: "bg-th-bg-3 text-emerald-600 dark:text-emerald-400",
  modify: "bg-th-bg-3 text-blue-600 dark:text-blue-400",
  view: "bg-th-bg-3 text-amber-600 dark:text-amber-400",
  hidden: "bg-th-bg-3 text-th-text-3",
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

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  setup: <Settings className="w-4 h-4" />,
  users: <Users className="w-4 h-4" />,
  groups: <Shield className="w-4 h-4" />,
  permissions: <Key className="w-4 h-4" />,
  audit: <Activity className="w-4 h-4" />,
  factory: <Building className="w-4 h-4" />,
};

export default function AdminPanel() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [factory, setFactory] = useState<FactoryData | null>(null);
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
  const [prodLines, setProdLines] = useState<ProductionLine[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingLine, setEditingLine] = useState<ProductionLine | null>(null);
  const [editingWC, setEditingWC] = useState<WorkCenter | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [expandedLine, setExpandedLine] = useState<number | null>(null);
  const [showLineForm, setShowLineForm] = useState(false);
  const [showWCForm, setShowWCForm] = useState(false);
  const [showShiftForm, setShowShiftForm] = useState<number | null>(null); // line_id
  const [showProductForm, setShowProductForm] = useState(false);
  const [lineForm, setLineForm] = useState({ name: "", product_type: "", target_oee: 85, target_cycle_time_seconds: "" as string | number });
  const [wcForm, setWCForm] = useState({ name: "", description: "", machine_type: "", capacity_units_per_hour: "" as string | number, production_line_id: 0 });
  const [shiftForm, setShiftForm] = useState({ name: "", start_hour: 6, end_hour: 14, planned_minutes: 480 });
  const [productForm, setProductForm] = useState({ code: "", name: "", product_family: "", unit_of_measure: "pcs" });
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: "", message: "", onConfirm: () => {} });
  const toast = useToast();

  const loadUsers = useCallback(async () => {
    try {
      const res = await adminApi.listUsers();
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      console.error("[AdminPanel] Failed to load users");
      toast.error(t("admin.loadUsersFailed") || "Failed to load users");
    }
  }, [t, toast]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await adminApi.getAuditLogs({ limit: 50 });
      setAuditLogs(Array.isArray(res.data) ? res.data : []);
    } catch {
      console.error("[AdminPanel] Failed to load audit logs");
      toast.error(t("admin.loadAuditFailed") || "Failed to load audit logs");
    }
  }, [t, toast]);

  const loadFactory = useCallback(async () => {
    try {
      const res = await adminApi.getFactory();
      setFactory(res.data ?? null);
    } catch {
      console.error("[AdminPanel] Failed to load factory data");
    }
  }, []);

  const loadPermissions = useCallback(async () => {
    try {
      const res = await adminApi.getPermissions();
      setPermissions(res.data?.permissions || {});
    } catch {
      console.error("[AdminPanel] Failed to load permissions");
    }
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
    } catch {
      console.error("[AdminPanel] Failed to load setup data");
      toast.error(t("admin.loadSetupFailed") || "Failed to load factory setup data");
    }
  }, [t, toast]);

  const handleCreateLine = async () => {
    clearMessages(); setLoading(true);
    try {
      await adminApi.createProductionLine({
        name: lineForm.name,
        product_type: lineForm.product_type || null,
        target_oee: lineForm.target_oee,
        target_cycle_time_seconds: lineForm.target_cycle_time_seconds ? Number(lineForm.target_cycle_time_seconds) : null,
      });
      setSuccess(t("admin.lineCreated"));
      setShowLineForm(false);
      setLineForm({ name: "", product_type: "", target_oee: 85, target_cycle_time_seconds: "" });
      loadSetupData();
    } catch (err: unknown) { setError(getErrorMessage(err, "Failed")); }
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
        target_cycle_time_seconds: lineForm.target_cycle_time_seconds ? Number(lineForm.target_cycle_time_seconds) : null,
      });
      setSuccess(t("admin.lineUpdated"));
      setEditingLine(null);
      loadSetupData();
    } catch (err: unknown) { setError(getErrorMessage(err, "Failed")); }
    setLoading(false);
  };

  const handleDeleteLine = (id: number) => {
    setConfirmDialog({
      open: true,
      title: t("admin.confirmDeleteLine") || "Delete production line?",
      message: t("admin.confirmDeleteLineMsg") || "This action cannot be undone.",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        try {
          await adminApi.deleteProductionLine(id);
          setSuccess(t("admin.lineDeleted"));
          loadSetupData();
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed";
          setError(msg);
        }
      },
    });
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
    } catch (err: unknown) { setError(getErrorMessage(err, "Failed")); }
    setLoading(false);
  };

  const handleDeleteShift = (id: number) => {
    setConfirmDialog({
      open: true,
      title: t("admin.confirmDeleteShift") || "Delete shift?",
      message: t("admin.confirmDeleteShiftMsg") || "This action cannot be undone.",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        try {
          await adminApi.deleteShift(id);
          setSuccess(t("admin.shiftDeleted"));
          loadSetupData();
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed";
          setError(msg);
        }
      },
    });
  };

  const handleCreateWC = async () => {
    clearMessages(); setLoading(true);
    try {
      await manufacturingApi.createWorkCenter({
        name: wcForm.name,
        description: wcForm.description || null,
        machine_type: wcForm.machine_type || null,
        capacity_units_per_hour: wcForm.capacity_units_per_hour ? Number(wcForm.capacity_units_per_hour) : null,
        production_line_id: wcForm.production_line_id,
      });
      setSuccess(t("admin.wcCreated"));
      setShowWCForm(false);
      setWCForm({ name: "", description: "", machine_type: "", capacity_units_per_hour: "", production_line_id: 0 });
      loadSetupData();
    } catch (err: unknown) { setError(getErrorMessage(err, "Failed")); }
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
        capacity_units_per_hour: wcForm.capacity_units_per_hour ? Number(wcForm.capacity_units_per_hour) : null,
      });
      setSuccess(t("admin.wcUpdated"));
      setEditingWC(null);
      loadSetupData();
    } catch (err: unknown) { setError(getErrorMessage(err, "Failed")); }
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
    } catch (err: unknown) { setError(getErrorMessage(err, "Failed")); }
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to create user"));
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update user"));
    }
    setLoading(false);
  };

  const handleToggleActive = async (u: AdminUser) => {
    clearMessages();
    try {
      await adminApi.updateUser(u.id, { is_active: !u.is_active });
      loadUsers();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update user"));
    }
  };

  const handleResetPassword = async (u: AdminUser) => {
    clearMessages();
    try {
      const res = await adminApi.resetPassword(u.id);
      setTempPassword(res.data.temporary_password);
      setSuccess(t("admin.passwordResetSuccess"));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to reset password"));
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
      toast.error(t("admin.exportDataError") || "Export failed");
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
    <div className="max-w-[1400px] mx-auto space-y-6" role="region" aria-label="Admin Panel">
      {/* Tabs */}
      <div className="flex gap-1 bg-th-bg-3 rounded-xl p-1" role="tablist" aria-label="Admin sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => { setActiveTab(tab.id); clearMessages(); }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeTab === tab.id
                ? "bg-brand-600 text-white shadow"
                : "text-th-text-2 hover:text-th-text hover:bg-th-bg-2"
            }`}
          >
            {TAB_ICONS[tab.id]}
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-3 text-sm text-red-600 dark:text-red-400 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="ml-2 p-1 rounded-lg hover:bg-th-bg-3 text-th-text-2 hover:text-th-text transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-3 text-sm text-emerald-600 dark:text-emerald-400 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess("")} className="ml-2 p-1 rounded-lg hover:bg-th-bg-3 text-th-text-2 hover:text-th-text transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Temp password display */}
      {tempPassword && (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-2">
            <Key className="w-4 h-4" />
            {t("admin.passwordResetSuccess")}
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-th-bg border border-th-border px-3 py-1.5 rounded-lg text-sm font-mono text-th-text">{tempPassword}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(tempPassword); }}
              className="text-xs bg-th-bg-3 text-th-text-2 hover:text-th-text px-3 py-1.5 rounded-lg hover:bg-th-bg-3/80 transition flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              {t("admin.copyPassword")}
            </button>
            <button onClick={() => setTempPassword(null)} className="ml-auto p-1 rounded-lg hover:bg-th-bg-3 text-th-text-2 hover:text-th-text transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- USERS TAB ---- */}
      {activeTab === "users" && (
        <UsersTabContent
          users={users}
          currentUserId={user?.id}
          showUserForm={showUserForm}
          editingUser={editingUser}
          formData={formData}
          loading={loading}
          t={t}
          onFormDataChange={setFormData}
          onShowUserForm={(show) => { setShowUserForm(show); if (!show) setEditingUser(null); }}
          onEditUser={openEditUser}
          onCreateUser={handleCreateUser}
          onUpdateUser={handleUpdateUser}
          onToggleActive={handleToggleActive}
          onResetPassword={handleResetPassword}
          onClearMessages={clearMessages}
        />
      )}

      {/* ---- GROUPS TAB ---- */}
      {activeTab === "groups" && <GroupPoliciesPanel />}

      {/* ---- PERMISSIONS TAB ---- */}
      {activeTab === "permissions" && (
        <PermissionsTabContent
          permissions={permissions}
          setPermissions={setPermissions}
          t={t}
          toast={toast}
        />
      )}

      {/* ---- AUDIT TAB ---- */}
      {activeTab === "audit" && (
        <AuditTabContent auditLogs={auditLogs} t={t} />
      )}

      {/* ---- SETUP TAB ---- */}
      {activeTab === "setup" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-th-text flex items-center gap-2">
              <Settings className="w-5 h-5 text-th-text-2" />
              {t("admin.setupTitle")}
            </h2>
            <p className="text-sm text-th-text-2">{t("admin.setupSubtitle")}</p>
          </div>

          {/* Production Lines */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-th-border bg-th-bg-3">
              <h3 className="font-bold text-th-text flex items-center gap-2">
                <Factory className="w-4 h-4 text-th-text-2" />
                {t("admin.sectionLines")}
                <span className="text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-2 py-0.5 rounded-full">{prodLines.length}</span>
              </h3>
              <button onClick={() => { setShowLineForm(true); setEditingLine(null); setLineForm({ name: "", product_type: "", target_oee: 85, target_cycle_time_seconds: "" }); clearMessages(); }}
                className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1">
                <Plus className="w-4 h-4" />
                {t("admin.addLine")}
              </button>
            </div>

            {/* Line Form */}
            {(showLineForm || editingLine) && (
              <div className="px-6 py-4 border-b border-th-border bg-th-bg-3/30">
                <h4 className="font-semibold text-th-text mb-3">{editingLine ? t("admin.editLine") : t("admin.newLine")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="admin-line-name" className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.lineName")}</label>
                    <input id="admin-line-name" type="text" value={lineForm.name} onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" placeholder={t("admin.lineNameHint")} />
                  </div>
                  <div>
                    <label htmlFor="admin-line-product-type" className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.lineProductType")}</label>
                    <input id="admin-line-product-type" type="text" value={lineForm.product_type} onChange={(e) => setLineForm({ ...lineForm, product_type: e.target.value })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" placeholder={t("admin.lineProductTypeHint")} />
                  </div>
                  <div>
                    <label htmlFor="admin-line-target-oee" className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.lineTargetOee")}</label>
                    <input id="admin-line-target-oee" type="number" inputMode="decimal" value={lineForm.target_oee} onChange={(e) => setLineForm({ ...lineForm, target_oee: Number(e.target.value) })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" />
                  </div>
                  <div>
                    <label htmlFor="admin-line-cycle-time" className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.lineCycleTime")}</label>
                    <input id="admin-line-cycle-time" type="number" inputMode="decimal" value={lineForm.target_cycle_time_seconds} onChange={(e) => setLineForm({ ...lineForm, target_cycle_time_seconds: e.target.value ? Number(e.target.value) : "" })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={editingLine ? handleUpdateLine : handleCreateLine} disabled={loading || !lineForm.name}
                    className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
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
              {prodLines.map((line) => (
                <div key={line.id}>
                  {/* Line Row */}
                  <div className="flex items-center gap-4 px-6 py-3 hover:bg-th-bg-3/50 transition cursor-pointer" onClick={() => setExpandedLine(expandedLine === line.id ? null : line.id)}>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${line.is_active ? "bg-th-bg-3 text-emerald-600 dark:text-emerald-400" : "bg-th-bg-3 text-th-text-3"}`}>
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
                        className="p-1.5 rounded-lg hover:bg-th-bg-3 text-th-text-2 hover:text-th-text transition" title={t("admin.editLine")}>
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteLine(line.id)}
                        className="p-1.5 rounded-lg hover:bg-th-bg-3 text-red-400 hover:text-red-600 transition" title={t("admin.remove")}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {expandedLine === line.id ? <ChevronUp className="w-4 h-4 text-th-text-3" /> : <ChevronDown className="w-4 h-4 text-th-text-3" />}
                  </div>

                  {/* Expanded: Shifts */}
                  {expandedLine === line.id && (
                    <div className="bg-th-bg-3/30 px-6 pb-4">
                      <div className="flex items-center justify-between mb-2 pt-2">
                        <h5 className="text-sm font-semibold text-th-text-2 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {t("admin.sectionShifts")}
                        </h5>
                        <button onClick={() => { setShowShiftForm(line.id); setShiftForm({ name: "", start_hour: 6, end_hour: 14, planned_minutes: 480 }); }}
                          className="text-brand-600 hover:text-brand-500 text-xs font-semibold flex items-center gap-1">
                          <Plus className="w-3 h-3" />
                          {t("admin.addShift")}
                        </button>
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
                              <input type="number" inputMode="numeric" min={0} max={23} value={shiftForm.start_hour} onChange={(e) => setShiftForm({ ...shiftForm, start_hour: Number(e.target.value) })}
                                className="w-full bg-th-bg-2 border border-th-border rounded-lg px-2 py-1.5 text-sm text-th-text" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-th-text-2 mb-0.5">{t("admin.shiftEnd")}</label>
                              <input type="number" inputMode="numeric" min={0} max={23} value={shiftForm.end_hour} onChange={(e) => setShiftForm({ ...shiftForm, end_hour: Number(e.target.value) })}
                                className="w-full bg-th-bg-2 border border-th-border rounded-lg px-2 py-1.5 text-sm text-th-text" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-th-text-2 mb-0.5">{t("admin.shiftPlannedMin")}</label>
                              <input type="number" inputMode="numeric" value={shiftForm.planned_minutes} onChange={(e) => setShiftForm({ ...shiftForm, planned_minutes: Number(e.target.value) })}
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
                      {line.shifts?.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 bg-th-bg border border-th-border rounded-lg px-3 py-2 mb-1">
                          <span className="text-sm font-medium text-th-text flex-1">{s.name}</span>
                          <span className="text-xs text-th-text-2">{String(s.start_hour).padStart(2, "0")}:00 – {String(s.end_hour).padStart(2, "0")}:00</span>
                          <span className="text-xs text-th-text-3">{s.planned_minutes} min</span>
                          <button onClick={() => handleDeleteShift(s.id)} className="p-1 rounded-lg hover:bg-th-bg-3 text-red-400 hover:text-red-600 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Work Centers / Machines */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-th-border bg-th-bg-3">
              <h3 className="font-bold text-th-text flex items-center gap-2">
                <Cog className="w-4 h-4 text-th-text-2" />
                {t("admin.sectionWorkCenters")}
                <span className="text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-2 py-0.5 rounded-full">{workCenters.length}</span>
              </h3>
              <button onClick={() => { setShowWCForm(true); setEditingWC(null); setWCForm({ name: "", description: "", machine_type: "", capacity_units_per_hour: "", production_line_id: prodLines[0]?.id || 0 }); clearMessages(); }}
                className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1" disabled={prodLines.length === 0}>
                <Plus className="w-4 h-4" />
                {t("admin.addWorkCenter")}
              </button>
            </div>

            {(showWCForm || editingWC) && (
              <div className="px-6 py-4 border-b border-th-border bg-th-bg-3/30">
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
                    <input type="number" inputMode="numeric" value={wcForm.capacity_units_per_hour} onChange={(e) => setWCForm({ ...wcForm, capacity_units_per_hour: e.target.value ? Number(e.target.value) : "" })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.wcLine")}</label>
                    <select value={wcForm.production_line_id} onChange={(e) => setWCForm({ ...wcForm, production_line_id: Number(e.target.value) })}
                      className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text">
                      {prodLines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
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
                    className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
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
              {workCenters.map((wc) => (
                <div key={wc.id} className="flex items-center gap-4 px-6 py-3 hover:bg-th-bg-3/50 transition">
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${wc.is_active !== false ? "bg-th-bg-3 text-emerald-600 dark:text-emerald-400" : "bg-th-bg-3 text-th-text-3"}`}>
                    {wc.is_active !== false ? t("admin.lineActive") : t("admin.lineInactive")}
                  </span>
                  <div className="flex-1">
                    <span className="font-semibold text-th-text">{wc.name}</span>
                    {wc.machine_type && <span className="ml-2 text-xs bg-th-bg-3 px-1.5 py-0.5 rounded text-th-text-2">{wc.machine_type}</span>}
                  </div>
                  {wc.capacity_units_per_hour && <span className="text-xs text-th-text-2">{wc.capacity_units_per_hour} units/hr</span>}
                  <span className="text-xs text-th-text-3">{prodLines.find((l) => l.id === wc.production_line_id)?.name || "—"}</span>
                  <button onClick={() => { setEditingWC(wc); setWCForm({ name: wc.name, description: wc.description || "", machine_type: wc.machine_type || "", capacity_units_per_hour: wc.capacity_units_per_hour || "", production_line_id: wc.production_line_id }); clearMessages(); }}
                    className="p-1.5 rounded-lg hover:bg-th-bg-3 text-th-text-2 hover:text-th-text transition" title={t("admin.editWorkCenter")}>
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Products */}
          <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-th-border bg-th-bg-3">
              <h3 className="font-bold text-th-text flex items-center gap-2">
                <Package className="w-4 h-4 text-th-text-2" />
                {t("admin.sectionProducts")}
                <span className="text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-2 py-0.5 rounded-full">{products.length}</span>
              </h3>
              <button onClick={() => { setShowProductForm(true); setProductForm({ code: "", name: "", product_family: "", unit_of_measure: "pcs" }); clearMessages(); }}
                className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1">
                <Plus className="w-4 h-4" />
                {t("admin.addProduct")}
              </button>
            </div>

            {showProductForm && (
              <div className="px-6 py-4 border-b border-th-border bg-th-bg-3/30">
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
                    className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
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
              {products.map((p) => (
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
        <FactoryTabContent
          factory={factory}
          exportState={exportState}
          onExportData={handleExportData}
          t={t}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}

/* ================================================================== */
/*  AuditTabContent                                                    */
/* ================================================================== */

function AuditTabContent({
  auditLogs,
  t,
}: {
  auditLogs: AuditEntry[];
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-th-text flex items-center gap-2">
          <Activity className="w-5 h-5 text-th-text-2" />
          {t("admin.auditTitle")}
        </h2>
        <p className="text-sm text-th-text-2">{t("admin.auditSubtitle")}</p>
      </div>

      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
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
              {auditLogs.map((log, idx) => (
                <tr key={log.id} className={`border-b border-th-border last:border-0 hover:bg-th-bg-3/50 ${idx % 2 === 1 ? "bg-th-bg-3/20" : ""}`}>
                  <td className="px-4 py-3 text-xs text-th-text-2 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono bg-th-bg-3 px-2 py-0.5 rounded text-th-text">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-th-text-2">{log.user_email || "\u2014"}</td>
                  <td className="px-4 py-3 text-xs text-th-text-2 max-w-xs truncate">{log.detail || "\u2014"}</td>
                  <td className="px-4 py-3 text-xs text-th-text-3 font-mono">{log.ip_address || "\u2014"}</td>
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
  );
}

/* ================================================================== */
/*  FactoryTabContent                                                  */
/* ================================================================== */

function FactoryTabContent({
  factory,
  exportState,
  onExportData,
  t,
}: {
  factory: FactoryData;
  exportState: ExportState;
  onExportData: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-th-text flex items-center gap-2">
        <Building className="w-5 h-5 text-th-text-2" />
        {t("admin.factoryTitle")}
      </h2>
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6 space-y-4">
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
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-th-text flex items-center gap-2">
              <Download className="w-5 h-5 text-brand-500" />
              {t("admin.exportData")}
            </h3>
            <p className="text-sm text-th-text-2 mt-1">{t("admin.exportDataDesc")}</p>
          </div>
          <button
            onClick={onExportData}
            disabled={exportState === "loading"}
            className={`shrink-0 px-5 py-2.5 rounded-lg text-sm font-semibold transition shadow flex items-center gap-2 ${
              exportState === "success"
                ? "bg-emerald-600 text-white"
                : exportState === "error"
                ? "bg-red-600 text-white"
                : "bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50"
            }`}
          >
            {exportState === "loading" ? t("admin.exportDataLoading")
              : exportState === "success" ? (<><Check className="w-4 h-4" /> {t("admin.exportDataSuccess")}</>)
              : exportState === "error" ? t("admin.exportDataError")
              : t("admin.exportDataButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  PermissionsTabContent                                              */
/* ================================================================== */

function PermissionsTabContent({
  permissions,
  setPermissions,
  t,
  toast,
}: {
  permissions: Record<string, Record<string, string>>;
  setPermissions: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  t: (key: string) => string;
  toast: { error: (msg: string) => void };
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-th-text flex items-center gap-2">
          <Key className="w-5 h-5 text-th-text-2" />
          {t("admin.permTitle")}
        </h2>
        <p className="text-sm text-th-text-2">{t("admin.permSubtitle")}</p>
      </div>

      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
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
              {ALL_TABS.map((tabId, idx) => (
                <tr key={tabId} className={`border-b border-th-border last:border-0 ${idx % 2 === 1 ? "bg-th-bg-3/20" : ""}`}>
                  <td className="px-3 py-2 font-medium text-th-text sticky left-0 bg-th-bg-2 z-10 capitalize">
                    {tabId.replace("-", " ")}
                  </td>
                  {ROLES.map((role) => {
                    const perm = permissions[role]?.[tabId] || "hidden";
                    return (
                      <td key={role} className="px-3 py-2 text-center">
                        <select
                          value={perm}
                          onChange={async (e) => {
                            const newLevel = e.target.value;
                            const updated = { ...permissions };
                            if (!updated[role]) updated[role] = {};
                            updated[role] = { ...updated[role], [tabId]: newLevel };
                            setPermissions(updated);
                            try {
                              await adminApi.updatePermissions(updated);
                            } catch {
                              toast.error(t("admin.permissionUpdateFailed") || "Failed to save permission");
                            }
                          }}
                          className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border-0 cursor-pointer ${PERM_COLORS[perm]} bg-transparent focus:ring-1 focus:ring-brand-500`}
                        >
                          <option value="full">{t(PERM_LABEL_KEYS["full"])}</option>
                          <option value="modify">{t(PERM_LABEL_KEYS["modify"])}</option>
                          <option value="view">{t(PERM_LABEL_KEYS["view"])}</option>
                          <option value="hidden">{t(PERM_LABEL_KEYS["hidden"])}</option>
                        </select>
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
  );
}

/* ================================================================== */
/*  UsersTabContent                                                    */
/* ================================================================== */

function UsersTabContent({
  users,
  currentUserId,
  showUserForm,
  editingUser,
  formData,
  loading,
  t,
  onFormDataChange,
  onShowUserForm,
  onEditUser,
  onCreateUser,
  onUpdateUser,
  onToggleActive,
  onResetPassword,
  onClearMessages,
}: {
  users: AdminUser[];
  currentUserId?: number;
  showUserForm: boolean;
  editingUser: AdminUser | null;
  formData: { email: string; full_name: string; role: string; language: string; password: string };
  loading: boolean;
  t: (key: string) => string;
  onFormDataChange: (data: { email: string; full_name: string; role: string; language: string; password: string }) => void;
  onShowUserForm: (show: boolean) => void;
  onEditUser: (u: AdminUser) => void;
  onCreateUser: () => void;
  onUpdateUser: () => void;
  onToggleActive: (u: AdminUser) => void;
  onResetPassword: (u: AdminUser) => void;
  onClearMessages: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-th-text flex items-center gap-2">
            <Users className="w-5 h-5 text-th-text-2" />
            {t("admin.usersTitle")}
          </h2>
          <p className="text-sm text-th-text-2">{t("admin.usersSubtitle")}</p>
        </div>
        <button
          onClick={() => { onShowUserForm(true); onFormDataChange({ email: "", full_name: "", role: "operator", language: "en", password: "" }); onClearMessages(); }}
          className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t("admin.addUser")}
        </button>
      </div>

      {/* User Form Modal */}
      {(showUserForm || editingUser) && (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-th-text flex items-center gap-2">
            {editingUser ? <Edit3 className="w-4 h-4 text-th-text-2" /> : <UserPlus className="w-4 h-4 text-th-text-2" />}
            {editingUser ? t("admin.editUser") : t("admin.addUser")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!editingUser && (
              <div>
                <label htmlFor="admin-email" className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.fieldEmail")}</label>
                <input
                  id="admin-email"
                  type="email" value={formData.email}
                  onChange={(e) => onFormDataChange({ ...formData, email: e.target.value })}
                  className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text"
                  placeholder="user@company.com"
                />
              </div>
            )}
            <div>
              <label htmlFor="admin-fullname" className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.fieldName")}</label>
              <input
                id="admin-fullname"
                type="text" value={formData.full_name}
                onChange={(e) => onFormDataChange({ ...formData, full_name: e.target.value })}
                className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text"
              />
            </div>
            <div>
              <label htmlFor="admin-role" className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.fieldRole")}</label>
              <select
                id="admin-role"
                value={formData.role}
                onChange={(e) => onFormDataChange({ ...formData, role: e.target.value })}
                className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{t(ROLE_LABEL_KEYS[r])}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="admin-language" className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.fieldLanguage")}</label>
              <select
                id="admin-language"
                value={formData.language}
                onChange={(e) => onFormDataChange({ ...formData, language: e.target.value })}
                className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text"
              >
                <option value="en">English</option>
                <option value="it">Italiano</option>
              </select>
            </div>
            {!editingUser && (
              <div className="md:col-span-2">
                <label htmlFor="admin-password" className="block text-xs font-medium text-th-text-2 mb-1">{t("admin.fieldPassword")}</label>
                <input
                  id="admin-password"
                  type="text" value={formData.password}
                  onChange={(e) => onFormDataChange({ ...formData, password: e.target.value })}
                  className="w-full bg-th-bg border border-th-border rounded-lg px-3 py-2 text-sm text-th-text font-mono"
                  placeholder={t("admin.fieldPasswordHint")}
                />
                <p className="text-xs text-th-text-3 mt-1">{t("admin.fieldPasswordHint")}</p>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={editingUser ? onUpdateUser : onCreateUser}
              disabled={loading}
              className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {loading ? "..." : (editingUser ? t("common.save") : t("admin.addUser"))}
            </button>
            <button
              onClick={() => onShowUserForm(false)}
              className="text-th-text-2 hover:text-th-text px-4 py-2 text-sm transition"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
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
              {users.map((u, idx) => (
                <tr key={u.id} className={`border-b border-th-border last:border-0 hover:bg-th-bg-3/50 transition ${idx % 2 === 1 ? "bg-th-bg-3/20" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                        {u.full_name?.charAt(0) || "?"}
                      </div>
                      <span className="font-medium text-th-text">{u.full_name}</span>
                      {u.id === currentUserId && (
                        <span className="text-[10px] bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-1.5 py-0.5 rounded-full">YOU</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-th-text-2">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium bg-th-bg-3 text-brand-700 dark:text-brand-400 px-2 py-1 rounded-full">
                      {t(ROLE_LABEL_KEYS[u.role] || "admin.roleViewer")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 w-fit ${
                      u.is_active
                        ? "bg-th-bg-3 text-emerald-600 dark:text-emerald-400"
                        : "bg-th-bg-3 text-red-600 dark:text-red-400"
                    }`}>
                      {u.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
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
                        onClick={() => onEditUser(u)}
                        className="p-1.5 rounded-lg hover:bg-th-bg-3 text-th-text-2 hover:text-th-text transition"
                        title={t("admin.editUser")}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onResetPassword(u)}
                        className="p-1.5 rounded-lg hover:bg-th-bg-3 text-th-text-2 hover:text-th-text transition"
                        title={t("admin.resetPassword")}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => onToggleActive(u)}
                          className={`p-1.5 rounded-lg hover:bg-th-bg-3 transition ${
                            u.is_active ? "text-red-400 hover:text-red-600" : "text-emerald-400 hover:text-emerald-600"
                          }`}
                          title={u.is_active ? t("admin.deactivate") : t("admin.activate")}
                        >
                          {u.is_active ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
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
  );
}
