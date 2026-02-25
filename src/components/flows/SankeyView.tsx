import { ResponsiveSankey } from "@nivo/sankey";
import { Info, ZoomOut } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import type { SankeyLink, SankeyNode } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact } from "@/utils/formatters";

// Colors mapping using React-friendly CSS variables
const groupColors: Record<string, string> = {
  core: "hsl(var(--muted-foreground))",
  income: "hsl(var(--destructive))",
  income_agg: "hsl(142.1 76.2% 36.3%)",
  income_type: "hsl(142.1 76.2% 36.3%)",
  tax_detail: "hsl(142.1 76.2% 36.3%)",
  expense_cofog: "hsl(217.2 91.2% 59.8%)",
  expense_specific: "hsl(199.4 89% 47.6%)",
};

interface SankeyViewProps {
  filteredNodes: SankeyNode[];
  filteredLinks: SankeyLink[];
  activeNodes: SankeyNode[];
  selectedNode: string | null;
  nodeLabels: Record<string, string>;
  ccaaPopulation: number | null;
  onNodeClick: (nodeId: string) => void;
  onResetView: () => void;
  resetViewLabel: string;
  infoBox: string;
  formatPerCapita: (amountMillions: number) => string;
}

export const SankeyView: React.FC<SankeyViewProps> = ({
  filteredNodes,
  filteredLinks,
  activeNodes,
  selectedNode,
  nodeLabels,
  ccaaPopulation,
  onNodeClick,
  onResetView,
  resetViewLabel,
  infoBox,
  formatPerCapita,
}) => {
  const { msg } = useI18n();
  const flowsCopy = msg.blocks.flows;
  return (
    <>
      {selectedNode && (
        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            onClick={onResetView}
            className="shrink-0 flex items-center gap-2"
          >
            <ZoomOut className="w-4 h-4" />
            {resetViewLabel}
          </Button>
        </div>
      )}
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
          label={(node) => nodeLabels[node.id] || node.id.toString()}
          labelTextColor="hsl(var(--foreground))"
          onClick={(data) => {
            if ("sourceLinks" in data) {
              onNodeClick(data.id.toString());
            }
          }}
          valueFormat={(value: number) => formatCompact(value * 1_000_000)}
          // biome-ignore lint/suspicious/noExplicitAny: nivo Sankey tooltip type is not exported
          nodeTooltip={(node: any) => {
            const nodeData = activeNodes.find((n: SankeyNode) => n.id === node.node.id);
            const attr = nodeData?.whatIfAttribution;
            const hasAttribution =
              attr && (attr.directSubtracted > 0 || attr.proportionalSubtracted > 0);
            const perCapitaText =
              ccaaPopulation && node.node.value > 0 ? formatPerCapita(node.node.value) : "";

            return (
              <div className="bg-popover/80 backdrop-blur-md text-popover-foreground px-3 py-2 rounded-xl border border-white/10 shadow-xl text-sm max-w-xs">
                <span className="font-semibold">
                  {nodeLabels[node.node.id] || node.node.id.toString()}
                </span>
                : {formatCompact(node.node.value * 1_000_000)}
                {perCapitaText && (
                  <div className="text-xs text-muted-foreground mt-0.5">{perCapitaText}</div>
                )}
                {hasAttribution && (
                  <div className="mt-1.5 pt-1.5 border-t border-white/10 space-y-0.5 text-xs text-muted-foreground">
                    <div className="flex justify-between gap-4">
                      <span>Original:</span>
                      <span className="tabular-nums">
                        {formatCompact(attr.originalAmount * 1_000_000)}
                      </span>
                    </div>
                    {attr.directSubtracted > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>{flowsCopy.directRegional}:</span>
                        <span className="tabular-nums text-red-400">
                          −{formatCompact(attr.directSubtracted * 1_000_000)}
                        </span>
                      </div>
                    )}
                    {attr.proportionalSubtracted > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>{flowsCopy.proportionalGdp}:</span>
                        <span className="tabular-nums text-orange-400">
                          −{formatCompact(attr.proportionalSubtracted * 1_000_000)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }}
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
          <p>{infoBox}</p>
        </div>
      )}
    </>
  );
};
