import { useMemo } from "react";
import budgetJson from "@/data/budget.json";
import ccaaDebtJson from "@/data/ccaa-debt.json";
import ccaaFiscalBalanceJson from "@/data/ccaa-fiscal-balance.json";
import ccaaForalFlowsJson from "@/data/ccaa-foral-flows.json";
import ccaaSpendingJson from "@/data/ccaa-spending.json";
import debtJson from "@/data/debt.json";
import demographicsJson from "@/data/demographics.json";
import eurostatJson from "@/data/eurostat.json";
import flowsJson from "@/data/flows.json";
import metaJson from "@/data/meta.json";
import pensionsJson from "@/data/pensions.json";
import revenueJson from "@/data/revenue.json";
import taxRevenueJson from "@/data/tax-revenue.json";
import type {
  BudgetData,
  CcaaDebtData,
  CcaaFiscalBalanceData,
  CcaaForalFlowsData,
  CcaaSpendingData,
  DebtData,
  DemographicsData,
  EurostatData,
  FlowsData,
  MetaData,
  PensionData,
  RevenueData,
  TaxRevenueData,
} from "@/data/types";

export function useData() {
  return useMemo(() => {
    const debt = debtJson as DebtData;
    const demographics = demographicsJson as DemographicsData;
    const pensions = pensionsJson as PensionData;
    const budget = budgetJson as BudgetData;
    const eurostat = eurostatJson as EurostatData;
    const ccaaDebt = ccaaDebtJson as CcaaDebtData;
    const ccaaFiscalBalance = ccaaFiscalBalanceJson as CcaaFiscalBalanceData;
    const ccaaForalFlows = ccaaForalFlowsJson as CcaaForalFlowsData;
    const ccaaSpending = ccaaSpendingJson as CcaaSpendingData;
    const revenue = revenueJson as RevenueData;
    const taxRevenue = taxRevenueJson as TaxRevenueData;
    const flows = flowsJson as FlowsData;

    return {
      debt,
      pensions,
      demographics,
      budget,
      eurostat,
      ccaaDebt,
      ccaaFiscalBalance,
      ccaaForalFlows,
      ccaaSpending,
      revenue,
      taxRevenue,
      flows,
      meta: metaJson as MetaData,
    };
  }, []);
}
