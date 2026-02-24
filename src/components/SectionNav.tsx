import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { getSearchParam, updateSectionInUrl } from "@/utils/url-state";

export interface SectionNavItem {
  id: string;
  label: string;
}

export interface SectionNavGroup {
  id: string;
  label: string;
  items: SectionNavItem[];
}

interface SectionNavProps {
  groups: SectionNavGroup[];
}

export function SectionNav({ groups }: SectionNavProps) {
  const { msg } = useI18n();
  const sectionIds = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => item.id)),
    [groups],
  );
  const sectionToGroup = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const item of group.items) {
        map.set(item.id, group.id);
      }
    }
    return map;
  }, [groups]);

  const [activeId, setActiveId] = useState(sectionIds[0] ?? "");
  const activeGroupId = sectionToGroup.get(activeId) ?? groups[0]?.id ?? "";
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];

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
    updateSectionInUrl(activeId, { notify: false });
  }, [activeId]);

  const navigateToSection = (sectionId: string) => {
    setActiveId(sectionId);
    updateSectionInUrl(sectionId);

    if (typeof window !== "undefined") {
      const sectionElement = document.getElementById(sectionId);
      sectionElement?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav
      className="sticky top-0 z-30 border-y border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label={msg.common.sectionNavigationAria}
    >
      <div className="max-w-5xl mx-auto px-4 py-3 space-y-2.5">
        <ul className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => {
                  const targetId = group.items.some((item) => item.id === activeId)
                    ? activeId
                    : group.items[0]?.id;

                  if (!targetId) return;
                  navigateToSection(targetId);
                }}
                className={cn(
                  "inline-flex whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  activeGroupId === group.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/45 hover:text-foreground",
                )}
              >
                {group.label}
              </button>
            </li>
          ))}
        </ul>

        {activeGroup && (
          <ul className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {activeGroup.items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    navigateToSection(item.id);
                  }}
                  className={cn(
                    "inline-flex whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    activeId === item.id
                      ? "border-primary/65 bg-primary/10 text-foreground"
                      : "border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
