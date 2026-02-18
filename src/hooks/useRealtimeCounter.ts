import { useCallback, useEffect, useRef } from "react";
import { formatNumber } from "@/utils/formatters";

interface UseRealtimeCounterOptions {
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

interface RealtimeCounterRefs {
  displayRef: React.RefObject<HTMLSpanElement | null>;
  ariaRef: React.RefObject<HTMLSpanElement | null>;
}

export function useRealtimeCounter(
  baseValue: number,
  perSecond: number,
  options: UseRealtimeCounterOptions = {},
): RealtimeCounterRefs {
  const displayRef = useRef<HTMLSpanElement | null>(null);
  const ariaRef = useRef<HTMLSpanElement | null>(null);
  const startTimeRef = useRef(Date.now());
  const baseValueRef = useRef(baseValue);
  const rafRef = useRef<number>(0);
  const lastAriaUpdateRef = useRef(0);

  const prefersReducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const { prefix = "", suffix = "", decimals = 0 } = options;

  const updateDisplay = useCallback(() => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const currentValue = baseValueRef.current + perSecond * elapsed;
    const formatted = `${prefix}${formatNumber(currentValue, decimals)}${suffix}`;

    if (displayRef.current) {
      displayRef.current.textContent = formatted;
    }

    const now = Date.now();
    if (now - lastAriaUpdateRef.current >= 5000) {
      lastAriaUpdateRef.current = now;
      if (ariaRef.current) {
        ariaRef.current.textContent = formatted;
      }
    }

    if (!prefersReducedMotion.current) {
      rafRef.current = requestAnimationFrame(updateDisplay);
    }
  }, [perSecond, prefix, suffix, decimals]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    baseValueRef.current = baseValue;

    const initialFormatted = `${prefix}${formatNumber(baseValue, decimals)}${suffix}`;
    if (displayRef.current) {
      displayRef.current.textContent = initialFormatted;
    }
    if (ariaRef.current) {
      ariaRef.current.textContent = initialFormatted;
    }
    lastAriaUpdateRef.current = Date.now();

    if (!prefersReducedMotion.current) {
      rafRef.current = requestAnimationFrame(updateDisplay);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [baseValue, updateDisplay, prefix, suffix, decimals]);

  return { displayRef, ariaRef };
}
