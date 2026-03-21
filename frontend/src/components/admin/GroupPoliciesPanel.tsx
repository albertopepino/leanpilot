"use client";
import { useState, useEffect, useCallback, Fragment } from "react";
import { useI18n } from "@/stores/useI18n";
import { groupsApi, adminApi } from "@/lib/api";
import type { GroupResponse, GroupPolicyItem, GroupCreate, GroupUpdate } from "@/lib/types";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

// ─── Tool tabs grouped by DMAIC phase ────────────────────────────────────────

interface TabDef {
  id: string;
  labelKey: string;
}

interface PhaseGroup {
  phaseKey: string;
  tabs: TabDef[];
}

const TOOL_TABS: PhaseGroup[] = [
  {
    phaseKey: "common.navHome",
    tabs: [{ id: "home", labelKey: "common.navHome" }],
  },
  {
    phaseKey: "common.navGettingStarted",
    tabs: [
      { id: "assessment", labelKey: "common.navAssessment" },
      { id: "copilot", labelKey: "common.navCopilot" },
      { id: "resources", labelKey: "common.navResources" },
    ],
  },
  {
    phaseKey: "common.navDefine",
    tabs: [
      { id: "production-orders", labelKey: "common.navProductionOrders" },
      { id: "products", labelKey: "common.navProducts" },
      { id: "production", labelKey: "common.navProduction" },
      { id: "andon", labelKey: "common.navAndon" },
    ],
  },
  {
    phaseKey: "common.navMeasure",
    tabs: [
      { id: "dashboard", labelKey: "common.navDashboard" },
      { id: "consolidated-oee", labelKey: "common.navConsolidated" },
      { id: "hourly", labelKey: "common.navHourly" },
      { id: "pareto", labelKey: "common.menuPareto" },
      { id: "defect-catalog", labelKey: "common.navDefects" },
      { id: "qc-checks", labelKey: "common.navQCChecks" },
    ],
  },
  {
    phaseKey: "common.navAnalyze",
    tabs: [
      { id: "five-why", labelKey: "common.navFiveWhy" },
      { id: "ishikawa", labelKey: "common.navIshikawa" },
      { id: "vsm", labelKey: "common.navVsm" },
      { id: "gemba", labelKey: "common.navGemba" },
      { id: "safety", labelKey: "common.navSafety" },
      { id: "a3", labelKey: "common.navA3" },
      { id: "mind-map", labelKey: "common.navMindMap" },
    ],
  },
  {
    phaseKey: "common.navImprove",
    tabs: [
      { id: "kaizen", labelKey: "common.navKaizen" },
      { id: "smed", labelKey: "common.navSmed" },
      { id: "capa", labelKey: "common.navCAPA" },
    ],
  },
  {
    phaseKey: "common.navControl",
    tabs: [
      { id: "tpm", labelKey: "common.navTpm" },
      { id: "cilt", labelKey: "common.navCilt" },
      { id: "six-s", labelKey: "common.navSixS" },
      { id: "qc-policies", labelKey: "common.navQCPolicies" },
      { id: "ncr", labelKey: "common.navNCR" },
    ],
  },
  {
    phaseKey: "common.navSystem",
    tabs: [
      { id: "settings", labelKey: "common.navSettings" },
      { id: "admin", labelKey: "common.navAdmin" },
    ],
  },
];

const PERM_LEVELS: GroupPolicyItem["permission"][] = ["full", "modify", "view", "hidden"];

const PERM_COLORS: Record<string, string> = {
  full: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  modify: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  view: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  hidden: "bg-th-bg-3 text-th-text-3",
};

const PERM_LABEL_KEYS: Record<string, string> = {
  full: "admin.permFullAccess",
  modify: "admin.permModifyAccess",
  view: "admin.permViewOnly",
  hidden: "admin.permHiddenAccess",
};

const GROUP_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

export default function GroupPoliciesPanel() {
  const { t } = useI18n();

  // Data
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  // Forms
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupResponse | null>(null);
  const [groupForm, setGroupForm] = useState<GroupCreate & { color: string }>({
    name: "",
    description: "",
    color: GROUP_COLORS[0],
  });

  // Member picker
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // Messages
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Confirm dialog
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<number | null>(null);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  // ─── Load data ───────────────────────────────────────────────────────────────

  const loadGroups = useCallback(async () => {
    try {
      const res = await groupsApi.list();
      setGroups(res.data);
    } catch {
      setError(t("admin.failedLoadGroups"));
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await adminApi.listUsers();
      setUsers(res.data.filter((u: AdminUser) => u.is_active));
    } catch {
      /* users optional */
    }
  }, []);

  useEffect(() => {
    Promise.all([loadGroups(), loadUsers()]).finally(() => setLoading(false));
  }, [loadGroups, loadUsers]);

  // ─── Group CRUD ──────────────────────────────────────────────────────────────

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const openCreateForm = () => {
    clearMessages();
    setEditingGroup(null);
    setGroupForm({ name: "", description: "", color: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)] });
    setShowGroupForm(true);
  };

  const openEditForm = (group: GroupResponse) => {
    clearMessages();
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      description: group.description || "",
      color: group.color || GROUP_COLORS[0],
    });
    setShowGroupForm(true);
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) return;
    clearMessages();
    try {
      if (editingGroup) {
        const update: GroupUpdate = {
          name: groupForm.name,
          description: groupForm.description || undefined,
          color: groupForm.color,
        };
        await groupsApi.update(editingGroup.id, update);
        setSuccess(t("admin.groupUpdated"));
      } else {
        const created = await groupsApi.create(groupForm);
        setSelectedGroupId(created.data.id);
        setSuccess(t("admin.groupCreated"));
      }
      setShowGroupForm(false);
      await loadGroups();
    } catch {
      setError(t("admin.failedSaveGroup"));
    }
  };

  const deleteGroup = async (id: number) => {
    clearMessages();
    try {
      await groupsApi.remove(id);
      if (selectedGroupId === id) setSelectedGroupId(null);
      setSuccess(t("admin.groupDeleted"));
      await loadGroups();
    } catch {
      setError(t("admin.failedDeleteGroup"));
    }
  };

  // ─── Policies ────────────────────────────────────────────────────────────────

  const getPolicyPerm = (tabId: string): GroupPolicyItem["permission"] => {
    if (!selectedGroup) return "hidden";
    const p = selectedGroup.policies.find((p) => p.tab_id === tabId);
    return p?.permission || "hidden";
  };

  const setPolicyPerm = async (tabId: string, perm: GroupPolicyItem["permission"]) => {
    if (!selectedGroup) return;
    clearMessages();

    // Build updated policies
    const existingPolicies = [...(selectedGroup.policies || [])];
    const idx = existingPolicies.findIndex((p) => p.tab_id === tabId);
    if (idx >= 0) {
      existingPolicies[idx] = { tab_id: tabId, permission: perm };
    } else {
      existingPolicies.push({ tab_id: tabId, permission: perm });
    }

    try {
      await groupsApi.setPolicies(selectedGroup.id, existingPolicies);
      setSuccess(t("admin.groupPoliciesSaved"));
      await loadGroups();
    } catch {
      setError(t("admin.failedSavePolicies"));
    }
  };

  // ─── Members ─────────────────────────────────────────────────────────────────

  const addMember = async (userId: number) => {
    if (!selectedGroup) return;
    clearMessages();
    try {
      await groupsApi.addMembers(selectedGroup.id, [userId]);
      await loadGroups();
    } catch {
      setError(t("admin.failedAddMember"));
    }
  };

  const removeMember = async (userId: number) => {
    if (!selectedGroup) return;
    clearMessages();
    try {
      await groupsApi.removeMembers(selectedGroup.id, [userId]);
      await loadGroups();
    } catch {
      setError(t("admin.failedRemoveMember"));
    }
  };

  const availableUsers = users.filter(
    (u) => !selectedGroup?.member_ids.includes(u.id)
  );

  const filteredAvailable = memberSearch
    ? availableUsers.filter(
        (u) =>
          u.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
          u.email.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : availableUsers;

  const memberUsers = users.filter((u) => selectedGroup?.member_ids.includes(u.id));

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-th-text">{t("admin.groupsTitle")}</h2>
        <p className="text-sm text-th-text-2">{t("admin.groupsSubtitle")}</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-2 font-bold">&#x2715;</button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-sm text-emerald-700 dark:text-emerald-400 flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="ml-2 font-bold">&#x2715;</button>
        </div>
      )}

      {/* Info notes */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-400 space-y-1">
        <p>{t("admin.groupPoliciesNote")}</p>
        <p>{t("admin.groupFallbackNote")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ─── Left: Group List ─────────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-3">
          <button
            onClick={openCreateForm}
            className="w-full py-2 px-4 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition"
          >
            + {t("admin.addGroup")}
          </button>

          {groups.length === 0 && (
            <p className="text-sm text-th-text-2 text-center py-8">{t("admin.noGroups")}</p>
          )}

          {groups.map((group) => (
            <div
              key={group.id}
              onClick={() => { setSelectedGroupId(group.id); clearMessages(); setShowMemberPicker(false); }}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                selectedGroupId === group.id
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/10 shadow-sm"
                  : "border-th-border bg-th-bg-2 hover:border-th-text-2"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: group.color || "#6b7280" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-th-text truncate">{group.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        group.is_active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-th-bg-3 text-th-text-3"
                      }`}
                    >
                      {group.is_active ? t("admin.groupActive") : t("admin.groupInactive")}
                    </span>
                  </div>
                  {group.description && (
                    <p className="text-xs text-th-text-2 truncate mt-0.5">{group.description}</p>
                  )}
                  <p className="text-xs text-th-text-2 mt-1">
                    {group.member_count} {t("admin.groupMembers").toLowerCase()}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditForm(group); }}
                    className="p-1.5 rounded-lg hover:bg-th-bg-3 text-th-text-2 hover:text-th-text transition"
                    title={t("admin.editGroup")}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteGroupId(group.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-th-text-2 hover:text-red-600 transition"
                    title={t("admin.deleteGroup")}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── Right: Policy Editor + Members ──────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedGroup ? (
            <div className="text-center py-16 text-th-text-2 text-sm">
              {groups.length > 0
                ? t("admin.selectGroupPrompt")
                : t("admin.noGroups")}
            </div>
          ) : (
            <>
              {/* ─── Policy Editor ─────────────────────────────────────── */}
              <div className="bg-th-bg-2 rounded-xl border border-th-border overflow-hidden">
                <div className="p-4 border-b border-th-border">
                  <h3 className="font-semibold text-th-text flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedGroup.color || "#6b7280" }}
                    />
                    {selectedGroup.name} &mdash; {t("admin.groupPolicies")}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-th-bg-3">
                        <th className="text-left px-4 py-2 text-th-text-2 font-medium text-xs">Tab</th>
                        {PERM_LEVELS.map((p) => (
                          <th key={p} className="px-2 py-2 text-center text-th-text-2 font-medium text-xs w-24">
                            {t(PERM_LABEL_KEYS[p])}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TOOL_TABS.map((phase) => (
                        <Fragment key={phase.phaseKey}>
                          {/* Phase header row */}
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-th-text-2 bg-th-bg-3/50"
                            >
                              {t(phase.phaseKey)}
                            </td>
                          </tr>
                          {phase.tabs.map((tab) => {
                            const currentPerm = getPolicyPerm(tab.id);
                            return (
                              <tr
                                key={tab.id}
                                className="border-t border-th-border/50 hover:bg-th-bg-3/30 transition"
                              >
                                <td className="px-4 py-2 text-th-text font-medium">{t(tab.labelKey)}</td>
                                {PERM_LEVELS.map((perm) => (
                                  <td key={perm} className="px-2 py-2 text-center">
                                    <button
                                      onClick={() => setPolicyPerm(tab.id, perm)}
                                      className={`w-6 h-6 rounded-full border-2 transition mx-auto flex items-center justify-center ${
                                        currentPerm === perm
                                          ? `${PERM_COLORS[perm]} border-current`
                                          : "border-th-border hover:border-th-text-2"
                                      }`}
                                    >
                                      {currentPerm === perm && (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </button>
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── Member Manager ────────────────────────────────────── */}
              <div className="bg-th-bg-2 rounded-xl border border-th-border">
                <div className="p-4 border-b border-th-border flex items-center justify-between">
                  <h3 className="font-semibold text-th-text">
                    {t("admin.groupMembers")} ({memberUsers.length})
                  </h3>
                  <button
                    onClick={() => { setShowMemberPicker(!showMemberPicker); setMemberSearch(""); }}
                    className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition"
                  >
                    + {t("admin.groupSelectUsers")}
                  </button>
                </div>

                {/* Member picker */}
                {showMemberPicker && (
                  <div className="p-4 border-b border-th-border bg-th-bg-3/30">
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder={t("admin.groupSelectUsers")}
                      className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent mb-2"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredAvailable.length === 0 && (
                        <p className="text-xs text-th-text-2 text-center py-2">{t("admin.noUsersAvailable")}</p>
                      )}
                      {filteredAvailable.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => addMember(u.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-th-bg-2 text-left transition"
                        >
                          <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-600">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-th-text truncate">{u.full_name}</p>
                            <p className="text-[11px] text-th-text-2 truncate">{u.email}</p>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-th-bg-3 text-th-text-2">{u.role}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current members */}
                <div className="p-4">
                  {memberUsers.length === 0 ? (
                    <p className="text-sm text-th-text-2 text-center py-4">{t("admin.groupNoMembers")}</p>
                  ) : (
                    <div className="space-y-2">
                      {memberUsers.map((u) => (
                        <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-th-bg-3/50">
                          <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-sm font-bold text-brand-600">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-th-text truncate">{u.full_name}</p>
                            <p className="text-xs text-th-text-2 truncate">{u.email}</p>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-th-bg-3 text-th-text-2">{u.role}</span>
                          <button
                            onClick={() => removeMember(u.id)}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-th-text-2 hover:text-red-600 transition"
                            title={t("common.remove")}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteGroupId !== null}
        title={t("common.confirmDelete")}
        message={t("admin.confirmDeleteGroup")}
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteGroupId !== null) deleteGroup(confirmDeleteGroupId);
          setConfirmDeleteGroupId(null);
        }}
        onCancel={() => setConfirmDeleteGroupId(null)}
      />

      {/* ─── Group Create/Edit Modal ─────────────────────────────────────── */}
      {showGroupForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-th-bg rounded-xl shadow-xl border border-th-border w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-bold text-th-text">
              {editingGroup ? t("admin.editGroup") : t("admin.addGroup")}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-th-text mb-1">{t("admin.groupName")}</label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder={t("admin.groupNameHint")}
                  className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-th-text mb-1">{t("admin.groupDescription")}</label>
                <textarea
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-th-text mb-1">{t("admin.groupColor")}</label>
                <div className="flex gap-2 flex-wrap">
                  {GROUP_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setGroupForm({ ...groupForm, color })}
                      className={`w-8 h-8 rounded-full border-2 transition ${
                        groupForm.color === color ? "border-th-text scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowGroupForm(false)}
                className="flex-1 py-2 px-4 rounded-xl border border-th-border text-th-text text-sm hover:bg-th-bg-2 transition"
              >
                Cancel
              </button>
              <button
                onClick={saveGroup}
                disabled={!groupForm.name.trim()}
                className="flex-1 py-2 px-4 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
              >
                {editingGroup ? t("admin.saved") : t("admin.addGroup")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
