"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { leanApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/formatters";
import { Loader2 } from "lucide-react";
import { scoreToLevel, type AssessmentResult, type WizardPhase } from "./assessment-data";
import AssessmentWizard from "./AssessmentWizard";
import AssessmentResults from "./AssessmentResults";

// ─── Main Assessment Orchestrator ────────────────────────────────────────────
export default function LeanAssessment() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<WizardPhase>("loading");
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [allResults, setAllResults] = useState<AssessmentResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScores, setAutoScores] = useState<Record<string, { count: number; score: number }> | null>(null);

  // Load latest assessment on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await leanApi.getLatestAssessment();
        if (!cancelled && res.data) {
          const raw = res.data;
          const data: AssessmentResult = {
            answers: raw.answers || {},
            categoryScores: Array.isArray(raw.categoryScores) ? raw.categoryScores : [],
            overallScore: raw.overallScore ?? raw.overall_score ?? 0,
            overallLevel: raw.overallLevel ?? raw.overall_level ?? 1,
            completedAt: raw.completedAt ?? raw.completed_at ?? raw.created_at ?? "",
          };
          if (data.overallLevel < 1 || data.overallLevel > 5) {
            data.overallLevel = scoreToLevel(data.overallScore);
          }
          setResult(data);
          setPhase("results");
        } else if (!cancelled) {
          setPhase("wizard");
        }
      } catch {
        if (!cancelled) setPhase("wizard");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load history
  useEffect(() => {
    (async () => {
      try {
        const res = await leanApi.getAssessment();
        if (res.data && Array.isArray(res.data)) {
          const mapped: AssessmentResult[] = res.data.map((raw: Record<string, unknown>) => ({
            answers: (raw.answers as Record<string, number>) || {},
            categoryScores: Array.isArray(raw.categoryScores) ? raw.categoryScores as AssessmentResult["categoryScores"] : [],
            overallScore: (raw.overallScore ?? raw.overall_score ?? 0) as number,
            overallLevel: (raw.overallLevel ?? raw.overall_level ?? 1) as number,
            completedAt: ((raw.completedAt ?? raw.completed_at ?? raw.created_at) as string) || "",
          }));
          setAllResults(mapped);
        }
      } catch {
        // History not available -- OK
      }
    })();
  }, [result]); // re-fetch when a new result is saved

  // Fetch auto-score from tool usage
  useEffect(() => {
    (async () => {
      try {
        const res = await leanApi.getAutoScore();
        if (res.data?.categories) {
          setAutoScores(res.data.categories);
        }
      } catch {
        // Auto-score not available -- OK
      }
    })();
  }, []);

  // Handle wizard completion
  const handleComplete = useCallback(async (computed: AssessmentResult) => {
    setSaving(true);
    setError(null);
    try {
      await leanApi.saveAssessment(computed);
      setResult(computed);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("assessment.saveError")));
    } finally {
      setSaving(false);
    }
  }, [t]);

  // Handle retake
  const handleRetake = useCallback(() => {
    setResult(null);
    setPhase("wizard");
  }, []);

  // Loading state
  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <span className="text-sm text-th-text-3">{t("assessment.loading")}</span>
        </div>
      </div>
    );
  }

  // Results view
  if (phase === "results" && result) {
    return (
      <AssessmentResults
        result={result}
        allResults={allResults}
        autoScores={autoScores}
        onRetake={handleRetake}
      />
    );
  }

  // Wizard view
  return (
    <AssessmentWizard
      onComplete={handleComplete}
      saving={saving}
      error={error}
    />
  );
}
