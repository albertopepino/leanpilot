"use client";
import { useEffect, useRef } from "react";

interface AchievementToastProps {
  icon: string;
  title: string;
  subtitle: string;
  show: boolean;
  onClose: () => void;
}

export default function AchievementToast({
  icon,
  title,
  subtitle,
  show,
  onClose,
}: AchievementToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!show) return;
    timerRef.current = setTimeout(onClose, 4000);
    return () => clearTimeout(timerRef.current);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[9998] print:hidden animate-achievement-in"
    >
      <div
        className="flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border border-amber-400/40 backdrop-blur-md
          bg-gradient-to-r from-amber-50/95 via-yellow-50/95 to-amber-50/95
          dark:from-amber-950/90 dark:via-yellow-950/90 dark:to-amber-950/90
          dark:border-amber-500/30"
        style={{
          boxShadow:
            "0 0 20px rgba(245, 158, 11, 0.15), 0 8px 32px rgba(0,0,0,0.12)",
        }}
      >
        {/* Icon */}
        <span className="text-[32px] leading-none shrink-0" aria-hidden="true">
          {icon}
        </span>

        {/* Text */}
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100 truncate">
            {title}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300/80 truncate">
            {subtitle}
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="ml-2 shrink-0 text-amber-600/60 hover:text-amber-800 dark:text-amber-400/60 dark:hover:text-amber-200 transition-colors"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1 1l12 12M13 1L1 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
