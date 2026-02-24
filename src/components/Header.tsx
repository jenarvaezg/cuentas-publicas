import { useMemo } from "react";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDate } from "@/utils/formatters";
import { LanguageToggle } from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

const STALE_THRESHOLD_DAYS = 60;

function useDataFreshness(
  sources: Record<string, { lastRealDataDate?: string | null }> | undefined,
) {
  return useMemo(() => {
    if (!sources) return { isStale: false, staleCount: 0 };

    const now = Date.now();
    const threshold = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    const staleEntries: string[] = [];
    for (const [key, src] of Object.entries(sources)) {
      if (!src.lastRealDataDate) continue;
      const age = now - new Date(src.lastRealDataDate).getTime();
      if (age > threshold) {
        staleEntries.push(key);
      }
    }

    return {
      isStale: staleEntries.length > 0,
      staleCount: staleEntries.length,
    };
  }, [sources]);
}

export function Header() {
  const { meta } = useData();
  const { msg } = useI18n();
  const { isStale } = useDataFreshness(meta.sources);

  return (
    <header className="animate-fade-in border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
              {msg.header.eyebrow}
            </p>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-balance">
              {msg.header.title}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">{msg.header.subtitle}</p>
          </div>
          <div className="flex-shrink-0 pt-0.5 flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground/85">
          <span>
            {msg.header.sourcesPrefix} {formatDate(meta.lastDownload)}
          </span>
          {isStale ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
              {msg.freshness.staleWarning}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {msg.freshness.allFresh}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
