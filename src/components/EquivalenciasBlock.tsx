import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BDE_BE11B,
  CALCULO_DERIVADO,
  ESTIMACION_INTERESES,
  IGAE_COFOG,
  INE_POBLACION,
  resolveSource,
} from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber } from "@/utils/formatters";
import { ExportBlockButton } from "./ExportBlockButton";
import { StatCard } from "./StatCard";

export function EquivalenciasBlock() {
  const { debt, demographics, pensions, budget } = useData();
  const { msg } = useI18n();

  const copy = msg.blocks.equivalences;

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
  const bdeSource = resolveSource(debt.sourceAttribution?.totalDebt, BDE_BE11B);
  const inePopSource = resolveSource(demographics.sourceAttribution?.population, INE_POBLACION);
  const igaeSource = resolveSource(budget.sourceAttribution?.budget, IGAE_COFOG);

  return (
    <Card id="equivalencias">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{msg.blocks.equivalences.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{msg.blocks.equivalences.subtitle}</p>
          </div>
          <ExportBlockButton
            targetId="equivalencias"
            filenamePrefix="cuentas-publicas-equivalencias"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label={copy.monthsLabel}
            value={`${formatNumber(monthsOfSMI, 1)} ${copy.monthsUnit}`}
            tooltip={copy.monthsLabelTooltip}
            delay={0.05}
            sources={[
              {
                ...CALCULO_DERIVADO,
                note: `${copy.perCapitaLabel} (${formatCompact(debtPerCapita)}) / SMI (${formatNumber(demographics.smi, 0)} ${copy.monthsNoteSuffix})`,
              },
              bdeSource,
              inePopSource,
            ]}
          />
          <StatCard
            label={copy.salaryLabel}
            value={`${formatNumber(yearsOfSalary, 1)} ${copy.yearsUnit}`}
            tooltip={copy.salaryLabelTooltip}
            delay={0.1}
            sources={[
              {
                ...CALCULO_DERIVADO,
                note: `${copy.perCapitaLabel} / ${copy.averageSalaryLabel} (${formatNumber(demographics.averageSalary, 0)} ${copy.salaryNoteSuffix})`,
              },
              bdeSource,
              inePopSource,
            ]}
          />
          <StatCard
            label={copy.spendingLabel}
            value={`${formatNumber(yearsOfSpending, 1)} ${copy.yearsUnit}`}
            tooltip={copy.spendingLabelTooltip}
            delay={0.15}
            sources={[
              {
                ...CALCULO_DERIVADO,
                note: `${copy.debtTotalLabel} / ${copy.spendingLabelShort} ${latestBudgetYear} (${formatCompact(budgetTotalEuros)})`,
              },
              bdeSource,
              igaeSource,
            ]}
          />
          <StatCard
            label={copy.pensionsLabel}
            value={`${formatNumber(yearsOfPensions, 1)} ${copy.yearsUnit}`}
            tooltip={copy.pensionsLabelTooltip}
            delay={0.2}
            sources={[
              {
                ...CALCULO_DERIVADO,
                note: `${copy.debtTotalLabel} / ${copy.annualPensionsLabel} (${formatCompact(pensions.current.annualExpense)})`,
              },
              bdeSource,
            ]}
          />
          <StatCard
            label={copy.interestLabel}
            value={`${formatNumber(daysOfInterest, 0)} ${copy.daysUnit}`}
            tooltip={copy.interestLabelTooltip}
            delay={0.25}
            sources={[
              {
                ...CALCULO_DERIVADO,
                note: `${copy.annualInterestLabel} (${formatCompact(debt.current.interestExpense)}) / ${copy.publicDailyLabel}`,
              },
              ESTIMACION_INTERESES,
              igaeSource,
            ]}
          />
          <StatCard
            label={copy.dailySpendingLabel}
            value={formatCompact(dailySpending)}
            tooltip={copy.dailySpendingLabelTooltip}
            delay={0.3}
            sources={[
              {
                ...CALCULO_DERIVADO,
                note: `${copy.spendingLabelShort} ${latestBudgetYear} / 365 ${copy.daysUnit}`,
              },
              igaeSource,
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
