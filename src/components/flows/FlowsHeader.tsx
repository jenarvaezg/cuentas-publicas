import { Info } from "lucide-react";
import type React from "react";
import { PersonalCalculator, type SpendingCategory } from "@/components/PersonalCalculator";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";

export interface FlowsHeaderCopy {
  title: string;
  description: string;
  scopeLabel: string;
  allSpain: string;
  yearLabel: string;
  excludeRegionGroup: string;
  clearExclusions: string;
  whatIfUnavailable: string;
  whatIfInfo: string;
  whatIfMethodology: string;
  resetView: string;
  populationLabel: string;
}

export interface CcaaOption {
  value: string;
  label: string;
}

interface FlowsHeaderProps {
  copy: FlowsHeaderCopy;
  scope: string;
  selectedYear: number;
  years: number[];
  latestYear: number;
  ccaaOptions: CcaaOption[];
  ccaaPopulation: number | null;
  selectedCcaaName: string | null;
  excludedRegions: string[];
  whatIfAvailable: boolean;
  spendingCategories: SpendingCategory[];
  totalSpending: number;
  lang: string;
  onScopeChange: (scope: string) => void;
  onYearChange: (year: number) => void;
  onExcludedRegionsChange: (updater: (prev: string[]) => string[]) => void;
  onClearExclusions: () => void;
}

export const FlowsHeader: React.FC<FlowsHeaderProps> = ({
  copy,
  scope,
  selectedYear,
  years,
  latestYear,
  ccaaOptions,
  ccaaPopulation,
  selectedCcaaName,
  excludedRegions,
  whatIfAvailable,
  spendingCategories,
  totalSpending,
  lang,
  onScopeChange,
  onYearChange,
  onExcludedRegionsChange,
  onClearExclusions,
}) => {
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-2xl">{copy.title}</CardTitle>
          <CardDescription className="text-base mt-2">{copy.description}</CardDescription>
        </div>
      </div>

      {/* Scope selector */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">{copy.scopeLabel}</span>
        <select
          value={scope}
          onChange={(e) => onScopeChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="national">{copy.allSpain}</option>
          {ccaaOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Per-capita indicator when a single CCAA is selected */}
        {scope !== "national" && selectedCcaaName && ccaaPopulation && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            {copy.populationLabel}:{" "}
            {new Intl.NumberFormat(lang === "en" ? "en-GB" : "es-ES").format(ccaaPopulation)}
          </span>
        )}
      </div>

      {/* Year selector */}
      <div className="mt-4">
        <span className="text-sm font-medium text-muted-foreground mr-3">{copy.yearLabel}</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {years.map((year) => {
            const disabled = scope !== "national" && year !== latestYear;
            return (
              <button
                type="button"
                key={year}
                disabled={disabled}
                onClick={() => onYearChange(year)}
                className={`
                  px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 border
                  ${
                    disabled
                      ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
                      : year === selectedYear
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-foreground hover:bg-muted"
                  }
                `}
              >
                {year}
              </button>
            );
          })}
        </div>
      </div>

      {/* What-If section: only visible in national scope */}
      {scope === "national" && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {copy.excludeRegionGroup}
            </span>
            {excludedRegions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearExclusions}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                {copy.clearExclusions}
              </Button>
            )}
          </div>

          {!whatIfAvailable && (
            <p className="text-xs text-muted-foreground/70 italic mb-2">{copy.whatIfUnavailable}</p>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            {ccaaOptions.map((opt) => {
              const isExcluded = excludedRegions.includes(opt.value);
              return (
                <button
                  type="button"
                  key={opt.value}
                  disabled={!whatIfAvailable}
                  onClick={() => {
                    onExcludedRegionsChange((prev) =>
                      prev.includes(opt.value)
                        ? prev.filter((r) => r !== opt.value)
                        : [...prev, opt.value],
                    );
                  }}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border
                    ${
                      !whatIfAvailable
                        ? "opacity-50 cursor-not-allowed"
                        : isExcluded
                          ? "bg-destructive/10 border-destructive/20 text-destructive line-through decoration-destructive/50"
                          : "bg-background border-border text-foreground hover:bg-muted"
                    }
                  `}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {whatIfAvailable && (
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground inline-flex items-center gap-1">
                <Info className="w-3 h-3" />
                {copy.whatIfMethodology}
              </summary>
              <p className="mt-2 leading-relaxed bg-muted/30 rounded-md p-3">{copy.whatIfInfo}</p>
            </details>
          )}
        </div>
      )}

      <PersonalCalculator spendingCategories={spendingCategories} totalSpending={totalSpending} />
    </>
  );
};
