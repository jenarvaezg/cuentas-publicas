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
import { useI18n } from "@/i18n/I18nProvider";
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
  fallbackUnit,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
  unit?: string;
  fallbackUnit?: string;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const normalizedUnit = unit || fallbackUnit;

  return (
    <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-foreground">{d.country}</p>
      <p className="text-muted-foreground">
        {formatNumber(d.value, 1)}
        {normalizedUnit ? ` ${normalizedUnit}` : "%"}
      </p>
    </div>
  );
};

export function ComparativaEUBlock() {
  const { eurostat } = useData();
  const { msg, lang } = useI18n();
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorKey>("debtToGDP");

  const copy =
    lang === "en"
      ? {
          spain: "Spain",
          otherCountries: "Other countries",
          eu27Average: "EU-27 average",
          yearLabel: "Year",
          dataFrom: "Data from",
          indicatorLabels: {
            debtToGDP: "Debt-to-GDP",
            deficit: "Deficit/surplus",
            expenditureToGDP: "Public spending/GDP",
            socialSpendingToGDP: "Social spending/GDP",
            unemploymentRate: "Unemployment rate",
          } as Record<IndicatorKey, string>,
          unitByIndicator: {
            debtToGDP: "% of GDP",
            deficit: "% of GDP",
            expenditureToGDP: "% of GDP",
            socialSpendingToGDP: "% of GDP",
            unemploymentRate: "%",
          } as Record<IndicatorKey, string>,
          countryNames: {
            ES: "Spain",
            DE: "Germany",
            FR: "France",
            IT: "Italy",
            PT: "Portugal",
            EL: "Greece",
            NL: "Netherlands",
            EU27_2020: "EU-27",
          } as Record<string, string>,
        }
      : {
          spain: "España",
          otherCountries: "Otros países",
          eu27Average: "Media UE-27",
          yearLabel: "Año",
          dataFrom: "Datos de",
          indicatorLabels: {
            debtToGDP: "Deuda/PIB",
            deficit: "Déficit/superávit",
            expenditureToGDP: "Gasto público/PIB",
            socialSpendingToGDP: "Gasto social/PIB",
            unemploymentRate: "Tasa de paro",
          } as Record<IndicatorKey, string>,
          unitByIndicator: {
            debtToGDP: "% del PIB",
            deficit: "% del PIB",
            expenditureToGDP: "% del PIB",
            socialSpendingToGDP: "% del PIB",
            unemploymentRate: "%",
          } as Record<IndicatorKey, string>,
          countryNames: {} as Record<string, string>,
        };

  const indicatorData = eurostat.indicators[selectedIndicator] ?? {};
  const meta = eurostat.indicatorMeta?.[selectedIndicator];
  const selectedUnit =
    lang === "en"
      ? copy.unitByIndicator[selectedIndicator]
      : (meta?.unit ?? copy.unitByIndicator[selectedIndicator]);

  // Build chart data sorted by value (descending for most, ascending for deficit)
  const data = useMemo<ChartDatum[]>(() => {
    const entries = eurostat.countries
      .filter((code) => indicatorData[code] !== undefined)
      .map((code) => ({
        country: copy.countryNames[code] ?? eurostat.countryNames[code] ?? code,
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
  }, [copy.countryNames, eurostat, indicatorData, selectedIndicator]);

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
          <CardTitle>{msg.blocks.eu.title}</CardTitle>
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="eu-indicator"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              {msg.common.indicator}
            </label>
            <select
              id="eu-indicator"
              value={selectedIndicator}
              onChange={(e) => setSelectedIndicator(e.target.value as IndicatorKey)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {INDICATOR_KEYS.map((key) => (
                <option key={key} value={key}>
                  {copy.indicatorLabels[key]}
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
            {copy.spain}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_OTHER }} />
            {copy.otherCountries}
          </span>
          {eu27Value !== undefined && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-muted-foreground" />
              {copy.eu27Average}
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
            <Tooltip
              content={
                <CustomTooltip
                  unit={selectedUnit}
                  fallbackUnit={copy.unitByIndicator[selectedIndicator]}
                />
              }
            />
            {eu27Value !== undefined && (
              <ReferenceLine
                x={eu27Value}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{
                  value: `${copy.eu27Average}: ${formatNumber(eu27Value, 1)}%`,
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

        <p className="text-xs text-muted-foreground/80 text-center">
          {copy.dataFrom}{" "}
          <a
            href={eurostatSource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Eurostat
          </a>{" "}
          — {copy.yearLabel} {eurostat.year}
          {` — ${selectedUnit}`}
        </p>
      </CardContent>
    </Card>
  );
}
