import { ResponsiveSankey } from "@nivo/sankey";
import { Info, ZoomOut } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SankeyLink, SankeyNode } from "@/data/types";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { buildCcaaGraph, CCAA_NAMES } from "@/utils/buildCcaaGraph";
import { formatCompact } from "@/utils/formatters";

// Helper to filter graph to a specific selected node's forward/backward paths
const getFilteredGraph = (
  nodes: SankeyNode[],
  links: SankeyLink[],
  centralNodeId: string | null,
) => {
  if (!centralNodeId) return { nodes, links };

  const connectedLinkIds = new Set();
  const connectedNodeIds = new Set();

  // A queue for BFS to find all reachable nodes upstream and downstream
  const findConnections = (startNodeId: string, direction: "upstream" | "downstream") => {
    const queue = [startNodeId];
    if (!connectedNodeIds.has(startNodeId)) connectedNodeIds.add(startNodeId);

    while (queue.length > 0) {
      const current = queue.shift() as string;
      const relevantLinks = links.filter((l: SankeyLink) =>
        direction === "upstream" ? l.target === current : l.source === current,
      );

      for (const link of relevantLinks) {
        connectedLinkIds.add(link.id);
        const nextNode: string = direction === "upstream" ? link.source : link.target;
        if (!connectedNodeIds.has(nextNode)) {
          connectedNodeIds.add(nextNode);
          queue.push(nextNode);
        }
      }
    }
  };

  // Traverse both ways from selected node
  findConnections(centralNodeId, "upstream");
  findConnections(centralNodeId, "downstream");

  return {
    nodes: nodes.filter((n: SankeyNode) => connectedNodeIds.has(n.id)),
    links: links.filter((l: SankeyLink) => connectedLinkIds.has(l.id)),
  };
};

// Colors mapping using React-friendly CSS variables
const groupColors: Record<string, string> = {
  core: "hsl(var(--muted-foreground))", // slate-500 equivalent
  income: "hsl(var(--destructive))", // red-500
  income_agg: "hsl(142.1 76.2% 36.3%)", // green-600
  income_type: "hsl(142.1 76.2% 36.3%)", // green-600
  tax_detail: "hsl(142.1 76.2% 36.3%)", // green-600
  expense_cofog: "hsl(217.2 91.2% 59.8%)", // blue-500
  expense_specific: "hsl(199.4 89% 47.6%)", // sky-500
};

export const FlowsSankeyBlock: React.FC = () => {
  const {
    flows,
    taxRevenue,
    ccaaSpending,
    ccaaForalFlows,
    pensionsRegional,
    unemploymentRegional,
    regionalAccounts,
    demographics,
  } = useData();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [excludedRegions, setExcludedRegions] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(flows?.latestYear ?? 2024);
  const [scope, setScope] = useState<string>("national");
  const { lang } = useI18n();

  // What-If is only available for the latest year in national scope
  const whatIfAvailable = selectedYear === flows?.latestYear && scope === "national";

  // Clear exclusions when What-If becomes unavailable
  useEffect(() => {
    if (!whatIfAvailable) {
      setExcludedRegions([]);
    }
  }, [whatIfAvailable]);

  // Force latest year when entering CCAA mode (regional data is single-year)
  useEffect(() => {
    if (scope !== "national" && flows?.latestYear) {
      setSelectedYear(flows.latestYear);
    }
  }, [scope, flows?.latestYear]);

  const selectedCcaaName =
    scope !== "national"
      ? (CCAA_NAMES[scope] ??
        ccaaSpending?.byYear[ccaaSpending.latestYear]?.entries.find((e) => e.code === scope)
          ?.name ??
        scope)
      : null;

  const copy = useMemo(() => {
    return lang === "en"
      ? {
          title:
            scope !== "national" && selectedCcaaName
              ? `${selectedCcaaName} — Fiscal Flows`
              : "Public Accounts Circulation",
          description:
            scope !== "national" && selectedCcaaName
              ? `Estimated fiscal flows attributed to ${selectedCcaaName} (${selectedYear}). Income: regional taxes (AEAT) + proportional SS + other. Spending: regional COFOG + pensions + unemployment + proportional central services. Click any node to drill-down.`
              : `Aggregate flows of income, debt, and spending for ${selectedYear}. Click any node to drill-down into its specific path.`,
          scopeLabel: "Scope",
          allSpain: "Spain (Consolidated)",
          excludeRegionGroup: "Exclude regions from balance (What-If):",
          clearExclusions: "Clear Exclusions",
          withoutRegion: "Without",
          resetView: "Reset View",
          yearLabel: "Year",
          whatIfUnavailable: `Regional data only available for ${flows?.latestYear}. What-If simulation disabled.`,
          infoBox:
            "The flow consolidates data from Eurostat (total revenue/expenditure), IGAE (COFOG functional spending), AEAT (tax breakdown by type), and Social Security (pension payroll). IGAE categories are scaled to match Eurostat's total expenditure. Tax nodes use AEAT national proportions applied to Eurostat totals. Pensions and debt interest are extracted from their respective COFOG categories. The deficit equals expenditure minus revenue. The graph is strictly mathematically balanced: total inputs = total outputs.",
          whatIfInfo:
            "The What-If simulator estimates the fiscal balance excluding selected regions. Income side: uses AEAT regional delegations data for common-regime taxes and foral contribution flows for Navarra/País Vasco; centrally-managed tax portions (not attributed to any specific CCAA) are distributed by GDP share. Social contributions use regional Eurostat NUTS2 accounts; other revenue is proportional to regional GDP. Expense side: uses IGAE COFOG regional spending, Social Security regional pensions, and SEPE regional unemployment benefits. Central spending not in any CCAA budget (defence, national police, debt interest, central administration) is distributed by GDP share. Approximation: some regional datasets may reference slightly different periods, and GDP-proportional distribution of central items is a proxy, not an exact attribution.",
          nodeLabels: {
            // General
            INGRESOS_TOTALES: scope !== "national" ? "Attributed Income" : "Total Income",
            IMPUESTOS_DIRECTOS: "Direct Taxes",
            IMPUESTOS_INDIRECTOS: "Indirect Taxes",
            COTIZACIONES: "Social Contributions",
            OTROS_INGRESOS: "Other Income",
            CONSOLIDADO:
              scope !== "national" && selectedCcaaName
                ? `Fiscal Activity — ${selectedCcaaName}`
                : "Consolidated Budget",
            GASTOS_TOTALES: "Total Spending",
            DEFICIT: "Deficit (New Debt)",
            SUPERAVIT: "Surplus (Financing Capacity)",
            TRANSFERENCIA_NETA: "Net Transfer (Receives)",
            CONTRIBUCION_NETA: "Net Contribution (Gives)",

            // Taxes
            IRPF: "Personal Income Tax",
            IS: "Corporate Tax",
            IRNR: "Non-Resident Tax",
            IVA: "VAT",
            IIEE: "Special Taxes",
            IP_ISD_ITPAJD: "Wealth & Transfer",
            OTROS_TRIBUTOS: "Other Taxes",

            // COFOG
            COFOG_01_RESTO: "Public Services",
            COFOG_02: "Defence",
            COFOG_03: "Public Order & Safety",
            COFOG_04: "Economic Affairs",
            COFOG_05: "Environment",
            COFOG_06: "Housing & Utilities",
            COFOG_07: "Health",
            COFOG_08: "Culture & Religion",
            COFOG_09: "Education",
            COFOG_10_RESTO: "Social Protection",

            // Others
            INTERESES_DEUDA: "Debt Interests",
            GASTO_INTERESES: "Debt Interests",
            PENSIONES: "Pensions",
            GASTO_PENSIONES: "Pensions",
            DESEMPLEO: "Unemployment",
          } as Record<string, string>,
        }
      : {
          title:
            scope !== "national" && selectedCcaaName
              ? `${selectedCcaaName} — Flujos Fiscales`
              : "Circulación de las Cuentas Públicas",
          description:
            scope !== "national" && selectedCcaaName
              ? `Flujos fiscales estimados atribuidos a ${selectedCcaaName} (${selectedYear}). Ingresos: impuestos regionales (AEAT) + SS proporcional + otros. Gastos: COFOG regional + pensiones + desempleo + servicios centrales proporcionales. Haz clic en cualquier nodo para explorar.`
              : `Flujos agregados de ingresos, deuda y gasto para el año ${selectedYear}. Haz clic en cualquier nodo para explorar su rama (zoom-in).`,
          scopeLabel: "Ámbito",
          allSpain: "España (Consolidado)",
          excludeRegionGroup: "Excluir regiones del balance (What-If):",
          clearExclusions: "Limpiar Exclusiones",
          withoutRegion: "Sin",
          resetView: "Restablecer Vista",
          yearLabel: "Año",
          whatIfUnavailable: `Datos regionales solo disponibles para ${flows?.latestYear}. Simulación What-If desactivada.`,
          infoBox:
            "El flujo consolida datos de Eurostat (ingresos/gastos totales), IGAE (gasto funcional COFOG), AEAT (desglose tributario por figura) y Seguridad Social (nómina de pensiones). Las categorías IGAE se escalan para cuadrar con el gasto total de Eurostat. Los nodos de impuestos usan proporciones nacionales AEAT aplicadas a los totales Eurostat. Pensiones e intereses de deuda se extraen de sus categorías COFOG respectivas. El déficit es la diferencia entre gasto e ingresos. El grafo está estrictamente balanceado: total de entradas = total de salidas.",
          whatIfInfo:
            "El simulador What-If estima el balance fiscal excluyendo las regiones seleccionadas. Ingresos: usa datos de delegaciones territoriales AEAT para impuestos de régimen común y flujos de contribución foral para Navarra/País Vasco; la parte de recaudación gestionada centralmente (no atribuida a ninguna CCAA concreta) se distribuye por cuota de PIB. Las cotizaciones sociales usan cuentas regionales Eurostat NUTS2; otros ingresos se reparten proporcionalmente al PIB regional. Gastos: usa gasto regional COFOG de IGAE, pensiones regionales de la Seguridad Social y prestaciones de desempleo regionales del SEPE. El gasto central no asignado a ninguna CCAA (defensa, policía nacional, intereses de deuda, administración central) se distribuye por cuota de PIB. Aproximación: algunos conjuntos de datos regionales pueden referirse a periodos ligeramente distintos, y la distribución por PIB de partidas centrales es una estimación, no una atribución exacta.",
          nodeLabels: {
            // General
            INGRESOS_TOTALES: scope !== "national" ? "Ingresos Atribuidos" : "Ingresos Totales",
            IMPUESTOS_DIRECTOS: "Impuestos Directos",
            IMPUESTOS_INDIRECTOS: "Impuestos Indirectos",
            COTIZACIONES: "Cotizaciones Sociales",
            OTROS_INGRESOS: "Otros Ingresos",
            CONSOLIDADO:
              scope !== "national" && selectedCcaaName
                ? `Actividad Fiscal — ${selectedCcaaName}`
                : "Presupuesto Consolidado",
            GASTOS_TOTALES: "Gastos Totales",
            DEFICIT: "Déficit (Nueva Deuda)",
            SUPERAVIT: "Superávit (Cap. Financiación)",
            TRANSFERENCIA_NETA: "Transferencia Neta (Recibe)",
            CONTRIBUCION_NETA: "Contribución Neta (Aporta)",

            // Taxes
            IRPF: "IRPF",
            IS: "Imp. Sociedades",
            IRNR: "Imp. No Residentes",
            IVA: "IVA",
            IIEE: "Imp. Especiales",
            IP_ISD_ITPAJD: "Patrim. Suces. y Transm.",
            OTROS_TRIBUTOS: "Otros Tributos",

            // COFOG
            COFOG_01_RESTO: "Servicios Generales",
            COFOG_02: "Defensa",
            COFOG_03: "Orden Público",
            COFOG_04: "Asuntos Económicos",
            COFOG_05: "Medio Ambiente",
            COFOG_06: "Vivienda y S. Comunitarios",
            COFOG_07: "Sanidad",
            COFOG_08: "Cultura y Religión",
            COFOG_09: "Educación",
            COFOG_10_RESTO: "Protección Social",

            // Others
            INTERESES_DEUDA: "Intereses Deuda",
            GASTO_INTERESES: "Intereses Deuda",
            PENSIONES: "Pensiones",
            GASTO_PENSIONES: "Pensiones",
            DESEMPLEO: "Desempleo",
          } as Record<string, string>,
        };
  }, [lang, selectedYear, flows?.latestYear, scope, selectedCcaaName]);

  // Resolve the year's nodes/links from byYear
  const yearData = useMemo(() => {
    if (!flows?.byYear) return null;
    return flows.byYear[String(selectedYear)] ?? null;
  }, [flows, selectedYear]);

  // Build CCAA-specific Sankey graph when a region is selected
  const ccaaGraphData = useMemo(() => {
    if (scope === "national" || !yearData) return null;
    return buildCcaaGraph({
      ccaaCode: scope,
      nationalYearData: yearData,
      taxRevenue,
      ccaaSpending,
      ccaaForalFlows,
      pensionsRegional,
      unemploymentRegional,
      regionalAccounts,
    });
  }, [
    scope,
    yearData,
    taxRevenue,
    ccaaSpending,
    ccaaForalFlows,
    pensionsRegional,
    unemploymentRegional,
    regionalAccounts,
  ]);

  const ccaaOptions = useMemo(() => {
    if (!ccaaSpending) return [];
    const latest = ccaaSpending.byYear[ccaaSpending.latestYear];
    if (!latest) return [];
    return latest.entries
      .map((e) => ({ value: e.code, label: e.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ccaaSpending]);

  const { activeNodes, activeLinks } = useMemo(() => {
    if (!yearData) return { activeNodes: [], activeLinks: [] };

    // CCAA mode: use pre-built graph directly (no What-If subtraction)
    if (scope !== "national" && ccaaGraphData) {
      return {
        activeNodes: ccaaGraphData.nodes,
        activeLinks: ccaaGraphData.links,
      };
    }

    // Deep clone to avoid mutating original data
    const currentNodes = yearData.nodes.map((n) => ({ ...n }));
    const currentLinks = yearData.links.map((l) => ({ ...l }));

    // --- MATH MODIFICATION: WHAT-IF SUBTRACTION (MULTI-REGION) ---
    if (excludedRegions.length > 0 && whatIfAvailable) {
      let totalIncomeSubtracted = 0;
      let directTaxesSubtracted = 0;
      let indirectTaxesSubtracted = 0;
      let cotizacionesSubtracted = 0;
      let otrosIngresosSubtracted = 0;
      let totalExpenseSubtracted = 0;

      const subtractFromNodeAndLink = (
        nodeId: string,
        amountToSubtract: number,
        isInput: boolean,
      ): number => {
        if (amountToSubtract <= 0) return 0;

        let actualSubtracted = 0;

        // Subtract from Node
        const node = currentNodes.find((n) => n.id === nodeId);
        if (node) {
          actualSubtracted = Math.min(node.amount, amountToSubtract);
          node.amount = Math.max(0, node.amount - actualSubtracted);
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
      // These represent central govt spending not directly in any CCAA's budget
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
      const pensionAllEntries =
        pensionsRegional?.byYear[String(pensionsRegional.latestYear)]?.entries;
      if (pensionAllEntries) {
        for (const e of pensionAllEntries) {
          totalRegionalPensions += e.annualAmount / 1_000_000;
        }
      }

      let totalRegionalUnemployment = 0;
      const unemplAllEntries =
        unemploymentRegional?.byYear[String(unemploymentRegional.latestYear)]?.entries;
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
          centralResiduals[node.id] = Math.max(
            0,
            node.amount - (cofogRegionalTotals[node.id] || 0),
          );
        }
      }

      // Precompute central tax residuals (Sankey tax node − sum of all regional attributions)
      // AEAT delegaciones data covers taxes managed regionally, but not centrally-managed
      // portions (e.g., national-level IVA, centrally-collected IRPF). These residuals are
      // distributed GDP-proportionally when excluding regions.
      const taxResiduals: Record<string, { amount: number; type: "direct" | "indirect" }> = {};
      {
        const allTaxEntries = taxCcaaLatestYear
          ? (taxRevenue?.ccaa[taxCcaaLatestYear]?.entries ?? [])
          : [];
        const commonTaxEntries = allTaxEntries.filter(
          (e) => e.code !== "CA15" && e.code !== "CA16",
        );
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
            // Divisions "01" and "10" map to _RESTO nodes (interest/pensions split out)
            const cofogNodeId =
              div === "01" ? "COFOG_01_RESTO" : div === "10" ? "COFOG_10_RESTO" : `COFOG_${div}`;
            const actualExpense = subtractFromNodeAndLink(cofogNodeId, amount, false);
            totalExpenseSubtracted += actualExpense;
          }
        }
        // 3. Subtract State-Level Expenses (Pensions and Unemployment proxy)
        const regionPensions = pensionsRegional?.byYear[
          String(pensionsRegional.latestYear)
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
        // Unemployment benefits are part of COFOG_10_RESTO in the Sankey
        const regionUnemployment = unemploymentRegional?.byYear[
          String(unemploymentRegional.latestYear)
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
            // Original amount of COFOG_10_RESTO from the graph
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
        const acctYear = regionalAccounts?.byYear[String(regionalAccounts.latestYear)];
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
            );
          }

          if (acctYear.totals.gdp > 0) {
            const gdpProportion = regionAcct.gdp / acctYear.totals.gdp;
            const originalOtros =
              yearData.nodes.find((n) => n.id === "OTROS_INGRESOS")?.amount || 0;
            const otrosToSubtract = originalOtros * gdpProportion;
            otrosIngresosSubtracted += subtractFromNodeAndLink(
              "OTROS_INGRESOS",
              otrosToSubtract,
              true,
            );

            // 7. Subtract central spending residuals (GDP-proportional)
            // Central govt spending not in any CCAA's budget (defence, national
            // police, central admin overhead, debt interest, etc.)
            for (const [nodeId, residual] of Object.entries(centralResiduals)) {
              if (residual > 0) {
                totalExpenseSubtracted += subtractFromNodeAndLink(
                  nodeId,
                  residual * gdpProportion,
                  false,
                );
              }
            }

            // 8. Subtract central tax residuals (GDP-proportional)
            // Centrally-collected taxes not in any CCAA's AEAT delegación data
            for (const [nodeId, { amount: residual, type }] of Object.entries(taxResiduals)) {
              if (residual > 0) {
                const actualTaxResidual = subtractFromNodeAndLink(
                  nodeId,
                  residual * gdpProportion,
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

      // 3. Re-balance the deficit and central nodes
      const consolidadoNode = currentNodes.find((n) => n.id === "CONSOLIDADO");
      if (consolidadoNode && totalExpenseSubtracted > 0) {
        consolidadoNode.amount = Math.max(0, consolidadoNode.amount - totalExpenseSubtracted);
      }

      const netBalanceImpact = totalExpenseSubtracted - totalIncomeSubtracted; // Pos indicates they spend more than they pay in taxes in this proxy

      // Adjust the Deficit Node
      const deficitNode = currentNodes.find((n) => n.id === "DEFICIT");
      const deficitLink = currentLinks.find((l) => l.source === "DEFICIT");

      if (deficitNode && deficitLink) {
        const newDeficit = deficitNode.amount - netBalanceImpact;
        // If it goes negative (surplus!), we create a Surplus node to keep DAG balanced
        if (newDeficit < 0) {
          deficitNode.amount = 0;
          deficitLink.amount = 0;

          const surplusAmount = Math.abs(newDeficit);
          currentNodes.push({
            id: "SUPERAVIT",
            label: copy.nodeLabels.SUPERAVIT,
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
    }

    return { activeNodes: currentNodes, activeLinks: currentLinks };
  }, [
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
    copy,
    scope,
    ccaaGraphData,
  ]);

  const { filteredNodes, filteredLinks } = useMemo(() => {
    const { nodes, links } = getFilteredGraph(activeNodes, activeLinks, selectedNode);
    return { filteredNodes: nodes, filteredLinks: links };
  }, [activeNodes, activeLinks, selectedNode]);

  if (!flows) return null;

  return (
    <Card className="col-span-1 md:col-span-2 xl:col-span-3 hover-lift border-primary/10 overflow-hidden shadow-sm">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">{copy.title}</CardTitle>
            <CardDescription className="text-base mt-2">{copy.description}</CardDescription>
          </div>
        </div>

        {/* Scope selector */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">{copy.scopeLabel}</span>
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setSelectedNode(null);
            }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="national">{copy.allSpain}</option>
            {ccaaOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Year selector */}
        <div className="mt-4">
          <span className="text-sm font-medium text-muted-foreground mr-3">{copy.yearLabel}</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {(flows.years ?? []).map((year) => {
              const disabled = scope !== "national" && year !== flows.latestYear;
              return (
                <button
                  type="button"
                  key={year}
                  disabled={disabled}
                  onClick={() => {
                    setSelectedYear(year);
                    setSelectedNode(null);
                  }}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 border
                    ${
                      disabled
                        ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
                        : year === selectedYear
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-foreground hover:bg-muted"
                    }
                  `}
                >
                  {year}
                </button>
              );
            })}
          </div>
        </div>

        {/* What-If section: only visible in national scope */}
        {scope === "national" && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                {copy.excludeRegionGroup}
              </span>
              {excludedRegions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setExcludedRegions([]);
                    setSelectedNode(null);
                  }}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  {copy.clearExclusions}
                </Button>
              )}
            </div>

            {!whatIfAvailable && (
              <p className="text-xs text-muted-foreground/70 italic mb-2">
                {copy.whatIfUnavailable}
              </p>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              {ccaaOptions.map((opt) => {
                const isExcluded = excludedRegions.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    disabled={!whatIfAvailable}
                    onClick={() => {
                      setExcludedRegions(
                        (prev) =>
                          prev.includes(opt.value)
                            ? prev.filter((r) => r !== opt.value) // Remove
                            : [...prev, opt.value], // Add
                      );
                      setSelectedNode(null); // Reset drilldown when simulating
                    }}
                    className={`
                      px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border
                      ${
                        !whatIfAvailable
                          ? "opacity-50 cursor-not-allowed"
                          : isExcluded
                            ? "bg-destructive/10 border-destructive/20 text-destructive line-through decoration-destructive/50"
                            : "bg-background border-border text-foreground hover:bg-muted"
                      }
                    `}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {whatIfAvailable && (
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground inline-flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {lang === "en"
                    ? "What-If methodology & assumptions"
                    : "Metodología y supuestos del What-If"}
                </summary>
                <p className="mt-2 leading-relaxed bg-muted/30 rounded-md p-3">{copy.whatIfInfo}</p>
              </details>
            )}
          </div>
        )}

        {selectedNode && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setSelectedNode(null)}
              className="shrink-0 flex items-center gap-2"
            >
              <ZoomOut className="w-4 h-4" />
              {copy.resetView}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[650px] w-full px-2 py-4 bg-background/50">
          <ResponsiveSankey
            data={{
              nodes: filteredNodes,
              links: filteredLinks.map((l) => ({ ...l, value: l.amount })),
            }}
            margin={{ top: 20, right: 180, bottom: 20, left: 180 }}
            align="justify"
            colors={
              // biome-ignore lint/suspicious/noExplicitAny: nivo Sankey node type is not exported
              (node: any) => groupColors[node.group] || "hsl(var(--muted-foreground))"
            }
            nodeOpacity={1}
            nodeHoverOthersOpacity={0.1}
            nodeThickness={20}
            nodeSpacing={24}
            nodeBorderWidth={1}
            nodeBorderColor={{ from: "color", modifiers: [["darker", 0.5]] }}
            nodeBorderRadius={3}
            linkOpacity={0.45}
            nodeHoverOpacity={0.9}
            linkHoverOthersOpacity={0.1}
            linkContract={3}
            enableLinkGradient={true}
            labelPosition="outside"
            labelOrientation="horizontal"
            labelPadding={16}
            label={(node) => copy.nodeLabels[node.id] || node.id.toString()}
            labelTextColor="hsl(var(--foreground))"
            onClick={(data) => {
              // Toggle node drill-down
              if ("sourceLinks" in data) {
                // It's a node
                setSelectedNode((prev) => (prev === data.id ? null : data.id.toString()));
              }
            }}
            valueFormat={(value: number) => formatCompact(value)}
            // biome-ignore lint/suspicious/noExplicitAny: nivo Sankey tooltip type is not exported
            nodeTooltip={(node: any) => (
              <div className="bg-popover/80 backdrop-blur-md text-popover-foreground px-3 py-2 rounded-xl border border-white/10 shadow-xl text-sm">
                <span className="font-semibold">
                  {copy.nodeLabels[node.node.id] || node.node.id.toString()}
                </span>
                : {formatCompact(node.node.value)} €
              </div>
            )}
            theme={{
              tooltip: {
                container: {
                  background: "hsl(var(--popover) / 0.8)",
                  backdropFilter: "blur(12px)",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: "14px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                },
              },
              labels: {
                text: {
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                },
              },
            }}
          />
        </div>
        {!selectedNode && (
          <div className="bg-muted/20 p-4 border-t text-sm text-muted-foreground flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{copy.infoBox}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
