"use client";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import type { Toast } from "@/hooks/useToast";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const COLORS = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-blue-600 text-white",
};

export default function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-right-5 duration-300 ${COLORS[toast.type]}`}
          >
            <Icon className="w-4.5 h-4.5 shrink-0" />
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => onRemove(toast.id)} className="opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
