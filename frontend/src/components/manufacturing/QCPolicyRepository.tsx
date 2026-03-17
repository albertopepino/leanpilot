"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "@/stores/useI18n";
import { qcApi } from "@/lib/api";
import {
  Upload,
  ClipboardList,
  FilePen,
  BookOpen,
  FileText,
  Library,
  FolderOpen,
  Download,
  Trash2,
  X,
  Check,
  Image,
} from "lucide-react";

interface PolicyDoc {
  id: number;
  title: string;
  description: string | null;
  filename: string;
  category: string;
  file_size: number;
  mime_type: string;
  version: string;
  created_at: string;
}

const FILE_ICON_MAP: Record<string, React.ElementType> = {
  "application/pdf": BookOpen,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileText,
  "application/msword": FileText,
  "image/jpeg": Image,
  "image/png": Image,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  policy: ClipboardList,
  procedure: FilePen,
  work_instruction: BookOpen,
  form: FileText,
  reference: Library,
};

export default function QCPolicyRepository() {
  const { t } = useI18n();

  const CATEGORIES = [
    { value: "policy", label: t("manufacturing.catPolicy") },
    { value: "procedure", label: t("manufacturing.catProcedure") },
    { value: "work_instruction", label: t("manufacturing.catWorkInstruction") },
    { value: "form", label: t("manufacturing.catForm") },
    { value: "reference", label: t("manufacturing.catReference") },
  ];

  const [docs, setDocs] = useState<PolicyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "policy",
    version: "1.0",
    file: null as File | null,
  });

  const fetchDocs = useCallback(async () => {
    try {
      const res = await qcApi.listPolicies(filterCategory || undefined);
      setDocs(res.data ?? res);
    } catch {
      setError(t("manufacturing.failedLoadDocs"));
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const resetForm = () => {
    setForm({ title: "", description: "", category: "policy", version: "1.0", file: null });
    setShowUpload(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!form.file || !form.title.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await qcApi.uploadPolicy(form.file, form.title, form.description, form.category, form.version);
      setSuccess(t("manufacturing.uploadedSuccess", { title: form.title }));
      resetForm();
      await fetchDocs();
    } catch {
      setError(t("manufacturing.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: PolicyDoc) => {
    try {
      const res = await qcApi.downloadPolicy(doc.id);
      const blob = new Blob([res.data], { type: doc.mime_type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(t("manufacturing.downloadFailed"));
    }
  };

  const handleDelete = async (doc: PolicyDoc) => {
    if (!confirm(t("manufacturing.removeConfirm", { title: doc.title }))) return;
    try {
      await qcApi.deletePolicy(doc.id);
      await fetchDocs();
    } catch {
      setError(t("manufacturing.deleteFailed"));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm({
        ...form,
        file,
        title: form.title || file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
      });
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
    <div className="max-w-[1400px] mx-auto space-y-6" id="qc-policies-view">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-th-text">{t("manufacturing.titleQCPolicies")}</h2>
          <p className="text-sm text-th-text-3 mt-1">
            {docs.length !== 1
              ? t("manufacturing.documentsStored", { count: docs.length })
              : t("manufacturing.documentsStoredSingular", { count: docs.length })}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowUpload(true); }}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"
        >
          <Upload className="w-4 h-4" />
          {t("manufacturing.uploadDocument")}
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            !filterCategory
              ? "bg-brand-600 text-white"
              : "bg-th-bg-3 text-th-text-2 hover:bg-th-hover"
          }`}
        >
          {t("manufacturing.catAll")}
        </button>
        {CATEGORIES.map((cat) => {
          const CatIcon = CATEGORY_ICONS[cat.value];
          return (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                filterCategory === cat.value
                  ? "bg-brand-600 text-white"
                  : "bg-th-bg-3 text-th-text-2 hover:bg-th-hover"
              }`}
            >
              <CatIcon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm border border-red-200 dark:border-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700 dark:hover:text-red-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl text-sm border border-green-200 dark:border-green-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            {success}
          </span>
          <button onClick={() => setSuccess(null)} className="ml-2 text-green-500 hover:text-green-700 dark:hover:text-green-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Document Grid */}
      {docs.length === 0 ? (
        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-12 text-center">
          <FolderOpen className="w-10 h-10 text-th-text-3 mx-auto mb-3" />
          <p className="text-th-text-3">{t("manufacturing.noDocuments")}</p>
          <p className="text-th-text-3 text-xs mt-1">{t("manufacturing.acceptedFormats")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc) => {
            const DocIcon = FILE_ICON_MAP[doc.mime_type] || FileText;
            return (
              <div
                key={doc.id}
                className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 p-2 rounded-lg bg-th-bg-3">
                    <DocIcon className="w-5 h-5 text-th-text-2" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-th-text text-sm truncate" title={doc.title}>
                      {doc.title}
                    </h3>
                    {doc.description && (
                      <p className="text-th-text-3 text-xs mt-0.5 line-clamp-2">{doc.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 capitalize">
                        {doc.category?.replace("_", " ")}
                      </span>
                      <span className="text-th-text-3 text-[10px]">v{doc.version}</span>
                      <span className="text-th-text-3 text-[10px]">{formatFileSize(doc.file_size)}</span>
                    </div>
                    <p className="text-th-text-3 text-[10px] mt-1">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-th-border/50">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="flex-1 px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-lg text-xs font-semibold hover:bg-brand-100 dark:hover:bg-brand-900/40 transition flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t("manufacturing.download")}
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    className="px-3 py-1.5 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-th-bg rounded-xl shadow-xl border border-th-border w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-th-border">
              <h3 className="font-bold text-th-text text-lg">{t("manufacturing.uploadQCDocument")}</h3>
            </div>
            <div className="p-5 space-y-4">
              {/* File Picker */}
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.file")} *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 dark:file:bg-brand-900/30 dark:file:text-brand-300"
                />
                <p className="text-[10px] text-th-text-3 mt-1">{t("manufacturing.fileFormatHint")}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.title")} *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  placeholder="Incoming Inspection Policy"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.category")}</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.version")}</label>
                  <input
                    type="text"
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                    placeholder="1.0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.descriptionLabel")}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text resize-none"
                  placeholder="Optional description..."
                />
              </div>
            </div>

            <div className="p-5 border-t border-th-border flex gap-3 justify-end">
              <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleUpload}
                disabled={!form.file || !form.title.trim() || uploading}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold flex items-center gap-1.5"
              >
                {uploading && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {uploading ? t("manufacturing.uploading") : t("manufacturing.upload")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
