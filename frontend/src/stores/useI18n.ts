import { create } from "zustand";

export type Locale = "en" | "it" | "de" | "es" | "fr" | "pl" | "sr";
export type Direction = "ltr" | "rtl";
type Translations = Record<string, string>;

/** Returns the text direction for a given locale (future-proofed for RTL languages). */
export function getDirection(locale: Locale): Direction {
  // All current locales are LTR. Add RTL locales here when needed (e.g. "ar").
  const rtlLocales: Locale[] = [];
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}

interface I18nStore {
  locale: Locale;
  direction: Direction;
  ready: boolean;
  translations: Record<string, Translations>;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  initLocale: () => Promise<void>;
}

const DOMAINS = [
  "common",
  "login",
  "assessment",
  "dashboard",
  "problem-solving",
  "improvement",
  "maintenance",
  "copilot",
  "resources",
  "admin",
  "settings",
  "manufacturing",
  "consent",
  "safety",
  "home",
  "consolidated",
  "onboarding",
  "calendar",
  "commandPalette",
  "scorecard",
  "crossModule",
  "waste",
  "sqcdp",
  "handover",
  "notifications",
  "lsw",
  "scheduling",
  "quality",
  "spc",
  "help",
  "glossary",
  "wizard",
  "kanban",
  "pokayoke",
  "cookie",
  "cta",
  "features",
  "footer",
  "hero",
  "nav",
  "pricing",
  "privacy",
  "problem",
  "social",
  "shopfloor",
];

async function loadTranslations(locale: Locale): Promise<Record<string, Translations>> {
  const loaded: Record<string, Translations> = {};
  const imports = DOMAINS.map(async (domain) => {
    try {
      const mod = await import(`@/i18n/${locale}/${domain}.json`);
      loaded[domain] = mod.default;
    } catch {
      loaded[domain] = {};
    }
  });
  await Promise.all(imports);
  return loaded;
}

export const useI18n = create<I18nStore>((set, get) => ({
  locale: "en",
  direction: "ltr" as Direction,
  ready: false,
  translations: {},

  initLocale: async () => {
    if (get().ready) return;
    const saved = (typeof window !== "undefined"
      ? localStorage.getItem("leanpilot_locale")
      : null) as Locale | null;
    const locale = saved || "en";
    const direction = getDirection(locale);
    const translations = await loadTranslations(locale);
    if (typeof window !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = direction;
    }
    set({ locale, direction, translations, ready: true });
  },

  setLocale: async (locale) => {
    const direction = getDirection(locale);
    const translations = await loadTranslations(locale);
    if (typeof window !== "undefined") {
      localStorage.setItem("leanpilot_locale", locale);
      document.documentElement.lang = locale;
      document.documentElement.dir = direction;
    }
    set({ locale, direction, translations, ready: true });
  },

  t: (key, replacements) => {
    const dotIdx = key.indexOf(".");
    if (dotIdx === -1) return key;
    const domain = key.slice(0, dotIdx);
    const k = key.slice(dotIdx + 1);
    let value = get().translations[domain]?.[k];
    if (!value) return key;
    if (replacements) {
      Object.entries(replacements).forEach(([rk, rv]) => {
        value = value!.replace(`{${rk}}`, String(rv));
      });
    }
    return value;
  },
}));
