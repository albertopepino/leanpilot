"use client";
import { useState } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface Props {
  t: (key: string) => string;
  onShowPrivacy: () => void;
}

export default function CTASection({ t, onShowPrivacy }: Props) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.15 });
  const [form, setForm] = useState({ email: "", factory: "", employees: "" });
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/auth/register-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          factory_name: form.factory,
          employee_count: parseInt(form.employees) || 0,
        }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <section id="cta" className="relative py-24 sm:py-32">
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-indigo-50/20 to-white pointer-events-none" />

      <div
        ref={ref}
        className={`relative max-w-4xl mx-auto px-6 transition-all duration-700 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="relative bg-white border border-gray-200 rounded-3xl p-8 sm:p-12 shadow-xl hover:shadow-2xl transition-shadow duration-500">
          {/* Subtle gradient top border */}
          <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-gray-900 leading-[0.95]">
              {t("cta.title")}
            </h2>
            <p className="mt-5 text-base sm:text-lg text-gray-500 max-w-2xl mx-auto">
              {t("cta.subtitle")}
            </p>
          </div>

          {status === "success" ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4 animate-scale-in">
                <svg className="w-8 h-8 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t("cta.success")}</h3>
              <p className="text-sm text-gray-500">{t("cta.sub")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <input
                  type="email"
                  required
                  placeholder={t("cta.email")}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-5 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
                <input
                  type="text"
                  required
                  placeholder={t("cta.factory")}
                  value={form.factory}
                  onChange={(e) => setForm((f) => ({ ...f, factory: e.target.value }))}
                  className="w-full px-5 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>

              <select
                required
                value={form.employees}
                onChange={(e) => setForm((f) => ({ ...f, employees: e.target.value }))}
                className="w-full px-5 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none"
                style={{ color: form.employees ? "#111827" : "#9ca3af" }}
              >
                <option value="" disabled>{t("cta.employees")}</option>
                <option value="10" className="text-gray-900">1-10</option>
                <option value="50" className="text-gray-900">11-50</option>
                <option value="200" className="text-gray-900">51-200</option>
                <option value="500" className="text-gray-900">201-500</option>
                <option value="1000" className="text-gray-900">500+</option>
              </select>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-5 h-5 rounded-md border-2 transition-all ${
                      agreed
                        ? "bg-indigo-600 border-indigo-600"
                        : "border-gray-300 group-hover:border-gray-400"
                    }`}
                  >
                    {agreed && (
                      <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-500 leading-relaxed">
                  {t("cta.consent")}{" "}
                  <button type="button" onClick={onShowPrivacy} className="text-indigo-600 hover:underline font-medium">
                    {t("cta.privacy")}
                  </button>{" "}
                  {t("cta.and")}{" "}
                  <button type="button" onClick={onShowPrivacy} className="text-indigo-600 hover:underline font-medium">
                    {t("cta.terms")}
                  </button>
                </span>
              </label>

              <button
                type="submit"
                disabled={!agreed || status === "sending"}
                className="w-full py-4 rounded-full text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 shadow-md shadow-gray-900/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.01] hover:shadow-lg"
              >
                {status === "sending" ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("cta.sending")}
                  </span>
                ) : (
                  <>
                    {t("cta.submit")}
                    <span className="ml-2">&rarr;</span>
                  </>
                )}
              </button>

              <p className="text-center text-xs text-gray-400">{t("cta.sub")}</p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
