"use client";
import type { MutableRefObject } from "react";
import { useScrollReveal, useAnimatedCounter } from "@/hooks/useScrollReveal";

interface Props {
  t: (key: string) => string;
}

function StatItem({
  value,
  suffix,
  prefix,
  label,
  delay,
  color,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  delay: number;
  color: string;
}) {
  const { ref, count } = useAnimatedCounter(value);
  const { ref: revealRef, isVisible } = useScrollReveal({ threshold: 0.3 });

  return (
    <div
      ref={(el) => {
        (revealRef as MutableRefObject<HTMLDivElement | null>).current = el;
        (ref as MutableRefObject<HTMLDivElement | null>).current = el;
      }}
      className={`text-center group transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${delay}ms`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      <div className={`text-5xl sm:text-6xl lg:text-7xl font-black tabular-nums transition-colors duration-500 ${color}`}>
        {prefix}
        {count}
        {suffix}
      </div>
      <div className="mt-3 text-sm text-gray-500 font-medium tracking-wide">{label}</div>
    </div>
  );
}

export default function StatsSection({ t }: Props) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-indigo-50/30 to-white pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div
          ref={ref}
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-indigo-600 mb-4">
            {t("stats.eyebrow")}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10 sm:gap-12">
          <StatItem value={17} label={t("stats.tools")} delay={0} color="text-gray-900 group-hover:text-indigo-600" />
          <StatItem value={7} label={t("stats.languages")} delay={100} color="text-gray-900 group-hover:text-violet-600" />
          <StatItem value={5} suffix=" min" prefix="<" label={t("stats.setup")} delay={200} color="text-gray-900 group-hover:text-blue-600" />
          <StatItem value={99} suffix="%" label={t("stats.uptime")} delay={300} color="text-gray-900 group-hover:text-emerald-600" />
          <StatItem value={47} prefix="€" suffix="K" label={t("stats.savings")} delay={400} color="text-gray-900 group-hover:text-amber-600" />
          <StatItem value={96} suffix="%" label={t("stats.satisfaction")} delay={500} color="text-gray-900 group-hover:text-rose-600" />
        </div>
      </div>
    </section>
  );
}
