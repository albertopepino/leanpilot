"use client";
import { usePathname } from "next/navigation";
import Breadcrumb from "./Breadcrumb";
import { ContextualHelpButton } from "./ContextualHelp";

/* ------------------------------------------------------------------ */
/*  DMAIC phase detection & badge styling                              */
/* ------------------------------------------------------------------ */

const PHASE_BADGE: Record<string, { label: string; className: string }> = {
  define: {
    label: "Define",
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  measure: {
    label: "Measure",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  analyze: {
    label: "Analyze",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  improve: {
    label: "Improve",
    className: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  control: {
    label: "Control",
    className: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
};

function detectPhase(pathname: string): string | null {
  const first = pathname.split("/").filter(Boolean)[0];
  return first && PHASE_BADGE[first] ? first : null;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  helpKey?: string;
  onHelpNavigate?: (view: string) => void;
  children?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PageHeader({
  title,
  subtitle,
  helpKey,
  onHelpNavigate,
  children,
}: PageHeaderProps) {
  const pathname = usePathname();
  const phase = pathname ? detectPhase(pathname) : null;
  const badge = phase ? PHASE_BADGE[phase] : null;

  return (
    <header className="mb-6">
      {/* Breadcrumb row */}
      <div className="mb-3">
        <Breadcrumb />
      </div>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-th-text leading-tight truncate">
              {title}
            </h1>

            {/* DMAIC phase badge — shown only for legacy DMAIC paths, kept subtle */}
            {badge && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider border shrink-0 opacity-60 ${badge.className}`}
              >
                {badge.label}
              </span>
            )}
          </div>

          {subtitle && (
            <p className="mt-1 text-sm text-th-text-2 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right side: help button + action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {helpKey && (
            <ContextualHelpButton
              moduleId={helpKey}
              onNavigate={onHelpNavigate}
            />
          )}
          {children}
        </div>
      </div>
    </header>
  );
}
