"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "@/stores/useI18n";
import { manufacturingApi } from "@/lib/api";

interface Product {
  id: number;
  code: string;
  name: string;
  description: string | null;
  unit_of_measure: string | null;
  product_family: string | null;
  labor_minutes_per_unit: number | null;
  is_active: boolean;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
  total_rows: number;
}

export default function ProductCatalog() {
  const { t } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    code: "", name: "", description: "", unit_of_measure: "pcs", product_family: "",
    labor_minutes_per_unit: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await manufacturingApi.listProducts(false);
      setProducts(res.data ?? res);
    } catch { setError("Failed to load products"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm({ code: "", name: "", description: "", unit_of_measure: "pcs", product_family: "", labor_minutes_per_unit: "" });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    try {
      const payload = {
        ...form,
        description: form.description || undefined,
        product_family: form.product_family || undefined,
        labor_minutes_per_unit: form.labor_minutes_per_unit ? parseFloat(form.labor_minutes_per_unit) : undefined,
      };
      if (editId) {
        await manufacturingApi.updateProduct(editId, payload);
      } else {
        await manufacturingApi.createProduct(payload);
      }
      resetForm();
      await fetchData();
    } catch { setError("Save failed"); }
  };

  const handleEdit = (p: Product) => {
    setForm({
      code: p.code, name: p.name, description: p.description || "",
      unit_of_measure: p.unit_of_measure || "pcs", product_family: p.product_family || "",
      labor_minutes_per_unit: p.labor_minutes_per_unit ? String(p.labor_minutes_per_unit) : "",
    });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleToggle = async (p: Product) => {
    await manufacturingApi.updateProduct(p.id, { is_active: !p.is_active });
    await fetchData();
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await manufacturingApi.downloadProductTemplate();
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "product_template.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download template");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await manufacturingApi.importProducts(file);
      const result: ImportResult = res.data ?? res;

      const messages: string[] = [];
      if (result.created > 0) messages.push(`${result.created} products imported`);
      if (result.skipped > 0) messages.push(`${result.skipped} duplicates skipped`);
      if (result.errors.length > 0) messages.push(`${result.errors.length} errors`);

      if (result.created > 0) {
        setSuccess(messages.join(", "));
        await fetchData();
      } else if (result.skipped > 0) {
        setSuccess(`All ${result.skipped} products already exist (skipped)`);
      }

      if (result.errors.length > 0) {
        setError(`Import errors: ${result.errors.slice(0, 3).join("; ")}`);
      }
    } catch {
      setError("Import failed. Check the file format.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="space-y-4" id="products-view">
      <div className="flex items-center justify-between">
        <p className="text-sm text-th-text-3">{products.filter(p => p.is_active).length} active products</p>
        <div className="flex items-center gap-2">
          {/* Download Template */}
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-2 border border-th-border text-th-text-2 hover:bg-th-bg-3 rounded-xl text-sm font-semibold flex items-center gap-1.5"
            title="Download Excel template"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Template
          </button>

          {/* Upload Excel */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-3 py-2 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
            title="Import products from Excel"
          >
            {importing ? (
              <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
            {importing ? "Importing..." : "Upload Excel"}
          </button>

          {/* Add Product */}
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold"
          >
            + Add Product
          </button>
        </div>
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

      <div className="bg-white dark:bg-th-bg-2 rounded-xl border border-th-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-th-border text-left text-th-text-3 text-xs uppercase">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Family</th>
              <th className="px-4 py-3">UOM</th>
              <th className="px-4 py-3">Labor (min)</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={`border-b border-th-border/50 ${!p.is_active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-mono font-bold text-brand-600 dark:text-brand-400">{p.code}</td>
                <td className="px-4 py-3 text-th-text font-medium">{p.name}</td>
                <td className="px-4 py-3 text-th-text-2">{p.product_family || "—"}</td>
                <td className="px-4 py-3 text-th-text-2">{p.unit_of_measure}</td>
                <td className="px-4 py-3 text-th-text-2 font-mono">{p.labor_minutes_per_unit ?? "—"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(p)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${p.is_active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${p.is_active ? "left-5" : "left-0.5"}`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(p)} className="text-brand-600 hover:underline text-xs font-semibold">Edit</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-th-text-3">
                No products yet. Add manually or upload an Excel file.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-th-bg rounded-2xl shadow-xl border border-th-border w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-th-border">
              <h3 className="font-bold text-th-text text-lg">{editId ? "Edit Product" : "New Product"}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">Code *</label>
                  <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text" placeholder="SKU-001" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">UOM</label>
                  <select value={form.unit_of_measure} onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text">
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="liters">liters</option>
                    <option value="meters">meters</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text" placeholder="Product name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">Product Family</label>
                  <input type="text" value={form.product_family} onChange={(e) => setForm({ ...form, product_family: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text" placeholder="Optional grouping" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">Manual Labor (min/unit)</label>
                  <input type="number" step="any" value={form.labor_minutes_per_unit} onChange={(e) => setForm({ ...form, labor_minutes_per_unit: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text" placeholder="e.g. 5.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text resize-none" />
              </div>
            </div>
            <div className="p-5 border-t border-th-border flex gap-3 justify-end">
              <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3">{t("common.cancel")}</button>
              <button onClick={handleSave} disabled={!form.code.trim() || !form.name.trim()}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold">{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
