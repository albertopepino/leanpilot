"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { fmeaApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import type { FMEAAnalysisData, FMEAItemData } from "@/lib/types";
import {
  Plus, Trash2, ChevronLeft, Loader2, AlertTriangle,
  Save, X, Edit3, Shield, FileSpreadsheet,
} from "lucide-react";
import ToolInfoCard from "@/components/ui/ToolInfoCard";
import { TOOL_INFO } from "@/lib/toolInfo";

/* ── Helpers ── */
const rpnColor = (rpn: number) => {
  if (rpn >= 200) return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (rpn >= 100) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (rpn >= 50) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
  return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
};

const rpnLabel = (rpn: number, t: (k: string) => string) => {
  if (rpn >= 200) return t("fmea.critical") || "Critical";
  if (rpn >= 100) return t("fmea.high") || "High";
  if (rpn >= 50) return t("fmea.medium") || "Medium";
  return t("fmea.low") || "Low";
};

const calcRPN = (s: number, o: number, d: number) => s * o * d;

const FMEA_TYPES = ["process", "design", "system"] as const;
const STATUS_OPTIONS = ["draft", "in_progress", "review", "completed"] as const;
const ITEM_STATUSES = ["open", "in_progress", "completed", "verified"] as const;

const emptyItem = (): FMEAItemData => ({
  process_step: "",
  failure_mode: "",
  failure_effect: "",
  failure_cause: "",
  severity: 5,
  occurrence: 5,
  detection: 5,
  current_controls: "",
  recommended_action: "",
  responsible: "",
  target_date: "",
  status: "open",
});

/* ────────────────────────────────────────────────────────────── */
/*  FMEASummary                                                    */
/* ────────────────────────────────────────────────────────────── */
function FMEASummary({ items, t }: { items: FMEAItemData[]; t: (k: string) => string }) {
  const total = items.length;
  const criticalCount = items.filter((i) => calcRPN(i.severity, i.occurrence, i.detection) >= 200).length;
  const avgRPN = total > 0 ? Math.round(items.reduce((s, i) => s + calcRPN(i.severity, i.occurrence, i.detection), 0) / total) : 0;
  const completedCount = items.filter((i) => i.status === "completed" || i.status === "verified").length;
  const completionPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const cards = [
    { label: t("fmea.totalItems") || "Total Items", value: total, color: "text-th-text" },
    { label: t("fmea.criticalRPNs") || "Critical RPNs (>=200)", value: criticalCount, color: "text-red-600" },
    { label: t("fmea.avgRPN") || "Average RPN", value: avgRPN, color: "text-amber-600" },
    { label: t("fmea.completion") || "Completion %", value: `${completionPct}%`, color: "text-green-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 text-center">
          <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          <div className="text-xs text-th-text-3 mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  FMEAItemRow                                                    */
/* ────────────────────────────────────────────────────────────── */
function FMEAItemRow({
  item, index, editing, onEdit, onSave, onCancel, onChange, onDelete, t,
}: {
  item: FMEAItemData;
  index: number;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onChange: (field: string, value: string | number) => void;
  onDelete: () => void;
  t: (k: string) => string;
}) {
  const rpn = calcRPN(item.severity, item.occurrence, item.detection);
  const newRpn = item.new_severity && item.new_occurrence && item.new_detection
    ? calcRPN(item.new_severity, item.new_occurrence, item.new_detection) : null;
  const cls = "px-2 py-1.5 text-xs border-b border-th-border";
  const inputCls = "w-full px-1.5 py-1 rounded border border-th-border bg-th-bg text-th-text text-xs";
  const numInput = "w-12 px-1 py-1 rounded border border-th-border bg-th-bg text-th-text text-xs text-center";

  if (editing) {
    return (
      <tr className="bg-th-bg-3/30">
        <td className={cls}>{index + 1}</td>
        <td className={cls}><input className={inputCls} value={item.process_step || ""} onChange={(e) => onChange("process_step", e.target.value)} /></td>
        <td className={cls}><input className={inputCls} value={item.failure_mode} onChange={(e) => onChange("failure_mode", e.target.value)} /></td>
        <td className={cls}><input className={inputCls} value={item.failure_effect || ""} onChange={(e) => onChange("failure_effect", e.target.value)} /></td>
        <td className={cls}><input className={inputCls} value={item.failure_cause || ""} onChange={(e) => onChange("failure_cause", e.target.value)} /></td>
        <td className={cls}><input type="number" min={1} max={10} className={numInput} value={item.severity} onChange={(e) => onChange("severity", Math.min(10, Math.max(1, +e.target.value)))} /></td>
        <td className={cls}><input type="number" min={1} max={10} className={numInput} value={item.occurrence} onChange={(e) => onChange("occurrence", Math.min(10, Math.max(1, +e.target.value)))} /></td>
        <td className={cls}><input type="number" min={1} max={10} className={numInput} value={item.detection} onChange={(e) => onChange("detection", Math.min(10, Math.max(1, +e.target.value)))} /></td>
        <td className={cls}><span className={`px-2 py-0.5 rounded text-xs font-semibold ${rpnColor(rpn)}`}>{rpn}</span></td>
        <td className={cls}><input className={inputCls} value={item.current_controls || ""} onChange={(e) => onChange("current_controls", e.target.value)} /></td>
        <td className={cls}><input className={inputCls} value={item.recommended_action || ""} onChange={(e) => onChange("recommended_action", e.target.value)} /></td>
        <td className={cls}><input className={inputCls} value={item.responsible || ""} onChange={(e) => onChange("responsible", e.target.value)} /></td>
        <td className={cls}><input type="date" className={inputCls} value={item.target_date || ""} onChange={(e) => onChange("target_date", e.target.value)} /></td>
        <td className={cls}>
          <select className={inputCls} value={item.status || "open"} onChange={(e) => onChange("status", e.target.value)}>
            {ITEM_STATUSES.map((s) => <option key={s} value={s}>{t(`fmea.status_${s}`) || s}</option>)}
          </select>
        </td>
        <td className={`${cls} flex gap-1`}>
          <button onClick={onSave} className="p-1 rounded bg-green-600 text-white hover:bg-green-700"><Save className="w-3.5 h-3.5" /></button>
          <button onClick={onCancel} className="p-1 rounded bg-gray-400 text-white hover:bg-gray-500"><X className="w-3.5 h-3.5" /></button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-th-bg-3/20 transition">
      <td className={cls}>{index + 1}</td>
      <td className={cls}>{item.process_step || "—"}</td>
      <td className={`${cls} font-medium`}>{item.failure_mode}</td>
      <td className={cls}>{item.failure_effect || "—"}</td>
      <td className={cls}>{item.failure_cause || "—"}</td>
      <td className={`${cls} text-center`}>{item.severity}</td>
      <td className={`${cls} text-center`}>{item.occurrence}</td>
      <td className={`${cls} text-center`}>{item.detection}</td>
      <td className={cls}><span className={`px-2 py-0.5 rounded text-xs font-semibold ${rpnColor(rpn)}`}>{rpn}</span></td>
      <td className={cls}>{item.current_controls || "—"}</td>
      <td className={cls}>{item.recommended_action || "—"}</td>
      <td className={cls}>{item.responsible || "—"}</td>
      <td className={cls}>{item.target_date || "—"}</td>
      <td className={cls}>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
          item.status === "completed" || item.status === "verified" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
            : item.status === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
        }`}>{t(`fmea.status_${item.status}`) || item.status}</span>
      </td>
      <td className={`${cls} flex gap-1`}>
        <button onClick={onEdit} className="p-1 rounded hover:bg-th-bg-3"><Edit3 className="w-3.5 h-3.5 text-th-text-2" /></button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
      </td>
    </tr>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  FMEATable                                                      */
/* ────────────────────────────────────────────────────────────── */
function FMEATable({
  items, setItems, analysisId, onRefresh, t,
}: {
  items: FMEAItemData[];
  setItems: (items: FMEAItemData[]) => void;
  analysisId: number;
  onRefresh: () => void;
  t: (k: string) => string;
}) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState<FMEAItemData | null>(null);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState<FMEAItemData>(emptyItem());

  const headers = [
    "#", t("fmea.processStep") || "Process Step", t("fmea.failureMode") || "Failure Mode",
    t("fmea.effect") || "Effect", t("fmea.cause") || "Cause",
    "S", "O", "D", "RPN",
    t("fmea.controls") || "Controls", t("fmea.action") || "Recommended Action",
    t("fmea.responsible") || "Responsible", t("fmea.targetDate") || "Target Date",
    t("fmea.itemStatus") || "Status", "",
  ];

  const handleSave = async (item: FMEAItemData, idx: number) => {
    try {
      if (item.id) {
        await fmeaApi.updateItem(analysisId, item.id, item);
      }
      const updated = [...items];
      updated[idx] = { ...item, rpn: calcRPN(item.severity, item.occurrence, item.detection) };
      setItems(updated);
      setEditIdx(null);
      setEditBuf(null);
    } catch { /* ignore */ }
  };

  const handleAdd = async () => {
    try {
      const payload = { ...newItem, rpn: calcRPN(newItem.severity, newItem.occurrence, newItem.detection) };
      await fmeaApi.addItem(analysisId, payload);
      setAdding(false);
      setNewItem(emptyItem());
      onRefresh();
    } catch { /* ignore */ }
  };

  const handleDelete = async (item: FMEAItemData, idx: number) => {
    if (!confirm(t("fmea.confirmDelete") || "Delete this failure mode?")) return;
    try {
      if (item.id) await fmeaApi.deleteItem(analysisId, item.id);
      setItems(items.filter((_, i) => i !== idx));
    } catch { /* ignore */ }
  };

  return (
    <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-th-border">
        <h3 className="text-sm font-semibold text-th-text">{t("fmea.worksheet") || "FMEA Worksheet"}</h3>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition">
          <Plus className="w-3.5 h-3.5" />{t("fmea.addItem") || "Add Failure Mode"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-th-bg-3/50">
              {headers.map((h, i) => (
                <th key={i} className="px-2 py-2 text-left text-[11px] font-semibold text-th-text-2 uppercase tracking-wider whitespace-nowrap border-b border-th-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <FMEAItemRow
                key={item.id ?? idx}
                item={editIdx === idx && editBuf ? editBuf : item}
                index={idx}
                editing={editIdx === idx}
                onEdit={() => { setEditIdx(idx); setEditBuf({ ...item }); }}
                onSave={() => editBuf && handleSave(editBuf, idx)}
                onCancel={() => { setEditIdx(null); setEditBuf(null); }}
                onChange={(f, v) => editBuf && setEditBuf({ ...editBuf, [f]: v })}
                onDelete={() => handleDelete(item, idx)}
                t={t}
              />
            ))}
            {adding && (
              <FMEAItemRow
                item={newItem}
                index={items.length}
                editing
                onEdit={() => {}}
                onSave={handleAdd}
                onCancel={() => { setAdding(false); setNewItem(emptyItem()); }}
                onChange={(f, v) => setNewItem({ ...newItem, [f]: v })}
                onDelete={() => setAdding(false)}
                t={t}
              />
            )}
            {items.length === 0 && !adding && (
              <tr><td colSpan={15} className="px-4 py-8 text-center text-th-text-3 text-sm">{t("fmea.noItems") || "No failure modes yet. Click 'Add Failure Mode' to start."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  FMEAHeader                                                     */
/* ────────────────────────────────────────────────────────────── */
function FMEAHeader({
  analysis, onChange, onSave, saving, t,
}: {
  analysis: FMEAAnalysisData;
  onChange: (field: string, value: string) => void;
  onSave: () => void;
  saving: boolean;
  t: (k: string) => string;
}) {
  const inputCls = "w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm";
  return (
    <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-th-text">{t("fmea.analysisDetails") || "Analysis Details"}</h3>
        <button onClick={onSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t("common.save") || "Save"}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-th-text-2 mb-1">{t("fmea.title") || "Title"}</label>
          <input className={inputCls} value={analysis.title} onChange={(e) => onChange("title", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-th-text-2 mb-1">{t("fmea.type") || "FMEA Type"}</label>
          <select className={inputCls} value={analysis.fmea_type} onChange={(e) => onChange("fmea_type", e.target.value)}>
            {FMEA_TYPES.map((ft) => <option key={ft} value={ft}>{t(`fmea.type_${ft}`) || ft.charAt(0).toUpperCase() + ft.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-th-text-2 mb-1">{t("fmea.status") || "Status"}</label>
          <select className={inputCls} value={analysis.status || "draft"} onChange={(e) => onChange("status", e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{t(`fmea.status_${s}`) || s.replace("_", " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-th-text-2 mb-1">{t("fmea.productName") || "Product"}</label>
          <input className={inputCls} value={analysis.product_name || ""} onChange={(e) => onChange("product_name", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-th-text-2 mb-1">{t("fmea.processName") || "Process"}</label>
          <input className={inputCls} value={analysis.process_name || ""} onChange={(e) => onChange("process_name", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-th-text-2 mb-1">{t("fmea.teamMembers") || "Team Members"}</label>
          <input className={inputCls} value={analysis.team_members || ""} onChange={(e) => onChange("team_members", e.target.value)} placeholder={t("fmea.teamPlaceholder") || "Comma-separated names"} />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  FMEACreateModal                                                */
/* ────────────────────────────────────────────────────────────── */
function FMEACreateModal({ onClose, onCreated, t }: { onClose: () => void; onCreated: (a: FMEAAnalysisData) => void; t: (k: string) => string }) {
  const [form, setForm] = useState({ title: "", fmea_type: "process" as string, product_name: "", process_name: "", team_members: "" });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fmeaApi.create({ ...form, items: [] });
      onCreated(res.data);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-th-bg rounded-xl shadow-xl border border-th-border w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-th-text mb-4">{t("fmea.createNew") || "New FMEA Analysis"}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-th-text-2 mb-1">{t("fmea.title") || "Title"} *</label>
            <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("fmea.titlePlaceholder") || "e.g. Engine Assembly PFMEA"} />
          </div>
          <div>
            <label className="block text-xs font-medium text-th-text-2 mb-1">{t("fmea.type") || "FMEA Type"}</label>
            <select className={inputCls} value={form.fmea_type} onChange={(e) => setForm({ ...form, fmea_type: e.target.value })}>
              {FMEA_TYPES.map((ft) => <option key={ft} value={ft}>{t(`fmea.type_${ft}`) || ft.charAt(0).toUpperCase() + ft.slice(1)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-th-text-2 mb-1">{t("fmea.productName") || "Product"}</label>
              <input className={inputCls} value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-th-text-2 mb-1">{t("fmea.processName") || "Process"}</label>
              <input className={inputCls} value={form.process_name} onChange={(e) => setForm({ ...form, process_name: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-th-text-2 mb-1">{t("fmea.teamMembers") || "Team Members"}</label>
            <input className={inputCls} value={form.team_members} onChange={(e) => setForm({ ...form, team_members: e.target.value })} placeholder={t("fmea.teamPlaceholder") || "Comma-separated names"} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-th-border text-th-text-2 text-sm hover:bg-th-bg-3 transition">{t("common.cancel") || "Cancel"}</button>
          <button onClick={handleCreate} disabled={saving || !form.title.trim()} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.create") || "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  FMEADetail                                                     */
/* ────────────────────────────────────────────────────────────── */
function FMEADetail({ id, onBack, t }: { id: number; onBack: () => void; t: (k: string) => string }) {
  const [analysis, setAnalysis] = useState<FMEAAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { printView, exportToExcel, exportToCSV, exportToPDF } = useExport();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fmeaApi.get(id);
      setAnalysis(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleHeaderSave = async () => {
    if (!analysis) return;
    setSaving(true);
    try {
      const { items, ...header } = analysis;
      await fmeaApi.update(id, header);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleExportExcel = () => {
    if (!analysis) return;
    const cols = [
      { key: "process_step", header: t("fmea.processStep") || "Process Step", width: 18 },
      { key: "failure_mode", header: t("fmea.failureMode") || "Failure Mode", width: 22 },
      { key: "failure_effect", header: t("fmea.effect") || "Effect", width: 20 },
      { key: "failure_cause", header: t("fmea.cause") || "Cause", width: 20 },
      { key: "severity", header: "S", width: 5 },
      { key: "occurrence", header: "O", width: 5 },
      { key: "detection", header: "D", width: 5 },
      { key: "rpn", header: "RPN", width: 6 },
      { key: "current_controls", header: t("fmea.controls") || "Controls", width: 20 },
      { key: "recommended_action", header: t("fmea.action") || "Action", width: 22 },
      { key: "responsible", header: t("fmea.responsible") || "Responsible", width: 14 },
      { key: "target_date", header: t("fmea.targetDate") || "Target Date", width: 12 },
      { key: "status", header: t("fmea.itemStatus") || "Status", width: 12 },
    ];
    const rows = analysis.items.map((i) => ({
      ...i,
      rpn: calcRPN(i.severity, i.occurrence, i.detection),
    }));
    exportToExcel({ title: `FMEA_${analysis.title}`, columns: cols, rows });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  if (!analysis) return <div className="text-center py-20 text-th-text-3">{t("fmea.notFound") || "FMEA not found"}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-th-text-2 hover:text-th-text transition">
          <ChevronLeft className="w-4 h-4" />{t("common.back") || "Back"}
        </button>
        <ExportToolbar
          onPrint={() => printView({ title: `FMEA: ${analysis.title}`, orientation: "landscape" })}
          onExportExcel={handleExportExcel}
          onExportCSV={() => {
            const cols = ["Process Step", "Failure Mode", "Effect", "Cause", "S", "O", "D", "RPN", "Controls", "Action", "Responsible", "Target Date", "Status"];
            const rows = analysis.items.map((i) => [
              i.process_step || "", i.failure_mode, i.failure_effect || "", i.failure_cause || "",
              String(i.severity), String(i.occurrence), String(i.detection), String(calcRPN(i.severity, i.occurrence, i.detection)),
              i.current_controls || "", i.recommended_action || "", i.responsible || "", i.target_date || "", i.status || "",
            ]);
            exportToCSV({ title: `FMEA_${analysis.title}`, columns: cols, rows });
          }}
          onExportPDF={() => exportToPDF({ title: `FMEA: ${analysis.title}`, orientation: "landscape" })}
        />
      </div>
      <div data-print-area>
        <FMEAHeader analysis={analysis} onChange={(f, v) => setAnalysis({ ...analysis, [f]: v })} onSave={handleHeaderSave} saving={saving} t={t} />
        <div className="mt-5">
          <FMEASummary items={analysis.items} t={t} />
        </div>
        <div className="mt-5">
          <FMEATable
            items={analysis.items}
            setItems={(items) => setAnalysis({ ...analysis, items })}
            analysisId={id}
            onRefresh={load}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  FMEAList                                                       */
/* ────────────────────────────────────────────────────────────── */
function FMEAList({ onSelect, onCreate, t }: { onSelect: (id: number) => void; onCreate: () => void; t: (k: string) => string }) {
  const [analyses, setAnalyses] = useState<FMEAAnalysisData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fmeaApi.list({ limit: 100 });
        setAnalyses(Array.isArray(res.data) ? res.data : res.data?.items ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm(t("fmea.confirmDeleteAnalysis") || "Delete this FMEA analysis?")) return;
    try {
      await fmeaApi.delete(id);
      setAnalyses(analyses.filter((a) => a.id !== id));
    } catch { /* ignore */ }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-th-text">{t("fmea.pageTitle") || "FMEA — Failure Mode & Effects Analysis"}</h2>
          <p className="text-sm text-th-text-3 mt-1">{t("fmea.pageSubtitle") || "AIAG/VDA compliant risk analysis for process, design, and system FMEAs"}</p>
        </div>
        <button onClick={onCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition">
          <Plus className="w-4 h-4" />{t("fmea.newAnalysis") || "New FMEA"}
        </button>
      </div>

      {analyses.length === 0 ? (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 text-th-text-3 mx-auto mb-3" />
          <p className="text-th-text-2 font-medium">{t("fmea.empty") || "No FMEA analyses yet"}</p>
          <p className="text-sm text-th-text-3 mt-1">{t("fmea.emptyHint") || "Create your first FMEA to start assessing risks."}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {analyses.map((a) => {
            const items = a.items || [];
            const maxRPN = items.length > 0 ? Math.max(...items.map((i) => calcRPN(i.severity, i.occurrence, i.detection))) : 0;
            const critCount = items.filter((i) => calcRPN(i.severity, i.occurrence, i.detection) >= 200).length;
            return (
              <div key={a.id} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 hover:border-brand-600/40 transition cursor-pointer" onClick={() => a.id && onSelect(a.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-brand-600" />
                      <h3 className="text-base font-semibold text-th-text">{a.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-th-bg-3 text-th-text-2 uppercase">{t(`fmea.type_${a.fmea_type}`) || a.fmea_type}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        a.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : a.status === "review" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                          : a.status === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      }`}>{t(`fmea.status_${a.status}`) || a.status || "draft"}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-th-text-3">
                      {a.product_name && <span>{t("fmea.productName") || "Product"}: {a.product_name}</span>}
                      {a.process_name && <span>{t("fmea.processName") || "Process"}: {a.process_name}</span>}
                      <span>{t("fmea.itemCount") || "Items"}: {items.length}</span>
                      {maxRPN > 0 && (
                        <span className="flex items-center gap-1">
                          {t("fmea.highestRPN") || "Highest RPN"}: <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${rpnColor(maxRPN)}`}>{maxRPN} ({rpnLabel(maxRPN, t)})</span>
                        </span>
                      )}
                      {critCount > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="w-3 h-3" />{critCount} {t("fmea.critical") || "critical"}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); a.id && handleDelete(a.id); }} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  FMEABoard (main export)                                        */
/* ────────────────────────────────────────────────────────────── */
export default function FMEABoard() {
  const { t } = useI18n();
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-5">
      <ToolInfoCard info={TOOL_INFO.fmea} />
      {view === "list" && (
        <FMEAList
          onSelect={(id) => { setSelectedId(id); setView("detail"); }}
          onCreate={() => setShowCreate(true)}
          t={t}
        />
      )}
      {view === "detail" && selectedId && (
        <FMEADetail
          id={selectedId}
          onBack={() => { setView("list"); setSelectedId(null); }}
          t={t}
        />
      )}
      {showCreate && (
        <FMEACreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(a) => {
            setShowCreate(false);
            if (a.id) { setSelectedId(a.id); setView("detail"); }
          }}
          t={t}
        />
      )}
    </div>
  );
}
