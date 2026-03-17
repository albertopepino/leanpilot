"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { qcApi, manufacturingApi, adminApi } from "@/lib/api";

interface Defect {
  id: number;
  code: string;
  name: string;
  severity: string;
  category: string | null;
  product_id: number | null;
  production_line_id: number | null;
  is_active: boolean;
  sort_order: number;
}

interface Product { id: number; code: string; name: string; }
interface Line { id: number; name: string; }

const SEV_COLORS: Record<string, string> = {
  minor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  major: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function DefectCatalogAdmin() {
  const { t } = useI18n();

  const SEVERITIES = ["minor", "major", "critical"];
  const CATEGORIES = [
    t("manufacturing.catDimensional"),
    t("manufacturing.catSurface"),
    t("manufacturing.catAssembly"),
    t("manufacturing.catMaterial"),
    t("manufacturing.catContamination"),
    t("manufacturing.catPackaging"),
    t("manufacturing.catOther"),
  ];
  // Map translated category labels back to API values
  const CATEGORY_VALUES = ["dimensional", "surface", "assembly", "material", "contamination", "packaging", "other"];

  const [defects, setDefects] = useState<Defect[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: "", name: "", severity: "minor", category: "",
    product_id: 0, production_line_id: 0, sort_order: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      const [defRes, prodRes, factRes] = await Promise.all([
        qcApi.listDefects({ active_only: false }),
        manufacturingApi.listProducts(),
        adminApi.getFactory(),
      ]);
      setDefects(defRes.data ?? defRes);
      setProducts(prodRes.data ?? prodRes);
      setLines((factRes.data ?? factRes).production_lines ?? []);
    } catch { setError("Failed to load data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm({ code: "", name: "", severity: "minor", category: "", product_id: 0, production_line_id: 0, sort_order: 0 });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    try {
      const payload = {
        ...form,
        product_id: form.product_id || undefined,
        production_line_id: form.production_line_id || undefined,
        category: form.category || undefined,
      };
      if (editId) {
        await qcApi.updateDefect(editId, payload);
      } else {
        await qcApi.createDefect(payload);
      }
      resetForm();
      await fetchData();
    } catch { setError("Save failed"); }
  };

  const handleEdit = (d: Defect) => {
    setForm({
      code: d.code, name: d.name, severity: d.severity,
      category: d.category || "", product_id: d.product_id || 0,
      production_line_id: d.production_line_id || 0, sort_order: d.sort_order,
    });
    setEditId(d.id);
    setShowForm(true);
  };

  const handleToggle = async (d: Defect) => {
    await qcApi.updateDefect(d.id, { is_active: !d.is_active });
    await fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="space-y-4" id="defect-catalog-view">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-th-text">{t("manufacturing.titleDefectCatalog")}</h2>
          <p className="text-sm text-th-text-3 mt-1">{t("manufacturing.defectTypesConfigured", { count: defects.length })}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold"
        >
          {t("manufacturing.addDefectType")}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm border border-red-200 dark:border-red-800">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-th-bg-2 rounded-xl border border-th-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-th-border text-left text-th-text-3 text-xs uppercase">
              <th className="px-4 py-3">{t("manufacturing.code")}</th>
              <th className="px-4 py-3">{t("manufacturing.name")}</th>
              <th className="px-4 py-3">{t("manufacturing.severity")}</th>
              <th className="px-4 py-3">{t("manufacturing.category")}</th>
              <th className="px-4 py-3">{t("manufacturing.scope")}</th>
              <th className="px-4 py-3">{t("common.active")}</th>
              <th className="px-4 py-3 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {defects.map((d) => (
              <tr key={d.id} className={`border-b border-th-border/50 ${!d.is_active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-mono font-bold text-brand-600 dark:text-brand-400">{d.code}</td>
                <td className="px-4 py-3 text-th-text font-medium">{d.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SEV_COLORS[d.severity] || ""}`}>
                    {d.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-th-text-2 capitalize">{d.category || "—"}</td>
                <td className="px-4 py-3 text-th-text-3 text-xs">
                  {d.product_id ? products.find(p => p.id === d.product_id)?.name || `P#${d.product_id}` : t("manufacturing.allProductsScope")}
                  {d.production_line_id ? ` / ${lines.find(l => l.id === d.production_line_id)?.name || `L#${d.production_line_id}`}` : ""}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(d)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${d.is_active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${d.is_active ? "left-5" : "left-0.5"}`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(d)} className="text-brand-600 hover:underline text-xs font-semibold">
                    {t("common.edit")}
                  </button>
                </td>
              </tr>
            ))}
            {defects.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-th-text-3">
                  {t("manufacturing.noDefectTypes")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ CREATE/EDIT FORM MODAL ═══ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-th-bg rounded-2xl shadow-xl border border-th-border w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-th-border">
              <h3 className="font-bold text-th-text text-lg">
                {editId ? t("manufacturing.editDefectType") : t("manufacturing.newDefectType")}
              </h3>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.code")} *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                    placeholder="DIM-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.sortOrder")}</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.name")} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  placeholder="Out of tolerance"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.severity")}</label>
                <div className="flex gap-2">
                  {SEVERITIES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setForm({ ...form, severity: s })}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition border ${
                        form.severity === s
                          ? `${SEV_COLORS[s]} border-current`
                          : "bg-th-bg-3 text-th-text-3 border-th-border hover:bg-th-hover"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.category")}</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                >
                  <option value="">{t("manufacturing.selectCategory")}</option>
                  {CATEGORY_VALUES.map((val, idx) => (
                    <option key={val} value={val}>{CATEGORIES[idx]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.productScope")}</label>
                  <select
                    value={form.product_id}
                    onChange={(e) => setForm({ ...form, product_id: Number(e.target.value) })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  >
                    <option value={0}>{t("manufacturing.allProductsScope")}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.lineScope")}</label>
                  <select
                    value={form.production_line_id}
                    onChange={(e) => setForm({ ...form, production_line_id: Number(e.target.value) })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  >
                    <option value={0}>{t("manufacturing.allLinesScope")}</option>
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-th-border flex gap-3 justify-end">
              <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={!form.code.trim() || !form.name.trim()}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
