import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/ChartTooltip";
import { formatNumber } from "@/utils/formatters";

const COLOR_SPAIN = "hsl(215, 65%, 45%)";
const COLOR_OTHER = "hsl(215, 30%, 65%)";
const COLOR_EU27 = "hsl(215, 15%, 55%)";

const DEMO_EU_INDICATORS = ["birthRate", "deathRate", "fertilityRate", "lifeExpectancy"] as const;

export type DemoEUIndicator = (typeof DEMO_EU_INDICATORS)[number];

export { DEMO_EU_INDICATORS };

interface EUChartDatum {
  country: string;
  countryCode: string;
  value: number;
  isSpain: boolean;
  isEU: boolean;
}

interface EUDemographicComparisonProps {
  data: EUChartDatum[];
  eu27Value: number | null;
  selectedIndicator: DemoEUIndicator;
  onIndicatorChange: (indicator: DemoEUIndicator) => void;
  title: string;
  indicatorLabels: Record<DemoEUIndicator, string>;
  units: Record<DemoEUIndicator, string>;
  eu27Avg: string;
  eurostatYear: number;
}

export function EUDemographicComparison({
  data,
  eu27Value,
  selectedIndicator,
  onIndicatorChange,
  title,
  indicatorLabels,
  units,
  eu27Avg,
  eurostatYear,
}: EUDemographicComparisonProps) {
  if (data.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        <select
          value={selectedIndicator}
          onChange={(e) => onIndicatorChange(e.target.value as DemoEUIndicator)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {DEMO_EU_INDICATORS.map((key) => (
            <option key={key} value={key}>
              {indicatorLabels[key]}
            </option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v: number) =>
              `${formatNumber(v, selectedIndicator === "fertilityRate" ? 1 : 0)}`
            }
          />
          <YAxis
            type="category"
            dataKey="country"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            width={80}
          />
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltip<EUChartDatum>
                active={active}
                payload={payload as Array<{ payload: EUChartDatum }>}
              >
                {(pl) => {
                  const d = pl[0].payload;
                  return (
                    <>
                      <p className="font-semibold text-foreground">{d.country}</p>
                      <p className="text-muted-foreground">
                        {formatNumber(d.value, 1)} {units[selectedIndicator]}
                      </p>
                    </>
                  );
                }}
              </ChartTooltip>
            )}
          />
          {eu27Value != null && (
            <ReferenceLine
              x={eu27Value}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              label={{
                value: `${eu27Avg}: ${formatNumber(eu27Value, 1)}`,
                position: "top",
                style: {
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                },
              }}
            />
          )}
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.countryCode}
                fill={entry.isSpain ? COLOR_SPAIN : entry.isEU ? COLOR_EU27 : COLOR_OTHER}
                opacity={entry.isSpain ? 1 : 0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center mt-1">Eurostat {eurostatYear}</p>
    </div>
  );
}
