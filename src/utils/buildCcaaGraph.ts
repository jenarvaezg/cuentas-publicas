import type {
  CcaaForalFlowsData,
  CcaaSpendingData,
  FlowsYearData,
  PensionsRegionalData,
  RegionalAccountsData,
  SankeyLink,
  SankeyNode,
  TaxRevenueData,
  UnemploymentRegionalData,
} from "@/data/types";

/** All CCAA codes with their canonical Spanish names */
export const CCAA_NAMES: Record<string, string> = {
  CA01: "Andalucía",
  CA02: "Aragón",
  CA03: "Principado de Asturias",
  CA04: "Illes Balears",
  CA05: "Canarias",
  CA06: "Cantabria",
  CA07: "Castilla y León",
  CA08: "Castilla-La Mancha",
  CA09: "Cataluña",
  CA10: "Comunitat Valenciana",
  CA11: "Extremadura",
  CA12: "Galicia",
  CA13: "Comunidad de Madrid",
  CA14: "Región de Murcia",
  CA15: "Comunidad Foral de Navarra",
  CA16: "País Vasco",
  CA17: "La Rioja",
};

/**
 * CCAA population (INE Cifras de Población, 1 enero 2024).
 * Used for per-capita calculations when viewing a single CCAA Sankey.
 * Source: https://www.ine.es/jaxiT3/Tabla.htm?t=2853
 */
export const CCAA_POPULATION: Record<string, number> = {
  CA01: 8_632_080,
  CA02: 1_340_560,
  CA03: 1_004_450,
  CA04: 1_209_990,
  CA05: 2_244_400,
  CA06: 589_430,
  CA07: 2_365_070,
  CA08: 2_107_880,
  CA09: 8_021_880,
  CA10: 5_216_580,
  CA11: 1_055_920,
  CA12: 2_690_460,
  CA13: 7_028_660,
  CA14: 1_564_670,
  CA15: 672_760,
  CA16: 2_232_920,
  CA17: 322_070,
};

export interface CcaaGraphInput {
  ccaaCode: string;
  nationalYearData: FlowsYearData;
  taxRevenue: TaxRevenueData | null;
  ccaaSpending: CcaaSpendingData | null;
  ccaaForalFlows: CcaaForalFlowsData | null;
  pensionsRegional: PensionsRegionalData | null;
  unemploymentRegional: UnemploymentRegionalData | null;
  regionalAccounts: RegionalAccountsData | null;
}

/**
 * Builds a Sankey DAG for a single CCAA, using the same node structure
 * as the national graph for visual consistency and comparability.
 *
 * Income = taxes collected in CCAA + proportional SS + proportional other
 * Spending = COFOG regional + pensions + unemployment + proportional central
 * Balance = net transfer (in if receiver, out if contributor)
 */
export function buildCcaaGraph(input: CcaaGraphInput): FlowsYearData | null {
  const {
    ccaaCode,
    nationalYearData,
    taxRevenue,
    ccaaSpending,
    ccaaForalFlows,
    pensionsRegional,
    unemploymentRegional,
    regionalAccounts,
  } = input;

  if (!nationalYearData || !regionalAccounts) return null;

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

  const isForal = ccaaCode === "CA15" || ccaaCode === "CA16";

  // ── Resolve proportions from regional accounts ─────────────────────
  const acctYear = regionalAccounts.byYear[String(regionalAccounts.latestYear)];
  const regionAcct = acctYear?.entries.find((e) => e.code === ccaaCode);
  if (!regionAcct || !acctYear?.totals) return null;

  const gdpProportion = acctYear.totals.gdp > 0 ? regionAcct.gdp / acctYear.totals.gdp : 0;
  const scProportion =
    acctYear.totals.socialContributions > 0
      ? regionAcct.socialContributions / acctYear.totals.socialContributions
      : 0;

  // ── Resolve tax year ───────────────────────────────────────────────
  const taxCcaaYears = taxRevenue?.ccaa ? Object.keys(taxRevenue.ccaa).map(Number) : [];
  const taxCcaaLatestYear = taxCcaaYears.length > 0 ? String(Math.max(...taxCcaaYears)) : null;
  const taxNationalYear = taxCcaaLatestYear ?? String(taxRevenue?.latestYear ?? "");
  const nationalTaxData = taxRevenue?.national[taxNationalYear];

  // ── Compute central residuals (national − sum regional) ────────────
  const allSpendEntries = ccaaSpending?.byYear[ccaaSpending.latestYear]?.entries ?? [];
  const cofogRegionalTotals: Record<string, number> = {};
  for (const entry of allSpendEntries) {
    for (const [div, amt] of Object.entries(entry.divisions)) {
      const nodeId =
        div === "01" ? "COFOG_01_RESTO" : div === "10" ? "COFOG_10_RESTO" : `COFOG_${div}`;
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

  const centralResiduals: Record<string, number> = {};
  for (const node of nationalYearData.nodes) {
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

  // ── Tax residuals (centrally-managed taxes not in AEAT delegaciones) ──
  const taxResiduals: Record<string, number> = {};
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

    const foralEntries = ccaaForalFlows?.byYear[ccaaForalFlows.latestYear]?.entries ?? [];
    if (nationalTaxData && nationalTaxData.total > 0) {
      for (const fe of foralEntries) {
        const rev = fe.taxRevenue ?? 0;
        sumIrpf += rev * (nationalTaxData.irpf / nationalTaxData.total);
        sumIva += rev * (nationalTaxData.iva / nationalTaxData.total);
        sumIs += rev * (nationalTaxData.sociedades / nationalTaxData.total);
      }
    }

    for (const [nodeId, sumRegional] of [
      ["IRPF", sumIrpf],
      ["IS", sumIs],
      ["IRNR", sumIrnr],
      ["IVA", sumIva],
      ["IIEE", sumIiee],
    ] as [string, number][]) {
      const nodeAmount = nationalYearData.nodes.find((n) => n.id === nodeId)?.amount ?? 0;
      const residual = Math.max(0, nodeAmount - sumRegional);
      if (residual > 0) taxResiduals[nodeId] = residual;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // INCOME SIDE
  // ═══════════════════════════════════════════════════════════════════

  let irpfAmount = 0;
  let isAmount = 0;
  let irnrAmount = 0;
  let ivaAmount = 0;
  let iieeAmount = 0;

  if (isForal) {
    // Foral: estimate breakdown from total taxRevenue using national proportions
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
    // Common regime: AEAT delegaciones + GDP-proportional tax residuals
    const taxEntry = taxCcaaLatestYear
      ? taxRevenue?.ccaa[taxCcaaLatestYear]?.entries.find((e) => e.code === ccaaCode)
      : undefined;
    if (taxEntry) {
      irpfAmount = taxEntry.irpf + (taxResiduals.IRPF ?? 0) * gdpProportion;
      isAmount = taxEntry.sociedades + (taxResiduals.IS ?? 0) * gdpProportion;
      irnrAmount = taxEntry.irnr + (taxResiduals.IRNR ?? 0) * gdpProportion;
      ivaAmount = taxEntry.iva + (taxResiduals.IVA ?? 0) * gdpProportion;
      iieeAmount = taxEntry.iiee + (taxResiduals.IIEE ?? 0) * gdpProportion;
    }
  }

  const directTaxes = irpfAmount + isAmount + irnrAmount;
  const indirectTaxes = ivaAmount + iieeAmount;

  // Social contributions (proportional to regional SC share)
  const originalCotiz = nationalYearData.nodes.find((n) => n.id === "COTIZACIONES")?.amount ?? 0;
  const cotizAmount = originalCotiz * scProportion;

  // Other income (proportional to GDP)
  const originalOtros = nationalYearData.nodes.find((n) => n.id === "OTROS_INGRESOS")?.amount ?? 0;
  const otrosAmount = originalOtros * gdpProportion;

  const totalIncome = directTaxes + indirectTaxes + cotizAmount + otrosAmount;

  // ═══════════════════════════════════════════════════════════════════
  // EXPENSE SIDE
  // ═══════════════════════════════════════════════════════════════════

  // COFOG = direct regional spending + GDP-proportional central residual
  const spendEntry = ccaaSpending?.byYear[ccaaSpending.latestYear]?.entries.find(
    (e) => e.code === ccaaCode,
  );

  const cofogAmounts: Record<string, number> = {};
  if (spendEntry) {
    for (const [div, amt] of Object.entries(spendEntry.divisions)) {
      const nodeId =
        div === "01" ? "COFOG_01_RESTO" : div === "10" ? "COFOG_10_RESTO" : `COFOG_${div}`;
      cofogAmounts[nodeId] = (amt as number) + (centralResiduals[nodeId] ?? 0) * gdpProportion;
    }
  }

  // Add COFOG nodes that only exist centrally (e.g., Defence in some CCAAs)
  for (const [nodeId, residual] of Object.entries(centralResiduals)) {
    if (nodeId.startsWith("COFOG_") && !(nodeId in cofogAmounts)) {
      cofogAmounts[nodeId] = residual * gdpProportion;
    }
  }

  // Pensions = direct regional + GDP-proportional central residual
  const pensionEntry = pensionsRegional?.byYear[String(pensionsRegional.latestYear)]?.entries.find(
    (e) => e.code === ccaaCode,
  );
  const pensionsDirect = pensionEntry ? pensionEntry.annualAmount / 1_000_000 : 0;
  const pensionsCentral = (centralResiduals.GASTO_PENSIONES ?? 0) * gdpProportion;
  const pensionsTotal = pensionsDirect + pensionsCentral;

  // Debt interest (purely central, GDP-proportional)
  const interestTotal = (centralResiduals.GASTO_INTERESES ?? 0) * gdpProportion;

  // Unemployment (add to COFOG_10_RESTO)
  const unemplEntry = unemploymentRegional?.byYear[
    String(unemploymentRegional.latestYear)
  ]?.entries.find((e) => e.code === ccaaCode);
  const unemploymentDirect = unemplEntry ? unemplEntry.amount / 1_000_000 : 0;
  cofogAmounts.COFOG_10_RESTO = (cofogAmounts.COFOG_10_RESTO ?? 0) + unemploymentDirect;

  // Total spending
  let totalSpending = pensionsTotal + interestTotal;
  for (const amt of Object.values(cofogAmounts)) {
    totalSpending += amt;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BALANCE (net fiscal transfer)
  // ═══════════════════════════════════════════════════════════════════

  // positive = CCAA receives net transfers, negative = CCAA contributes net
  const netTransfer = totalSpending - totalIncome;

  // CONSOLIDADO = throughput (larger of income or spending)
  const consolidadoAmount = Math.max(totalIncome, totalSpending);

  // ═══════════════════════════════════════════════════════════════════
  // BUILD THE GRAPH
  // ═══════════════════════════════════════════════════════════════════

  // Center
  addNode("CONSOLIDADO", "Actividad Fiscal", "core", Math.round(consolidadoAmount));

  // ── Income nodes ───────────────────────────────────────────────────
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

  // ── Balance node ───────────────────────────────────────────────────
  if (netTransfer > 100) {
    // Net receiver — transfers flow IN (like DEFICIT in national)
    addNode("TRANSFERENCIA_NETA", "Transferencia Neta (Recibe)", "income", Math.round(netTransfer));
    addLink("TRANSFERENCIA_NETA", "CONSOLIDADO", netTransfer, "Solidaridad Interterritorial");
  } else if (netTransfer < -100) {
    // Net contributor — contribution flows OUT
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

  // ── Expense nodes ──────────────────────────────────────────────────
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

  // COFOG categories (sorted by amount for visual consistency)
  const sortedCofog = Object.entries(cofogAmounts)
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a);

  for (const [nodeId, amount] of sortedCofog) {
    addNode(nodeId, nodeId, "expense_cofog", Math.round(amount));
    addLink("CONSOLIDADO", nodeId, amount);
  }

  // ── Fix rounding to guarantee mass balance ─────────────────────────
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

  // Update CONSOLIDADO to match actual throughput after rounding
  const consNode = nodes.find((n) => n.id === "CONSOLIDADO");
  if (consNode) {
    consNode.amount = links
      .filter((l) => l.target === "CONSOLIDADO")
      .reduce((s, l) => s + l.amount, 0);
  }

  return { nodes, links };
}
