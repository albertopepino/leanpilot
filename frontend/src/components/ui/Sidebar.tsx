"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/stores/useI18n";
import { adminApi } from "@/lib/api";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { useCompanyBranding } from "@/stores/useCompanyBranding";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: any) => void;
}

interface NavItem {
  id: string;
  labelKey: string;
  icon: string;
  badge?: string;
}

interface NavSection {
  key: string;
  titleKey: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    key: "home",
    titleKey: "common.navHome",
    items: [
      { id: "home", labelKey: "common.navHome", icon: "🏠" },
      { id: "master-calendar", labelKey: "common.navMasterCalendar", icon: "📅" },
    ],
  },
  {
    key: "getting-started",
    titleKey: "common.navGettingStarted",
    items: [
      { id: "assessment", labelKey: "common.navAssessment", icon: "🧭" },
      { id: "copilot", labelKey: "common.navCopilot", icon: "🤖", badge: "AI" },
      { id: "resources", labelKey: "common.navResources", icon: "📚" },
    ],
  },
  {
    key: "define",
    titleKey: "common.navDefine",
    items: [
      { id: "production-orders", labelKey: "common.navProductionOrders", icon: "📋" },
      { id: "products", labelKey: "common.navProducts", icon: "📦" },
      { id: "production", labelKey: "common.navProduction", icon: "📝" },
      { id: "andon", labelKey: "common.navAndon", icon: "🚦" },
    ],
  },
  {
    key: "measure",
    titleKey: "common.navMeasure",
    items: [
      { id: "dashboard", labelKey: "common.navDashboard", icon: "📊" },
      { id: "consolidated-oee", labelKey: "common.navConsolidated", icon: "🏭" },
      { id: "hourly", labelKey: "common.navHourly", icon: "⏱️" },
      { id: "pareto", labelKey: "common.navPareto", icon: "📈" },
      { id: "defect-catalog", labelKey: "common.navDefects", icon: "🏷️" },
      { id: "qc-checks", labelKey: "common.navQCChecks", icon: "🧪" },
    ],
  },
  {
    key: "analyze",
    titleKey: "common.navAnalyze",
    items: [
      { id: "five-why", labelKey: "common.navFiveWhy", icon: "❓" },
      { id: "ishikawa", labelKey: "common.navIshikawa", icon: "🐟" },
      { id: "vsm", labelKey: "common.navVsm", icon: "🗺️" },
      { id: "gemba", labelKey: "common.navGemba", icon: "🚶" },
      { id: "safety", labelKey: "common.navSafety", icon: "🛡️" },
      { id: "a3", labelKey: "common.navA3", icon: "📋" },
      { id: "mind-map", labelKey: "common.navMindMap", icon: "🧠" },
    ],
  },
  {
    key: "improve",
    titleKey: "common.navImprove",
    items: [
      { id: "kaizen", labelKey: "common.navKaizen", icon: "💡" },
      { id: "smed", labelKey: "common.navSmed", icon: "🔄" },
      { id: "capa", labelKey: "common.navCAPA", icon: "🔧" },
      { id: "tpm", labelKey: "common.navTpm", icon: "⚙️" },
      { id: "cilt", labelKey: "common.navCilt", icon: "🔧" },
    ],
  },
  {
    key: "control",
    titleKey: "common.navControl",
    items: [
      { id: "six-s", labelKey: "common.navSixS", icon: "✨" },
      { id: "qc-policies", labelKey: "common.navQCPolicies", icon: "📁" },
      { id: "ncr", labelKey: "common.navNCR", icon: "⚠️" },
    ],
  },
  {
    key: "system",
    titleKey: "common.navSystem",
    items: [
      { id: "settings", labelKey: "common.navSettings", icon: "⚙️" },
      { id: "admin", labelKey: "common.navAdminPanel", icon: "🛡️" },
    ],
  },
];

function getStorageKey(userId?: number) {
  return `leanpilot_sidebar_collapsed_${userId || "anon"}`;
}

function loadCollapsedState(userId?: number): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCollapsedState(userId: number | undefined, state: Record<string, boolean>) {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch { /* ignore */ }
}

export default function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, string> | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const { logoUrl, fetchLogo } = useCompanyBranding();

  // Load collapsed state from localStorage on mount / user change
  useEffect(() => {
    setCollapsedGroups(loadCollapsedState(user?.id));
  }, [user?.id]);

  // Fetch user's tab permissions on mount
  useEffect(() => {
    adminApi.getMyPermissions()
      .then((res) => setPermissions(res.data.permissions))
      .catch(() => setPermissions(null));
    fetchLogo();
  }, [user?.role]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveCollapsedState(user?.id, next);
      return next;
    });
  }, [user?.id]);

  // Auto-expand the group containing the current view
  useEffect(() => {
    const activeSection = sections.find((s) => s.items.some((i) => i.id === currentView));
    if (activeSection && collapsedGroups[activeSection.key]) {
      setCollapsedGroups((prev) => {
        const next = { ...prev, [activeSection.key]: false };
        saveCollapsedState(user?.id, next);
        return next;
      });
    }
    // Only run when currentView changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  // Filter sections: hide tabs where permission is "hidden"
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!permissions) return true;
        const perm = permissions[item.id];
        return perm !== "hidden";
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-brand-600 dark:bg-brand-900 text-white rounded-xl flex items-center justify-center shadow-lg"
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? "✕" : "☰"}
      </button>

      {/* Overlay on mobile */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } fixed md:sticky top-0 left-0 z-40 w-64
          bg-white dark:bg-gradient-to-b dark:from-brand-900 dark:via-brand-900 dark:to-[#1a1545]
          text-gray-800 dark:text-white
          border-r border-gray-200 dark:border-transparent
          min-h-screen max-h-screen overflow-y-auto flex flex-col transition-transform duration-300`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center shadow-glow text-white" role="img" aria-label="LeanPilot">
              <Logo size={26} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">LeanPilot</h2>
              <p className="text-[10px] text-gray-400 dark:text-brand-300 opacity-60 uppercase tracking-widest">{t("common.sidebarSubtitle") || "Lean Operations OS"}</p>
            </div>
          </div>
          <p className="mt-2 text-[9px] leading-tight text-gray-400 dark:text-gray-500 italic">{t("common.sidebarTagline") || "Your Digital Black Belt for Operational Excellence. Built by Real Black Belts."}</p>
          {logoUrl && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/10">
              <img
                src={logoUrl}
                alt="Company logo"
                className="h-7 max-w-[140px] object-contain opacity-80 hover:opacity-100 transition"
              />
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto" role="navigation" aria-label="Main navigation">
          {visibleSections.map((section) => {
            const isCollapsed = !!collapsedGroups[section.key];
            const hasActive = section.items.some((i) => i.id === currentView);

            return (
              <div key={section.key}>
                {/* Group Header — clickable to collapse/expand */}
                <button
                  onClick={() => toggleGroup(section.key)}
                  className="w-full flex items-center gap-1 px-3 pt-4 pb-1 group"
                  aria-expanded={!isCollapsed}
                >
                  <span
                    className={`text-[9px] transition-transform duration-200 ${
                      isCollapsed ? "-rotate-90" : "rotate-0"
                    } text-gray-400 dark:text-brand-300 opacity-50 group-hover:opacity-80`}
                  >
                    ▼
                  </span>
                  <span className="text-[10px] uppercase text-gray-400 dark:text-brand-300 opacity-60 dark:opacity-40 group-hover:opacity-80 dark:group-hover:opacity-70 tracking-widest font-semibold transition-opacity flex-1 text-left">
                    {t(section.titleKey)}
                  </span>
                  {isCollapsed && hasActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400 animate-pulse" />
                  )}
                  <span className="text-[9px] text-gray-400 dark:text-brand-300 opacity-30 group-hover:opacity-60 tabular-nums">
                    {section.items.length}
                  </span>
                </button>

                {/* Items — collapsible */}
                <div
                  className={`overflow-hidden transition-all duration-200 ease-in-out ${
                    isCollapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
                  }`}
                >
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setMobileOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                        currentView === item.id
                          ? "bg-brand-50 text-brand-700 font-semibold dark:bg-white/15 dark:text-white dark:shadow-inner"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-brand-200 dark:hover:bg-white/10 dark:hover:text-white"
                      }`}
                      aria-current={currentView === item.id ? "page" : undefined}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="truncate">{t(item.labelKey)}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-white px-2 py-0.5 rounded-full font-bold shadow">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Language + Theme toggles */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-white/10 flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        {/* User */}
        <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { onNavigate("settings"); setMobileOpen(false); }}
              className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-xs font-bold text-white hover:bg-brand-500 transition"
              title={t("common.navSettings")}
            >
              {user?.full_name?.charAt(0) || "U"}
            </button>
            <button
              onClick={() => { onNavigate("settings"); setMobileOpen(false); }}
              className="flex-1 min-w-0 text-left hover:opacity-80 transition"
            >
              <p className="text-sm font-medium truncate text-gray-900 dark:text-white">{user?.full_name}</p>
              <p className="text-[10px] text-gray-400 dark:text-brand-300 opacity-60 truncate">{user?.role}</p>
            </button>
            <button
              onClick={logout}
              className="text-gray-400 dark:text-brand-300 opacity-60 hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 transition text-lg"
              title={t("common.signOut")}
            >
              ⏻
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
