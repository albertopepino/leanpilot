"use client";
import { useRef, useState } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface Props {
  t: (key: string) => string;
  lang: string;
}

const tiers = [
  { key: "starter", features: 5, popular: false },
  { key: "professional", features: 6, popular: true },
  { key: "business", features: 6, popular: false },
] as const;

export default function PricingSection({ t }: Props) {
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div
          ref={headerRef}
          className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 ${
            headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-indigo-600 mb-4">
            {t("pricing.eyebrow")}
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 leading-[0.95]">
            {t("pricing.title")}
          </h2>
          <p className="mt-5 text-lg text-gray-500 leading-relaxed">
            {t("pricing.subtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
          {tiers.map((tier, i) => (
            <PricingCard key={tier.key} tier={tier} t={t} index={i} />
          ))}
        </div>

        <EnterpriseStrip t={t} />
      </div>
    </section>
  );
}

function PricingCard({
  tier,
  t,
  index,
}: {
  tier: (typeof tiers)[number];
  t: (k: string) => string;
  index: number;
}) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });
  const featureKeys = Array.from({ length: tier.features }, (_, i) => `pricing.${tier.key}F${i + 1}`);
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMove = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={ref}
      className={`relative group transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${index * 120}ms`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      {tier.popular && (
        <div className="absolute -inset-[1px] bg-gradient-to-b from-indigo-500 via-violet-500 to-purple-500 rounded-2xl opacity-20 blur-[1px]" />
      )}

      <div
        ref={cardRef}
        onMouseMove={handleMove}
        className={`relative h-full flex flex-col p-7 sm:p-8 rounded-2xl border transition-all duration-500 overflow-hidden ${
          tier.popular
            ? "border-indigo-200 bg-white shadow-xl shadow-indigo-500/10 hover:shadow-2xl"
            : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-xl"
        }`}
      >
        {/* Spotlight */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{
            background: `radial-gradient(300px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99,102,241,0.06), transparent 60%)`,
          }}
        />

        {tier.popular && (
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="text-[10px] font-bold tracking-wider uppercase bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-1.5 rounded-full shadow-lg shadow-indigo-500/25">
              {t("pricing.popular")}
            </span>
          </div>
        )}

        <h3 className="text-lg font-bold text-gray-900">{t(`pricing.${tier.key}`)}</h3>
        <p className="text-sm text-gray-500 mt-1 mb-6">{t(`pricing.${tier.key}Desc`)}</p>

        <div className="flex items-baseline gap-1 mb-7">
          <span className="text-sm text-gray-400">€</span>
          <span className="text-5xl sm:text-6xl font-black text-gray-900 tabular-nums">
            {t(`pricing.${tier.key}Price`)}
          </span>
          <span className="text-sm text-gray-400">{t("pricing.perMonth")}</span>
        </div>

        <ul className="space-y-3.5 mb-8 flex-1">
          {featureKeys.map((key) => (
            <li key={key} className="flex items-start gap-2.5 text-sm text-gray-600">
              <svg className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {t(key)}
            </li>
          ))}
        </ul>

        <button
          onClick={() => document.getElementById("cta")?.scrollIntoView({ behavior: "smooth" })}
          className={`w-full py-3.5 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-[1.02] ${
            tier.popular
              ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md shadow-gray-900/10"
              : "bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200"
          }`}
        >
          {t("pricing.cta")}
        </button>
      </div>
    </div>
  );
}

function EnterpriseStrip({ t }: { t: (k: string) => string }) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.3 });

  return (
    <div
      ref={ref}
      className={`max-w-5xl mx-auto p-7 sm:p-8 rounded-2xl border border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-6 transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div>
        <h3 className="text-xl font-bold text-gray-900">{t("pricing.enterprise")}</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-md">{t("pricing.enterpriseDesc")}</p>
      </div>
      <a
        href="mailto:sales@leanpilot.app"
        className="px-7 py-3.5 text-sm font-semibold text-gray-900 rounded-full border border-gray-300 hover:bg-white hover:border-gray-400 hover:scale-105 transition-all whitespace-nowrap"
      >
        {t("pricing.contactSales")}
      </a>
    </div>
  );
}
