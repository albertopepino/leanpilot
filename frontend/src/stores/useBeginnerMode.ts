import { create } from "zustand";

/**
 * Beginner Mode store.
 * When enabled:
 * - ToolInfoCards are always visible (cannot be dismissed)
 * - PDCA flow stepper is shown on relevant pages even without ?from= parameter
 * - Additional contextual hints appear in the UI
 *
 * Persisted in localStorage. Uses a single key (not per-user) since
 * settings are tied to the browser, not the account.
 */

const STORAGE_KEY = "leanpilot_beginner_mode";

interface BeginnerModeStore {
  enabled: boolean;
  loaded: boolean;
  setEnabled: (enabled: boolean) => void;
  initBeginnerMode: () => void;
}

export const useBeginnerMode = create<BeginnerModeStore>((set) => ({
  enabled: false,
  loaded: false,

  initBeginnerMode: () => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    // Default: enabled for new users (null means never set)
    const enabled = saved === null ? true : saved === "1";
    set({ enabled, loaded: true });
  },

  setEnabled: (enabled: boolean) => {
    set({ enabled });
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    }
  },
}));

/** Save beginner mode preference to localStorage (kept for backwards compat) */
export function saveBeginnerMode(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}
