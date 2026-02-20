import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDate } from "@/utils/formatters";
import { LanguageToggle } from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

export function Header() {
  const { meta } = useData();
  const { msg } = useI18n();

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
        <p className="mt-3 text-sm text-muted-foreground/85">
          {msg.header.sourcesPrefix} {formatDate(meta.lastDownload)}
        </p>
      </div>
    </header>
  );
}
