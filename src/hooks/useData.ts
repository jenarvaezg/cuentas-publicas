import { useMemo } from "react";
import budgetJson from "@/data/budget.json";

import debtJson from "@/data/debt.json";
import demographicsJson from "@/data/demographics.json";
import metaJson from "@/data/meta.json";
import pensionsJson from "@/data/pensions.json";
import type { BudgetData, DebtData, DemographicsData, MetaData, PensionData } from "@/data/types";

// Fallback interest expense (~2.3% average cost on total debt)
const FALLBACK_INTEREST_EXPENSE = 39_000_000_000;

export function useData() {
  return useMemo(() => {
    const debt = debtJson as DebtData;
    const demographics = demographicsJson as DemographicsData;
    const pensions = pensionsJson as PensionData;
    const budget = budgetJson as BudgetData;

    // Compute derived values that the download script may not have extracted
    const currentDebt = debt.regression.intercept + debt.regression.slope * Date.now();
    const debtToGDP = debt.current.debtToGDP || (currentDebt / demographics.gdp) * 100;
    const interestExpense = debt.current.interestExpense || FALLBACK_INTEREST_EXPENSE;

    const enrichedDebt: DebtData = {
      ...debt,
      current: {
        ...debt.current,
        debtToGDP,
        interestExpense,
      },
    };

    return {
      debt: enrichedDebt,
      pensions,
      demographics,
      budget,
      meta: metaJson as MetaData,
    };
  }, []);
}
