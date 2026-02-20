import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber } from "@/utils/formatters";
import { getSearchParam, updateSearchParams } from "@/utils/url-state";
import { ExportBlockButton } from "./ExportBlockButton";

type MetricKey = "debtToGDP" | "debtAbsolute";
type CcaaSelection = "all" | string;

const COLOR_TOP = "hsl(215, 65%, 45%)";
const COLOR_OTHER = "hsl(215, 30%, 65%)";

interface ChartDatum {
  name: string;
  code: string;
  value: number;
  isTop3: boolean;
  rank: number;
}

function parseMetricFromQuery(): MetricKey {
  const param = getSearchParam("ccaaMetric");
  return param === "debtAbsolute" ? "debtAbsolute" : "debtToGDP";
}

function parseCcaaFromQuery(allowedCodes: Set<string>): CcaaSelection {
  const param = getSearchParam("ccaa");
  if (!param || param === "all") return "all";
  return allowedCodes.has(param) ? param : "all";
}

export function CcaaDebtBlock() {
  const { ccaaDebt } = useData();
  const { msg, lang } = useI18n();
  const copy =
    lang === "en"
      ? {
          metricLabels: {
            debtToGDP: "Debt/GDP (%)",
            debtAbsolute: "Total debt (€)",
          } as Record<MetricKey, string>,
          gdpSuffix: "% of GDP",
          detail: "Detail",
          totalDebt: "Total debt",
          debtToGdp: "Debt/GDP",
          ranking: "Ranking",
          ofLabel: "of",
          differenceVsNational: "Difference vs national total",
          regionalDeficit: "Regional deficit",
          regionalSpending: "Regional spending",
          upcomingOfficial: "Coming soon: pending integration of an official source by region.",
          top3: "Top 3",
          restRegions: "Rest of regions",
          nationalTotal: "National total",
          dataFrom: "Data from",
          totalLabel: "Total",
        }
      : {
          metricLabels: {
            debtToGDP: "Deuda/PIB (%)",
            debtAbsolute: "Deuda total (€)",
          } as Record<MetricKey, string>,
          gdpSuffix: "% del PIB",
          detail: "Detalle",
          totalDebt: "Deuda total",
          debtToGdp: "Deuda/PIB",
          ranking: "Ranking",
          ofLabel: "de",
          differenceVsNational: "Diferencia vs total nacional",
          regionalDeficit: "Déficit CCAA",
          regionalSpending: "Gasto CCAA",
          upcomingOfficial:
            "Próximamente: pendiente de integración de fuente oficial por comunidad.",
          top3: "Top 3",
          restRegions: "Resto de CCAA",
          nationalTotal: "Total nacional",
          dataFrom: "Datos del",
          totalLabel: "Total",
        };
  const ccaaCodes = useMemo(
    () => new Set(ccaaDebt.ccaa.map((entry) => entry.code)),
    [ccaaDebt.ccaa],
  );

  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(() => parseMetricFromQuery());
  const [selectedCcaa, setSelectedCcaa] = useState<CcaaSelection>(() =>
    parseCcaaFromQuery(new Set(ccaaDebt.ccaa.map((entry) => entry.code))),
  );

  const data = useMemo<ChartDatum[]>(() => {
    const sorted = ccaaDebt.ccaa
      .map((entry) => ({
        name: entry.name,
        code: entry.code,
        value: entry[selectedMetric],
        isTop3: false,
        rank: 0,
      }))
      .sort((a, b) => b.value - a.value);

    return sorted.map((d, i) => ({ ...d, isTop3: i < 3, rank: i + 1 }));
  }, [ccaaDebt, selectedMetric]);

  const communityOptions = useMemo(
    () =>
      [...ccaaDebt.ccaa].sort((a, b) => a.name.localeCompare(b.name, lang === "en" ? "en" : "es")),
    [ccaaDebt.ccaa, lang],
  );

  const selectedEntry =
    selectedCcaa === "all"
      ? null
      : (ccaaDebt.ccaa.find((entry) => entry.code === selectedCcaa) ?? null);
  const selectedRank = selectedEntry
    ? data.find((entry) => entry.code === selectedEntry.code)?.rank
    : null;

  const selectedMetricValue = selectedEntry ? selectedEntry[selectedMetric] : 0;
  const nationalMetricValue = ccaaDebt.total[selectedMetric];
  const metricDifference = selectedMetricValue - nationalMetricValue;

  useEffect(() => {
    if (selectedCcaa !== "all" && !ccaaCodes.has(selectedCcaa)) {
      setSelectedCcaa("all");
    }
  }, [ccaaCodes, selectedCcaa]);

  useEffect(() => {
    updateSearchParams({
      section: "ccaa",
      ccaa: selectedCcaa,
      ccaaMetric: selectedMetric,
    });
  }, [selectedCcaa, selectedMetric]);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ChartDatum }>;
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const formatted =
      selectedMetric === "debtToGDP"
        ? `${formatNumber(d.value, 1)}${copy.gdpSuffix.startsWith("%") ? copy.gdpSuffix : ` ${copy.gdpSuffix}`}`
        : `${formatCompact(d.value)}`;
    return (
      <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
        <p className="font-semibold text-foreground">{d.name}</p>
        <p className="text-muted-foreground">{formatted}</p>
      </div>
    );
  };

  const differenceLabel =
    selectedMetric === "debtToGDP"
      ? `${metricDifference >= 0 ? "+" : "-"}${formatNumber(Math.abs(metricDifference), 1)} pp`
      : `${metricDifference >= 0 ? "+" : "-"}${formatCompact(Math.abs(metricDifference))}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{msg.blocks.ccaa.title}</CardTitle>
            <ExportBlockButton targetId="ccaa" filenamePrefix="cuentas-publicas-ccaa" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="ccaa-community"
                className="text-xs text-muted-foreground whitespace-nowrap"
              >
                {msg.common.community}
              </label>
              <select
                id="ccaa-community"
                value={selectedCcaa}
                onChange={(e) => setSelectedCcaa(e.target.value as CcaaSelection)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">{msg.common.all}</option>
                {communityOptions.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="ccaa-metric"
                className="text-xs text-muted-foreground whitespace-nowrap"
              >
                {msg.common.metric}
              </label>
              <select
                id="ccaa-metric"
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {(Object.entries(copy.metricLabels) as [MetricKey, string][]).map(
                  ([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedEntry && (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {copy.detail}: {selectedEntry.name}
              </h3>
              <span className="text-xs text-muted-foreground">{ccaaDebt.quarter}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-md border bg-background p-3">
                <p className="text-[11px] text-muted-foreground">{copy.totalDebt}</p>
                <p className="text-sm font-semibold">{formatCompact(selectedEntry.debtAbsolute)}</p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-[11px] text-muted-foreground">{copy.debtToGdp}</p>
                <p className="text-sm font-semibold">{formatNumber(selectedEntry.debtToGDP, 1)}%</p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-[11px] text-muted-foreground">
                  {copy.ranking} ({copy.metricLabels[selectedMetric]})
                </p>
                <p className="text-sm font-semibold">
                  {selectedRank
                    ? `${selectedRank} ${copy.ofLabel} ${data.length}`
                    : msg.common.notAvailable}
                </p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-[11px] text-muted-foreground">{copy.differenceVsNational}</p>
                <p className="text-sm font-semibold">{differenceLabel}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-md border border-dashed bg-background p-3">
                <p className="text-xs font-semibold">{copy.regionalDeficit}</p>
                <p className="text-xs text-muted-foreground mt-1">{copy.upcomingOfficial}</p>
              </div>
              <div className="rounded-md border border-dashed bg-background p-3">
                <p className="text-xs font-semibold">{copy.regionalSpending}</p>
                <p className="text-xs text-muted-foreground mt-1">{copy.upcomingOfficial}</p>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_TOP }} />
            {copy.top3}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_OTHER }} />
            {copy.restRegions}
          </span>
          {selectedMetric === "debtToGDP" && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-muted-foreground" />
              {copy.nationalTotal}
            </span>
          )}
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={480}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <XAxis
              type="number"
              tickFormatter={
                selectedMetric === "debtToGDP"
                  ? (v: number) => `${formatNumber(v, 1)}%`
                  : (v: number) => formatCompact(v)
              }
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<CustomTooltip />} />
            {selectedMetric === "debtToGDP" && (
              <ReferenceLine
                x={ccaaDebt.total.debtToGDP}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{
                  value: `${copy.totalLabel}: ${formatNumber(ccaaDebt.total.debtToGDP, 1)}%`,
                  position: "top",
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
            )}
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell key={entry.code} fill={entry.isTop3 ? COLOR_TOP : COLOR_OTHER} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {(() => {
          const attr =
            selectedMetric === "debtToGDP"
              ? fromAttribution(ccaaDebt.sourceAttribution.be1310)
              : fromAttribution(ccaaDebt.sourceAttribution.be1309);

          return (
            <p className="text-xs text-muted-foreground/80 text-center flex items-center justify-center gap-1">
              <span>{copy.dataFrom}</span>
              <a
                href={attr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground inline-flex items-center gap-0.5"
              >
                {attr.name}
                <ExternalLink className="h-2 w-2" />
              </a>
              <span>— {ccaaDebt.quarter}</span>
              {attr.note && <span className="hidden sm:inline">({attr.note})</span>}
            </p>
          );
        })()}
      </CardContent>
    </Card>
  );
}
