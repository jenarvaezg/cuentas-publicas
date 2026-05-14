/**
 * Fiscal Projection — maps national Sankey data to regional views.
 *
 * Single seam for the three Sankey modes (national / focusOn / exclude),
 * with **Residuos centrales** and tax residuals computed once per year.
 * See CONTEXT.md for domain vocabulary; ADR-0001 for territorial scope.
 */
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

export type FlowGraph = FlowsYearData;

export interface FiscalProjectionInput {
  yearData: FlowsYearData;
  taxRevenue: TaxRevenueData | null;
  ccaaSpending: CcaaSpendingData | null;
  ccaaForalFlows: CcaaForalFlowsData | null;
  pensionsRegional: PensionsRegionalData | null;
  unemploymentRegional: UnemploymentRegionalData | null;
  regionalAccounts: RegionalAccountsData | null;
  demographics: DemographicsData | null;
  labels: { superavit: string };
}

export interface FiscalProjection {
  /** National Sankey: the base graph, untransformed. */
  national(): FlowGraph;
  /** Per-CCAA Sankey for focus mode. Returns null when data is insufficient. */
  focusOn(ccaa: string): FlowGraph | null;
  /** National Sankey with a set of CCAA excluded (What-If mode). */
  exclude(excluded: string[]): FlowGraph;
}

type TaxResidual = { amount: number; type: "direct" | "indirect" };

interface SharedState {
  taxCcaaLatestYear: string | null;
  taxNationalYear: string;
  /** Sum of regional COFOG spending per Sankey node (millions €). */
  cofogRegionalTotals: Record<string, number>;
  /** Sum of regional pensions across all CCAA (millions €). */
  totalRegionalPensions: number;
  /** Sum of regional unemployment across all CCAA (millions €). */
  totalRegionalUnemployment: number;
  /** Central residuals per Sankey node = national − Σ regional (millions €). */
  centralResiduals: Record<string, number>;
  /** Tax node residuals (centrally-managed taxes not in AEAT delegaciones). */
  taxResiduals: Record<string, TaxResidual>;
}

const cofogNodeId = (div: string): string => {
  if (div === "01") return "COFOG_01_RESTO";
  if (div === "10") return "COFOG_10_RESTO";
  return `COFOG_${div}`;
};

const computeSharedState = (input: FiscalProjectionInput): SharedState => {
  const {
    yearData,
    taxRevenue,
    ccaaSpending,
    ccaaForalFlows,
    pensionsRegional,
    unemploymentRegional,
  } = input;

  // CCAA tax data may lag national; resolve latest year independently.
  const taxCcaaYears = taxRevenue?.ccaa ? Object.keys(taxRevenue.ccaa).map(Number) : [];
  const taxCcaaLatestYear = taxCcaaYears.length > 0 ? String(Math.max(...taxCcaaYears)) : null;
  const taxNationalYear = taxCcaaLatestYear ?? String(taxRevenue?.latestYear ?? "");

  // Regional COFOG totals (sum across all 17 CCAA per Sankey node).
  const cofogRegionalTotals: Record<string, number> = {};
  const spendEntries = ccaaSpending?.byYear[ccaaSpending.latestYear]?.entries ?? [];
  for (const entry of spendEntries) {
    for (const [div, amt] of Object.entries(entry.divisions)) {
      const nodeId = cofogNodeId(div);
      cofogRegionalTotals[nodeId] = (cofogRegionalTotals[nodeId] || 0) + (amt as number);
    }
  }

  let totalRegionalPensions = 0;
  for (const e of pensionsRegional?.byYear[String(pensionsRegional.latestYear)]?.entries ?? []) {
    totalRegionalPensions += e.annualAmount / 1_000_000;
  }

  let totalRegionalUnemployment = 0;
  for (const e of unemploymentRegional?.byYear[String(unemploymentRegional.latestYear)]?.entries ??
    []) {
    totalRegionalUnemployment += e.amount / 1_000_000;
  }

  // Central residuals per Sankey expense node.
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

  // Tax residuals: national tax node − Σ regional attributions (common + foral).
  const taxResiduals: Record<string, TaxResidual> = {};
  {
    const allTaxEntries = taxCcaaLatestYear
      ? (taxRevenue?.ccaa[taxCcaaLatestYear]?.entries ?? [])
      : [];
    const commonTaxEntries = allTaxEntries.filter((e) => e.code !== "CA15" && e.code !== "CA16");

    let sumIrpf = commonTaxEntries.reduce((s, e) => s + e.irpf, 0);
    let sumIs = commonTaxEntries.reduce((s, e) => s + e.sociedades, 0);
    const sumIrnr = commonTaxEntries.reduce((s, e) => s + e.irnr, 0);
    let sumIva = commonTaxEntries.reduce((s, e) => s + e.iva, 0);
    const sumIiee = commonTaxEntries.reduce((s, e) => s + e.iiee, 0);

    const nationalTaxData = taxRevenue?.national[taxNationalYear];
    const foralEntries = ccaaForalFlows?.byYear[ccaaForalFlows.latestYear]?.entries ?? [];
    if (nationalTaxData && nationalTaxData.total > 0) {
      for (const fe of foralEntries) {
        const rev = fe.taxRevenue ?? 0;
        sumIrpf += rev * (nationalTaxData.irpf / nationalTaxData.total);
        sumIva += rev * (nationalTaxData.iva / nationalTaxData.total);
        sumIs += rev * (nationalTaxData.sociedades / nationalTaxData.total);
      }
    }

    const pairs: Array<[string, number, "direct" | "indirect"]> = [
      ["IRPF", sumIrpf, "direct"],
      ["IS", sumIs, "direct"],
      ["IRNR", sumIrnr, "direct"],
      ["IVA", sumIva, "indirect"],
      ["IIEE", sumIiee, "indirect"],
    ];
    for (const [nodeId, sumRegional, type] of pairs) {
      const nodeAmount = yearData.nodes.find((n) => n.id === nodeId)?.amount ?? 0;
      const residual = Math.max(0, nodeAmount - sumRegional);
      if (residual > 0) taxResiduals[nodeId] = { amount: residual, type };
    }
  }

  return {
    taxCcaaLatestYear,
    taxNationalYear,
    cofogRegionalTotals,
    totalRegionalPensions,
    totalRegionalUnemployment,
    centralResiduals,
    taxResiduals,
  };
};

// ═════════════════════════════════════════════════════════════════════
// MODE: NATIONAL
// ═════════════════════════════════════════════════════════════════════

const buildNational = (input: FiscalProjectionInput): FlowGraph => ({
  nodes: input.yearData.nodes.map((n) => ({ ...n })),
  links: input.yearData.links.map((l) => ({ ...l })),
});

// ═════════════════════════════════════════════════════════════════════
// MODE: FOCUS ON A SINGLE CCAA
// ═════════════════════════════════════════════════════════════════════

const buildFocus = (
  ccaaCode: string,
  input: FiscalProjectionInput,
  shared: SharedState,
): FlowGraph | null => {
  const {
    yearData,
    taxRevenue,
    ccaaSpending,
    ccaaForalFlows,
    pensionsRegional,
    unemploymentRegional,
    regionalAccounts,
  } = input;

  if (!regionalAccounts) return null;

  const acctYear = regionalAccounts.byYear[String(regionalAccounts.latestYear)];
  const regionAcct = acctYear?.entries.find((e) => e.code === ccaaCode);
  if (!regionAcct || !acctYear?.totals) return null;

  const gdpProportion = acctYear.totals.gdp > 0 ? regionAcct.gdp / acctYear.totals.gdp : 0;
  const scProportion =
    acctYear.totals.socialContributions > 0
      ? regionAcct.socialContributions / acctYear.totals.socialContributions
      : 0;

  const isForal = ccaaCode === "CA15" || ccaaCode === "CA16";
  const nationalTaxData = taxRevenue?.national[shared.taxNationalYear];

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  let linkIdCounter = 0;

  const addNode = (id: string, label: string, group: string, amount: number) => {
    nodes.push({ id, label, group, amount, format: "currency" } as SankeyNode);
  };

  const addLink = (source: string, target: string, amount: number, label = "") => {
    if (amount <= 0) return;
    links.push({
      id: `l_${linkIdCounter++}`,
      source,
      target,
      amount: Math.round(amount),
      label,
    } as SankeyLink);
  };

  // ── INCOME ──────────────────────────────────────────────────────────
  let irpfAmount = 0;
  let isAmount = 0;
  let irnrAmount = 0;
  let ivaAmount = 0;
  let iieeAmount = 0;

  if (isForal) {
    const foralEntry = ccaaForalFlows?.byYear[ccaaForalFlows.latestYear]?.entries.find(
      (e) => e.code === ccaaCode,
    );
    const totalForalRev = foralEntry?.taxRevenue ?? 0;
    if (nationalTaxData && nationalTaxData.total > 0) {
      irpfAmount = totalForalRev * (nationalTaxData.irpf / nationalTaxData.total);
      isAmount = totalForalRev * (nationalTaxData.sociedades / nationalTaxData.total);
      ivaAmount = totalForalRev * (nationalTaxData.iva / nationalTaxData.total);
      iieeAmount = totalForalRev * (nationalTaxData.iiee / nationalTaxData.total);
      irnrAmount = totalForalRev * (nationalTaxData.irnr / nationalTaxData.total);
    }
  } else {
    const taxEntry = shared.taxCcaaLatestYear
      ? taxRevenue?.ccaa[shared.taxCcaaLatestYear]?.entries.find((e) => e.code === ccaaCode)
      : undefined;
    if (taxEntry) {
      irpfAmount = taxEntry.irpf + (shared.taxResiduals.IRPF?.amount ?? 0) * gdpProportion;
      isAmount = taxEntry.sociedades + (shared.taxResiduals.IS?.amount ?? 0) * gdpProportion;
      irnrAmount = taxEntry.irnr + (shared.taxResiduals.IRNR?.amount ?? 0) * gdpProportion;
      ivaAmount = taxEntry.iva + (shared.taxResiduals.IVA?.amount ?? 0) * gdpProportion;
      iieeAmount = taxEntry.iiee + (shared.taxResiduals.IIEE?.amount ?? 0) * gdpProportion;
    }
  }

  const directTaxes = irpfAmount + isAmount + irnrAmount;
  const indirectTaxes = ivaAmount + iieeAmount;

  const originalCotiz = yearData.nodes.find((n) => n.id === "COTIZACIONES")?.amount ?? 0;
  const cotizAmount = originalCotiz * scProportion;

  const originalOtros = yearData.nodes.find((n) => n.id === "OTROS_INGRESOS")?.amount ?? 0;
  const otrosAmount = originalOtros * gdpProportion;

  const totalIncome = directTaxes + indirectTaxes + cotizAmount + otrosAmount;

  // ── EXPENSE ─────────────────────────────────────────────────────────
  const spendEntry = ccaaSpending?.byYear[ccaaSpending.latestYear]?.entries.find(
    (e) => e.code === ccaaCode,
  );

  const cofogAmounts: Record<string, number> = {};
  if (spendEntry) {
    for (const [div, amt] of Object.entries(spendEntry.divisions)) {
      const nodeId = cofogNodeId(div);
      cofogAmounts[nodeId] =
        (amt as number) + (shared.centralResiduals[nodeId] ?? 0) * gdpProportion;
    }
  }
  for (const [nodeId, residual] of Object.entries(shared.centralResiduals)) {
    if (nodeId.startsWith("COFOG_") && !(nodeId in cofogAmounts)) {
      cofogAmounts[nodeId] = residual * gdpProportion;
    }
  }

  const pensionEntry = pensionsRegional?.byYear[String(pensionsRegional.latestYear)]?.entries.find(
    (e) => e.code === ccaaCode,
  );
  const pensionsDirect = pensionEntry ? pensionEntry.annualAmount / 1_000_000 : 0;
  const pensionsCentral = (shared.centralResiduals.GASTO_PENSIONES ?? 0) * gdpProportion;
  const pensionsTotal = pensionsDirect + pensionsCentral;

  const interestTotal = (shared.centralResiduals.GASTO_INTERESES ?? 0) * gdpProportion;

  const unemplEntry = unemploymentRegional?.byYear[
    String(unemploymentRegional.latestYear)
  ]?.entries.find((e) => e.code === ccaaCode);
  const unemploymentDirect = unemplEntry ? unemplEntry.amount / 1_000_000 : 0;
  cofogAmounts.COFOG_10_RESTO = (cofogAmounts.COFOG_10_RESTO ?? 0) + unemploymentDirect;

  let totalSpending = pensionsTotal + interestTotal;
  for (const amt of Object.values(cofogAmounts)) totalSpending += amt;

  // ── BALANCE ─────────────────────────────────────────────────────────
  const netTransfer = totalSpending - totalIncome;
  const consolidadoAmount = Math.max(totalIncome, totalSpending);

  // ── GRAPH ───────────────────────────────────────────────────────────
  addNode("CONSOLIDADO", "Actividad Fiscal", "core", Math.round(consolidadoAmount));

  if (irpfAmount > 0) {
    addNode("IRPF", "IRPF", "tax_detail", Math.round(irpfAmount));
    addLink("IRPF", "IMPUESTOS_DIRECTOS", irpfAmount);
  }
  if (isAmount > 0) {
    addNode("IS", "Impuesto Sociedades", "tax_detail", Math.round(isAmount));
    addLink("IS", "IMPUESTOS_DIRECTOS", isAmount);
  }
  if (irnrAmount > 0) {
    addNode("IRNR", "Imp. Renta No Residentes", "tax_detail", Math.round(irnrAmount));
    addLink("IRNR", "IMPUESTOS_DIRECTOS", irnrAmount);
  }

  addNode("IMPUESTOS_DIRECTOS", "Impuestos Directos", "income_type", Math.round(directTaxes));
  addLink("IMPUESTOS_DIRECTOS", "INGRESOS_TOTALES", directTaxes);

  if (ivaAmount > 0) {
    addNode("IVA", "IVA", "tax_detail", Math.round(ivaAmount));
    addLink("IVA", "IMPUESTOS_INDIRECTOS", ivaAmount);
  }
  if (iieeAmount > 0) {
    addNode("IIEE", "Impuestos Especiales", "tax_detail", Math.round(iieeAmount));
    addLink("IIEE", "IMPUESTOS_INDIRECTOS", iieeAmount);
  }

  addNode("IMPUESTOS_INDIRECTOS", "Impuestos Indirectos", "income_type", Math.round(indirectTaxes));
  addLink("IMPUESTOS_INDIRECTOS", "INGRESOS_TOTALES", indirectTaxes);

  addNode("COTIZACIONES", "Cotizaciones Sociales", "income_type", Math.round(cotizAmount));
  addLink("COTIZACIONES", "INGRESOS_TOTALES", cotizAmount);

  addNode("OTROS_INGRESOS", "Otros Ingresos", "income_type", Math.round(otrosAmount));
  addLink("OTROS_INGRESOS", "INGRESOS_TOTALES", otrosAmount);

  addNode("INGRESOS_TOTALES", "Ingresos Atribuidos", "income_agg", Math.round(totalIncome));
  addLink("INGRESOS_TOTALES", "CONSOLIDADO", totalIncome);

  if (netTransfer > 100) {
    addNode("TRANSFERENCIA_NETA", "Transferencia Neta (Recibe)", "income", Math.round(netTransfer));
    addLink("TRANSFERENCIA_NETA", "CONSOLIDADO", netTransfer, "Solidaridad Interterritorial");
  } else if (netTransfer < -100) {
    addNode(
      "CONTRIBUCION_NETA",
      "Contribución Neta (Aporta)",
      "expense_specific",
      Math.round(Math.abs(netTransfer)),
    );
    addLink(
      "CONSOLIDADO",
      "CONTRIBUCION_NETA",
      Math.abs(netTransfer),
      "Solidaridad Interterritorial",
    );
  }

  if (pensionsTotal > 0) {
    addNode("GASTO_PENSIONES", "Pensiones", "expense_specific", Math.round(pensionsTotal));
    addLink("CONSOLIDADO", "GASTO_PENSIONES", pensionsTotal);
  }

  if (interestTotal > 0) {
    addNode(
      "GASTO_INTERESES",
      "Intereses Deuda Pública",
      "expense_specific",
      Math.round(interestTotal),
    );
    addLink("CONSOLIDADO", "GASTO_INTERESES", interestTotal);
  }

  const sortedCofog = Object.entries(cofogAmounts)
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a);
  for (const [nodeId, amount] of sortedCofog) {
    addNode(nodeId, nodeId, "expense_cofog", Math.round(amount));
    addLink("CONSOLIDADO", nodeId, amount);
  }

  // Mass balance fix-up (absorb rounding into largest output link).
  const totalIn = links.filter((l) => l.target === "CONSOLIDADO").reduce((s, l) => s + l.amount, 0);
  const totalOut = links
    .filter((l) => l.source === "CONSOLIDADO")
    .reduce((s, l) => s + l.amount, 0);
  const roundingDiff = totalIn - totalOut;

  if (roundingDiff !== 0) {
    const outputLinks = links.filter((l) => l.source === "CONSOLIDADO");
    const largest = [...outputLinks].sort((a, b) => b.amount - a.amount)[0];
    if (largest) {
      largest.amount += roundingDiff;
      const targetNode = nodes.find((n) => n.id === largest.target);
      if (targetNode) targetNode.amount += roundingDiff;
    }
  }

  const consNode = nodes.find((n) => n.id === "CONSOLIDADO");
  if (consNode) {
    consNode.amount = links
      .filter((l) => l.target === "CONSOLIDADO")
      .reduce((s, l) => s + l.amount, 0);
  }

  return { nodes, links };
};

// ═════════════════════════════════════════════════════════════════════
// MODE: EXCLUDE CCAA (What-If)
// ═════════════════════════════════════════════════════════════════════

const buildExclude = (
  excludedRegions: string[],
  input: FiscalProjectionInput,
  shared: SharedState,
): FlowGraph => {
  const {
    yearData,
    taxRevenue,
    ccaaSpending,
    ccaaForalFlows,
    pensionsRegional,
    unemploymentRegional,
    regionalAccounts,
    demographics,
    labels,
  } = input;

  const currentNodes: SankeyNode[] = yearData.nodes.map((n) => ({ ...n }));
  const currentLinks: SankeyLink[] = yearData.links.map((l) => ({ ...l }));

  if (excludedRegions.length === 0) {
    return { nodes: currentNodes, links: currentLinks };
  }

  let totalIncomeSubtracted = 0;
  let directTaxesSubtracted = 0;
  let indirectTaxesSubtracted = 0;
  let cotizacionesSubtracted = 0;
  let otrosIngresosSubtracted = 0;
  let totalExpenseSubtracted = 0;

  const originalAmounts: Record<string, number> = {};
  for (const node of currentNodes) originalAmounts[node.id] = node.amount;

  const subtractFromNodeAndLink = (
    nodeId: string,
    amountToSubtract: number,
    isInput: boolean,
    isProportional = false,
  ): number => {
    if (amountToSubtract <= 0) return 0;
    let actualSubtracted = 0;

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
    if (link) link.amount = Math.max(0, link.amount - actualSubtracted);

    return actualSubtracted;
  };

  for (const regionId of excludedRegions) {
    // 1. Income — taxes collected in region
    if (regionId === "CA15" || regionId === "CA16") {
      const foralLatest = ccaaForalFlows?.byYear[ccaaForalFlows.latestYear]?.entries.find(
        (e) => e.code === regionId,
      );
      const nationalData = taxRevenue?.national[shared.taxNationalYear];
      if (foralLatest && nationalData) {
        const totalForalRevenue = foralLatest.taxRevenue ?? 0;
        const foralIrpf = totalForalRevenue * (nationalData.irpf / nationalData.total);
        const foralIva = totalForalRevenue * (nationalData.iva / nationalData.total);
        const foralIs = totalForalRevenue * (nationalData.sociedades / nationalData.total);

        directTaxesSubtracted +=
          subtractFromNodeAndLink("IRPF", foralIrpf, true) +
          subtractFromNodeAndLink("IS", foralIs, true);
        indirectTaxesSubtracted += subtractFromNodeAndLink("IVA", foralIva, true);
      }
    } else {
      const taxLatest = shared.taxCcaaLatestYear
        ? taxRevenue?.ccaa[shared.taxCcaaLatestYear]?.entries.find((e) => e.code === regionId)
        : undefined;
      if (taxLatest) {
        directTaxesSubtracted +=
          subtractFromNodeAndLink("IRPF", taxLatest.irpf, true) +
          subtractFromNodeAndLink("IS", taxLatest.sociedades, true) +
          subtractFromNodeAndLink("IRNR", taxLatest.irnr, true);
        indirectTaxesSubtracted +=
          subtractFromNodeAndLink("IVA", taxLatest.iva, true) +
          subtractFromNodeAndLink("IIEE", taxLatest.iiee, true);
      }
    }

    // 2. Regional COFOG spending (direct subtraction).
    const spendLatest = ccaaSpending?.byYear[ccaaSpending.latestYear]?.entries.find(
      (e) => e.code === regionId,
    );
    if (spendLatest) {
      for (const [div, amount] of Object.entries(spendLatest.divisions)) {
        totalExpenseSubtracted += subtractFromNodeAndLink(cofogNodeId(div), amount, false);
      }
    }

    // 3. Regional pensions (direct).
    const regionPensions = pensionsRegional?.byYear[
      String(pensionsRegional?.latestYear)
    ]?.entries.find((e) => e.code === regionId);
    if (regionPensions) {
      totalExpenseSubtracted += subtractFromNodeAndLink(
        "GASTO_PENSIONES",
        regionPensions.annualAmount / 1_000_000,
        false,
      );
    }

    // 4. Regional unemployment (direct, or fallback to population proxy).
    const regionUnemployment = unemploymentRegional?.byYear[
      String(unemploymentRegional?.latestYear)
    ]?.entries.find((e) => e.code === regionId);

    if (regionUnemployment) {
      totalExpenseSubtracted += subtractFromNodeAndLink(
        "COFOG_10_RESTO",
        regionUnemployment.amount / 1_000_000,
        false,
      );
    } else if (demographics) {
      const ccaaDemo = (demographics as unknown as Record<string, unknown>).ccaa as
        | Array<{ code: string; population: number }>
        | undefined;
      const regionDemo = ccaaDemo?.find((e) => e.code === regionId);
      if (regionDemo && demographics.population > 0) {
        const ratio = regionDemo.population / demographics.population;
        const originalUnemployment =
          yearData.nodes.find((n) => n.id === "COFOG_10_RESTO")?.amount || 0;
        totalExpenseSubtracted += subtractFromNodeAndLink(
          "COFOG_10_RESTO",
          originalUnemployment * ratio,
          false,
        );
      }
    }

    // 5/6. Social contributions + other income (PIB-proportional).
    const acctYear = regionalAccounts?.byYear[String(regionalAccounts?.latestYear)];
    const regionAcct = acctYear?.entries.find((e) => e.code === regionId);
    if (regionAcct && acctYear?.totals) {
      if (acctYear.totals.socialContributions > 0) {
        const cotizProportion =
          regionAcct.socialContributions / acctYear.totals.socialContributions;
        const originalCotiz = yearData.nodes.find((n) => n.id === "COTIZACIONES")?.amount || 0;
        cotizacionesSubtracted += subtractFromNodeAndLink(
          "COTIZACIONES",
          originalCotiz * cotizProportion,
          true,
          true,
        );
      }

      if (acctYear.totals.gdp > 0) {
        const gdpProportion = regionAcct.gdp / acctYear.totals.gdp;
        const originalOtros = yearData.nodes.find((n) => n.id === "OTROS_INGRESOS")?.amount || 0;
        otrosIngresosSubtracted += subtractFromNodeAndLink(
          "OTROS_INGRESOS",
          originalOtros * gdpProportion,
          true,
          true,
        );

        // 7. Central spending residuals (PIB-proportional).
        for (const [nodeId, residual] of Object.entries(shared.centralResiduals)) {
          if (residual > 0) {
            totalExpenseSubtracted += subtractFromNodeAndLink(
              nodeId,
              residual * gdpProportion,
              false,
              true,
            );
          }
        }

        // 8. Central tax residuals (PIB-proportional).
        for (const [nodeId, { amount: residual, type }] of Object.entries(shared.taxResiduals)) {
          if (residual > 0) {
            const actual = subtractFromNodeAndLink(nodeId, residual * gdpProportion, true, true);
            if (type === "direct") directTaxesSubtracted += actual;
            else indirectTaxesSubtracted += actual;
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

  if (directTaxesSubtracted > 0) {
    subtractFromNodeAndLink("IMPUESTOS_DIRECTOS", directTaxesSubtracted, true);
  }
  if (indirectTaxesSubtracted > 0) {
    subtractFromNodeAndLink("IMPUESTOS_INDIRECTOS", indirectTaxesSubtracted, true);
  }

  const ingresosTotales = currentNodes.find((n) => n.id === "INGRESOS_TOTALES");
  if (ingresosTotales && totalIncomeSubtracted > 0) {
    ingresosTotales.amount = Math.max(0, ingresosTotales.amount - totalIncomeSubtracted);
    const sumInLink = currentLinks.find(
      (l) => l.source === "INGRESOS_TOTALES" && l.target === "CONSOLIDADO",
    );
    if (sumInLink) sumInLink.amount = Math.max(0, sumInLink.amount - totalIncomeSubtracted);
  }

  const consolidadoNode = currentNodes.find((n) => n.id === "CONSOLIDADO");
  if (consolidadoNode && totalExpenseSubtracted > 0) {
    consolidadoNode.amount = Math.max(0, consolidadoNode.amount - totalExpenseSubtracted);
  }

  // Rebalance Déficit público — may go to surplus when excluded contributors outweigh excluded recipients.
  const netBalanceImpact = totalExpenseSubtracted - totalIncomeSubtracted;
  const deficitNode = currentNodes.find((n) => n.id === "DEFICIT");
  const deficitLink = currentLinks.find((l) => l.source === "DEFICIT");

  if (deficitNode && deficitLink) {
    const newDeficit = deficitNode.amount - netBalanceImpact;
    if (newDeficit < 0) {
      deficitNode.amount = 0;
      deficitLink.amount = 0;
      const surplusAmount = Math.abs(newDeficit);
      currentNodes.push({
        id: "SUPERAVIT",
        label: labels.superavit,
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

  return { nodes: currentNodes, links: currentLinks };
};

// ═════════════════════════════════════════════════════════════════════
// PUBLIC FACTORY
// ═════════════════════════════════════════════════════════════════════

export const createFiscalProjection = (input: FiscalProjectionInput): FiscalProjection => {
  const shared = computeSharedState(input);
  return {
    national: () => buildNational(input),
    focusOn: (ccaa: string) => buildFocus(ccaa, input, shared),
    exclude: (excluded: string[]) => buildExclude(excluded, input, shared),
  };
};
