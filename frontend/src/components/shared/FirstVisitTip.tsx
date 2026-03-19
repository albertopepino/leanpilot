"use client";
import { useState, useEffect } from "react";
import { useI18n } from "@/stores/useI18n";
import { Lightbulb, X, ExternalLink } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface FirstVisitTipProps {
  moduleKey: string;
  tipText: string;
  learnMoreUrl?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FirstVisitTip({
  moduleKey,
  tipText,
  learnMoreUrl,
}: FirstVisitTipProps) {
  const { t } = useI18n();
  const storageKey = `tip_dismissed_${moduleKey}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) {
      setVisible(true);
    }
  }, [storageKey]);

  function dismiss() {
    setVisible(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, "1");
    }
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 px-4 py-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <Lightbulb
        size={18}
        className="text-sky-500 mt-0.5 flex-shrink-0"
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-sky-900 dark:text-sky-200 leading-relaxed">
          {tipText}
        </p>
        {learnMoreUrl && (
          <a
            href={learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
          >
            {t("help.learnMore") || "Learn more"}
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      <button
        onClick={dismiss}
        className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-800/40 hover:bg-sky-200 dark:hover:bg-sky-800/60 border border-sky-200 dark:border-sky-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        aria-label={t("help.dismissTip") || "Dismiss tip"}
      >
        {t("help.gotIt") || "Got it!"}
      </button>

      <button
        onClick={dismiss}
        className="flex-shrink-0 p-0.5 text-sky-400 hover:text-sky-600 dark:hover:text-sky-300 transition-colors"
        aria-label={t("common.close") || "Close"}
      >
        <X size={14} />
      </button>
    </div>
  );
}
