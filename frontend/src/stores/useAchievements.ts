import { create } from "zustand";

export interface Achievement {
  id: string;
  icon: string;
  titleKey: string;
  titleFallback: string;
  unlockedAt?: string;
}

interface AchievementStore {
  achievements: Achievement[];
  loaded: boolean;
  initAchievements: () => void;
  unlock: (id: string) => void;
  isUnlocked: (id: string) => boolean;
}

const STORAGE_KEY = "leanpilot_achievements";

export const ACHIEVEMENT_DEFS: Achievement[] = [
  { id: "first-login", icon: "\u{1F680}", titleKey: "achievements.firstLogin", titleFallback: "Welcome aboard!" },
  { id: "first-production", icon: "\u{1F3ED}", titleKey: "achievements.firstProduction", titleFallback: "First production recorded" },
  { id: "first-kaizen", icon: "\u{1F4A1}", titleKey: "achievements.firstKaizen", titleFallback: "First improvement idea" },
  { id: "first-safety", icon: "\u{1F6E1}\uFE0F", titleKey: "achievements.firstSafety", titleFallback: "Safety champion" },
  { id: "first-gemba", icon: "\u{1F441}\uFE0F", titleKey: "achievements.firstGemba", titleFallback: "Go see for yourself" },
  { id: "first-5why", icon: "\u{1F50D}", titleKey: "achievements.first5Why", titleFallback: "Root cause found" },
  { id: "oee-85", icon: "\u2B50", titleKey: "achievements.oee85", titleFallback: "World-class OEE" },
  { id: "safety-7", icon: "\u{1F6E1}\uFE0F", titleKey: "achievements.safety7", titleFallback: "7 days safe" },
  { id: "safety-30", icon: "\u{1F3C5}", titleKey: "achievements.safety30", titleFallback: "30 days safe" },
  { id: "kaizen-10", icon: "\u{1F3C6}", titleKey: "achievements.kaizen10", titleFallback: "10 improvements completed" },
  { id: "streak-7", icon: "\u{1F525}", titleKey: "achievements.streak7", titleFallback: "7-day login streak" },
  { id: "streak-30", icon: "\u{1F525}", titleKey: "achievements.streak30", titleFallback: "30-day login streak" },
];

function loadFromStorage(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveToStorage(unlocked: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
  } catch { /* ignore */ }
}

export const useAchievements = create<AchievementStore>((set, get) => ({
  achievements: [],
  loaded: false,

  initAchievements: () => {
    if (get().loaded) return;
    const unlocked = loadFromStorage();
    const achievements = ACHIEVEMENT_DEFS.map((def) => ({
      ...def,
      unlockedAt: unlocked[def.id] || undefined,
    }));
    set({ achievements, loaded: true });
  },

  unlock: (id: string) => {
    const { achievements } = get();
    const existing = achievements.find((a) => a.id === id);
    if (!existing || existing.unlockedAt) return;

    const now = new Date().toISOString();
    const updated = achievements.map((a) =>
      a.id === id ? { ...a, unlockedAt: now } : a
    );

    const unlocked = loadFromStorage();
    unlocked[id] = now;
    saveToStorage(unlocked);

    set({ achievements: updated });
  },

  isUnlocked: (id: string) => {
    return !!get().achievements.find((a) => a.id === id)?.unlockedAt;
  },
}));
