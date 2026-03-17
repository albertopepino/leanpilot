"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/stores/useI18n";
import { authApi } from "@/lib/api";

type Step = "idle" | "setup" | "verify" | "disable";

export default function TwoFactorSetup() {
  const { user, loadUser } = useAuth();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isEnabled = (user as any)?.totp_enabled;

  const startSetup = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await authApi.setupTotp();
      setQrCode(res.data.qr_code);
      setSecret(res.data.secret);
      setStep("verify");
    } catch (e: any) {
      setMsg({ type: "err", text: e?.response?.data?.detail || "Setup failed" });
    }
    setLoading(false);
  };

  const verifyCode = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setMsg(null);
    try {
      await authApi.verifyTotp(code);
      await loadUser();
      setStep("idle");
      setCode("");
      setQrCode("");
      setSecret("");
      setMsg({ type: "ok", text: t("settings.2faEnabled") });
    } catch (e: any) {
      setMsg({ type: "err", text: e?.response?.data?.detail || "Invalid code" });
    }
    setLoading(false);
  };

  const disableTotp = async () => {
    if (code.length !== 6 || !password) return;
    setLoading(true);
    setMsg(null);
    try {
      await authApi.disableTotp(password, code);
      await loadUser();
      setStep("idle");
      setCode("");
      setPassword("");
      setMsg({ type: "ok", text: t("settings.2faDisabled") });
    } catch (e: any) {
      setMsg({ type: "err", text: e?.response?.data?.detail || "Failed to disable" });
    }
    setLoading(false);
  };

  return (
    <section className="bg-th-bg-2 rounded-2xl border border-th-border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
        <span className="text-xl">🔐</span> {t("settings.2faTitle")}
      </h2>

      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          isEnabled
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        }`}>
          <span className={`w-2 h-2 rounded-full ${isEnabled ? "bg-emerald-500" : "bg-gray-400"}`} />
          {isEnabled ? t("settings.2faActive") : t("settings.2faInactive")}
        </span>
      </div>

      <p className="text-sm text-th-text-2">{t("settings.2faDescription")}</p>

      {/* Idle state */}
      {step === "idle" && (
        <div>
          {!isEnabled ? (
            <button
              onClick={startSetup}
              disabled={loading}
              className="px-5 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition"
            >
              {loading ? t("common.loading") : t("settings.2faEnable")}
            </button>
          ) : (
            <button
              onClick={() => { setStep("disable"); setMsg(null); }}
              className="px-5 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl font-medium hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 transition"
            >
              {t("settings.2faDisable")}
            </button>
          )}
        </div>
      )}

      {/* Setup / Verify step */}
      {step === "verify" && (
        <div className="space-y-4 p-4 bg-th-bg rounded-xl border border-th-border">
          <p className="text-sm font-medium text-th-text">{t("settings.2faScanQR")}</p>
          {qrCode && (
            <div className="flex justify-center">
              <img
                src={`data:image/png;base64,${qrCode}`}
                alt="TOTP QR Code"
                className="w-48 h-48 rounded-lg border border-th-border"
              />
            </div>
          )}
          <div>
            <p className="text-xs text-th-text-3 mb-1">{t("settings.2faManualKey")}</p>
            <code className="block bg-th-bg-3 px-3 py-2 rounded-lg text-sm font-mono text-th-text select-all break-all">
              {secret}
            </code>
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.2faEnterCode")}</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full max-w-[200px] px-3 py-2 bg-th-bg border border-th-border rounded-xl text-th-text text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-brand-500 outline-none"
              aria-label="TOTP verification code"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={verifyCode}
              disabled={loading || code.length !== 6}
              className="px-5 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition"
            >
              {loading ? t("common.saving") : t("settings.2faVerify")}
            </button>
            <button
              onClick={() => { setStep("idle"); setCode(""); setMsg(null); }}
              className="px-5 py-2 border border-th-border rounded-xl text-th-text-2 hover:bg-th-bg-3 transition"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Disable step */}
      {step === "disable" && (
        <div className="space-y-4 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{t("settings.2faDisableWarning")}</p>
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.currentPassword")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full max-w-xs px-3 py-2 bg-th-bg border border-th-border rounded-xl text-th-text focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-2 mb-1">{t("settings.2faEnterCode")}</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full max-w-[200px] px-3 py-2 bg-th-bg border border-th-border rounded-xl text-th-text text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-brand-500 outline-none"
              aria-label="TOTP code for disabling 2FA"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={disableTotp}
              disabled={loading || code.length !== 6 || !password}
              className="px-5 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition"
            >
              {loading ? t("common.saving") : t("settings.2faConfirmDisable")}
            </button>
            <button
              onClick={() => { setStep("idle"); setCode(""); setPassword(""); setMsg(null); }}
              className="px-5 py-2 border border-th-border rounded-xl text-th-text-2 hover:bg-th-bg-3 transition"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`text-sm ${msg.type === "ok" ? "text-emerald-500" : "text-red-500"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
