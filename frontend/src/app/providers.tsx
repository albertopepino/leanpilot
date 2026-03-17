"use client";
import { useEffect } from "react";
import { useTheme } from "@/stores/useTheme";
import { useI18n } from "@/stores/useI18n";
import { useCurrency } from "@/stores/useCurrency";

export default function Providers({ children }: { children: React.ReactNode }) {
  const initTheme = useTheme((s) => s.initTheme);
  const initLocale = useI18n((s) => s.initLocale);
  const locale = useI18n((s) => s.locale);
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

  // Sync <html lang> attribute with current locale (WCAG 3.1.1)
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <>{children}</>;
}
