import { useMemo } from "react";
import budgetJson from "@/data/budget.json";
import ccaaDebtJson from "@/data/ccaa-debt.json";
import ccaaDeficitJson from "@/data/ccaa-deficit.json";
import ccaaFiscalBalanceJson from "@/data/ccaa-fiscal-balance.json";
import ccaaForalFlowsJson from "@/data/ccaa-foral-flows.json";
import ccaaSpendingJson from "@/data/ccaa-spending.json";
import debtJson from "@/data/debt.json";
import demographicsJson from "@/data/demographics.json";
import eurostatJson from "@/data/eurostat.json";
import flowsJson from "@/data/flows.json";
import metaJson from "@/data/meta.json";
import pensionsJson from "@/data/pensions.json";
import pensionsRegionalJson from "@/data/pensions-regional.json";
import regionalAccountsJson from "@/data/regional-accounts.json";
import revenueJson from "@/data/revenue.json";
import ssSustainabilityJson from "@/data/ss-sustainability.json";
import taxRevenueJson from "@/data/tax-revenue.json";
import type {
  BudgetData,
  CcaaDebtData,
  CcaaDeficitData,
  CcaaFiscalBalanceData,
  CcaaForalFlowsData,
  CcaaSpendingData,
  DebtData,
  DemographicsData,
  EurostatData,
  FlowsData,
  MetaData,
  PensionData,
  PensionsRegionalData,
  RegionalAccountsData,
  RevenueData,
  SSSustainabilityData,
  TaxRevenueData,
  UnemploymentRegionalData,
} from "@/data/types";
import unemploymentRegionalJson from "@/data/unemployment-regional.json";

export function useData() {
  return useMemo(() => {
    const debt = debtJson as DebtData;
    const demographics = demographicsJson as DemographicsData;
    const pensions = pensionsJson as PensionData;
    const pensionsRegional = pensionsRegionalJson as PensionsRegionalData;
    const budget = budgetJson as BudgetData;
    const eurostat = eurostatJson as EurostatData;
    const ccaaDebt = ccaaDebtJson as CcaaDebtData;
    const ccaaDeficit = ccaaDeficitJson as CcaaDeficitData;
    const rawCcaaFiscalBalance = ccaaFiscalBalanceJson as CcaaFiscalBalanceData;
    const ccaaForalFlows = ccaaForalFlowsJson as CcaaForalFlowsData;

    // Inject synthetic Foral records into Fiscal Balances
    const ccaaFiscalBalance: CcaaFiscalBalanceData = {
      ...rawCcaaFiscalBalance,
      byYear: { ...rawCcaaFiscalBalance.byYear },
    };

    for (const yearStr of Object.keys(ccaaFiscalBalance.byYear)) {
      const foralYearData = ccaaForalFlows.byYear[yearStr];
      if (!foralYearData) continue;

      const newEntries = [...ccaaFiscalBalance.byYear[yearStr].entries];

      for (const foralEntry of foralYearData.entries) {
        const netContribution =
          foralEntry.netFlowToState != null ? foralEntry.netFlowToState : foralEntry.paymentToState;

        newEntries.push({
          code: foralEntry.code,
          name: foralEntry.name,
          cededTaxes: 0,
          transfers: 0,
          netBalance: -netContribution,
          transferToTaxRatio: null,
          cededTaxesBreakdown: { irpf: 0, iva: 0, iiee: 0 },
          transfersBreakdown: {
            fondoGarantia: 0,
            fondoSuficiencia: 0,
            fondoCompetitividad: 0,
            fondoCooperacion: 0,
          },
        });
      }

      newEntries.sort((a, b) => a.code.localeCompare(b.code));
      ccaaFiscalBalance.byYear[yearStr] = {
        ...ccaaFiscalBalance.byYear[yearStr],
        entries: newEntries,
      };
    }

    const ccaaSpending = ccaaSpendingJson as CcaaSpendingData;
    const regionalAccounts = regionalAccountsJson as RegionalAccountsData;
    const revenue = revenueJson as RevenueData;
    const taxRevenue = taxRevenueJson as TaxRevenueData;
    const flows = flowsJson as FlowsData;
    const ssSustainability = ssSustainabilityJson as SSSustainabilityData;
    const unemploymentRegional = unemploymentRegionalJson as UnemploymentRegionalData;

    return {
      debt,
      pensions,
      pensionsRegional,
      demographics,
      budget,
      eurostat,
      ccaaDebt,
      ccaaDeficit,
      ccaaFiscalBalance,
      ccaaForalFlows,
      ccaaSpending,
      regionalAccounts,
      revenue,
      taxRevenue,
      flows,
      ssSustainability,
      unemploymentRegional,
      meta: metaJson as MetaData,
    };
  }, []);
}
