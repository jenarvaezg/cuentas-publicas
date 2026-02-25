import type {
  CcaaForalFlowsData,
  CcaaSpendingData,
  DemographicsData,
  FlowsYearData,
  PensionsRegionalData,
  RegionalAccountsData,
  SankeyLink,
  SankeyNode,
  TaxRevenueData,
  UnemploymentRegionalData,
} from "@/data/types";

export interface WhatIfSimulationInput {
  yearData: FlowsYearData | null;
  excludedRegions: string[];
  whatIfAvailable: boolean;
  taxRevenue: TaxRevenueData | null;
  ccaaSpending: CcaaSpendingData | null;
  ccaaForalFlows: CcaaForalFlowsData | null;
  pensionsRegional: PensionsRegionalData | null;
  unemploymentRegional: UnemploymentRegionalData | null;
  regionalAccounts: RegionalAccountsData | null;
  demographics: DemographicsData | null;
  superavitLabel: string;
}

export interface WhatIfSimulationOutput {
  activeNodes: SankeyNode[];
  activeLinks: SankeyLink[];
}

export function computeWhatIfSimulation({
  yearData,
  excludedRegions,
  whatIfAvailable,
  taxRevenue,
  ccaaSpending,
  ccaaForalFlows,
  pensionsRegional,
  unemploymentRegional,
  regionalAccounts,
  demographics,
  superavitLabel,
}: WhatIfSimulationInput): WhatIfSimulationOutput {
  if (!yearData) return { activeNodes: [], activeLinks: [] };

  // Deep clone to avoid mutating original data
  const currentNodes = yearData.nodes.map((n) => ({ ...n }));
  const currentLinks = yearData.links.map((l) => ({ ...l }));

  if (excludedRegions.length === 0 || !whatIfAvailable) {
    return { activeNodes: currentNodes, activeLinks: currentLinks };
  }

  let totalIncomeSubtracted = 0;
  let directTaxesSubtracted = 0;
  let indirectTaxesSubtracted = 0;
  let cotizacionesSubtracted = 0;
  let otrosIngresosSubtracted = 0;
  let totalExpenseSubtracted = 0;

  // Store original amounts before any subtraction for What-If attribution
  const originalAmounts: Record<string, number> = {};
  for (const node of currentNodes) {
    originalAmounts[node.id] = node.amount;
  }

  const subtractFromNodeAndLink = (
    nodeId: string,
    amountToSubtract: number,
    isInput: boolean,
    isProportional = false,
  ): number => {
    if (amountToSubtract <= 0) return 0;

    let actualSubtracted = 0;

    // Subtract from Node
    const node = currentNodes.find((n) => n.id === nodeId);
    if (node) {
      actualSubtracted = Math.min(node.amount, amountToSubtract);
      node.amount = Math.max(0, node.amount - actualSubtracted);

      if (actualSubtracted > 0) {
        if (!node.whatIfAttribution) {
          node.whatIfAttribution = {
            originalAmount: originalAmounts[node.id] ?? node.amount + actualSubtracted,
            directSubtracted: 0,
            proportionalSubtracted: 0,
          };
        }
        if (isProportional) {
          node.whatIfAttribution.proportionalSubtracted += actualSubtracted;
        } else {
          node.whatIfAttribution.directSubtracted += actualSubtracted;
        }
      }
    }

    // Subtract from Link towards/from CONSOLIDADO
    let link: { amount: number } | undefined;
    if (isInput) {
      link = currentLinks.find(
        (l) =>
          l.source === nodeId &&
          (l.target === "INGRESOS_TOTALES" ||
            l.target === "IMPUESTOS_DIRECTOS" ||
            l.target === "IMPUESTOS_INDIRECTOS" ||
            l.target === "CONSOLIDADO"),
      );
    } else {
      link = currentLinks.find((l) => l.target === nodeId && l.source === "CONSOLIDADO");
    }

    if (link) {
      link.amount = Math.max(0, link.amount - actualSubtracted);
    }

    return actualSubtracted;
  };

  // Precompute central spending residuals (Sankey total − sum of all regional)
  const cofogRegionalTotals: Record<string, number> = {};
  const spendAllEntries = ccaaSpending?.byYear[ccaaSpending.latestYear]?.entries;
  if (spendAllEntries) {
    for (const entry of spendAllEntries) {
      for (const [div, amt] of Object.entries(entry.divisions)) {
        const nodeId =
          div === "01" ? "COFOG_01_RESTO" : div === "10" ? "COFOG_10_RESTO" : `COFOG_${div}`;
        cofogRegionalTotals[nodeId] = (cofogRegionalTotals[nodeId] || 0) + amt;
      }
    }
  }

  let totalRegionalPensions = 0;
  const pensionAllEntries = pensionsRegional?.byYear[String(pensionsRegional?.latestYear)]?.entries;
  if (pensionAllEntries) {
    for (const e of pensionAllEntries) {
      totalRegionalPensions += e.annualAmount / 1_000_000;
    }
  }

  let totalRegionalUnemployment = 0;
  const unemplAllEntries =
    unemploymentRegional?.byYear[String(unemploymentRegional?.latestYear)]?.entries;
  if (unemplAllEntries) {
    for (const e of unemplAllEntries) {
      totalRegionalUnemployment += e.amount / 1_000_000;
    }
  }

  // Resolve actual latest year for CCAA tax data (may lag behind national)
  const taxCcaaYears = taxRevenue?.ccaa ? Object.keys(taxRevenue.ccaa).map(Number) : [];
  const taxCcaaLatestYear = taxCcaaYears.length > 0 ? String(Math.max(...taxCcaaYears)) : null;
  const taxNationalYear = taxCcaaLatestYear ?? String(taxRevenue?.latestYear ?? "");

  const centralResiduals: Record<string, number> = {};
  for (const node of yearData.nodes) {
    if (node.id === "GASTO_INTERESES") {
      centralResiduals[node.id] = node.amount;
    } else if (node.id === "GASTO_PENSIONES") {
      centralResiduals[node.id] = Math.max(0, node.amount - totalRegionalPensions);
    } else if (node.id === "COFOG_10_RESTO") {
      centralResiduals[node.id] = Math.max(
        0,
        node.amount - (cofogRegionalTotals.COFOG_10_RESTO || 0) - totalRegionalUnemployment,
      );
    } else if (node.id.startsWith("COFOG_")) {
      centralResiduals[node.id] = Math.max(0, node.amount - (cofogRegionalTotals[node.id] || 0));
    }
  }

  // Precompute central tax residuals (Sankey tax node − sum of all regional attributions)
  const taxResiduals: Record<string, { amount: number; type: "direct" | "indirect" }> = {};
  {
    const allTaxEntries = taxCcaaLatestYear
      ? (taxRevenue?.ccaa[taxCcaaLatestYear]?.entries ?? [])
      : [];
    const commonTaxEntries = allTaxEntries.filter((e) => e.code !== "CA15" && e.code !== "CA16");
    const nationalData = taxRevenue?.national[taxNationalYear];

    let sumIrpf = commonTaxEntries.reduce((s, e) => s + e.irpf, 0);
    let sumIs = commonTaxEntries.reduce((s, e) => s + e.sociedades, 0);
    const sumIrnr = commonTaxEntries.reduce((s, e) => s + e.irnr, 0);
    let sumIva = commonTaxEntries.reduce((s, e) => s + e.iva, 0);
    const sumIiee = commonTaxEntries.reduce((s, e) => s + e.iiee, 0);

    // Add foral regime estimates (CA15/CA16 use taxRevenue split by national proportions)
    const foralEntriesAll = ccaaForalFlows?.byYear[ccaaForalFlows.latestYear]?.entries ?? [];
    if (nationalData && nationalData.total > 0) {
      for (const fe of foralEntriesAll) {
        const rev = fe.taxRevenue ?? 0;
        sumIrpf += rev * (nationalData.irpf / nationalData.total);
        sumIva += rev * (nationalData.iva / nationalData.total);
        sumIs += rev * (nationalData.sociedades / nationalData.total);
      }
    }

    const taxNodeResidualPairs: [string, number, "direct" | "indirect"][] = [
      ["IRPF", sumIrpf, "direct"],
      ["IS", sumIs, "direct"],
      ["IRNR", sumIrnr, "direct"],
      ["IVA", sumIva, "indirect"],
      ["IIEE", sumIiee, "indirect"],
    ];
    for (const [nodeId, sumRegional, type] of taxNodeResidualPairs) {
      const nodeAmount = yearData.nodes.find((n) => n.id === nodeId)?.amount ?? 0;
      const residual = Math.max(0, nodeAmount - sumRegional);
      if (residual > 0) {
        taxResiduals[nodeId] = { amount: residual, type };
      }
    }
  }

  // Aggregate subtractions across all excluded regions
  for (const regionId of excludedRegions) {
    // 1. Subtract Incomes (Taxes Collected in Region)
    if (regionId === "CA15" || regionId === "CA16") {
      const foralLatest = ccaaForalFlows?.byYear[ccaaForalFlows.latestYear]?.entries.find(
        (e) => e.code === regionId,
      );
      if (foralLatest && taxRevenue?.national[taxNationalYear]) {
        const nationalData = taxRevenue.national[taxNationalYear];
        const irpfProp = nationalData.irpf / nationalData.total;
        const ivaProp = nationalData.iva / nationalData.total;
        const isProp = nationalData.sociedades / nationalData.total;

        const totalForalRevenue = foralLatest.taxRevenue ?? 0;
        const foralIrpf = totalForalRevenue * irpfProp;
        const foralIva = totalForalRevenue * ivaProp;
        const foralIs = totalForalRevenue * isProp;

        const actualForalIrpf = subtractFromNodeAndLink("IRPF", foralIrpf, true);
        const actualForalIs = subtractFromNodeAndLink("IS", foralIs, true);
        directTaxesSubtracted += actualForalIrpf + actualForalIs;

        const actualForalIva = subtractFromNodeAndLink("IVA", foralIva, true);
        indirectTaxesSubtracted += actualForalIva;
      }
    } else {
      const taxLatest = taxCcaaLatestYear
        ? taxRevenue?.ccaa[taxCcaaLatestYear]?.entries.find((e) => e.code === regionId)
        : undefined;
      if (taxLatest) {
        const actualIrpf = subtractFromNodeAndLink("IRPF", taxLatest.irpf, true);
        const actualIs = subtractFromNodeAndLink("IS", taxLatest.sociedades, true);
        const actualIrnr = subtractFromNodeAndLink("IRNR", taxLatest.irnr, true);
        directTaxesSubtracted += actualIrpf + actualIs + actualIrnr;

        const actualIva = subtractFromNodeAndLink("IVA", taxLatest.iva, true);
        const actualIiee = subtractFromNodeAndLink("IIEE", taxLatest.iiee, true);
        indirectTaxesSubtracted += actualIva + actualIiee;
      }
    }

    // 2. Subtract Expenses (General Spending executed by Regional Govt)
    const spendLatest = ccaaSpending?.byYear[ccaaSpending.latestYear]?.entries.find(
      (e) => e.code === regionId,
    );
    if (spendLatest) {
      for (const [div, amount] of Object.entries(spendLatest.divisions)) {
        const cofogNodeId =
          div === "01" ? "COFOG_01_RESTO" : div === "10" ? "COFOG_10_RESTO" : `COFOG_${div}`;
        const actualExpense = subtractFromNodeAndLink(cofogNodeId, amount, false);
        totalExpenseSubtracted += actualExpense;
      }
    }

    // 3. Subtract State-Level Expenses (Pensions and Unemployment proxy)
    const regionPensions = pensionsRegional?.byYear[
      String(pensionsRegional?.latestYear)
    ]?.entries.find((e) => e.code === regionId);
    if (regionPensions) {
      const regionPensionsMillions = regionPensions.annualAmount / 1_000_000;
      const actualPensions = subtractFromNodeAndLink(
        "GASTO_PENSIONES",
        regionPensionsMillions,
        false,
      );
      totalExpenseSubtracted += actualPensions;
    }

    // 4. Exact Regional Unemployment (COFOG_10_RESTO proxy replacement)
    const regionUnemployment = unemploymentRegional?.byYear[
      String(unemploymentRegional?.latestYear)
    ]?.entries.find((e) => e.code === regionId);

    if (regionUnemployment) {
      const regionUnemploymentMillions = regionUnemployment.amount / 1_000_000;
      const actualUnemployment = subtractFromNodeAndLink(
        "COFOG_10_RESTO",
        regionUnemploymentMillions,
        false,
      );
      totalExpenseSubtracted += actualUnemployment;
    } else if (demographics) {
      // Fallback to demographic proportion if data is missing for this region
      const ccaaDemo = (demographics as unknown as Record<string, unknown>).ccaa as
        | Array<{ code: string; population: number }>
        | undefined;
      const regionDemo = ccaaDemo?.find((e) => e.code === regionId);
      if (regionDemo && demographics.population > 0) {
        const ratio = regionDemo.population / demographics.population;
        const originalUnemployment =
          yearData.nodes.find((n) => n.id === "COFOG_10_RESTO")?.amount || 0;
        const proportionalUnemployment = originalUnemployment * ratio;
        const actualUnemployment = subtractFromNodeAndLink(
          "COFOG_10_RESTO",
          proportionalUnemployment,
          false,
        );
        totalExpenseSubtracted += actualUnemployment;
      }
    }

    // 5. Subtract Social Contributions (proportional to regional share)
    // 6. Subtract Other Revenue (proportional to GDP share)
    const acctYear = regionalAccounts?.byYear[String(regionalAccounts?.latestYear)];
    const regionAcct = acctYear?.entries.find((e) => e.code === regionId);
    if (regionAcct && acctYear?.totals) {
      if (acctYear.totals.socialContributions > 0) {
        const cotizProportion =
          regionAcct.socialContributions / acctYear.totals.socialContributions;
        const originalCotiz = yearData.nodes.find((n) => n.id === "COTIZACIONES")?.amount || 0;
        const cotizToSubtract = originalCotiz * cotizProportion;
        cotizacionesSubtracted += subtractFromNodeAndLink(
          "COTIZACIONES",
          cotizToSubtract,
          true,
          true,
        );
      }

      if (acctYear.totals.gdp > 0) {
        const gdpProportion = regionAcct.gdp / acctYear.totals.gdp;
        const originalOtros = yearData.nodes.find((n) => n.id === "OTROS_INGRESOS")?.amount || 0;
        const otrosToSubtract = originalOtros * gdpProportion;
        otrosIngresosSubtracted += subtractFromNodeAndLink(
          "OTROS_INGRESOS",
          otrosToSubtract,
          true,
          true,
        );

        // 7. Subtract central spending residuals (GDP-proportional)
        for (const [nodeId, residual] of Object.entries(centralResiduals)) {
          if (residual > 0) {
            totalExpenseSubtracted += subtractFromNodeAndLink(
              nodeId,
              residual * gdpProportion,
              false,
              true,
            );
          }
        }

        // 8. Subtract central tax residuals (GDP-proportional)
        for (const [nodeId, { amount: residual, type }] of Object.entries(taxResiduals)) {
          if (residual > 0) {
            const actualTaxResidual = subtractFromNodeAndLink(
              nodeId,
              residual * gdpProportion,
              true,
              true,
            );
            if (type === "direct") {
              directTaxesSubtracted += actualTaxResidual;
            } else {
              indirectTaxesSubtracted += actualTaxResidual;
            }
          }
        }
      }
    }
  }

  totalIncomeSubtracted =
    directTaxesSubtracted +
    indirectTaxesSubtracted +
    cotizacionesSubtracted +
    otrosIngresosSubtracted;

  // Propagate aggregated income subtraction to intermediate aggregators
  if (directTaxesSubtracted > 0) {
    subtractFromNodeAndLink("IMPUESTOS_DIRECTOS", directTaxesSubtracted, true);
  }
  if (indirectTaxesSubtracted > 0) {
    subtractFromNodeAndLink("IMPUESTOS_INDIRECTOS", indirectTaxesSubtracted, true);
  }

  // Propagate aggregated income subtraction to global aggregator
  const ingresosTotales = currentNodes.find((n) => n.id === "INGRESOS_TOTALES");
  if (ingresosTotales && totalIncomeSubtracted > 0) {
    ingresosTotales.amount = Math.max(0, ingresosTotales.amount - totalIncomeSubtracted);
    const sumInLink = currentLinks.find(
      (l) => l.source === "INGRESOS_TOTALES" && l.target === "CONSOLIDADO",
    );
    if (sumInLink) sumInLink.amount = Math.max(0, sumInLink.amount - totalIncomeSubtracted);
  }

  // Re-balance the deficit and central nodes
  const consolidadoNode = currentNodes.find((n) => n.id === "CONSOLIDADO");
  if (consolidadoNode && totalExpenseSubtracted > 0) {
    consolidadoNode.amount = Math.max(0, consolidadoNode.amount - totalExpenseSubtracted);
  }

  const netBalanceImpact = totalExpenseSubtracted - totalIncomeSubtracted;

  // Adjust the Deficit Node
  const deficitNode = currentNodes.find((n) => n.id === "DEFICIT");
  const deficitLink = currentLinks.find((l) => l.source === "DEFICIT");

  if (deficitNode && deficitLink) {
    const newDeficit = deficitNode.amount - netBalanceImpact;
    // If it goes negative (surplus!), create a Surplus node to keep DAG balanced
    if (newDeficit < 0) {
      deficitNode.amount = 0;
      deficitLink.amount = 0;

      const surplusAmount = Math.abs(newDeficit);
      currentNodes.push({
        id: "SUPERAVIT",
        label: superavitLabel,
        group: "income",
        amount: surplusAmount,
      } as SankeyNode);

      currentLinks.push({
        id: "l_superavit_gen",
        source: "CONSOLIDADO",
        target: "SUPERAVIT",
        amount: surplusAmount,
      } as SankeyLink);
    } else {
      deficitNode.amount = newDeficit;
      deficitLink.amount = newDeficit;
    }
  }

  return { activeNodes: currentNodes, activeLinks: currentLinks };
}
