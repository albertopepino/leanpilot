import { useEffect, useRef } from "react";

/**
 * Traps focus within a container element while active.
 * Returns a ref to attach to the container div/dialog.
 * Focus is moved into the container on mount and restored on unmount.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(active = true) {
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    // Save currently focused element to restore later
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element inside
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const firstFocusable = container.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusables = container.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // Close on Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        container.dispatchEvent(new CustomEvent("focustrap:escape", { bubbles: true }));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keydown", handleEscape);
      // Restore focus
      previousFocusRef.current?.focus();
    };
  }, [active]);

  return containerRef;
}
