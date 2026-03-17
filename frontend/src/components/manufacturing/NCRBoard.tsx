"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { qcApi, manufacturingApi, adminApi } from "@/lib/api";

interface NCR {
  id: number;
  ncr_number: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  production_line_id: number | null;
  production_order_id: number | null;
  product_id: number | null;
  quantity_affected: number | null;
  disposition: string | null;
  disposition_notes: string | null;
  root_cause: string | null;
  detected_at: string;
  closed_at: string | null;
  created_at: string;
}

interface Line { id: number; name: string; }
interface Product { id: number; code: string; name: string; }

export default function NCRBoard() {
  const { t } = useI18n();

  const SEVERITIES = [
    { value: "minor", label: t("manufacturing.severityMinor"), color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
    { value: "major", label: t("manufacturing.severityMajor"), color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
    { value: "critical", label: t("manufacturing.severityCritical"), color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  ];

  const STATUSES = [
    { value: "open", label: t("manufacturing.open"), color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300", icon: "🔴" },
    { value: "under_investigation", label: t("manufacturing.underInvestigation"), color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300", icon: "🔍" },
    { value: "pending_capa", label: t("manufacturing.pendingCAPA"), color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300", icon: "⏳" },
    { value: "closed", label: t("manufacturing.closed"), color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300", icon: "✅" },
    { value: "rejected", label: t("manufacturing.rejected"), color: "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300", icon: "🚫" },
  ];

  const DISPOSITIONS = [
    { value: "rework", label: t("manufacturing.dispRework") },
    { value: "scrap", label: t("manufacturing.dispScrap") },
    { value: "use_as_is", label: t("manufacturing.dispUseAsIs") },
    { value: "return_to_supplier", label: t("manufacturing.dispReturn") },
  ];

  const [ncrs, setNCRs] = useState<NCR[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<NCR | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", severity: "major",
    production_line_id: 0, product_id: 0, quantity_affected: "",
  });

  const [updateForm, setUpdateForm] = useState({
    status: "", disposition: "", disposition_notes: "", root_cause: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const [ncrRes, factRes, prodRes] = await Promise.all([
        qcApi.listNCRs({ status: filterStatus || undefined, severity: filterSeverity || undefined }),
        adminApi.getFactory(),
        manufacturingApi.listProducts(),
      ]);
      setNCRs(ncrRes.data ?? ncrRes);
      setLines((factRes.data as any)?.production_lines || (factRes as any).production_lines || []);
      setProducts((prodRes.data ?? prodRes).map((p: any) => ({ id: p.id, code: p.code, name: p.name })));
    } catch {
      setError(t("manufacturing.failedLoadNCR"));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSeverity]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    try {
      await qcApi.createNCR({
        title: form.title,
        description: form.description,
        severity: form.severity,
        production_line_id: form.production_line_id || null,
        product_id: form.product_id || null,
        quantity_affected: form.quantity_affected ? parseInt(form.quantity_affected) : null,
      });
      setSuccess(t("manufacturing.ncrCreated"));
      setShowCreate(false);
      setForm({ title: "", description: "", severity: "major", production_line_id: 0, product_id: 0, quantity_affected: "" });
      await fetchData();
    } catch {
      setError(t("manufacturing.failedCreateNCR"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!showDetail) return;
    setSubmitting(true);
    try {
      const payload: any = {};
      if (updateForm.status) payload.status = updateForm.status;
      if (updateForm.disposition) payload.disposition = updateForm.disposition;
      if (updateForm.disposition_notes) payload.disposition_notes = updateForm.disposition_notes;
      if (updateForm.root_cause) payload.root_cause = updateForm.root_cause;
      await qcApi.updateNCR(showDetail.id, payload);
      setSuccess(t("manufacturing.ncrUpdated"));
      setShowDetail(null);
      await fetchData();
    } catch {
      setError(t("manufacturing.failedUpdateNCR"));
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = (ncr: NCR) => {
    setShowDetail(ncr);
    setUpdateForm({
      status: ncr.status,
      disposition: ncr.disposition || "",
      disposition_notes: ncr.disposition_notes || "",
      root_cause: ncr.root_cause || "",
    });
  };

  const filteredNCRs = ncrs.filter((n) => {
    if (filterStatus && n.status !== filterStatus) return false;
    if (filterSeverity && n.severity !== filterSeverity) return false;
    return true;
  });

  const lineMap = new Map<number, string>(lines.map((l) => [l.id, l.name]));
  const productMap = new Map<number, string>(products.map((p) => [p.id, `${p.code} - ${p.name}`]));

  // Summary counts
  const openCount = ncrs.filter((n) => n.status === "open").length;
  const investigationCount = ncrs.filter((n) => n.status === "under_investigation").length;
  const criticalCount = ncrs.filter((n) => n.severity === "critical" && n.status !== "closed").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4" id="ncr-view">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-th-text">{t("manufacturing.titleNCR")}</h2>
          <p className="text-sm text-th-text-3 mt-1">
            {ncrs.length !== 1
              ? t("manufacturing.ncrTotal", { count: ncrs.length })
              : t("manufacturing.ncrTotalSingular", { count: ncrs.length })}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5"
        >
          {"⚠️"} {t("manufacturing.raiseNCR")}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-300 text-xs font-semibold uppercase">{t("manufacturing.open")}</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">{openCount}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <p className="text-blue-800 dark:text-blue-300 text-xs font-semibold uppercase">{t("manufacturing.underInvestigation")}</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">{investigationCount}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
          <p className="text-orange-800 dark:text-orange-300 text-xs font-semibold uppercase">{t("manufacturing.criticalOpen")}</p>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-400 mt-1">{criticalCount}</p>
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
            <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="border border-th-border rounded-lg px-3 py-1.5 text-sm bg-th-bg text-th-text"
        >
          <option value="">{t("manufacturing.allSeverities")}</option>
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm border border-red-200 dark:border-red-800">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">{"×"}</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl text-sm border border-green-200 dark:border-green-800">
          {"✓"} {success}
          <button onClick={() => setSuccess(null)} className="ml-2 font-bold">{"×"}</button>
        </div>
      )}

      {/* NCR List */}
      {filteredNCRs.length === 0 ? (
        <div className="bg-white dark:bg-th-bg-2 rounded-xl border border-th-border p-12 text-center">
          <div className="text-4xl mb-3">{"✅"}</div>
          <p className="text-th-text-3">{t("manufacturing.noNCRs")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNCRs.map((ncr) => {
            const sevInfo = SEVERITIES.find((s) => s.value === ncr.severity);
            const statusInfo = STATUSES.find((s) => s.value === ncr.status);
            return (
              <div
                key={ncr.id}
                onClick={() => openDetail(ncr)}
                className="bg-white dark:bg-th-bg-2 rounded-xl border border-th-border p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-th-text-3">{ncr.ncr_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sevInfo?.color || ""}`}>
                        {ncr.severity.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo?.color || ""}`}>
                        {statusInfo?.icon} {statusInfo?.label || ncr.status}
                      </span>
                      {ncr.disposition && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 capitalize">
                          {ncr.disposition.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-th-text mt-1">{ncr.title}</h3>
                    <p className="text-th-text-3 text-sm mt-0.5 line-clamp-2">{ncr.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-th-text-3">
                      {ncr.production_line_id && <span>{t("manufacturing.line")}: {lineMap.get(ncr.production_line_id) || "—"}</span>}
                      {ncr.product_id && <span>{t("manufacturing.product")}: {productMap.get(ncr.product_id) || "—"}</span>}
                      {ncr.quantity_affected && <span>{t("manufacturing.qtyAffected")}: {ncr.quantity_affected}</span>}
                      <span>{t("manufacturing.detected")}: {new Date(ncr.detected_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create NCR Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-th-bg rounded-2xl shadow-xl border border-th-border w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-th-border">
              <h3 className="font-bold text-th-text text-lg">{"⚠️"} {t("manufacturing.raiseNCRTitle")}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.title")} *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  placeholder="Dimensional defect on batch #1234"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.descriptionLabel")} *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text resize-none"
                  placeholder="Describe the non-conformance in detail..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.severity")} *</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.quantityAffected")}</label>
                  <input
                    type="number"
                    value={form.quantity_affected}
                    onChange={(e) => setForm({ ...form, quantity_affected: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.productionLine")}</label>
                  <select
                    value={form.production_line_id}
                    onChange={(e) => setForm({ ...form, production_line_id: Number(e.target.value) })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  >
                    <option value={0}>{t("manufacturing.noneOption")}</option>
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.product")}</label>
                  <select
                    value={form.product_id}
                    onChange={(e) => setForm({ ...form, product_id: Number(e.target.value) })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  >
                    <option value={0}>{t("manufacturing.noneOption")}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
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
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold flex items-center gap-1.5"
              >
                {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {submitting ? t("manufacturing.creating") : t("manufacturing.raiseNCR")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NCR Detail / Update Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDetail(null)}>
          <div className="bg-th-bg rounded-2xl shadow-xl border border-th-border w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-th-border">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-th-text-3">{showDetail.ncr_number}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${SEVERITIES.find((s) => s.value === showDetail.severity)?.color || ""}`}>
                  {showDetail.severity.toUpperCase()}
                </span>
              </div>
              <h3 className="font-bold text-th-text text-lg mt-1">{showDetail.title}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-th-bg-3 rounded-lg p-3 text-sm text-th-text">
                {showDetail.description}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {showDetail.production_line_id && (
                  <div>
                    <span className="text-th-text-3 text-xs">{t("manufacturing.line")}:</span>
                    <p className="text-th-text">{lineMap.get(showDetail.production_line_id) || "—"}</p>
                  </div>
                )}
                {showDetail.product_id && (
                  <div>
                    <span className="text-th-text-3 text-xs">{t("manufacturing.product")}:</span>
                    <p className="text-th-text">{productMap.get(showDetail.product_id) || "—"}</p>
                  </div>
                )}
                {showDetail.quantity_affected && (
                  <div>
                    <span className="text-th-text-3 text-xs">{t("manufacturing.qtyAffected")}:</span>
                    <p className="text-th-text font-bold">{showDetail.quantity_affected}</p>
                  </div>
                )}
                <div>
                  <span className="text-th-text-3 text-xs">{t("manufacturing.detected")}:</span>
                  <p className="text-th-text">{new Date(showDetail.detected_at).toLocaleString()}</p>
                </div>
              </div>

              <hr className="border-th-border" />

              {/* Update fields */}
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("common.status")}</label>
                <select
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.disposition")}</label>
                <select
                  value={updateForm.disposition}
                  onChange={(e) => setUpdateForm({ ...updateForm, disposition: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                >
                  <option value="">{t("manufacturing.selectDisp")}</option>
                  {DISPOSITIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.rootCause")}</label>
                <textarea
                  value={updateForm.root_cause}
                  onChange={(e) => setUpdateForm({ ...updateForm, root_cause: e.target.value })}
                  rows={2}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text resize-none"
                  placeholder={t("manufacturing.rootCauseAnalysis")}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.dispositionNotes")}</label>
                <textarea
                  value={updateForm.disposition_notes}
                  onChange={(e) => setUpdateForm({ ...updateForm, disposition_notes: e.target.value })}
                  rows={2}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text resize-none"
                  placeholder={t("manufacturing.actionsTaken")}
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
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold flex items-center gap-1.5"
              >
                {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {submitting ? t("manufacturing.saving") : t("manufacturing.updateNCR")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
