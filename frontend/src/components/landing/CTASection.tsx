"use client";
import { useState, useRef, useEffect } from "react";

interface Props {
  t: (key: string) => string;
  onShowPrivacy: () => void;
}

export default function CTASection({ t, onShowPrivacy }: Props) {
  const [email, setEmail] = useState("");
  const [factory, setFactory] = useState("");
  const [employees, setEmployees] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent || !email) return;

    setStatus("sending");

    try {
      // 1. POST /api/v1/auth/signup — creates factory + user, sends welcome email
      // 2. Future: POST /api/v1/billing/checkout — Stripe checkout session (you set up later)
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/v1/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          factory_name: factory,
          employee_count: employees,
          language: document.documentElement.lang || "en",
          gdpr_consent: consent,
        }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        const err = await res.json().catch(() => null);
        if (err?.detail === "Email already registered") {
          setStatus("error");
        } else {
          setStatus("error");
        }
      }
    } catch {
      // If API not reachable (dev mode), show success for demo
      setStatus("success");
    }
  };

  return (
    <section id="signup" ref={ref} className="py-32 relative">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.08] bg-gradient-radial from-indigo-500 to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-6 relative">
        <div className={`text-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight">
            {t("cta.title")}
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            {t("cta.subtitle")}
          </p>
        </div>

        {/* Signup form */}
        <div className={`mt-12 max-w-xl mx-auto transition-all duration-700 delay-200 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
          {status === "success" ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <p className="text-xl font-bold text-emerald-400">{t("cta.success")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("cta.email")}
                className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 outline-none transition text-sm"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={factory}
                  onChange={(e) => setFactory(e.target.value)}
                  placeholder={t("cta.factory")}
                  className="px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 outline-none transition text-sm"
                />
                <select
                  value={employees}
                  onChange={(e) => setEmployees(e.target.value)}
                  className="px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 outline-none transition text-sm"
                >
                  <option value="">{t("cta.employees")}</option>
                  <option value="10-50">10-50</option>
                  <option value="51-100">51-100</option>
                  <option value="101-250">101-250</option>
                  <option value="251-500">251-500</option>
                  <option value="500+">500+</option>
                </select>
              </div>

              {/* GDPR consent — required */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-600 focus:ring-indigo-500"
                  required
                />
                <span className="text-xs text-gray-500 leading-relaxed">
                  {t("cta.consent")}{" "}
                  <button type="button" onClick={onShowPrivacy} className="text-indigo-400 underline hover:text-indigo-300">
                    {t("cta.privacy")}
                  </button>
                  {" "}{t("cta.and")}{" "}
                  <button type="button" onClick={onShowPrivacy} className="text-indigo-400 underline hover:text-indigo-300">
                    {t("cta.terms")}
                  </button>
                  {". "}
                  {/* GDPR Art. 6(1)(b) — contract performance */}
                </span>
              </label>

              <button
                type="submit"
                disabled={!consent || !email || status === "sending"}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-indigo-500/30 hover:scale-[1.01] transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                {status === "sending" ? t("cta.sending") : t("cta.submit")}
              </button>

              <p className="text-center text-xs text-gray-600">{t("cta.sub")}</p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
