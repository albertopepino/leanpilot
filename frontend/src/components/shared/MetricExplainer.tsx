"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { Info, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Built-in metric knowledge base                                     */
/* ------------------------------------------------------------------ */

interface MetricKnowledge {
  descriptionKey: string;
  benchmarkKey: string;
  actionKey: string;
  /** Good threshold (value >= this is good) */
  goodThreshold?: number;
  /** Warning threshold (value >= this but < good is warning) */
  warnThreshold?: number;
}

const METRIC_DB: Record<string, MetricKnowledge> = {
  oee: {
    descriptionKey: "help.metric_oee_desc",
    benchmarkKey: "help.metric_oee_bench",
    actionKey: "help.metric_oee_action",
    goodThreshold: 85,
    warnThreshold: 60,
  },
  availability: {
    descriptionKey: "help.metric_availability_desc",
    benchmarkKey: "help.metric_availability_bench",
    actionKey: "help.metric_availability_action",
    goodThreshold: 90,
    warnThreshold: 75,
  },
  performance: {
    descriptionKey: "help.metric_performance_desc",
    benchmarkKey: "help.metric_performance_bench",
    actionKey: "help.metric_performance_action",
    goodThreshold: 95,
    warnThreshold: 80,
  },
  quality: {
    descriptionKey: "help.metric_quality_desc",
    benchmarkKey: "help.metric_quality_bench",
    actionKey: "help.metric_quality_action",
    goodThreshold: 99,
    warnThreshold: 95,
  },
  mtbf: {
    descriptionKey: "help.metric_mtbf_desc",
    benchmarkKey: "help.metric_mtbf_bench",
    actionKey: "help.metric_mtbf_action",
  },
  mttr: {
    descriptionKey: "help.metric_mttr_desc",
    benchmarkKey: "help.metric_mttr_bench",
    actionKey: "help.metric_mttr_action",
  },
  fty: {
    descriptionKey: "help.metric_fty_desc",
    benchmarkKey: "help.metric_fty_bench",
    actionKey: "help.metric_fty_action",
    goodThreshold: 95,
    warnThreshold: 85,
  },
  cp: {
    descriptionKey: "help.metric_cp_desc",
    benchmarkKey: "help.metric_cp_bench",
    actionKey: "help.metric_cp_action",
    goodThreshold: 1.33,
    warnThreshold: 1.0,
  },
  cpk: {
    descriptionKey: "help.metric_cpk_desc",
    benchmarkKey: "help.metric_cpk_bench",
    actionKey: "help.metric_cpk_action",
    goodThreshold: 1.33,
    warnThreshold: 1.0,
  },
  ppm: {
    descriptionKey: "help.metric_ppm_desc",
    benchmarkKey: "help.metric_ppm_bench",
    actionKey: "help.metric_ppm_action",
  },
  sigma_level: {
    descriptionKey: "help.metric_sigma_desc",
    benchmarkKey: "help.metric_sigma_bench",
    actionKey: "help.metric_sigma_action",
    goodThreshold: 4.0,
    warnThreshold: 3.0,
  },
  takt_time: {
    descriptionKey: "help.metric_takt_desc",
    benchmarkKey: "help.metric_takt_bench",
    actionKey: "help.metric_takt_action",
  },
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MetricExplainerProps {
  metricKey: string;
  value?: number;
  target?: number;
  /** Size variant */
  size?: "sm" | "md";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MetricExplainer({
  metricKey,
  value,
  target,
  size = "sm",
}: MetricExplainerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipId = `metric-explainer-${metricKey}`;

  const metric = METRIC_DB[metricKey];
  if (!metric) return null;

  const description = t(metric.descriptionKey);
  const benchmark = t(metric.benchmarkKey);
  const action = t(metric.actionKey);

  // Determine status color based on value vs thresholds
  let statusColor = "";
  let statusLabel = "";
  if (value != null && metric.goodThreshold != null) {
    // For PPM lower is better — handled by not having goodThreshold set for it
    if (value >= metric.goodThreshold) {
      statusColor = "text-emerald-500";
      statusLabel = t("help.metric_status_good");
    } else if (metric.warnThreshold != null && value >= metric.warnThreshold) {
      statusColor = "text-amber-500";
      statusLabel = t("help.metric_status_warning");
    } else {
      statusColor = "text-red-500";
      statusLabel = t("help.metric_status_critical");
    }
  }

  // Close on click outside
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    },
    [],
  );

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    },
    [],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleClickOutside, handleKeyDown]);

  const iconSize = size === "sm" ? 14 : 16;

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="inline-flex items-center justify-center rounded-full text-th-text-3 hover:text-brand-500 hover:bg-brand-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 p-0.5"
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        aria-label={t("help.metric_explain_aria") || `Explain ${metricKey}`}
        title={t("help.whatIsThis") || "What is this?"}
      >
        <Info size={iconSize} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          id={tooltipId}
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 rounded-xl border border-th-border bg-th-card shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* Arrow */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-th-card border-r border-b border-th-border" />

          <div className="relative p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-th-text">
                {t(`help.metric_${metricKey}_title`) || metricKey.toUpperCase()}
              </h4>
              <button
                onClick={() => setOpen(false)}
                className="p-0.5 text-th-text-3 hover:text-th-text transition"
                aria-label={t("common.close") || "Close"}
              >
                <X size={14} />
              </button>
            </div>

            {/* Description */}
            {description && description !== metric.descriptionKey && (
              <p className="text-xs text-th-text-2 leading-relaxed">
                {description}
              </p>
            )}

            {/* Current value status */}
            {statusLabel && (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${statusColor}`}>
                  {statusLabel}
                </span>
                {value != null && (
                  <span className="text-xs text-th-text-3">
                    ({value.toFixed(1)}
                    {target != null && ` / ${target}`})
                  </span>
                )}
              </div>
            )}

            {/* Benchmark */}
            {benchmark && benchmark !== metric.benchmarkKey && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {t("help.metric_benchmark_label") || "Good looks like:"}
                </p>
                <p className="text-xs text-th-text-2 mt-0.5">{benchmark}</p>
              </div>
            )}

            {/* Action */}
            {action && action !== metric.actionKey && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {t("help.metric_action_label") || "If it's low:"}
                </p>
                <p className="text-xs text-th-text-2 mt-0.5">{action}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
