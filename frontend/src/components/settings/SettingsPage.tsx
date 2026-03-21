"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, Locale } from "@/stores/useI18n";
import { useTheme } from "@/stores/useTheme";
import { authApi, adminApi } from "@/lib/api";
import { useCompanySettings } from "@/stores/useCompanySettings";
import { getErrorMessage } from "@/lib/formatters";
import { useCurrency, CURRENCIES } from "@/stores/useCurrency";
import { useCompanyBranding } from "@/stores/useCompanyBranding";
import LogoUpload from "@/components/settings/LogoUpload";
import TwoFactorSetup from "@/components/settings/TwoFactorSetup";
import { resetOnboarding } from "@/components/onboarding/OnboardingTutorial";
import { useBeginnerMode, saveBeginnerMode } from "@/stores/useBeginnerMode";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  Settings,
  User,
  Palette,
  Globe,
  Sun,
  Moon,
  Building,
  Lock,
  Shield,
  Package,
  GraduationCap,
  Info,
  Download,
} from "lucide-react";

export default function SettingsPage() {
  const { user, loadUser } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const { logoUrl, fetchLogo, clearLogo } = useCompanyBranding();
  const { auditLabel, fetchSettings, setAuditLabel } = useCompanySettings();
  const { enabled: beginnerMode, setEnabled: setBeginnerMode, initBeginnerMode } = useBeginnerMode();

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

  // Confirm dialog
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setLanguage((user.language || "en") as Locale);
      setAiConsent(user.ai_consent || false);
      setMarketingConsent(user.marketing_consent || false);
    }
    adminApi.getFactory().then((r) => {
      const factory = r.data ?? r;
      setFactoryName(factory?.name || "");
    }).catch(() => {});
    fetchLogo();
    fetchSettings();
    initBeginnerMode();
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
    } catch (e: unknown) {
      setProfileMsg({ type: "err", text: getErrorMessage(e, t("common.saveFailed")) });
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
    } catch (e: unknown) {
      setPwMsg({ type: "err", text: getErrorMessage(e, t("common.saveFailed")) });
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
    } catch (e: unknown) {
      setConsentMsg({ type: "err", text: getErrorMessage(e, t("common.saveFailed")) });
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

  const inputCls = "w-full px-3 py-2 rounded-lg border border-th-border bg-th-input text-th-text focus:ring-2 focus:ring-brand-500 outline-none";
  const disabledInputCls = "w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg-3 text-th-text-2 cursor-not-allowed";
  const cardCls = "rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6 space-y-4";
  const btnPrimaryCls = "px-5 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition";

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-th-text" />
        <div>
          <h1 className="text-2xl font-bold text-th-text">{t("settings.title")}</h1>
          <p className="text-sm text-th-text-2 mt-1">{t("settings.subtitle")}</p>
        </div>
      </div>

      {/* Profile Section */}
      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <User className="w-5 h-5 text-th-text-2" /> {t("settings.profile")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-fullname" className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.fullName")}</label>
            <input
              id="settings-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="settings-email" className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.email")}</label>
            <input
              id="settings-email"
              type="text"
              value={user?.email || ""}
              disabled
              className={disabledInputCls}
            />
          </div>
          <div>
            <label htmlFor="settings-role" className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.role")}</label>
            <input
              id="settings-role"
              type="text"
              value={roleLabels[user?.role || ""] || user?.role || ""}
              disabled
              className={disabledInputCls}
            />
          </div>
          <div>
            <label htmlFor="settings-factory" className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.factoryName")}</label>
            <input
              id="settings-factory"
              type="text"
              value={factoryName}
              disabled
              className={disabledInputCls}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveProfile}
            disabled={profileSaving}
            className={btnPrimaryCls}
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
      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <Palette className="w-5 h-5 text-th-text-2" /> {t("settings.appearance")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-2">
              <Globe className="w-4 h-4 inline-block mr-1 -mt-0.5" />
              {t("settings.language")}
            </label>
            <div className="flex gap-2 flex-wrap">
              {([
                { code: "en" as Locale, label: "English" },
                { code: "it" as Locale, label: "Italiano" },
                { code: "de" as Locale, label: "Deutsch" },
                { code: "es" as Locale, label: "Espanol" },
                { code: "fr" as Locale, label: "Francais" },
                { code: "pl" as Locale, label: "Polski" },
                { code: "sr" as Locale, label: "Srpski" },
              ]).map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setLocale(lang.code);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition font-medium ${
                    locale === lang.code
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300"
                      : "border-th-border bg-th-bg text-th-text-2 hover:border-brand-300"
                  }`}
                >
                  <span className="text-xs uppercase font-bold text-th-text-3">{lang.code}</span>
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
                { id: "light" as const, icon: Sun, labelKey: "settings.themeLight" },
                { id: "dark" as const, icon: Moon, labelKey: "settings.themeDark" },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition font-medium ${
                    theme === opt.id
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300"
                      : "border-th-border bg-th-bg text-th-text-2 hover:border-brand-300"
                  }`}
                >
                  <opt.icon className="w-5 h-5" />
                  <span>{t(opt.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Currency */}
        <div className="pt-2">
          <label htmlFor="settings-currency" className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.currency")}</label>
          <p className="text-xs text-th-text-3 mb-2">{t("settings.currencyDesc")}</p>
          <select
            id="settings-currency"
            value={currency.code}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full max-w-xs px-3 py-2 rounded-lg border border-th-border bg-th-input text-th-text focus:ring-2 focus:ring-brand-500 outline-none"
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
        <section className={cardCls}>
          <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
            <Building className="w-5 h-5 text-th-text-2" /> {t("settings.companyBranding")}
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
                onClick={() => setConfirmRemoveLogo(true)}
                className="text-sm text-red-500 hover:text-red-700 transition"
              >
                {t("settings.removeLogo")}
              </button>
            </div>
          )}
          <LogoUpload onUploadSuccess={fetchLogo} />

          {/* Audit label toggle */}
          <div className="mt-4 pt-4 border-t border-th-border">
            <label className="block text-sm font-medium text-th-text-2 mb-2">
              {t("settings.auditLabel") || "Audit Program Label"}
            </label>
            <div className="flex items-center gap-3">
              {(["5S", "6S"] as const).map((label) => (
                <button
                  key={label}
                  onClick={() => setAuditLabel(label)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
                    auditLabel === label
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-th-bg-2 text-th-text-2 border-th-border hover:bg-th-bg-3"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-th-text-3 mt-1">
              {t("settings.auditLabelHint") || "Choose whether your factory uses 5S or 6S methodology"}
            </p>
          </div>
        </section>
      )}

      {/* Password Section */}
      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <Lock className="w-5 h-5 text-th-text-2" /> {t("settings.security")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="settings-current-pw" className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.currentPassword")}</label>
            <input
              id="settings-current-pw"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="settings-new-pw" className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.newPassword")}</label>
            <input
              id="settings-new-pw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="settings-confirm-pw" className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.confirmPassword")}</label>
            <input
              id="settings-confirm-pw"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <p className="text-xs text-th-text-3">{t("settings.passwordRequirements")}</p>

        <div className="flex items-center gap-3">
          <button
            onClick={changePassword}
            disabled={pwSaving || !currentPw || !newPw || !confirmPw}
            className={btnPrimaryCls}
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
      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <Shield className="w-5 h-5 text-th-text-2" /> {t("settings.privacy")}
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
            className={btnPrimaryCls}
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
      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <Package className="w-5 h-5 text-th-text-2" /> {t("settings.dataExport")}
        </h2>
        <p className="text-sm text-th-text-2">{t("settings.dataExportDesc")}</p>
        <button
          onClick={exportData}
          className="flex items-center gap-2 px-5 py-2 bg-th-bg border border-th-border text-th-text rounded-lg font-medium hover:bg-th-bg-3 transition"
        >
          <Download className="w-4 h-4" />
          {t("settings.downloadMyData")}
        </button>
      </section>

      {/* Beginner Mode */}
      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-th-text-2" /> {t("settings.beginnerMode") || "Beginner Mode"}
        </h2>
        <p className="text-sm text-th-text-2">
          {t("settings.beginnerModeDesc") || "When enabled, every tool page shows a description of what it does, when to use it, and how it connects to other tools. The problem-solving flow guide (Identify → Analyze → Root Cause → Action) is also always visible."}
        </p>
        <label className="inline-flex items-center gap-3 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={beginnerMode}
              onChange={(e) => {
                setBeginnerMode(e.target.checked);
              }}
            />
            <div className="w-11 h-6 bg-th-bg-3 border border-th-border rounded-full peer-checked:bg-brand-600 peer-checked:border-brand-600 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5" />
          </div>
          <span className="text-sm font-medium text-th-text">
            {beginnerMode
              ? (t("settings.beginnerModeOn") || "On — tool descriptions always visible")
              : (t("settings.beginnerModeOff") || "Off — tool descriptions dismissable")}
          </span>
        </label>
      </section>

      {/* Tutorial */}
      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-th-text-2" /> {t("settings.tutorial") || "Tutorial"}
        </h2>
        <p className="text-sm text-th-text-2">{t("settings.tutorialDesc") || "Replay the onboarding tutorial to learn about all available tools."}</p>
        <button
          onClick={() => { resetOnboarding(user?.id); window.location.hash = ""; window.location.reload(); }}
          className="px-5 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition"
        >
          {t("settings.replayTutorial") || "Replay Tutorial"}
        </button>
      </section>

      <ConfirmDialog
        open={confirmRemoveLogo}
        title={t("common.confirmDelete")}
        message={t("settings.confirmRemoveLogo")}
        variant="warning"
        onConfirm={() => {
          handleDeleteLogo();
          setConfirmRemoveLogo(false);
        }}
        onCancel={() => setConfirmRemoveLogo(false)}
      />

      {/* App Info */}
      <section className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-th-text flex items-center gap-2 mb-3">
          <Info className="w-5 h-5 text-th-text-2" /> {t("settings.about")}
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
