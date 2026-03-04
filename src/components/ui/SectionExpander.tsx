import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

interface SectionExpanderProps {
  id: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

const STORAGE_PREFIX = "section-expander-";

export function SectionExpander({
  id,
  count,
  children,
  defaultOpen = false,
  className,
}: SectionExpanderProps) {
  const { lang } = useI18n();

  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return defaultOpen;
    const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${id}`);
    return stored !== null ? stored === "true" : defaultOpen;
  });

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionStorage.setItem(`${STORAGE_PREFIX}${id}`, String(isOpen));
  }, [id, isOpen]);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const label = isOpen
    ? lang === "en"
      ? "Show less"
      : "Ver menos"
    : lang === "en"
      ? `Full analysis${count ? ` (${count} more)` : ""}`
      : `Ver análisis completo${count ? ` (${count} más)` : ""}`;

  return (
    <div className={className}>
      <div
        ref={contentRef}
        className={cn(
          "grid transition-[grid-template-rows] duration-500 ease-in-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
      <button
        type="button"
        onClick={toggle}
        className="w-full mt-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground border-t border-dashed border-border/60 transition-colors flex items-center justify-center gap-2"
      >
        <span>{label}</span>
        <svg
          className={cn("h-4 w-4 transition-transform duration-300", isOpen && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
