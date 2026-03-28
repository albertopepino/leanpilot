"use client";
import { useState, useEffect } from "react";
import CookieConsent from "@/components/landing/CookieConsent";
import PrivacyModal from "@/components/landing/PrivacyModal";
import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import TrustedBy from "@/components/landing/TrustedBy";
import ProblemSection from "@/components/landing/ProblemSection";
import ProductShowcase from "@/components/landing/ProductShowcase";
import HowItWorks from "@/components/landing/HowItWorks";
import DemoSection from "@/components/landing/DemoSection";
import StatsSection from "@/components/landing/StatsSection";
import SocialProof from "@/components/landing/SocialProof";
import PricingSection from "@/components/landing/PricingSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

type Lang = "en" | "it";

const translations: Record<Lang, Record<string, string>> = {
  en: {
    // Nav
    "nav.product": "Product",
    "nav.features": "Features",
    "nav.solutions": "Solutions",
    "nav.pricing": "Pricing",
    "nav.resources": "Resources",
    "nav.login": "Log In",
    "nav.demo": "Schedule Demo",
    "nav.start": "Start Free Trial",
    // Hero
    "hero.badge": "Now with AI-Powered Lean Copilot",
    "hero.title1": "The power to see.",
    "hero.title2": "The tools to improve.",
    "hero.title3": "The platform to go Lean.",
    "hero.subtitle":
      "17 digital lean manufacturing tools — from real-time OEE dashboards to AI-powered root cause analysis. Built for factories serious about operational excellence.",
    "hero.cta": "Start 14-Day Free Trial",
    "hero.ctaSub": "No credit card required",
    "hero.watchDemo": "Watch Product Tour",
    "hero.scrollHint": "Scroll to explore",
    // Trusted
    "trusted.title": "Trusted by lean practitioners across Europe",
    "trusted.iso": "ISO 9001 Ready",
    "trusted.iatf": "IATF 16949 Aligned",
    "trusted.gdpr": "GDPR Compliant",
    "trusted.cloud": "Cloud & On-Premise",
    // Problem
    "problem.eyebrow": "THE CHALLENGE",
    "problem.title": "Your factory floor is a black box",
    "problem.subtitle":
      "Most SME manufacturers still run on gut feelings, whiteboards, and spreadsheets. The data exists — but it's trapped.",
    "problem.p1": "We don't know our real OEE",
    "problem.p1d":
      "Production data lives on paper. By the time you see it, it's yesterday's news. Decisions are based on memory, not measurement.",
    "problem.p2": "Quality issues keep returning",
    "problem.p2d":
      "Without structured root cause analysis, you're fixing symptoms — not problems. The same defects keep coming back.",
    "problem.p3": "Changeovers take forever",
    "problem.p3d":
      "No SMED tracking means changeover time is invisible and unoptimized. Every minute of downtime costs money.",
    "problem.p4": "Improvement ideas get lost",
    "problem.p4d":
      "Kaizen suggestions on sticky notes. No tracking, no accountability, no follow-through. Good ideas die in the suggestion box.",
    "problem.arrow": "There's a better way",
    // Product showcase
    "showcase.eyebrow": "THE PLATFORM",
    "showcase.title": "Everything a lean factory needs",
    "showcase.subtitle": "Five integrated modules. One unified platform. Zero complexity.",
    "showcase.cat1": "Production Visibility",
    "showcase.cat1d": "See everything happening on your factory floor in real time",
    "showcase.cat1detail":
      "Track OEE across all production lines, monitor hourly output targets, and get instant alerts when something goes wrong. No more walking the floor to find out what happened.",
    "showcase.cat2": "Problem Solving",
    "showcase.cat2d": "Structured tools to find and fix root causes permanently",
    "showcase.cat2detail":
      "5 Why analysis, Ishikawa diagrams, Pareto charts, and A3 reports — all connected to your production data. Every problem gets a structured path to resolution.",
    "showcase.cat3": "Continuous Improvement",
    "showcase.cat3d": "Turn improvement ideas into measurable results",
    "showcase.cat3detail":
      "Kaizen boards, Value Stream Mapping, SMED tracking, and Gemba walks — digitized and connected. Track every improvement from suggestion to verified savings.",
    "showcase.cat4": "Maintenance & Standards",
    "showcase.cat4d": "Prevent breakdowns before they happen",
    "showcase.cat4detail":
      "6S audits, TPM dashboards, and CILT checklists keep your equipment running and your standards visible. Predictive maintenance driven by real data.",
    "showcase.cat5": "AI Copilot",
    "showcase.cat5d": "Your on-demand lean manufacturing consultant",
    "showcase.cat5detail":
      "Ask questions in plain language. Get instant analysis of your production data, root cause suggestions, and improvement recommendations — powered by AI that understands lean.",
    "showcase.tool.oee": "OEE Dashboard",
    "showcase.tool.hourly": "Hourly Tracking",
    "showcase.tool.andon": "Andon Board",
    "showcase.tool.production": "Production Input",
    "showcase.tool.fivewhy": "5 Why Analysis",
    "showcase.tool.ishikawa": "Ishikawa Diagram",
    "showcase.tool.pareto": "Pareto Analysis",
    "showcase.tool.a3": "A3 Report",
    "showcase.tool.kaizen": "Kaizen Board",
    "showcase.tool.vsm": "Value Stream Map",
    "showcase.tool.smed": "SMED Tracker",
    "showcase.tool.gemba": "Gemba Walk",
    "showcase.tool.sixs": "6S Audit",
    "showcase.tool.tpm": "TPM Dashboard",
    "showcase.tool.cilt": "CILT Checklist",
    "showcase.tool.copilot": "Factory Copilot",
    "showcase.tool.assessment": "Lean Assessment",
    // How it works
    "how.eyebrow": "HOW IT WORKS",
    "how.title": "Up and running in under 5 minutes",
    "how.subtitle": "No consultants. No complex setup. No IT department required.",
    "how.step1": "Connect",
    "how.step1d": "Sign up, name your factory, and configure your production lines. Takes less than 5 minutes.",
    "how.step2": "Measure",
    "how.step2d": "Start logging production data. Your OEE, downtime, and quality metrics appear in real time.",
    "how.step3": "Improve",
    "how.step3d": "Use 17 lean tools to analyze problems, track improvements, and drive operational excellence.",
    // Demo
    "demo.eyebrow": "SEE IT IN ACTION",
    "demo.title": "Try the live demo",
    "demo.subtitle": "Explore the full platform with sample factory data. No signup required.",
    "demo.cta": "Open Full Demo",
    "demo.hint": "Interactive demo with real lean manufacturing data",
    // Stats
    "stats.eyebrow": "BY THE NUMBERS",
    "stats.tools": "Lean Tools",
    "stats.languages": "Languages",
    "stats.setup": "Min Setup",
    "stats.uptime": "Uptime SLA",
    "stats.savings": "Avg. Annual Savings",
    "stats.satisfaction": "User Satisfaction",
    // Social proof
    "social.eyebrow": "WHAT PRACTITIONERS SAY",
    "social.title": "Trusted by lean teams across Europe",
    "social.quote1":
      "Finally, a platform that speaks lean — not just IT. We identified €47,000 in annual savings within the first month.",
    "social.author1": "Marco R.",
    "social.role1": "Plant Manager, Automotive Tier 2",
    "social.quote2":
      "The OEE dashboard alone transformed how we run our morning meetings. Data that used to take hours to compile is now live.",
    "social.author2": "Katarina S.",
    "social.role2": "Continuous Improvement Lead, Food Manufacturing",
    "social.quote3":
      "The AI Copilot is like having a lean consultant on speed dial. It suggested a changeover improvement we'd never considered.",
    "social.author3": "Thomas W.",
    "social.role3": "Operations Director, Precision Engineering",
    // Pricing
    "pricing.eyebrow": "PRICING",
    "pricing.title": "Simple, transparent pricing",
    "pricing.subtitle": "Start free. Upgrade when you're ready. No hidden fees, ever.",
    "pricing.popular": "MOST POPULAR",
    "pricing.perMonth": "/month",
    "pricing.starter": "Starter",
    "pricing.starterPrice": "49",
    "pricing.starterDesc": "For small factories getting started with lean",
    "pricing.starterF1": "Up to 3 users",
    "pricing.starterF2": "1 production line",
    "pricing.starterF3": "Core lean tools",
    "pricing.starterF4": "90-day data retention",
    "pricing.starterF5": "Email support",
    "pricing.professional": "Professional",
    "pricing.professionalPrice": "149",
    "pricing.professionalDesc": "For growing factories serious about improvement",
    "pricing.professionalF1": "Up to 10 users",
    "pricing.professionalF2": "3 production lines",
    "pricing.professionalF3": "All 17 lean tools",
    "pricing.professionalF4": "1-year data retention",
    "pricing.professionalF5": "AI Copilot included",
    "pricing.professionalF6": "Priority support",
    "pricing.business": "Business",
    "pricing.businessPrice": "349",
    "pricing.businessDesc": "For established operations scaling lean across the plant",
    "pricing.businessF1": "Up to 25 users",
    "pricing.businessF2": "10 production lines",
    "pricing.businessF3": "All tools + API access",
    "pricing.businessF4": "3-year data retention",
    "pricing.businessF5": "AI Copilot + custom models",
    "pricing.businessF6": "Dedicated onboarding",
    "pricing.cta": "Start Free Trial",
    "pricing.enterprise": "Enterprise",
    "pricing.enterpriseDesc":
      "Unlimited users & lines, custom integrations, SLA support, dedicated onboarding.",
    "pricing.contactSales": "Contact Sales",
    // CTA
    "cta.title": "Ready to see your factory differently?",
    "cta.subtitle":
      "Join hundreds of European manufacturers who chose to stop guessing and start measuring.",
    "cta.btn": "Start Your Free Trial",
    "cta.sub": "14 days free • Full access • No credit card",
    "cta.email": "Work email",
    "cta.factory": "Factory name",
    "cta.employees": "Number of employees",
    "cta.consent": "I agree to the",
    "cta.privacy": "Privacy Policy",
    "cta.terms": "Terms of Service",
    "cta.and": "and",
    "cta.submit": "Create My Account",
    "cta.sending": "Creating account...",
    "cta.success": "Check your email for login credentials!",
    // Footer
    "footer.product": "Product",
    "footer.features": "Features",
    "footer.pricing": "Pricing",
    "footer.demo": "Live Demo",
    "footer.changelog": "Changelog",
    "footer.solutions": "Solutions",
    "footer.manufacturing": "Manufacturing",
    "footer.automotive": "Automotive",
    "footer.food": "Food & Beverage",
    "footer.pharma": "Pharmaceutical",
    "footer.legal": "Legal",
    "footer.company": "Company",
    "footer.privacy": "Privacy Policy",
    "footer.terms": "Terms of Service",
    "footer.cookies": "Cookie Policy",
    "footer.dpa": "Data Processing Agreement",
    "footer.about": "About Us",
    "footer.contact": "Contact",
    "footer.blog": "Blog",
    "footer.careers": "Careers",
    "footer.gdpr": "GDPR Compliant",
    "footer.copy": "© {year} LeanPilot. All rights reserved.",
    "footer.tagline": "Built for factories that make things.",
    // Cookie consent
    "cookie.title": "We respect your privacy",
    "cookie.text":
      "We use essential cookies for the platform to function. Analytics cookies help us improve — but only with your consent.",
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
  },
  it: {
    // Nav
    "nav.product": "Prodotto",
    "nav.features": "Funzionalità",
    "nav.solutions": "Soluzioni",
    "nav.pricing": "Prezzi",
    "nav.resources": "Risorse",
    "nav.login": "Accedi",
    "nav.demo": "Prenota Demo",
    "nav.start": "Prova Gratuita",
    // Hero
    "hero.badge": "Ora con Copilota AI per il Lean",
    "hero.title1": "Il potere di vedere.",
    "hero.title2": "Gli strumenti per migliorare.",
    "hero.title3": "La piattaforma per andare Lean.",
    "hero.subtitle":
      "17 strumenti lean digitali — dalle dashboard OEE in tempo reale all'analisi delle cause radice con AI. Costruito per fabbriche che puntano all'eccellenza operativa.",
    "hero.cta": "Inizia la Prova Gratuita di 14 Giorni",
    "hero.ctaSub": "Nessuna carta di credito richiesta",
    "hero.watchDemo": "Guarda il Tour del Prodotto",
    "hero.scrollHint": "Scorri per esplorare",
    // Trusted
    "trusted.title": "Scelto dai professionisti lean in tutta Europa",
    "trusted.iso": "ISO 9001 Ready",
    "trusted.iatf": "IATF 16949 Allineato",
    "trusted.gdpr": "Conforme GDPR",
    "trusted.cloud": "Cloud & On-Premise",
    // Problem
    "problem.eyebrow": "LA SFIDA",
    "problem.title": "Il tuo reparto produttivo è una scatola nera",
    "problem.subtitle":
      "La maggior parte delle PMI manifatturiere si affida ancora a intuizioni, lavagne e fogli di calcolo. I dati esistono — ma sono intrappolati.",
    "problem.p1": "Non conosciamo il nostro vero OEE",
    "problem.p1d":
      "I dati di produzione vivono su carta. Quando li vedi, sono già notizie di ieri. Le decisioni si basano sulla memoria, non sulla misurazione.",
    "problem.p2": "I problemi di qualità continuano a tornare",
    "problem.p2d":
      "Senza analisi strutturata delle cause radice, stai curando i sintomi — non i problemi. Gli stessi difetti continuano a ripresentarsi.",
    "problem.p3": "I cambi formato durano un'eternità",
    "problem.p3d":
      "Senza monitoraggio SMED, i tempi di cambio sono invisibili e non ottimizzati. Ogni minuto di fermo costa denaro.",
    "problem.p4": "Le idee di miglioramento si perdono",
    "problem.p4d":
      "Suggerimenti Kaizen su post-it. Nessun tracciamento, nessuna responsabilità, nessun seguito. Le buone idee muoiono nella cassetta dei suggerimenti.",
    "problem.arrow": "C'è un modo migliore",
    // Product showcase
    "showcase.eyebrow": "LA PIATTAFORMA",
    "showcase.title": "Tutto ciò che serve a una fabbrica lean",
    "showcase.subtitle": "Cinque moduli integrati. Una piattaforma unificata. Zero complessità.",
    "showcase.cat1": "Visibilità Produzione",
    "showcase.cat1d": "Vedi tutto ciò che accade nel tuo reparto in tempo reale",
    "showcase.cat1detail":
      "Monitora l'OEE su tutte le linee, segui gli obiettivi orari e ricevi avvisi istantanei quando qualcosa va storto.",
    "showcase.cat2": "Problem Solving",
    "showcase.cat2d": "Strumenti strutturati per trovare e risolvere le cause radice",
    "showcase.cat2detail":
      "Analisi 5 Perché, diagrammi Ishikawa, grafici Pareto e report A3 — tutti collegati ai dati di produzione.",
    "showcase.cat3": "Miglioramento Continuo",
    "showcase.cat3d": "Trasforma le idee di miglioramento in risultati misurabili",
    "showcase.cat3detail":
      "Bacheche Kaizen, Value Stream Mapping, SMED tracking e Gemba walk — digitalizzati e connessi.",
    "showcase.cat4": "Manutenzione & Standard",
    "showcase.cat4d": "Previeni i guasti prima che accadano",
    "showcase.cat4detail":
      "Audit 6S, dashboard TPM e checklist CILT mantengono le attrezzature in funzione e gli standard visibili.",
    "showcase.cat5": "Copilota AI",
    "showcase.cat5d": "Il tuo consulente lean su richiesta",
    "showcase.cat5detail":
      "Fai domande in linguaggio naturale. Ottieni analisi istantanee dei dati di produzione e suggerimenti di miglioramento.",
    "showcase.tool.oee": "Dashboard OEE",
    "showcase.tool.hourly": "Monitoraggio Orario",
    "showcase.tool.andon": "Pannello Andon",
    "showcase.tool.production": "Input Produzione",
    "showcase.tool.fivewhy": "Analisi 5 Perché",
    "showcase.tool.ishikawa": "Diagramma Ishikawa",
    "showcase.tool.pareto": "Analisi di Pareto",
    "showcase.tool.a3": "Report A3",
    "showcase.tool.kaizen": "Bacheca Kaizen",
    "showcase.tool.vsm": "Mappa Flusso Valore",
    "showcase.tool.smed": "Tracker SMED",
    "showcase.tool.gemba": "Gemba Walk",
    "showcase.tool.sixs": "Audit 6S",
    "showcase.tool.tpm": "Dashboard TPM",
    "showcase.tool.cilt": "Checklist CILT",
    "showcase.tool.copilot": "Copilota di Fabbrica",
    "showcase.tool.assessment": "Valutazione Lean",
    // How it works
    "how.eyebrow": "COME FUNZIONA",
    "how.title": "Operativo in meno di 5 minuti",
    "how.subtitle": "Nessun consulente. Nessuna configurazione complessa. Nessun reparto IT necessario.",
    "how.step1": "Connetti",
    "how.step1d": "Registrati, dai un nome alla tua fabbrica e configura le linee di produzione. Meno di 5 minuti.",
    "how.step2": "Misura",
    "how.step2d": "Inizia a registrare i dati di produzione. OEE, fermi e qualità appaiono in tempo reale.",
    "how.step3": "Migliora",
    "how.step3d": "Usa 17 strumenti lean per analizzare problemi, tracciare miglioramenti e raggiungere l'eccellenza.",
    // Demo
    "demo.eyebrow": "GUARDALO IN AZIONE",
    "demo.title": "Prova la demo live",
    "demo.subtitle": "Esplora la piattaforma completa con dati di fabbrica di esempio. Nessuna registrazione richiesta.",
    "demo.cta": "Apri Demo Completa",
    "demo.hint": "Demo interattiva con dati reali di produzione lean",
    // Stats
    "stats.eyebrow": "I NUMERI",
    "stats.tools": "Strumenti Lean",
    "stats.languages": "Lingue",
    "stats.setup": "Min Configurazione",
    "stats.uptime": "Uptime SLA",
    "stats.savings": "Risparmi Medi Annuali",
    "stats.satisfaction": "Soddisfazione Utenti",
    // Social proof
    "social.eyebrow": "COSA DICONO I PROFESSIONISTI",
    "social.title": "Scelto dai team lean in tutta Europa",
    "social.quote1":
      "Finalmente una piattaforma che parla lean — non solo IT. Abbiamo identificato €47.000 di risparmi annuali nel primo mese.",
    "social.author1": "Marco R.",
    "social.role1": "Direttore Stabilimento, Automotive Tier 2",
    "social.quote2":
      "La dashboard OEE da sola ha trasformato le nostre riunioni mattutine. Dati che richiedevano ore ora sono disponibili in tempo reale.",
    "social.author2": "Katarina S.",
    "social.role2": "Responsabile Miglioramento Continuo, Alimentare",
    "social.quote3":
      "Il Copilota AI è come avere un consulente lean sempre disponibile. Ha suggerito un miglioramento al cambio formato che non avevamo mai considerato.",
    "social.author3": "Thomas W.",
    "social.role3": "Direttore Operazioni, Meccanica di Precisione",
    // Pricing
    "pricing.eyebrow": "PREZZI",
    "pricing.title": "Prezzi semplici e trasparenti",
    "pricing.subtitle": "Inizia gratis. Aggiorna quando sei pronto. Nessun costo nascosto.",
    "pricing.popular": "PIÙ POPOLARE",
    "pricing.perMonth": "/mese",
    "pricing.starter": "Starter",
    "pricing.starterPrice": "49",
    "pricing.starterDesc": "Per piccole fabbriche che iniziano con il lean",
    "pricing.starterF1": "Fino a 3 utenti",
    "pricing.starterF2": "1 linea di produzione",
    "pricing.starterF3": "Strumenti lean base",
    "pricing.starterF4": "Ritenzione dati 90 giorni",
    "pricing.starterF5": "Supporto email",
    "pricing.professional": "Professional",
    "pricing.professionalPrice": "149",
    "pricing.professionalDesc": "Per fabbriche in crescita serie sul miglioramento",
    "pricing.professionalF1": "Fino a 10 utenti",
    "pricing.professionalF2": "3 linee di produzione",
    "pricing.professionalF3": "Tutti i 17 strumenti lean",
    "pricing.professionalF4": "Ritenzione dati 1 anno",
    "pricing.professionalF5": "Copilota AI incluso",
    "pricing.professionalF6": "Supporto prioritario",
    "pricing.business": "Business",
    "pricing.businessPrice": "349",
    "pricing.businessDesc": "Per operazioni consolidate che scalano il lean in stabilimento",
    "pricing.businessF1": "Fino a 25 utenti",
    "pricing.businessF2": "10 linee di produzione",
    "pricing.businessF3": "Tutti gli strumenti + API",
    "pricing.businessF4": "Ritenzione dati 3 anni",
    "pricing.businessF5": "Copilota AI + modelli custom",
    "pricing.businessF6": "Onboarding dedicato",
    "pricing.cta": "Inizia Prova Gratuita",
    "pricing.enterprise": "Enterprise",
    "pricing.enterpriseDesc":
      "Utenti e linee illimitati, integrazioni custom, supporto SLA, onboarding dedicato.",
    "pricing.contactSales": "Contatta Vendite",
    // CTA
    "cta.title": "Pronto a vedere la tua fabbrica in modo diverso?",
    "cta.subtitle":
      "Unisciti a centinaia di produttori europei che hanno scelto di smettere di indovinare e iniziare a misurare.",
    "cta.btn": "Inizia la Prova Gratuita",
    "cta.sub": "14 giorni gratis • Accesso completo • Nessuna carta di credito",
    "cta.email": "Email aziendale",
    "cta.factory": "Nome stabilimento",
    "cta.employees": "Numero dipendenti",
    "cta.consent": "Accetto la",
    "cta.privacy": "Informativa sulla Privacy",
    "cta.terms": "Termini di Servizio",
    "cta.and": "e i",
    "cta.submit": "Crea il Mio Account",
    "cta.sending": "Creazione account...",
    "cta.success": "Controlla la tua email per le credenziali!",
    // Footer
    "footer.product": "Prodotto",
    "footer.features": "Funzionalità",
    "footer.pricing": "Prezzi",
    "footer.demo": "Demo Live",
    "footer.changelog": "Novità",
    "footer.solutions": "Soluzioni",
    "footer.manufacturing": "Manifattura",
    "footer.automotive": "Automotive",
    "footer.food": "Alimentare",
    "footer.pharma": "Farmaceutico",
    "footer.legal": "Legale",
    "footer.company": "Azienda",
    "footer.privacy": "Informativa Privacy",
    "footer.terms": "Termini di Servizio",
    "footer.cookies": "Cookie Policy",
    "footer.dpa": "Accordo Trattamento Dati",
    "footer.about": "Chi Siamo",
    "footer.contact": "Contatti",
    "footer.blog": "Blog",
    "footer.careers": "Lavora con Noi",
    "footer.gdpr": "Conforme al GDPR",
    "footer.copy": "© {year} LeanPilot. Tutti i diritti riservati.",
    "footer.tagline": "Costruito per fabbriche che producono.",
    // Cookie
    "cookie.title": "Rispettiamo la tua privacy",
    "cookie.text":
      "Utilizziamo cookie essenziali per il funzionamento della piattaforma. I cookie analitici ci aiutano a migliorare — ma solo con il tuo consenso.",
    "cookie.accept": "Accetta Tutti",
    "cookie.reject": "Solo Essenziali",
    "cookie.settings": "Impostazioni Cookie",
    "cookie.essentialTitle": "Cookie Essenziali",
    "cookie.essentialDesc": "Necessari per il funzionamento (sessione, sicurezza, lingua).",
    "cookie.alwaysOn": "Sempre Attivi",
    "cookie.analyticsTitle": "Cookie Analitici",
    "cookie.analyticsDesc": "Ci aiutano a capire come viene utilizzata la piattaforma.",
    "cookie.save": "Salva Preferenze",
    "cookie.back": "Indietro",
    "privacy.title": "Informativa sulla Privacy",
    "privacy.close": "Chiudi",
  },
};

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const t = (key: string) => translations[lang]?.[key] ?? key;

  useEffect(() => {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith("it")) setLang("it");

    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden selection:bg-indigo-500/20 scroll-smooth">

      <div className="relative">
        <LandingNav t={t} lang={lang} setLang={setLang} />
        <HeroSection t={t} scrollY={scrollY} />
        <TrustedBy t={t} />
        <ProblemSection t={t} />
        <ProductShowcase t={t} />
        <HowItWorks t={t} />
        <DemoSection t={t} />
        <StatsSection t={t} />
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
