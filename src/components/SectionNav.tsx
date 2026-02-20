import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { getSearchParam, updateSearchParams } from "@/utils/url-state";

export interface SectionNavItem {
  id: string;
  label: string;
}

interface SectionNavProps {
  items: SectionNavItem[];
}

export function SectionNav({ items }: SectionNavProps) {
  const { msg } = useI18n();
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  const sectionIds = useMemo(() => items.map((item) => item.id), [items]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sectionQuery = getSearchParam("section");
    if (sectionQuery && sectionIds.includes(sectionQuery)) {
      setActiveId(sectionQuery);
    }

    const hash = window.location.hash.replace("#", "");
    if (hash && sectionIds.includes(hash)) {
      setActiveId(hash);
    }
  }, [sectionIds]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;

    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-32% 0px -58% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    sections.forEach((section) => {
      observer.observe(section);
    });
    return () => observer.disconnect();
  }, [sectionIds]);

  useEffect(() => {
    if (!activeId) return;
    updateSearchParams({ section: activeId });
  }, [activeId]);

  return (
    <nav
      className="sticky top-0 z-30 border-y border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label={msg.common.sectionNavigationAria}
    >
      <div className="max-w-5xl mx-auto px-4 py-3">
        <ul className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={() => {
                  setActiveId(item.id);
                  updateSearchParams({ section: item.id });
                }}
                className={cn(
                  "inline-flex whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  activeId === item.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/45 hover:text-foreground",
                )}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
