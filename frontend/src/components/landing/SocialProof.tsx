"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  t: (key: string) => string;
}

export default function SocialProof({ t }: Props) {
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

  const quotes = [
    { key: "1", avatar: "PM", color: "from-indigo-500 to-blue-500" },
    { key: "2", avatar: "CI", color: "from-emerald-500 to-teal-500" },
    { key: "3", avatar: "OD", color: "from-purple-500 to-pink-500" },
  ];

  return (
    <section ref={ref} className="py-32 relative">
      {/* Divider line */}
      <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto px-6">
        <div className={`text-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="text-xs font-bold tracking-[0.3em] text-emerald-400 uppercase">
            {t("social.eyebrow")}
          </span>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {quotes.map((q, i) => (
            <div
              key={q.key}
              className={`relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 transition-all duration-700 hover:bg-white/[0.06] ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${i * 200}ms` }}
            >
              {/* Quote mark */}
              <div className="text-5xl font-serif text-white/10 absolute top-4 right-6">"</div>

              <p className="text-gray-300 text-sm leading-relaxed italic relative z-10">
                {t(`social.quote${q.key}`)}
              </p>

              <div className="mt-6 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${q.color} flex items-center justify-center text-white text-xs font-bold`}>
                  {q.avatar}
                </div>
                <div className="text-xs text-gray-500">
                  {t(`social.author${q.key}`)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
