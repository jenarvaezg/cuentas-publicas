import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BDE_BE11B,
  CALCULO_DERIVADO,
  fromAttribution,
  INE_EPA,
  INE_PIB,
  INE_POBLACION,
  withDate,
} from "@/data/sources";
import { useData } from "@/hooks/useData";
import { formatCompact, formatCurrency, formatDate, formatPercent } from "@/utils/formatters";
import { RealtimeCounter } from "./RealtimeCounter";
import { StatCard } from "./StatCard";

export function DebtBlock() {
  const { debt, demographics } = useData();

  const currentDebt = debt.regression.intercept + debt.regression.slope * Date.now();
  const perSecond = debt.regression.debtPerSecond;

  const debtPerCapita = currentDebt / demographics.population;
  const debtPerContributor = currentDebt / demographics.activePopulation;

  const sparklineData = debt.historical.slice(-20).map((d) => d.totalDebt);
  const yoyChange = debt.current.yearOverYearChange;

  // Last data point date from historical
  const lastDebtDate =
    debt.historical.length > 0
      ? formatDate(debt.historical[debt.historical.length - 1].date)
      : "N/D";
  const demoDate = formatDate(demographics.lastUpdated);

  // Use real attributions from data if available, otherwise fall back to static sources
  const bdeSource = debt.sourceAttribution?.totalDebt
    ? fromAttribution(debt.sourceAttribution.totalDebt)
    : withDate(BDE_BE11B, lastDebtDate);

  const inePopSource = demographics.sourceAttribution?.population
    ? fromAttribution(demographics.sourceAttribution.population)
    : withDate(INE_POBLACION, demoDate);

  const ineEpaSource = demographics.sourceAttribution?.activePopulation
    ? fromAttribution(demographics.sourceAttribution.activePopulation)
    : withDate(INE_EPA, demoDate);

  const inePibSource = demographics.sourceAttribution?.gdp
    ? fromAttribution(demographics.sourceAttribution.gdp)
    : withDate(INE_PIB, demoDate);

  const yoySource = debt.sourceAttribution?.yearOverYearChange
    ? fromAttribution(debt.sourceAttribution.yearOverYearChange)
    : {
        ...CALCULO_DERIVADO,
        note: "Variación % último dato vs mismo mes año anterior",
      };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deuda Pública (PDE)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center py-6 border-b gap-2">
          <RealtimeCounter
            baseValue={currentDebt}
            perSecond={perSecond}
            suffix=" €"
            size="xl"
            label="Deuda total en tiempo real"
          />
          <p className="text-[10px] text-muted-foreground/70 text-center">
            Extrapolación lineal sobre serie mensual{" "}
            <a
              href={BDE_BE11B.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              BdE be11b.csv
            </a>{" "}
            (último dato: {lastDebtDate})
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Deuda per cápita"
            value={formatCurrency(debtPerCapita)}
            delay={0.05}
            sources={[
              { ...CALCULO_DERIVADO, note: "Deuda total / población" },
              bdeSource,
              inePopSource,
            ]}
          />
          <StatCard
            label="Deuda por contribuyente"
            value={formatCurrency(debtPerContributor)}
            delay={0.1}
            sources={[
              { ...CALCULO_DERIVADO, note: "Deuda total / población activa" },
              bdeSource,
              ineEpaSource,
            ]}
          />
          <StatCard
            label="Ratio deuda/PIB"
            value={formatPercent(debt.current.debtToGDP)}
            delay={0.15}
            sources={[
              { ...CALCULO_DERIVADO, note: "Deuda total / PIB nominal" },
              bdeSource,
              inePibSource,
            ]}
          />

          <StatCard
            label="Deuda Estado"
            value={formatCompact(debt.current.debtBySubsector.estado)}
            delay={0.2}
            sources={[bdeSource]}
          />
          <StatCard
            label="Deuda CCAA"
            value={formatCompact(debt.current.debtBySubsector.ccaa)}
            delay={0.25}
            sources={[bdeSource]}
          />
          <StatCard
            label="Deuda CCLL + Seg. Social"
            value={formatCompact(
              debt.current.debtBySubsector.ccll + debt.current.debtBySubsector.ss,
            )}
            delay={0.3}
            sources={[bdeSource]}
          />

          <StatCard
            label="Variación interanual"
            value={formatPercent(yoyChange)}
            delay={0.35}
            trend={{
              value: yoyChange,
              label: formatPercent(Math.abs(yoyChange)),
            }}
            sparklineData={sparklineData}
            sources={[yoySource, bdeSource]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
