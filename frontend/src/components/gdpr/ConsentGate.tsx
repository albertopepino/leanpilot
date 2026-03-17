"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/stores/useI18n";
import Logo from "@/components/ui/Logo";

export default function ConsentGate({ children }: { children: React.ReactNode }) {
  const { user, acceptConsent, logout } = useAuth();
  const { t } = useI18n();
  const [aiConsent, setAiConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // If user doesn't need consent, render children normally
  if (!user?.needs_consent) {
    return <>{children}</>;
  }

  const canSubmit = privacyAccepted && termsAccepted && !submitting;

  const handleAccept = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await acceptConsent({
        privacy_policy_accepted: true,
        terms_accepted: true,
        ai_consent: aiConsent,
        marketing_consent: marketingConsent,
      });
    } catch {
      setError(t("consent.error"));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 via-[#1e1b4b] to-brand-800 p-4">
      <div className="w-full max-w-lg bg-th-bg-2 rounded-2xl shadow-2xl border border-th-border overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-500 p-6 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Logo size={26} />
            </div>
            <div>
              <h1 className="text-lg font-bold">LeanPilot</h1>
              <p className="text-xs text-white/70">{t("consent.subtitle")}</p>
            </div>
          </div>
          <h2 className="text-xl font-bold">{t("consent.title")}</h2>
          <p className="text-sm text-white/80 mt-1">{t("consent.description")}</p>
        </div>

        {/* Consent form */}
        <div className="p-6 space-y-4" role="form" aria-label={t("consent.title")}>
          {/* Required: Privacy Policy */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-th-border hover:bg-th-bg transition cursor-pointer">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              aria-required="true"
            />
            <div>
              <span className="text-sm font-medium text-th-text">
                {t("consent.privacyPolicy")} <span className="text-red-500">*</span>
              </span>
              <p className="text-xs text-th-text-2 mt-0.5">{t("consent.privacyPolicyDesc")}</p>
            </div>
          </label>

          {/* Required: Terms of Service */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-th-border hover:bg-th-bg transition cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              aria-required="true"
            />
            <div>
              <span className="text-sm font-medium text-th-text">
                {t("consent.termsOfService")} <span className="text-red-500">*</span>
              </span>
              <p className="text-xs text-th-text-2 mt-0.5">{t("consent.termsOfServiceDesc")}</p>
            </div>
          </label>

          {/* Optional: AI Processing */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-th-border hover:bg-th-bg transition cursor-pointer">
            <input
              type="checkbox"
              checked={aiConsent}
              onChange={(e) => setAiConsent(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <span className="text-sm font-medium text-th-text">{t("consent.aiProcessing")}</span>
              <p className="text-xs text-th-text-2 mt-0.5">{t("consent.aiProcessingDesc")}</p>
            </div>
          </label>

          {/* Optional: Marketing */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-th-border hover:bg-th-bg transition cursor-pointer">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <span className="text-sm font-medium text-th-text">{t("consent.marketing")}</span>
              <p className="text-xs text-th-text-2 mt-0.5">{t("consent.marketingDesc")}</p>
            </div>
          </label>

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-xl">
              {error}
            </div>
          )}

          <p className="text-xs text-th-text-3">
            {t("consent.gdprNote")}
          </p>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAccept}
              disabled={!canSubmit}
              className="flex-1 bg-gradient-to-r from-brand-600 to-brand-500 text-white py-3 rounded-xl font-semibold hover:shadow-glow transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t("consent.submitting") : t("consent.accept")}
            </button>
            <button
              onClick={logout}
              className="px-6 py-3 border border-th-border rounded-xl text-sm text-th-text-2 hover:bg-th-bg transition"
            >
              {t("consent.decline")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
