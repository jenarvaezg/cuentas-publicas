import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/utils/formatters";

const TAX_COLORS: Record<string, string> = {
  irpf: "hsl(215, 65%, 45%)",
  iva: "hsl(155, 55%, 40%)",
  sociedades: "hsl(30, 75%, 50%)",
  iiee: "hsl(340, 60%, 50%)",
  irnr: "hsl(265, 50%, 55%)",
  resto: "hsl(45, 70%, 50%)",
};

export interface NationalBarDatum {
  name: string;
  key: string;
  amount: number;
  percentage: number;
}

export interface NationalTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: NationalBarDatum }>;
}

export const NationalTooltip = ({ active, payload }: NationalTooltipProps) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">
        {formatNumber(d.amount, 0)} M€ ({formatNumber(d.percentage, 1)}%)
      </p>
    </div>
  );
};

interface NationalTaxChartProps {
  data: NationalBarDatum[];
  height: number;
  drilldown: "iiee" | "resto" | null;
  iieeData: NationalBarDatum[];
  restoData: NationalBarDatum[];
  onBarClick: (data: NationalBarDatum) => void;
  onBackToOverview: () => void;
  backToOverviewLabel: string;
  noDataLabel: string;
  clickHintLabel: string;
  lang: string;
}

export function NationalTaxChart({
  data,
  height,
  drilldown,
  onBarClick,
  onBackToOverview,
  backToOverviewLabel,
  noDataLabel,
  clickHintLabel,
}: NationalTaxChartProps) {
  return (
    <div>
      {drilldown && (
        <div className="mb-3">
          <button
            type="button"
            onClick={onBackToOverview}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            ← {backToOverviewLabel}
          </button>
        </div>
      )}

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <XAxis
              type="number"
              tickFormatter={(v: number) => formatNumber(v, 0)}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={190}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<NationalTooltip />} />
            <Bar
              dataKey="amount"
              radius={[0, 4, 4, 0]}
              cursor={!drilldown ? "pointer" : undefined}
              onClick={!drilldown ? onBarClick : undefined}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={TAX_COLORS[entry.key] ?? TAX_COLORS.resto} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">{noDataLabel}</p>
      )}

      {!drilldown && (
        <p className="text-xs text-muted-foreground/70 text-center mt-1">{clickHintLabel}</p>
      )}
    </div>
  );
}
