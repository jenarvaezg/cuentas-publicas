import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SparklineChart } from "./SparklineChart";

export interface SourceDetail {
  name: string;
  url?: string;
  date?: string;
  note?: string;
}

interface StatCardProps {
  label: string;
  value: string;
  trend?: { value: number; label: string };
  sparklineData?: number[];
  sources?: SourceDetail[];
  className?: string;
  delay?: number;
}

export const StatCard = memo(function StatCard({
  label,
  value,
  trend,
  sparklineData,
  sources,
  className,
  delay = 0,
}: StatCardProps) {
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
          <div className="text-sm font-medium text-muted-foreground mb-1">{label}</div>
          <div className="text-3xl font-bold">{value}</div>

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
              {sources.map((src) => (
                <div
                  key={src.name ?? src.note ?? src.url}
                  className="text-[10px] leading-tight text-muted-foreground/70 text-center"
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
                  {src.date && <span> ({src.date})</span>}
                  {src.note && <span> — {src.note}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
