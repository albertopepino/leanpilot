"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  t: (key: string) => string;
}

export default function ProblemSection({ t }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const problems = [
    { key: "p1", icon: "📊", color: "from-red-500/20 to-red-500/5", border: "border-red-500/20" },
    { key: "p2", icon: "🔄", color: "from-orange-500/20 to-orange-500/5", border: "border-orange-500/20" },
    { key: "p3", icon: "⏱️", color: "from-yellow-500/20 to-yellow-500/5", border: "border-yellow-500/20" },
    { key: "p4", icon: "💡", color: "from-purple-500/20 to-purple-500/5", border: "border-purple-500/20" },
  ];

  return (
    <section ref={sectionRef} className="py-32 relative">
      <div className="max-w-6xl mx-auto px-6">
        {/* Eyebrow */}
        <div className={`text-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="text-xs font-bold tracking-[0.3em] text-red-400 uppercase">
            {t("problem.eyebrow")}
          </span>
          <h2 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight">
            {t("problem.title")}
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            {t("problem.subtitle")}
          </p>
        </div>

        {/* Pain point cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-5">
          {problems.map((p, i) => (
            <div
              key={p.key}
              className={`group relative bg-gradient-to-br ${p.color} border ${p.border} rounded-2xl p-6 transition-all duration-700 hover:scale-[1.02] hover:shadow-2xl ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{p.icon}</span>
                <div>
                  <h3 className="text-lg font-bold text-white italic">
                    {t(`problem.${p.key}`)}
                  </h3>
                  <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                    {t(`problem.${p.key}d`)}
                  </p>
                </div>
              </div>
              {/* Decorative line */}
              <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
          ))}
        </div>

        {/* Arrow */}
        <div className={`mt-16 text-center transition-all duration-1000 delay-700 ${visible ? "opacity-100" : "opacity-0"}`}>
          <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            {t("problem.arrow")}
          </span>
        </div>
      </div>
    </section>
  );
}
