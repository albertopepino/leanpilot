"use client";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Module color mapping                                               */
/* ------------------------------------------------------------------ */

const MODULE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  kaizen:    { bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-700 dark:text-violet-400", icon: "\u2B50" },
  "five-why": { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-700 dark:text-indigo-400", icon: "\u2753" },
  gemba:     { bg: "bg-teal-50 dark:bg-teal-900/20", text: "text-teal-700 dark:text-teal-400", icon: "\uD83D\uDEB6" },
  capa:      { bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400", icon: "\uD83D\uDEE1\uFE0F" },
  ncr:       { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", icon: "\u26D4" },
  andon:     { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", icon: "\u26A1" },
  oee:       { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", icon: "\uD83D\uDCCA" },
  qc:        { bg: "bg-cyan-50 dark:bg-cyan-900/20", text: "text-cyan-700 dark:text-cyan-400", icon: "\u2705" },
};

const FALLBACK = { bg: "bg-gray-50 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", icon: "\uD83D\uDD17" };

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface LinkedItemBadgeProps {
  moduleType: string;
  moduleId: number;
  label: string;
  href: string;
}

export default function LinkedItemBadge({ moduleType, moduleId, label, href }: LinkedItemBadgeProps) {
  const router = useRouter();
  const colors = MODULE_COLORS[moduleType] || FALLBACK;

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${colors.bg} ${colors.text} border border-current/10 hover:brightness-95 dark:hover:brightness-110 transition-all cursor-pointer`}
      title={`${label} #${moduleId}`}
    >
      <span aria-hidden="true">{colors.icon}</span>
      <span>{label} #{moduleId}</span>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 opacity-50" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </button>
  );
}
