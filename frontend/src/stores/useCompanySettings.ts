import { create } from "zustand";
import { adminApi } from "@/lib/api";

interface CompanySettingsStore {
  auditLabel: "5S" | "6S";
  loaded: boolean;
  fetchSettings: () => Promise<void>;
  setAuditLabel: (label: "5S" | "6S") => Promise<void>;
}

export const useCompanySettings = create<CompanySettingsStore>((set) => ({
  auditLabel: "6S",
  loaded: false,

  fetchSettings: async () => {
    try {
      const res = await adminApi.getCompanySettings();
      const data = res.data ?? res;
      set({
        auditLabel: data.audit_label === "5S" ? "5S" : "6S",
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  setAuditLabel: async (label) => {
    set({ auditLabel: label });
    await adminApi.updateCompanySettings({ audit_label: label });
  },
}));
