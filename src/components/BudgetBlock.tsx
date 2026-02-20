import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CALCULO_DERIVADO, fromAttribution, IGAE_COFOG } from "@/data/sources";
import type { BudgetCategory } from "@/data/types";
import { useData } from "@/hooks/useData";
import { useDeflator } from "@/hooks/useDeflator";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber, formatPercent } from "@/utils/formatters";
import { BudgetChart, type CompareMode } from "./BudgetChart";
import { ExportBlockButton } from "./ExportBlockButton";
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
  const { msg, lang } = useI18n();

  const copy =
    lang === "en"
      ? {
          eurosReal: "Real €",
          eurosCurrent: "Current €",
          totalSpending: "Total public spending",
          spendingPerCapita: "Spending per capita",
          spendingToGdp: "Spending / GDP",
          largestItem: "Largest category",
          ofTotal: "of total",
          viewAbsolute: "Absolute",
          viewWeight: "% weight",
          viewChange: "% change",
          derivativePopulation: "Total spending / population",
          derivativeGdp: "Total spending / nominal GDP",
          totalPublicAdmin: "General government",
          cofogClassification: "COFOG functional classification",
          dataInMillions: "Data in millions of",
          yearLabel: "Year",
        }
      : {
          eurosReal: "€ reales",
          eurosCurrent: "€ corrientes",
          totalSpending: "Gasto publico total",
          spendingPerCapita: "Gasto per cápita",
          spendingToGdp: "Gasto / PIB",
          largestItem: "Mayor partida",
          ofTotal: "del total",
          viewAbsolute: "Absoluto",
          viewWeight: "% peso",
          viewChange: "% cambio",
          derivativePopulation: "Gasto total / población",
          derivativeGdp: "Gasto total / PIB nominal",
          totalPublicAdmin: "Total Administraciones Públicas",
          cofogClassification: "Clasificación funcional COFOG",
          dataInMillions: "Datos en millones de",
          yearLabel: "Año",
        };

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
          <CardTitle>{msg.blocks.budget.title}</CardTitle>
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
                  {copy.eurosReal}
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
                  {copy.eurosCurrent}
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="budget-year"
                className="text-xs text-muted-foreground whitespace-nowrap"
              >
                {msg.common.year}
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
                {msg.common.compare}
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
            <ExportBlockButton
              targetId="gasto-cofog"
              filenamePrefix="cuentas-publicas-gasto-cofog"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={copy.totalSpending}
            value={formatCompact(totalEuros)}
            delay={0.05}
            sources={[igaeSource]}
          />
          <StatCard
            label={copy.spendingPerCapita}
            value={`${formatNumber(perCapita, 0)} €`}
            delay={0.1}
            sources={[{ ...CALCULO_DERIVADO, note: copy.derivativePopulation }, igaeSource]}
          />
          <StatCard
            label={copy.spendingToGdp}
            value={formatPercent(gdpRatio)}
            delay={0.15}
            sources={[{ ...CALCULO_DERIVADO, note: copy.derivativeGdp }, igaeSource]}
          />
          {largestCategory && (
            <StatCard
              label={copy.largestItem}
              value={`${largestCategory.name}`}
              delay={0.2}
              sources={[
                {
                  name: `${formatNumber(largestCategory.percentage, 1)}% ${copy.ofTotal}`,
                  note: formatCompact(largestCategory.amount * 1_000_000),
                },
              ]}
            />
          )}
        </div>

        {/* Compare mode selector */}
        {comparisonYear && (
          <div className="flex items-center justify-center gap-1">
            <span className="text-xs text-muted-foreground mr-1.5">{msg.common.view}</span>
            <div className="flex items-center rounded-md border border-input bg-background p-0.5">
              {(
                [
                  ["absoluto", copy.viewAbsolute],
                  ["pesos", copy.viewWeight],
                  ["cambio", copy.viewChange],
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

        <p className="text-xs text-muted-foreground/80 text-center">
          {copy.totalPublicAdmin} — {copy.cofogClassification} —{" "}
          <a
            href={IGAE_COFOG.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            IGAE
          </a>{" "}
          — {copy.dataInMillions} {euroLabel} — {copy.yearLabel} {selectedYear}
        </p>
      </CardContent>
    </Card>
  );
}
