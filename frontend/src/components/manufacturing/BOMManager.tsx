"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "@/stores/useI18n";
import { manufacturingApi, adminApi } from "@/lib/api";

interface BOMComponent {
  id: number;
  sequence: number;
  material_code: string | null;
  material_name: string;
  quantity_per_unit: number;
  unit_of_measure: string | null;
  is_critical: boolean;
  notes: string | null;
}

interface BOMOperation {
  id: number;
  sequence: number;
  work_center_id: number | null;
  operation_name: string;
  cycle_time_seconds: number;
  cycle_time_basis: string;
  labor_minutes: number | null;
  notes: string | null;
}

interface BOM {
  id: number;
  product_id: number;
  production_line_id: number;
  version: string;
  is_active: boolean;
  ideal_cycle_time_sec: number;
  batch_size: number | null;
  approved_by_id: number | null;
  approved_at: string | null;
  notes: string | null;
  components: BOMComponent[];
  operations: BOMOperation[];
  created_at: string;
}

interface Product { id: number; code: string; name: string; }
interface Line { id: number; name: string; }
interface WorkCenter { id: number; name: string; machine_type: string | null; production_line_id: number; }

interface ImportResult {
  boms_created: number;
  components_added: number;
  errors: string[];
  total_rows: number;
}

export default function BOMManager() {
  const { t } = useI18n();
  const [boms, setBOMs] = useState<BOM[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterProduct, setFilterProduct] = useState<number>(0);
  const [filterLine, setFilterLine] = useState<number>(0);

  // Create BOM modal
  const [showCreate, setShowCreate] = useState(false);
  const [expandedBOM, setExpandedBOM] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    product_id: 0,
    production_line_id: 0,
    ideal_cycle_time_sec: 60,
    batch_size: "",
    notes: "",
    components: [] as { material_code: string; material_name: string; quantity_per_unit: string; unit_of_measure: string; is_critical: boolean }[],
    operations: [] as { work_center_id: string; operation_name: string; cycle_time_seconds: string; cycle_time_basis: string; labor_minutes: string }[],
  });

  const fetchData = useCallback(async () => {
    try {
      const [bomRes, prodRes, factRes, wcRes] = await Promise.all([
        manufacturingApi.listBOMs(filterProduct || undefined, filterLine || undefined),
        manufacturingApi.listProducts(),
        adminApi.getFactory(),
        manufacturingApi.listWorkCenters(),
      ]);
      setBOMs(bomRes.data ?? bomRes);
      setProducts((prodRes.data ?? prodRes).map((p: any) => ({ id: p.id, code: p.code, name: p.name })));
      setLines((factRes.data as any)?.production_lines || (factRes as any).production_lines || []);
      setWorkCenters((wcRes.data ?? wcRes).map((wc: any) => ({
        id: wc.id, name: wc.name, machine_type: wc.machine_type, production_line_id: wc.production_line_id,
      })));
    } catch {
      setError(t("manufacturing.failedLoadBom"));
    } finally {
      setLoading(false);
    }
  }, [filterProduct, filterLine]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const productMap = new Map<number, Product>(products.map((p) => [p.id, p]));
  const lineMap = new Map<number, string>(lines.map((l) => [l.id, l.name]));

  const handleDownloadTemplate = async () => {
    try {
      const res = await manufacturingApi.downloadBOMTemplate();
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bom_template.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(t("manufacturing.failedDownload"));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await manufacturingApi.importBOM(file);
      const result: ImportResult = res.data ?? res;
      const messages: string[] = [];
      if (result.boms_created > 0) messages.push(t("manufacturing.bomsCreated", { count: result.boms_created }));
      if (result.components_added > 0) messages.push(t("manufacturing.materialsAdded", { count: result.components_added }));
      if (result.errors.length > 0) messages.push(t("manufacturing.errorsCount", { count: result.errors.length }));
      if (result.boms_created > 0 || result.components_added > 0) {
        setSuccess(messages.join(", "));
        await fetchData();
      } else if (messages.length > 0) {
        setSuccess(messages.join(", "));
      } else {
        setSuccess(t("manufacturing.noNewData"));
      }
      if (result.errors.length > 0) {
        setError(`Import errors: ${result.errors.slice(0, 3).join("; ")}`);
      }
    } catch {
      setError(t("manufacturing.importFailed"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addComponent = () => {
    setForm({
      ...form,
      components: [...form.components, { material_code: "", material_name: "", quantity_per_unit: "", unit_of_measure: "pcs", is_critical: false }],
    });
  };

  const updateComponent = (index: number, field: string, value: any) => {
    const components = [...form.components];
    (components[index] as any)[field] = value;
    setForm({ ...form, components });
  };

  const removeComponent = (index: number) => {
    setForm({ ...form, components: form.components.filter((_, i) => i !== index) });
  };

  const addOperation = () => {
    setForm({
      ...form,
      operations: [...form.operations, { work_center_id: "", operation_name: "", cycle_time_seconds: "", cycle_time_basis: "per_piece", labor_minutes: "" }],
    });
  };

  const updateOperation = (index: number, field: string, value: any) => {
    const operations = [...form.operations];
    (operations[index] as any)[field] = value;
    setForm({ ...form, operations });
  };

  const removeOperation = (index: number) => {
    setForm({ ...form, operations: form.operations.filter((_, i) => i !== index) });
  };

  const handleCreate = async () => {
    if (!form.product_id || !form.production_line_id || (form.components.length === 0 && form.operations.length === 0)) return;
    setSubmitting(true);
    try {
      await manufacturingApi.createBOM({
        product_id: form.product_id,
        production_line_id: form.production_line_id,
        ideal_cycle_time_sec: form.ideal_cycle_time_sec,
        batch_size: form.batch_size ? parseInt(form.batch_size) : null,
        notes: form.notes || null,
        components: form.components.map((c, i) => ({
          sequence: i + 1,
          material_code: c.material_code || null,
          material_name: c.material_name,
          quantity_per_unit: parseFloat(c.quantity_per_unit) || 0,
          unit_of_measure: c.unit_of_measure || "pcs",
          is_critical: c.is_critical,
        })),
        operations: form.operations.map((op, i) => ({
          sequence: i + 1,
          work_center_id: op.work_center_id ? parseInt(op.work_center_id) : null,
          operation_name: op.operation_name,
          cycle_time_seconds: parseFloat(op.cycle_time_seconds) || 0,
          cycle_time_basis: op.cycle_time_basis || "per_piece",
          labor_minutes: op.labor_minutes ? parseFloat(op.labor_minutes) : null,
        })),
      });
      setSuccess(t("manufacturing.bomCreated"));
      setShowCreate(false);
      setForm({
        product_id: 0, production_line_id: 0, ideal_cycle_time_sec: 60,
        batch_size: "", notes: "", components: [], operations: [],
      });
      await fetchData();
    } catch {
      setError(t("manufacturing.failedCreateBom"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (bomId: number) => {
    try {
      await manufacturingApi.approveBOM(bomId);
      setSuccess(t("manufacturing.bomApproved"));
      await fetchData();
    } catch {
      setError(t("manufacturing.failedApproveBom"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4" id="bom-view">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-th-text">{t("manufacturing.titleBOM")}</h2>
          <p className="text-sm text-th-text-3 mt-1">
            {boms.length !== 1
              ? t("manufacturing.bomDefined", { count: boms.length })
              : t("manufacturing.bomDefinedSingular", { count: boms.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Download Template */}
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-2 border border-th-border text-th-text-2 hover:bg-th-bg-3 rounded-xl text-sm font-semibold flex items-center gap-1.5"
            title="Download BOM Excel template"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            {t("manufacturing.downloadTemplate")}
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
          >
            {importing ? (
              <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
            {importing ? t("manufacturing.importing") : t("manufacturing.uploadExcel")}
          </button>

          {/* Manual Create */}
          <button
            onClick={() => { setForm({ product_id: 0, production_line_id: 0, ideal_cycle_time_sec: 60, batch_size: "", notes: "", components: [], operations: [] }); setShowCreate(true); }}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold"
          >
            {t("manufacturing.newBom")}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterProduct}
          onChange={(e) => setFilterProduct(Number(e.target.value))}
          className="border border-th-border rounded-lg px-3 py-1.5 text-sm bg-th-bg text-th-text"
        >
          <option value={0}>{t("manufacturing.allProducts")}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
          ))}
        </select>
        <select
          value={filterLine}
          onChange={(e) => setFilterLine(Number(e.target.value))}
          className="border border-th-border rounded-lg px-3 py-1.5 text-sm bg-th-bg text-th-text"
        >
          <option value={0}>{t("manufacturing.allLines")}</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
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

      {/* BOM List */}
      {boms.length === 0 ? (
        <div className="bg-white dark:bg-th-bg-2 rounded-xl border border-th-border p-12 text-center">
          <div className="text-4xl mb-3">{"📋"}</div>
          <p className="text-th-text-3">{t("manufacturing.noBoms")}</p>
          <p className="text-th-text-3 text-xs mt-1">{t("manufacturing.noBomsTip")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {boms.map((bom) => {
            const product = productMap.get(bom.product_id);
            const lineName = lineMap.get(bom.production_line_id) || "—";
            const isExpanded = expandedBOM === bom.id;
            return (
              <div key={bom.id} className="bg-white dark:bg-th-bg-2 rounded-xl border border-th-border overflow-hidden">
                {/* BOM Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-th-hover transition flex items-center justify-between"
                  onClick={() => setExpandedBOM(isExpanded ? null : bom.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{"📦"}</span>
                    <div>
                      <h3 className="font-semibold text-th-text">
                        {product ? `${product.code} — ${product.name}` : `Product #${bom.product_id}`}
                      </h3>
                      <p className="text-xs text-th-text-3">
                        {t("manufacturing.line")}: {lineName} &middot; v{bom.version} &middot; CT: {bom.ideal_cycle_time_sec}s
                        {bom.batch_size && ` · ${t("manufacturing.batch")}: ${bom.batch_size}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-th-text-3">
                      {bom.components.length} {t("manufacturing.materials").toLowerCase()}
                      {bom.operations && bom.operations.length > 0 && ` · ${bom.operations.length} ops`}
                    </span>
                    {bom.approved_at ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                        {"✓"} {t("manufacturing.approved")}
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(bom.id); }}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200"
                      >
                        {t("manufacturing.approve")}
                      </button>
                    )}
                    <svg className={`w-4 h-4 text-th-text-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded: Components Table */}
                {isExpanded && (
                  <div className="border-t border-th-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-th-bg-3 text-th-text-2 text-xs uppercase">
                          <th className="text-left px-4 py-2">#</th>
                          <th className="text-left px-4 py-2">{t("manufacturing.code")}</th>
                          <th className="text-left px-4 py-2">{t("manufacturing.material")}</th>
                          <th className="text-right px-4 py-2">{t("manufacturing.qtyPerUnit")}</th>
                          <th className="text-left px-4 py-2">{t("manufacturing.uom")}</th>
                          <th className="text-center px-4 py-2">{t("manufacturing.critical")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-th-border/50">
                        {bom.components
                          .sort((a, b) => a.sequence - b.sequence)
                          .map((comp) => (
                          <tr key={comp.id} className={comp.is_critical ? "bg-red-50/30 dark:bg-red-900/10" : ""}>
                            <td className="px-4 py-2 text-th-text-3 font-mono text-xs">{comp.sequence}</td>
                            <td className="px-4 py-2 font-mono text-xs text-brand-600 dark:text-brand-400">{comp.material_code || "—"}</td>
                            <td className="px-4 py-2 text-th-text">{comp.material_name}</td>
                            <td className="px-4 py-2 text-right font-medium text-th-text">{comp.quantity_per_unit}</td>
                            <td className="px-4 py-2 text-th-text-2">{comp.unit_of_measure || t("manufacturing.pcs")}</td>
                            <td className="px-4 py-2 text-center">
                              {comp.is_critical && <span className="text-red-600 font-bold text-xs">{"⚠"}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Operations / Routing */}
                    {bom.operations && bom.operations.length > 0 && (
                      <div className="border-t border-th-border">
                        <div className="px-4 py-2 bg-th-bg-3/50">
                          <span className="text-[10px] font-bold text-th-text-2 uppercase tracking-wider">
                            {"⚙️"} Operations / Machines ({bom.operations.length})
                          </span>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-th-bg-3/30 text-th-text-2 text-xs uppercase">
                              <th className="text-left px-4 py-2">#</th>
                              <th className="text-left px-4 py-2">Operation</th>
                              <th className="text-left px-4 py-2">Machine</th>
                              <th className="text-right px-4 py-2">Cycle Time</th>
                              <th className="text-left px-4 py-2">Basis</th>
                              <th className="text-right px-4 py-2">Labor (min)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-th-border/50">
                            {bom.operations.sort((a, b) => a.sequence - b.sequence).map((op) => {
                              const wc = workCenters.find(w => w.id === op.work_center_id);
                              return (
                                <tr key={op.id}>
                                  <td className="px-4 py-2 text-th-text-3 font-mono text-xs">{op.sequence}</td>
                                  <td className="px-4 py-2 text-th-text font-medium">{op.operation_name}</td>
                                  <td className="px-4 py-2 text-brand-600 dark:text-brand-400 text-xs">{wc ? wc.name : "—"}</td>
                                  <td className="px-4 py-2 text-right font-mono text-th-text">{op.cycle_time_seconds}s</td>
                                  <td className="px-4 py-2 text-th-text-2 text-xs">{op.cycle_time_basis === "per_100" ? "/100 pcs" : "/pc"}</td>
                                  <td className="px-4 py-2 text-right text-th-text-2">{op.labor_minutes ?? "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {bom.notes && (
                      <p className="px-4 py-2 text-xs text-th-text-3 border-t border-th-border/50">Notes: {bom.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create BOM Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-th-bg rounded-2xl shadow-xl border border-th-border w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-th-border">
              <h3 className="font-bold text-th-text text-lg">{t("manufacturing.titleBOM")}</h3>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.product")} *</label>
                  <select
                    value={form.product_id}
                    onChange={(e) => setForm({ ...form, product_id: Number(e.target.value) })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  >
                    <option value={0}>{t("manufacturing.selectProduct")}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.productionLine")} *</label>
                  <select
                    value={form.production_line_id}
                    onChange={(e) => setForm({ ...form, production_line_id: Number(e.target.value) })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  >
                    <option value={0}>{t("manufacturing.selectLine")}</option>
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.cycleTimeSec")} *</label>
                  <input
                    type="number"
                    value={form.ideal_cycle_time_sec}
                    onChange={(e) => setForm({ ...form, ideal_cycle_time_sec: Number(e.target.value) })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.batchSize")}</label>
                  <input
                    type="number"
                    value={form.batch_size}
                    onChange={(e) => setForm({ ...form, batch_size: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                    placeholder={t("manufacturing.optional")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">Notes</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                    placeholder={t("manufacturing.optional")}
                  />
                </div>
              </div>

              {/* Materials */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-th-text-2">{t("manufacturing.materials")} ({form.components.length})</label>
                  <button onClick={addComponent} className="text-xs text-brand-600 hover:text-brand-700 font-semibold">
                    {t("manufacturing.addMaterial")}
                  </button>
                </div>
                <div className="space-y-2">
                  {form.components.map((comp, i) => (
                    <div key={i} className="border border-th-border rounded-lg p-3 bg-th-bg-3/50">
                      <div className="flex gap-2 items-start">
                        <span className="text-xs text-th-text-3 font-mono mt-2">#{i + 1}</span>
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={comp.material_code}
                              onChange={(e) => updateComponent(i, "material_code", e.target.value)}
                              placeholder={t("manufacturing.materialCode")}
                              className="border border-th-border rounded px-2 py-1 text-sm bg-th-bg text-th-text"
                            />
                            <input
                              type="text"
                              value={comp.material_name}
                              onChange={(e) => updateComponent(i, "material_name", e.target.value)}
                              placeholder={t("manufacturing.materialName") + " *"}
                              className="border border-th-border rounded px-2 py-1 text-sm bg-th-bg text-th-text"
                            />
                          </div>
                          <div className="flex gap-2 items-center flex-wrap">
                            <input
                              type="number"
                              step="any"
                              value={comp.quantity_per_unit}
                              onChange={(e) => updateComponent(i, "quantity_per_unit", e.target.value)}
                              placeholder={t("manufacturing.qtyPerUnit") + " *"}
                              className="w-24 border border-th-border rounded px-2 py-1 text-sm bg-th-bg text-th-text"
                            />
                            <select
                              value={comp.unit_of_measure}
                              onChange={(e) => updateComponent(i, "unit_of_measure", e.target.value)}
                              className="border border-th-border rounded px-2 py-1 text-xs bg-th-bg text-th-text"
                            >
                              <option value="pcs">{t("manufacturing.pcs")}</option>
                              <option value="kg">{t("manufacturing.kg")}</option>
                              <option value="liters">{t("manufacturing.liters")}</option>
                              <option value="meters">{t("manufacturing.meters")}</option>
                            </select>
                            <label className="flex items-center gap-1 text-xs text-th-text-2">
                              <input
                                type="checkbox"
                                checked={comp.is_critical}
                                onChange={(e) => updateComponent(i, "is_critical", e.target.checked)}
                                className="rounded"
                              />
                              {t("manufacturing.critical")}
                            </label>
                            <button onClick={() => removeComponent(i)} className="text-red-500 text-xs hover:text-red-700 ml-auto">{"🗑"}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {form.components.length === 0 && (
                    <p className="text-center text-th-text-3 text-xs py-4">{t("manufacturing.addMaterialsHint")}</p>
                  )}
                </div>
              </div>

              {/* Operations / Machines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-th-text-2">{"⚙️"} Operations / Machines ({form.operations.length})</label>
                  <button onClick={addOperation} className="text-xs text-brand-600 hover:text-brand-700 font-semibold">
                    + Add Operation
                  </button>
                </div>
                <div className="space-y-2">
                  {form.operations.map((op, i) => (
                    <div key={i} className="border border-th-border rounded-lg p-3 bg-th-bg-3/50">
                      <div className="flex gap-2 items-start">
                        <span className="text-xs text-th-text-3 font-mono mt-2">#{i + 1}</span>
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={op.operation_name}
                              onChange={(e) => updateOperation(i, "operation_name", e.target.value)}
                              placeholder="Operation name *"
                              className="border border-th-border rounded px-2 py-1 text-sm bg-th-bg text-th-text"
                            />
                            <select
                              value={op.work_center_id}
                              onChange={(e) => updateOperation(i, "work_center_id", e.target.value)}
                              className="border border-th-border rounded px-2 py-1 text-sm bg-th-bg text-th-text"
                            >
                              <option value="">Select machine...</option>
                              {workCenters
                                .filter(wc => !form.production_line_id || wc.production_line_id === form.production_line_id)
                                .map((wc) => (
                                  <option key={wc.id} value={wc.id}>
                                    {wc.name}{wc.machine_type ? ` (${wc.machine_type})` : ""}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="flex gap-2 items-center flex-wrap">
                            <input
                              type="number"
                              step="any"
                              value={op.cycle_time_seconds}
                              onChange={(e) => updateOperation(i, "cycle_time_seconds", e.target.value)}
                              placeholder="Cycle time (sec) *"
                              className="w-32 border border-th-border rounded px-2 py-1 text-sm bg-th-bg text-th-text"
                            />
                            <select
                              value={op.cycle_time_basis}
                              onChange={(e) => updateOperation(i, "cycle_time_basis", e.target.value)}
                              className="border border-th-border rounded px-2 py-1 text-xs bg-th-bg text-th-text"
                            >
                              <option value="per_piece">per 1 pc</option>
                              <option value="per_100">per 100 pcs</option>
                            </select>
                            <input
                              type="number"
                              step="any"
                              value={op.labor_minutes}
                              onChange={(e) => updateOperation(i, "labor_minutes", e.target.value)}
                              placeholder="Labor (min)"
                              className="w-28 border border-th-border rounded px-2 py-1 text-sm bg-th-bg text-th-text"
                            />
                            <button onClick={() => removeOperation(i)} className="text-red-500 text-xs hover:text-red-700 ml-auto">{"🗑"}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {form.operations.length === 0 && (
                    <p className="text-center text-th-text-3 text-xs py-4">Add operations to define machines and cycle times for this BOM</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-th-border flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.product_id || !form.production_line_id || (form.components.length === 0 && form.operations.length === 0) || submitting}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold flex items-center gap-1.5"
              >
                {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {submitting ? t("manufacturing.creating") : t("manufacturing.createBom")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
