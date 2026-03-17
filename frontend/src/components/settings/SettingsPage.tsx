"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, Locale } from "@/stores/useI18n";
import { useTheme } from "@/stores/useTheme";
import { authApi, adminApi } from "@/lib/api";
import { useCurrency, CURRENCIES } from "@/stores/useCurrency";
import { useCompanyBranding } from "@/stores/useCompanyBranding";
import LogoUpload from "@/components/settings/LogoUpload";
import TwoFactorSetup from "@/components/settings/TwoFactorSetup";
import { resetOnboarding } from "@/components/onboarding/OnboardingTutorial";

export default function SettingsPage() {
  const { user, loadUser } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const { logoUrl, fetchLogo, clearLogo } = useCompanyBranding();

  // Profile
  const [fullName, setFullName] = useState("");
  const [language, setLanguage] = useState<Locale>("en");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Consent
  const [aiConsent, setAiConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentMsg, setConsentMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Factory info
  const [factoryName, setFactoryName] = useState("");

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setLanguage((user.language || "en") as Locale);
      setAiConsent((user as any).ai_consent || false);
      setMarketingConsent((user as any).marketing_consent || false);
    }
    adminApi.getFactory().then((r) => {
      setFactoryName((r.data as any)?.name || "");
    }).catch(() => {});
    fetchLogo();
  }, [user]);

  const handleDeleteLogo = async () => {
    try {
      await adminApi.deleteLogo();
      clearLogo();
    } catch { /* ignore */ }
  };

  // Save profile
  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await authApi.updateProfile({ full_name: fullName, language });
      setLocale(language);
      await loadUser();
      setProfileMsg({ type: "ok", text: t("common.saved") });
    } catch (e: any) {
      setProfileMsg({ type: "err", text: e?.response?.data?.detail || t("common.saveFailed") });
    }
    setProfileSaving(false);
  };

  // Change password
  const changePassword = async () => {
    if (newPw !== confirmPw) {
      setPwMsg({ type: "err", text: t("settings.passwordMismatch") });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await authApi.changePassword({ current_password: currentPw, new_password: newPw });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwMsg({ type: "ok", text: t("settings.passwordChanged") });
    } catch (e: any) {
      setPwMsg({ type: "err", text: e?.response?.data?.detail || t("common.saveFailed") });
    }
    setPwSaving(false);
  };

  // Save consent
  const saveConsent = async () => {
    setConsentSaving(true);
    setConsentMsg(null);
    try {
      await authApi.updateConsent({ ai_consent: aiConsent, marketing_consent: marketingConsent });
      await loadUser();
      setConsentMsg({ type: "ok", text: t("common.saved") });
    } catch (e: any) {
      setConsentMsg({ type: "err", text: e?.response?.data?.detail || t("common.saveFailed") });
    }
    setConsentSaving(false);
  };

  // Export data
  const exportData = async () => {
    try {
      const res = await adminApi.exportData();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `leanpilot-data-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert(t("common.saveFailed"));
    }
  };

  const roleLabels: Record<string, string> = {
    admin: t("settings.roleAdmin"),
    plant_manager: t("settings.rolePlantManager"),
    line_supervisor: t("settings.roleLineSupervisor"),
    operator: t("settings.roleOperator"),
    viewer: t("settings.roleViewer"),
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-th-text">{t("settings.title")}</h1>
        <p className="text-sm text-th-text-2 mt-1">{t("settings.subtitle")}</p>
      </div>

      {/* Profile Section */}
      <section className="bg-th-bg-2 rounded-2xl border border-th-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <span className="text-xl">👤</span> {t("settings.profile")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.fullName")}</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 bg-th-bg border border-th-border rounded-xl text-th-text focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.email")}</label>
            <input
              type="text"
              value={user?.email || ""}
              disabled
              className="w-full px-3 py-2 bg-th-bg-3 border border-th-border rounded-xl text-th-text-2 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.role")}</label>
            <input
              type="text"
              value={roleLabels[user?.role || ""] || user?.role || ""}
              disabled
              className="w-full px-3 py-2 bg-th-bg-3 border border-th-border rounded-xl text-th-text-2 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.factoryName")}</label>
            <input
              type="text"
              value={factoryName}
              disabled
              className="w-full px-3 py-2 bg-th-bg-3 border border-th-border rounded-xl text-th-text-2 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveProfile}
            disabled={profileSaving}
            className="px-5 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition"
          >
            {profileSaving ? t("common.saving") : t("common.save")}
          </button>
          {profileMsg && (
            <span className={`text-sm ${profileMsg.type === "ok" ? "text-emerald-500" : "text-red-500"}`}>
              {profileMsg.text}
            </span>
          )}
        </div>
      </section>

      {/* Appearance Section */}
      <section className="bg-th-bg-2 rounded-2xl border border-th-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <span className="text-xl">🎨</span> {t("settings.appearance")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-2">{t("settings.language")}</label>
            <div className="flex gap-2 flex-wrap">
              {([
                { code: "en" as Locale, flag: "🇬🇧", label: "English" },
                { code: "it" as Locale, flag: "🇮🇹", label: "Italiano" },
                { code: "de" as Locale, flag: "🇩🇪", label: "Deutsch" },
                { code: "es" as Locale, flag: "🇪🇸", label: "Espanol" },
                { code: "fr" as Locale, flag: "🇫🇷", label: "Francais" },
                { code: "pl" as Locale, flag: "🇵🇱", label: "Polski" },
                { code: "sr" as Locale, flag: "🇷🇸", label: "Srpski" },
              ]).map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setLocale(lang.code);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition font-medium ${
                    locale === lang.code
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300"
                      : "border-th-border bg-th-bg text-th-text-2 hover:border-brand-300"
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-2">{t("settings.theme")}</label>
            <div className="flex gap-2">
              {([
                { id: "light" as const, icon: "☀️", labelKey: "settings.themeLight" },
                { id: "dark" as const, icon: "🌙", labelKey: "settings.themeDark" },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition font-medium ${
                    theme === opt.id
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300"
                      : "border-th-border bg-th-bg text-th-text-2 hover:border-brand-300"
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span>{t(opt.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Currency */}
        <div className="pt-2">
          <label className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.currency")}</label>
          <p className="text-xs text-th-text-3 mb-2">{t("settings.currencyDesc")}</p>
          <select
            value={currency.code}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full max-w-xs px-3 py-2 bg-th-bg border border-th-border rounded-xl text-th-text focus:ring-2 focus:ring-brand-500 outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} — {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Company Branding — admin only */}
      {user?.role === "admin" && (
        <section className="bg-th-bg-2 rounded-2xl border border-th-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
            <span className="text-xl">{"\u{1F3ED}"}</span> {t("settings.companyBranding")}
          </h2>
          <p className="text-sm text-th-text-3">{t("settings.logoHint")}</p>
          {logoUrl && (
            <div className="flex items-center gap-4">
              <img
                src={logoUrl}
                alt="Company logo"
                className="h-16 max-w-[200px] object-contain rounded-lg border border-th-border bg-white p-2"
              />
              <button
                onClick={handleDeleteLogo}
                className="text-sm text-red-500 hover:text-red-700 transition"
              >
                {t("settings.removeLogo")}
              </button>
            </div>
          )}
          <LogoUpload onUploadSuccess={fetchLogo} />
        </section>
      )}

      {/* Password Section */}
      <section className="bg-th-bg-2 rounded-2xl border border-th-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <span className="text-xl">🔒</span> {t("settings.security")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.currentPassword")}</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full px-3 py-2 bg-th-bg border border-th-border rounded-xl text-th-text focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.newPassword")}</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full px-3 py-2 bg-th-bg border border-th-border rounded-xl text-th-text focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.confirmPassword")}</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full px-3 py-2 bg-th-bg border border-th-border rounded-xl text-th-text focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>

        <p className="text-xs text-th-text-3">{t("settings.passwordRequirements")}</p>

        <div className="flex items-center gap-3">
          <button
            onClick={changePassword}
            disabled={pwSaving || !currentPw || !newPw || !confirmPw}
            className="px-5 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition"
          >
            {pwSaving ? t("common.saving") : t("settings.changePassword")}
          </button>
          {pwMsg && (
            <span className={`text-sm ${pwMsg.type === "ok" ? "text-emerald-500" : "text-red-500"}`}>
              {pwMsg.text}
            </span>
          )}
        </div>
      </section>

      {/* Two-Factor Authentication */}
      <TwoFactorSetup />

      {/* Privacy & Consent Section */}
      <section className="bg-th-bg-2 rounded-2xl border border-th-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <span className="text-xl">🛡️</span> {t("settings.privacy")}
        </h2>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={aiConsent}
              onChange={(e) => setAiConsent(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-th-border text-brand-600 focus:ring-brand-500"
            />
            <div>
              <p className="text-sm font-medium text-th-text group-hover:text-brand-600 transition">{t("settings.aiConsentLabel")}</p>
              <p className="text-xs text-th-text-3">{t("settings.aiConsentDesc")}</p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-th-border text-brand-600 focus:ring-brand-500"
            />
            <div>
              <p className="text-sm font-medium text-th-text group-hover:text-brand-600 transition">{t("settings.marketingConsentLabel")}</p>
              <p className="text-xs text-th-text-3">{t("settings.marketingConsentDesc")}</p>
            </div>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveConsent}
            disabled={consentSaving}
            className="px-5 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition"
          >
            {consentSaving ? t("common.saving") : t("settings.savePreferences")}
          </button>
          {consentMsg && (
            <span className={`text-sm ${consentMsg.type === "ok" ? "text-emerald-500" : "text-red-500"}`}>
              {consentMsg.text}
            </span>
          )}
        </div>
      </section>

      {/* Data & Export Section */}
      <section className="bg-th-bg-2 rounded-2xl border border-th-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <span className="text-xl">📦</span> {t("settings.dataExport")}
        </h2>
        <p className="text-sm text-th-text-2">{t("settings.dataExportDesc")}</p>
        <button
          onClick={exportData}
          className="px-5 py-2 bg-th-bg border border-th-border text-th-text rounded-xl font-medium hover:bg-th-bg-3 transition"
        >
          {t("settings.downloadMyData")}
        </button>
      </section>

      {/* Tutorial */}
      <section className="bg-th-bg-2 rounded-2xl border border-th-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <span className="text-xl">🎓</span> {t("settings.tutorial") || "Tutorial"}
        </h2>
        <p className="text-sm text-th-text-2">{t("settings.tutorialDesc") || "Replay the onboarding tutorial to learn about all available tools."}</p>
        <button
          onClick={() => { resetOnboarding(user?.id); window.location.hash = ""; window.location.reload(); }}
          className="px-5 py-2 bg-gradient-to-r from-brand-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg hover:scale-[1.02] transition-all"
        >
          {t("settings.replayTutorial") || "Replay Tutorial"}
        </button>
      </section>

      {/* App Info */}
      <section className="bg-th-bg-2 rounded-2xl border border-th-border p-6">
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2 mb-3">
          <span className="text-xl">ℹ️</span> {t("settings.about")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-th-text-3">{t("settings.version")}</p>
            <p className="font-medium text-th-text">1.0.0</p>
          </div>
          <div>
            <p className="text-th-text-3">{t("settings.plan")}</p>
            <p className="font-medium text-th-text">Professional</p>
          </div>
          <div>
            <p className="text-th-text-3">{t("settings.userId")}</p>
            <p className="font-medium text-th-text">#{user?.id}</p>
          </div>
          <div>
            <p className="text-th-text-3">{t("settings.factoryId")}</p>
            <p className="font-medium text-th-text">#{user?.factory_id}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
