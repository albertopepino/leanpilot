"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import {
  Hand,
  RefreshCw,
  Compass,
  ClipboardList,
  FileText,
  Gauge,
  Clock,
  FlaskConical,
  HelpCircle,
  Fish,
  Lightbulb,
  Wrench,
  Sparkles,
  Bot,
  Rocket,
  ArrowRight,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OnboardingProps {
  onNavigate: (view: string) => void;
  onComplete: () => void;
}

interface TutorialStep {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  image?: string;
  highlightView?: string;
  category: "welcome" | "define" | "measure" | "analyze" | "improve" | "control";
}

/* ------------------------------------------------------------------ */
/*  Steps Configuration                                                */
/* ------------------------------------------------------------------ */

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    icon: Hand,
    titleKey: "onboarding.welcomeTitle",
    descriptionKey: "onboarding.welcomeDesc",
    category: "welcome",
  },
  {
    id: "dmaic",
    icon: RefreshCw,
    titleKey: "onboarding.dmaicTitle",
    descriptionKey: "onboarding.dmaicDesc",
    category: "welcome",
  },
  {
    id: "assessment",
    icon: Compass,
    titleKey: "onboarding.assessmentTitle",
    descriptionKey: "onboarding.assessmentDesc",
    highlightView: "assessment",
    category: "welcome",
  },
  {
    id: "production-orders",
    icon: ClipboardList,
    titleKey: "onboarding.productionOrdersTitle",
    descriptionKey: "onboarding.productionOrdersDesc",
    highlightView: "production-orders",
    category: "define",
  },
  {
    id: "production-input",
    icon: FileText,
    titleKey: "onboarding.productionInputTitle",
    descriptionKey: "onboarding.productionInputDesc",
    highlightView: "production",
    category: "define",
  },
  {
    id: "oee-dashboard",
    icon: Gauge,
    titleKey: "onboarding.oeeDashboardTitle",
    descriptionKey: "onboarding.oeeDashboardDesc",
    highlightView: "dashboard",
    category: "measure",
  },
  {
    id: "hourly",
    icon: Clock,
    titleKey: "onboarding.hourlyTitle",
    descriptionKey: "onboarding.hourlyDesc",
    highlightView: "hourly",
    category: "measure",
  },
  {
    id: "qc-checks",
    icon: FlaskConical,
    titleKey: "onboarding.qcChecksTitle",
    descriptionKey: "onboarding.qcChecksDesc",
    highlightView: "qc-checks",
    category: "measure",
  },
  {
    id: "five-why",
    icon: HelpCircle,
    titleKey: "onboarding.fiveWhyTitle",
    descriptionKey: "onboarding.fiveWhyDesc",
    highlightView: "five-why",
    category: "analyze",
  },
  {
    id: "ishikawa",
    icon: Fish,
    titleKey: "onboarding.ishikawaTitle",
    descriptionKey: "onboarding.ishikawaDesc",
    highlightView: "ishikawa",
    category: "analyze",
  },
  {
    id: "kaizen",
    icon: Lightbulb,
    titleKey: "onboarding.kaizenTitle",
    descriptionKey: "onboarding.kaizenDesc",
    highlightView: "kaizen",
    category: "improve",
  },
  {
    id: "smed",
    icon: RefreshCw,
    titleKey: "onboarding.smedTitle",
    descriptionKey: "onboarding.smedDesc",
    highlightView: "smed",
    category: "improve",
  },
  {
    id: "tpm",
    icon: Wrench,
    titleKey: "onboarding.tpmTitle",
    descriptionKey: "onboarding.tpmDesc",
    highlightView: "tpm",
    category: "improve",
  },
  {
    id: "six-s",
    icon: Sparkles,
    titleKey: "onboarding.sixSTitle",
    descriptionKey: "onboarding.sixSDesc",
    highlightView: "six-s",
    category: "control",
  },
  {
    id: "copilot",
    icon: Bot,
    titleKey: "onboarding.copilotTitle",
    descriptionKey: "onboarding.copilotDesc",
    highlightView: "copilot",
    category: "welcome",
  },
  {
    id: "finish",
    icon: Rocket,
    titleKey: "onboarding.finishTitle",
    descriptionKey: "onboarding.finishDesc",
    category: "welcome",
  },
];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  welcome: { bg: "bg-brand-500/10", border: "border-brand-500/30", text: "text-brand-500", gradient: "from-brand-500 to-purple-500" },
  define: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-500", gradient: "from-blue-500 to-cyan-500" },
  measure: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-500", gradient: "from-emerald-500 to-teal-500" },
  analyze: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-500", gradient: "from-amber-500 to-orange-500" },
  improve: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-500", gradient: "from-purple-500 to-violet-500" },
  control: { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-500", gradient: "from-rose-500 to-pink-500" },
};

const CATEGORY_LABELS: Record<string, string> = {
  welcome: "onboarding.catWelcome",
  define: "onboarding.catDefine",
  measure: "onboarding.catMeasure",
  analyze: "onboarding.catAnalyze",
  improve: "onboarding.catImprove",
  control: "onboarding.catControl",
};

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "leanpilot_onboarding_complete";

export function isOnboardingComplete(userId?: number): boolean {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId || "anon"}`);
    return raw === "true";
  } catch {
    return false;
  }
}

export function markOnboardingComplete(userId?: number): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId || "anon"}`, "true");
  } catch { /* ignore */ }
}

export function resetOnboarding(userId?: number): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY}_${userId || "anon"}`);
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function OnboardingTutorial({ onNavigate, onComplete }: OnboardingProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const step = TUTORIAL_STEPS[currentStep];
  const Icon = step.icon;
  const totalSteps = TUTORIAL_STEPS.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const colors = CATEGORY_COLORS[step.category];
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  const goNext = useCallback(() => {
    if (isLast) {
      markOnboardingComplete(user?.id);
      onComplete();
      return;
    }
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
      setIsAnimating(false);
    }, 200);
  }, [isLast, user?.id, onComplete, totalSteps]);

  const goBack = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep((s) => Math.max(s - 1, 0));
      setIsAnimating(false);
    }, 200);
  }, []);

  const skip = useCallback(() => {
    markOnboardingComplete(user?.id);
    onComplete();
  }, [user?.id, onComplete]);

  const goToTool = useCallback(() => {
    if (step.highlightView) {
      markOnboardingComplete(user?.id);
      onNavigate(step.highlightView);
      onComplete();
    }
  }, [step, user?.id, onNavigate, onComplete]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") goNext();
      if (e.key === "ArrowLeft") goBack();
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goBack, skip]);

  const userName = user?.full_name?.split(" ")[0] || user?.full_name || "";

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
              {t(CATEGORY_LABELS[step.category])}
            </span>
            <span className="text-[10px] text-th-text-3 font-medium">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>
          <button
            onClick={skip}
            className="text-xs text-th-text-3 hover:text-th-text transition font-medium"
          >
            {t("onboarding.skipTutorial")}
          </button>
        </div>
        <div className="h-1.5 bg-th-bg-3 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${colors.gradient} transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step content card */}
      <div
        className={`relative overflow-hidden rounded-xl border border-th-border bg-th-bg-2 shadow-sm transition-all duration-200 ${
          isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      >
        {/* Decorative gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-[0.03]`} />

        <div className="relative z-10 p-8 md:p-12">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className={`w-20 h-20 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-sm`}>
              <Icon size={24} className="text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl md:text-3xl font-bold text-th-text text-center mb-4">
            {t(step.titleKey).replace("{name}", userName)}
          </h2>

          {/* Description */}
          <p className="text-sm md:text-base text-th-text-2 text-center max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
            {t(step.descriptionKey)}
          </p>

          {/* Try it button */}
          {step.highlightView && (
            <div className="flex justify-center mt-6">
              <button
                onClick={goToTool}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r ${colors.gradient} text-white text-sm font-semibold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all`}
              >
                {t("onboarding.tryItNow")}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={goBack}
          disabled={isFirst}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            isFirst
              ? "opacity-0 cursor-default"
              : "bg-th-bg-2 border border-th-border text-th-text hover:bg-th-bg-3"
          }`}
        >
          <ArrowLeft size={16} />
          {t("common.back").replace("← ", "")}
        </button>

        {/* Step dots */}
        <div className="hidden md:flex items-center gap-1.5">
          {TUTORIAL_STEPS.map((s, idx) => {
            const dotColors = CATEGORY_COLORS[s.category];
            return (
              <button
                key={s.id}
                onClick={() => { setIsAnimating(true); setTimeout(() => { setCurrentStep(idx); setIsAnimating(false); }, 200); }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? `w-6 bg-gradient-to-r ${dotColors.gradient}`
                    : idx < currentStep
                    ? `bg-gradient-to-r ${dotColors.gradient} opacity-40`
                    : "bg-th-bg-3"
                }`}
                title={t(s.titleKey)}
              />
            );
          })}
        </div>

        <button
          onClick={goNext}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm hover:shadow-md hover:scale-[1.02] transition-all bg-gradient-to-r ${colors.gradient}`}
        >
          {isLast ? t("onboarding.getStarted") : t("common.next")}
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Keyboard hint */}
      <p className="text-center text-[10px] text-th-text-3 mt-4 opacity-60">
        {t("onboarding.keyboardHint")}
      </p>
    </div>
  );
}
