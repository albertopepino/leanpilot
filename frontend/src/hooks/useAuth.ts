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
}

interface AuthStore {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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
    localStorage.setItem("leanpilot_token", res.data.access_token);
    if (res.data.refresh_token) {
      localStorage.setItem("leanpilot_refresh", res.data.refresh_token);
    }
    const userRes = await authApi.me();
    set({ user: userRes.data });
    syncLocale(userRes.data.language);
  },
  logout: () => {
    localStorage.removeItem("leanpilot_token");
    localStorage.removeItem("leanpilot_refresh");
    set({ user: null });
  },
  acceptConsent: async (data) => {
    const res = await authApi.acceptConsent(data);
    set({ user: res.data });
  },
  loadUser: async () => {
    try {
      const res = await authApi.me();
      set({ user: res.data, loading: false });
      syncLocale(res.data.language);
    } catch {
      // Try refresh token before giving up
      const refreshToken = localStorage.getItem("leanpilot_refresh");
      if (refreshToken) {
        try {
          const refreshRes = await authApi.refresh(refreshToken);
          localStorage.setItem("leanpilot_token", refreshRes.data.access_token);
          if (refreshRes.data.refresh_token) {
            localStorage.setItem("leanpilot_refresh", refreshRes.data.refresh_token);
          }
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
