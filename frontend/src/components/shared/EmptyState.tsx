"use client";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { useI18n } from "@/stores/useI18n";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  const { t } = useI18n();

  const displayTitle = title || t("common.emptyStateTitle");
  const displayDescription = description || t("common.emptyStateDescription");

  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
      role="status"
    >
      <div className="w-16 h-16 rounded-2xl bg-th-border/50 flex items-center justify-center mb-5">
        <Icon size={28} className="text-th-text-3" strokeWidth={1.5} />
      </div>

      <h3 className="text-lg font-semibold text-th-text mb-2">
        {displayTitle}
      </h3>

      <p className="text-sm text-th-text-3 max-w-sm mb-6 leading-relaxed">
        {displayDescription}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-purple-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
