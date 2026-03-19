"use client";
import { useEffect } from "react";
import { useTheme } from "@/stores/useTheme";
import { useI18n } from "@/stores/useI18n";
import { useCurrency } from "@/stores/useCurrency";
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

  useEffect(() => {
    initTheme();
    initLocale();
    initCurrency();

    // Register PWA service worker for offline tablet support
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed — not critical
      });
    }
  }, [initTheme, initLocale, initCurrency]);

  // Sync <html lang> and dir attributes with current locale (WCAG 3.1.1)
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  return <SentryErrorBoundary>{children}</SentryErrorBoundary>;
}
