import { create } from "zustand";

export interface Site {
  id: number;
  name: string;
  site_code: string;
  timezone: string;
  organization_id: number;
}

interface SiteStore {
  sites: Site[];
  activeSiteId: number | null;
  isCorpView: boolean;
  setSites: (sites: Site[]) => void;
  setActiveSite: (id: number | null) => void;
  toggleCorpView: () => void;
}

const STORAGE_KEY = "leanpilot_active_site";

function loadPersistedSiteId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? Number(raw) : null;
}

export const useSite = create<SiteStore>((set, get) => ({
  sites: [],
  activeSiteId: loadPersistedSiteId(),
  isCorpView: false,

  setSites: (sites) => {
    const current = get().activeSiteId;
    // If stored site is not in list, pick first or null
    const validIds = sites.map((s) => s.id);
    const resolvedId = current && validIds.includes(current) ? current : (sites[0]?.id ?? null);
    set({ sites, activeSiteId: resolvedId });
    if (resolvedId !== null && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(resolvedId));
    }
  },

  setActiveSite: (id) => {
    set({ activeSiteId: id, isCorpView: id === null });
    if (typeof window !== "undefined") {
      if (id !== null) {
        localStorage.setItem(STORAGE_KEY, String(id));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  },

  toggleCorpView: () => {
    const { isCorpView, sites, activeSiteId } = get();
    if (isCorpView) {
      // Switch back to first site
      const fallback = sites[0]?.id ?? null;
      set({ isCorpView: false, activeSiteId: activeSiteId ?? fallback });
    } else {
      set({ isCorpView: true, activeSiteId: null });
    }
  },
}));
