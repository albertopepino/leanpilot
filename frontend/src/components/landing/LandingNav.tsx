"use client";
import { useState, useEffect } from "react";
import Logo from "@/components/ui/Logo";

interface Props {
  t: (key: string) => string;
  lang: "en" | "it";
  setLang: (l: "en" | "it") => void;
}

export default function LandingNav({ t, lang, setLang }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      role="navigation"
      aria-label="Landing page navigation"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#030712]/80 backdrop-blur-xl border-b border-white/5 shadow-2xl shadow-indigo-500/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white">
            <Logo size={22} />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Lean<span className="text-indigo-400">Pilot</span>
          </span>
        </div>

        {/* Center links */}
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <button onClick={() => scrollTo("features")} className="hover:text-white transition">
            {t("nav.features")}
          </button>
          <button onClick={() => scrollTo("pricing")} className="hover:text-white transition">
            {t("nav.pricing")}
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <div className="flex bg-white/5 border border-white/10 rounded-full p-0.5 text-xs">
            <button
              onClick={() => setLang("en")}
              className={`px-2.5 py-1 rounded-full transition font-medium ${
                lang === "en" ? "bg-white/15 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang("it")}
              className={`px-2.5 py-1 rounded-full transition font-medium ${
                lang === "it" ? "bg-white/15 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              IT
            </button>
          </div>

          <a
            href="/"
            className="hidden sm:inline-flex text-sm text-gray-400 hover:text-white transition px-3 py-2"
          >
            {t("nav.login")}
          </a>
          <button
            onClick={() => scrollTo("signup")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40"
          >
            {t("nav.start")}
          </button>
        </div>
      </div>
    </nav>
  );
}
