import {
  CartesianGrid,
  Line,
  LineChart,
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

interface LifeExpDatum {
  year: number;
  both?: number;
  male?: number;
  female?: number;
}

interface LifeExpectancyChartProps {
  data: LifeExpDatum[];
  title: string;
  bothLabel: string;
  maleLabel: string;
  femaleLabel: string;
  yearsLabel: string;
}

export function LifeExpectancyChart({
  data,
  title,
  bothLabel,
  maleLabel,
  femaleLabel,
  yearsLabel,
}: LifeExpectancyChartProps) {
  if (data.length <= 1) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">{title}</h3>
      <div className="flex items-center justify-center gap-5 mb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
          {bothLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-teal-500" />
          {maleLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-rose-500" />
          {femaleLabel}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            domain={["dataMin - 2", "dataMax + 2"]}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v: number) => formatNumber(v, 1)}
          />
          <Tooltip content={<SimpleTooltip suffix={` ${yearsLabel}`} />} />
          <Line
            type="monotone"
            dataKey="both"
            name={bothLabel}
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="male"
            name={maleLabel}
            stroke="hsl(var(--chart-4))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="female"
            name={femaleLabel}
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
