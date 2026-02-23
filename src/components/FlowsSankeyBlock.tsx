import { ResponsiveSankey } from "@nivo/sankey";
import { Info, Settings2, ZoomOut } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SankeyLink, SankeyNode } from "@/data/types";
import { useData } from "@/hooks/useData";
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

// Colors mapping
const groupColors: Record<string, string> = {
  core: "#64748b", // slate-500
  income: "#ef4444", // red-500 (Deficit)
  income_agg: "#22c55e", // green-500
  income_type: "#16a34a", // green-600
  tax_detail: "#15803d", // green-700
  expense_cofog: "#3b82f6", // blue-500
  expense_specific: "#0ea5e9", // sky-500
};

export const FlowsSankeyBlock: React.FC = () => {
  const { flows, taxRevenue, ccaaSpending } = useData();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [excludedRegion, setExcludedRegion] = useState<string | null>(null);

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

    // --- MATH MODIFICATION: WHAT-IF SUBTRACTION ---
    if (excludedRegion) {
      const taxLatest = taxRevenue?.ccaa[taxRevenue.latestYear]?.entries.find(
        (e) => e.code === excludedRegion,
      );
      const spendLatest = ccaaSpending?.byYear[ccaaSpending.latestYear]?.entries.find(
        (e) => e.code === excludedRegion,
      );

      let totalIncomeSubtracted = 0;
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

      // 1. Subtract Incomes (Taxes Collected in Region)
      if (taxLatest) {
        subtractFromNodeAndLink("IRPF", taxLatest.irpf, true);
        subtractFromNodeAndLink("IVA", taxLatest.iva, true);
        subtractFromNodeAndLink("IS", taxLatest.sociedades, true);
        subtractFromNodeAndLink("IIEE", taxLatest.iiee, true);
        subtractFromNodeAndLink("IRNR", taxLatest.irnr, true);
        totalIncomeSubtracted =
          taxLatest.irpf + taxLatest.iva + taxLatest.sociedades + taxLatest.iiee + taxLatest.irnr;
      }

      // Propagate income subtraction to aggregators
      const ingresosTotales = currentNodes.find((n) => n.id === "INGRESOS_TOTALES");
      if (ingresosTotales && totalIncomeSubtracted > 0) {
        ingresosTotales.amount = Math.max(0, ingresosTotales.amount - totalIncomeSubtracted);
        const sumInLink = currentLinks.find(
          (l) => l.source === "INGRESOS_TOTALES" && l.target === "CONSOLIDADO",
        );
        if (sumInLink) sumInLink.amount = Math.max(0, sumInLink.amount - totalIncomeSubtracted);
      }

      // 2. Subtract Expenses (General Spending executed by Regional Govt)
      if (spendLatest) {
        for (const [cofog, amount] of Object.entries(spendLatest.divisions)) {
          subtractFromNodeAndLink(`COFOG_${cofog}`, amount, false);
          totalExpenseSubtracted += amount;
        }
      }

      // 3. Re-balance the deficit and central nodes
      const consolidadoNode = currentNodes.find((n) => n.id === "CONSOLIDADO");
      if (consolidadoNode) {
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
  }, [flows, excludedRegion, taxRevenue, ccaaSpending]);

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
            <CardTitle className="flex items-center gap-2 text-2xl">
              Circulación de las Cuentas Públicas
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Flujos agregados de ingresos, deuda y gasto para el año {flows.latestYear}. Haz clic
              en cualquier nodo para explorar su rama (zoom-in).
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-muted/50 rounded-md p-1 border">
              <Settings2 className="w-4 h-4 text-muted-foreground ml-2" />
              <select
                className="bg-transparent text-sm border-0 focus:ring-0 cursor-pointer pr-2 py-1 outline-none text-foreground font-medium"
                value={excludedRegion || ""}
                onChange={(e) => {
                  setExcludedRegion(e.target.value === "" ? null : e.target.value);
                  setSelectedNode(null); // Reset drilldown when simulating
                }}
              >
                <option value="">España (Consolidado)</option>
                <optgroup label="Simular exclusión (What-If):">
                  {ccaaOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Sin {opt.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            {selectedNode && (
              <Button
                variant="outline"
                onClick={() => setSelectedNode(null)}
                className="shrink-0 flex items-center gap-2"
              >
                <ZoomOut className="w-4 h-4" />
                Restablecer Vista
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[600px] w-full px-2 py-4 bg-white/50 backdrop-blur-sm">
          <ResponsiveSankey
            data={{
              nodes: filteredNodes,
              links: filteredLinks.map((l) => ({ ...l, value: l.amount })),
            }}
            margin={{ top: 20, right: 120, bottom: 20, left: 120 }}
            align="justify"
            colors={(node: any) => groupColors[node.group] || "#cbd5e1"}
            nodeOpacity={1}
            nodeHoverOthersOpacity={0.1}
            nodeThickness={18}
            nodeSpacing={24}
            nodeBorderWidth={0}
            nodeBorderColor={{ from: "color", modifiers: [["darker", 0.8]] }}
            nodeBorderRadius={3}
            linkOpacity={0.3}
            nodeHoverOpacity={0.8}
            linkHoverOthersOpacity={0.05}
            linkContract={3}
            enableLinkGradient={true}
            labelPosition="outside"
            labelOrientation="horizontal"
            labelPadding={16}
            labelTextColor={{ from: "color", modifiers: [["darker", 1.5]] }}
            onClick={(data) => {
              // Toggle node drill-down
              if ("sourceLinks" in data) {
                // It's a node
                setSelectedNode((prev) => (prev === data.id ? null : data.id.toString()));
              }
            }}
            valueFormat={(value: number) => formatCompact(value)}
            theme={{
              tooltip: {
                container: {
                  background: "rgba(255, 255, 255, 0.95)",
                  color: "#1e293b",
                  fontSize: "14px",
                  borderRadius: "6px",
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
          <div className="bg-muted/20 p-4 border-t text-sm text-slate-500 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              El flujo consolida los datos de AEAT, IGAE y Eurostat garantizando un balance
              matemático exacto. El ancho de las cintas es proporcional a los importes en millones
              de euros. Haz hover sobre una cinta para ver la cantidad exacta.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
