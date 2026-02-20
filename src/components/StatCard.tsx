import { ArrowDown, ArrowUp, ExternalLink, Info } from "lucide-react";
import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const { msg } = useI18n();
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

  return (
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
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground/50 hover:text-foreground transition-colors"
                  >
                    <Info className="h-3.5 w-3.5" />
                    <span className="sr-only">{msg.common.moreInformation}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[200px] text-center">{tooltip}</TooltipContent>
              </Tooltip>
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
  );
});
