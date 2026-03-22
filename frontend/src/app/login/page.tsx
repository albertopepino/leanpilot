"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/stores/useI18n";
import { useRouter } from "next/navigation";
import Logo from "@/components/ui/Logo";
import {
  BarChart3,
  Map,
  FileSpreadsheet,
  Footprints,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Settings,
  Shield,
  Gauge,
} from "lucide-react";

const QUOTE_KEYS = Array.from({ length: 14 }, (_, i) => `login.quote${i + 1}`);
const AUTHOR_KEYS = Array.from({ length: 14 }, (_, i) => `login.author${i + 1}`);

const TOOLS = [
  { label: "OEE", icon: Gauge },
  { label: "VSM", icon: Map },
  { label: "A3", icon: FileSpreadsheet },
  { label: "Gemba", icon: Footprints },
  { label: "Kaizen", icon: Lightbulb },
  { label: "SMED", icon: RefreshCw },
  { label: "5S", icon: Sparkles },
  { label: "TPM", icon: Settings },
];

export default function LoginPage() {
  const { user, loading, login, loadUser } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.is_superadmin ? "/portal" : "/operations/home");
    }
  }, [loading, user, router]);

  useEffect(() => {
    setQuoteIdx(Math.floor(Math.random() * QUOTE_KEYS.length));
    const iv = setInterval(() => setQuoteIdx((i) => (i + 1) % QUOTE_KEYS.length), 8000);
    return () => clearInterval(iv);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      // The useEffect watching `user` will handle the redirect based on role
    } catch {
      setError(t("login.invalidCredentials"));
    }
  };

  const quoteText = t(QUOTE_KEYS[quoteIdx]);
  const quoteAuthor = t(AUTHOR_KEYS[quoteIdx]);

  if (loading) return null;
  if (user) return null;

  return (
    <div className="min-h-screen flex bg-th-bg">
      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-b from-slate-900 via-slate-900 to-brand-950 p-10 flex-col justify-between relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center text-white">
              <Logo size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">LeanPilot</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">{t("login.subtitle")}</p>
            </div>
          </div>
        </div>

        {/* Quote */}
        <div className="relative z-10 max-w-md">
          <div className="transition-all duration-700" key={quoteIdx}>
            <p className="text-lg text-white/80 font-light leading-relaxed italic">
              &ldquo;{quoteText}&rdquo;
            </p>
            <p className="text-sm text-slate-400 mt-3">&mdash; {quoteAuthor}</p>
          </div>
        </div>

        {/* Tool icons row */}
        <div className="relative z-10">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">{t("login.trustLine") || "Complete Lean Toolkit"}</p>
          <div className="flex gap-2 flex-wrap">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.label}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-slate-400 text-[11px] font-medium"
                >
                  <Icon size={13} />
                  <span>{tool.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center text-white">
              <Logo size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-th-text">LeanPilot</h1>
              <p className="text-[9px] text-th-text-3 uppercase tracking-widest">{t("login.subtitle")}</p>
            </div>
          </div>

          <div className="bg-th-bg-2 rounded-xl p-7 shadow-sm border border-th-border">
            <h2 className="text-lg font-bold text-th-text mb-0.5">{t("login.welcomeBack")}</h2>
            <p className="text-sm text-th-text-3 mb-6">{t("login.signInSubtitle")}</p>

            {/* Mobile quote */}
            <div className="lg:hidden bg-brand-50 dark:bg-brand-900/20 rounded-lg p-3 mb-5 border border-brand-100 dark:border-brand-800/30">
              <p className="text-xs text-brand-700 dark:text-brand-300 italic leading-relaxed">&ldquo;{quoteText}&rdquo;</p>
              <p className="text-[10px] text-brand-500 mt-1">&mdash; {quoteAuthor}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" aria-label={t("login.welcomeBack")}>
              <div>
                <label htmlFor="login-email" className="text-xs font-medium text-th-text-2 mb-1.5 block">{t("login.email")}</label>
                <input
                  id="login-email"
                  type="text"
                  autoComplete="username"
                  placeholder={t("login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-required="true"
                  aria-invalid={error ? "true" : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className="w-full px-3.5 py-2.5 border border-th-border rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm bg-th-input text-th-text transition-colors"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="text-xs font-medium text-th-text-2 mb-1.5 block">{t("login.password")}</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-required="true"
                  aria-invalid={error ? "true" : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className="w-full px-3.5 py-2.5 border border-th-border rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm bg-th-input text-th-text transition-colors"
                />
              </div>
              {error && (
                <div id="login-error" role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 text-sm px-3.5 py-2 rounded-lg">
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2.5 rounded-lg font-semibold transition-colors text-sm"
              >
                {t("common.signIn")}
              </button>
            </form>

            <p className="text-center text-[10px] text-th-text-3 mt-5 leading-relaxed">
              {t("login.gdprNotice") || "By signing in, you agree to our Privacy Policy and Terms of Service. Your data is processed in accordance with GDPR."}
            </p>

            <p className="text-center text-[10px] text-th-text-3 mt-3">
              {t("common.poweredBy")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
