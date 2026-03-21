"use client";
import { create } from "zustand";

export interface Celebration {
  type: "oee-target" | "safety-streak" | "kaizen-complete" | "login-streak" | "first-login";
  icon: string;
  title: string;
  subtitle: string;
}

interface CelebrationState {
  celebration: Celebration | null;
  showConfetti: boolean;
  triggerCelebration: (c: Celebration) => void;
  dismiss: () => void;
}

/**
 * Global celebration store — using zustand so any component in the tree
 * can trigger a celebration without prop drilling or context.
 */
export const useCelebration = create<CelebrationState>((set) => ({
  celebration: null,
  showConfetti: false,

  triggerCelebration: (c: Celebration) => {
    set({ celebration: c, showConfetti: true });
  },

  dismiss: () => {
    set({ celebration: null, showConfetti: false });
  },
}));
