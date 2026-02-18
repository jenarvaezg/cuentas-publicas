import { useRealtimeCounter } from "@/hooks/useRealtimeCounter";
import { cn } from "@/lib/utils";

interface RealtimeCounterProps {
  baseValue: number;
  perSecond: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  className?: string;
}

const sizeClasses = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-2xl md:text-3xl",
  xl: "text-xl sm:text-2xl lg:text-3xl",
};

export function RealtimeCounter({
  baseValue,
  perSecond,
  prefix,
  suffix,
  decimals = 0,
  size = "md",
  label,
  className,
}: RealtimeCounterProps) {
  const { displayRef, ariaRef } = useRealtimeCounter(baseValue, perSecond, {
    prefix,
    suffix,
    decimals,
  });

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn("font-mono font-bold tabular-nums whitespace-nowrap", sizeClasses[size])}
        style={{ fontVariantNumeric: "tabular-nums" }}
        aria-hidden="true"
      >
        <span ref={displayRef} />
      </div>
      <span ref={ariaRef} className="sr-only" aria-live="polite" />
      {label && <div className="text-sm text-muted-foreground text-center">{label}</div>}
    </div>
  );
}
