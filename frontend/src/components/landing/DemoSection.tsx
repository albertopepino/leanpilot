"use client";
import { useState, useRef } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface Props {
  t: (key: string) => string;
}

export default function DemoSection({ t }: Props) {
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();
  const { ref: demoRef, isVisible: demoVisible } = useScrollReveal({ threshold: 0.1 });
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMove = (e: React.MouseEvent) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const handleLeave = () => setMousePos({ x: 0, y: 0 });

  return (
    <section id="demo" className="relative py-24 sm:py-32 bg-gray-50/60">
      <div className="max-w-7xl mx-auto px-6">
        <div
          ref={headerRef}
          className={`text-center max-w-3xl mx-auto mb-12 transition-all duration-700 ${
            headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-violet-600 mb-4">
            {t("demo.eyebrow")}
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 leading-[0.95]">
            {t("demo.title")}
          </h2>
          <p className="mt-5 text-lg text-gray-500 leading-relaxed">
            {t("demo.subtitle")}
          </p>
        </div>

        <div
          ref={demoRef}
          className={`relative max-w-5xl mx-auto transition-all duration-700 delay-200 ${
            demoVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          {/* 3D tilt container */}
          <div
            ref={frameRef}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            className="relative"
            style={{
              transform: `perspective(1200px) rotateY(${mousePos.x * 5}deg) rotateX(${-mousePos.y * 5}deg)`,
              transition: "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {/* Shadow */}
            <div className="absolute -inset-4 bg-gradient-to-b from-indigo-100/30 via-violet-100/20 to-transparent rounded-3xl blur-2xl" />

            <div className="relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xl">
              {/* Browser chrome */}
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gray-200 hover:bg-red-400 transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-gray-200 hover:bg-amber-400 transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-gray-200 hover:bg-emerald-400 transition-colors" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-4 py-1.5 max-w-md w-full shadow-sm">
                    <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs text-gray-400 font-mono">demo.leanpilot.app/shop-floor</span>
                  </div>
                </div>
              </div>

              {!showDemo ? (
                <div className="relative aspect-video flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100/80">
                  {/* Static mockup preview */}
                  <div className="absolute inset-0 p-8 opacity-25">
                    <div className="grid grid-cols-4 gap-3 h-full">
                      <div className="col-span-1 bg-gray-100 rounded-xl p-3 space-y-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-gray-200" />
                            <div className="h-2 rounded bg-gray-200 flex-1" />
                          </div>
                        ))}
                      </div>
                      <div className="col-span-3 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-gray-100 rounded-xl p-4 space-y-2">
                              <div className="h-3 w-16 rounded bg-gray-200" />
                              <div className="h-8 w-20 rounded bg-gray-200" />
                            </div>
                          ))}
                        </div>
                        <div className="bg-gray-100 rounded-xl p-4 flex-1 min-h-[200px]">
                          <div className="h-3 w-24 rounded bg-gray-200 mb-4" />
                          <div className="flex items-end gap-1 h-32">
                            {[52,68,45,78,62,85,55,72,90,48,76,63,82,58,74,88,50,70,65,80,56,73,67,84].map((v, i) => (
                              <div key={i} className="flex-1 rounded-sm bg-indigo-200" style={{ height: `${v}%` }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Play button */}
                  <button
                    onClick={() => setShowDemo(true)}
                    className="relative z-10 group flex flex-col items-center gap-5"
                  >
                    <div className="relative">
                      <div className="absolute -inset-6 bg-indigo-200/40 rounded-full blur-xl group-hover:bg-indigo-300/50 transition-all animate-pulse" />
                      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-xl group-hover:shadow-indigo-500/40 group-hover:scale-110 transition-all duration-300">
                        <svg className="w-8 h-8 text-white ml-1" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 font-semibold group-hover:text-gray-900 transition">
                      {t("demo.cta")}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="relative aspect-video">
                  {!demoLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        <span className="text-sm text-gray-400">Loading shop floor demo...</span>
                      </div>
                    </div>
                  )}
                  <iframe
                    src="/dashboard/oee"
                    className="w-full h-full border-0"
                    title="LeanPilot Demo"
                    onLoad={() => setDemoLoaded(true)}
                  />
                </div>
              )}
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-gray-400">
            {t("demo.hint")}
          </p>
        </div>
      </div>
    </section>
  );
}
