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
import {
  formatCompact,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/utils/formatters";
import { RealtimeCounter } from "./RealtimeCounter";
import { StatCard } from "./StatCard";

export function PensionsBlock() {
  const { pensions, demographics } = useData();

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
        note: "Gasto anual pensiones - cotizaciones sociales",
      };

  const contributorsPerPensionerSource = pensions.sourceAttribution?.contributorsPerPensioner
    ? fromAttribution(pensions.sourceAttribution.contributorsPerPensioner)
    : { ...CALCULO_DERIVADO, note: "Afiliados / pensionistas" };

  const inePibSource = demographics.sourceAttribution?.gdp
    ? fromAttribution(demographics.sourceAttribution.gdp)
    : withDate(INE_PIB, demoDate);

  const cotizacionesSource = pensions.sourceAttribution?.socialContributions
    ? fromAttribution(pensions.sourceAttribution.socialContributions)
    : withDate(PGE_COTIZACIONES, "2025");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pensiones y Seguridad Social</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center py-6 border-b gap-2">
          <RealtimeCounter
            baseValue={0}
            perSecond={expensePerSecond}
            suffix=" €"
            size="lg"
            decimals={0}
            label="Gastado en pensiones desde que abriste la página"
          />
          <p className="text-[10px] text-muted-foreground/70 text-center">
            {formatNumber(expensePerSecond, 2)} €/s — basado en nomina mensual{" "}
            <a
              href={SS_NOMINA.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              MITES/Seg. Social
            </a>{" "}
            ({pensionDate}) x 14 pagas / 365,25 días / 86.400 s
          </p>
          <div
            className="font-mono font-bold tabular-nums whitespace-nowrap text-lg text-muted-foreground"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatNumber(expensePerSecond, 2)} €/s en pensiones
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Nómina mensual total"
            value={formatCompact(pensions.current.monthlyPayroll)}
            delay={0.05}
            sparklineData={sparklineData}
            sources={[ssNomina, { name: "Incluye SS contributivas + Clases Pasivas" }]}
          />
          <StatCard
            label="Déficit contributivo"
            value={formatCompact(pensions.current.contributoryDeficit)}
            delay={0.1}
            trend={{
              value: 1,
              label: formatCompact(pensions.current.contributoryDeficit),
            }}
            sources={[contributoryDeficitSource, ssNomina, cotizacionesSource]}
          />
          <StatCard
            label="Cotizantes por pensionista"
            value={formatNumber(pensions.current.contributorsPerPensioner, 2)}
            delay={0.15}
            sources={[contributorsPerPensionerSource, ssAfiliados, ssPensiones]}
          />
          <StatCard
            label="Pensión media jubilación"
            value={`${formatCurrency(pensions.current.averagePensionRetirement)}/mes`}
            delay={0.2}
            sources={[avgPensionSource]}
          />
          <StatCard
            label="Gasto pensiones / PIB"
            value={formatPercent(pensionExpenseToGDP)}
            delay={0.25}
            sources={[
              { ...CALCULO_DERIVADO, note: "Gasto anual (nomina x 14) / PIB" },
              ssNomina,
              inePibSource,
            ]}
          />
          <StatCard
            label="Pensiones en vigor"
            value={formatNumber(pensions.current.totalPensions, 0)}
            delay={0.3}
            sources={[ssPensiones]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
