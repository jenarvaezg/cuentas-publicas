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
import { ChartTooltip } from "@/components/ChartTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fromAttribution } from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber } from "@/utils/formatters";
import { getSearchParam, updateSearchParams } from "@/utils/url-state";
import { CcaaDetailPanel } from "./ccaa/CcaaDetailPanel";
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
  const { ccaaDebt, taxRevenue, ccaaFiscalBalance, ccaaForalFlows, ccaaSpending, ccaaDeficit } =
    useData();
  const { msg, lang } = useI18n();
  const copy = msg.blocks.ccaa;
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
  const taxRevenueYear = taxRevenue.latestYear;
  const taxRevenueByCode = useMemo(() => {
    const entries = taxRevenue.ccaa[String(taxRevenueYear)]?.entries ?? [];
    return new Map(entries.map((entry) => [entry.code, entry]));
  }, [taxRevenue.ccaa, taxRevenueYear]);
  const selectedTaxRevenue = selectedEntry ? taxRevenueByCode.get(selectedEntry.code) : null;

  const balanceYears = ccaaFiscalBalance?.years ?? [];
  const latestBalanceYear = ccaaFiscalBalance?.latestYear ?? balanceYears[balanceYears.length - 1];
  const balanceByCode = useMemo(() => {
    if (!ccaaFiscalBalance || latestBalanceYear == null) return new Map();
    const entries = ccaaFiscalBalance.byYear?.[String(latestBalanceYear)]?.entries ?? [];
    return new Map(entries.map((entry) => [entry.code, entry]));
  }, [ccaaFiscalBalance, latestBalanceYear]);
  const selectedBalance = selectedEntry ? balanceByCode.get(selectedEntry.code) : undefined;
  const selectedIsForal = selectedEntry?.code === "CA15" || selectedEntry?.code === "CA16";

  const foralYears = ccaaForalFlows?.years ?? [];
  const latestForalYear = ccaaForalFlows?.latestYear ?? foralYears[foralYears.length - 1];
  const foralByCode = useMemo(() => {
    if (!ccaaForalFlows || latestForalYear == null) return new Map();
    const entries = ccaaForalFlows.byYear?.[String(latestForalYear)]?.entries ?? [];
    return new Map(entries.map((entry) => [entry.code, entry]));
  }, [ccaaForalFlows, latestForalYear]);
  const selectedForalFlow = selectedEntry ? foralByCode.get(selectedEntry.code) : undefined;

  const selectedDebtYoYChange = selectedEntry?.debtYoYChangeAbsolute ?? null;

  const deficitYear = ccaaDeficit.latestYear;
  const selectedDeficitEuros =
    selectedEntry && ccaaDeficit.data[selectedEntry.code] != null
      ? ccaaDeficit.data[selectedEntry.code] * 1_000_000
      : null;

  const selectedTaxRevenueEuros =
    selectedIsForal && selectedForalFlow?.taxRevenue != null
      ? selectedForalFlow.taxRevenue * 1_000_000
      : selectedTaxRevenue
        ? selectedTaxRevenue.total * 1_000_000
        : null;

  // We don't have exact real-time proxy spending that squares perfectly without complex aggregation.
  // We keep the old proxy for spending until phase E is fully integrated using ccaaSpending,
  // or use the proxy: Tax Revenue + Deficit (negative means debt)
  const selectedSpendingProxyEuros =
    selectedDeficitEuros != null && selectedTaxRevenueEuros != null
      ? selectedTaxRevenueEuros + Math.abs(selectedDeficitEuros)
      : selectedDebtYoYChange != null && selectedTaxRevenueEuros != null
        ? selectedTaxRevenueEuros + selectedDebtYoYChange
        : null;

  const spendingYears = ccaaSpending?.years ?? [];
  const latestSpendingYear = ccaaSpending?.latestYear ?? spendingYears[spendingYears.length - 1];
  const spendingByCode = useMemo(() => {
    if (!ccaaSpending || latestSpendingYear == null) return new Map();
    const entries = ccaaSpending.byYear?.[String(latestSpendingYear)]?.entries ?? [];
    return new Map(entries.map((entry) => [entry.code, entry]));
  }, [ccaaSpending, latestSpendingYear]);
  const selectedOfficialSpending = selectedEntry
    ? spendingByCode.get(selectedEntry.code)
    : undefined;
  const selectedTopDivisionLabel = selectedOfficialSpending
    ? (copy.cofogDivisionLabels[
        selectedOfficialSpending.topDivisionCode as keyof typeof copy.cofogDivisionLabels
      ] ?? selectedOfficialSpending.topDivisionName)
    : null;

  useEffect(() => {
    if (selectedCcaa !== "all" && !ccaaCodes.has(selectedCcaa)) {
      setSelectedCcaa("all");
    }
  }, [ccaaCodes, selectedCcaa]);

  useEffect(() => {
    updateSearchParams({
      ccaa: selectedCcaa === "all" ? null : selectedCcaa,
      ccaaMetric: selectedMetric === "debtToGDP" ? null : selectedMetric,
    });
  }, [selectedCcaa, selectedMetric]);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ChartDatum }>;
  }) => (
    <ChartTooltip active={active} payload={payload}>
      {(pl) => {
        const d = pl[0].payload;
        const formatted =
          selectedMetric === "debtToGDP"
            ? `${formatNumber(d.value, 1)}${copy.gdpSuffix.startsWith("%") ? copy.gdpSuffix : ` ${copy.gdpSuffix}`}`
            : `${formatCompact(d.value)}`;
        return (
          <>
            <p className="font-semibold text-foreground">{d.name}</p>
            <p className="text-muted-foreground">{formatted}</p>
          </>
        );
      }}
    </ChartTooltip>
  );

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
          <CcaaDetailPanel
            selectedEntry={selectedEntry}
            quarter={ccaaDebt.quarter}
            selectedRank={selectedRank ?? undefined}
            dataLength={data.length}
            selectedMetric={selectedMetric}
            nationalMetricValue={nationalMetricValue}
            differenceLabel={differenceLabel}
            selectedBalance={selectedBalance}
            selectedForalFlow={selectedForalFlow}
            selectedIsForal={selectedIsForal}
            latestBalanceYear={latestBalanceYear}
            latestForalYear={latestForalYear}
            selectedOfficialSpending={selectedOfficialSpending}
            latestSpendingYear={latestSpendingYear}
            selectedTopDivisionLabel={selectedTopDivisionLabel}
            selectedDeficitEuros={selectedDeficitEuros}
            deficitYear={deficitYear}
            selectedSpendingProxyEuros={selectedSpendingProxyEuros}
            selectedTaxRevenueEuros={selectedTaxRevenueEuros}
            selectedIsForal2={selectedIsForal}
            latestForalYear2={latestForalYear}
            taxRevenueYear={taxRevenueYear}
            copy={{
              detail: copy.detail,
              totalDebt: copy.totalDebt,
              debtToGdp: copy.debtToGdp,
              ranking: copy.ranking,
              ofLabel: copy.ofLabel,
              metricLabels: copy.metricLabels,
              differenceVsNational: copy.differenceVsNational,
              officialBalance: copy.officialBalance,
              officialNetBalance: copy.officialNetBalance,
              officialCededTaxes: copy.officialCededTaxes,
              officialTransfers: copy.officialTransfers,
              officialBasedOnYear: copy.officialBasedOnYear,
              officialFormulaNote: copy.officialFormulaNote,
              officialUnavailableForalFlow: copy.officialUnavailableForalFlow,
              foralPaymentToState: copy.foralPaymentToState,
              foralAdjustmentsWithState: copy.foralAdjustmentsWithState,
              foralNetFlowToState: copy.foralNetFlowToState,
              foralBasedOnYear: copy.foralBasedOnYear,
              officialForalNote: copy.officialForalNote,
              officialUnavailable: copy.officialUnavailable,
              officialSpending: copy.officialSpending,
              officialSpendingTotal: copy.officialSpendingTotal,
              officialSpendingTopDivision: copy.officialSpendingTopDivision,
              regionalDeficit: copy.regionalDeficit,
              deficitOfficialNote: copy.deficitOfficialNote,
              unavailableProxy: copy.unavailableProxy,
              basedOnYear: copy.basedOnYear,
              regionalSpending: copy.regionalSpending,
              spendingProxy: copy.spendingProxy,
              foralTaxRevenueRef: copy.foralTaxRevenueRef,
              taxRevenueRef: copy.taxRevenueRef,
              proxyNote: copy.proxyNote,
            }}
            notAvailable={msg.common.notAvailable}
          />
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
