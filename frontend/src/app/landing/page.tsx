"use client";
import { useState, useEffect, useRef } from "react";
import CookieConsent from "@/components/landing/CookieConsent";
import PrivacyModal from "@/components/landing/PrivacyModal";
import PricingSection from "@/components/landing/PricingSection";
import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import ProblemSection from "@/components/landing/ProblemSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import SocialProof from "@/components/landing/SocialProof";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

type Lang = "en" | "it";

const translations: Record<Lang, Record<string, string>> = {
  en: {
    // Nav
    "nav.features": "Features",
    "nav.pricing": "Pricing",
    "nav.login": "Log In",
    "nav.start": "Start Free Trial",
    // Hero
    "hero.badge": "🏭 Built for factories that make things",
    "hero.title1": "Stop guessing.",
    "hero.title2": "Start measuring.",
    "hero.title3": "Go Lean.",
    "hero.subtitle": "17 digital lean tools — from OEE dashboards to AI-powered root cause analysis. Built for SME factories with 10-500 employees who are serious about operational excellence.",
    "hero.cta": "Start 14-Day Free Trial",
    "hero.ctaSub": "No credit card required • Setup in 5 minutes",
    "hero.watchDemo": "Try Live Demo",
    "hero.stat1": "17",
    "hero.stat1Label": "Lean Tools",
    "hero.stat2": "< 5 min",
    "hero.stat2Label": "Setup Time",
    "hero.stat3": "2",
    "hero.stat3Label": "Languages",
    // Problem
    "problem.eyebrow": "THE PROBLEM",
    "problem.title": "Your factory floor is a black box",
    "problem.subtitle": "Most SME manufacturers still run on gut feelings, whiteboards, and spreadsheets. Sound familiar?",
    "problem.p1": "\"We don't know our real OEE\"",
    "problem.p1d": "Production data lives on paper. By the time you see it, it's yesterday's news.",
    "problem.p2": "\"Quality issues keep coming back\"",
    "problem.p2d": "Without structured root cause analysis, you're fixing symptoms, not problems.",
    "problem.p3": "\"Changeovers take forever\"",
    "problem.p3d": "No SMED tracking means changeover time is invisible and unoptimized.",
    "problem.p4": "\"Our improvement ideas get lost\"",
    "problem.p4d": "Kaizen suggestions on sticky notes. No tracking, no accountability, no results.",
    "problem.arrow": "There's a better way ↓",
    // Features
    "features.eyebrow": "THE SOLUTION",
    "features.title": "Everything a lean factory needs. Nothing it doesn't.",
    "features.cat1": "See Everything",
    "features.cat1d": "Real-time production visibility",
    "features.cat2": "Solve Anything",
    "features.cat2d": "Structured problem-solving tools",
    "features.cat3": "Improve Always",
    "features.cat3d": "Continuous improvement engine",
    "features.cat4": "Maintain Smart",
    "features.cat4d": "Predictive maintenance & standards",
    "features.cat5": "AI Copilot",
    "features.cat5d": "Your on-demand lean consultant",
    "features.tool.oee": "OEE Dashboard",
    "features.tool.hourly": "Hourly Tracking",
    "features.tool.andon": "Andon Board",
    "features.tool.production": "Production Input",
    "features.tool.fivewhy": "5 Why Analysis",
    "features.tool.ishikawa": "Ishikawa Diagram",
    "features.tool.pareto": "Pareto Analysis",
    "features.tool.a3": "A3 Report",
    "features.tool.kaizen": "Kaizen Board",
    "features.tool.vsm": "Value Stream Map",
    "features.tool.smed": "SMED Tracker",
    "features.tool.gemba": "Gemba Walk",
    "features.tool.sixs": "6S Audit",
    "features.tool.tpm": "TPM Dashboard",
    "features.tool.cilt": "CILT Checklist",
    "features.tool.copilot": "Factory Copilot",
    "features.tool.assessment": "Lean Assessment",
    // Social proof
    "social.eyebrow": "TRUSTED BY LEAN PRACTITIONERS",
    "social.quote1": "Finally, a platform that speaks lean — not just IT.",
    "social.author1": "Plant Manager, Automotive Tier 2",
    "social.quote2": "We identified €47,000 in annual savings within the first month using the Pareto and OEE tools.",
    "social.author2": "Continuous Improvement Lead, Food Manufacturing",
    "social.quote3": "The AI Copilot is like having a lean consultant on speed dial.",
    "social.author3": "Operations Director, Precision Engineering",
    // CTA
    "cta.title": "Ready to see your factory differently?",
    "cta.subtitle": "Join hundreds of European manufacturers who chose to stop guessing and start measuring.",
    "cta.btn": "Start Your Free Trial",
    "cta.sub": "14 days free • Full access • No credit card",
    "cta.email": "Work email",
    "cta.factory": "Factory name",
    "cta.employees": "Number of employees",
    "cta.consent": "I agree to the",
    "cta.privacy": "Privacy Policy",
    "cta.terms": "Terms of Service",
    "cta.and": "and",
    "cta.submit": "Create My Account →",
    "cta.sending": "Creating account...",
    "cta.success": "✓ Check your email for login credentials!",
    // Footer
    "footer.product": "Product",
    "footer.legal": "Legal",
    "footer.company": "Company",
    "footer.privacy": "Privacy Policy",
    "footer.terms": "Terms of Service",
    "footer.cookies": "Cookie Policy",
    "footer.dpa": "Data Processing Agreement",
    "footer.about": "About Us",
    "footer.contact": "Contact",
    "footer.blog": "Blog",
    "footer.gdpr": "GDPR Compliant",
    "footer.copy": "© {year} LeanPilot. All rights reserved.",
    "footer.tagline": "Made with ❤️ for factories that make things.",
    // Cookie consent
    "cookie.title": "We respect your privacy",
    "cookie.text": "We use essential cookies for the platform to function. Analytics cookies help us improve — but only with your consent.",
    "cookie.accept": "Accept All",
    "cookie.reject": "Essential Only",
    "cookie.settings": "Cookie Settings",
    "cookie.essentialTitle": "Essential Cookies",
    "cookie.essentialDesc": "Required for the platform to function (session, security, language).",
    "cookie.alwaysOn": "Always On",
    "cookie.analyticsTitle": "Analytics Cookies",
    "cookie.analyticsDesc": "Help us understand usage patterns to improve the platform.",
    "cookie.save": "Save Preferences",
    "cookie.back": "Back",
    // Privacy
    "privacy.title": "Privacy Policy",
    "privacy.close": "Close",
    // Pricing
    "pricing.eyebrow": "PRICING",
    "pricing.title": "Simple, transparent pricing",
    "pricing.subtitle": "Start free, upgrade when you're ready. No hidden fees.",
    "pricing.popular": "MOST POPULAR",
    "pricing.perMonth": "/month",
    "pricing.enterpriseDesc": "Unlimited users & lines, API access, custom branding, 24/7 SLA support, dedicated onboarding.",
    "pricing.contactSales": "Contact Sales",
  },
  it: {
    "nav.features": "Funzionalità",
    "nav.pricing": "Prezzi",
    "nav.login": "Accedi",
    "nav.start": "Prova Gratuita",
    "hero.badge": "🏭 Costruito per fabbriche che producono",
    "hero.title1": "Basta intuizioni.",
    "hero.title2": "Inizia a misurare.",
    "hero.title3": "Vai Lean.",
    "hero.subtitle": "17 strumenti lean digitali — dalle dashboard OEE all'analisi delle cause radice con AI. Costruito per PMI manifatturiere con 10-500 dipendenti che puntano all'eccellenza operativa.",
    "hero.cta": "Inizia la Prova Gratuita di 14 Giorni",
    "hero.ctaSub": "Nessuna carta di credito • Configurazione in 5 minuti",
    "hero.watchDemo": "Prova la Demo Live",
    "hero.stat1": "17",
    "hero.stat1Label": "Strumenti Lean",
    "hero.stat2": "< 5 min",
    "hero.stat2Label": "Configurazione",
    "hero.stat3": "2",
    "hero.stat3Label": "Lingue",
    "problem.eyebrow": "IL PROBLEMA",
    "problem.title": "Il tuo reparto produttivo è una scatola nera",
    "problem.subtitle": "La maggior parte delle PMI manifatturiere si affida ancora a intuizioni, lavagne e fogli di calcolo. Ti suona familiare?",
    "problem.p1": "\"Non conosciamo il nostro vero OEE\"",
    "problem.p1d": "I dati di produzione vivono su carta. Quando li vedi, sono già notizie di ieri.",
    "problem.p2": "\"I problemi di qualità continuano a tornare\"",
    "problem.p2d": "Senza analisi strutturata delle cause radice, stai curando i sintomi, non i problemi.",
    "problem.p3": "\"I cambi formato durano un'eternità\"",
    "problem.p3d": "Senza monitoraggio SMED, i tempi di cambio sono invisibili e non ottimizzati.",
    "problem.p4": "\"Le nostre idee di miglioramento si perdono\"",
    "problem.p4d": "Suggerimenti Kaizen su post-it. Nessun tracciamento, nessuna responsabilità, nessun risultato.",
    "problem.arrow": "C'è un modo migliore ↓",
    "features.eyebrow": "LA SOLUZIONE",
    "features.title": "Tutto ciò che serve a una fabbrica lean. Nient'altro.",
    "features.cat1": "Vedi Tutto",
    "features.cat1d": "Visibilità produzione in tempo reale",
    "features.cat2": "Risolvi Tutto",
    "features.cat2d": "Strumenti di problem-solving strutturato",
    "features.cat3": "Migliora Sempre",
    "features.cat3d": "Motore di miglioramento continuo",
    "features.cat4": "Manutenzione Smart",
    "features.cat4d": "Manutenzione predittiva e standard",
    "features.cat5": "Copilota AI",
    "features.cat5d": "Il tuo consulente lean su richiesta",
    "features.tool.oee": "Dashboard OEE",
    "features.tool.hourly": "Monitoraggio Orario",
    "features.tool.andon": "Pannello Andon",
    "features.tool.production": "Input Produzione",
    "features.tool.fivewhy": "Analisi 5 Perché",
    "features.tool.ishikawa": "Diagramma Ishikawa",
    "features.tool.pareto": "Analisi di Pareto",
    "features.tool.a3": "Report A3",
    "features.tool.kaizen": "Bacheca Kaizen",
    "features.tool.vsm": "Mappa Flusso Valore",
    "features.tool.smed": "Tracker SMED",
    "features.tool.gemba": "Gemba Walk",
    "features.tool.sixs": "Audit 6S",
    "features.tool.tpm": "Dashboard TPM",
    "features.tool.cilt": "Checklist CILT",
    "features.tool.copilot": "Copilota di Fabbrica",
    "features.tool.assessment": "Valutazione Lean",
    "social.eyebrow": "SCELTO DA PROFESSIONISTI LEAN",
    "social.quote1": "Finalmente una piattaforma che parla lean — non solo IT.",
    "social.author1": "Direttore Stabilimento, Automotive Tier 2",
    "social.quote2": "Abbiamo identificato €47.000 di risparmi annuali nel primo mese usando Pareto e OEE.",
    "social.author2": "Responsabile Miglioramento Continuo, Alimentare",
    "social.quote3": "Il Copilota AI è come avere un consulente lean sempre disponibile.",
    "social.author3": "Direttore Operazioni, Meccanica di Precisione",
    "cta.title": "Pronto a vedere la tua fabbrica in modo diverso?",
    "cta.subtitle": "Unisciti a centinaia di produttori europei che hanno scelto di smettere di indovinare e iniziare a misurare.",
    "cta.btn": "Inizia la Prova Gratuita",
    "cta.sub": "14 giorni gratis • Accesso completo • Nessuna carta di credito",
    "cta.email": "Email aziendale",
    "cta.factory": "Nome stabilimento",
    "cta.employees": "Numero dipendenti",
    "cta.consent": "Accetto la",
    "cta.privacy": "Informativa sulla Privacy",
    "cta.terms": "Termini di Servizio",
    "cta.and": "e i",
    "cta.submit": "Crea il Mio Account →",
    "cta.sending": "Creazione account...",
    "cta.success": "✓ Controlla la tua email per le credenziali!",
    "footer.product": "Prodotto",
    "footer.legal": "Legale",
    "footer.company": "Azienda",
    "footer.privacy": "Informativa Privacy",
    "footer.terms": "Termini di Servizio",
    "footer.cookies": "Cookie Policy",
    "footer.dpa": "Accordo Trattamento Dati",
    "footer.about": "Chi Siamo",
    "footer.contact": "Contatti",
    "footer.blog": "Blog",
    "footer.gdpr": "Conforme al GDPR",
    "footer.copy": "© {year} LeanPilot. Tutti i diritti riservati.",
    "footer.tagline": "Fatto con ❤️ per le fabbriche che producono.",
    "cookie.title": "Rispettiamo la tua privacy",
    "cookie.text": "Utilizziamo cookie essenziali per il funzionamento della piattaforma. I cookie analitici ci aiutano a migliorare — ma solo con il tuo consenso.",
    "cookie.accept": "Accetta Tutti",
    "cookie.reject": "Solo Essenziali",
    "cookie.settings": "Impostazioni Cookie",
    "cookie.essentialTitle": "Cookie Essenziali",
    "cookie.essentialDesc": "Necessari per il funzionamento della piattaforma (sessione, sicurezza, lingua).",
    "cookie.alwaysOn": "Sempre Attivi",
    "cookie.analyticsTitle": "Cookie Analitici",
    "cookie.analyticsDesc": "Ci aiutano a capire come viene utilizzata la piattaforma per migliorarla.",
    "cookie.save": "Salva Preferenze",
    "cookie.back": "Indietro",
    "privacy.title": "Informativa sulla Privacy",
    "privacy.close": "Chiudi",
    // Pricing
    "pricing.eyebrow": "PREZZI",
    "pricing.title": "Prezzi semplici e trasparenti",
    "pricing.subtitle": "Inizia gratis, aggiorna quando sei pronto. Nessun costo nascosto.",
    "pricing.popular": "PIÙ POPOLARE",
    "pricing.perMonth": "/mese",
    "pricing.enterpriseDesc": "Utenti e linee illimitati, accesso API, branding personalizzato, supporto SLA 24/7, onboarding dedicato.",
    "pricing.contactSales": "Contatta Vendite",
  },
};

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const t = (key: string) => translations[lang]?.[key] ?? key;

  useEffect(() => {
    // Detect browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith("it")) setLang("it");

    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden selection:bg-indigo-500/30">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute top-[-30%] left-[-10%] w-[70vw] h-[70vw] rounded-full opacity-[0.07]"
          style={{
            background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
            transform: `translateY(${scrollY * 0.1}px)`,
          }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.05]"
          style={{
            background: "radial-gradient(circle, #ec4899 0%, transparent 70%)",
            transform: `translateY(${-scrollY * 0.05}px)`,
          }}
        />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="relative z-10">
        <LandingNav t={t} lang={lang} setLang={setLang} />
        <HeroSection t={t} scrollY={scrollY} />
        <ProblemSection t={t} />
        <FeaturesSection t={t} />
        <SocialProof t={t} />
        <PricingSection t={t} lang={lang} />
        <CTASection t={t} onShowPrivacy={() => setShowPrivacy(true)} />
        <Footer t={t} onShowPrivacy={() => setShowPrivacy(true)} />
      </div>

      <CookieConsent t={t} />
      {showPrivacy && <PrivacyModal t={t} onClose={() => setShowPrivacy(false)} lang={lang} />}
    </div>
  );
}
