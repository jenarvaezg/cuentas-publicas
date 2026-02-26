import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/utils/formatters";

interface SimpleTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    name: string;
  }>;
  label?: number;
}

function SimpleTooltip({ active, payload, label }: SimpleTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-popover/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatNumber(p.value / 1000, 1)}K
        </p>
      ))}
    </div>
  );
}

interface MigrationFlowsChartProps {
  data: Array<{ year: number; immigration: number; emigration: number; netMigration: number }>;
  title: string;
  immigrationLabel: string;
  emigrationLabel: string;
  netLabel: string;
}

export function MigrationFlowsChart({
  data,
  title,
  immigrationLabel,
  emigrationLabel,
  netLabel,
}: MigrationFlowsChartProps) {
  if (data.length <= 1) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">{title}</h3>
      <div className="flex items-center justify-center gap-5 mb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
          {immigrationLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-rose-500" />
          {emigrationLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 border-t-2 border-dashed border-blue-400" />
          {netLabel}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
          />
          <Tooltip content={<SimpleTooltip />} />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
          <Area
            type="monotone"
            dataKey="immigration"
            name={immigrationLabel}
            stroke="hsl(var(--chart-1))"
            fill="hsl(var(--chart-1))"
            fillOpacity={0.3}
            strokeWidth={2}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="emigration"
            name={emigrationLabel}
            stroke="hsl(var(--chart-2))"
            fill="hsl(var(--chart-2))"
            fillOpacity={0.3}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="netMigration"
            name={netLabel}
            stroke="hsl(var(--chart-3))"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
