"use client";
import { create } from "zustand";
import { authApi } from "@/lib/api";
import { useI18n, Locale } from "@/stores/useI18n";

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  factory_id: number | null;
  language: string;
  needs_consent?: boolean;
  consent_version?: string | null;
  ai_consent?: boolean;
  marketing_consent?: boolean;
  totp_enabled?: boolean;
}

interface AuthStore {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  acceptConsent: (data: {
    privacy_policy_accepted: boolean;
    terms_accepted: boolean;
    ai_consent?: boolean;
    marketing_consent?: boolean;
  }) => Promise<void>;
}

function syncLocale(lang: string) {
  const VALID_LOCALES = new Set(["en", "it", "de", "es", "fr", "pl", "sr"]);
  const locale = (VALID_LOCALES.has(lang) ? lang : "en") as Locale;
  useI18n.getState().setLocale(locale);
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  login: async (email, password) => {
    const res = await authApi.login(email, password);
    // Cookies are set automatically by the server via Set-Cookie headers.
    // Also store in localStorage for backwards-compatible API client support.
    if (res.data.access_token) {
      localStorage.setItem("leanpilot_token", res.data.access_token);
    }
    if (res.data.refresh_token) {
      localStorage.setItem("leanpilot_refresh", res.data.refresh_token);
    }
    const userRes = await authApi.me();
    set({ user: userRes.data });
    syncLocale(userRes.data.language);
  },
  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Server may be unreachable — clear local state anyway
    }
    localStorage.removeItem("leanpilot_token");
    localStorage.removeItem("leanpilot_refresh");
    set({ user: null });
  },
  acceptConsent: async (data) => {
    const res = await authApi.acceptConsent(data);
    set({ user: res.data });
  },
  loadUser: async () => {
    // Check if we have any indication of being logged in (cookie flag or legacy token)
    const hasLoginCookie = document.cookie.includes("logged_in=");
    const hasLegacyToken = !!localStorage.getItem("leanpilot_token");

    if (!hasLoginCookie && !hasLegacyToken) {
      set({ user: null, loading: false });
      return;
    }

    try {
      const res = await authApi.me();
      set({ user: res.data, loading: false });
      syncLocale(res.data.language);
    } catch {
      // Try refresh — the interceptor handles cookie-based refresh automatically,
      // but we also try explicitly here for the initial load case.
      const hasRefresh = hasLoginCookie || !!localStorage.getItem("leanpilot_refresh");
      if (hasRefresh) {
        try {
          const legacyRefresh = localStorage.getItem("leanpilot_refresh");
          await authApi.refresh(legacyRefresh || undefined);
          const userRes = await authApi.me();
          set({ user: userRes.data, loading: false });
          syncLocale(userRes.data.language);
          return;
        } catch {
          localStorage.removeItem("leanpilot_token");
          localStorage.removeItem("leanpilot_refresh");
        }
      }
      set({ user: null, loading: false });
    }
  },
}));
