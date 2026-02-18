import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BDE_BE11B, CALCULO_DERIVADO, ESTIMACION_INTERESES, fromAttribution } from "@/data/sources";
import { useData } from "@/hooks/useData";
import { formatCompact, formatPercent } from "@/utils/formatters";
import { RealtimeCounter } from "./RealtimeCounter";
import { StatCard } from "./StatCard";

export function DebtCostBlock() {
  const { debt } = useData();

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
        <CardTitle>Coste de la Deuda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center py-6 border-b gap-2">
          <RealtimeCounter
            baseValue={0}
            perSecond={interestPerSecond}
            suffix=" €"
            size="lg"
            decimals={0}
            label="Pagado en intereses desde que abriste la página"
          />
          <p className="text-[10px] text-muted-foreground/70 text-center">
            Basado en gasto anual estimado en intereses (~39.000 M€, PGE 2025)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            label="Gasto anual en intereses"
            value={formatCompact(debt.current.interestExpense)}
            delay={0.05}
            sources={[interestSource]}
          />
          <StatCard
            label="Coste medio de la deuda"
            value={formatPercent(averageCost)}
            delay={0.1}
            sources={[
              { ...CALCULO_DERIVADO, note: "Intereses / deuda total" },
              interestSource,
              totalDebtSource,
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
