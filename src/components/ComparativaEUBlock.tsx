import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fromAttribution } from "@/data/sources";
import type { EurostatData } from "@/data/types";
import { useData } from "@/hooks/useData";
import { formatNumber } from "@/utils/formatters";

const INDICATOR_KEYS = [
  "debtToGDP",
  "deficit",
  "expenditureToGDP",
  "socialSpendingToGDP",
  "unemploymentRate",
] as const;

type IndicatorKey = (typeof INDICATOR_KEYS)[number];

/** Spain highlighted in amber, others in slate blue, EU27 in muted */
const COLOR_SPAIN = "hsl(215, 65%, 45%)";
const COLOR_OTHER = "hsl(215, 30%, 65%)";
const COLOR_EU27 = "hsl(215, 15%, 55%)";

export interface ChartDatum {
  country: string;
  countryCode: string;
  value: number;
  isSpain: boolean;
  isEU: boolean;
}

export const CustomTooltip = ({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
  unit?: string;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-foreground">{d.country}</p>
      <p className="text-muted-foreground">
        {formatNumber(d.value, 1)}
        {unit ? ` ${unit}` : "%"}
      </p>
    </div>
  );
};

export function ComparativaEUBlock() {
  const { eurostat } = useData();
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorKey>("debtToGDP");

  const indicatorData = eurostat.indicators[selectedIndicator] ?? {};
  const meta = eurostat.indicatorMeta?.[selectedIndicator];

  // Build chart data sorted by value (descending for most, ascending for deficit)
  const data = useMemo<ChartDatum[]>(() => {
    const entries = eurostat.countries
      .filter((code) => indicatorData[code] !== undefined)
      .map((code) => ({
        country: eurostat.countryNames[code] ?? code,
        countryCode: code,
        value: indicatorData[code],
        isSpain: code === "ES",
        isEU: code === "EU27_2020",
      }));

    // Sort: for deficit (negative values), most negative first; otherwise largest first
    if (selectedIndicator === "deficit") {
      entries.sort((a, b) => a.value - b.value);
    } else {
      entries.sort((a, b) => b.value - a.value);
    }

    return entries;
  }, [eurostat, indicatorData, selectedIndicator]);

  // EU27 value for reference line
  const eu27Value = indicatorData.EU27_2020;

  // Source attribution
  const eurostatSource = eurostat.sourceAttribution?.eurostat
    ? fromAttribution(
        eurostat.sourceAttribution.eurostat as EurostatData["sourceAttribution"]["eurostat"],
      )
    : { name: "Eurostat", url: "https://ec.europa.eu/eurostat/databrowser/" };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>España en la Unión Europea</CardTitle>
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="eu-indicator"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              Indicador
            </label>
            <select
              id="eu-indicator"
              value={selectedIndicator}
              onChange={(e) => setSelectedIndicator(e.target.value as IndicatorKey)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {INDICATOR_KEYS.map((key) => (
                <option key={key} value={key}>
                  {eurostat.indicatorMeta?.[key]?.label ?? key}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_SPAIN }} />
            España
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_OTHER }} />
            Otros países
          </span>
          {eu27Value !== undefined && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-muted-foreground" />
              Media UE-27
            </span>
          )}
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={data.length > 6 ? 360 : 300}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <XAxis
              type="number"
              tickFormatter={(v: number) => `${formatNumber(v, 1)}%`}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              domain={selectedIndicator === "deficit" ? ["dataMin", "dataMax"] : undefined}
            />
            <YAxis
              type="category"
              dataKey="country"
              width={110}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<CustomTooltip unit={meta?.unit} />} />
            {eu27Value !== undefined && (
              <ReferenceLine
                x={eu27Value}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{
                  value: `UE-27: ${formatNumber(eu27Value, 1)}%`,
                  position: "top",
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
            )}
            {selectedIndicator === "deficit" && (
              <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
            )}
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.countryCode}
                  fill={entry.isSpain ? COLOR_SPAIN : entry.isEU ? COLOR_EU27 : COLOR_OTHER}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <p className="text-[10px] text-muted-foreground/70 text-center">
          Datos de{" "}
          <a
            href={eurostatSource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Eurostat
          </a>{" "}
          — Año {eurostat.year}
          {meta?.unit ? ` — ${meta.unit}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
