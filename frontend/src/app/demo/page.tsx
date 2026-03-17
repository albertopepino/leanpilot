"use client";
import { useState } from "react";
import { useI18n } from "@/stores/useI18n";
import Link from "next/link";

// Lean tool components
import OEEDashboard from "@/components/dashboard/OEEDashboard";
import KaizenBoard from "@/components/lean/KaizenBoard";
import FiveWhyForm from "@/components/lean/FiveWhyForm";
import IshikawaDiagram from "@/components/lean/IshikawaDiagram";
import SMEDTracker from "@/components/lean/SMEDTracker";
import ProductionInput from "@/components/dashboard/ProductionInput";
import SixSAudit from "@/components/lean/SixSAudit";
import VSMEditor from "@/components/lean/VSMEditor";
import A3Report from "@/components/lean/A3Report";
import GembaWalk from "@/components/lean/GembaWalk";
import TPMDashboard from "@/components/lean/TPMDashboard";
import CILTChecklist from "@/components/lean/CILTChecklist";
import AndonBoard from "@/components/lean/AndonBoard";
import ParetoChart from "@/components/lean/ParetoChart";
import HourlyProductionBoard from "@/components/lean/HourlyProductionBoard";
import LeanAssessment from "@/components/lean/LeanAssessment";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Logo from "@/components/ui/Logo";

type View =
  | "dashboard" | "production" | "kaizen" | "five-why" | "ishikawa" | "smed"
  | "six-s" | "vsm" | "a3" | "gemba" | "tpm" | "cilt" | "andon" | "pareto" | "hourly"
  | "assessment";

const viewTitleKeys: Record<View, string> = {
  dashboard: "common.titleDashboard",
  production: "common.titleProduction",
  kaizen: "common.titleKaizen",
  "five-why": "common.titleFiveWhy",
  ishikawa: "common.titleIshikawa",
  smed: "common.titleSmed",
  "six-s": "common.titleSixS",
  vsm: "common.titleVsm",
  a3: "common.titleA3",
  gemba: "common.titleGemba",
  tpm: "common.titleTpm",
  cilt: "common.titleCilt",
  andon: "common.titleAndon",
  pareto: "common.titlePareto",
  hourly: "common.titleHourly",
  assessment: "common.titleAssessment",
};

interface NavItem { id: string; labelKey: string; icon: string; badge?: string }

const sections: { titleKey: string; items: NavItem[] }[] = [
  {
    titleKey: "common.navGettingStarted",
    items: [{ id: "assessment", labelKey: "common.navAssessment", icon: "\u{1F9ED}", badge: "NEW" }],
  },
  {
    titleKey: "common.navOverview",
    items: [
      { id: "dashboard", labelKey: "common.navDashboard", icon: "\u{1F4CA}" },
      { id: "hourly", labelKey: "common.navHourly", icon: "\u23F1\uFE0F" },
      { id: "andon", labelKey: "common.navAndon", icon: "\u{1F6A6}" },
      { id: "production", labelKey: "common.navProduction", icon: "\u{1F3ED}" },
    ],
  },
  {
    titleKey: "common.navProblemSolving",
    items: [
      { id: "five-why", labelKey: "common.navFiveWhy", icon: "\u2753" },
      { id: "ishikawa", labelKey: "common.navIshikawa", icon: "\u{1F41F}" },
      { id: "pareto", labelKey: "common.navPareto", icon: "\u{1F4C8}" },
      { id: "a3", labelKey: "common.navA3", icon: "\u{1F4CB}" },
    ],
  },
  {
    titleKey: "common.navContinuousImprovement",
    items: [
      { id: "kaizen", labelKey: "common.navKaizen", icon: "\u{1F4A1}" },
      { id: "vsm", labelKey: "common.navVsm", icon: "\u{1F5FA}\uFE0F" },
      { id: "smed", labelKey: "common.navSmed", icon: "\u{1F504}" },
      { id: "gemba", labelKey: "common.navGemba", icon: "\u{1F6B6}" },
    ],
  },
  {
    titleKey: "common.navMaintenanceStandards",
    items: [
      { id: "six-s", labelKey: "common.navSixS", icon: "\u2728" },
      { id: "tpm", labelKey: "common.navTpm", icon: "\u2699\uFE0F" },
      { id: "cilt", labelKey: "common.navCilt", icon: "\u{1F527}" },
    ],
  },
];

export default function DemoPage() {
  const { t } = useI18n();
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-th-bg">
      {/* Demo Banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center py-2 px-4 text-sm font-semibold shadow-lg">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span>{"\u{1F680}"} {t("common.demoBanner")}</span>
          <Link
            href="/landing"
            className="inline-flex items-center gap-1 bg-white text-orange-600 px-4 py-1 rounded-full text-xs font-bold hover:bg-orange-50 transition"
          >
            {t("common.demoStartTrial")} {"\u2192"}
          </Link>
        </div>
      </div>

      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-14 left-4 z-50 w-10 h-10 bg-brand-900 text-white rounded-xl flex items-center justify-center shadow-lg"
      >
        {sidebarOpen ? "\u2715" : "\u2630"}
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30 pt-10" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } fixed md:sticky top-10 left-0 z-40 w-64 bg-gradient-to-b from-brand-900 via-brand-900 to-[#1a1545] text-white min-h-[calc(100vh-2.5rem)] max-h-[calc(100vh-2.5rem)] overflow-y-auto flex flex-col transition-transform duration-300`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center shadow-glow text-white">
              <Logo size={26} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">LeanPilot</h2>
              <p className="text-[10px] text-brand-300 opacity-60 uppercase tracking-widest">Live Demo</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.titleKey}>
              <p className="text-[10px] uppercase text-brand-300 opacity-40 px-3 pt-4 pb-1 tracking-widest font-semibold">
                {t(section.titleKey)}
              </p>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id as View);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                    currentView === item.id
                      ? "bg-white/15 text-white font-semibold shadow-inner"
                      : "text-brand-200 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="truncate">{t(item.labelKey)}</span>
                  {item.badge && (
                    <span className="ml-auto text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-white px-2 py-0.5 rounded-full font-bold shadow">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Language + Theme toggles */}
        <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        {/* Demo user footer */}
        <div className="p-4 border-t border-white/10 bg-black/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-xs font-bold">
              D
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{t("common.demoUser")}</p>
              <p className="text-[10px] text-brand-300 opacity-60 truncate">{t("common.demoRole")}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto mt-10">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-th-text">{t(viewTitleKeys[currentView])}</h1>
          <p className="text-sm text-th-text-2">{t("common.demoUser")} &middot; {t("common.demoRole")}</p>
        </header>

        {currentView === "dashboard" && <OEEDashboard />}
        {currentView === "production" && <ProductionInput />}
        {currentView === "kaizen" && <KaizenBoard />}
        {currentView === "five-why" && <FiveWhyForm />}
        {currentView === "ishikawa" && <IshikawaDiagram />}
        {currentView === "smed" && <SMEDTracker />}
        {currentView === "six-s" && <SixSAudit />}
        {currentView === "vsm" && <VSMEditor />}
        {currentView === "a3" && <A3Report />}
        {currentView === "gemba" && <GembaWalk />}
        {currentView === "tpm" && <TPMDashboard />}
        {currentView === "cilt" && <CILTChecklist />}
        {currentView === "andon" && <AndonBoard />}
        {currentView === "pareto" && <ParetoChart />}
        {currentView === "hourly" && <HourlyProductionBoard />}
        {currentView === "assessment" && <LeanAssessment />}
      </main>
    </div>
  );
}
