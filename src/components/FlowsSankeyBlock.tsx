import { Info } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { PersonalCalculator, type SpendingCategory } from "@/components/PersonalCalculator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SankeyLink, SankeyNode } from "@/data/types";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { buildCcaaGraph, CCAA_NAMES, CCAA_POPULATION } from "@/utils/buildCcaaGraph";
import { SankeyView } from "./flows/SankeyView";

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
  const { lang, msg } = useI18n();

  // Per-capita: population of the selected CCAA (null when national scope)
  const ccaaPopulation = scope !== "national" ? (CCAA_POPULATION[scope] ?? null) : null;

  // Formatter for per-capita amounts (no decimals, Spanish locale)
  const formatPerCapita = useMemo(() => {
    const locale = lang === "en" ? "en-GB" : "es-ES";
    const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    return (amountMillions: number): string => {
      if (!ccaaPopulation || ccaaPopulation === 0) return "";
      const totalEuros = amountMillions * 1_000_000;
      const perCapita = totalEuros / ccaaPopulation;
      return `${fmt.format(perCapita)} ${msg.sankey.perCapita}`;
    };
  }, [lang, ccaaPopulation, msg.sankey.perCapita]);

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

  const flowsCopy = msg.blocks.flows;

  const copy = useMemo(() => {
    const isRegional = scope !== "national" && selectedCcaaName !== null;
    const title = isRegional
      ? `${selectedCcaaName} — ${flowsCopy.titleRegional}`
      : flowsCopy.titleNational;
    const description = isRegional
      ? flowsCopy.descriptionRegional
          .replace("{ccaa}", selectedCcaaName ?? "")
          .replace("{year}", String(selectedYear))
      : flowsCopy.descriptionNational.replace("{year}", String(selectedYear));
    const whatIfUnavailable = flowsCopy.whatIfUnavailable.replace(
      "{year}",
      String(flows?.latestYear),
    );
    const infoBox = flowsCopy.infoBox;
    const whatIfInfo = flowsCopy.whatIfInfo;
    const nodeLabels: Record<string, string> = {
      INGRESOS_TOTALES: isRegional
        ? flowsCopy.nodeLabelIngresosTotalesRegional
        : flowsCopy.nodeLabelIngresosTotales,
      IMPUESTOS_DIRECTOS: flowsCopy.nodeLabelImpuestosDirectos,
      IMPUESTOS_INDIRECTOS: flowsCopy.nodeLabelImpuestosIndirectos,
      COTIZACIONES: flowsCopy.nodeLabelCotizaciones,
      OTROS_INGRESOS: flowsCopy.nodeLabelOtrosIngresos,
      CONSOLIDADO: isRegional
        ? flowsCopy.nodeLabelConsolidadoRegional.replace("{ccaa}", selectedCcaaName ?? "")
        : flowsCopy.nodeLabelConsolidado,
      GASTOS_TOTALES: flowsCopy.nodeLabelGastosTotales,
      DEFICIT: flowsCopy.nodeLabelDeficit,
      SUPERAVIT: flowsCopy.nodeLabelSuperavit,
      TRANSFERENCIA_NETA: flowsCopy.nodeLabelTransferenciaNeta,
      CONTRIBUCION_NETA: flowsCopy.nodeLabelContribucionNeta,
      IRPF: flowsCopy.nodeLabelIRPF,
      IS: flowsCopy.nodeLabelIS,
      IRNR: flowsCopy.nodeLabelIRNR,
      IVA: flowsCopy.nodeLabelIVA,
      IIEE: flowsCopy.nodeLabelIIEE,
      IP_ISD_ITPAJD: flowsCopy.nodeLabelIPISDITPAJD,
      OTROS_TRIBUTOS: flowsCopy.nodeLabelOtrosTributos,
      COFOG_01_RESTO: flowsCopy.nodeLabelCOFOG01Resto,
      COFOG_02: flowsCopy.nodeLabelCOFOG02,
      COFOG_03: flowsCopy.nodeLabelCOFOG03,
      COFOG_04: flowsCopy.nodeLabelCOFOG04,
      COFOG_05: flowsCopy.nodeLabelCOFOG05,
      COFOG_06: flowsCopy.nodeLabelCOFOG06,
      COFOG_07: flowsCopy.nodeLabelCOFOG07,
      COFOG_08: flowsCopy.nodeLabelCOFOG08,
      COFOG_09: flowsCopy.nodeLabelCOFOG09,
      COFOG_10_RESTO: flowsCopy.nodeLabelCOFOG10Resto,
      INTERESES_DEUDA: flowsCopy.nodeLabelInteresesDeuda,
      GASTO_INTERESES: flowsCopy.nodeLabelGastoIntereses,
      PENSIONES: flowsCopy.nodeLabelPensiones,
      GASTO_PENSIONES: flowsCopy.nodeLabelGastoPensiones,
      DESEMPLEO: flowsCopy.nodeLabelDesempleo,
    };
    return {
      title,
      description,
      whatIfUnavailable,
      infoBox,
      whatIfInfo,
      nodeLabels,
      scopeLabel: flowsCopy.scopeLabel,
      allSpain: flowsCopy.allSpain,
      excludeRegionGroup: flowsCopy.excludeRegionGroup,
      clearExclusions: flowsCopy.clearExclusions,
      withoutRegion: flowsCopy.withoutRegion,
      resetView: flowsCopy.resetView,
      yearLabel: flowsCopy.yearLabel,
    };
  }, [flowsCopy, selectedYear, flows?.latestYear, scope, selectedCcaaName]);

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
                  true,
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

  // Spending distribution for personal calculator
  const { spendingCategories, totalSpending } = useMemo(() => {
    const spendLinks = activeLinks.filter((l) => l.source === "CONSOLIDADO");
    const total = spendLinks.reduce((s, l) => s + l.amount, 0);
    const categories: SpendingCategory[] = spendLinks
      .filter((l) => l.amount > 0)
      .map((l) => ({
        id: l.target,
        label: copy.nodeLabels[l.target] || l.target,
        amount: l.amount,
      }));
    return { spendingCategories: categories, totalSpending: total };
  }, [activeLinks, copy.nodeLabels]);

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

          {/* Per-capita indicator when a single CCAA is selected */}
          {scope !== "national" && selectedCcaaName && ccaaPopulation && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              {msg.sankey.populationLabel}:{" "}
              {new Intl.NumberFormat(lang === "en" ? "en-GB" : "es-ES").format(ccaaPopulation)}
            </span>
          )}
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
                  {flowsCopy.whatIfMethodology}
                </summary>
                <p className="mt-2 leading-relaxed bg-muted/30 rounded-md p-3">{copy.whatIfInfo}</p>
              </details>
            )}
          </div>
        )}

        <PersonalCalculator spendingCategories={spendingCategories} totalSpending={totalSpending} />
      </CardHeader>
      <CardContent className="p-0">
        <SankeyView
          filteredNodes={filteredNodes}
          filteredLinks={filteredLinks}
          activeNodes={activeNodes}
          selectedNode={selectedNode}
          nodeLabels={copy.nodeLabels}
          ccaaPopulation={ccaaPopulation}
          onNodeClick={(nodeId) => setSelectedNode((prev) => (prev === nodeId ? null : nodeId))}
          onResetView={() => setSelectedNode(null)}
          resetViewLabel={copy.resetView}
          infoBox={copy.infoBox}
          formatPerCapita={formatPerCapita}
        />
      </CardContent>
    </Card>
  );
};
