import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BDE_BE11B, CALCULO_DERIVADO, ESTIMACION_INTERESES, fromAttribution } from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatPercent } from "@/utils/formatters";
import { RealtimeCounter } from "./RealtimeCounter";
import { StatCard } from "./StatCard";

export function DebtCostBlock() {
  const { debt } = useData();
  const { msg, lang } = useI18n();

  const copy =
    lang === "en"
      ? {
          realtimeLabel: "Interest paid since you opened this page",
          realtimeNote: "Based on estimated annual interest spending (~€39B, 2025 budget)",
          annualInterest: "Annual interest spending",
          averageCost: "Average debt cost",
          averageCostNote: "Interest / total debt",
        }
      : {
          realtimeLabel: "Pagado en intereses desde que abriste la página",
          realtimeNote: "Basado en gasto anual estimado en intereses (~39.000 M€, PGE 2025)",
          annualInterest: "Gasto anual en intereses",
          averageCost: "Coste medio de la deuda",
          averageCostNote: "Intereses / deuda total",
        };

  const interestPerSecond = debt.current.interestExpense / (365.25 * 24 * 60 * 60);
  const currentDebt = debt.regression.intercept + debt.regression.slope * Date.now();
  const averageCost = (debt.current.interestExpense / currentDebt) * 100;

  // Use real attributions from data if available
  const interestSource = debt.sourceAttribution?.interestExpense
    ? fromAttribution(debt.sourceAttribution.interestExpense)
    : ESTIMACION_INTERESES;

  const totalDebtSource = debt.sourceAttribution?.totalDebt
    ? fromAttribution(debt.sourceAttribution.totalDebt)
    : BDE_BE11B;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{msg.blocks.debtCost.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center py-6 border-b gap-2">
          <RealtimeCounter
            baseValue={0}
            perSecond={interestPerSecond}
            suffix=" €"
            size="lg"
            decimals={0}
            label={copy.realtimeLabel}
          />
          <p className="text-xs text-muted-foreground/80 text-center">{copy.realtimeNote}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            label={copy.annualInterest}
            value={formatCompact(debt.current.interestExpense)}
            delay={0.05}
            sources={[interestSource]}
          />
          <StatCard
            label={copy.averageCost}
            value={formatPercent(averageCost)}
            delay={0.1}
            sources={[
              { ...CALCULO_DERIVADO, note: copy.averageCostNote },
              interestSource,
              totalDebtSource,
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
