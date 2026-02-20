import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CALCULO_DERIVADO,
  fromAttribution,
  INE_PIB,
  PGE_COTIZACIONES,
  SS_AFILIADOS,
  SS_NOMINA,
  SS_PENSIONES,
  withDate,
} from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import {
  formatCompact,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/utils/formatters";
import { ExportBlockButton } from "./ExportBlockButton";
import { RealtimeCounter } from "./RealtimeCounter";
import { StatCard } from "./StatCard";

export function PensionsBlock() {
  const { pensions, demographics } = useData();
  const { msg, lang } = useI18n();

  const copy =
    lang === "en"
      ? {
          realtimeLabel: "Pension spending since you opened this page",
          basedOn: "based on monthly payroll",
          pensionSecondSuffix: "in pensions",
          includesSources: "Includes contributory SS + civil service pensions",
          monthlyPayroll: "Total monthly payroll",
          monthlyPayrollTooltip:
            "Total amount paid each month to all pensioners (Social Security + civil service pensions).",
          contributoryDeficit: "Contributory deficit",
          contributoryDeficitTooltip:
            "Annual gap between social contributions collected and contributory pension spending.",
          contributorsPerPensioner: "Contributors per pensioner",
          contributorsPerPensionerTooltip:
            "Active workers per pension in payment. A ratio close to 2.0 is usually considered more stable.",
          averageRetirementPension: "Average retirement pension",
          averageRetirementPensionTooltip: "Average monthly pension paid to retirement pensioners.",
          perMonthSuffix: "/month",
          pensionToGdp: "Pension spending / GDP",
          pensionToGdpTooltip: "Share of annual GDP used to pay pensions each year.",
          reserveFund: "Reserve fund",
          reserveFundTooltip:
            "The pensions reserve fund. It peaked at €66.8B in 2011 and is currently recovering.",
          reserveFundSource: "Estimate by Inclusion Ministry/Social Security",
          reserveFundSourceNote: "Value Feb 2026",
          activePensions: "Pensions in payment",
          activePensionsTooltip:
            "Total number of benefits currently paid (one person may receive more than one pension).",
          deficitNote: "Annual pension spending - social contributions",
          ratioNote: "Contributors / pensioners",
          gdpNote: "Annual spending (monthly payroll x 14) / GDP",
          payrollCalcSuffix: "x 14 payments / 365.25 days / 86,400\u00A0s",
        }
      : {
          realtimeLabel: "Gastado en pensiones desde que abriste la página",
          basedOn: "basado en nomina mensual",
          pensionSecondSuffix: "en pensiones",
          includesSources: "Incluye SS contributivas + Clases Pasivas",
          monthlyPayroll: "Nómina mensual total",
          monthlyPayrollTooltip:
            "Suma de lo que el Estado paga cada mes a todos los pensionistas (incluye Seg. Social y Clases Pasivas).",
          contributoryDeficit: "Déficit contributivo",
          contributoryDeficitTooltip:
            "Diferencia anual entre lo que se recauda por cotizaciones sociales y lo que cuestan las pensiones contributivas.",
          contributorsPerPensioner: "Cotizantes por pensionista",
          contributorsPerPensionerTooltip:
            "Número de trabajadores en activo por cada pensión en vigor. Un ratio cercano a 2,0 se considera necesario para la estabilidad.",
          averageRetirementPension: "Pensión media jubilación",
          averageRetirementPensionTooltip:
            "Importe medio percibido mensualmente por los pensionistas por jubilación del sistema.",
          perMonthSuffix: "/mes",
          pensionToGdp: "Gasto pensiones / PIB",
          pensionToGdpTooltip:
            "Porcentaje de la riqueza nacional (PIB) que se destina anualmente a pagar el sistema de pensiones.",
          reserveFund: "Fondo de Reserva",
          reserveFundTooltip:
            "La 'hucha de las pensiones'. Creada para cubrir desfases, llegó a tener 66.815 M€ en 2011. Actualmente en recuperación.",
          reserveFundSource: "Estimación Ministerio Inclusión/Seg. Social",
          reserveFundSourceNote: "Dato feb 2026",
          activePensions: "Pensiones en vigor",
          activePensionsTooltip:
            "Número total de prestaciones que se están pagando actualmente (una persona puede cobrar más de una).",
          deficitNote: "Gasto anual pensiones - cotizaciones sociales",
          ratioNote: "Afiliados / pensionistas",
          gdpNote: "Gasto anual (nomina x 14) / PIB",
          payrollCalcSuffix: "x 14 pagas / 365,25 días / 86.400\u00A0s",
        };

  const expensePerSecond = pensions.current.expensePerSecond;
  const pensionExpenseToGDP = (pensions.current.annualExpense / demographics.gdp) * 100;

  const sparklineData = pensions.historical.slice(-20).map((d) => d.monthlyPayroll);

  const pensionDate = formatDate(pensions.lastUpdated);
  const demoDate = formatDate(demographics.lastUpdated);

  // Use real attributions from data if available
  const ssNomina = pensions.sourceAttribution?.monthlyPayroll
    ? fromAttribution(pensions.sourceAttribution.monthlyPayroll)
    : withDate(SS_NOMINA, pensionDate);

  const ssPensiones = pensions.sourceAttribution?.totalPensions
    ? fromAttribution(pensions.sourceAttribution.totalPensions)
    : withDate(SS_PENSIONES, pensionDate);

  const ssAfiliados = pensions.sourceAttribution?.affiliates
    ? fromAttribution(pensions.sourceAttribution.affiliates)
    : withDate(SS_AFILIADOS, pensionDate);

  const avgPensionSource = pensions.sourceAttribution?.averagePensionRetirement
    ? fromAttribution(pensions.sourceAttribution.averagePensionRetirement)
    : withDate(SS_PENSIONES, pensionDate);

  const contributoryDeficitSource = pensions.sourceAttribution?.contributoryDeficit
    ? fromAttribution(pensions.sourceAttribution.contributoryDeficit)
    : {
        ...CALCULO_DERIVADO,
        note: copy.deficitNote,
      };

  const contributorsPerPensionerSource = pensions.sourceAttribution?.contributorsPerPensioner
    ? fromAttribution(pensions.sourceAttribution.contributorsPerPensioner)
    : { ...CALCULO_DERIVADO, note: copy.ratioNote };

  const inePibSource = demographics.sourceAttribution?.gdp
    ? fromAttribution(demographics.sourceAttribution.gdp)
    : withDate(INE_PIB, demoDate);

  const cotizacionesSource = pensions.sourceAttribution?.socialContributions
    ? fromAttribution(pensions.sourceAttribution.socialContributions)
    : withDate(PGE_COTIZACIONES, "2025");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{msg.blocks.pensions.title}</CardTitle>
          <ExportBlockButton targetId="pensiones" filenamePrefix="cuentas-publicas-pensiones" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center py-6 border-b gap-2">
          <RealtimeCounter
            baseValue={0}
            perSecond={expensePerSecond}
            suffix=" €"
            size="lg"
            decimals={0}
            label={copy.realtimeLabel}
          />
          <p className="text-xs text-muted-foreground/80 text-center">
            {formatNumber(expensePerSecond, 2)} €/s — {copy.basedOn}{" "}
            <a
              href={SS_NOMINA.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              MITES/Seg. Social
            </a>{" "}
            ({pensionDate}) {copy.payrollCalcSuffix}
          </p>
          <div
            className="font-mono font-bold tabular-nums whitespace-nowrap text-lg text-muted-foreground"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatNumber(expensePerSecond, 2)} €/s {copy.pensionSecondSuffix}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label={copy.monthlyPayroll}
            value={formatCompact(pensions.current.monthlyPayroll)}
            tooltip={copy.monthlyPayrollTooltip}
            delay={0.05}
            sparklineData={sparklineData}
            sources={[ssNomina, { name: copy.includesSources }]}
          />
          <StatCard
            label={copy.contributoryDeficit}
            value={formatCompact(pensions.current.contributoryDeficit)}
            tooltip={copy.contributoryDeficitTooltip}
            delay={0.1}
            trend={{
              value: -pensions.current.contributoryDeficit,
              label: formatCompact(pensions.current.contributoryDeficit),
            }}
            sources={[contributoryDeficitSource, ssNomina, cotizacionesSource]}
          />
          <StatCard
            label={copy.contributorsPerPensioner}
            value={formatNumber(pensions.current.contributorsPerPensioner, 2)}
            tooltip={copy.contributorsPerPensionerTooltip}
            delay={0.15}
            sources={[contributorsPerPensionerSource, ssAfiliados, ssPensiones]}
          />
          <StatCard
            label={copy.averageRetirementPension}
            value={`${formatCurrency(pensions.current.averagePensionRetirement)}${copy.perMonthSuffix}`}
            tooltip={copy.averageRetirementPensionTooltip}
            delay={0.2}
            sources={[avgPensionSource]}
          />
          <StatCard
            label={copy.pensionToGdp}
            value={formatPercent(pensionExpenseToGDP)}
            tooltip={copy.pensionToGdpTooltip}
            delay={0.25}
            sources={[{ ...CALCULO_DERIVADO, note: copy.gdpNote }, ssNomina, inePibSource]}
          />
          <StatCard
            label={copy.reserveFund}
            value={formatCompact(pensions.current.reserveFund)}
            tooltip={copy.reserveFundTooltip}
            delay={0.3}
            sources={[
              {
                name: copy.reserveFundSource,
                note: copy.reserveFundSourceNote,
              },
            ]}
          />
          <StatCard
            label={copy.activePensions}
            value={formatNumber(pensions.current.totalPensions, 0)}
            tooltip={copy.activePensionsTooltip}
            delay={0.35}
            sources={[ssPensiones]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
