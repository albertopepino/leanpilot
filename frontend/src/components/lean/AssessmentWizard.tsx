"use client";
import { useState, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import {
  ClipboardList, ChevronLeft, ChevronRight, Loader2,
  CheckCircle, AlertTriangle, Check,
} from "lucide-react";
import { CATEGORIES, TOTAL_QUESTIONS, type AssessmentResult, scoreToLevel } from "./assessment-data";
import { getCategoryIcon } from "./assessment-icons";

interface Props {
  onComplete: (result: AssessmentResult) => void;
  saving: boolean;
  error: string | null;
}

export default function AssessmentWizard({ onComplete, saving, error }: Props) {
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const currentCategory = CATEGORIES[currentStep];
  const sectionComplete = currentCategory?.questions.every((q) => answers[q.id] !== undefined) ?? false;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === TOTAL_QUESTIONS;

  // Compute question number offset up to current step
  const questionOffset = CATEGORIES.slice(0, currentStep).reduce((s, c) => s + c.questions.length, 0);

  const handleAnswer = useCallback((questionId: string, level: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: level }));
  }, []);

  const goNext = useCallback(() => {
    if (sectionComplete) setCompletedSteps((prev) => new Set(prev).add(currentStep));
    if (currentStep < CATEGORIES.length - 1) {
      setCurrentStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep, sectionComplete]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep]);

  const jumpToStep = useCallback((step: number) => {
    if (step <= currentStep || completedSteps.has(step) || completedSteps.has(step - 1) || step === 0) {
      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep, completedSteps]);

  const handleSubmit = useCallback(() => {
    const categoryScores = CATEGORIES.map((cat) => {
      const catAnswers = cat.questions.map((q) => answers[q.id] || 1);
      const avg = catAnswers.reduce((s, v) => s + v, 0) / catAnswers.length;
      return {
        id: cat.id,
        titleKey: cat.titleKey,
        score: Math.round(avg * 100) / 100,
        level: scoreToLevel(avg),
      };
    });
    const overallAvg = categoryScores.reduce((s, c) => s + c.score, 0) / categoryScores.length;
    onComplete({
      answers,
      categoryScores,
      overallScore: Math.round(overallAvg * 100) / 100,
      overallLevel: scoreToLevel(overallAvg),
      completedAt: new Date().toISOString(),
    });
  }, [answers, onComplete]);

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-6">
      {/* Title */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <ClipboardList className="w-6 h-6 text-th-accent" />
          <h1 className="text-2xl font-bold text-th-text">{t("assessment.title")}</h1>
        </div>
        <p className="text-sm text-th-text-3 max-w-lg mx-auto">{t("assessment.subtitle")}</p>
      </div>

      {/* Progress bar & category navigation */}
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
        {/* Category step indicators */}
        <div className="flex items-center justify-between mb-3 overflow-x-auto gap-0.5">
          {CATEGORIES.map((cat, idx) => {
            const isActive = idx === currentStep;
            const isDone = completedSteps.has(idx);
            const isAccessible = idx <= currentStep || isDone || completedSteps.has(idx - 1) || idx === 0;
            return (
              <button
                key={cat.id}
                onClick={() => isAccessible && jumpToStep(idx)}
                disabled={!isAccessible}
                className={`flex flex-col items-center gap-1 transition flex-1 min-w-0 ${!isAccessible ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                title={t(`assessment.${cat.titleKey}`)}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isActive ? "bg-indigo-500 text-white ring-2 ring-indigo-300 dark:ring-indigo-700 scale-110"
                    : isDone ? "bg-emerald-500 text-white"
                    : "bg-th-bg-3 text-th-text-3"
                }`}>
                  {isDone ? <Check className="w-4 h-4" /> : getCategoryIcon(cat.iconName, "w-3.5 h-3.5")}
                </div>
                <span className={`text-[9px] leading-tight text-center hidden lg:block truncate w-full ${
                  isActive ? "text-indigo-600 dark:text-indigo-400 font-semibold" : "text-th-text-3"
                }`}>
                  {t(`assessment.${cat.titleKey}`)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Overall progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-th-bg-3 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${(answeredCount / TOTAL_QUESTIONS) * 100}%` }} />
          </div>
          <span className="text-xs text-th-text-3 whitespace-nowrap">
            {t("assessment.progressLabel", { answered: String(answeredCount), total: String(TOTAL_QUESTIONS) })}
          </span>
        </div>
      </div>

      {/* Section header */}
      <div className="flex items-center gap-3">
        <span className={`${currentCategory.color} ${currentCategory.colorDark}`}>
          {getCategoryIcon(currentCategory.iconName, "w-5 h-5")}
        </span>
        <div>
          <h2 className="text-lg font-bold text-th-text">{t(`assessment.${currentCategory.titleKey}`)}</h2>
          <p className="text-sm text-th-text-3">{t(`assessment.${currentCategory.descKey}`)}</p>
        </div>
        <span className="ml-auto text-xs text-th-text-3 bg-th-bg-2 border border-th-border rounded-full px-3 py-1">
          {t("assessment.sectionOf", { current: String(currentStep + 1) })}
        </span>
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {currentCategory.questions.map((q, qi) => {
          const selected = answers[q.id];
          return (
            <div key={q.id} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">
                  {questionOffset + qi + 1}
                </span>
                <h3 className="text-sm font-semibold text-th-text leading-snug pt-0.5">
                  {t(`assessment.${q.questionKey}`)}
                </h3>
              </div>
              <div className="space-y-2 ml-10">
                {q.options.map((opt) => {
                  const isSelected = selected === opt.level;
                  return (
                    <button
                      key={opt.level}
                      onClick={() => handleAnswer(q.id, opt.level)}
                      className={`w-full text-left rounded-lg p-3 border-2 transition-all ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/20 shadow-sm"
                          : "border-th-border bg-th-bg-2 hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-th-bg-3"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                          isSelected ? "border-indigo-500 bg-indigo-500 text-white" : "border-th-border text-th-text-3"
                        }`}>
                          {isSelected ? <Check className="w-3 h-3" /> : opt.level}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-th-text"}`}>
                            {t(`assessment.${opt.labelKey}`)}
                          </div>
                          <div className="text-xs text-th-text-3 mt-0.5 leading-relaxed">
                            {t(`assessment.${opt.descKey}`)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <button onClick={goPrev} disabled={currentStep === 0}
          className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
            currentStep === 0 ? "opacity-30 cursor-not-allowed text-th-text-3"
              : "text-th-text-2 bg-th-bg-2 border border-th-border hover:bg-th-bg-3"
          }`}>
          <ChevronLeft className="w-4 h-4" /> {t("assessment.prevSection")}
        </button>

        {currentStep < CATEGORIES.length - 1 ? (
          <button onClick={goNext} disabled={!sectionComplete}
            className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
              sectionComplete ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm"
                : "opacity-40 cursor-not-allowed bg-indigo-500/50 text-white/70"
            }`}>
            {t("assessment.nextSection")} <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!allAnswered || saving}
            className={`inline-flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold transition ${
              allAnswered && !saving ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm"
                : "opacity-40 cursor-not-allowed bg-emerald-500/50 text-white/70"
            }`}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("assessment.saving")}</>
              : <><CheckCircle className="w-4 h-4" /> {t("assessment.seeResults")}</>}
          </button>
        )}
      </div>
    </div>
  );
}
