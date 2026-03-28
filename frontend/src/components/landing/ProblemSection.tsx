"use client";
import { useRef, useState, useEffect } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface Props { t: (key: string) => string; }

const problems = [
  {
    key: "p1",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" /><path d="M7 16l4-6 4 4 5-7" />
      </svg>
    ),
    color: "bg-red-50 border-red-100 hover:border-red-300",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    metric: "OEE Unknown",
  },
  {
    key: "p2",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 12h4l3-9 6 18 3-9h4" />
      </svg>
    ),
    color: "bg-amber-50 border-amber-100 hover:border-amber-300",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    metric: "Recurring Defects",
  },
  {
    key: "p3",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
    color: "bg-blue-50 border-blue-100 hover:border-blue-300",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    metric: "Changeover > 45min",
  },
  {
    key: "p4",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    color: "bg-purple-50 border-purple-100 hover:border-purple-300",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    metric: "Ideas Lost",
  },
] as const;

/* ---- 3D tilt on hover ---- */
function TiltCard({ children, className, style }: { children: React.ReactNode; className: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("perspective(600px) rotateX(0deg) rotateY(0deg)");

  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTransform(`perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`);
  };

  const handleLeave = () => {
    setTransform("perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)");
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...style, transform, transition: "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)" }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </div>
  );
}

export default function ProblemSection({ t }: Props) {
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();

  return (
    <section id="problems" className="relative py-24 sm:py-32 bg-gray-50/60">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={headerRef} className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 ${headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-red-500 mb-4">{t("problem.eyebrow")}</span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 leading-[0.95]">{t("problem.title")}</h2>
          <p className="mt-5 text-lg text-gray-500 leading-relaxed">{t("problem.subtitle")}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {problems.map((p, i) => {
            const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });
            return (
              <div
                key={p.key}
                ref={ref}
                className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <TiltCard
                  className={`group p-7 rounded-2xl border-2 ${p.color} cursor-default h-full`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl ${p.iconBg} ${p.iconColor} flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                      {p.icon}
                    </div>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-gray-300 bg-gray-100 px-2.5 py-1 rounded-full">
                      {p.metric}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{t(`problem.${p.key}`)}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{t(`problem.${p.key}d`)}</p>
                </TiltCard>
              </div>
            );
          })}
        </div>
        <div className="mt-14 text-center">
          <button
            onClick={() => document.getElementById("showcase")?.scrollIntoView({ behavior: "smooth" })}
            className="group inline-flex flex-col items-center gap-3 text-gray-400 hover:text-indigo-600 transition-colors"
          >
            <span className="text-sm font-semibold tracking-wide">{t("problem.arrow")}</span>
            <div className="w-10 h-10 rounded-full border-2 border-gray-200 group-hover:border-indigo-300 flex items-center justify-center transition-all group-hover:bg-indigo-50">
              <svg className="w-4 h-4 animate-bounce" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
