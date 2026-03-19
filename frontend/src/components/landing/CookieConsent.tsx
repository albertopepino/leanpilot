"use client";
import { useState, useEffect, useCallback } from "react";

interface Props {
  t: (key: string) => string;
}

interface CookieSettingsButtonProps {
  label?: string;
  className?: string;
}

/**
 * GDPR/ePrivacy compliant cookie consent banner.
 * - Essential cookies: always enabled (session, security, language preference)
 * - Analytics cookies: opt-in only (GDPR Art. 6(1)(a) — explicit consent)
 * - No pre-ticked boxes (CJEU Planet49 ruling)
 * - Consent stored in localStorage (not in a cookie itself)
 * - Easy to withdraw consent (GDPR Art. 7(3))
 *
 * ZZLP (Serbian DPA) compatible — follows same opt-in consent model.
 */
export default function CookieConsent({ t }: Props) {
  const [show, setShow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem("leanpilot_cookie_consent");
    if (!consent) {
      // Small delay for UX — don't flash immediately
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (analyticsAccepted: boolean) => {
    const consentRecord = {
      essential: true, // Always required
      analytics: analyticsAccepted,
      timestamp: new Date().toISOString(),
      version: "1.0",
    };
    localStorage.setItem("leanpilot_cookie_consent", JSON.stringify(consentRecord));

    // If analytics accepted, you would initialize analytics here
    // e.g., window.gtag?.('consent', 'update', { analytics_storage: 'granted' });

    setShow(false);
  };

  // Allow external re-open via custom event (used by CookieSettingsButton)
  useEffect(() => {
    const handler = () => {
      setShow(true);
      setShowSettings(true);
    };
    window.addEventListener("leanpilot:open-cookie-settings", handler);
    return () => window.removeEventListener("leanpilot:open-cookie-settings", handler);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6">
      <div className="max-w-2xl mx-auto bg-[#111827] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-6">
        {showSettings ? (
          /* Detailed cookie settings */
          <div className="space-y-4">
            <h3 className="font-bold text-white text-sm">{t("cookie.settings")}</h3>

            {/* Essential — always on, cannot be disabled */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <p className="text-sm text-white font-medium">{t("cookie.essentialTitle")}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t("cookie.essentialDesc")}</p>
              </div>
              <div className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full">
                {t("cookie.alwaysOn")}
              </div>
            </div>

            {/* Analytics — opt-in */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-white font-medium">{t("cookie.analyticsTitle")}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t("cookie.analyticsDesc")}</p>
              </div>
              <button
                onClick={() => setAnalytics(!analytics)}
                className={`w-12 h-6 rounded-full transition-all ${
                  analytics ? "bg-indigo-600" : "bg-gray-700"
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    analytics ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => saveConsent(analytics)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 rounded-xl transition"
              >
                {t("cookie.save")}
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 text-sm text-gray-400 hover:text-white transition"
              >
                {t("cookie.back")}
              </button>
            </div>
          </div>
        ) : (
          /* Simple consent banner */
          <div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">🍪</span>
              <div className="flex-1">
                <h3 className="font-bold text-white text-sm">{t("cookie.title")}</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {t("cookie.text")}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => saveConsent(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
              >
                {t("cookie.accept")}
              </button>
              <button
                onClick={() => saveConsent(false)}
                className="bg-white/10 hover:bg-white/15 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition border border-white/10"
              >
                {t("cookie.reject")}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="text-sm text-gray-500 hover:text-white px-3 py-2.5 transition underline"
              >
                {t("cookie.settings")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Small "Cookie Settings" link/button that re-opens the cookie consent banner.
 * GDPR Art. 7(3) — users must be able to withdraw consent as easily as they gave it.
 * Import and place this in any footer or settings page.
 */
export function CookieSettingsButton({
  label = "Cookie Settings",
  className,
}: CookieSettingsButtonProps) {
  const handleClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent("leanpilot:open-cookie-settings"));
  }, []);

  return (
    <button
      onClick={handleClick}
      className={
        className ??
        "text-xs text-gray-500 hover:text-white transition underline cursor-pointer"
      }
      type="button"
    >
      {label}
    </button>
  );
}
