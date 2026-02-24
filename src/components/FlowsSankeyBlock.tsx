import { ResponsiveSankey } from "@nivo/sankey";
import { Info, ZoomOut } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SankeyLink, SankeyNode } from "@/data/types";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
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
      const current = queue.shift()!;
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
  const { flows, taxRevenue, ccaaSpending, ccaaForalFlows } = useData();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [excludedRegions, setExcludedRegions] = useState<string[]>([]);
  const { lang } = useI18n();

  const copy = useMemo(() => {
    return lang === "en"
      ? {
          title: "Public Accounts Circulation",
          description: `Aggregate flows of income, debt, and spending for ${flows?.latestYear}. Click any node to drill-down into its specific path.`,
          allSpain: "Spain (Consolidated)",
          excludeRegionGroup: "Exclude regions from balance (What-If):",
          clearExclusions: "Clear Exclusions",
          withoutRegion: "Without",
          resetView: "Reset View",
          infoBox:
            "The flow consolidates data from the Tax Agency (AEAT), General Comptroller (IGAE), and Eurostat guaranteeing a strictly mathematically balanced graph. The ribbons' thickness is proportional to the millions of euros. Hover over a ribbon/node to see the exact amount.",
          nodeLabels: {
            // General
            INGRESOS_TOTALES: "TOTAL INCOME",
            IMPUESTOS_DIRECTOS: "DIRECT TAXES",
            IMPUESTOS_INDIRECTOS: "INDIRECT TAXES",
            COTIZACIONES: "SOCIAL CONTRIBUTIONS",
            OTROS_INGRESOS: "OTHER INCOME",
            CONSOLIDADO: "CONSOLIDATED BUDGET",
            GASTOS_TOTALES: "TOTAL SPENDING",
            DEFICIT: "DEFICIT (NEW DEBT)",

            // Taxes
            IRPF: "Personal Income Tax",
            IS: "Corporate Tax",
            IRNR: "Non-Resident Tax",
            IVA: "VAT",
            IIEE: "Special Taxes",
            IP_ISD_ITPAJD: "Wealth & Transfer",
            OTROS_TRIBUTOS: "Other Taxes",

            // COFOG
            COFOG_01_RESTO: "1. Public Services",
            COFOG_02: "2. Defence",
            COFOG_03: "3. Public Order & Safety",
            COFOG_04: "4. Economic Affairs",
            COFOG_05: "5. Environment",
            COFOG_06: "6. Housing & Utilities",
            COFOG_07: "7. Health",
            COFOG_08: "8. Culture & Religion",
            COFOG_09: "9. Education",
            COFOG_10_RESTO: "10. Social Protection",

            // Others
            INTERESES_DEUDA: "Debt Interests",
            PENSIONES: "Pensions",
            DESEMPLEO: "Unemployment",
          } as Record<string, string>,
        }
      : {
          title: "Circulación de las Cuentas Públicas",
          description: `Flujos agregados de ingresos, deuda y gasto para el año ${flows?.latestYear}. Haz clic en cualquier nodo para explorar su rama (zoom-in).`,
          allSpain: "España (Consolidado)",
          excludeRegionGroup: "Excluir regiones del balance (What-If):",
          clearExclusions: "Limpiar Exclusiones",
          withoutRegion: "Sin",
          resetView: "Restablecer Vista",
          infoBox:
            "El flujo consolida los datos de AEAT, IGAE y Eurostat garantizando un balance matemático exacto. El ancho de las cintas es proporcional a los importes en millones de euros. Haz hover sobre una cinta para ver la cantidad exacta.",
          nodeLabels: {
            // General
            INGRESOS_TOTALES: "INGRESOS TOTALES",
            IMPUESTOS_DIRECTOS: "IMPUESTOS DIRECTOS",
            IMPUESTOS_INDIRECTOS: "IMPUESTOS INDIRECTOS",
            COTIZACIONES: "COTIZACIONES SOCIALES",
            OTROS_INGRESOS: "OTROS INGRESOS",
            CONSOLIDADO: "PRESUPUESTO CONSOLIDADO",
            GASTOS_TOTALES: "GASTOS TOTALES",
            DEFICIT: "DÉFICIT (NUEVA DEUDA)",

            // Taxes
            IRPF: "IRPF",
            IS: "Imp. Sociedades",
            IRNR: "Imp. No Residentes",
            IVA: "IVA",
            IIEE: "Imp. Especiales",
            IP_ISD_ITPAJD: "Patrim. Suces. y Transm.",
            OTROS_TRIBUTOS: "Otros Tributos",

            // COFOG
            COFOG_01_RESTO: "1. Servicios Generales",
            COFOG_02: "2. Defensa",
            COFOG_03: "3. Orden Público",
            COFOG_04: "4. Asuntos Económicos",
            COFOG_05: "5. Medio Ambiente",
            COFOG_06: "6. Vivienda y S. Comunitarios",
            COFOG_07: "7. Sanidad",
            COFOG_08: "8. Cultura y Religión",
            COFOG_09: "9. Educación",
            COFOG_10_RESTO: "10. Protección Social",

            // Others
            INTERESES_DEUDA: "Intereses Deuda",
            PENSIONES: "Pensiones",
            DESEMPLEO: "Desempleo",
          } as Record<string, string>,
        };
  }, [lang, flows?.latestYear]);

  const ccaaOptions = useMemo(() => {
    if (!ccaaSpending) return [];
    const latest = ccaaSpending.byYear[ccaaSpending.latestYear];
    if (!latest) return [];
    return latest.entries
      .map((e) => ({ value: e.code, label: e.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ccaaSpending]);

  const { activeNodes, activeLinks } = useMemo(() => {
    if (!flows) return { activeNodes: [], activeLinks: [] };

    // Deep clone to avoid mutating original data
    const currentNodes = flows.nodes.map((n) => ({ ...n }));
    const currentLinks = flows.links.map((l) => ({ ...l }));

    // --- MATH MODIFICATION: WHAT-IF SUBTRACTION (MULTI-REGION) ---
    if (excludedRegions.length > 0) {
      let totalIncomeSubtracted = 0;
      let directTaxesSubtracted = 0;
      let indirectTaxesSubtracted = 0;
      let totalExpenseSubtracted = 0;

      const subtractFromNodeAndLink = (
        nodeId: string,
        amountToSubtract: number,
        isInput: boolean,
      ) => {
        if (amountToSubtract <= 0) return;

        // Subtract from Node
        const node = currentNodes.find((n) => n.id === nodeId);
        if (node) {
          node.amount = Math.max(0, node.amount - amountToSubtract);
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
          link.amount = Math.max(0, link.amount - amountToSubtract);
        }
      };

      // Aggregate subtractions across all excluded regions
      for (const regionId of excludedRegions) {
        // 1. Subtract Incomes (Taxes Collected in Region)
        if (regionId === "CA15" || regionId === "CA16") {
          const foralLatest = ccaaForalFlows?.byYear[ccaaForalFlows.latestYear]?.entries.find(
            (e) => e.code === regionId,
          );
          if (foralLatest && taxRevenue?.national[taxRevenue.latestYear]) {
            const nationalData = taxRevenue.national[taxRevenue.latestYear];
            const irpfProp = nationalData.irpf / nationalData.total;
            const ivaProp = nationalData.iva / nationalData.total;
            const isProp = nationalData.sociedades / nationalData.total;

            const totalForalRevenue = foralLatest.taxRevenue ?? 0;
            const foralIrpf = totalForalRevenue * irpfProp;
            const foralIva = totalForalRevenue * ivaProp;
            const foralIs = totalForalRevenue * isProp;

            subtractFromNodeAndLink("IRPF", foralIrpf, true);
            subtractFromNodeAndLink("IS", foralIs, true);
            directTaxesSubtracted += foralIrpf + foralIs;

            subtractFromNodeAndLink("IVA", foralIva, true);
            indirectTaxesSubtracted += foralIva;
          }
        } else {
          const taxLatest = taxRevenue?.ccaa[taxRevenue.latestYear]?.entries.find(
            (e) => e.code === regionId,
          );
          if (taxLatest) {
            subtractFromNodeAndLink("IRPF", taxLatest.irpf, true);
            subtractFromNodeAndLink("IS", taxLatest.sociedades, true);
            subtractFromNodeAndLink("IRNR", taxLatest.irnr, true);
            directTaxesSubtracted += taxLatest.irpf + taxLatest.sociedades + taxLatest.irnr;

            subtractFromNodeAndLink("IVA", taxLatest.iva, true);
            subtractFromNodeAndLink("IIEE", taxLatest.iiee, true);
            indirectTaxesSubtracted += taxLatest.iva + taxLatest.iiee;
          }
        }

        // 2. Subtract Expenses (General Spending executed by Regional Govt)
        const spendLatest = ccaaSpending?.byYear[ccaaSpending.latestYear]?.entries.find(
          (e) => e.code === regionId,
        );
        if (spendLatest) {
          for (const [cofog, amount] of Object.entries(spendLatest.divisions)) {
            subtractFromNodeAndLink(`COFOG_${cofog}`, amount, false);
            totalExpenseSubtracted += amount;
          }
        }
      }

      totalIncomeSubtracted = directTaxesSubtracted + indirectTaxesSubtracted;

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
        // If it goes negative (surplus!), we floor to 0 for this demo
        deficitNode.amount = Math.max(0, newDeficit);
        deficitLink.amount = Math.max(0, newDeficit);
      }
    }

    return { activeNodes: currentNodes, activeLinks: currentLinks };
  }, [flows, excludedRegions, taxRevenue, ccaaSpending, ccaaForalFlows]);

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

        <div className="mt-6">
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

          <div className="flex flex-wrap gap-2 items-center">
            {ccaaOptions.map((opt) => {
              const isExcluded = excludedRegions.includes(opt.value);
              return (
                <button
                  key={opt.value}
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
                      isExcluded
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
        </div>
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
            colors={(node: any) => groupColors[node.group] || "hsl(var(--muted-foreground))"}
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
            nodeTooltip={(node: any) => (
              <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md border shadow-md text-sm">
                <span className="font-semibold">
                  {copy.nodeLabels[node.node.id] || node.node.id.toString()}
                </span>
                : {formatCompact(node.node.value)} €
              </div>
            )}
            theme={{
              tooltip: {
                container: {
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: "14px",
                  borderRadius: "6px",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
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
