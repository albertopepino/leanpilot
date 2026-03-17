"use client";
import { useState, useEffect, useRef } from "react";

interface Props {
  t: (key: string) => string;
}

const categories = [
  {
    id: "see",
    icon: "👁️",
    gradient: "from-blue-500 to-cyan-500",
    tools: [
      { key: "oee", icon: "📊" },
      { key: "hourly", icon: "⏰" },
      { key: "andon", icon: "🚦" },
      { key: "production", icon: "📝" },
    ],
  },
  {
    id: "solve",
    icon: "🔍",
    gradient: "from-red-500 to-orange-500",
    tools: [
      { key: "fivewhy", icon: "❓" },
      { key: "ishikawa", icon: "🐟" },
      { key: "pareto", icon: "📈" },
      { key: "a3", icon: "📋" },
    ],
  },
  {
    id: "improve",
    icon: "🚀",
    gradient: "from-green-500 to-emerald-500",
    tools: [
      { key: "kaizen", icon: "💡" },
      { key: "vsm", icon: "🗺️" },
      { key: "smed", icon: "🔧" },
      { key: "gemba", icon: "🚶" },
    ],
  },
  {
    id: "maintain",
    icon: "⚙️",
    gradient: "from-amber-500 to-yellow-500",
    tools: [
      { key: "sixs", icon: "🗂️" },
      { key: "tpm", icon: "🛠️" },
      { key: "cilt", icon: "📋" },
    ],
  },
  {
    id: "ai",
    icon: "🤖",
    gradient: "from-purple-500 to-pink-500",
    tools: [
      { key: "copilot", icon: "🤖" },
      { key: "assessment", icon: "📊" },
    ],
  },
];

const catNumMap = ["cat1", "cat2", "cat3", "cat4", "cat5"];

export default function FeaturesSection({ t }: Props) {
  const [active, setActive] = useState(0);
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

  const cat = categories[active];

  return (
    <section id="features" ref={ref} className="py-32 relative">
      <div className="max-w-6xl mx-auto px-6">
        <div className={`text-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="text-xs font-bold tracking-[0.3em] text-indigo-400 uppercase">
            {t("features.eyebrow")}
          </span>
          <h2 className="mt-4 text-4xl sm:text-5xl font-black text-white leading-tight">
            {t("features.title")}
          </h2>
        </div>

        {/* Category selector — orbital design */}
        <div className="mt-16 flex flex-wrap justify-center gap-3">
          {categories.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setActive(i)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                active === i
                  ? `bg-gradient-to-r ${c.gradient} text-white shadow-xl scale-105`
                  : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className="text-lg">{c.icon}</span>
              <span>{t(`features.${catNumMap[i]}`)}</span>
            </button>
          ))}
        </div>

        {/* Category description */}
        <p className="text-center text-gray-500 mt-4 text-sm">
          {t(`features.${catNumMap[active]}d`)}
        </p>

        {/* Tool cards — staggered grid */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cat.tools.map((tool, i) => (
            <div
              key={tool.key}
              className="group relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl"
              style={{
                animationDelay: `${i * 100}ms`,
                animation: visible ? "fadeInUp 0.6s ease forwards" : "none",
                opacity: 0,
              }}
            >
              {/* Glow on hover */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${cat.gradient} opacity-0 group-hover:opacity-[0.05] transition-opacity duration-500`} />

              <div className="relative">
                <span className="text-3xl">{tool.icon}</span>
                <h4 className="mt-3 font-bold text-white text-sm">
                  {t(`features.tool.${tool.key}`)}
                </h4>
                <div className={`mt-3 h-1 w-8 rounded-full bg-gradient-to-r ${cat.gradient} opacity-50 group-hover:w-full group-hover:opacity-100 transition-all duration-500`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
