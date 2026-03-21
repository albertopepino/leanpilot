import { useState, useEffect, useRef } from "react";

/**
 * Animates a number from 0 to `target` using requestAnimationFrame with easeOutQuart easing.
 *
 * @param target  – the value to count up to
 * @param options.duration  – animation length in ms (default 800)
 * @param options.decimals  – decimal places to round to (default 0)
 * @param options.enabled   – set false to skip animation and return target immediately
 */
export function useCountUp(
  target: number,
  options?: { duration?: number; decimals?: number; enabled?: boolean },
): number {
  const { duration = 800, decimals = 0, enabled = true } = options ?? {};
  const [value, setValue] = useState(enabled ? 0 : target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const prevTarget = useRef(target);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    // Reset when target changes
    const from = prevTarget.current !== target ? 0 : value;
    prevTarget.current = target;

    if (target === 0) {
      setValue(0);
      return;
    }

    startRef.current = null;

    const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);

    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);
      const current = from + (target - from) * easedProgress;

      const factor = Math.pow(10, decimals);
      setValue(Math.round(current * factor) / factor);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, decimals, enabled]);

  return value;
}
