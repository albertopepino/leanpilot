"use client";
import { useEffect } from "react";
import { useTheme } from "@/stores/useTheme";
import { useI18n } from "@/stores/useI18n";
import { useCurrency } from "@/stores/useCurrency";
import { useBeginnerMode } from "@/stores/useBeginnerMode";
import { useAchievements } from "@/stores/useAchievements";
import "@/lib/sentry"; // Initialize Sentry error tracking (no-op if DSN not set)
import { Sentry } from "@/lib/sentry";

function SentryErrorBoundary({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN && Sentry.ErrorBoundary) {
    return (
      <Sentry.ErrorBoundary fallback={<p>An error occurred.</p>}>
        {children}
      </Sentry.ErrorBoundary>
    );
  }
  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const initTheme = useTheme((s) => s.initTheme);
  const initLocale = useI18n((s) => s.initLocale);
  const locale = useI18n((s) => s.locale);
  const direction = useI18n((s) => s.direction);
  const initCurrency = useCurrency((s) => s.initCurrency);
  const initBeginnerMode = useBeginnerMode((s) => s.initBeginnerMode);
  const initAchievements = useAchievements((s) => s.initAchievements);
  const unlockAchievement = useAchievements((s) => s.unlock);

  useEffect(() => {
    initTheme();
    initLocale();
    initCurrency();
    initBeginnerMode();
    initAchievements();

    // Login streak tracking
    if (typeof window !== "undefined") {
      const LAST_LOGIN_KEY = "leanpilot_last_login_date";
      const STREAK_KEY = "leanpilot_login_streak";

      const today = new Date().toISOString().split("T")[0];
      const lastLogin = localStorage.getItem(LAST_LOGIN_KEY);

      if (lastLogin !== today) {
        let streak = parseInt(localStorage.getItem(STREAK_KEY) || "0", 10);

        if (lastLogin) {
          const lastDate = new Date(lastLogin);
          const todayDate = new Date(today);
          const diffMs = todayDate.getTime() - lastDate.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            streak += 1;
          } else {
            streak = 1;
          }
        } else {
          streak = 1;
        }

        localStorage.setItem(LAST_LOGIN_KEY, today);
        localStorage.setItem(STREAK_KEY, String(streak));

        if (streak >= 7) unlockAchievement("streak-7");
        if (streak >= 30) unlockAchievement("streak-30");
      }

      // Unlock first-login achievement
      unlockAchievement("first-login");
    }

    // Register PWA service worker for offline tablet support
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed — not critical
      });
    }
  }, [initTheme, initLocale, initCurrency, initBeginnerMode, initAchievements, unlockAchievement]);

  // Sync <html lang> and dir attributes with current locale (WCAG 3.1.1)
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  return <SentryErrorBoundary>{children}</SentryErrorBoundary>;
}
