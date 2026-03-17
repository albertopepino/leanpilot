"use client";

interface Props {
  t: (key: string) => string;
  scrollY: number;
}

export default function HeroSection({ t, scrollY }: Props) {
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-20">
      {/* Animated factory grid in background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg className="absolute w-full h-full opacity-[0.04]" viewBox="0 0 1200 800">
          {/* Conveyor belt animation */}
          <line x1="0" y1="600" x2="1200" y2="600" stroke="#6366f1" strokeWidth="2" strokeDasharray="20 10">
            <animate attributeName="stroke-dashoffset" values="0;-30" dur="1s" repeatCount="indefinite" />
          </line>
          {/* Factory silhouette */}
          <path d="M100,600 L100,400 L200,350 L200,600 M250,600 L250,300 L350,250 L350,600 M400,600 L400,350 L450,350 L450,200 L500,200 L500,600" fill="none" stroke="#6366f1" strokeWidth="1.5" />
          {/* Gears */}
          <circle cx="800" cy="400" r="40" fill="none" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="8 4">
            <animateTransform attributeName="transform" type="rotate" values="0 800 400;360 800 400" dur="10s" repeatCount="indefinite" />
          </circle>
          <circle cx="860" cy="360" r="25" fill="none" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="6 3">
            <animateTransform attributeName="transform" type="rotate" values="360 860 360;0 860 360" dur="8s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 w-full">
        <div className="max-w-4xl">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm px-4 py-2 rounded-full mb-8"
            style={{ transform: `translateY(${scrollY * -0.1}px)`, opacity: Math.max(0, 1 - scrollY / 600) }}
          >
            {t("hero.badge")}
          </div>

          {/* Title — each line reveals */}
          <div style={{ transform: `translateY(${scrollY * -0.15}px)`, opacity: Math.max(0, 1 - scrollY / 800) }}>
            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-black leading-[0.95] tracking-tight">
              <span className="block text-white">{t("hero.title1")}</span>
              <span className="block bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {t("hero.title2")}
              </span>
              <span className="block text-white">{t("hero.title3")}</span>
            </h1>

            <p className="mt-8 text-lg sm:text-xl text-gray-400 max-w-2xl leading-relaxed">
              {t("hero.subtitle")}
            </p>
          </div>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4" style={{ opacity: Math.max(0, 1 - scrollY / 600) }}>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="group relative bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-bold px-8 py-4 rounded-2xl transition-all shadow-2xl shadow-indigo-600/30 hover:shadow-indigo-500/40 hover:scale-[1.02]"
            >
              <span className="relative z-10">{t("hero.cta")}</span>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition" />
            </button>
            <a href="/demo" className="flex items-center gap-3 text-gray-400 hover:text-white transition px-6 py-4 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/5">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              {t("hero.watchDemo")}
            </a>
          </div>
          <p className="mt-4 text-sm text-gray-600">{t("hero.ctaSub")}</p>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-3 gap-6 max-w-md">
            {[
              { val: t("hero.stat1"), label: t("hero.stat1Label") },
              { val: t("hero.stat2"), label: t("hero.stat2Label") },
              { val: t("hero.stat3"), label: t("hero.stat3Label") },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-black text-white">{s.val}</div>
                <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-600">
        <div className="w-6 h-10 border-2 border-gray-700 rounded-full flex justify-center pt-2">
          <div className="w-1.5 h-3 bg-gray-600 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}
