import {
  Area,
  AreaChart,
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

interface ProjectionsChartProps {
  populationData: Array<{ year: number; population: number }>;
  agingData: Array<{
    year: number;
    dependencyOldAge: number;
    proportionOver65: number;
  }>;
  populationTitle: string;
  agingTitle: string;
  populationLabel: string;
  dependencyLabel: string;
  proportionLabel: string;
  millionLabel: string;
}

export function ProjectionsChart({
  populationData,
  agingData,
  populationTitle,
  agingTitle,
  populationLabel,
  dependencyLabel,
  proportionLabel,
  millionLabel,
}: ProjectionsChartProps) {
  if (populationData.length <= 1 && agingData.length <= 1) return null;
  return (
    <div className="space-y-6">
      {populationData.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
            {populationTitle}
          </h3>
          <div className="flex items-center justify-center gap-5 mb-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
              {populationLabel}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={populationData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}${millionLabel}`}
              />
              <Tooltip
                content={
                  <SimpleTooltip
                    suffix=""
                    payload={undefined}
                    active={undefined}
                    label={undefined}
                  />
                }
                formatter={(value: number, name: string) => [
                  `${(value / 1_000_000).toFixed(2)}${millionLabel}`,
                  name,
                ]}
              />
              <Area
                type="monotone"
                dataKey="population"
                name={populationLabel}
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {agingData.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
            {agingTitle}
          </h3>
          <div className="flex items-center justify-center gap-5 mb-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-orange-500" />
              {dependencyLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-purple-500" />
              {proportionLabel}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={agingData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              />
              <Tooltip content={<SimpleTooltip suffix="%" />} />
              <Line
                type="monotone"
                dataKey="dependencyOldAge"
                name={dependencyLabel}
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="proportionOver65"
                name={proportionLabel}
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
