import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BDE_BE11B,
  CALCULO_DERIVADO,
  ESTIMACION_INTERESES,
  fromAttribution,
  IGAE_COFOG,
  INE_POBLACION,
  resolveSource,
} from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useTabKeyboardNav } from "@/hooks/useTabKeyboardNav";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber, formatPercent } from "@/utils/formatters";
import { ExportBlockButton } from "./ExportBlockButton";
import { RealtimeCounter } from "./RealtimeCounter";
import { StatCard } from "./StatCard";

export function DebtImplicationsBlock() {
  const [tab, setTab] = useState<"cost" | "perspective">("cost");
  const { debt, demographics, pensions, budget } = useData();
  const { msg } = useI18n();
  const DEBT_TABS = ["cost", "perspective"] as const;
  const { onKeyDown: tabKeyDown } = useTabKeyboardNav(DEBT_TABS, tab, setTab);

  // --- Debt cost computations ---
  const costCopy = msg.blocks.debtCost;
  const interestPerSecond = debt.current.interestExpense / (365.25 * 24 * 60 * 60);
  const currentDebt = debt.regression.intercept + debt.regression.slope * Date.now();
  const averageCost = (debt.current.interestExpense / currentDebt) * 100;
  const totalDebtSparkline = debt.historical.slice(-20).map((point) => point.totalDebt);
  const averageCostRatio = currentDebt > 0 ? debt.current.interestExpense / currentDebt : 0;
  const annualInterestSparkline =
    averageCostRatio > 0 ? totalDebtSparkline.map((value) => value * averageCostRatio) : [];
  const averageCostSparkline =
    debt.current.interestExpense > 0
      ? totalDebtSparkline.map((value) =>
          value > 0 ? (debt.current.interestExpense / value) * 100 : 0,
        )
      : [];

  const interestSource = debt.sourceAttribution?.interestExpense
    ? fromAttribution(debt.sourceAttribution.interestExpense)
    : ESTIMACION_INTERESES;

  const totalDebtSource = debt.sourceAttribution?.totalDebt
    ? fromAttribution(debt.sourceAttribution.totalDebt)
    : BDE_BE11B;

  // --- Equivalences computations ---
  const eqCopy = msg.blocks.equivalences;
  const latestBudgetYear = budget.latestYear;
  const budgetTotalEuros = (budget.byYear[String(latestBudgetYear)]?.total ?? 0) * 1_000_000;

  const debtPerCapita = currentDebt / demographics.population;
  const monthsOfSMI = debtPerCapita / demographics.smi;
  const yearsOfSalary = debtPerCapita / demographics.averageSalary;
  const yearsOfSpending = budgetTotalEuros > 0 ? currentDebt / budgetTotalEuros : 0;
  const yearsOfPensions =
    pensions.current.annualExpense > 0 ? currentDebt / pensions.current.annualExpense : 0;
  const daysOfInterest =
    budgetTotalEuros > 0 ? (debt.current.interestExpense / budgetTotalEuros) * 365 : 0;
  const dailySpending = budgetTotalEuros > 0 ? budgetTotalEuros / 365 : 0;
  const monthsOfSMISparkline =
    demographics.population > 0 && demographics.smi > 0
      ? totalDebtSparkline.map((value) => value / demographics.population / demographics.smi)
      : [];
  const yearsOfSalarySparkline =
    demographics.population > 0 && demographics.averageSalary > 0
      ? totalDebtSparkline.map(
          (value) => value / demographics.population / demographics.averageSalary,
        )
      : [];
  const yearsOfSpendingSparkline =
    budgetTotalEuros > 0 ? totalDebtSparkline.map((value) => value / budgetTotalEuros) : [];
  const yearsOfPensionsSparkline =
    pensions.current.annualExpense > 0
      ? totalDebtSparkline.map((value) => value / pensions.current.annualExpense)
      : [];
  const daysOfInterestSparkline =
    budgetTotalEuros > 0
      ? annualInterestSparkline.map((value) => (value / budgetTotalEuros) * 365)
      : [];
  const dailySpendingSparkline = (budget.years ?? [])
    .slice(-20)
    .map((year) => (budget.byYear[String(year)]?.total ?? 0) * 1_000_000)
    .filter((value) => value > 0)
    .map((value) => value / 365);

  const bdeSource = resolveSource(debt.sourceAttribution?.totalDebt, BDE_BE11B);
  const inePopSource = resolveSource(demographics.sourceAttribution?.population, INE_POBLACION);
  const igaeSource = resolveSource(budget.sourceAttribution?.budget, IGAE_COFOG);

  return (
    <Card id="coste-deuda">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{costCopy.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{eqCopy.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div
              role="tablist"
              onKeyDown={tabKeyDown}
              className="flex items-center rounded-md border border-input bg-background p-0.5"
            >
              <button
                type="button"
                role="tab"
                id="debt-tab-cost"
                aria-selected={tab === "cost"}
                aria-controls="debt-panel-cost"
                tabIndex={tab === "cost" ? 0 : -1}
                onClick={() => setTab("cost")}
                className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${tab === "cost" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {costCopy.tabCost}
              </button>
              <button
                type="button"
                role="tab"
                id="debt-tab-perspective"
                aria-selected={tab === "perspective"}
                aria-controls="debt-panel-perspective"
                tabIndex={tab === "perspective" ? 0 : -1}
                onClick={() => setTab("perspective")}
                className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${tab === "perspective" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {costCopy.tabPerspective}
              </button>
            </div>
            <ExportBlockButton
              targetId="coste-deuda"
              filenamePrefix="cuentas-publicas-coste-deuda"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          role="tabpanel"
          id="debt-panel-cost"
          aria-labelledby="debt-tab-cost"
          hidden={tab !== "cost"}
        >
          <div className="flex flex-col items-center py-6 border-b gap-2">
            <RealtimeCounter
              baseValue={0}
              perSecond={interestPerSecond}
              suffix=" €"
              size="lg"
              decimals={0}
              label={costCopy.realtimeLabel}
            />
            <p className="text-xs text-muted-foreground/80 text-center">{costCopy.realtimeNote}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              label={costCopy.annualInterest}
              value={formatCompact(debt.current.interestExpense)}
              tooltip={costCopy.annualInterestTooltip}
              delay={0.05}
              sparklineData={annualInterestSparkline}
              sources={[interestSource]}
            />
            <StatCard
              label={costCopy.averageCost}
              value={formatPercent(averageCost)}
              tooltip={costCopy.averageCostTooltip}
              delay={0.1}
              sparklineData={averageCostSparkline}
              sources={[
                { ...CALCULO_DERIVADO, note: costCopy.averageCostNote },
                interestSource,
                totalDebtSource,
              ]}
            />
          </div>
        </div>
        <div
          role="tabpanel"
          id="debt-panel-perspective"
          aria-labelledby="debt-tab-perspective"
          hidden={tab !== "perspective"}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label={eqCopy.monthsLabel}
              value={`${formatNumber(monthsOfSMI, 1)} ${eqCopy.monthsUnit}`}
              tooltip={eqCopy.monthsLabelTooltip}
              delay={0.05}
              sparklineData={monthsOfSMISparkline}
              sources={[
                {
                  ...CALCULO_DERIVADO,
                  note: `${eqCopy.perCapitaLabel} (${formatCompact(debtPerCapita)}) / SMI (${formatNumber(demographics.smi, 0)} ${eqCopy.monthsNoteSuffix})`,
                },
                bdeSource,
                inePopSource,
              ]}
            />
            <StatCard
              label={eqCopy.salaryLabel}
              value={`${formatNumber(yearsOfSalary, 1)} ${eqCopy.yearsUnit}`}
              tooltip={eqCopy.salaryLabelTooltip}
              delay={0.1}
              sparklineData={yearsOfSalarySparkline}
              sources={[
                {
                  ...CALCULO_DERIVADO,
                  note: `${eqCopy.perCapitaLabel} / ${eqCopy.averageSalaryLabel} (${formatNumber(demographics.averageSalary, 0)} ${eqCopy.salaryNoteSuffix})`,
                },
                bdeSource,
                inePopSource,
              ]}
            />
            <StatCard
              label={eqCopy.spendingLabel}
              value={`${formatNumber(yearsOfSpending, 1)} ${eqCopy.yearsUnit}`}
              tooltip={eqCopy.spendingLabelTooltip}
              delay={0.15}
              sparklineData={yearsOfSpendingSparkline}
              sources={[
                {
                  ...CALCULO_DERIVADO,
                  note: `${eqCopy.debtTotalLabel} / ${eqCopy.spendingLabelShort} ${latestBudgetYear} (${formatCompact(budgetTotalEuros)})`,
                },
                bdeSource,
                igaeSource,
              ]}
            />
            <StatCard
              label={eqCopy.pensionsLabel}
              value={`${formatNumber(yearsOfPensions, 1)} ${eqCopy.yearsUnit}`}
              tooltip={eqCopy.pensionsLabelTooltip}
              delay={0.2}
              sparklineData={yearsOfPensionsSparkline}
              sources={[
                {
                  ...CALCULO_DERIVADO,
                  note: `${eqCopy.debtTotalLabel} / ${eqCopy.annualPensionsLabel} (${formatCompact(pensions.current.annualExpense)})`,
                },
                bdeSource,
              ]}
            />
            <StatCard
              label={eqCopy.interestLabel}
              value={`${formatNumber(daysOfInterest, 0)} ${eqCopy.daysUnit}`}
              tooltip={eqCopy.interestLabelTooltip}
              delay={0.25}
              sparklineData={daysOfInterestSparkline}
              sources={[
                {
                  ...CALCULO_DERIVADO,
                  note: `${eqCopy.annualInterestLabel} (${formatCompact(debt.current.interestExpense)}) / ${eqCopy.publicDailyLabel}`,
                },
                ESTIMACION_INTERESES,
                igaeSource,
              ]}
            />
            <StatCard
              label={eqCopy.dailySpendingLabel}
              value={formatCompact(dailySpending)}
              tooltip={eqCopy.dailySpendingLabelTooltip}
              delay={0.3}
              sparklineData={dailySpendingSparkline}
              sources={[
                {
                  ...CALCULO_DERIVADO,
                  note: `${eqCopy.spendingLabelShort} ${latestBudgetYear} / 365 ${eqCopy.daysUnit}`,
                },
                igaeSource,
              ]}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
