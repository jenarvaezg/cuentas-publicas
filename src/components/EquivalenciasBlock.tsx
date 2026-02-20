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
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber } from "@/utils/formatters";
import { StatCard } from "./StatCard";

export function EquivalenciasBlock() {
  const { debt, demographics, pensions, budget } = useData();
  const { msg, lang } = useI18n();

  const copy =
    lang === "en"
      ? {
          monthsLabel: "Debt per person in minimum-wage months",
          monthsUnit: "months",
          monthsNoteSuffix: "€/month",
          salaryLabel: "Debt per person in annual salaries",
          yearsUnit: "years",
          salaryNoteSuffix: "€/year",
          spendingLabel: "Debt equals public spending for...",
          pensionsLabel: "Debt equals pension spending for...",
          interestLabel: "Interest equals public spending for...",
          daysUnit: "days",
          dailySpendingLabel: "Daily public spending",
          perCapitaLabel: "Debt per capita",
          debtTotalLabel: "Total debt",
          spendingLabelShort: "Public spending",
          annualPensionsLabel: "Annual pension spending",
          annualInterestLabel: "Interest",
          publicDailyLabel: "daily public spending",
          averageSalaryLabel: "average salary",
        }
      : {
          monthsLabel: "Deuda por persona en meses de SMI",
          monthsUnit: "meses",
          monthsNoteSuffix: "€/mes",
          salaryLabel: "Deuda por persona en salarios anuales",
          yearsUnit: "años",
          salaryNoteSuffix: "€/año",
          spendingLabel: "Deuda = gasto publico de...",
          pensionsLabel: "Deuda = pensiones de...",
          interestLabel: "Intereses = gasto publico de...",
          daysUnit: "dias",
          dailySpendingLabel: "Gasto publico diario",
          perCapitaLabel: "Deuda per capita",
          debtTotalLabel: "Deuda total",
          spendingLabelShort: "gasto AAPP",
          annualPensionsLabel: "gasto anual pensiones",
          annualInterestLabel: "Intereses",
          publicDailyLabel: "gasto diario AAPP",
          averageSalaryLabel: "salario medio",
        };

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
        <CardTitle>{msg.blocks.equivalences.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{msg.blocks.equivalences.subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label={copy.monthsLabel}
            value={`${formatNumber(monthsOfSMI, 1)} ${copy.monthsUnit}`}
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
