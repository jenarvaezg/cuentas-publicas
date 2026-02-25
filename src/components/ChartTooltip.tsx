import type { ReactNode } from "react";

const TOOLTIP_CLASS =
  "bg-popover/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-xl text-sm";

interface ChartTooltipProps<T> {
  active?: boolean;
  payload?: Array<{ payload: T }>;
  label?: unknown;
  children: (payload: Array<{ payload: T }>, label: unknown) => ReactNode;
}

/**
 * Reusable glassmorphism tooltip shell for Recharts custom tooltips.
 * Handles the active/payload guard and provides the standard container styling.
 * Pass content as a render function via `children`.
 */
export function ChartTooltip<T>({ active, payload, label, children }: ChartTooltipProps<T>) {
  if (!active || !payload?.length) return null;
  return <div className={TOOLTIP_CLASS}>{children(payload, label)}</div>;
}
