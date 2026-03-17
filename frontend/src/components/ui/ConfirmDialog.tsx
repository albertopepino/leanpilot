"use client";
import { useEffect, useRef } from "react";
import { useI18n } from "@/stores/useI18n";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, variant = "info", onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      confirmRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  const variantColors = {
    danger: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500",
    warning: "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500",
    info: "bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500",
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 bg-transparent backdrop:bg-black/50"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="bg-th-card border border-th-card-border rounded-xl shadow-xl max-w-sm w-full p-6" role="alertdialog">
          <h2 id="confirm-title" className="text-lg font-semibold text-th-text mb-2">{title}</h2>
          <p id="confirm-message" className="text-sm text-th-text-2 mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-th-text-2 hover:text-th-text bg-th-bg-3 rounded-lg transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              {cancelLabel || t("common.cancel")}
            </button>
            <button
              ref={confirmRef}
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition focus-visible:ring-2 focus-visible:ring-offset-2 ${variantColors[variant]}`}
            >
              {confirmLabel || t("common.confirm")}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
