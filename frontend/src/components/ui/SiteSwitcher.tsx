"use client";
import { useState, useRef, useEffect } from "react";
import { useSite } from "@/stores/useSite";
import { useI18n } from "@/stores/useI18n";
import { Building2, ChevronDown, Globe, Check } from "lucide-react";

interface SiteSwitcherProps {
  /** Whether user has corporate/org-level access */
  hasCorpAccess?: boolean;
}

export default function SiteSwitcher({ hasCorpAccess = false }: SiteSwitcherProps) {
  const { t } = useI18n();
  const { sites, activeSiteId, isCorpView, setActiveSite } = useSite();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (sites.length <= 1 && !hasCorpAccess) return null;

  const activeSite = sites.find((s) => s.id === activeSiteId);
  const displayName = isCorpView
    ? (t("common.allSites") || "All Sites")
    : activeSite
      ? activeSite.name
      : (t("common.switchSite") || "Select Site");
  const displayCode = isCorpView ? null : activeSite?.site_code;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-th-bg-hover hover:bg-th-border text-th-text text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("common.switchSite") || "Switch Site"}
      >
        {isCorpView ? (
          <Globe size={15} className="text-blue-500 shrink-0" />
        ) : (
          <Building2 size={15} className="text-th-text-3 shrink-0" />
        )}
        <span className="truncate max-w-[140px]">{displayName}</span>
        {displayCode && (
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-600 dark:text-brand-400 leading-none shrink-0">
            {displayCode}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`text-th-text-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1 w-64 bg-th-card border border-th-border rounded-xl shadow-lg z-50 py-1 overflow-hidden"
          role="menu"
          aria-label={t("common.switchSite") || "Switch Site"}
        >
          {/* All Sites option */}
          {hasCorpAccess && (
            <>
              <button
                role="menuitem"
                aria-current={isCorpView ? "true" : undefined}
                onClick={() => {
                  setActiveSite(null);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isCorpView
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "text-th-text hover:bg-th-bg-hover"
                }`}
              >
                <Globe size={16} className="text-blue-500 shrink-0" />
                <span className="flex-1 text-left font-medium">
                  {t("common.allSites") || "All Sites"}
                </span>
                {isCorpView && <Check size={15} className="text-blue-500 shrink-0" />}
              </button>
              <div className="border-t border-th-border my-1" />
            </>
          )}

          {/* Individual sites */}
          {sites.map((site) => {
            const isActive = !isCorpView && activeSiteId === site.id;
            return (
              <button
                key={site.id}
                role="menuitem"
                aria-current={isActive ? "true" : undefined}
                onClick={() => {
                  setActiveSite(site.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                    : "text-th-text hover:bg-th-bg-hover"
                }`}
              >
                <Building2 size={16} className="text-th-text-3 shrink-0" />
                <div className="flex-1 min-w-0 text-left">
                  <div className="truncate font-medium">{site.name}</div>
                  {site.location && <div className="text-[10px] text-th-text-3">{site.location}</div>}
                </div>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-th-bg-hover text-th-text-2 leading-none shrink-0">
                  {site.site_code}
                </span>
                {isActive && <Check size={15} className="text-brand-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
