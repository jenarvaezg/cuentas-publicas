import { ArrowDown, ArrowUp, ExternalLink, Info } from "lucide-react";
import { memo, useId, useMemo } from "react";
import CountUp from "react-countup";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SourceDetail } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { SparklineChart } from "./SparklineChart";
import { TiltCard } from "./TiltCard";

export type { SourceDetail };

interface StatCardProps {
  label: string;
  value: string;
  tooltip?: string;
  insight?: string;
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
  insight,
  trend,
  sparklineData,
  sources,
  className,
  delay = 0,
}: StatCardProps) {
  const { msg } = useI18n();
  const infoDialogId = useId();
  const hasInfo = Boolean(tooltip) || Boolean(sources?.length);

  const copy = msg.blocks.statCard;

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
  const primarySource = sources?.[0];
  const primarySourceDate = primarySource?.realDataDate || primarySource?.date;
  const additionalSourcesCount = Math.max(0, (sources?.length ?? 0) - 1);
  const trendValue = trend?.value;
  const sparkline = useMemo(() => {
    if (sparklineData?.length) {
      if (sparklineData.length === 1) {
        return { data: [sparklineData[0], sparklineData[0]], placeholder: false };
      }
      return { data: sparklineData, placeholder: false };
    }

    const seed = Array.from(label).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const points = 16;
    const base = 48 + (seed % 12);
    const defaultSlope = ((seed % 5) - 2) * 0.03;
    const trendSlope =
      trendValue != null ? Math.max(-0.35, Math.min(0.35, trendValue / 150)) : defaultSlope;
    const data = Array.from({ length: points }, (_, idx) => {
      const x = points > 1 ? idx / (points - 1) : 0;
      const wave = Math.sin((x * 2 + (seed % 6)) * Math.PI) * 0.45;
      const drift = (x - 0.5) * trendSlope * 8;
      return base + wave + drift;
    });
    return { data, placeholder: true };
  }, [label, sparklineData, trendValue]);

  return (
    <TiltCard
      className={cn("min-w-0 animate-slide-up", className)}
      style={{ animationDelay: `${delay}s` }}
    >
      <Card className="h-full transition-shadow hover:shadow-xl duration-300">
        <CardContent className="pt-6 text-center h-full">
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="text-sm font-medium text-muted-foreground">{label}</div>
              {hasInfo && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-controls={infoDialogId}
                      className="text-muted-foreground/50 hover:text-foreground transition-colors"
                    >
                      <Info className="h-3.5 w-3.5" />
                      <span className="sr-only">{msg.common.moreInformation}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    id={infoDialogId}
                    side="bottom"
                    align="center"
                    sideOffset={8}
                    className="z-50 w-96 max-w-[calc(100vw-1rem)] max-h-[400px] overflow-y-auto rounded-2xl border border-white/5 bg-card/80 backdrop-blur-2xl p-5 shadow-2xl"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                          {copy.summaryTitle}
                        </p>
                        <h3 id={`${infoDialogId}-title`} className="text-base font-semibold mt-1">
                          {label}
                        </h3>
                      </div>
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
                                <li
                                  key={`dialog-${src.name}-${src.url}-${src.note}`}
                                  className="text-sm"
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
                                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                      </a>
                                    ) : (
                                      <span>{src.name}</span>
                                    )}
                                  </span>
                                  {shownDate && (
                                    <span className="text-muted-foreground ml-1">
                                      ({shownDate})
                                    </span>
                                  )}
                                  {src.note && (
                                    <p className="text-xs text-muted-foreground/80 mt-0.5 border-l-2 border-border/50 pl-2">
                                      {src.note}
                                    </p>
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
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div className="text-3xl font-bold flex flex-col items-center gap-1 break-words overflow-hidden max-w-full font-mono">
              {(() => {
                // Intenta parsear automatically un string tipo "1.583.000 M€" o "12,3 %"
                const match = value.match(/^([\D]*?)([-]?\d[\d.,]*)([\D]*)$/);
                if (match) {
                  const [, prefix, numStr, suffix] = match;
                  // Verificar si usa coma como decimal o punto
                  const isDecimalComma = numStr.includes(",") && numStr.split(",")[1]?.length <= 2;
                  const normalizeNumStr = isDecimalComma
                    ? numStr.replace(/\./g, "").replace(",", ".")
                    : numStr.replace(/,/g, "");
                  const num = parseFloat(normalizeNumStr);

                  if (!Number.isNaN(num)) {
                    return (
                      <CountUp
                        end={num}
                        duration={2}
                        decimals={
                          isDecimalComma
                            ? numStr.split(",")[1]?.length
                            : numStr.includes(".")
                              ? numStr.split(".")[1]?.length
                              : 0
                        }
                        decimal={isDecimalComma ? "," : "."}
                        separator={isDecimalComma ? "." : ","}
                        prefix={prefix}
                        suffix={suffix}
                        useEasing={true}
                      />
                    );
                  }
                }
                return value;
              })()}
              {staleYear && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 uppercase tracking-tight font-sans">
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

            {sparkline.data.length > 0 && (
              <div className="pt-2 flex justify-center">
                <SparklineChart
                  data={sparkline.data}
                  color={sparkline.placeholder ? "hsl(var(--muted-foreground))" : undefined}
                  placeholder={sparkline.placeholder}
                />
              </div>
            )}

            {insight && (
              <p className="mt-3 rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-left text-xs leading-relaxed text-muted-foreground">
                {insight}
              </p>
            )}

            {sources && sources.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs leading-snug text-muted-foreground/85 text-center">
                  <span className="font-medium">{copy.sourceInlineLabel}: </span>
                  {primarySource?.url ? (
                    <a
                      href={primarySource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground transition-colors inline-flex items-center gap-0.5"
                    >
                      {primarySource.name}
                      <ExternalLink className="h-2 w-2" aria-hidden="true" />
                    </a>
                  ) : (
                    <span>{primarySource?.name}</span>
                  )}
                  {primarySourceDate && <span> ({primarySourceDate})</span>}
                  {additionalSourcesCount > 0 && (
                    <span>
                      {" "}
                      · +{additionalSourcesCount} {copy.sourceInlineMore}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TiltCard>
  );
});
