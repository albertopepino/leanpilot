import type { Locale } from "@/stores/useI18n";

/**
 * Maps app language codes to full BCP 47 locale tags for Intl APIs.
 */
const LOCALE_MAP: Record<Locale, string> = {
  en: "en-US",
  it: "it-IT",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
  pl: "pl-PL",
  sr: "sr-Latn-RS",
};

/**
 * Resolves a full BCP 47 locale string from an app language code.
 */
export function resolveLocale(lang: Locale): string {
  return LOCALE_MAP[lang] ?? "en-US";
}

/**
 * Formats a number according to the given locale.
 *
 * @example formatNumber(12345.6, "de") => "12.345,6"
 */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(resolveLocale(locale)).format(value);
}

/**
 * Formats a monetary value with the given currency and locale.
 *
 * @example formatCurrency(1234.5, "EUR", "it") => "1.234,50 \u20AC"
 */
export function formatCurrency(
  value: number,
  currency: string,
  locale: Locale,
): string {
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency,
  }).format(value);
}

/**
 * Formats a date according to the given locale and length.
 *
 * @param date  - A Date object or an ISO 8601 string.
 * @param locale - App language code (e.g. "en", "it").
 * @param format - "short" | "medium" | "long" (default "medium").
 *
 * @example formatDate("2026-03-17", "fr", "long") => "17 mars 2026"
 */
export function formatDate(
  date: Date | string,
  locale: Locale,
  format: "short" | "medium" | "long" = "medium",
): string {
  const d = typeof date === "string" ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions =
    format === "short"
      ? { year: "2-digit", month: "numeric", day: "numeric" }
      : format === "long"
        ? { year: "numeric", month: "long", day: "numeric" }
        : { year: "numeric", month: "short", day: "numeric" };

  return new Intl.DateTimeFormat(resolveLocale(locale), options).format(d);
}

/**
 * Formats a value as a percentage string.
 *
 * @param value    - A fraction (0.85) or whole number; values > 1 are divided by 100.
 * @param locale   - App language code.
 * @param decimals - Number of fraction digits (default 1).
 *
 * @example formatPercent(0.856, "en", 1) => "85.6%"
 */
export function formatPercent(
  value: number,
  locale: Locale,
  decimals: number = 1,
): string {
  // Treat values <= 1 as fractions already; values > 1 as whole percentages
  const fraction = value > 1 ? value / 100 : value;
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(fraction);
}
