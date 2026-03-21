"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface DisplayModeReturn {
  isDisplayMode: boolean;
  enterDisplayMode: () => void;
  exitDisplayMode: () => void;
}

const SESSION_KEY = "leanpilot_display_mode";

export function useDisplayMode(): DisplayModeReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const paramActive = searchParams.get("display") === "true";
  const [isDisplayMode, setIsDisplayMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return paramActive || sessionStorage.getItem(SESSION_KEY) === "true";
  });

  // Sync with URL param changes
  useEffect(() => {
    if (paramActive && !isDisplayMode) {
      setIsDisplayMode(true);
      sessionStorage.setItem(SESSION_KEY, "true");
    }
  }, [paramActive, isDisplayMode]);

  const enterDisplayMode = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("display", "true");
    router.replace(`${pathname}?${params.toString()}`);
    sessionStorage.setItem(SESSION_KEY, "true");
    setIsDisplayMode(true);

    // Request fullscreen
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      }
    } catch {
      // Fullscreen may not be available
    }
  }, [searchParams, router, pathname]);

  const exitDisplayMode = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("display");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    sessionStorage.removeItem(SESSION_KEY);
    setIsDisplayMode(false);

    // Exit fullscreen
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Ignore
    }
  }, [searchParams, router, pathname]);

  // Listen for Escape key to exit display mode
  useEffect(() => {
    if (!isDisplayMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        exitDisplayMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDisplayMode, exitDisplayMode]);

  // Sync when fullscreen is exited via browser controls
  useEffect(() => {
    if (!isDisplayMode) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isDisplayMode) {
        exitDisplayMode();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isDisplayMode, exitDisplayMode]);

  return { isDisplayMode, enterDisplayMode, exitDisplayMode };
}
