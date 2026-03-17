"use client";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import ExportToolbar from "./ExportToolbar";
import { type LucideIcon } from "lucide-react";

interface PageHeaderProps {
  titleKey: string;          // i18n key
  subtitleKey?: string;      // optional subtitle i18n key
  icon?: LucideIcon;         // Lucide icon component
  showExport?: boolean;      // show print/export buttons
  actions?: React.ReactNode; // right-side action buttons
  breadcrumb?: { label: string; onClick?: () => void }[];
}

export default function PageHeader({ titleKey, subtitleKey, icon: Icon, showExport, actions, breadcrumb }: PageHeaderProps) {
  const { t } = useI18n();
  const { user } = useAuth();

  return (
    <div className="mb-6">
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1.5 text-xs text-th-text-3">
            {breadcrumb.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                {crumb.onClick ? (
                  <button onClick={crumb.onClick} className="hover:text-brand-600 transition">{crumb.label}</button>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <Icon size={18} />
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-th-text tracking-tight">{t(titleKey)}</h1>
            {subtitleKey && <p className="text-sm text-th-text-2 mt-0.5">{t(subtitleKey)}</p>}
            <p className="text-xs text-th-text-3 mt-0.5">{user?.full_name} · {user?.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showExport && <ExportToolbar onPrint={() => window.print()} />}
          {actions}
        </div>
      </div>
    </div>
  );
}
