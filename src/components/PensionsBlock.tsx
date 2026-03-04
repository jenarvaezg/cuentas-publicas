import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CALCULO_DERIVADO,
  fromAttribution,
  SS_NOMINA,
  SS_PENSIONES,
  withDate,
} from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import {
  formatCompact,
  formatCompactCount,
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/utils/formatters";
import { ExportBlockButton } from "./ExportBlockButton";
import { RealtimeCounter } from "./RealtimeCounter";
import { StatCard } from "./StatCard";

export function PensionsBlock() {
  const { pensions } = useData();
  const { msg } = useI18n();

  const copy = msg.blocks.pensions;

  const expensePerSecond = pensions.current.expensePerSecond;

  const sparklineData = pensions.historical.slice(-20).map((d) => d.monthlyPayroll);

  const pensionDate = formatDate(pensions.lastUpdated);

  // Use real attributions from data if available
  const ssNomina = pensions.sourceAttribution?.monthlyPayroll
    ? fromAttribution(pensions.sourceAttribution.monthlyPayroll)
    : withDate(SS_NOMINA, pensionDate);

  const ssPensiones = pensions.sourceAttribution?.totalPensions
    ? fromAttribution(pensions.sourceAttribution.totalPensions)
    : withDate(SS_PENSIONES, pensionDate);

  const avgPensionSource = pensions.sourceAttribution?.averagePensionRetirement
    ? fromAttribution(pensions.sourceAttribution.averagePensionRetirement)
    : withDate(SS_PENSIONES, pensionDate);

  const contributoryDeficitSource = pensions.sourceAttribution?.contributoryDeficit
    ? fromAttribution(pensions.sourceAttribution.contributoryDeficit)
    : {
        ...CALCULO_DERIVADO,
        note: copy.deficitNote,
      };

  const pncSource = pensions.sourceAttribution?.monthlyPayrollPNC
    ? fromAttribution(pensions.sourceAttribution.monthlyPayrollPNC)
    : { name: "IMSERSO (PNC)", note: "Estimación Pensiones No Contributivas" };

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          <StatCard
            label={copy.monthlyPayroll}
            value={formatCompact(pensions.current.monthlyPayroll)}
            tooltip={copy.monthlyPayrollTooltip}
            delay={0.05}
            sparklineData={sparklineData}
            sources={[ssNomina, { name: copy.includesSources }, pncSource]}
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
            sources={[contributoryDeficitSource, ssNomina]}
          />
          <StatCard
            label={copy.averageRetirementPension}
            value={`${formatCurrency(pensions.current.averagePensionRetirement)}${copy.perMonthSuffix}`}
            tooltip={copy.averageRetirementPensionTooltip}
            delay={0.2}
            sources={[avgPensionSource]}
          />
          <StatCard
            label={copy.activePensions}
            value={formatCompactCount(pensions.current.totalPensions)}
            tooltip={copy.activePensionsTooltip}
            delay={0.35}
            sources={[ssPensiones]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
