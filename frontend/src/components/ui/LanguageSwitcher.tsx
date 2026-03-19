"use client";
import { useI18n, Locale } from "@/stores/useI18n";

const LANGUAGES: { value: Locale; label: string; flag: string }[] = [
  { value: "en", label: "EN", flag: "🇬🇧" },
  { value: "it", label: "IT", flag: "🇮🇹" },
  { value: "de", label: "DE", flag: "🇩🇪" },
  { value: "es", label: "ES", flag: "🇪🇸" },
  { value: "fr", label: "FR", flag: "🇫🇷" },
  { value: "pl", label: "PL", flag: "🇵🇱" },
  { value: "sr", label: "SR", flag: "🇷🇸" },
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex bg-th-bg-3 rounded-lg p-0.5 gap-0.5 flex-wrap" role="listbox" aria-label="Select language">
      {LANGUAGES.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLocale(opt.value)}
          className={`px-1.5 py-1 rounded-md text-[10px] font-bold transition ${
            locale === opt.value
              ? "bg-th-card text-brand-700 dark:text-white shadow"
              : "text-th-text-3 opacity-60 hover:opacity-100 hover:text-th-text"
          }`}
          title={opt.flag}
          role="option"
          aria-selected={locale === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
