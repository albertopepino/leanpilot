"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  t: (key: string) => string;
  lang: "en" | "it";
}

const tiers = {
  en: [
    {
      name: "Starter",
      price: "$49",
      period: "/month",
      desc: "Essential lean tools for small teams getting started with continuous improvement.",
      features: [
        "OEE Dashboard (basic)",
        "Production Input & Hourly Board",
        "6S Audit",
        "5 Why & Ishikawa diagrams",
        "Lean Maturity Assessment",
        "Up to 3 users, 1 line",
        "90-day data retention",
        "Email support",
      ],
      cta: "Start 14-Day Free Trial",
      popular: false,
      gradient: "",
    },
    {
      name: "Professional",
      price: "$149",
      period: "/month",
      desc: "Full lean suite with all 17 tools — the most popular choice for growing factories.",
      features: [
        "All 17 lean tools",
        "OEE, Andon, TPM, CILT",
        "Pareto, A3, Kaizen, Gemba",
        "Basic AI Factory Copilot",
        "Up to 10 users, 3 lines",
        "1-year data retention",
        "Priority support",
        "Guided onboarding",
      ],
      cta: "Start 14-Day Free Trial",
      popular: true,
      gradient: "from-indigo-600 to-purple-600",
    },
    {
      name: "Business",
      price: "$349",
      period: "/month",
      desc: "Advanced AI analytics and enterprise features for serious lean organizations.",
      features: [
        "Everything in Professional",
        "Advanced AI Copilot",
        "VSM & SMED tracking",
        "Custom reports & dashboards",
        "Up to 25 users, 10 lines",
        "3-year data retention",
        "SSO / SAML",
        "White-glove onboarding",
      ],
      cta: "Start 14-Day Free Trial",
      popular: false,
      gradient: "",
    },
  ],
  it: [
    {
      name: "Starter",
      price: "$49",
      period: "/mese",
      desc: "Strumenti lean essenziali per piccoli team che iniziano il miglioramento continuo.",
      features: [
        "Dashboard OEE (base)",
        "Input Produzione & Tabellone Orario",
        "Audit 6S",
        "5 Perché & Diagrammi Ishikawa",
        "Valutazione Maturità Lean",
        "Fino a 3 utenti, 1 linea",
        "Storico dati 90 giorni",
        "Supporto email",
      ],
      cta: "Prova Gratuita 14 Giorni",
      popular: false,
      gradient: "",
    },
    {
      name: "Professional",
      price: "$149",
      period: "/mese",
      desc: "Suite lean completa con tutti i 17 strumenti — la scelta più popolare per fabbriche in crescita.",
      features: [
        "Tutti i 17 strumenti lean",
        "OEE, Andon, TPM, CILT",
        "Pareto, A3, Kaizen, Gemba",
        "Copilota AI Base",
        "Fino a 10 utenti, 3 linee",
        "Storico dati 1 anno",
        "Supporto prioritario",
        "Onboarding guidato",
      ],
      cta: "Prova Gratuita 14 Giorni",
      popular: true,
      gradient: "from-indigo-600 to-purple-600",
    },
    {
      name: "Business",
      price: "$349",
      period: "/mese",
      desc: "Analytics AI avanzate e funzionalità enterprise per organizzazioni lean serie.",
      features: [
        "Tutto in Professional",
        "Copilota AI Avanzato",
        "Monitoraggio VSM & SMED",
        "Report e dashboard personalizzati",
        "Fino a 25 utenti, 10 linee",
        "Storico dati 3 anni",
        "SSO / SAML",
        "Onboarding dedicato",
      ],
      cta: "Prova Gratuita 14 Giorni",
      popular: false,
      gradient: "",
    },
  ],
};

export default function PricingSection({ t, lang }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const plans = tiers[lang];

  return (
    <section id="pricing" ref={ref} className="py-32 relative">
      <div className="max-w-6xl mx-auto px-6">
        <div className={`text-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="text-xs font-bold tracking-[0.3em] text-purple-400 uppercase">
            {t("pricing.eyebrow")}
          </span>
          <h2 className="mt-4 text-4xl sm:text-5xl font-black text-white">
            {t("pricing.title")}
          </h2>
          <p className="mt-4 text-gray-500">
            {t("pricing.subtitle")}
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 transition-all duration-700 ${
                plan.popular
                  ? "bg-gradient-to-b from-indigo-600/20 to-purple-600/10 border-2 border-indigo-500/30 shadow-2xl shadow-indigo-500/10 scale-[1.02]"
                  : "bg-white/[0.03] border border-white/[0.06]"
              } ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                  {t("pricing.popular")}
                </div>
              )}

              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
              </div>
              <p className="mt-3 text-sm text-gray-400">{plan.desc}</p>

              <ul className="mt-8 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-300">
                    <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
                className={`mt-8 w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  plan.popular
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-xl hover:shadow-indigo-500/30 hover:scale-[1.02]"
                    : "bg-white/10 text-white border border-white/10 hover:bg-white/15"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Enterprise callout */}
        <div className={`mt-10 rounded-2xl bg-gradient-to-r from-indigo-600/10 to-purple-600/10 border border-indigo-500/20 p-8 transition-all duration-700 delay-500 ${visible ? "opacity-100" : "opacity-0"}`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">
                Enterprise
                <span className="ml-3 text-2xl font-black text-indigo-400">$899<span className="text-sm font-normal text-gray-500">{t("pricing.perMonth")}</span></span>
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                {t("pricing.enterpriseDesc")}
              </p>
            </div>
            <a href="mailto:enterprise@autopilot.rs" className="shrink-0 px-6 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-semibold text-sm hover:bg-white/15 transition-all">
              {t("pricing.contactSales")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
