import {
  Area,
  AreaChart,
  CartesianGrid,
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
  suffix?: string;
}

export function SimpleTooltip({ active, payload, label, suffix = "" }: SimpleTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-popover/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatNumber(p.value, 2)}
          {suffix}
        </p>
      ))}
    </div>
  );
}

interface ImmigrationDatum {
  year: number;
  share: number;
}

interface ImmigrationChartProps {
  data: ImmigrationDatum[];
  title: string;
  shareLabel: string;
}

export function ImmigrationChart({ data, title, shareLabel }: ImmigrationChartProps) {
  if (data.length <= 1) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v: number) => `${formatNumber(v, 1)}%`}
          />
          <Tooltip content={<SimpleTooltip suffix="%" />} />
          <Area
            type="monotone"
            dataKey="share"
            name={shareLabel}
            stroke="hsl(var(--chart-4))"
            fill="hsl(var(--chart-2))"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
