"use client";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";

interface Props {
  t: (key: string) => string;
  scrollY: number;
}

/* ---- Animated word reveal ---- */
function AnimatedWords({
  text,
  className = "",
  delay = 0,
  mounted = false,
}: {
  text: string;
  className?: string;
  delay?: number;
  mounted?: boolean;
}) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden">
          <span
            className="inline-block transition-all duration-700"
            style={{
              transform: mounted ? "translateY(0)" : "translateY(110%)",
              opacity: mounted ? 1 : 0,
              transitionDelay: `${delay + i * 80}ms`,
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {word}&nbsp;
          </span>
        </span>
      ))}
    </span>
  );
}

/* ---- Magnetic button ---- */
function MagneticButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const handleMove = useCallback((e: React.MouseEvent) => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
  }, []);
  const handleLeave = useCallback(() => {
    if (btnRef.current) btnRef.current.style.transform = "translate(0,0)";
  }, []);
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`transition-transform duration-300 ease-out ${className}`}
    >
      {children}
    </button>
  );
}

/* ---- Floating factory metrics that orbit the mockup ---- */
function FloatingMetric({
  label,
  value,
  color,
  position,
  delay,
  mounted,
}: {
  label: string;
  value: string;
  color: string;
  position: string;
  delay: number;
  mounted: boolean;
}) {
  return (
    <div
      className={`absolute ${position} z-20 transition-all duration-1000`}
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0) scale(1)" : "translateY(20px) scale(0.8)",
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-gray-200/60 px-4 py-3 shadow-lg hover:shadow-xl transition-shadow animate-float" style={{ animationDelay: `${delay * 0.5}ms` }}>
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${color} animate-pulse`} />
          <div>
            <div className="text-sm font-bold text-gray-900 tabular-nums">{value}</div>
            <div className="text-[10px] text-gray-400 font-medium">{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Interactive dashboard mockup ---- */
function DashboardMockup({ mounted, scrollY }: { mounted: boolean; scrollY: number }) {
  const [oee, setOee] = useState(0);

  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      let current = 0;
      const interval = setInterval(() => {
        current += 1.8;
        if (current >= 84.7) {
          setOee(84.7);
          clearInterval(interval);
        } else setOee(current);
      }, 18);
      return () => clearInterval(interval);
    }, 1200);
    return () => clearTimeout(timer);
  }, [mounted]);

  const barHeights = useMemo(
    () => [62, 68, 72, 65, 78, 82, 75, 80, 84, 79, 85, 81, 88, 83, 86, 90, 82, 85, 87, 84, 89, 86, 83, 81],
    []
  );

  return (
    <div
      className="relative w-full max-w-4xl mx-auto transition-all duration-1000"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted
          ? `translateY(0) perspective(1200px) rotateX(${Math.min(scrollY * 0.02, 5)}deg)`
          : "translateY(60px) perspective(1200px) rotateX(8deg)",
        transitionDelay: "600ms",
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Glow behind */}
      <div className="absolute -inset-8 bg-gradient-to-b from-indigo-200/40 via-violet-200/20 to-transparent rounded-3xl blur-3xl" />

      <div className="relative bg-white rounded-2xl border border-gray-200/80 shadow-[0_25px_80px_-15px_rgba(0,0,0,0.12)] overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 px-5 py-3 bg-gray-50/80 border-b border-gray-100">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-200 hover:bg-red-400 transition-colors cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-gray-200 hover:bg-amber-400 transition-colors cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-gray-200 hover:bg-emerald-400 transition-colors cursor-pointer" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-4 py-1.5 max-w-sm w-full shadow-sm">
              <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-gray-400 font-mono">app.leanpilot.app/shop-floor</span>
            </div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-5 grid grid-cols-4 gap-4">
          {/* Sidebar */}
          <div className="col-span-1 space-y-1.5">
            {["Shop Floor", "OEE Live", "Andon", "Kaizen", "5 Why", "SMED", "TPM", "6S Audit"].map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-500 ${
                  i === 1 ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }`}
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateX(0)" : "translateX(-10px)",
                  transitionDelay: `${1200 + i * 60}ms`,
                }}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${i === 1 ? "bg-indigo-500" : "bg-gray-200"}`} />
                {item}
              </div>
            ))}
          </div>

          {/* Main area */}
          <div className="col-span-3 space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Availability", value: "94.2%", change: "+2.1%", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
                { label: "Performance", value: "87.1%", change: "-1.3%", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
                { label: "Quality", value: "99.1%", change: "+0.4%", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
              ].map((m, i) => (
                <div
                  key={m.label}
                  className={`${m.bg} rounded-xl p-3.5 border ${m.border} group hover:shadow-md transition-all duration-300`}
                  style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "translateY(0)" : "translateY(15px)",
                    transitionDelay: `${1400 + i * 100}ms`,
                    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                >
                  <div className="text-[10px] text-gray-400 mb-1 uppercase tracking-wider">{m.label}</div>
                  <div className="text-xl font-bold text-gray-900 group-hover:scale-105 transition-transform origin-left">{m.value}</div>
                  <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1 ${m.bg} ${m.color}`}>{m.change}</span>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-gray-500 font-medium">OEE — Live Production</span>
                </div>
                <span className="text-sm text-indigo-600 font-bold tabular-nums">{oee.toFixed(1)}%</span>
              </div>
              <div className="flex items-end gap-[3px] h-24">
                {barHeights.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-gradient-to-t from-indigo-600 to-indigo-400 hover:from-violet-600 hover:to-violet-400 transition-colors cursor-pointer"
                    style={{
                      height: `${v}%`,
                      opacity: oee > 0 ? 1 : 0,
                      transform: oee > 0 ? "scaleY(1)" : "scaleY(0)",
                      transformOrigin: "bottom",
                      transition: `all 0.6s cubic-bezier(0.22,1,0.36,1) ${i * 0.04}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating metrics */}
      <FloatingMetric label="SMED Alert" value="Line B > 15min" color="bg-amber-400" position="-top-4 -right-4 sm:right-4" delay={1800} mounted={mounted} />
      <FloatingMetric label="New Kaizen" value="CNC-4 Setup ↓" color="bg-emerald-400" position="-bottom-4 -left-4 sm:left-4" delay={2200} mounted={mounted} />
    </div>
  );
}

/* ---- Ticker: scrolling lean terms ---- */
function LeanTicker({ mounted }: { mounted: boolean }) {
  const terms = ["OEE", "SMED", "Kaizen", "5S/6S", "TPM", "Andon", "Gemba", "Jidoka", "Poka-Yoke", "VSM", "A3", "PDCA", "Kanban", "Heijunka"];
  return (
    <div
      className="mt-12 overflow-hidden transition-all duration-1000"
      style={{
        opacity: mounted ? 0.4 : 0,
        transitionDelay: "1600ms",
      }}
    >
      <div className="flex animate-ticker whitespace-nowrap">
        {[...terms, ...terms].map((term, i) => (
          <span key={i} className="mx-6 text-sm font-medium text-gray-300 tracking-widest uppercase">
            {term}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function HeroSection({ t, scrollY }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="relative pt-28 pb-8 sm:pt-36 sm:pb-12 overflow-hidden">
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.015) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent)",
        }}
      />

      {/* Morphing gradient blob */}
      <div
        className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[70vw] h-[50vw] opacity-60 animate-morph"
        style={{
          background: "radial-gradient(ellipse at center, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.06) 40%, transparent 70%)",
          transform: `translate(-50%, ${scrollY * 0.04}px)`,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Text block */}
        <div className="text-center max-w-5xl mx-auto">
          {/* Badge */}
          <div
            className="transition-all duration-700"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0) scale(1)" : "translateY(15px) scale(0.95)",
              transitionDelay: "100ms",
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <span className="inline-flex items-center gap-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-medium px-5 py-2.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              {t("hero.badge")}
            </span>
          </div>

          {/* Title — word-by-word reveal */}
          <h1 className="mt-8 text-[clamp(2.5rem,6vw,5.5rem)] font-black leading-[0.92] tracking-tight text-gray-900">
            <AnimatedWords text={t("hero.title1")} delay={300} mounted={mounted} />
            <br />
            <AnimatedWords
              text={t("hero.title2")}
              className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-shift"
              delay={500}
              mounted={mounted}
            />
            <br />
            <AnimatedWords text={t("hero.title3")} delay={700} mounted={mounted} />
          </h1>

          {/* Subtitle — blur in */}
          <p
            className="mt-8 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed transition-all duration-1000"
            style={{
              opacity: mounted ? 1 : 0,
              filter: mounted ? "blur(0)" : "blur(8px)",
              transform: mounted ? "translateY(0)" : "translateY(20px)",
              transitionDelay: "900ms",
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {t("hero.subtitle")}
          </p>

          {/* CTAs */}
          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-4 transition-all duration-1000"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(20px)",
              transitionDelay: "1100ms",
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <MagneticButton
              onClick={() => document.getElementById("cta")?.scrollIntoView({ behavior: "smooth" })}
              className="group relative px-8 py-4 text-sm font-semibold text-white rounded-full bg-gray-900 hover:bg-gray-800 shadow-lg shadow-gray-900/20 hover:shadow-xl hover:shadow-gray-900/30"
            >
              <span className="flex items-center gap-2.5">
                {t("hero.cta")}
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 10h12M12 6l4 4-4 4" />
                </svg>
              </span>
            </MagneticButton>

            <MagneticButton
              onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
              className="group flex items-center gap-3 px-7 py-4 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-full bg-white hover:bg-gray-50 shadow-sm transition-all"
            >
              <span className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center group-hover:from-indigo-200 group-hover:to-violet-200 transition-all">
                <svg className="w-3.5 h-3.5 text-indigo-600 ml-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </span>
              {t("hero.watchDemo")}
            </MagneticButton>
          </div>

          <p
            className="mt-4 text-sm text-gray-400 transition-all duration-700"
            style={{
              opacity: mounted ? 1 : 0,
              transitionDelay: "1300ms",
            }}
          >
            {t("hero.ctaSub")}
          </p>
        </div>

        {/* Dashboard mockup with 3D perspective */}
        <div className="mt-16 sm:mt-20">
          <DashboardMockup mounted={mounted} scrollY={scrollY} />
        </div>

        {/* Lean terms ticker */}
        <LeanTicker mounted={mounted} />
      </div>
    </section>
  );
}
