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
  sm: "text-base sm:text-lg",
  md: "text-[clamp(1.2rem,2.1vw,1.9rem)]",
  lg: "text-[clamp(1.3rem,2.4vw,2.15rem)]",
  xl: "text-[clamp(1.15rem,2.2vw,2rem)]",
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
    <div className={cn("flex w-full flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "w-full max-w-full text-center font-semibold tabular-nums leading-tight tracking-tight",
          sizeClasses[size],
        )}
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
