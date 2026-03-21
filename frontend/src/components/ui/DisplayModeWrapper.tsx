"use client";
import { Suspense, useEffect, useState, useRef, type ReactNode } from "react";
import { useDisplayMode } from "@/hooks/useDisplayMode";
import { useI18n } from "@/stores/useI18n";
import DisplayModeToggle from "./DisplayModeToggle";

interface DisplayModeWrapperProps {
  children: ReactNode;
  title: string;
  refreshInterval?: number;
  metrics?: ReactNode;
}

export default function DisplayModeWrapper(props: DisplayModeWrapperProps) {
  return (
    <Suspense fallback={<>{props.children}</>}>
      <DisplayModeWrapperInner {...props} />
    </Suspense>
  );
}

function DisplayModeWrapperInner({
  children,
  title,
  refreshInterval = 30,
  metrics,
}: DisplayModeWrapperProps) {
  const { isDisplayMode, exitDisplayMode } = useDisplayMode();
  const { t } = useI18n();
  const [clock, setClock] = useState(() => new Date());
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date());
  const [showExitBtn, setShowExitBtn] = useState(true);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clock tick every second in display mode
  useEffect(() => {
    if (!isDisplayMode) return;
    const iv = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(iv);
  }, [isDisplayMode]);

  // Auto-refresh timer
  useEffect(() => {
    if (!isDisplayMode) return;
    setLastRefreshed(new Date());
    refreshTimerRef.current = setInterval(() => {
      setLastRefreshed(new Date());
      // Trigger a page-level re-render by dispatching a custom event
      window.dispatchEvent(new CustomEvent("display-mode-refresh"));
    }, refreshInterval * 1000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [isDisplayMode, refreshInterval]);

  // Fade exit button after 5 seconds, show on mouse move
  useEffect(() => {
    if (!isDisplayMode) return;
    setShowExitBtn(true);

    const schedFade = () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => setShowExitBtn(false), 5000);
    };

    const handleMouseMove = () => {
      setShowExitBtn(true);
      schedFade();
    };

    schedFade();
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchstart", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchstart", handleMouseMove);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [isDisplayMode]);

  // Add body class to hide sidebar in display mode
  useEffect(() => {
    if (isDisplayMode) {
      document.body.classList.add("display-mode-active");
    } else {
      document.body.classList.remove("display-mode-active");
    }
    return () => {
      document.body.classList.remove("display-mode-active");
    };
  }, [isDisplayMode]);

  if (!isDisplayMode) {
    return (
      <div className="relative">
        <div className="absolute top-0 right-0 z-10">
          <DisplayModeToggle />
        </div>
        {children}
      </div>
    );
  }

  // Display mode rendering
  return (
    <div className="fixed inset-0 z-[9999] bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight display-mode-header truncate mr-2" title={title}>
          {title}
        </h1>
        <div className="flex items-center gap-2 sm:gap-6 shrink-0">
          <span className="hidden md:inline text-sm text-gray-400">
            {t("common.lastRefreshed") || "Last refreshed"}: {lastRefreshed.toLocaleTimeString()}
          </span>
          <span className="hidden lg:inline text-sm text-gray-500">
            {t("common.autoRefresh") || "Auto-refresh"}: {refreshInterval}s
          </span>
          <span className="text-base sm:text-xl font-mono text-gray-300 tabular-nums">
            {clock.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-3 sm:p-6 display-mode-content">
        {children}
      </div>

      {/* Optional metrics footer */}
      {metrics && (
        <div className="px-6 py-3 bg-gray-900 border-t border-gray-800 shrink-0">
          {metrics}
        </div>
      )}

      {/* Exit button - fades after 5s */}
      <button
        onClick={exitDisplayMode}
        className={`fixed top-4 right-4 z-[10000] px-3 py-1.5 rounded-lg bg-gray-800/80 text-gray-300 text-sm font-medium border border-gray-700 hover:bg-gray-700 hover:text-white transition-all duration-500 ${
          showExitBtn ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {t("common.exitDisplay") || "Exit Display"}
      </button>

      {/* Display mode styles */}
      <style>{`
        .display-mode-active aside,
        .display-mode-active [data-mobile-nav],
        .display-mode-active [aria-label="Main navigation sidebar"],
        .display-mode-active [aria-label="Navigation sidebar (collapsed)"] {
          display: none !important;
        }
        .display-mode-content {
          font-size: 18px;
        }
        .display-mode-content h1,
        .display-mode-content h2,
        .display-mode-content h3 {
          font-size: 24px;
        }
        .display-mode-header {
          font-size: 28px;
        }
        .display-mode-content .display-kpi {
          font-size: 48px;
          line-height: 1.1;
        }
        .display-mode-content .display-kpi-giant {
          font-size: 64px;
          line-height: 1.1;
        }
      `}</style>
    </div>
  );
}
