"use client";
import { useTheme } from "@/stores/useTheme";
import { useI18n } from "@/stores/useI18n";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();

  const label = theme === "light"
    ? t("settings.switchToDark") || "Switch to dark mode"
    : t("settings.switchToLight") || "Switch to light mode";

  return (
    <button
      onClick={toggleTheme}
      className="w-8 h-8 rounded-lg bg-th-bg-3 flex items-center justify-center text-th-text-2 opacity-60 hover:opacity-100 hover:text-th-text transition"
      title={label}
      aria-label={label}
    >
      {theme === "light" ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
    </button>
  );
}
