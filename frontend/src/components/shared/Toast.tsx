"use client";
import { useEffect, useRef } from "react";
import { useToast, type Toast as ToastData, type ToastType } from "@/stores/useToast";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<ToastType, LucideIcon> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLE_MAP: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: {
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    icon: "text-emerald-500",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  error: {
    bg: "bg-rose-50 dark:bg-rose-950/50",
    icon: "text-rose-500",
    border: "border-rose-200 dark:border-rose-800",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/50",
    icon: "text-amber-500",
    border: "border-amber-200 dark:border-amber-800",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/50",
    icon: "text-blue-500",
    border: "border-blue-200 dark:border-blue-800",
  },
};

function ToastItem({ toast }: { toast: ToastData }) {
  const { removeToast } = useToast();
  const style = STYLE_MAP[toast.type];
  const Icon = ICON_MAP[toast.type];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm max-w-sm w-full
        animate-[slideInRight_0.3s_ease-out] ${style.bg} ${style.border}`}
    >
      <Icon size={18} className={`${style.icon} mt-0.5 shrink-0`} />
      <p className="flex-1 text-sm text-th-text leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-th-text-3 hover:text-th-text transition shrink-0 p-0.5"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  // Announce to screen readers
  useEffect(() => {
    if (toasts.length > 0) {
      const latest = toasts[toasts.length - 1];
      const liveRegion = document.getElementById("toast-live-region");
      if (liveRegion) {
        liveRegion.textContent = latest.message;
      }
    }
  }, [toasts]);

  if (toasts.length === 0) return (
    <div id="toast-live-region" className="sr-only" aria-live="polite" aria-atomic="true" />
  );

  return (
    <>
      <div id="toast-live-region" className="sr-only" aria-live="polite" aria-atomic="true" />
      <div
        ref={containerRef}
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-auto"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </>
  );
}
