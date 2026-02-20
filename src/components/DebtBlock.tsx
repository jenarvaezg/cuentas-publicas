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
import { RealtimeCounter } from "./RealtimeCounter";
import { StatCard } from "./StatCard";

export function DebtBlock() {
  const { debt, demographics } = useData();
  const { msg, lang } = useI18n();

  const copy =
    lang === "en"
      ? {
          realtimeLabel: "Real-time total debt",
          extrapolationPrefix: "Linear extrapolation over monthly series",
          lastOfficial: "latest official data:",
          debtPerCapita: "Debt per capita",
          debtPerCapitaTooltip:
            "How much each resident would owe if total debt were evenly distributed across the population.",
          debtPerContributor: "Debt per contributor",
          debtPerContributorTooltip:
            "Debt burden per person active in the labor force (EPA active population).",
          ratioDebtGdp: "Debt-to-GDP ratio",
          ratioDebtGdpTooltip:
            "Debt sustainability indicator comparing debt with annual national output (GDP).",
          debtState: "Central government debt",
          debtStateTooltip: "Debt issued by the Treasury to finance the central administration.",
          debtRegions: "Regional debt",
          debtRegionsTooltip:
            "Accumulated debt of Spain's Autonomous Communities, including central loans (e.g. FLA).",
          debtLocalAndSs: "Local + Social Security debt",
          debtLocalAndSsTooltip:
            "Combined debt of local governments and Social Security institutions.",
          yoyLabel: "Year-over-year change",
          yoyTooltip: "Percentage change versus the same month in the previous year.",
          yoyNote: "% change latest data vs same month previous year",
          perCapitaNote: "Total debt / population",
          contributorNote: "Total debt / active population",
          gdpNote: "Total debt / nominal GDP",
          subsectorFootnote:
            "* The sum of subsectors may exceed total EDP debt because official figures consolidate intergovernmental loans (FLA, FFPP), which are netted out in accounting.",
        }
      : {
          realtimeLabel: "Deuda total en tiempo real",
          extrapolationPrefix: "Extrapolación lineal sobre serie mensual",
          lastOfficial: "último dato:",
          debtPerCapita: "Deuda per cápita",
          debtPerCapitaTooltip:
            "Lo que debe cada habitante de España si repartiéramos la deuda por igual entre toda la población.",
          debtPerContributor: "Deuda por contribuyente",
          debtPerContributorTooltip:
            "Carga de deuda por cada persona en edad y disposición de trabajar (población activa según la EPA).",
          ratioDebtGdp: "Ratio deuda/PIB",
          ratioDebtGdpTooltip:
            "Mide la sostenibilidad de la deuda comparándola con todo lo que produce el país en un año (PIB).",
          debtState: "Deuda Estado",
          debtStateTooltip:
            "Deuda emitida directamente por el Tesoro Público para financiar la Administración Central.",
          debtRegions: "Deuda CCAA",
          debtRegionsTooltip:
            "Deuda acumulada por las 17 Comunidades Autónomas, incluyendo préstamos del Estado (como el FLA).",
          debtLocalAndSs: "Deuda CCLL + Seg. Social",
          debtLocalAndSsTooltip:
            "Suma de la deuda de Ayuntamientos, Diputaciones, Cabildos y la propia Seguridad Social.",
          yoyLabel: "Variación interanual",
          yoyTooltip:
            "Comparación porcentual de la deuda actual frente al mismo mes del año anterior.",
          yoyNote: "Variación % último dato vs mismo mes año anterior",
          perCapitaNote: "Deuda total / población",
          contributorNote: "Deuda total / población activa",
          gdpNote: "Deuda total / PIB nominal",
          subsectorFootnote:
            "* La suma de subsectores puede superar la deuda total PDE porque la cifra oficial consolida préstamos intergubernamentales (FLA, FFPP) que se compensan contablemente entre administraciones.",
        };

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
        <div className="flex flex-col items-center py-6 border-b gap-2">
          <RealtimeCounter
            baseValue={currentDebt}
            perSecond={perSecond}
            suffix=" €"
            size="lg"
            label={copy.realtimeLabel}
          />
          <p className="text-xs text-muted-foreground/80 text-center">
            {copy.extrapolationPrefix}{" "}
            <a
              href={BDE_BE11B.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              BdE be11b.csv
            </a>{" "}
            ({copy.lastOfficial} {lastDebtDate})
          </p>
        </div>

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

        <p className="text-xs text-muted-foreground/80 italic px-2">{copy.subsectorFootnote}</p>
      </CardContent>
    </Card>
  );
}
