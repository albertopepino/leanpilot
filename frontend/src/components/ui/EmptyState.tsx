"use client";
import { useI18n } from "@/stores/useI18n";
import { type LucideIcon, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon: string | LucideIcon;
  titleKey: string;
  descriptionKey?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon: IconProp, titleKey, descriptionKey, actionLabel, onAction }: EmptyStateProps) {
  const { t } = useI18n();
  const isLucide = typeof IconProp !== "string";
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 bg-th-bg-3 rounded-xl flex items-center justify-center text-th-text-3 mb-4">
        {isLucide ? <IconProp size={24} /> : <Inbox size={24} />}
      </div>
      <h3 className="text-base font-semibold text-th-text mb-1">{t(titleKey)}</h3>
      {descriptionKey && <p className="text-sm text-th-text-2 max-w-sm mb-4">{t(descriptionKey)}</p>}
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
