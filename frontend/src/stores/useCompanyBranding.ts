import { create } from "zustand";
import api from "@/lib/api";

interface CompanyBrandingStore {
  logoUrl: string | null;
  isLoading: boolean;
  fetchLogo: () => Promise<void>;
  clearLogo: () => void;
}

export const useCompanyBranding = create<CompanyBrandingStore>((set, get) => ({
  logoUrl: null,
  isLoading: false,

  fetchLogo: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const res = await api.get("/company/logo", { responseType: "blob" });
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(res.data);
      });
      set({ logoUrl: dataUrl, isLoading: false });
    } catch {
      // 404 = no logo configured — not an error
      set({ logoUrl: null, isLoading: false });
    }
  },

  clearLogo: () => set({ logoUrl: null }),
}));
