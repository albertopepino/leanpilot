import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";

export interface AutoSaveStatus {
  /** Current save state */
  state: "idle" | "saving" | "saved" | "error" | "unsaved";
  /** i18n key for the status indicator (e.g. "saving", "saved", "saveFailed", "unsavedChanges") */
  label: string;
  /** Timestamp string (HH:MM) of the last successful save */
  savedAt: string | null;
}

interface UseAutoSaveOptions {
  /** Debounce delay in ms (default 3000) */
  delay?: number;
  /** Enable/disable auto-save (default true) */
  enabled?: boolean;
}

/**
 * Debounced auto-save hook.
 *
 * Usage:
 *   const { status, forceSave } = useAutoSave(data, saveFn, { delay: 3000, enabled: true });
 *
 * Returns a status object for displaying "Saving..." / "Saved at HH:MM" / "Unsaved changes"
 * and adds a beforeunload handler when there are unsaved changes.
 */
export function useAutoSave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  options: UseAutoSaveOptions = {},
): { status: AutoSaveStatus; forceSave: () => void } {
  const { delay = 3000, enabled = true } = options;

  const [state, setState] = useState<AutoSaveStatus["state"]>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<T>(data);
  const saveFnRef = useRef(saveFn);
  const initialRef = useRef<T>(data);
  const mountedRef = useRef(true);
  const hasChangedRef = useRef(false);

  // Keep refs up to date
  saveFnRef.current = saveFn;

  // Detect changes
  useEffect(() => {
    const serialized = JSON.stringify(data);
    const initialSerialized = JSON.stringify(initialRef.current);
    const prevSerialized = JSON.stringify(dataRef.current);
    dataRef.current = data;

    // If data hasn't actually changed from last known state, skip
    if (serialized === prevSerialized) return;

    // If data returned to initial state, mark idle
    if (serialized === initialSerialized) {
      hasChangedRef.current = false;
      setState("idle");
      return;
    }

    hasChangedRef.current = true;
    setState("unsaved");

    if (!enabled) return;

    // Debounce the save
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      doSave(data);
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, delay, enabled]);

  const doSave = useCallback(async (saveData: T) => {
    if (!mountedRef.current) return;
    setState("saving");
    try {
      await saveFnRef.current(saveData);
      if (!mountedRef.current) return;
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setSavedAt(timeStr);
      setState("saved");
      hasChangedRef.current = false;
      initialRef.current = saveData;
    } catch {
      if (!mountedRef.current) return;
      setState("error");
    }
  }, []);

  const forceSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    doSave(dataRef.current);
  }, [doSave]);

  // beforeunload warning when unsaved
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChangedRef.current && (state === "unsaved" || state === "error")) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Label keys are returned for the calling component to translate via t().
  // Keys: "saving", "saved", "saveFailed", "unsavedChanges", "" (idle)
  const label = (() => {
    switch (state) {
      case "saving":
        return "saving";
      case "saved":
        return "saved";
      case "error":
        return "saveFailed";
      case "unsaved":
        return "unsavedChanges";
      default:
        return "";
    }
  })();

  return {
    status: { state, label, savedAt },
    forceSave,
  };
}

/**
 * AutoSaveIndicator - a small inline status indicator component.
 * Import and render in any component header area.
 */
export function AutoSaveIndicator({ status }: { status: AutoSaveStatus }) {
  const { t } = useI18n();

  if (status.state === "idle") return null;

  const styles: Record<AutoSaveStatus["state"], string> = {
    idle: "",
    saving: "text-blue-500",
    saved: "text-emerald-500",
    error: "text-red-500",
    unsaved: "text-amber-500",
  };

  const icons: Record<AutoSaveStatus["state"], string> = {
    idle: "",
    saving: "\u21BB", // ↻
    saved: "\u2713",  // ✓
    error: "\u26A0",  // ⚠
    unsaved: "\u25CF", // ●
  };

  // status.label is an i18n key (e.g. "saving", "saved", "saveFailed", "unsavedChanges")
  const base = status.label ? (t(`common.${status.label}`) || status.label) : "";
  const translatedLabel = status.state === "saved" && status.savedAt ? `${base} ${status.savedAt}` : base;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${styles[status.state]} transition-colors duration-300`}
    >
      <span className={status.state === "saving" ? "animate-spin" : ""}>
        {icons[status.state]}
      </span>
      {translatedLabel}
    </span>
  );
}
