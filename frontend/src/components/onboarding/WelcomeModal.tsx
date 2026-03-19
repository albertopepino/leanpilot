"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { Target, Wrench, Rocket, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Storage                                                            */
/* ------------------------------------------------------------------ */

const WELCOMED_KEY = "leanpilot_welcomed";

function hasBeenWelcomed(userId?: number): boolean {
  try {
    return localStorage.getItem(`${WELCOMED_KEY}_${userId || "anon"}`) === "true";
  } catch {
    return false;
  }
}

function markWelcomed(userId?: number): void {
  try {
    localStorage.setItem(`${WELCOMED_KEY}_${userId || "anon"}`, "true");
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useWelcomeModal() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!hasBeenWelcomed(user.id)) {
      setShow(true);
    }
  }, [user]);

  const dismiss = useCallback(() => {
    markWelcomed(user?.id);
    setShow(false);
  }, [user?.id]);

  return { show, dismiss };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface WelcomeModalProps {
  onClose: () => void;
  onTour: () => void;
  onSetup: () => void;
}

export default function WelcomeModal({ onClose, onTour, onSetup }: WelcomeModalProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const [dontShow, setDontShow] = useState(false);

  // Focus trap: focus first element on mount
  useEffect(() => {
    firstFocusRef.current?.focus();
  }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dontShow]);

  const handleDismiss = useCallback(() => {
    if (dontShow) markWelcomed(user?.id);
    onClose();
  }, [dontShow, user?.id, onClose]);

  const handleTour = useCallback(() => {
    markWelcomed(user?.id);
    onTour();
  }, [user?.id, onTour]);

  const handleSetup = useCallback(() => {
    markWelcomed(user?.id);
    onSetup();
  }, [user?.id, onSetup]);

  const handleJumpIn = useCallback(() => {
    markWelcomed(user?.id);
    onClose();
  }, [user?.id, onClose]);

  const options = [
    {
      key: "tour",
      icon: Target,
      emoji: "\uD83C\uDFAF",
      titleKey: "onboarding.welcomeOptionTour",
      descKey: "onboarding.welcomeOptionTourDesc",
      onClick: handleTour,
      gradient: "from-blue-500 to-cyan-500",
      hoverBorder: "hover:border-blue-500/40",
    },
    {
      key: "setup",
      icon: Wrench,
      emoji: "\uD83D\uDD27",
      titleKey: "onboarding.welcomeOptionSetup",
      descKey: "onboarding.welcomeOptionSetupDesc",
      onClick: handleSetup,
      gradient: "from-amber-500 to-orange-500",
      hoverBorder: "hover:border-amber-500/40",
    },
    {
      key: "jump",
      icon: Rocket,
      emoji: "\uD83D\uDE80",
      titleKey: "onboarding.welcomeOptionJump",
      descKey: "onboarding.welcomeOptionJumpDesc",
      onClick: handleJumpIn,
      gradient: "from-emerald-500 to-teal-500",
      hoverBorder: "hover:border-emerald-500/40",
    },
  ];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("onboarding.welcomeAriaLabel") || "Welcome to LeanPilot"}
      onClick={(e) => {
        if (e.target === overlayRef.current) handleDismiss();
      }}
    >
      <div className="relative w-full max-w-lg mx-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute -top-10 right-0 text-white/60 hover:text-white text-xs font-medium flex items-center gap-1 transition"
          aria-label={t("common.close")}
        >
          <X size={14} />
        </button>

        <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-4 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
              <span className="text-xl font-black text-white tracking-tight">LP</span>
            </div>
            <h2 className="text-2xl font-bold text-th-text mb-2">
              {t("onboarding.welcomeTitle", { name: user?.full_name?.split(" ")[0] || "" })}
            </h2>
            <p className="text-sm text-th-text-2 leading-relaxed max-w-sm mx-auto">
              {t("onboarding.welcomeModalDesc") || "Your Lean Manufacturing OS is ready. How would you like to get started?"}
            </p>
          </div>

          {/* Option cards */}
          <div className="px-6 pb-4 space-y-3">
            {options.map((opt, idx) => (
              <button
                key={opt.key}
                ref={idx === 0 ? firstFocusRef : undefined}
                onClick={opt.onClick}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border border-th-border ${opt.hoverBorder} bg-th-bg hover:bg-th-bg-hover transition-all group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
              >
                <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${opt.gradient} flex items-center justify-center shrink-0`}>
                  <span className="text-lg">{opt.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-th-text group-hover:text-brand-500 transition-colors">
                    {t(opt.titleKey)}
                  </p>
                  <p className="text-xs text-th-text-3 mt-0.5">
                    {t(opt.descKey)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Don't show again */}
          <div className="px-6 pb-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
                className="w-4 h-4 rounded border-th-border text-brand-500 focus:ring-brand-500/40"
              />
              <span className="text-xs text-th-text-3 group-hover:text-th-text-2 transition-colors">
                {t("onboarding.welcomeDontShowAgain") || "Don't show this again"}
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
