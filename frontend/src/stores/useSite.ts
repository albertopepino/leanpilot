import { create } from "zustand";

export interface Site {
  id: number;
  name: string;
  site_code: string | null;
  location: string | null;
  country: string | null;
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
const CORP_VIEW_KEY = "leanpilot_corp_view";

function loadPersistedSiteId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? Number(raw) : null;
}

function loadPersistedCorpView(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CORP_VIEW_KEY) === "1";
}

export const useSite = create<SiteStore>((set, get) => ({
  sites: [],
  activeSiteId: loadPersistedSiteId(),
  isCorpView: loadPersistedCorpView(),

  setSites: (sites) => {
    const current = get().activeSiteId;
    const wasCorpView = get().isCorpView;
    // If was in corp view, stay in corp view
    if (wasCorpView) {
      set({ sites });
      return;
    }
    // If stored site is not in list, pick first or null
    const validIds = sites.map((s) => s.id);
    const resolvedId = current && validIds.includes(current) ? current : (sites[0]?.id ?? null);
    set({ sites, activeSiteId: resolvedId });
    if (resolvedId !== null && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(resolvedId));
    }
  },

  setActiveSite: (id) => {
    const corpView = id === null;
    set({ activeSiteId: id, isCorpView: corpView });
    if (typeof window !== "undefined") {
      if (id !== null) {
        localStorage.setItem(STORAGE_KEY, String(id));
        localStorage.removeItem(CORP_VIEW_KEY);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(CORP_VIEW_KEY, "1");
      }
    }
  },

  toggleCorpView: () => {
    const { isCorpView, sites, activeSiteId } = get();
    if (isCorpView) {
      // Switch back to first site
      const siteId = activeSiteId ?? sites[0]?.id ?? null;
      set({ isCorpView: false, activeSiteId: siteId });
      if (typeof window !== "undefined") {
        if (siteId !== null) localStorage.setItem(STORAGE_KEY, String(siteId));
        localStorage.removeItem(CORP_VIEW_KEY);
      }
    } else {
      set({ isCorpView: true, activeSiteId: null });
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(CORP_VIEW_KEY, "1");
      }
    }
  },
}));
