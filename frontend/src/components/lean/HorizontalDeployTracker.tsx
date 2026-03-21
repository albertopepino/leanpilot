"use client";
import { useState, useEffect, useCallback } from "react";
import { horizontalDeployApi } from "@/lib/api";
import { useI18n } from "@/stores/useI18n";
import { GitBranch, CheckCircle2, Circle, Plus, X, ShieldCheck, Calendar, User } from "lucide-react";
import type { HorizontalDeployResponse, StandardizationStatus } from "@/lib/types";

export default function HorizontalDeployTracker() {
  const { t } = useI18n();
  const [deployments, setDeployments] = useState<HorizontalDeployResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    source_type: "kaizen",
    source_id: 0,
    description: "",
    target_lines: "" as string, // comma-separated IDs
    verification_date: "",
    verified_by: "",
    standardization_status: "draft" as StandardizationStatus,
    deployment_locations: "" as string, // comma-separated
  });
  // Local verification overrides (keyed by deployment id)
  const [verificationEdits, setVerificationEdits] = useState<Record<number, {
    verification_date: string;
    verified_by: string;
    standardization_status: StandardizationStatus;
    deployment_locations: string[];
  }>>({});

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filter !== "all") params.status = filter;
      const res = await horizontalDeployApi.list(params);
      setDeployments(res.data || []);
    } catch {
      console.error("Failed to load horizontal deployments");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const lineIds = form.target_lines.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (!form.description || lineIds.length === 0) return;
    try {
      await horizontalDeployApi.create({
        source_type: form.source_type,
        source_id: form.source_id,
        description: form.description,
        target_lines: lineIds,
      });
      setShowCreate(false);
      setForm({ source_type: "kaizen", source_id: 0, description: "", target_lines: "", verification_date: "", verified_by: "", standardization_status: "draft", deployment_locations: "" });
      load();
    } catch { /* empty */ }
  };

  const handleComplete = async (id: number, lineId: number) => {
    try {
      await horizontalDeployApi.complete(id, { line_id: lineId });
      load();
    } catch { /* empty */ }
  };

  if (loading) return <div className="p-8 text-th-text-3">{t("common.loading") || "Loading..."}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-brand-600" />
          <h1 className="text-2xl font-bold text-th-text">
            {t("improvement.titleHorizontalDeploy") || "Horizontal Deployment"}
          </h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
        >
          <Plus className="w-4 h-4" />
          {t("common.create") || "Create"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["all", "open", "completed"].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-sm ${
              filter === s
                ? "bg-brand-600 text-white"
                : "bg-th-card text-th-text-3 border border-th-border"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-th-card rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-th-text">
                {t("common.create") || "Create"} {t("improvement.titleHorizontalDeploy") || "Horizontal Deployment"}
              </h2>
              <button onClick={() => setShowCreate(false)}>
                <X className="w-5 h-5 text-th-text-3" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-th-text-3 mb-1">{t("common.sourceType")}</label>
                <select
                  value={form.source_type}
                  onChange={e => setForm(p => ({ ...p, source_type: e.target.value }))}
                  className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                >
                  <option value="kaizen">Kaizen</option>
                  <option value="five_why">5 Why</option>
                  <option value="ncr">NCR</option>
                  <option value="capa">CAPA</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-th-text-3 mb-1">{t("common.sourceId")}</label>
                <input
                  type="number"
                  value={form.source_id || ""}
                  onChange={e => setForm(p => ({ ...p, source_id: parseInt(e.target.value) || 0 }))}
                  className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                />
              </div>
              <div>
                <label className="block text-sm text-th-text-3 mb-1">
                  {t("common.description") || "Description"}
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm text-th-text-3 mb-1">
                  Target Line IDs (comma-separated)
                </label>
                <input
                  type="text"
                  value={form.target_lines}
                  onChange={e => setForm(p => ({ ...p, target_lines: e.target.value }))}
                  placeholder="1, 2, 3"
                  className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                />
              </div>

              {/* Standardization Verification Fields */}
              <div className="pt-2 border-t border-th-border">
                <p className="text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-2">
                  {t("improvement.standardizationVerification") || "Standardization & Verification"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-th-text-3 mb-1">
                    {t("improvement.verificationDate") || "Verification Date"}
                  </label>
                  <input
                    type="date"
                    value={form.verification_date}
                    onChange={e => setForm(p => ({ ...p, verification_date: e.target.value }))}
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                  />
                </div>
                <div>
                  <label className="block text-sm text-th-text-3 mb-1">
                    {t("improvement.verifiedBy") || "Verified By"}
                  </label>
                  <input
                    type="text"
                    value={form.verified_by}
                    onChange={e => setForm(p => ({ ...p, verified_by: e.target.value }))}
                    placeholder="Name..."
                    className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-th-text-3 mb-1">
                  {t("improvement.standardizationStatus") || "Standardization Status"}
                </label>
                <select
                  value={form.standardization_status}
                  onChange={e => setForm(p => ({ ...p, standardization_status: e.target.value as StandardizationStatus }))}
                  className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                >
                  <option value="draft">{t("improvement.statusDraft") || "Draft"}</option>
                  <option value="verified">{t("improvement.statusVerified") || "Verified"}</option>
                  <option value="deployed">{t("improvement.statusDeployed") || "Deployed"}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-th-text-3 mb-1">
                  {t("improvement.deploymentLocations") || "Deployment Locations (comma-separated)"}
                </label>
                <input
                  type="text"
                  value={form.deployment_locations}
                  onChange={e => setForm(p => ({ ...p, deployment_locations: e.target.value }))}
                  placeholder="Plant A, Line 2, Cell 5..."
                  className="w-full p-2 rounded-lg bg-th-bg border border-th-border text-th-text"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-th-border rounded-lg text-th-text-3"
              >
                {t("common.cancel") || "Cancel"}
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
              >
                {t("common.create") || "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deployments List */}
      {deployments.length === 0 ? (
        <div className="bg-th-card rounded-xl border border-th-border p-8 text-center">
          <GitBranch className="w-12 h-12 text-th-text-3 mx-auto mb-3 opacity-40" />
          <p className="text-th-text-3">
            No horizontal deployments yet. Deploy solutions across production lines.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {deployments.map(d => {
            const completedSet = new Set(d.completed_lines || []);
            const allDone = d.target_lines.every(l => completedSet.has(l));
            return (
              <div key={d.id} className="bg-th-card rounded-xl border border-th-border p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-brand-100 text-brand-700">
                        {d.source_type} #{d.source_id}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        allDone ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {allDone ? "Completed" : "In Progress"}
                      </span>
                    </div>
                    <p className="text-th-text font-medium">{d.description}</p>
                  </div>
                  <span className="text-xs text-th-text-3">
                    {new Date(d.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.target_lines.map(lineId => {
                    const done = completedSet.has(lineId);
                    return (
                      <button
                        key={lineId}
                        onClick={() => !done && handleComplete(d.id, lineId)}
                        disabled={done}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                          done
                            ? "bg-green-100 text-green-700 cursor-default"
                            : "bg-th-bg border border-th-border text-th-text hover:border-brand-400"
                        }`}
                      >
                        {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                        Line {lineId}
                      </button>
                    );
                  })}
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="h-2 bg-th-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 rounded-full transition-all"
                      style={{ width: `${d.target_lines.length ? (completedSet.size / d.target_lines.length * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-th-text-3 mt-1">
                    {completedSet.size}/{d.target_lines.length} lines completed
                  </p>
                </div>

                {/* Standardization Verification Section */}
                {(() => {
                  const v = verificationEdits[d.id] || {
                    verification_date: d.verification_date || "",
                    verified_by: d.verified_by || "",
                    standardization_status: d.standardization_status || "draft",
                    deployment_locations: d.deployment_locations || [],
                  };
                  const stdStatusColors: Record<string, string> = {
                    draft: "bg-th-bg-3 text-th-text-2",
                    verified: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                    deployed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                  };
                  return (
                    <div className="mt-3 pt-3 border-t border-th-border">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-th-text-3" />
                        <span className="text-xs font-semibold text-th-text-3 uppercase tracking-wider">
                          {t("improvement.standardizationVerification") || "Standardization & Verification"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-th-text-3">{t("improvement.standardizationStatus") || "Status"}:</span>
                          <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${stdStatusColors[v.standardization_status] || stdStatusColors.draft}`}>
                            {t(`improvement.status${v.standardization_status.charAt(0).toUpperCase() + v.standardization_status.slice(1)}`) || v.standardization_status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-th-text-3" />
                          <span className="text-th-text-3">{v.verification_date || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-th-text-3" />
                          <span className="text-th-text">{v.verified_by || "—"}</span>
                        </div>
                        <div>
                          <span className="text-th-text-3">{t("improvement.locations") || "Locations"}:</span>
                          <span className="ml-1 text-th-text">{v.deployment_locations.length > 0 ? v.deployment_locations.join(", ") : "—"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
