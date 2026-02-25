import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { SpendingCategory } from "@/components/PersonalCalculator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SankeyLink, SankeyNode } from "@/data/types";
import { useData } from "@/hooks/useData";
import { computeWhatIfSimulation } from "@/hooks/useWhatIfSimulation";
import { useI18n } from "@/i18n/I18nProvider";
import { buildCcaaGraph, CCAA_NAMES, CCAA_POPULATION } from "@/utils/buildCcaaGraph";
import { FlowsHeader } from "./flows/FlowsHeader";
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

  const ccaaPopulation = scope !== "national" ? (CCAA_POPULATION[scope] ?? null) : null;

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

  const whatIfAvailable = selectedYear === flows?.latestYear && scope === "national";

  useEffect(() => {
    if (!whatIfAvailable) {
      setExcludedRegions([]);
    }
  }, [whatIfAvailable]);

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
      infoBox: flowsCopy.infoBox,
      whatIfInfo: flowsCopy.whatIfInfo,
      whatIfMethodology: flowsCopy.whatIfMethodology,
      nodeLabels,
      scopeLabel: flowsCopy.scopeLabel,
      allSpain: flowsCopy.allSpain,
      excludeRegionGroup: flowsCopy.excludeRegionGroup,
      clearExclusions: flowsCopy.clearExclusions,
      withoutRegion: flowsCopy.withoutRegion,
      resetView: flowsCopy.resetView,
      yearLabel: flowsCopy.yearLabel,
      populationLabel: msg.sankey.populationLabel,
    };
  }, [
    flowsCopy,
    selectedYear,
    flows?.latestYear,
    scope,
    selectedCcaaName,
    msg.sankey.populationLabel,
  ]);

  const yearData = useMemo(() => {
    if (!flows?.byYear) return null;
    return flows.byYear[String(selectedYear)] ?? null;
  }, [flows, selectedYear]);

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

    return computeWhatIfSimulation({
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
      superavitLabel: copy.nodeLabels.SUPERAVIT,
    });
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
    copy.nodeLabels.SUPERAVIT,
    scope,
    ccaaGraphData,
  ]);

  const { filteredNodes, filteredLinks } = useMemo(() => {
    const { nodes, links } = getFilteredGraph(activeNodes, activeLinks, selectedNode);
    return { filteredNodes: nodes, filteredLinks: links };
  }, [activeNodes, activeLinks, selectedNode]);

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
        <FlowsHeader
          copy={copy}
          scope={scope}
          selectedYear={selectedYear}
          years={flows.years ?? []}
          latestYear={flows.latestYear}
          ccaaOptions={ccaaOptions}
          ccaaPopulation={ccaaPopulation}
          selectedCcaaName={selectedCcaaName}
          excludedRegions={excludedRegions}
          whatIfAvailable={whatIfAvailable}
          spendingCategories={spendingCategories}
          totalSpending={totalSpending}
          lang={lang}
          onScopeChange={(newScope) => {
            setScope(newScope);
            setSelectedNode(null);
          }}
          onYearChange={(year) => {
            setSelectedYear(year);
            setSelectedNode(null);
          }}
          onExcludedRegionsChange={(updater) => {
            setExcludedRegions(updater);
            setSelectedNode(null);
          }}
          onClearExclusions={() => {
            setExcludedRegions([]);
            setSelectedNode(null);
          }}
        />
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
