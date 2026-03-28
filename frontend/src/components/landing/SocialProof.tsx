"use client";
import { useRef, useState } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface Props {
  t: (key: string) => string;
}

const testimonials = [
  { key: "1", avatar: "MR", gradient: "from-indigo-500 to-violet-500", role: "Plant Manager" },
  { key: "2", avatar: "KS", gradient: "from-emerald-500 to-cyan-500", role: "CI Lead" },
  { key: "3", avatar: "TW", gradient: "from-amber-500 to-orange-500", role: "Ops Director" },
] as const;

function TestimonialCard({
  t,
  item,
  index,
}: {
  t: (k: string) => string;
  item: (typeof testimonials)[number];
  index: number;
}) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMove = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${index * 150}ms`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMove}
        className="relative group p-8 rounded-2xl border border-gray-200 bg-white hover:border-gray-300 transition-all duration-500 hover:shadow-xl overflow-hidden h-full"
      >
        {/* Spotlight effect */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99,102,241,0.06), transparent 60%)`,
          }}
        />

        {/* Stars */}
        <div className="flex gap-0.5 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg key={i} className="w-5 h-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>

        <blockquote className="relative text-base text-gray-600 leading-relaxed mb-8">
          &ldquo;{t(`social.quote${item.key}`)}&rdquo;
        </blockquote>

        <div className="flex items-center gap-3 mt-auto">
          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white text-xs font-bold shadow-lg transition-transform duration-300 group-hover:scale-110`}>
            {item.avatar}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">{t(`social.author${item.key}`)}</div>
            <div className="text-xs text-gray-400">{t(`social.role${item.key}`)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SocialProof({ t }: Props) {
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();

  return (
    <section className="relative py-24 sm:py-32 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-6">
        <div
          ref={headerRef}
          className={`text-center max-w-3xl mx-auto mb-14 transition-all duration-700 ${
            headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-amber-600 mb-4">
            {t("social.eyebrow")}
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 leading-[0.95]">
            {t("social.title")}
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((item, i) => (
            <TestimonialCard key={item.key} t={t} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
