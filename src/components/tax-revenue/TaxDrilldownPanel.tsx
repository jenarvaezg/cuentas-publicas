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

export interface DrilldownBarDatum {
  name: string;
  key: string;
  amount: number;
  percentage: number;
}

interface DrilldownTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DrilldownBarDatum }>;
}

const DrilldownTooltip = ({ active, payload }: DrilldownTooltipProps) => {
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

interface TaxDrilldownPanelProps {
  data: DrilldownBarDatum[];
  height: number;
  categoryColor?: string;
  onClose: () => void;
  backLabel: string;
}

export function TaxDrilldownPanel({
  data,
  height,
  categoryColor,
  onClose,
  backLabel,
}: TaxDrilldownPanelProps) {
  return (
    <div>
      <div className="mb-3">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          ← {backLabel}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
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
          <Tooltip content={<DrilldownTooltip />} />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.key}
                fill={categoryColor ?? TAX_COLORS[entry.key] ?? TAX_COLORS.resto}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
