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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const navLinks = [
    { label: t("nav.features"), target: "showcase" },
    { label: t("nav.pricing"), target: "pricing" },
    { label: t("nav.resources"), target: "demo" },
  ];

  return (
    <>
      <nav
        role="navigation"
        aria-label="Main navigation"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm py-2.5"
            : "bg-transparent py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Logo size={18} />
            </div>
            <span className="font-bold text-lg tracking-tight text-gray-900">
              Lean<span className="text-indigo-600">Pilot</span>
            </span>
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.target}
                onClick={() => scrollTo(link.target)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100/60 transition-all"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language toggle */}
            <div className="flex items-center bg-gray-100 rounded-full p-0.5 mr-1">
              {(["en", "it"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-200 ${
                    lang === l ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            <a href="/login" className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition">
              {t("nav.login")}
            </a>

            <button
              onClick={() => scrollTo("cta")}
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-full bg-gray-900 hover:bg-gray-800 shadow-md shadow-gray-900/10 hover:shadow-gray-900/20 transition-all hover:-translate-y-0.5"
            >
              {t("nav.start")}
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <div className="w-5 flex flex-col gap-1.5">
              <span className={`block h-[2px] bg-gray-900 rounded-full transition-all duration-300 origin-center ${mobileOpen ? "rotate-45 translate-y-[5px]" : ""}`} />
              <span className={`block h-[2px] bg-gray-900 rounded-full transition-all duration-300 ${mobileOpen ? "opacity-0 scale-0" : ""}`} />
              <span className={`block h-[2px] bg-gray-900 rounded-full transition-all duration-300 origin-center ${mobileOpen ? "-rotate-45 -translate-y-[5px]" : ""}`} />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-0 right-0 w-80 max-w-[85vw] h-full bg-white border-l border-gray-200 p-6 pt-24 flex flex-col gap-2 animate-[slideInRight_0.3s_ease-out]">
            {navLinks.map((link) => (
              <button key={link.target} onClick={() => scrollTo(link.target)} className="text-left px-4 py-3 text-base text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition">
                {link.label}
              </button>
            ))}
            <hr className="border-gray-100 my-3" />
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-sm text-gray-400 mr-auto">Language</span>
              {(["en", "it"] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 text-sm rounded-lg transition ${lang === l ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-gray-600"}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <a href="/login" className="text-center px-4 py-3 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                {t("nav.login")}
              </a>
              <button onClick={() => scrollTo("cta")} className="px-4 py-3 text-sm font-semibold text-white rounded-xl bg-gray-900">
                {t("nav.start")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
