import { ArrowDown, ArrowUp, ExternalLink, Info, X } from "lucide-react";
import { memo, useEffect, useId, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { SparklineChart } from "./SparklineChart";

export interface SourceDetail {
  name: string;
  url?: string;
  date?: string;
  realDataDate?: string;
  note?: string;
}

interface StatCardProps {
  label: string;
  value: string;
  tooltip?: string;
  trend?: { value: number; label: string };
  sparklineData?: number[];
  sources?: SourceDetail[];
  className?: string;
  delay?: number;
}

export const StatCard = memo(function StatCard({
  label,
  value,
  tooltip,
  trend,
  sparklineData,
  sources,
  className,
  delay = 0,
}: StatCardProps) {
  const { msg, lang } = useI18n();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const infoDialogId = useId();
  const hasInfo = Boolean(tooltip) || Boolean(sources?.length);

  const copy =
    lang === "en"
      ? {
          summaryTitle: "Metric details",
          whatIs: "What it is",
          howComputed: "How it's computed",
          whyMatters: "Why it matters",
          sourcesTitle: "Sources",
          close: "Close",
          noSources: "No linked source details for this metric.",
          fallbackWhatPrefix: "This metric tracks",
          fallbackComputed: "Direct value from official sources, without additional calculation.",
          fallbackRelevance:
            "It helps understand fiscal trends and compare this indicator over time with other public figures.",
        }
      : {
          summaryTitle: "Detalle de la métrica",
          whatIs: "Qué es",
          howComputed: "Cómo se calcula",
          whyMatters: "Por qué importa",
          sourcesTitle: "Fuentes",
          close: "Cerrar",
          noSources: "No hay detalle de fuentes vinculado para esta métrica.",
          fallbackWhatPrefix: "Este indicador muestra",
          fallbackComputed: "Valor directo de fuentes oficiales, sin cálculo adicional.",
          fallbackRelevance:
            "Ayuda a entender la evolución fiscal y comparar este indicador en el tiempo con otras magnitudes públicas.",
        };

  const whatIsText = tooltip ?? `${copy.fallbackWhatPrefix} ${label.toLowerCase()}.`;

  const computedText = useMemo(() => {
    if (!sources?.length) return copy.fallbackComputed;
    const derivedSource = sources.find((source) => /calculo|cálculo|derived/i.test(source.name));
    if (derivedSource?.note) return derivedSource.note;
    const sourceWithNote = sources.find((source) => Boolean(source.note));
    return sourceWithNote?.note ?? copy.fallbackComputed;
  }, [copy.fallbackComputed, sources]);

  // C4: Check for stale data (> 1 year old) in sources
  const staleSource = sources?.find((src) => {
    const sourceDate = src.realDataDate || src.date;
    if (!sourceDate) return false;
    const date = new Date(sourceDate);
    if (Number.isNaN(date.getTime())) return false;
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return date < oneYearAgo;
  });

  const staleDate = staleSource?.realDataDate || staleSource?.date;
  const staleYear = staleDate ? new Date(staleDate).getFullYear() : null;

  useEffect(() => {
    if (!isInfoOpen || typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsInfoOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isInfoOpen]);

  useEffect(() => {
    if (!isInfoOpen || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isInfoOpen]);

  return (
    <>
      <Card
        className={cn(
          "animate-slide-up hover:shadow-lg transition-all duration-300 hover:-translate-y-1",
          className,
        )}
        style={{ animationDelay: `${delay}s` }}
      >
        <CardContent className="pt-6 text-center">
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="text-sm font-medium text-muted-foreground">{label}</div>
              {hasInfo && (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={isInfoOpen}
                  aria-controls={infoDialogId}
                  onClick={() => setIsInfoOpen(true)}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <Info className="h-3.5 w-3.5" />
                  <span className="sr-only">{msg.common.moreInformation}</span>
                </button>
              )}
            </div>
            <div className="text-3xl font-bold flex flex-col items-center gap-1">
              {value}
              {staleYear && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 uppercase tracking-tight">
                  {`${msg.common.staleDataTagPrefix} ${staleYear}`}
                </span>
              )}
            </div>

            {trend && (
              <div
                className={cn(
                  "flex items-center justify-center gap-1 text-sm font-medium",
                  trend.value >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {trend.value >= 0 ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
                <span>{trend.label}</span>
              </div>
            )}

            {sparklineData && sparklineData.length > 0 && (
              <div className="pt-2 flex justify-center">
                <SparklineChart data={sparklineData} />
              </div>
            )}

            {sources && sources.length > 0 && (
              <div className="pt-2 border-t border-border/50 space-y-1">
                {sources.map((src) => {
                  const shownDate = src.realDataDate || src.date;
                  return (
                    <div
                      key={src.name ?? src.note ?? src.url}
                      className="text-xs leading-snug text-muted-foreground/85 text-center"
                    >
                      <span className="font-medium">
                        {src.url ? (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-foreground transition-colors inline-flex items-center gap-0.5"
                          >
                            {src.name}
                            <ExternalLink className="h-2 w-2" />
                          </a>
                        ) : (
                          src.name
                        )}
                      </span>
                      {shownDate && <span> ({shownDate})</span>}
                      {src.note && <span> — {src.note}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {hasInfo && isInfoOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-6 flex items-end sm:items-center justify-center">
          <button
            type="button"
            onClick={() => setIsInfoOpen(false)}
            className="absolute inset-0 h-full w-full bg-transparent border-0 p-0"
            aria-label={copy.close}
          />
          <div
            id={infoDialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${infoDialogId}-title`}
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border bg-card p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  {copy.summaryTitle}
                </p>
                <h3 id={`${infoDialogId}-title`} className="text-base font-semibold mt-1">
                  {label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={copy.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <section>
                <h4 className="font-semibold">{copy.whatIs}</h4>
                <p className="mt-1 text-muted-foreground">{whatIsText}</p>
              </section>

              <section>
                <h4 className="font-semibold">{copy.howComputed}</h4>
                <p className="mt-1 text-muted-foreground">{computedText}</p>
              </section>

              <section>
                <h4 className="font-semibold">{copy.whyMatters}</h4>
                <p className="mt-1 text-muted-foreground">{copy.fallbackRelevance}</p>
              </section>

              <section>
                <h4 className="font-semibold">{copy.sourcesTitle}</h4>
                {sources && sources.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {sources.map((src) => {
                      const shownDate = src.realDataDate || src.date;
                      return (
                        <li key={`dialog-${src.name}-${src.url}-${src.note}`} className="text-sm">
                          <span className="font-medium">
                            {src.url ? (
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground transition-colors inline-flex items-center gap-0.5"
                              >
                                {src.name}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              src.name
                            )}
                          </span>
                          {shownDate && (
                            <span className="text-muted-foreground"> ({shownDate})</span>
                          )}
                          {src.note && (
                            <p className="text-xs text-muted-foreground mt-0.5">{src.note}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-1 text-muted-foreground">{copy.noSources}</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
