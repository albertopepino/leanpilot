"use client";
import { useEffect, useRef } from "react";
import { useI18n } from "@/stores/useI18n";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button on open, trap focus
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmColors =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : variant === "warning"
        ? "bg-amber-500 hover:bg-amber-600 text-white"
        : "bg-brand-600 hover:bg-brand-700 text-white";

  const iconBg =
    variant === "danger"
      ? "bg-red-500/15"
      : variant === "warning"
        ? "bg-amber-500/15"
        : "bg-brand-500/15";

  const iconColor =
    variant === "danger"
      ? "text-red-500"
      : variant === "warning"
        ? "text-amber-500"
        : "text-brand-500";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="bg-th-card rounded-xl border border-th-border shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
            <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
          </div>
          <div>
            <h3 id="confirm-dialog-title" className="text-base font-bold text-th-text">
              {title}
            </h3>
            <p className="text-sm text-th-text-2 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-th-border text-th-text text-sm font-medium hover:bg-th-bg-hover transition"
          >
            {cancelLabel || t("common.cancel") || "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${confirmColors}`}
          >
            {confirmLabel || t("common.confirm") || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
