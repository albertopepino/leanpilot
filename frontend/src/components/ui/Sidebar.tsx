"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/stores/useI18n";
import { adminApi } from "@/lib/api";
import { usePathname, useRouter } from "next/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { useCompanyBranding } from "@/stores/useCompanyBranding";
import { useCompanySettings } from "@/stores/useCompanySettings";
import {
  Activity,
  AlertCircle,
  ArrowLeftRight,
  BarChart3,
  Briefcase,
  Building2,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Footprints,
  Gauge,
  Globe,
  HelpCircle,
  Kanban,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  LogOut,
  Menu,
  Package,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useSite } from "@/stores/useSite";

/* ─── Types ─── */
interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  currentView?: string;
  onNavigate?: (view: string) => void;
}

interface NavItem {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  href: string;
  badge?: string;
}

interface NavSection {
  key: string;
  titleKey: string;
  fallbackTitle: string;
  icon: LucideIcon;
  color: string;
  dotColor: string;
  defaultCollapsed?: boolean;
  items: NavItem[];
}

/* ─── Corporate section (conditionally shown) ─── */
const corporateSection: NavSection = {
  key: "corporate",
  titleKey: "common.navCorporate",
  fallbackTitle: "Corporate",
  icon: Globe,
  color: "blue",
  dotColor: "bg-blue-500",
  items: [
    { id: "corporate-dashboard", labelKey: "dashboard.corporateTitle", icon: Globe, href: "/corporate" },
    { id: "site-management", labelKey: "common.navSiteManagement", icon: Building2, href: "/system/admin" },
  ],
};

/* ─── Portal section (superadmin only) ─── */
const portalSection: NavSection = {
  key: "portal",
  titleKey: "common.navPortal",
  fallbackTitle: "Portal",
  icon: Shield,
  color: "purple",
  dotColor: "bg-purple-500",
  items: [
    { id: "portal-clients", labelKey: "portal.title", icon: Building2, href: "/portal" },
  ],
};

/* ─── Flow-based navigation: Daily → Monitor → Respond → Improve → Manage ─── */
const sections: NavSection[] = [
  {
    key: "daily",
    titleKey: "common.navDaily",
    fallbackTitle: "Daily",
    icon: CalendarCheck,
    color: "emerald",
    dotColor: "bg-emerald-500",
    items: [
      { id: "home", labelKey: "common.navDashboard", icon: LayoutDashboard, href: "/operations/home" },
      { id: "safety", labelKey: "common.navSafety", icon: Shield, href: "/operations/safety" },
      { id: "sqcdp", labelKey: "common.navSQCDP", icon: BarChart3, href: "/operations/sqcdp" },
      { id: "production", labelKey: "common.navProductionTracking", icon: Clock, href: "/operations/production" },
      { id: "handover", labelKey: "common.navHandover", icon: ArrowLeftRight, href: "/operations/handover" },
    ],
  },
  {
    key: "monitor",
    titleKey: "common.navMonitor",
    fallbackTitle: "Monitor",
    icon: Activity,
    color: "blue",
    dotColor: "bg-blue-500",
    items: [
      { id: "oee", labelKey: "common.navOEE", icon: Gauge, href: "/operations/oee" },
      { id: "andon", labelKey: "common.navAndon", icon: Zap, href: "/operations/andon" },
      { id: "spc", labelKey: "common.navSPC", icon: LineChart, href: "/quality/spc" },
      { id: "shopfloor", labelKey: "common.navShopFloor", icon: Smartphone, href: "/operations/shopfloor" },
    ],
  },
  {
    key: "respond",
    titleKey: "common.navRespond",
    fallbackTitle: "Respond",
    icon: AlertCircle,
    color: "rose",
    dotColor: "bg-rose-500",
    items: [
      { id: "quality", labelKey: "common.navQualityDashboard", icon: ShieldCheck, href: "/quality" },
      { id: "root-cause", labelKey: "common.navRootCause", icon: HelpCircle, href: "/improvement/root-cause" },
      { id: "a3", labelKey: "common.navA3", icon: FileSpreadsheet, href: "/improvement/a3" },
      { id: "poka-yoke", labelKey: "common.navPokaYoke", icon: ShieldAlert, href: "/quality/poka-yoke" },
      { id: "fmea", labelKey: "common.navFMEA", icon: Shield, href: "/quality/fmea" },
    ],
  },
  {
    key: "improve",
    titleKey: "common.navImprove",
    fallbackTitle: "Improve",
    icon: TrendingUp,
    color: "amber",
    dotColor: "bg-amber-500",
    items: [
      { id: "kaizen", labelKey: "common.navKaizen", icon: Lightbulb, href: "/improvement/kaizen" },
      { id: "gemba", labelKey: "common.navGemba", icon: Footprints, href: "/improvement/gemba" },
      { id: "lean-tools", labelKey: "common.navLeanTools", icon: Wrench, href: "/improvement/lean-tools" },
      { id: "smed", labelKey: "common.navSmed", icon: Timer, href: "/improvement/smed" },
      { id: "tpm", labelKey: "common.navTPM", icon: Settings, href: "/improvement/tpm" },
      { id: "six-s", labelKey: "common.navSixS", icon: Sparkles, href: "/improvement/six-s" },
      { id: "pareto", labelKey: "common.navPareto", icon: BarChart3, href: "/improvement/pareto" },
    ],
  },
  {
    key: "manage",
    titleKey: "common.navManage",
    fallbackTitle: "Manage",
    icon: Briefcase,
    color: "slate",
    dotColor: "bg-slate-400",
    defaultCollapsed: true,
    items: [
      { id: "orders", labelKey: "common.navOrders", icon: Package, href: "/planning/orders" },
      { id: "products", labelKey: "common.navProducts", icon: Package, href: "/planning/products" },
      { id: "kanban", labelKey: "common.navKanban", icon: Kanban, href: "/planning/kanban" },
      { id: "admin", labelKey: "common.navAdmin", icon: Users, href: "/system/admin" },
      { id: "settings", labelKey: "common.navSettings", icon: Settings, href: "/system/settings" },
    ],
  },
];

/* ─── Role-Based Menu Presets (flow-aligned) ─── */
const ROLE_MENU_PRESETS: Record<string, string[]> = {
  // Daily + Monitor basics — operators focus on their shift
  operator: ['home', 'safety', 'sqcdp', 'production', 'handover', 'andon', 'shopfloor', 'kaizen'],
  shopfloor_operator: ['shopfloor', 'andon', 'sqcdp', 'safety'],
  // Supervisors see Daily + Monitor + Respond + Improve (no Manage except kanban)
  line_supervisor: [
    'home', 'safety', 'sqcdp', 'production', 'handover',
    'oee', 'andon', 'spc', 'shopfloor',
    'quality', 'root-cause', 'a3', 'poka-yoke',
    'kaizen', 'gemba', 'smed', 'tpm', 'six-s', 'pareto',
    'orders', 'kanban',
  ],
  supervisor: [
    'home', 'safety', 'sqcdp', 'production', 'handover',
    'oee', 'andon', 'spc', 'shopfloor',
    'quality', 'root-cause', 'a3', 'poka-yoke',
    'kaizen', 'gemba', 'smed', 'tpm', 'six-s', 'pareto',
    'orders', 'kanban',
  ],
  plant_manager: ['*'],
  manager: ['*'],
  admin: ['*'],
  // Quality role: Daily safety + Monitor SPC + full Respond + some Improve
  quality_inspector: ['home', 'safety', 'spc', 'quality', 'root-cause', 'a3', 'poka-yoke', 'six-s', 'pareto'],
  quality: ['home', 'safety', 'spc', 'quality', 'root-cause', 'a3', 'poka-yoke', 'six-s', 'pareto'],
  // Maintenance: Monitor + TPM focus
  maintenance: ['home', 'production', 'oee', 'andon', 'shopfloor', 'tpm'],
  viewer: ['home', 'oee', 'quality', 'spc'],
};

function getVisibleItemIds(role?: string): string[] | null {
  if (!role) return null;
  const preset = ROLE_MENU_PRESETS[role.toLowerCase()];
  if (!preset || preset.includes('*')) return null; // null = show all
  return preset;
}

/* ─── Subtitle map: item id → i18n key ─── */
const SUBTITLE_KEYS: Record<string, string> = {
  home: "common.subtitleDashboard",
  safety: "common.subtitleSafety",
  sqcdp: "common.subtitleSQCDP",
  production: "common.subtitleProduction",
  handover: "common.subtitleHandover",
  oee: "common.subtitleOEE",
  andon: "common.subtitleAndon",
  spc: "common.subtitleSPC",
  shopfloor: "common.subtitleShopFloor",
  quality: "common.subtitleQuality",
  "root-cause": "common.subtitleRootCause",
  a3: "common.subtitleA3",
  "poka-yoke": "common.subtitlePokaYoke",
  fmea: "common.subtitleFMEA",
  kaizen: "common.subtitleKaizen",
  pareto: "common.subtitlePareto",
  gemba: "common.subtitleGemba",
  "lean-tools": "common.subtitleLeanTools",
  smed: "common.subtitleSMED",
  tpm: "common.subtitleTPM",
  "six-s": "common.subtitleSixS",
  orders: "common.subtitleOrders",
  products: "common.subtitleProducts",
  kanban: "common.subtitleKanban",
  admin: "common.subtitleAdmin",
  settings: "common.subtitleSettings",
  "corporate-dashboard": "common.subtitleCorporate",
  "site-management": "common.subtitleSiteManagement",
  "portal-clients": "common.subtitlePortal",
};

/* ─── Helpers ─── */
function getStorageKey(userId?: number) {
  return `leanpilot_sidebar_collapsed_${userId || "anon"}`;
}

function loadCollapsedState(userId?: number): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const defaults: Record<string, boolean> = {};
  for (const s of sections) {
    if (s.defaultCollapsed) defaults[s.key] = true;
  }
  return defaults;
}

function saveCollapsedState(userId: number | undefined, state: Record<string, boolean>) {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch { /* ignore */ }
}

function findActiveItem(pathname: string): { sectionKey: string; itemId: string } | null {
  const allNav = [portalSection, corporateSection, ...sections];
  // First pass: exact match takes priority
  for (const section of allNav) {
    for (const item of section.items) {
      if (pathname === item.href) {
        return { sectionKey: section.key, itemId: item.id };
      }
    }
  }
  // Second pass: longest prefix match (most specific route wins)
  let best: { sectionKey: string; itemId: string; len: number } | null = null;
  for (const section of allNav) {
    for (const item of section.items) {
      if (pathname.startsWith(item.href + "/") && (!best || item.href.length > best.len)) {
        best = { sectionKey: section.key, itemId: item.id, len: item.href.length };
      }
    }
  }
  return best ? { sectionKey: best.sectionKey, itemId: best.itemId } : null;
}

/* ─── Component ─── */
export default function Sidebar({ collapsed = false, onToggleCollapse, currentView, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, string> | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const { logoUrl, fetchLogo } = useCompanyBranding();
  const { auditLabel, loaded: settingsLoaded, fetchSettings } = useCompanySettings();

  // Fetch company settings on mount
  useEffect(() => { if (!settingsLoaded) fetchSettings(); }, [settingsLoaded, fetchSettings]);

  // Helper to get nav item label, with audit label override for six-s
  const getLabel = (item: { id: string; labelKey: string }) =>
    item.id === "six-s" ? `${auditLabel} Audit` : t(item.labelKey);

  const activeMatch = findActiveItem(pathname || "");
  const activeItemId = currentView || activeMatch?.itemId || "home";

  useEffect(() => {
    setCollapsedGroups(loadCollapsedState(user?.id));
  }, [user?.id]);

  useEffect(() => {
    adminApi.getMyPermissions()
      .then((res) => setPermissions(res.data.permissions))
      .catch(() => setPermissions(null));
    fetchLogo();
  }, [user?.role, fetchLogo]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveCollapsedState(user?.id, next);
      return next;
    });
  }, [user?.id]);

  useEffect(() => {
    const sectionKey = activeMatch?.sectionKey;
    if (sectionKey && collapsedGroups[sectionKey]) {
      setCollapsedGroups((prev) => {
        const next = { ...prev, [sectionKey]: false };
        saveCollapsedState(user?.id, next);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItemId, activeMatch?.sectionKey, user?.id]);

  const handleNavigate = useCallback((item: NavItem) => {
    if (onNavigate) {
      onNavigate(item.id);
    } else {
      router.push(item.href);
    }
    setMobileOpen(false);
  }, [onNavigate, router]);

  const handleSettingsClick = useCallback(() => {
    if (onNavigate) {
      onNavigate("settings");
    } else {
      router.push("/system/settings");
    }
    setMobileOpen(false);
  }, [onNavigate, router]);

  /* ─── Keyboard navigation (arrow keys) ─── */
  const navRef = useRef<HTMLElement>(null);

  const handleNavKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!navRef.current) return;
    const focusable = Array.from(
      navRef.current.querySelectorAll<HTMLButtonElement>('button[data-nav-item]')
    );
    const currentIdx = focusable.indexOf(e.target as HTMLButtonElement);
    if (currentIdx === -1) return;

    let nextIdx = -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      nextIdx = currentIdx < focusable.length - 1 ? currentIdx + 1 : 0;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nextIdx = currentIdx > 0 ? currentIdx - 1 : focusable.length - 1;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIdx = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIdx = focusable.length - 1;
    }
    if (nextIdx >= 0) {
      focusable[nextIdx].focus();
    }
  }, []);

  const { isCorpView, sites } = useSite();
  const CORP_ROLES = ["admin", "plant_manager", "manager"];
  const hasCorpAccess = CORP_ROLES.includes(user?.role?.toLowerCase() ?? "") || sites.length > 1;

  const roleAllowedIds = getVisibleItemIds(user?.role);
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isSuperadmin = !!user?.is_superadmin;

  // Prepend portal/corporate sections based on access level
  let allSections = [...sections];
  if (hasCorpAccess) allSections = [corporateSection, ...allSections];
  if (isSuperadmin) allSections = [portalSection, ...allSections];

  const visibleSections = allSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        // Role-based filtering: hide admin panel for non-admin users
        if (item.id === 'admin' && !isAdmin) return false;
        // Role-based filtering: if preset defines allowed items, enforce it
        if (roleAllowedIds && !roleAllowedIds.includes(item.id)) return false;
        // Group-policy permission filtering
        if (permissions && permissions[item.id] === "hidden") return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  /* ─── Collapsed (slim) sidebar ─── */
  if (collapsed) {
    return (
      <aside
        className="sticky top-0 left-0 z-40 w-[60px] bg-th-card border-r border-th-border min-h-screen max-h-screen overflow-y-auto flex flex-col transition-all duration-300"
        aria-label="Navigation sidebar (collapsed)"
      >
        <div className="p-2 py-4 flex flex-col items-center border-b border-th-border">
          <button
            onClick={onToggleCollapse}
            className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center text-white hover:bg-brand-500 transition-colors"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <nav className="flex-1 py-2 px-1.5 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
          {visibleSections.map((section) => (
            <div key={section.key}>
              <div className="flex justify-center py-2">
                <div className={`w-1 h-1 rounded-full ${section.dotColor}`} />
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const subtitleKey = SUBTITLE_KEYS[item.id];
                const subtitle = subtitleKey ? t(subtitleKey) : "";
                const tooltipText = subtitle && subtitle !== subtitleKey
                  ? `${getLabel(item)} — ${subtitle}`
                  : getLabel(item);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item)}
                    className={`w-full flex items-center justify-center py-2 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
                      activeItemId === item.id
                        ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                        : "text-th-text-3 hover:bg-th-bg-hover hover:text-th-text-2"
                    }`}
                    aria-current={activeItemId === item.id ? "page" : undefined}
                    aria-label={tooltipText}
                    title={tooltipText}
                  >
                    <Icon size={18} strokeWidth={activeItemId === item.id ? 2.5 : 1.5} />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-2 pb-4 border-t border-th-border flex flex-col items-center gap-2">
          <button
            onClick={handleSettingsClick}
            className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-xs font-bold text-white hover:bg-brand-500 transition"
            title={user?.full_name || t("common.navSettings")}
            aria-label={t("common.navSettings")}
          >
            {user?.full_name?.charAt(0) || "U"}
          </button>
          <button
            onClick={logout}
            className="text-th-text-3 hover:text-rose-500 transition p-1"
            title={t("common.signOut")}
            aria-label={t("common.signOut")}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    );
  }

  /* ─── Expanded sidebar ─── */
  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-brand-600 text-white rounded-lg flex items-center justify-center shadow-lg"
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } fixed md:sticky top-0 left-0 z-40 w-60
          bg-th-card text-th-text
          border-r border-th-border
          min-h-screen max-h-screen overflow-y-auto flex flex-col transition-transform duration-300`}
        aria-label="Main navigation sidebar"
      >
        {/* Logo Header */}
        <div className="px-4 py-4 border-b border-th-border">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleCollapse}
              className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center text-white hover:bg-brand-500 transition-colors shrink-0"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <Logo size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-th-text">LeanPilot</h2>
              <p className="text-[9px] text-th-text-3 uppercase tracking-widest truncate">{t("common.sidebarSubtitle") || "Lean Operations OS"}</p>
            </div>
          </div>
          {logoUrl && (
            <div className="mt-3 pt-3 border-t border-th-border">
              <img src={logoUrl} alt="Company logo" className="h-6 max-w-[120px] object-contain opacity-70" />
            </div>
          )}
        </div>

        {/* Corporate view banner */}
        {isCorpView && hasCorpAccess && (
          <div className="mx-3 mt-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
            <Globe size={13} className="text-blue-500 shrink-0" />
            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 truncate">
              {t("common.allSites") || "Viewing: All Sites"}
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav ref={navRef} onKeyDown={handleNavKeyDown} className="flex-1 px-2 py-1.5 overflow-y-auto" role="navigation" aria-label="Main navigation">
          {visibleSections.map((section) => {
            const isCollapsed = !!collapsedGroups[section.key];
            const hasActive = section.items.some((i) => i.id === activeItemId);
            const SectionIcon = section.icon;

            return (
              <div key={section.key} className="mb-0.5">
                <button
                  onClick={() => toggleGroup(section.key)}
                  className="w-full flex items-center gap-2 px-2 pt-3 pb-1 group"
                  aria-expanded={!isCollapsed}
                >
                  <SectionIcon size={12} className={`shrink-0 ${section.dotColor.replace('bg-', 'text-')}`} />
                  <span className="text-[10px] uppercase text-th-text-3 tracking-widest font-semibold flex-1 text-left truncate">
                    {t(section.titleKey) !== section.titleKey ? t(section.titleKey) : section.fallbackTitle}
                  </span>
                  {isCollapsed && hasActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  )}
                  <ChevronDown
                    size={12}
                    className={`text-th-text-3 opacity-40 group-hover:opacity-70 transition-all duration-200 ${
                      isCollapsed ? "-rotate-90" : ""
                    }`}
                  />
                </button>

                <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  isCollapsed ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100"
                }`}>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeItemId === item.id;
                    const subtitleKey = SUBTITLE_KEYS[item.id];
                    const subtitle = subtitleKey ? t(subtitleKey) : "";
                    const hasSubtitle = subtitle && subtitle !== subtitleKey;
                    return (
                      <button
                        key={item.id}
                        data-nav-item
                        onClick={() => handleNavigate(item)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
                          isActive
                            ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium"
                            : "text-th-text-2 hover:bg-th-bg-hover hover:text-th-text"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon size={15} strokeWidth={isActive ? 2 : 1.5} className="shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0 text-left">
                          <span className="truncate block">{getLabel(item)}</span>
                          {hasSubtitle && (
                            <span className="block truncate text-[10px] leading-tight text-th-text-3 font-normal mt-px">
                              {subtitle}
                            </span>
                          )}
                        </div>
                        {item.badge && (
                          <span className="ml-auto text-[9px] bg-brand-500 text-white px-1.5 py-0.5 rounded font-bold leading-none shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Language + Theme */}
        <div className="px-3 py-2 border-t border-th-border flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        {/* User */}
        <div className="px-3 py-3 border-t border-th-border">
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSettingsClick}
              className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-xs font-bold text-white hover:bg-brand-500 transition shrink-0"
              title={t("common.navSettings")}
              aria-label={t("common.navSettings")}
            >
              {user?.full_name?.charAt(0) || "U"}
            </button>
            <button
              onClick={handleSettingsClick}
              className="flex-1 min-w-0 text-left hover:opacity-80 transition"
            >
              <p className="text-sm font-medium truncate text-th-text leading-tight">{user?.full_name}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-600 dark:text-brand-400 leading-none">
                  {(user?.role || "").replace(/_/g, " ")}
                </span>
              </div>
            </button>
            <button
              onClick={logout}
              className="text-th-text-3 hover:text-rose-500 transition p-1.5 rounded-lg hover:bg-rose-500/10"
              title={t("common.signOut")}
              aria-label={t("common.signOut")}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
