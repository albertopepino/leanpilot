"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { qcApi } from "@/lib/api";
import {
  Wrench,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  CalendarDays,
  Search,
  Plus,
  X,
} from "lucide-react";

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

const STATUS_ORDER = ["open", "in_progress", "implemented", "verified", "closed", "cancelled"];

export default function CAPABoard() {
  const { t } = useI18n();

  const CAPA_TYPES = [
    { value: "corrective", label: t("manufacturing.typeCorrective"), icon: <Wrench className="w-4 h-4" />, desc: t("manufacturing.descCorrective") },
    { value: "preventive", label: t("manufacturing.typePreventive"), icon: <Shield className="w-4 h-4" />, desc: t("manufacturing.descPreventive") },
  ];

  const STATUSES = [
    { value: "open", label: t("manufacturing.statusOpen"), color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
    { value: "in_progress", label: t("manufacturing.statusInProgress"), color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "implemented", label: t("manufacturing.statusImplemented"), color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
    { value: "verified", label: t("manufacturing.statusVerified"), color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
    { value: "closed", label: t("manufacturing.statusClosed"), color: "bg-th-bg-3 text-th-text-2" },
    { value: "cancelled", label: t("manufacturing.statusCancelled"), color: "bg-th-bg-3 text-th-text-3" },
  ];

  const PRIORITIES = [
    { value: "low", label: t("manufacturing.priorityLow"), color: "text-green-600" },
    { value: "medium", label: t("manufacturing.priorityMedium"), color: "text-yellow-600" },
    { value: "high", label: t("manufacturing.priorityHigh"), color: "text-orange-600" },
    { value: "critical", label: t("manufacturing.priorityCritical"), color: "text-red-600" },
  ];

  const [capas, setCAPAs] = useState<CAPA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<CAPA | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    capa_type: "corrective", title: "", description: "",
    root_cause: "", priority: "medium", due_date: "",
  });

  const [updateForm, setUpdateForm] = useState({
    status: "", priority: "", root_cause: "", due_date: "", effectiveness_result: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await qcApi.listCAPAs({ status: filterStatus || undefined });
      const raw = res.data ?? res;
      setCAPAs(Array.isArray(raw) ? raw : []);
    } catch {
      setError(t("manufacturing.failedLoadCAPA"));
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    try {
      await qcApi.createCAPA({
        capa_type: form.capa_type,
        title: form.title,
        description: form.description,
        root_cause: form.root_cause || null,
        priority: form.priority,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      });
      setSuccess(t("manufacturing.capaCreated"));
      setShowCreate(false);
      setForm({ capa_type: "corrective", title: "", description: "", root_cause: "", priority: "medium", due_date: "" });
      await fetchData();
    } catch {
      setError(t("manufacturing.failedCreateCAPA"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!showDetail) return;
    setSubmitting(true);
    try {
      const payload: any = {};
      if (updateForm.status && updateForm.status !== showDetail.status) payload.status = updateForm.status;
      if (updateForm.priority && updateForm.priority !== showDetail.priority) payload.priority = updateForm.priority;
      if (updateForm.root_cause !== (showDetail.root_cause || "")) payload.root_cause = updateForm.root_cause || null;
      if (updateForm.due_date) payload.due_date = new Date(updateForm.due_date).toISOString();
      if (updateForm.effectiveness_result) payload.effectiveness_result = updateForm.effectiveness_result;
      await qcApi.updateCAPA(showDetail.id, payload);
      setSuccess(t("manufacturing.capaUpdated"));
      setShowDetail(null);
      await fetchData();
    } catch {
      setError(t("manufacturing.failedUpdateCAPA"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (capa: CAPA) => {
    try {
      await qcApi.verifyCAPA(capa.id, "Effective");
      setSuccess(t("manufacturing.verifiedAsEffective", { number: capa.capa_number }));
      await fetchData();
    } catch {
      setError(t("manufacturing.failedVerifyCAPA"));
    }
  };

  const openDetail = (capa: CAPA) => {
    setShowDetail(capa);
    setUpdateForm({
      status: capa.status,
      priority: capa.priority,
      root_cause: capa.root_cause || "",
      due_date: capa.due_date ? capa.due_date.split("T")[0] : "",
      effectiveness_result: capa.effectiveness_result || "",
    });
  };

  const filteredCAPAs = capas.filter((c) => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterType && c.capa_type !== filterType) return false;
    return true;
  }).sort((a, b) => {
    // Sort: open first, then by priority
    const statusDiff = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (statusDiff !== 0) return statusDiff;
    const prioOrder = ["critical", "high", "medium", "low"];
    return prioOrder.indexOf(a.priority) - prioOrder.indexOf(b.priority);
  });

  // Summary
  const openCount = capas.filter((c) => c.status === "open" || c.status === "in_progress").length;
  const overdueCount = capas.filter((c) => c.due_date && new Date(c.due_date) < new Date() && c.status !== "closed" && c.status !== "verified" && c.status !== "cancelled").length;
  const verifiedCount = capas.filter((c) => c.status === "verified" || c.status === "closed").length;
  const correctiveCount = capas.filter((c) => c.capa_type === "corrective").length;
  const preventiveCount = capas.filter((c) => c.capa_type === "preventive").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6" id="capa-view">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-th-text">{t("manufacturing.titleCAPA")}</h2>
          <p className="text-sm text-th-text-3 mt-1">
            {t("manufacturing.capaTotal", { count: capas.length })} — {correctiveCount} {t("manufacturing.capaCorrective")}, {preventiveCount} {t("manufacturing.capaPreventive")}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          {t("manufacturing.newCAPA")}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <p className="text-blue-800 dark:text-blue-300 text-xs font-semibold uppercase">{t("manufacturing.active")}</p>
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">{openCount}</p>
        </div>
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${overdueCount > 0 ? "text-red-500" : "text-green-500"}`} />
            <p className={`text-xs font-semibold uppercase ${overdueCount > 0 ? "text-red-800 dark:text-red-300" : "text-green-800 dark:text-green-300"}`}>{t("manufacturing.overdue")}</p>
          </div>
          <p className={`text-2xl font-bold mt-1 ${overdueCount > 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>{overdueCount}</p>
        </div>
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-green-800 dark:text-green-300 text-xs font-semibold uppercase">{t("manufacturing.verifiedClosed")}</p>
          </div>
          <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">{verifiedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-th-border rounded-lg px-3 py-1.5 text-sm bg-th-bg text-th-text"
        >
          <option value="">{t("manufacturing.allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <div className="flex gap-1">
          <button
            onClick={() => setFilterType("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${!filterType ? "bg-brand-600 text-white" : "bg-th-bg-3 text-th-text-2 hover:bg-th-hover"}`}
          >
            {t("manufacturing.catAll")}
          </button>
          {CAPA_TYPES.map((ct) => (
            <button
              key={ct.value}
              onClick={() => setFilterType(ct.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 ${filterType === ct.value ? "bg-brand-600 text-white" : "bg-th-bg-3 text-th-text-2 hover:bg-th-hover"}`}
            >
              {ct.icon} {ct.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm border border-red-200 dark:border-red-800">
          {error}
          <button onClick={() => setError(null)} className="ml-2"><X className="w-4 h-4 inline" /></button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl text-sm border border-green-200 dark:border-green-800">
          <CheckCircle className="w-4 h-4 inline" /> {success}
          <button onClick={() => setSuccess(null)} className="ml-2"><X className="w-4 h-4 inline" /></button>
        </div>
      )}

      {/* CAPA List */}
      {filteredCAPAs.length === 0 ? (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-12 text-center">
          <Shield className="w-10 h-10 text-th-text-3 mx-auto mb-3" />
          <p className="text-th-text-3">{t("manufacturing.noCAPA")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-th-bg-3 text-th-text-2 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">CAPA #</th>
                  <th className="text-left px-4 py-3">{t("manufacturing.type")}</th>
                  <th className="text-left px-4 py-3">{t("manufacturing.title")}</th>
                  <th className="text-left px-4 py-3">{t("manufacturing.priority")}</th>
                  <th className="text-left px-4 py-3">{t("common.status")}</th>
                  <th className="text-left px-4 py-3">{t("manufacturing.dueDate")}</th>
                  <th className="text-left px-4 py-3">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-th-border/50">
                {filteredCAPAs.map((capa) => {
                  const statusInfo = STATUSES.find((s) => s.value === capa.status);
                  const prioInfo = PRIORITIES.find((p) => p.value === capa.priority);
                  const typeInfo = CAPA_TYPES.find((ct) => ct.value === capa.capa_type);
                  const isOverdue = capa.due_date && new Date(capa.due_date) < new Date() && capa.status !== "closed" && capa.status !== "verified" && capa.status !== "cancelled";
                  return (
                    <tr key={capa.id} className="hover:bg-th-hover transition cursor-pointer" onClick={() => openDetail(capa)}>
                      <td className="px-4 py-3 font-mono text-xs text-th-text-3">{capa.capa_number}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs inline-flex items-center gap-1">{typeInfo?.icon} {typeInfo?.label}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-th-text max-w-xs truncate">{capa.title}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${prioInfo?.color || ""}`}>
                          {capa.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo?.color || ""}`}>
                          {statusInfo?.label || capa.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {capa.due_date ? (
                          <span className={`inline-flex items-center gap-1 ${isOverdue ? "text-red-600 font-bold" : "text-th-text-3"}`}>
                            {isOverdue && <AlertTriangle className="w-3 h-3" />}{new Date(capa.due_date).toLocaleDateString()}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openDetail(capa)}
                            className="px-2 py-1 bg-th-bg-3 text-th-text-2 rounded-lg text-xs hover:bg-th-hover"
                          >
                            {t("manufacturing.view")}
                          </button>
                          {capa.status === "implemented" && (
                            <button
                              onClick={() => handleVerify(capa)}
                              className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-xs font-semibold hover:bg-green-100 dark:hover:bg-green-900/40 inline-flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" /> {t("manufacturing.verify")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create CAPA Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-th-bg rounded-t-xl md:rounded-xl shadow-xl border border-th-border w-full md:max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-th-border rounded-full mx-auto mt-3 md:hidden" />
            <div className="p-5 border-b border-th-border">
              <h3 className="font-bold text-th-text text-lg">{t("manufacturing.newCAPAAction")}</h3>
            </div>
            <div className="p-5 space-y-4">
              {/* Type selector */}
              <div className="grid grid-cols-2 gap-3">
                {CAPA_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    onClick={() => setForm({ ...form, capa_type: ct.value })}
                    className={`p-3 rounded-xl border text-left transition ${
                      form.capa_type === ct.value
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                        : "border-th-border hover:bg-th-hover"
                    }`}
                  >
                    <span className="text-th-text-2">{ct.icon}</span>
                    <p className="text-sm font-semibold text-th-text mt-1">{ct.label}</p>
                    <p className="text-xs text-th-text-3">{ct.desc}</p>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.title")} *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  placeholder="Implement SPC on critical dimension"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.descriptionLabel")} *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text resize-none"
                  placeholder="Describe the action to be taken..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.rootCause")}</label>
                <textarea
                  value={form.root_cause}
                  onChange={(e) => setForm({ ...form, root_cause: e.target.value })}
                  rows={2}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text resize-none"
                  placeholder={t("manufacturing.rootCauseAnalysis")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.priority")}</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.dueDate")}</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-th-border flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.title.trim() || !form.description.trim() || submitting}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center gap-1.5"
              >
                {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {submitting ? t("manufacturing.creating") : t("manufacturing.createCAPA")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAPA Detail / Update Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4" onClick={() => setShowDetail(null)}>
          <div className="bg-th-bg rounded-t-xl md:rounded-xl shadow-xl border border-th-border w-full md:max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-th-border rounded-full mx-auto mt-3 md:hidden" />
            <div className="p-5 border-b border-th-border">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-th-text-3">{showDetail.capa_number}</span>
                <span className="text-xs inline-flex items-center gap-1">{CAPA_TYPES.find((ct) => ct.value === showDetail.capa_type)?.icon} {CAPA_TYPES.find((ct) => ct.value === showDetail.capa_type)?.label}</span>
              </div>
              <h3 className="font-bold text-th-text text-lg mt-1">{showDetail.title}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-th-bg-3 rounded-lg p-3 text-sm text-th-text">
                {showDetail.description}
              </div>

              {showDetail.root_cause && (
                <div>
                  <span className="text-th-text-3 text-xs font-semibold">{t("manufacturing.rootCause")}:</span>
                  <p className="text-th-text text-sm mt-0.5">{showDetail.root_cause}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="border border-th-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-th-text-2">{t("manufacturing.timeline")}</p>
                <div className="text-xs text-th-text-3 space-y-1">
                  <p className="flex items-center gap-1.5"><CalendarDays className="w-3 h-3" /> {t("manufacturing.created")}: {new Date(showDetail.created_at).toLocaleString()}</p>
                  {showDetail.due_date && <p className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {t("manufacturing.due")}: {new Date(showDetail.due_date).toLocaleDateString()}</p>}
                  {showDetail.implemented_at && <p className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3" /> {t("manufacturing.implemented")}: {new Date(showDetail.implemented_at).toLocaleString()}</p>}
                  {showDetail.verified_at && <p className="flex items-center gap-1.5"><Search className="w-3 h-3" /> {t("manufacturing.verified")}: {new Date(showDetail.verified_at).toLocaleString()}</p>}
                </div>
              </div>

              {showDetail.effectiveness_result && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <p className="text-xs font-semibold text-green-800 dark:text-green-300">{t("manufacturing.effectivenessResult")}</p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">{showDetail.effectiveness_result}</p>
                </div>
              )}

              <hr className="border-th-border" />

              {/* Update fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("common.status")}</label>
                  <select
                    value={updateForm.status}
                    onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.priority")}</label>
                  <select
                    value={updateForm.priority}
                    onChange={(e) => setUpdateForm({ ...updateForm, priority: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.rootCause")}</label>
                <textarea
                  value={updateForm.root_cause}
                  onChange={(e) => setUpdateForm({ ...updateForm, root_cause: e.target.value })}
                  rows={2}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.dueDate")}</label>
                <input
                  type="date"
                  value={updateForm.due_date}
                  onChange={(e) => setUpdateForm({ ...updateForm, due_date: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.effectivenessResult")}</label>
                <textarea
                  value={updateForm.effectiveness_result}
                  onChange={(e) => setUpdateForm({ ...updateForm, effectiveness_result: e.target.value })}
                  rows={2}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text resize-none"
                  placeholder={t("manufacturing.effectivenessHint")}
                />
              </div>
            </div>
            <div className="p-5 border-t border-th-border flex gap-3 justify-end">
              <button onClick={() => setShowDetail(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3">
                {t("common.close")}
              </button>
              <button
                onClick={handleUpdate}
                disabled={submitting}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center gap-1.5"
              >
                {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {submitting ? t("manufacturing.saving") : t("manufacturing.updateCAPA")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
