import { create } from "zustand";

export type Locale = "en" | "it" | "de" | "es" | "fr" | "pl" | "sr";
type Translations = Record<string, string>;

interface I18nStore {
  locale: Locale;
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
  ready: false,
  translations: {},

  initLocale: async () => {
    if (get().ready) return;
    const saved = (typeof window !== "undefined"
      ? localStorage.getItem("leanpilot_locale")
      : null) as Locale | null;
    const locale = saved || "en";
    const translations = await loadTranslations(locale);
    set({ locale, translations, ready: true });
  },

  setLocale: async (locale) => {
    const translations = await loadTranslations(locale);
    if (typeof window !== "undefined") {
      localStorage.setItem("leanpilot_locale", locale);
      document.documentElement.lang = locale;
    }
    set({ locale, translations, ready: true });
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
