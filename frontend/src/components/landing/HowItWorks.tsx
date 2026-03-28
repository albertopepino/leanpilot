"use client";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface Props {
  t: (key: string) => string;
}

const steps = [
  {
    key: "step1",
    number: "01",
    color: "from-blue-500 to-cyan-500",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    key: "step2",
    number: "02",
    color: "from-indigo-500 to-violet-500",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: "step3",
    number: "03",
    color: "from-emerald-500 to-green-500",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
];

export default function HowItWorks({ t }: Props) {
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();

  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div
          ref={headerRef}
          className={`text-center max-w-3xl mx-auto mb-20 transition-all duration-700 ${
            headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-emerald-600 mb-4">
            {t("how.eyebrow")}
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 leading-[0.95]">
            {t("how.title")}
          </h2>
          <p className="mt-5 text-lg text-gray-500 leading-relaxed">
            {t("how.subtitle")}
          </p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Animated connecting line */}
          <div className="hidden md:block absolute top-24 left-[16.67%] right-[16.67%] h-[2px] overflow-hidden">
            <div className="w-full h-full bg-gradient-to-r from-blue-300 via-indigo-300 to-emerald-300 opacity-40" />
            <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-indigo-500 to-violet-500 animate-shimmer opacity-60" />
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {steps.map((step, i) => (
              <StepCard key={step.key} step={step} t={t} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StepCard({
  step,
  t,
  index,
}: {
  step: (typeof steps)[number];
  t: (k: string) => string;
  index: number;
}) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });

  return (
    <div
      ref={ref}
      className={`relative group text-center transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      style={{ transitionDelay: `${index * 180}ms`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      {/* Number ring */}
      <div className="relative mx-auto w-20 h-20 mb-8">
        <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${step.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
        <div className={`absolute inset-[3px] rounded-full bg-white flex items-center justify-center`}>
          <span className={`text-2xl font-black bg-gradient-to-br ${step.color} bg-clip-text text-transparent`}>
            {step.number}
          </span>
        </div>
        {/* Rotating border on hover */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 80 80">
          <circle
            cx="40" cy="40" r="38"
            fill="none"
            stroke="url(#grad)"
            strokeWidth="2"
            strokeDasharray="240"
            strokeDashoffset="60"
            className="transition-all duration-700 group-hover:stroke-dashoffset-0"
          />
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${step.iconBg} ${step.iconColor} mb-5 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1`}>
        {step.icon}
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-3">
        {t(`how.${step.key}`)}
      </h3>
      <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
        {t(`how.${step.key}d`)}
      </p>
    </div>
  );
}
