"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/stores/useI18n";
import Sidebar from "@/components/ui/Sidebar";
import Logo from "@/components/ui/Logo";
import HomePage from "@/components/dashboard/HomePage";
import OEEDashboard from "@/components/dashboard/OEEDashboard";
import KaizenBoard from "@/components/lean/KaizenBoard";
import FiveWhyForm from "@/components/lean/FiveWhyForm";
import IshikawaDiagram from "@/components/lean/IshikawaDiagram";
import SMEDTracker from "@/components/lean/SMEDTracker";
import ProductionInput from "@/components/dashboard/ProductionInput";
import FactoryCopilot from "@/components/ai/FactoryCopilot";
import SixSAudit from "@/components/lean/SixSAudit";
import VSMEditor from "@/components/lean/VSMEditor";
import A3Report from "@/components/lean/A3Report";
import GembaWalk from "@/components/lean/GembaWalk";
import SafetyTracker from "@/components/lean/SafetyTracker";
import TPMDashboard from "@/components/lean/TPMDashboard";
import CILTChecklist from "@/components/lean/CILTChecklist";
import AndonBoard from "@/components/lean/AndonBoard";
import ParetoChart from "@/components/lean/ParetoChart";
import HourlyProductionBoard from "@/components/lean/HourlyProductionBoard";
import LeanAssessment from "@/components/lean/LeanAssessment";
import MindMap from "@/components/lean/MindMap";
import ConsolidatedOEE from "@/components/dashboard/ConsolidatedOEE";
import MasterCalendar from "@/components/calendar/MasterCalendar";
import AdminPanel from "@/components/admin/AdminPanel";
import ProductionOrderBoard from "@/components/manufacturing/ProductionOrderBoard";
import ProductCatalog from "@/components/manufacturing/ProductCatalog";
import DefectCatalogAdmin from "@/components/manufacturing/DefectCatalogAdmin";
import QCPolicyRepository from "@/components/manufacturing/QCPolicyRepository";
import QCChecksBoard from "@/components/manufacturing/QCChecksBoard";
import NCRBoard from "@/components/manufacturing/NCRBoard";
import CAPABoard from "@/components/manufacturing/CAPABoard";
import BOMManager from "@/components/manufacturing/BOMManager";
import SettingsPage from "@/components/settings/SettingsPage";
import ConsentGate from "@/components/gdpr/ConsentGate";
import OnboardingTutorial, { isOnboardingComplete } from "@/components/onboarding/OnboardingTutorial";

type View =
  | "home"
  | "dashboard" | "production" | "kaizen" | "five-why" | "ishikawa" | "smed" | "copilot"
  | "six-s" | "vsm" | "a3" | "gemba" | "tpm" | "cilt" | "andon" | "pareto" | "hourly"
  | "resources" | "assessment" | "admin"
  | "production-orders" | "products" | "bom" | "defect-catalog" | "qc-policies" | "qc-checks" | "ncr" | "capa"
  | "safety" | "mind-map" | "consolidated-oee"
  | "master-calendar"
  | "settings";

const viewTitleKeys: Record<View, string> = {
  home: "common.titleHome",
  dashboard: "common.titleDashboard",
  production: "common.titleProduction",
  kaizen: "common.titleKaizen",
  "five-why": "common.titleFiveWhy",
  ishikawa: "common.titleIshikawa",
  smed: "common.titleSmed",
  copilot: "common.titleCopilot",
  "six-s": "common.titleSixS",
  vsm: "common.titleVsm",
  a3: "common.titleA3",
  gemba: "common.titleGemba",
  tpm: "common.titleTpm",
  cilt: "common.titleCilt",
  andon: "common.titleAndon",
  pareto: "common.titlePareto",
  hourly: "common.titleHourly",
  resources: "common.titleResources",
  assessment: "common.titleAssessment",
  admin: "common.titleAdmin",
  "production-orders": "common.titleProductionOrders",
  products: "common.titleProducts",
  bom: "common.titleBOM",
  "defect-catalog": "common.titleDefectCatalog",
  "qc-policies": "common.titleQCPolicies",
  "qc-checks": "common.titleQCChecks",
  ncr: "common.titleNCR",
  capa: "common.titleCAPA",
  safety: "common.titleSafety",
  "mind-map": "common.titleMindMap",
  "consolidated-oee": "common.titleConsolidated",
  "master-calendar": "common.titleMasterCalendar",
  settings: "common.titleSettings",
};

export default function Home() {
  const { user, loading, loadUser } = useAuth();
  const { t } = useI18n();
  const [currentView, setCurrentView] = useState<View>("home");
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Check if onboarding should show after user loads
  useEffect(() => {
    if (user && !isOnboardingComplete(user.id)) {
      setShowOnboarding(true);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-brand-900 via-[#1e1b4b] to-brand-800 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-purple-500/8 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-400/5 rounded-full blur-3xl" />

        <div className="text-center relative z-10">
          {/* Logo with glow ring */}
          <div className="relative mx-auto mb-6 w-20 h-20">
            <div className="absolute inset-0 bg-brand-500/20 rounded-2xl blur-xl animate-pulse-slow" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center text-white shadow-glow">
              <Logo size={44} />
            </div>
          </div>

          {/* App name */}
          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">LeanPilot</h1>
          <p className="text-[10px] text-brand-300/60 uppercase tracking-[0.25em] mb-8">DMAIC Methodology</p>

          {/* Loading bar */}
          <div className="w-48 h-0.5 mx-auto bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-400 to-brand-500 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
          </div>
          <p className="text-brand-300/50 text-xs mt-3">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <ConsentGate>
    <div className="flex min-h-screen bg-th-bg">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      <main
        id="main-content"
        role="main"
        aria-label={t(viewTitleKeys[currentView])}
        className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto ml-0 md:ml-0"
      >
        {currentView !== "home" && (
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-th-text">{t(viewTitleKeys[currentView])}</h1>
            <p className="text-sm text-th-text-2">{user?.full_name} &middot; {user?.role}</p>
          </header>
        )}
        <div aria-live="polite" aria-atomic="true" className="sr-only" id="status-announcer" />

        {currentView === "home" && showOnboarding && (
          <OnboardingTutorial
            onNavigate={(v) => { setShowOnboarding(false); setCurrentView(v as View); }}
            onComplete={() => setShowOnboarding(false)}
          />
        )}
        {currentView === "home" && !showOnboarding && <HomePage onNavigate={(v) => setCurrentView(v as View)} />}
        {currentView === "dashboard" && <OEEDashboard onNavigate={(v) => setCurrentView(v as View)} />}
        {currentView === "production" && <ProductionInput />}
        {currentView === "kaizen" && <KaizenBoard />}
        {currentView === "five-why" && <FiveWhyForm />}
        {currentView === "ishikawa" && <IshikawaDiagram />}
        {currentView === "smed" && <SMEDTracker />}
        {currentView === "copilot" && <FactoryCopilot />}
        {currentView === "six-s" && <SixSAudit />}
        {currentView === "vsm" && <VSMEditor />}
        {currentView === "a3" && <A3Report />}
        {currentView === "gemba" && <GembaWalk />}
        {currentView === "tpm" && <TPMDashboard />}
        {currentView === "cilt" && <CILTChecklist />}
        {currentView === "andon" && <AndonBoard />}
        {currentView === "pareto" && <ParetoChart />}
        {currentView === "hourly" && <HourlyProductionBoard />}
        {currentView === "resources" && <ResourcesPage />}
        {currentView === "assessment" && <LeanAssessment />}
        {currentView === "admin" && <AdminPanel />}
        {currentView === "production-orders" && <ProductionOrderBoard />}
        {currentView === "products" && <ProductCatalog />}
        {currentView === "bom" && <BOMManager />}
        {currentView === "defect-catalog" && <DefectCatalogAdmin />}
        {currentView === "qc-policies" && <QCPolicyRepository />}
        {currentView === "qc-checks" && <QCChecksBoard />}
        {currentView === "ncr" && <NCRBoard />}
        {currentView === "capa" && <CAPABoard />}
        {currentView === "safety" && <SafetyTracker />}
        {currentView === "mind-map" && <MindMap />}
        {currentView === "consolidated-oee" && <ConsolidatedOEE />}
        {currentView === "master-calendar" && <MasterCalendar onNavigate={(v) => setCurrentView(v as View)} />}
        {currentView === "settings" && <SettingsPage />}
      </main>
    </div>
    </ConsentGate>
  );
}

/* ============================================================
   LOGIN PAGE — with rotating Lean management quotes
   ============================================================ */
const QUOTE_KEYS = Array.from({ length: 14 }, (_, i) => `login.quote${i + 1}`);
const AUTHOR_KEYS = Array.from({ length: 14 }, (_, i) => `login.author${i + 1}`);

function ToolPill({ label, tooltip }: { label: string; tooltip: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative cursor-default group"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
      role="button"
      aria-label={`${label}: ${tooltip}`}
    >
      <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide bg-white/[0.07] text-brand-300 border border-white/[0.08] transition-all duration-200 hover:bg-brand-500/20 hover:text-white hover:border-brand-400/30 hover:scale-105">
        {label}
      </span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-white text-gray-900 text-[11px] font-medium shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-150 z-20">
          {tooltip}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-white" />
        </span>
      )}
    </span>
  );
}

function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    setQuoteIdx(Math.floor(Math.random() * QUOTE_KEYS.length));
    const iv = setInterval(() => setQuoteIdx((i) => (i + 1) % QUOTE_KEYS.length), 8000);
    return () => clearInterval(iv);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch {
      setError(t("login.invalidCredentials"));
    }
  };

  const quoteText = t(QUOTE_KEYS[quoteIdx]);
  const quoteAuthor = t(AUTHOR_KEYS[quoteIdx]);

  /* Lean tools grouped by DMAIC cycle */
  const toolGroups = [
    { phase: t("login.phaseDefine"),  tools: [
      { label: "OEE",   tip: t("login.tipOee") },
    ]},
    { phase: t("login.phaseMeasure"),  tools: [
      { label: "VSM",   tip: t("login.tipVsm") },
    ]},
    { phase: t("login.phaseAnalyze"),  tools: [
      { label: "A3",    tip: t("login.tipA3") },
      { label: "Gemba", tip: t("login.tipGemba") },
    ]},
    { phase: t("login.phaseImprove"),  tools: [
      { label: "Kaizen", tip: t("login.tipKaizen") },
      { label: "SMED",   tip: t("login.tipSmed") },
    ]},
    { phase: t("login.phaseControl"),  tools: [
      { label: "5S",     tip: t("login.tipFiveS") },
      { label: "TPM",   tip: t("login.tipTpm") },
    ]},
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left — branding + quote */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-900 via-[#1e1b4b] to-brand-800 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center text-white shadow-glow">
              <Logo size={30} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">LeanPilot</h1>
              <p className="text-xs text-brand-300 uppercase tracking-widest">{t("login.subtitle")}</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="transition-all duration-700" key={quoteIdx}>
            <p className="text-xl text-white/90 font-light leading-relaxed italic">
              &ldquo;{quoteText}&rdquo;
            </p>
            <p className="text-sm text-brand-300 mt-3">— {quoteAuthor}</p>
          </div>
          {/* Trust anchoring */}
          <p className="text-xs text-brand-400/80 font-medium tracking-wide">
            {t("login.trustLine")}
          </p>
        </div>

        {/* Lean tools — grouped by CI flow */}
        <div className="relative z-10 space-y-3">
          {toolGroups.map((g) => (
            <div key={g.phase} className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-brand-500/60 font-semibold w-16 shrink-0">{g.phase}</span>
              <span className="text-brand-500/30 mr-1">›</span>
              <div className="flex gap-1.5 flex-wrap">
                {g.tools.map((tool) => (
                  <ToolPill key={tool.label} label={tool.label} tooltip={tool.tip} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-th-bg">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center text-white shadow-glow">
              <Logo size={30} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-th-text">LeanPilot</h1>
              <p className="text-[10px] text-th-text-2 uppercase tracking-widest">{t("login.subtitle")}</p>
            </div>
          </div>

          <div className="bg-th-bg-2 rounded-2xl p-8 shadow-card border border-th-border">
            <h2 className="text-xl font-bold text-th-text mb-1">{t("login.welcomeBack")}</h2>
            <p className="text-sm text-th-text-2 mb-6">{t("login.signInSubtitle")}</p>

            {/* Mobile quote */}
            <div className="lg:hidden bg-brand-50 dark:bg-brand-900/30 rounded-xl p-4 mb-6 border border-brand-100 dark:border-brand-800">
              <p className="text-sm text-brand-800 dark:text-brand-200 italic">&ldquo;{quoteText}&rdquo;</p>
              <p className="text-xs text-brand-500 dark:text-brand-400 mt-1">— {quoteAuthor}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" aria-label={t("login.welcomeBack")}>
              <div>
                <label htmlFor="login-email" className="text-xs font-medium text-th-text-2 mb-1 block">{t("login.email")}</label>
                <input
                  id="login-email"
                  type="text"
                  autoComplete="username"
                  placeholder={t("login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-required="true"
                  aria-invalid={error ? "true" : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className="w-full px-4 py-3 border border-th-border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm bg-th-input text-th-text"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="text-xs font-medium text-th-text-2 mb-1 block">{t("login.password")}</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-required="true"
                  aria-invalid={error ? "true" : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className="w-full px-4 py-3 border border-th-border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm bg-th-input text-th-text"
                />
              </div>
              {error && (
                <div id="login-error" role="alert" aria-live="assertive" className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-xl">{error}</div>
              )}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-brand-600 to-brand-500 text-white py-3 rounded-xl font-semibold hover:shadow-glow transition-all text-sm"
              >
                {t("common.signIn")}
              </button>
            </form>

            <p className="text-center text-xs text-th-text-3 mt-6">
              {t("common.poweredBy")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   RESOURCES PAGE — authoritative Lean sources
   ============================================================ */
function getResourceSections(t: (key: string) => string) {
  return [
    {
      title: t("resources.sectionBooks"),
      icon: "📖",
      color: "from-blue-500 to-indigo-500",
      items: [
        { name: t("resources.bookToyotaWay"), author: "Jeffrey K. Liker", desc: t("resources.bookToyotaWayDesc"), url: "https://www.lean.org/bookstore/product/the-toyota-way/" },
        { name: t("resources.bookLeanThinking"), author: "Womack & Jones", desc: t("resources.bookLeanThinkingDesc"), url: "https://www.lean.org/bookstore/" },
        { name: t("resources.bookTPS"), author: "Taiichi Ohno", desc: t("resources.bookTPSDesc"), url: "https://www.lean.org/bookstore/" },
        { name: t("resources.bookLearningToSee"), author: "Rother & Shook", desc: t("resources.bookLearningToSeeDesc"), url: "https://www.lean.org/bookstore/product/learning-to-see/" },
      ],
    },
    {
      title: t("resources.sectionOrganizations"),
      icon: "🏛️",
      color: "from-emerald-500 to-teal-500",
      items: [
        { name: t("resources.orgLEI"), author: "lean.org", desc: t("resources.orgLEIDesc"), url: "https://www.lean.org/" },
        { name: t("resources.orgLEA"), author: "leanuk.org", desc: t("resources.orgLEADesc"), url: "https://www.leanuk.org/" },
        { name: t("resources.orgAME"), author: "ame.org", desc: t("resources.orgAMEDesc"), url: "https://www.ame.org/" },
        { name: t("resources.orgShingo"), author: "shingo.org", desc: t("resources.orgShingoDesc"), url: "https://shingo.org/" },
      ],
    },
    {
      title: t("resources.sectionLearning"),
      icon: "🎓",
      color: "from-purple-500 to-violet-500",
      items: [
        { name: t("resources.learnLEI"), author: "lean.org", desc: t("resources.learnLEIDesc"), url: "https://www.lean.org/online-learning/" },
        { name: t("resources.learnGemba"), author: "gembaacademy.com", desc: t("resources.learnGembaDesc"), url: "https://www.gembaacademy.com/" },
        { name: t("resources.learnKata"), author: "toyota-kata.org", desc: t("resources.learnKataDesc"), url: "http://www-personal.umich.edu/~mrother/Kata.html" },
        { name: t("resources.learnTools"), author: "leanmanufacturingtools.org", desc: t("resources.learnToolsDesc"), url: "https://leanmanufacturingtools.org/" },
      ],
    },
    {
      title: t("resources.sectionStandards"),
      icon: "📐",
      color: "from-amber-500 to-orange-500",
      items: [
        { name: t("resources.stdOEE"), author: "oee.com", desc: t("resources.stdOEEDesc"), url: "https://www.oee.com/" },
        { name: t("resources.stdTPM"), author: "jipm.or.jp", desc: t("resources.stdTPMDesc"), url: "https://www.jipm.or.jp/en/" },
        { name: t("resources.stdISO"), author: "iso.org", desc: t("resources.stdISODesc"), url: "https://www.iso.org/" },
        { name: t("resources.stdIndustry4"), author: "mckinsey.com", desc: t("resources.stdIndustry4Desc"), url: "https://www.mckinsey.com/capabilities/operations/our-insights" },
      ],
    },
  ];
}

function ResourcesPage() {
  const { t } = useI18n();
  const resourceSections = getResourceSections(t);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-gradient-to-r from-brand-500 to-purple-600 rounded-2xl p-6 text-white shadow-glow">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl backdrop-blur-sm">📚</div>
          <div>
            <h2 className="text-xl font-bold">{t("resources.title")}</h2>
            <p className="text-sm text-white/80">{t("resources.subtitle")}</p>
          </div>
        </div>
      </div>

      {resourceSections.map((section) => (
        <div key={section.title}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{section.icon}</span>
            <h3 className="font-bold text-th-text">{section.title}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {section.items.map((item) => (
              <a
                key={item.name}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-th-bg-2 rounded-xl p-4 shadow-card border border-th-border hover:shadow-card-hover hover:-translate-y-0.5 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                    {item.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-th-text group-hover:text-brand-600 transition">{item.name}</h4>
                    <p className="text-[11px] text-th-text-3">{item.author}</p>
                    <p className="text-xs text-th-text-2 mt-1 line-clamp-2">{item.desc}</p>
                  </div>
                  <span className="text-th-text-3 group-hover:text-brand-500 transition text-lg ml-auto shrink-0">→</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
