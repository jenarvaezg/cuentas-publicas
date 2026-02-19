import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BDE_BE11B,
  CALCULO_DERIVADO,
  ESTIMACION_INTERESES,
  fromAttribution,
  IGAE_COFOG,
  INE_POBLACION,
} from "@/data/sources";
import { useData } from "@/hooks/useData";
import { formatCompact, formatNumber } from "@/utils/formatters";
import { StatCard } from "./StatCard";

export function EquivalenciasBlock() {
  const { debt, demographics, pensions, budget } = useData();

  // Use extrapolated debt (same approach as DebtBlock)
  const currentDebt = debt.regression.intercept + debt.regression.slope * Date.now();

  const latestBudgetYear = budget.latestYear;
  const budgetTotalEuros = (budget.byYear[String(latestBudgetYear)]?.total ?? 0) * 1_000_000;

  // 1. Debt per capita in months of SMI
  const debtPerCapita = currentDebt / demographics.population;
  const monthsOfSMI = debtPerCapita / demographics.smi;

  // 2. Debt per capita in years of average salary
  const yearsOfSalary = debtPerCapita / demographics.averageSalary;

  // 3. Debt in years of total public spending
  const yearsOfSpending = budgetTotalEuros > 0 ? currentDebt / budgetTotalEuros : 0;

  // 4. Debt in years of pension spending
  const yearsOfPensions =
    pensions.current.annualExpense > 0 ? currentDebt / pensions.current.annualExpense : 0;

  // 5. Interest expense in days of public spending
  const daysOfInterest =
    budgetTotalEuros > 0 ? (debt.current.interestExpense / budgetTotalEuros) * 365 : 0;

  // 6. Daily public spending
  const dailySpending = budgetTotalEuros > 0 ? budgetTotalEuros / 365 : 0;

  // Source attributions
  const bdeSource = debt.sourceAttribution?.totalDebt
    ? fromAttribution(debt.sourceAttribution.totalDebt)
    : BDE_BE11B;

  const inePopSource = demographics.sourceAttribution?.population
    ? fromAttribution(demographics.sourceAttribution.population)
    : INE_POBLACION;

  const igaeSource = budget.sourceAttribution?.budget
    ? fromAttribution(budget.sourceAttribution.budget)
    : IGAE_COFOG;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equivalencias</CardTitle>
        <p className="text-sm text-muted-foreground">
          Para entender las cifras: la deuda publica traducida a magnitudes cotidianas
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Deuda por persona en meses de SMI"
            value={`${formatNumber(monthsOfSMI, 1)} meses`}
            delay={0.05}
            sources={[
              {
                ...CALCULO_DERIVADO,
                note: `Deuda per capita (${formatCompact(debtPerCapita)}) / SMI (${formatNumber(demographics.smi, 0)} €/mes)`,
              },
              bdeSource,
              inePopSource,
            ]}
          />
          <StatCard
            label="Deuda por persona en salarios anuales"
            value={`${formatNumber(yearsOfSalary, 1)} años`}
            delay={0.1}
            sources={[
              {
                ...CALCULO_DERIVADO,
                note: `Deuda per capita / salario medio (${formatNumber(demographics.averageSalary, 0)} €/año)`,
              },
              bdeSource,
              inePopSource,
            ]}
          />
          <StatCard
            label="Deuda = gasto publico de..."
            value={`${formatNumber(yearsOfSpending, 1)} años`}
            delay={0.15}
            sources={[
              {
                ...CALCULO_DERIVADO,
                note: `Deuda total / gasto AAPP ${latestBudgetYear} (${formatCompact(budgetTotalEuros)})`,
              },
              bdeSource,
              igaeSource,
            ]}
          />
          <StatCard
            label="Deuda = pensiones de..."
            value={`${formatNumber(yearsOfPensions, 1)} años`}
            delay={0.2}
            sources={[
              {
                ...CALCULO_DERIVADO,
                note: `Deuda total / gasto anual pensiones (${formatCompact(pensions.current.annualExpense)})`,
              },
              bdeSource,
            ]}
          />
          <StatCard
            label="Intereses = gasto publico de..."
            value={`${formatNumber(daysOfInterest, 0)} dias`}
            delay={0.25}
            sources={[
              {
                ...CALCULO_DERIVADO,
                note: `Intereses (${formatCompact(debt.current.interestExpense)}) / gasto diario AAPP`,
              },
              ESTIMACION_INTERESES,
              igaeSource,
            ]}
          />
          <StatCard
            label="Gasto publico diario"
            value={formatCompact(dailySpending)}
            delay={0.3}
            sources={[
              {
                ...CALCULO_DERIVADO,
                note: `Gasto AAPP ${latestBudgetYear} / 365 dias`,
              },
              igaeSource,
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
