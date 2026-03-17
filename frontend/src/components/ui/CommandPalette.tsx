"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/stores/useI18n";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  Home, Calendar, Compass, Bot, BookOpen, ClipboardList, Package, FileText,
  Zap, Gauge, Factory, Clock, TrendingUp, Tag, FlaskConical, HelpCircle,
  Fish, Map, Footprints, Shield, FileSpreadsheet, Brain, Lightbulb, RefreshCw,
  Wrench, Settings, Sparkles, FolderOpen, AlertTriangle, Search,
  type LucideIcon,
} from "lucide-react";

/* ─── Types ─── */
interface CommandItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  action?: () => void;
  group: "navigation" | "quick-actions" | "recent";
  section?: string;
}

/* ─── Icon lookup for recent pages (stored as string ids) ─── */
const ICON_MAP: Record<string, LucideIcon> = {
  home: Home, "master-calendar": Calendar, assessment: Compass, copilot: Bot,
  resources: BookOpen, "production-orders": ClipboardList, products: Package,
  production: FileText, andon: Zap, dashboard: Gauge, "consolidated-oee": Factory,
  hourly: Clock, pareto: TrendingUp, "defect-catalog": Tag, "qc-checks": FlaskConical,
  "five-why": HelpCircle, ishikawa: Fish, vsm: Map, gemba: Footprints,
  safety: Shield, a3: FileSpreadsheet, "mind-map": Brain, kaizen: Lightbulb,
  smed: RefreshCw, capa: Wrench, tpm: Settings, cilt: Wrench, "six-s": Sparkles,
  "qc-policies": FolderOpen, ncr: AlertTriangle, settings: Settings, admin: Shield,
};

/* ─── Navigation items (mirrors Sidebar sections) ─── */
const NAV_ITEMS: Array<{
  id: string;
  labelKey: string;
  icon: LucideIcon;
  href: string;
  sectionKey: string;
}> = [
  // Home
  { id: "home", labelKey: "common.navHome", icon: Home, href: "/home", sectionKey: "common.navHome" },
  { id: "master-calendar", labelKey: "common.navMasterCalendar", icon: Calendar, href: "/home/calendar", sectionKey: "common.navHome" },
  // Getting Started
  { id: "assessment", labelKey: "common.navAssessment", icon: Compass, href: "/getting-started/assessment", sectionKey: "common.navGettingStarted" },
  { id: "copilot", labelKey: "common.navCopilot", icon: Bot, href: "/getting-started/copilot", sectionKey: "common.navGettingStarted" },
  { id: "resources", labelKey: "common.navResources", icon: BookOpen, href: "/getting-started/resources", sectionKey: "common.navGettingStarted" },
  // Define
  { id: "production-orders", labelKey: "common.navProductionOrders", icon: ClipboardList, href: "/define/production-orders", sectionKey: "common.navDefine" },
  { id: "products", labelKey: "common.navProducts", icon: Package, href: "/define/products", sectionKey: "common.navDefine" },
  { id: "production", labelKey: "common.navProduction", icon: FileText, href: "/define/production", sectionKey: "common.navDefine" },
  { id: "andon", labelKey: "common.navAndon", icon: Zap, href: "/define/andon", sectionKey: "common.navDefine" },
  // Measure
  { id: "dashboard", labelKey: "common.navDashboard", icon: Gauge, href: "/measure/oee", sectionKey: "common.navMeasure" },
  { id: "consolidated-oee", labelKey: "common.navConsolidated", icon: Factory, href: "/measure/consolidated", sectionKey: "common.navMeasure" },
  { id: "hourly", labelKey: "common.navHourly", icon: Clock, href: "/measure/hourly", sectionKey: "common.navMeasure" },
  { id: "pareto", labelKey: "common.navPareto", icon: TrendingUp, href: "/measure/pareto", sectionKey: "common.navMeasure" },
  { id: "defect-catalog", labelKey: "common.navDefects", icon: Tag, href: "/measure/defects", sectionKey: "common.navMeasure" },
  { id: "qc-checks", labelKey: "common.navQCChecks", icon: FlaskConical, href: "/measure/qc", sectionKey: "common.navMeasure" },
  // Analyze
  { id: "five-why", labelKey: "common.navFiveWhy", icon: HelpCircle, href: "/analyze/five-why", sectionKey: "common.navAnalyze" },
  { id: "ishikawa", labelKey: "common.navIshikawa", icon: Fish, href: "/analyze/ishikawa", sectionKey: "common.navAnalyze" },
  { id: "vsm", labelKey: "common.navVsm", icon: Map, href: "/analyze/vsm", sectionKey: "common.navAnalyze" },
  { id: "gemba", labelKey: "common.navGemba", icon: Footprints, href: "/analyze/gemba", sectionKey: "common.navAnalyze" },
  { id: "safety", labelKey: "common.navSafety", icon: Shield, href: "/analyze/safety", sectionKey: "common.navAnalyze" },
  { id: "a3", labelKey: "common.navA3", icon: FileSpreadsheet, href: "/analyze/a3", sectionKey: "common.navAnalyze" },
  { id: "mind-map", labelKey: "common.navMindMap", icon: Brain, href: "/analyze/mind-map", sectionKey: "common.navAnalyze" },
  // Improve
  { id: "kaizen", labelKey: "common.navKaizen", icon: Lightbulb, href: "/improve/kaizen", sectionKey: "common.navImprove" },
  { id: "smed", labelKey: "common.navSmed", icon: RefreshCw, href: "/improve/smed", sectionKey: "common.navImprove" },
  { id: "capa", labelKey: "common.navCAPA", icon: Wrench, href: "/improve/capa", sectionKey: "common.navImprove" },
  { id: "tpm", labelKey: "common.navTpm", icon: Settings, href: "/improve/tpm", sectionKey: "common.navImprove" },
  { id: "cilt", labelKey: "common.navCilt", icon: Wrench, href: "/improve/cilt", sectionKey: "common.navImprove" },
  // Control
  { id: "six-s", labelKey: "common.navSixS", icon: Sparkles, href: "/control/six-s", sectionKey: "common.navControl" },
  { id: "qc-policies", labelKey: "common.navQCPolicies", icon: FolderOpen, href: "/control/qc-policies", sectionKey: "common.navControl" },
  { id: "ncr", labelKey: "common.navNCR", icon: AlertTriangle, href: "/control/ncr", sectionKey: "common.navControl" },
  // System
  { id: "settings", labelKey: "common.navSettings", icon: Settings, href: "/system/settings", sectionKey: "common.navSystem" },
  { id: "admin", labelKey: "common.navAdminPanel", icon: Shield, href: "/system/admin", sectionKey: "common.navSystem" },
];

/* ─── Quick actions ─── */
const QUICK_ACTIONS: Array<{
  id: string;
  labelKey: string;
  icon: LucideIcon;
  href: string;
}> = [
  { id: "qa-new-kaizen", labelKey: "commandPalette.newKaizen", icon: Lightbulb, href: "/improve/kaizen?action=new" },
  { id: "qa-log-production", labelKey: "commandPalette.logProduction", icon: FileText, href: "/define/production?action=log" },
  { id: "qa-report-issue", labelKey: "commandPalette.reportIssue", icon: AlertTriangle, href: "/control/ncr?action=new" },
  { id: "qa-start-gemba", labelKey: "commandPalette.startGemba", icon: Footprints, href: "/analyze/gemba?action=new" },
];

/* ─── Recent pages storage ─── */
const RECENT_KEY = "leanpilot_recent_pages";
const MAX_RECENT = 5;

interface RecentPageData { id: string; label: string; href: string }

function getRecentPages(): RecentPageData[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentPage(item: RecentPageData) {
  try {
    const recent = getRecentPages().filter((r) => r.id !== item.id);
    recent.unshift(item);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

/* ─── Fuzzy match ─── */
function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function fuzzyScore(text: string, query: string): number {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  // Exact prefix match scores highest
  if (lower.startsWith(q)) return 100;
  // Contains substring
  if (lower.includes(q)) return 80;
  // Fuzzy match — score by how tight the character spread is
  let qi = 0;
  let firstIdx = -1;
  let lastIdx = -1;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) {
      if (firstIdx === -1) firstIdx = i;
      lastIdx = i;
      qi++;
    }
  }
  if (qi < q.length) return 0;
  const spread = lastIdx - firstIdx;
  return Math.max(1, 60 - spread);
}

/* ─── Component ─── */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  /* ─── Keyboard shortcut to open ─── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ─── Listen for focus trap escape event ─── */
  useEffect(() => {
    const container = trapRef.current;
    if (!container) return;
    const handleEscape = () => setOpen(false);
    container.addEventListener("focustrap:escape", handleEscape);
    return () => container.removeEventListener("focustrap:escape", handleEscape);
  }, [open, trapRef]);

  /* ─── Focus input when opening ─── */
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  /* ─── Build flat item list ─── */
  const allItems = useMemo((): CommandItem[] => {
    const recentPages = getRecentPages();
    const items: CommandItem[] = [];

    // Recent pages
    recentPages.forEach((r) => {
      items.push({
        id: `recent-${r.id}`,
        label: r.label,
        icon: ICON_MAP[r.id] || Home,
        href: r.href,
        group: "recent",
      });
    });

    // Quick actions
    QUICK_ACTIONS.forEach((qa) => {
      items.push({
        id: qa.id,
        label: t(qa.labelKey) || qa.labelKey,
        icon: qa.icon,
        href: qa.href,
        group: "quick-actions",
      });
    });

    // Navigation
    NAV_ITEMS.forEach((nav) => {
      items.push({
        id: `nav-${nav.id}`,
        label: t(nav.labelKey) || nav.labelKey,
        icon: nav.icon,
        href: nav.href,
        group: "navigation",
        section: t(nav.sectionKey),
      });
    });

    return items;
  }, [t]);

  /* ─── Filtered + scored results ─── */
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;

    return allItems
      .map((item) => ({ item, score: fuzzyScore(item.label, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [allItems, query]);

  /* ─── Group results for display ─── */
  const groupedResults = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: CommandItem[] }> = [];
    const groupMap: Record<string, CommandItem[]> = {};

    for (const item of filteredItems) {
      const existing = groupMap[item.group];
      if (existing) {
        existing.push(item);
      } else {
        groupMap[item.group] = [item];
      }
    }

    const groupLabels: Record<string, string> = {
      recent: t("commandPalette.recent") || "Recent",
      "quick-actions": t("commandPalette.quickActions") || "Quick Actions",
      navigation: t("commandPalette.navigation") || "Navigation",
    };

    const order = ["recent", "quick-actions", "navigation"];
    for (const key of order) {
      const items = groupMap[key];
      if (items && items.length > 0) {
        groups.push({ key, label: groupLabels[key] || key, items });
      }
    }

    return groups;
  }, [filteredItems, t]);

  /* ─── Flat index for keyboard nav ─── */
  const flatItems = useMemo(
    () => groupedResults.flatMap((g) => g.items),
    [groupedResults],
  );

  /* ─── Clamp selectedIndex ─── */
  useEffect(() => {
    if (selectedIndex >= flatItems.length) {
      setSelectedIndex(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, selectedIndex]);

  /* ─── Scroll selected item into view ─── */
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  /* ─── Execute selected item ─── */
  const executeItem = useCallback(
    (item: CommandItem) => {
      if (item.action) {
        item.action();
      } else if (item.href) {
        // Track in recent (use the nav label, not the recent- prefixed id)
        const navId = item.id.replace(/^(nav-|recent-)/, "");
        addRecentPage({ id: navId, label: item.label, href: item.href });
        router.push(item.href);
      }
      setOpen(false);
    },
    [router],
  );

  /* ─── Keyboard navigation ─── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(1, flatItems.length));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + flatItems.length) % Math.max(1, flatItems.length));
          break;
        case "Enter":
          e.preventDefault();
          if (flatItems[selectedIndex]) {
            executeItem(flatItems[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [flatItems, selectedIndex, executeItem],
  );

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("commandPalette.title") || "Command Palette"}
        className="relative w-full max-w-lg mx-4 bg-th-bg border border-th-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-th-border">
          <Search size={16} className="text-th-text-2 flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={t("commandPalette.placeholder") || "Search pages, actions..."}
            className="flex-1 bg-transparent text-th-text placeholder:text-th-text-2/50 text-sm outline-none"
            aria-label={t("commandPalette.searchLabel") || "Search commands"}
            aria-autocomplete="list"
            aria-controls="command-palette-list"
            aria-activedescendant={flatItems[selectedIndex] ? `cmd-item-${flatItems[selectedIndex].id}` : undefined}
            role="combobox"
            aria-expanded="true"
            aria-haspopup="listbox"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-th-text-2/60 bg-th-bg-3 rounded border border-th-border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          aria-label={t("commandPalette.results") || "Results"}
          className="max-h-[50vh] overflow-y-auto py-2"
        >
          {flatItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-th-text-2">
              {t("commandPalette.noResults") || "No results found."}
            </div>
          ) : (
            groupedResults.map((group) => (
              <div key={group.key} role="group" aria-label={group.label}>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-th-text-2/50">
                    {group.label}
                  </span>
                </div>
                {group.items.map((item) => {
                  const idx = flatIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      id={`cmd-item-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      data-index={idx}
                      onClick={() => executeItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-brand-50 dark:bg-white/10 text-brand-700 dark:text-white"
                          : "text-th-text hover:bg-th-bg-3"
                      }`}
                    >
                      <item.icon size={16} className="flex-shrink-0" />
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      {item.section && (
                        <span className="text-[10px] text-th-text-2/40 truncate flex-shrink-0">
                          {item.section}
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-[10px] text-th-text-2/40 flex-shrink-0" aria-hidden="true">
                          ↵
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-th-border text-[10px] text-th-text-2/40">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-th-bg-3 rounded border border-th-border">↑↓</kbd>
            {t("commandPalette.hintNavigate") || "navigate"}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-th-bg-3 rounded border border-th-border">↵</kbd>
            {t("commandPalette.hintSelect") || "select"}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-th-bg-3 rounded border border-th-border">esc</kbd>
            {t("commandPalette.hintClose") || "close"}
          </span>
        </div>
      </div>
    </div>
  );
}
