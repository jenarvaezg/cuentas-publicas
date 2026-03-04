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
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatCurrency, formatDate, formatPercent } from "@/utils/formatters";
import { ExportBlockButton } from "./ExportBlockButton";
import { StatCard } from "./StatCard";

export function DebtBlock() {
  const { debt, demographics } = useData();
  const { msg } = useI18n();

  const copy = msg.blocks.debt;

  const currentDebt = debt.regression.intercept + debt.regression.slope * Date.now();

  const debtPerCapita = currentDebt / demographics.population;
  const debtPerContributor = currentDebt / demographics.activePopulation;

  const sparklineData = debt.historical.slice(-20).map((d) => d.totalDebt);
  const yoyChange = debt.current.yearOverYearChange;

  // Last data point date from historical
  const lastDebtDate =
    debt.historical.length > 0
      ? formatDate(debt.historical[debt.historical.length - 1].date)
      : msg.common.notAvailable;
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
        note: copy.yoyNote,
      };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{msg.blocks.debt.title}</CardTitle>
          <ExportBlockButton targetId="deuda" filenamePrefix="cuentas-publicas-deuda" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label={copy.debtPerCapita}
            value={formatCurrency(debtPerCapita)}
            tooltip={copy.debtPerCapitaTooltip}
            delay={0.05}
            sources={[{ ...CALCULO_DERIVADO, note: copy.perCapitaNote }, bdeSource, inePopSource]}
          />
          <StatCard
            label={copy.debtPerContributor}
            value={formatCurrency(debtPerContributor)}
            tooltip={copy.debtPerContributorTooltip}
            delay={0.1}
            sources={[{ ...CALCULO_DERIVADO, note: copy.contributorNote }, bdeSource, ineEpaSource]}
          />
          <StatCard
            label={copy.ratioDebtGdp}
            value={formatPercent(debt.current.debtToGDP)}
            tooltip={copy.ratioDebtGdpTooltip}
            delay={0.15}
            sources={[{ ...CALCULO_DERIVADO, note: copy.gdpNote }, bdeSource, inePibSource]}
          />

          <StatCard
            label={copy.debtState}
            value={formatCompact(debt.current.debtBySubsector.estado)}
            tooltip={copy.debtStateTooltip}
            delay={0.2}
            sources={[bdeSource]}
          />
          <StatCard
            label={copy.debtRegions}
            value={formatCompact(debt.current.debtBySubsector.ccaa)}
            tooltip={copy.debtRegionsTooltip}
            delay={0.25}
            sources={[bdeSource]}
          />
          <StatCard
            label={copy.debtLocalAndSs}
            value={formatCompact(
              debt.current.debtBySubsector.ccll + debt.current.debtBySubsector.ss,
            )}
            tooltip={copy.debtLocalAndSsTooltip}
            delay={0.3}
            sources={[bdeSource]}
          />

          <StatCard
            label={copy.yoyLabel}
            value={formatPercent(yoyChange)}
            tooltip={copy.yoyTooltip}
            delay={0.35}
            trend={{
              value: yoyChange,
              label: formatPercent(Math.abs(yoyChange)),
            }}
            sparklineData={sparklineData}
            sources={[yoySource, bdeSource]}
          />
        </div>

        {(() => {
          const { estado, ccaa, ccll, ss } = debt.current.debtBySubsector;
          const subsectorSum = estado + ccaa + ccll + ss;
          const gap = subsectorSum - debt.current.totalDebt;
          if (gap <= 0) return null;
          return (
            <div className="border-l-4 border-blue-400/60 bg-blue-50/50 dark:bg-blue-950/20 rounded-r px-4 py-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{copy.consolidationGapLabel}: </span>
              <span className="font-semibold text-foreground">+{formatCompact(gap)}</span>
              {"  —  "}
              {msg.blocks.debt.consolidationNote}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
