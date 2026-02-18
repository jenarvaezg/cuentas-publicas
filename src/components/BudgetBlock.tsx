import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CALCULO_DERIVADO, fromAttribution, IGAE_COFOG } from "@/data/sources";
import type { BudgetCategory } from "@/data/types";
import { useData } from "@/hooks/useData";
import { useDeflator } from "@/hooks/useDeflator";
import { formatCompact, formatNumber, formatPercent } from "@/utils/formatters";
import { BudgetChart, type CompareMode } from "./BudgetChart";
import { StatCard } from "./StatCard";

function deflateCategory(
  cat: BudgetCategory,
  deflate: (amount: number, year: number) => number,
  year: number,
): BudgetCategory {
  const deflatedAmount = deflate(cat.amount, year);
  return {
    ...cat,
    amount: deflatedAmount,
    children: cat.children?.map((child) => deflateCategory(child, deflate, year)),
  };
}

export function BudgetBlock() {
  const { budget, demographics } = useData();
  const { deflate, baseYear, available: cpiAvailable } = useDeflator();

  const years = budget.years;
  const latestYear = budget.latestYear;

  const [selectedYear, setSelectedYear] = useState(latestYear);
  const [comparisonYear, setComparisonYear] = useState<number | null>(null);
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const [realTerms, setRealTerms] = useState(true);
  const [compareMode, setCompareMode] = useState<CompareMode>("absoluto");

  const yearData = budget.byYear[String(selectedYear)];
  const comparisonData = comparisonYear ? budget.byYear[String(comparisonYear)] : undefined;

  const isDeflating = realTerms && cpiAvailable && !!comparisonYear;

  // Apply deflation only when comparing in real terms
  const displayCategories = useMemo(() => {
    if (!yearData?.categories) return [];
    if (!isDeflating) return yearData.categories;
    return yearData.categories.map((cat) => deflateCategory(cat, deflate, selectedYear));
  }, [yearData, isDeflating, deflate, selectedYear]);

  const displayComparisonCategories = useMemo(() => {
    if (!comparisonData?.categories) return undefined;
    if (!isDeflating) return comparisonData.categories;
    return comparisonData.categories.map((cat) =>
      deflateCategory(cat, deflate, comparisonYear as number),
    );
  }, [comparisonData, comparisonYear, isDeflating, deflate]);

  // Stat cards — deflated only when comparing
  const displayTotal = useMemo(() => {
    if (!yearData?.total) return 0;
    if (!isDeflating) return yearData.total;
    return deflate(yearData.total, selectedYear);
  }, [yearData, isDeflating, deflate, selectedYear]);

  const totalEuros = displayTotal * 1_000_000;

  const perCapita = useMemo(() => {
    if (!demographics.population || !totalEuros) return 0;
    return totalEuros / demographics.population;
  }, [totalEuros, demographics.population]);

  const gdpRatio = useMemo(() => {
    if (!demographics.gdp || !totalEuros) return 0;
    return (totalEuros / demographics.gdp) * 100;
  }, [totalEuros, demographics.gdp]);

  const largestCategory = useMemo(() => {
    if (!displayCategories.length) return null;
    return displayCategories.reduce((max, cat) => (cat.amount > max.amount ? cat : max));
  }, [displayCategories]);

  // Source attributions
  const igaeSource = budget.sourceAttribution?.budget
    ? fromAttribution(budget.sourceAttribution.budget)
    : IGAE_COFOG;

  const euroLabel = isDeflating && baseYear ? `euros de ${baseYear}` : "euros corrientes";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>Gasto Público por Funciones (COFOG)</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            {cpiAvailable && comparisonYear && (
              <div className="flex items-center rounded-md border border-input bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => setRealTerms(true)}
                  className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                    realTerms
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  € reales
                </button>
                <button
                  type="button"
                  onClick={() => setRealTerms(false)}
                  className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                    !realTerms
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  € corrientes
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="budget-year"
                className="text-xs text-muted-foreground whitespace-nowrap"
              >
                Año
              </label>
              <select
                id="budget-year"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value));
                  setDrilldownCategory(null);
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {[...years].reverse().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="budget-compare"
                className="text-xs text-muted-foreground whitespace-nowrap"
              >
                Comparar
              </label>
              <select
                id="budget-compare"
                value={comparisonYear ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setComparisonYear(val ? Number(val) : null);
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">—</option>
                {[...years]
                  .reverse()
                  .filter((y) => y !== selectedYear)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Gasto publico total"
            value={formatCompact(totalEuros)}
            delay={0.05}
            sources={[igaeSource]}
          />
          <StatCard
            label="Gasto per cápita"
            value={`${formatNumber(perCapita, 0)} €`}
            delay={0.1}
            sources={[{ ...CALCULO_DERIVADO, note: "Gasto total / población" }, igaeSource]}
          />
          <StatCard
            label="Gasto / PIB"
            value={formatPercent(gdpRatio)}
            delay={0.15}
            sources={[{ ...CALCULO_DERIVADO, note: "Gasto total / PIB nominal" }, igaeSource]}
          />
          {largestCategory && (
            <StatCard
              label="Mayor partida"
              value={`${largestCategory.name}`}
              delay={0.2}
              sources={[
                {
                  name: `${formatNumber(largestCategory.percentage, 1)}% del total`,
                  note: formatCompact(largestCategory.amount * 1_000_000),
                },
              ]}
            />
          )}
        </div>

        {/* Compare mode selector */}
        {comparisonYear && (
          <div className="flex items-center justify-center gap-1">
            <span className="text-xs text-muted-foreground mr-1.5">Vista:</span>
            <div className="flex items-center rounded-md border border-input bg-background p-0.5">
              {(
                [
                  ["absoluto", "Absoluto"],
                  ["pesos", "% peso"],
                  ["cambio", "% cambio"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCompareMode(mode)}
                  className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                    compareMode === mode
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chart */}
        {yearData && (
          <BudgetChart
            categories={displayCategories}
            comparisonCategories={displayComparisonCategories}
            comparisonYear={comparisonYear ?? undefined}
            selectedYear={selectedYear}
            drilldownCategory={drilldownCategory}
            onDrilldown={setDrilldownCategory}
            compareMode={comparisonYear ? compareMode : "absoluto"}
            euroLabel={euroLabel}
          />
        )}

        <p className="text-[10px] text-muted-foreground/70 text-center">
          Total Administraciones Públicas — Clasificación funcional COFOG —{" "}
          <a
            href={IGAE_COFOG.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            IGAE
          </a>{" "}
          — Datos en millones de {euroLabel} — Año {selectedYear}
        </p>
      </CardContent>
    </Card>
  );
}
