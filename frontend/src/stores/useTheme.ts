import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

export const useTheme = create<ThemeStore>((set, get) => ({
  theme: "light",

  initTheme: () => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("leanpilot_theme") as Theme | null;
    const theme = saved || "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    set({ theme });
  },

  setTheme: (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("leanpilot_theme", theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === "light" ? "dark" : "light";
    get().setTheme(next);
  },
}));
