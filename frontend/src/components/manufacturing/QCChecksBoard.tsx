"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { qcApi, adminApi } from "@/lib/api";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  FlaskConical,
  CheckCircle,
  XCircle,
  Clipboard,
  Search,
  Settings,
  ClipboardCheck,
  Play,
  Siren,
  Lock,
  Trash2,
  X,
  Check,
  Minus,
} from "lucide-react";

interface TemplateItem {
  id: number;
  item_order: number;
  category: string | null;
  check_type: string;
  description: string;
  specification: string | null;
  lower_limit: number | null;
  upper_limit: number | null;
  unit: string | null;
  is_critical: boolean;
  is_mandatory: boolean;
}

interface Template {
  id: number;
  name: string;
  template_type: string;
  version: string;
  is_active: boolean;
  estimated_time_min: number | null;
  description: string | null;
  pass_threshold_pct: number;
  critical_items_must_pass: boolean;
  items: TemplateItem[];
  created_at: string;
}

interface CheckResult {
  id: number;
  template_item_id: number;
  result: string;
  measured_value: number | null;
  text_value: string | null;
  notes: string | null;
}

interface QCRecord {
  id: number;
  template_id: number;
  production_order_id: number | null;
  production_line_id: number;
  check_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  overall_score_pct: number | null;
  andon_triggered: boolean;
  hold_placed: boolean;
  notes: string | null;
  results: CheckResult[];
  created_at: string;
}

interface Line { id: number; name: string; }

const STATUS_COLORS: Record<string, string> = {
  in_progress: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300",
  passed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  passed_with_deviations: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  voided: "bg-th-bg-3 text-th-text-3",
};

export default function QCChecksBoard() {
  const { t } = useI18n();

  const CHECK_TYPES = [
    { value: "line_clearance", label: t("manufacturing.checkTypeLine"), icon: <FlaskConical className="w-3.5 h-3.5 inline" /> },
    { value: "fga", label: t("manufacturing.checkTypeFGA"), icon: <Search className="w-3.5 h-3.5 inline" /> },
    { value: "pre_production_audit", label: t("manufacturing.checkTypePreProd"), icon: <Clipboard className="w-3.5 h-3.5 inline" /> },
    { value: "in_process", label: t("manufacturing.checkTypeInProcess"), icon: <Settings className="w-3.5 h-3.5 inline" /> },
    { value: "final_inspection", label: t("manufacturing.checkTypeFinal"), icon: <ClipboardCheck className="w-3.5 h-3.5 inline" /> },
  ];

  const STATUS_LABELS: Record<string, string> = {
    in_progress: t("manufacturing.statusInProgressQC"),
    passed: t("manufacturing.statusPassed"),
    passed_with_deviations: t("manufacturing.statusPassedDev"),
    failed: t("manufacturing.statusFailed"),
    voided: t("manufacturing.statusVoided"),
  };

  const [records, setRecords] = useState<QCRecord[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // New check modal
  const [showNewCheck, setShowNewCheck] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<number>(0);

  // Execution modal
  const [activeRecord, setActiveRecord] = useState<QCRecord | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [checkResults, setCheckResults] = useState<Record<number, { result: string; measured_value?: number; text_value?: string; notes?: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  // Confirm dialog
  const [confirmVoidRecord, setConfirmVoidRecord] = useState<QCRecord | null>(null);

  // Template management
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    template_type: "line_clearance",
    description: "",
    pass_threshold_pct: 100,
    critical_items_must_pass: true,
    items: [] as { description: string; check_type: string; is_critical: boolean; specification: string; category: string }[],
  });

  const fetchData = useCallback(async () => {
    try {
      const [recRes, tplRes] = await Promise.all([
        qcApi.listRecords({ check_type: filterType || undefined, line_id: undefined }),
        qcApi.listTemplates({}),
      ]);
      setRecords(recRes.data ?? recRes);
      setTemplates((tplRes.data ?? tplRes).filter((t: Template) => t.is_active));

      // Load production lines separately — requires admin role, so gracefully handle failure
      try {
        const factRes = await adminApi.getFactory();
        const factory = factRes.data ?? factRes;
        setLines(factory?.production_lines || []);
      } catch {
        // Non-admin users won't have access to factory endpoint — lines dropdown will be empty
        // but QC records and templates still load fine
        setLines([]);
      }
    } catch {
      setError(t("manufacturing.failedLoadQC"));
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStartCheck = async () => {
    if (!selectedTemplate || !selectedLineId) return;
    try {
      const res = await qcApi.startCheck({
        template_id: selectedTemplate.id,
        production_line_id: selectedLineId,
        check_type: selectedTemplate.template_type,
      });
      const record = res.data ?? res;
      setShowNewCheck(false);
      setSelectedTemplate(null);
      setSelectedLineId(0);
      setSuccess(t("manufacturing.qcCheckStarted"));
      await fetchData();
      // Open the execution modal
      openExecution(record, selectedTemplate);
    } catch {
      setError(t("manufacturing.failedStartCheck"));
    }
  };

  const openExecution = async (record: QCRecord, template?: Template) => {
    let tpl = template;
    if (!tpl) {
      try {
        const res = await qcApi.getTemplate(record.template_id);
        tpl = res.data ?? res;
      } catch {
        setError(t("manufacturing.failedLoadTemplate"));
        return;
      }
    }
    setActiveRecord(record);
    setActiveTemplate(tpl!);
    // Pre-fill existing results
    const existing: Record<number, { result: string; measured_value?: number; text_value?: string; notes?: string }> = {};
    record.results?.forEach((r) => {
      existing[r.template_item_id] = {
        result: r.result,
        measured_value: r.measured_value ?? undefined,
        text_value: r.text_value ?? undefined,
        notes: r.notes ?? undefined,
      };
    });
    setCheckResults(existing);
  };

  const handleSubmitResults = async () => {
    if (!activeRecord || !activeTemplate) return;
    setSubmitting(true);
    try {
      const results = activeTemplate.items.map((item) => ({
        template_item_id: item.id,
        result: checkResults[item.id]?.result || "skipped",
        measured_value: checkResults[item.id]?.measured_value || null,
        text_value: checkResults[item.id]?.text_value || null,
        notes: checkResults[item.id]?.notes || null,
      }));
      await qcApi.submitResults(activeRecord.id, results);
      await qcApi.completeCheck(activeRecord.id);
      setSuccess(t("manufacturing.qcCheckCompleted"));
      setActiveRecord(null);
      setActiveTemplate(null);
      setCheckResults({});
      await fetchData();
    } catch {
      setError(t("manufacturing.failedSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoid = async (record: QCRecord) => {
    try {
      await qcApi.voidRecord(record.id);
      await fetchData();
    } catch {
      setError(t("manufacturing.failedVoid"));
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateForm.name.trim() || templateForm.items.length === 0) return;
    try {
      await qcApi.createTemplate({
        name: templateForm.name,
        template_type: templateForm.template_type,
        description: templateForm.description || null,
        pass_threshold_pct: templateForm.pass_threshold_pct,
        critical_items_must_pass: templateForm.critical_items_must_pass,
        items: templateForm.items.map((item, i) => ({
          item_order: i + 1,
          description: item.description,
          check_type: item.check_type,
          is_critical: item.is_critical,
          specification: item.specification || null,
          category: item.category || null,
          is_mandatory: true,
        })),
      });
      setSuccess(t("manufacturing.templateCreated"));
      setShowTemplateForm(false);
      setTemplateForm({
        name: "", template_type: "line_clearance", description: "",
        pass_threshold_pct: 100, critical_items_must_pass: true, items: [],
      });
      await fetchData();
    } catch {
      setError(t("manufacturing.failedCreateTemplate"));
    }
  };

  const addTemplateItem = () => {
    setTemplateForm({
      ...templateForm,
      items: [...templateForm.items, { description: "", check_type: "checkbox", is_critical: false, specification: "", category: "" }],
    });
  };

  const updateTemplateItem = (index: number, field: keyof (typeof templateForm.items)[number], value: string | boolean) => {
    const items = [...templateForm.items];
    items[index] = { ...items[index], [field]: value };
    setTemplateForm({ ...templateForm, items });
  };

  const removeTemplateItem = (index: number) => {
    setTemplateForm({ ...templateForm, items: templateForm.items.filter((_, i) => i !== index) });
  };

  const filteredRecords = records.filter((r) => {
    if (filterType && r.check_type !== filterType) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  const templateMap = new Map<number, string>(templates.map((t) => [t.id, t.name]));
  const lineMap = new Map<number, string>(lines.map((l) => [l.id, l.name]));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6" id="qc-checks-view">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-th-text">{t("manufacturing.titleQCChecks")}</h2>
          <p className="text-sm text-th-text-3 mt-1">
            {records.length !== 1
              ? t("manufacturing.checksRecorded", { count: records.length })
              : t("manufacturing.checksRecordedSingular", { count: records.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplateForm(true)}
            className="px-4 py-2 bg-th-bg-3 hover:bg-th-hover text-th-text rounded-lg text-sm font-semibold flex items-center gap-1.5"
          >
            <Clipboard className="w-4 h-4" /> {t("manufacturing.newTemplate")}
          </button>
          <button
            onClick={() => setShowNewCheck(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"
          >
            <Play className="w-4 h-4" /> {t("manufacturing.startQCCheck")}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-th-border rounded-lg px-3 py-1.5 min-h-[44px] sm:min-h-0 text-sm bg-th-bg text-th-text"
        >
          <option value="">{t("manufacturing.allTypes")}</option>
          {CHECK_TYPES.map((ct) => (
            <option key={ct.value} value={ct.value}>{ct.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-th-border rounded-lg px-3 py-1.5 min-h-[44px] sm:min-h-0 text-sm bg-th-bg text-th-text"
        >
          <option value="">{t("manufacturing.allStatuses")}</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm border border-red-200 dark:border-red-800 flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="ml-2 font-bold min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl text-sm border border-green-200 dark:border-green-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-2 font-bold min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Records Table */}
      {filteredRecords.length === 0 ? (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-12 text-center">
          <Search className="w-10 h-10 mx-auto mb-3 text-th-text-3" />
          <p className="text-th-text-3">{t("manufacturing.noChecks")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-th-bg-3 text-th-text-2 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">{t("manufacturing.template")}</th>
                  <th className="text-left px-4 py-3">{t("manufacturing.type")}</th>
                  <th className="text-left px-4 py-3">{t("manufacturing.line")}</th>
                  <th className="text-left px-4 py-3">{t("common.status")}</th>
                  <th className="text-left px-4 py-3">{t("manufacturing.score")}</th>
                  <th className="text-left px-4 py-3">{t("common.date")}</th>
                  <th className="text-left px-4 py-3">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-th-border/50">
                {filteredRecords.map((rec) => {
                  const typeInfo = CHECK_TYPES.find((ct) => ct.value === rec.check_type);
                  return (
                    <tr key={rec.id} className="hover:bg-th-hover transition">
                      <td className="px-4 py-3 font-mono text-xs text-th-text-3">#{rec.id}</td>
                      <td className="px-4 py-3 font-medium text-th-text">{templateMap.get(rec.template_id) || `Template #${rec.template_id}`}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs">{typeInfo?.icon} {typeInfo?.label || rec.check_type}</span>
                      </td>
                      <td className="px-4 py-3 text-th-text-2">{lineMap.get(rec.production_line_id) || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[rec.status] || "bg-th-bg-3 text-th-text-3"}`}>
                          {STATUS_LABELS[rec.status] || rec.status}
                        </span>
                        {rec.andon_triggered && <Siren className="ml-1 w-3 h-3 inline text-red-500" />}
                        {rec.hold_placed && <Lock className="ml-1 w-3 h-3 inline text-yellow-600" />}
                      </td>
                      <td className="px-4 py-3">
                        {rec.overall_score_pct != null ? (
                          <span className={`font-bold text-xs ${rec.overall_score_pct >= 80 ? "text-green-600" : rec.overall_score_pct >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                            {rec.overall_score_pct.toFixed(0)}%
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3 text-th-text-3 text-xs">{new Date(rec.started_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {rec.status === "in_progress" && (
                            <button
                              onClick={() => openExecution(rec)}
                              className="px-2 py-1 min-h-[44px] sm:min-h-0 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-lg text-xs font-semibold hover:bg-brand-100 dark:hover:bg-brand-900/40 flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" /> {t("manufacturing.checkContinue")}
                            </button>
                          )}
                          {rec.status === "in_progress" && (
                            <button
                              onClick={() => setConfirmVoidRecord(rec)}
                              className="px-2 py-1 min-h-[44px] sm:min-h-0 text-red-600 dark:text-red-400 rounded-lg text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              {t("manufacturing.checkVoid")}
                            </button>
                          )}
                          {rec.status !== "in_progress" && (
                            <button
                              onClick={() => openExecution(rec)}
                              className="px-2 py-1 min-h-[44px] sm:min-h-0 bg-th-bg-3 text-th-text-2 rounded-lg text-xs hover:bg-th-hover"
                            >
                              {t("manufacturing.checkView")}
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

      {/* Templates List */}
      {templates.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-th-text mb-3 flex items-center gap-2"><Clipboard className="w-5 h-5" /> {t("manufacturing.templates")} ({templates.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((tpl) => {
              const typeInfo = CHECK_TYPES.find((ct) => ct.value === tpl.template_type);
              return (
                <div key={tpl.id} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-th-text text-sm">{tpl.name}</h4>
                      <p className="text-th-text-3 text-xs mt-0.5">{typeInfo?.icon} {typeInfo?.label}</p>
                    </div>
                    <span className="text-th-text-3 text-[10px]">v{tpl.version}</span>
                  </div>
                  {tpl.description && <p className="text-th-text-3 text-xs mt-1 line-clamp-2">{tpl.description}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-th-text-3 text-[10px]">{tpl.items.length} {t("manufacturing.checkPoints")}</span>
                    {tpl.estimated_time_min && <span className="text-th-text-3 text-[10px]">~{tpl.estimated_time_min} min</span>}
                    <span className="text-th-text-3 text-[10px]">{t("manufacturing.passThreshold")}: {tpl.pass_threshold_pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Start New Check Modal */}
      {showNewCheck && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4" onClick={() => setShowNewCheck(false)}>
          <div className="bg-th-bg rounded-t-xl md:rounded-xl shadow-xl border border-th-border w-full md:max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-th-border rounded-full mx-auto mt-3 md:hidden" />
            <div className="p-5 border-b border-th-border">
              <h3 className="font-bold text-th-text text-lg">{t("manufacturing.startCheck")}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.template")} *</label>
                <select
                  value={selectedTemplate?.id || ""}
                  onChange={(e) => {
                    const tpl = templates.find((t) => t.id === Number(e.target.value));
                    setSelectedTemplate(tpl || null);
                  }}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  autoFocus
                >
                  <option value="">{t("manufacturing.selectTemplate")}</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name} ({CHECK_TYPES.find((ct) => ct.value === tpl.template_type)?.label})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.productionLine")} *</label>
                <select
                  value={selectedLineId}
                  onChange={(e) => setSelectedLineId(Number(e.target.value))}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                >
                  <option value={0}>{t("manufacturing.selectLine")}</option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              {selectedTemplate && (
                <div className="bg-th-bg-3 rounded-lg p-3 text-xs text-th-text-2">
                  <p><strong>{selectedTemplate.items.length}</strong> {t("manufacturing.checkPoints")}</p>
                  {selectedTemplate.description && <p className="mt-1">{selectedTemplate.description}</p>}
                  <p className="mt-1">{t("manufacturing.passThreshold")}: {selectedTemplate.pass_threshold_pct}%</p>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-th-border flex gap-3 justify-end">
              <button onClick={() => setShowNewCheck(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleStartCheck}
                disabled={!selectedTemplate || !selectedLineId}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
              >
                {t("manufacturing.startCheck")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Modal */}
      {activeRecord && activeTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4" onClick={() => { setActiveRecord(null); setActiveTemplate(null); }}>
          <div className="bg-th-bg rounded-t-xl md:rounded-xl shadow-xl border border-th-border w-full md:max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-th-border rounded-full mx-auto mt-3 md:hidden" />
            <div className="p-5 border-b border-th-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-th-text text-lg">{activeTemplate.name}</h3>
                <p className="text-xs text-th-text-3 mt-0.5">
                  Check #{activeRecord.id} &middot; {STATUS_LABELS[activeRecord.status] || activeRecord.status}
                </p>
              </div>
              {activeRecord.status !== "in_progress" && activeRecord.overall_score_pct != null && (
                <div className={`text-2xl font-bold ${activeRecord.overall_score_pct >= 80 ? "text-green-600" : activeRecord.overall_score_pct >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                  {activeRecord.overall_score_pct.toFixed(0)}%
                </div>
              )}
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {activeTemplate.items
                .sort((a, b) => a.item_order - b.item_order)
                .map((item) => {
                  const val = checkResults[item.id] || {};
                  const isCompleted = activeRecord.status !== "in_progress";
                  return (
                    <div
                      key={item.id}
                      className={`border rounded-xl p-4 ${
                        item.is_critical ? "border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/10" : "border-th-border"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-th-text-3 text-xs font-mono mt-0.5">#{item.item_order}</span>
                        <div className="flex-1">
                          <p className="text-sm text-th-text font-medium">
                            {item.description}
                            {item.is_critical && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full font-bold">CRITICAL</span>}
                          </p>
                          {item.specification && (
                            <p className="text-xs text-th-text-3 mt-0.5">{t("manufacturing.spec")}: {item.specification}</p>
                          )}
                          {(item.lower_limit != null || item.upper_limit != null) && (
                            <p className="text-xs text-th-text-3">
                              {t("manufacturing.range")}: {item.lower_limit ?? "—"} – {item.upper_limit ?? "—"} {item.unit || ""}
                            </p>
                          )}

                          {/* Result input */}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {item.check_type === "checkbox" && (
                              <div className="flex gap-1">
                                {["pass", "fail", "na"].map((r) => (
                                  <button
                                    key={r}
                                    disabled={isCompleted}
                                    onClick={() => setCheckResults({ ...checkResults, [item.id]: { ...val, result: r } })}
                                    className={`px-3 py-1 min-h-[44px] sm:min-h-0 rounded-lg text-xs font-bold transition ${
                                      val.result === r
                                        ? r === "pass" ? "bg-green-500 text-white"
                                          : r === "fail" ? "bg-red-500 text-white"
                                            : "bg-th-text-3 text-th-bg"
                                        : "bg-th-bg-3 text-th-text-2 hover:bg-th-hover"
                                    } ${isCompleted ? "opacity-60 cursor-not-allowed" : ""}`}
                                  >
                                    {r === "pass" ? <><Check className="w-3 h-3 inline" /> {t("manufacturing.pass")}</> : r === "fail" ? <><X className="w-3 h-3 inline" /> {t("manufacturing.fail")}</> : <><Minus className="w-3 h-3 inline" /> {t("manufacturing.na")}</>}
                                  </button>
                                ))}
                              </div>
                            )}
                            {item.check_type === "measurement" && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  disabled={isCompleted}
                                  placeholder={t("manufacturing.measuredValue")}
                                  value={val.measured_value ?? ""}
                                  onChange={(e) => {
                                    const mv = parseFloat(e.target.value);
                                    const inRange = (item.lower_limit == null || mv >= item.lower_limit) && (item.upper_limit == null || mv <= item.upper_limit);
                                    setCheckResults({
                                      ...checkResults,
                                      [item.id]: { ...val, measured_value: mv, result: isNaN(mv) ? "" : inRange ? "pass" : "fail" },
                                    });
                                  }}
                                  className="w-28 border border-th-border rounded-lg px-2 py-1 text-sm bg-th-bg text-th-text"
                                />
                                {item.unit && <span className="text-xs text-th-text-3">{item.unit}</span>}
                                {val.result && (
                                  <span className={`text-xs font-bold ${val.result === "pass" ? "text-green-600" : "text-red-600"}`}>
                                    {val.result === "pass" ? <CheckCircle className="w-4 h-4 inline" /> : <XCircle className="w-4 h-4 inline" />}
                                  </span>
                                )}
                              </div>
                            )}
                            {item.check_type === "text" && (
                              <input
                                type="text"
                                disabled={isCompleted}
                                placeholder={t("manufacturing.enterObservation")}
                                value={val.text_value ?? ""}
                                onChange={(e) => setCheckResults({
                                  ...checkResults,
                                  [item.id]: { ...val, text_value: e.target.value, result: e.target.value ? "pass" : "" },
                                })}
                                className="flex-1 border border-th-border rounded-lg px-2 py-1 text-sm bg-th-bg text-th-text"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="p-5 border-t border-th-border flex gap-3 justify-end">
              <button
                onClick={() => { setActiveRecord(null); setActiveTemplate(null); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3"
              >
                {activeRecord.status === "in_progress" ? t("manufacturing.saveAndClose") : t("common.close")}
              </button>
              {activeRecord.status === "in_progress" && (
                <button
                  onClick={handleSubmitResults}
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center gap-1.5"
                >
                  {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {submitting ? t("manufacturing.completing") : t("manufacturing.completeCheck")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4" onClick={() => setShowTemplateForm(false)}>
          <div className="bg-th-bg rounded-t-xl md:rounded-xl shadow-xl border border-th-border w-full md:max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-th-border rounded-full mx-auto mt-3 md:hidden" />
            <div className="p-5 border-b border-th-border">
              <h3 className="font-bold text-th-text text-lg">{t("manufacturing.createQCTemplate")}</h3>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.templateName")} *</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                    placeholder="Line Clearance - Injection"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.checkType")} *</label>
                  <select
                    value={templateForm.template_type}
                    onChange={(e) => setTemplateForm({ ...templateForm, template_type: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  >
                    {CHECK_TYPES.map((ct) => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.descriptionLabel")}</label>
                <textarea
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  rows={2}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.passThresholdPct")}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={templateForm.pass_threshold_pct}
                    onChange={(e) => setTemplateForm({ ...templateForm, pass_threshold_pct: Number(e.target.value) })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-th-text min-h-[44px] sm:min-h-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={templateForm.critical_items_must_pass}
                      onChange={(e) => setTemplateForm({ ...templateForm, critical_items_must_pass: e.target.checked })}
                      className="rounded w-5 h-5 sm:w-4 sm:h-4"
                    />
                    {t("manufacturing.criticalMustPass")}
                  </label>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-th-text-2">{t("manufacturing.checkPoints")} ({templateForm.items.length})</label>
                  <button onClick={addTemplateItem} className="text-xs text-brand-600 hover:text-brand-700 font-semibold min-h-[44px] sm:min-h-0">
                    {t("manufacturing.addCheckPoint")}
                  </button>
                </div>
                <div className="space-y-2">
                  {templateForm.items.map((item, i) => (
                    <div key={i} className="border border-th-border rounded-lg p-3 bg-th-bg-3/50">
                      <div className="flex gap-2">
                        <span className="text-xs text-th-text-3 font-mono mt-2">#{i + 1}</span>
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateTemplateItem(i, "description", e.target.value)}
                            placeholder={t("manufacturing.whatToCheck")}
                            className="w-full border border-th-border rounded px-2 py-1 text-sm bg-th-bg text-th-text"
                          />
                          <div className="flex gap-2 items-center flex-wrap">
                            <select
                              value={item.check_type}
                              onChange={(e) => updateTemplateItem(i, "check_type", e.target.value)}
                              className="border border-th-border rounded px-2 py-1 text-xs bg-th-bg text-th-text"
                            >
                              <option value="checkbox">{t("manufacturing.checkboxPassFail")}</option>
                              <option value="measurement">{t("manufacturing.measurement")}</option>
                              <option value="text">{t("manufacturing.textObservation")}</option>
                            </select>
                            <input
                              type="text"
                              value={item.specification}
                              onChange={(e) => updateTemplateItem(i, "specification", e.target.value)}
                              placeholder={t("manufacturing.specification")}
                              className="flex-1 border border-th-border rounded px-2 py-1 text-xs bg-th-bg text-th-text"
                            />
                            <label className="flex items-center gap-1 text-xs text-th-text-2 min-h-[44px] sm:min-h-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.is_critical}
                                onChange={(e) => updateTemplateItem(i, "is_critical", e.target.checked)}
                                className="rounded w-5 h-5 sm:w-4 sm:h-4"
                              />
                              {t("manufacturing.critical")}
                            </label>
                            <button onClick={() => removeTemplateItem(i)} className="text-red-500 hover:text-red-700 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-th-border flex gap-3 justify-end">
              <button onClick={() => setShowTemplateForm(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!templateForm.name.trim() || templateForm.items.length === 0}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
              >
                {t("manufacturing.createQCTemplate")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmVoidRecord !== null}
        title={t("manufacturing.checkVoid")}
        message={t("manufacturing.voidConfirm")}
        variant="warning"
        onConfirm={() => {
          if (confirmVoidRecord) handleVoid(confirmVoidRecord);
          setConfirmVoidRecord(null);
        }}
        onCancel={() => setConfirmVoidRecord(null)}
      />
    </div>
  );
}
