"use client";
import { useState } from "react";
import { useI18n } from "@/stores/useI18n";
import { useToast } from "@/stores/useToast";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  X,
  StopCircle,
  AlertTriangle,
  Wrench,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

interface QuickReportModalProps {
  onClose: () => void;
}

type Severity = "info" | "warning" | "critical";

const CATEGORIES = ["safety", "quality", "equipment", "process"] as const;
type Category = (typeof CATEGORIES)[number];

export default function QuickReportModal({ onClose }: QuickReportModalProps) {
  const { t } = useI18n();
  const toast = useToast();
  const trapRef = useFocusTrap<HTMLDivElement>();
  const [category, setCategory] = useState<Category | "">("");
  const [severity, setSeverity] = useState<Severity>("info");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const categoryOptions: { id: Category; label: string; icon: typeof StopCircle; color: string }[] = [
    { id: "safety", label: t("common.safetyConcern") || "Safety", icon: ShieldAlert, color: "border-purple-500 bg-purple-50 dark:bg-purple-900/20" },
    { id: "quality", label: t("common.qualityIssue") || "Quality", icon: AlertTriangle, color: "border-amber-500 bg-amber-50 dark:bg-amber-900/20" },
    { id: "equipment", label: t("common.machineStop") || "Equipment", icon: StopCircle, color: "border-red-500 bg-red-50 dark:bg-red-900/20" },
    { id: "process", label: t("common.maintenanceNeeded") || "Process", icon: Wrench, color: "border-blue-500 bg-blue-50 dark:bg-blue-900/20" },
  ];

  const severityOptions: { id: Severity; label: string; color: string; ring: string }[] = [
    { id: "info", label: "Info", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", ring: "ring-blue-500" },
    { id: "warning", label: t("common.quickReportSeverityWarning") || "Warning", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", ring: "ring-amber-500" },
    { id: "critical", label: t("common.critical") || "Critical", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", ring: "ring-red-500" },
  ];

  const handleSubmit = async () => {
    if (!category || !description.trim()) return;
    setSubmitting(true);
    try {
      const { advancedLeanApi, adminApi } = await import("@/lib/api");
      let lineId = 1;
      try {
        const linesRes = await adminApi.listProductionLines();
        const lines = Array.isArray(linesRes.data) ? linesRes.data : (linesRes.data?.lines || []);
        if (lines.length > 0) lineId = lines[0].id;
      } catch { /* fallback */ }

      // Map severity to Andon status color (red/yellow/blue)
      const severityToStatus: Record<Severity, string> = {
        critical: "red",
        warning: "yellow",
        info: "blue",
      };

      await advancedLeanApi.createAndonEvent({
        production_line_id: lineId,
        status: severityToStatus[severity],
        description: `[${category.toUpperCase()}] ${description}`,
      });

      setSubmitted(true);
      toast.success(t("common.reportSubmitted") || "Report Submitted");
      setTimeout(onClose, 1500);
    } catch {
      toast.error(t("common.saveFailed") || "Failed to submit report");
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={t("common.quickReportTitle") || "Quick Report"}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-th-bg-2 rounded-t-2xl sm:rounded-2xl border border-th-border p-5 pb-8 pb-safe animate-slide-in">
        {submitted ? (
          <div className="text-center py-8">
            <CheckCircle2 size={48} className="mx-auto mb-3 text-green-500" />
            <h3 className="text-lg font-semibold text-th-text">
              {t("common.reportSubmitted") || "Report Submitted"}
            </h3>
            <p className="text-sm text-th-text-2 mt-1">
              {t("common.reportSubmittedDesc") || "Your team has been notified."}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-th-text">
                {t("common.quickReportTitle") || "Quick Report"}
              </h3>
              <button
                onClick={onClose}
                className="text-th-text-3 hover:text-th-text transition-colors"
                aria-label={t("common.close") || "Close"}
              >
                <X size={20} />
              </button>
            </div>

            {/* Category */}
            <label className="block text-sm font-medium text-th-text-2 mb-2">
              {t("common.quickReportCategory") || "Category"}
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {categoryOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setCategory(opt.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                      category === opt.id
                        ? opt.color + " border-current font-medium"
                        : "border-th-border bg-th-bg hover:border-th-text-3"
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-sm text-th-text">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Severity */}
            <label className="block text-sm font-medium text-th-text-2 mb-2">
              {t("common.quickReportSeverity") || "Severity"}
            </label>
            <div className="flex gap-2 mb-4">
              {severityOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSeverity(opt.id)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${opt.color} ${
                    severity === opt.id
                      ? `ring-2 ${opt.ring} ring-offset-1`
                      : "opacity-60 hover:opacity-80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Description */}
            <label className="block text-sm font-medium text-th-text-2 mb-2">
              {t("common.quickReportDescription") || "Description"}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("common.describeIssue") || "Describe the issue..."}
              className="w-full p-3 border border-th-border rounded-xl bg-th-input text-th-text text-sm resize-none h-20 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mb-4"
              aria-label={t("common.quickReportDescription") || "Description"}
            />

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!category || !description.trim() || submitting}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              {submitting
                ? (t("common.saving") || "Saving...")
                : (t("common.quickReportSubmit") || "Submit Report")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
