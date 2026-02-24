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
import { ExportBlockButton } from "./ExportBlockButton";
import { StatCard } from "./StatCard";

export function EquivalenciasBlock() {
  const { debt, demographics, pensions, budget } = useData();
  const { msg, lang } = useI18n();

  const copy =
    lang === "en"
      ? {
          monthsLabel: "Debt per person in minimum-wage months",
          monthsLabelTooltip:
            "If each person had to repay their share of the national debt using the monthly minimum wage, this is how many months it would take.",
          monthsUnit: "months",
          monthsNoteSuffix: "€/month",
          salaryLabel: "Debt per person in annual salaries",
          salaryLabelTooltip:
            "How many full years of the average Spanish salary each person would need to pay off their share of the public debt.",
          yearsUnit: "years",
          salaryNoteSuffix: "€/year",
          spendingLabel: "Debt equals public spending for...",
          spendingLabelTooltip:
            "The total national debt is so large that it equals this many years of everything the government spends.",
          pensionsLabel: "Debt equals pension spending for...",
          pensionsLabelTooltip:
            "If all pension payments stopped and were used to pay off debt, this is how many years it would take to clear it.",
          interestLabel: "Interest equals public spending for...",
          interestLabelTooltip:
            "The annual interest bill alone is equivalent to this many days of all government spending — money that buys nothing new.",
          daysUnit: "days",
          dailySpendingLabel: "Daily public spending",
          dailySpendingLabelTooltip:
            "How much money all levels of government combined spend every single day on average throughout the year.",
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
          monthsLabelTooltip:
            "Si cada habitante tuviera que pagar su parte de la deuda pública con el salario mínimo mensual, necesitaría tantos meses como indica este número.",
          monthsUnit: "meses",
          monthsNoteSuffix: "€/mes",
          salaryLabel: "Deuda por persona en salarios anuales",
          salaryLabelTooltip:
            "Cuántos años de salario medio haría falta para que cada español pagara la parte de la deuda que le corresponde.",
          yearsUnit: "años",
          salaryNoteSuffix: "€/año",
          spendingLabel: "Deuda = gasto publico de...",
          spendingLabelTooltip:
            "La deuda total es tan grande que equivale a tantos años como indica este número de todo el gasto público combinado.",
          pensionsLabel: "Deuda = pensiones de...",
          pensionsLabelTooltip:
            "Si se destinara todo el gasto en pensiones a pagar la deuda en vez de a los pensionistas, tardaríamos este tiempo en saldarla.",
          interestLabel: "Intereses = gasto publico de...",
          interestLabelTooltip:
            "Solo los intereses de la deuda de un año equivalen a tantos días de todo el gasto público: dinero que no sirve para pagar servicios.",
          daysUnit: "dias",
          dailySpendingLabel: "Gasto publico diario",
          dailySpendingLabelTooltip:
            "Cuánto dinero gastan en total todas las administraciones públicas cada día de media a lo largo del año.",
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
