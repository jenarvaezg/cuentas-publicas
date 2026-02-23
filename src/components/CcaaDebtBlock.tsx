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
  const { ccaaDebt, taxRevenue, ccaaFiscalBalance, ccaaForalFlows, ccaaSpending } = useData();
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
          regionalDeficit: "Regional deficit (proxy)",
          regionalSpending: "Regional spending (proxy)",
          officialBalance: "Regional balance (official)",
          officialNetBalance: "Net balance",
          officialCededTaxes: "Ceded taxes",
          officialTransfers: "Transfers",
          foralPaymentToState: "Payment to the State",
          foralAdjustmentsWithState: "Adjustments with the State",
          foralNetFlowToState: "Net flow",
          foralBasedOnYear: "foral year",
          officialBasedOnYear: "official year",
          officialUnavailable: "Official balance not available for this region/year.",
          officialUnavailableForalFlow:
            "For this region, foral flow references are shown instead of common-regime balance.",
          officialSpending: "Regional spending (official)",
          officialSpendingTotal: "Total spending",
          officialSpendingTopDivision: "Top function",
          cofogDivisionLabels: {
            "01": "General public services",
            "02": "Defence",
            "03": "Public order and safety",
            "04": "Economic affairs",
            "05": "Environmental protection",
            "06": "Housing and community amenities",
            "07": "Health",
            "08": "Recreation, culture and religion",
            "09": "Education",
            "10": "Social protection",
          } as Record<string, string>,
          officialForalNote:
            "Navarra and País Vasco are excluded from this dataset (common-regime settlement).",
          officialFormulaNote: "Net balance = transfers - ceded taxes.",
          deficitProxy: "Debt change proxy (12m)",
          spendingProxy: "Estimated spending",
          surplusProxy: "Estimated surplus",
          proxyNote:
            "Proxy based on 12m debt change (BdE) and AEAT tax revenue. Not equivalent to national accounts deficit.",
          unavailableProxy: "Not available for this region/year.",
          taxRevenueRef: "AEAT tax revenue",
          foralTaxRevenueRef: "Foral tax revenue",
          basedOnYear: "based on year",
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
          regionalDeficit: "Déficit CCAA (proxy)",
          regionalSpending: "Gasto CCAA (proxy)",
          officialBalance: "Saldo CCAA (oficial)",
          officialNetBalance: "Saldo neto",
          officialCededTaxes: "Impuestos cedidos",
          officialTransfers: "Transferencias",
          foralPaymentToState: "Pago al Estado",
          foralAdjustmentsWithState: "Ajustes con el Estado",
          foralNetFlowToState: "Flujo neto",
          foralBasedOnYear: "año foral",
          officialBasedOnYear: "año oficial",
          officialUnavailable: "Balanza oficial no disponible para esta comunidad/año.",
          officialUnavailableForalFlow:
            "Para esta comunidad se muestran referencias forales en lugar de la balanza de régimen común.",
          officialSpending: "Gasto CCAA (oficial)",
          officialSpendingTotal: "Gasto total",
          officialSpendingTopDivision: "Función principal",
          cofogDivisionLabels: {
            "01": "Servicios públicos generales",
            "02": "Defensa",
            "03": "Orden público y seguridad",
            "04": "Asuntos económicos",
            "05": "Protección del medio ambiente",
            "06": "Vivienda y servicios comunitarios",
            "07": "Salud",
            "08": "Ocio, cultura y religión",
            "09": "Educación",
            "10": "Protección social",
          } as Record<string, string>,
          officialForalNote:
            "Navarra y País Vasco quedan fuera de este dataset (liquidación de régimen común).",
          officialFormulaNote: "Saldo neto = transferencias - impuestos cedidos.",
          deficitProxy: "Proxy por variación deuda (12m)",
          spendingProxy: "Gasto estimado",
          surplusProxy: "Superávit estimado",
          proxyNote:
            "Proxy basado en variación de deuda 12m (BdE) e ingresos tributarios AEAT. No equivale al déficit de contabilidad nacional.",
          unavailableProxy: "No disponible para esta comunidad/año.",
          taxRevenueRef: "Ingresos tributarios AEAT",
          foralTaxRevenueRef: "Recaudación Tributaria Foral",
          basedOnYear: "base año",
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
  const selectedDebtYoYChangePct = selectedEntry?.debtYoYChangePct ?? null;

  const selectedTaxRevenueEuros =
    selectedIsForal && selectedForalFlow?.taxRevenue != null
      ? selectedForalFlow.taxRevenue * 1_000_000
      : selectedTaxRevenue
        ? selectedTaxRevenue.total * 1_000_000
        : null;

  const selectedSpendingProxyEuros =
    selectedDebtYoYChange != null && selectedTaxRevenueEuros != null
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
    ? (copy.cofogDivisionLabels[selectedOfficialSpending.topDivisionCode] ??
      selectedOfficialSpending.topDivisionName)
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-semibold">{copy.officialBalance}</p>
                {selectedBalance ? (
                  <>
                    <p className="text-sm font-semibold mt-1">
                      {copy.officialNetBalance}: {selectedBalance.netBalance >= 0 ? "+" : ""}
                      {formatNumber(selectedBalance.netBalance, 0)} M€
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {copy.officialCededTaxes}: {formatNumber(selectedBalance.cededTaxes, 0)} M€
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {copy.officialTransfers}: {formatNumber(selectedBalance.transfers, 0)} M€
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {copy.officialBasedOnYear} {latestBalanceYear} · {copy.officialFormulaNote}
                    </p>
                  </>
                ) : selectedForalFlow ? (
                  <>
                    <p className="text-xs text-muted-foreground mt-1">
                      {copy.officialUnavailableForalFlow}
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      {copy.foralPaymentToState}:{" "}
                      {formatNumber(selectedForalFlow.paymentToState, 0)} M€
                    </p>
                    {selectedForalFlow.adjustmentsWithState != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {copy.foralAdjustmentsWithState}:{" "}
                        {formatNumber(selectedForalFlow.adjustmentsWithState, 0)} M€
                      </p>
                    )}
                    {selectedForalFlow.netFlowToState != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {copy.foralNetFlowToState}:{" "}
                        {selectedForalFlow.netFlowToState >= 0 ? "+" : ""}
                        {formatNumber(selectedForalFlow.netFlowToState, 0)} M€
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {copy.foralBasedOnYear} {latestForalYear} · {copy.officialForalNote}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mt-1">{copy.officialUnavailable}</p>
                    {selectedIsForal && (
                      <p className="text-xs text-muted-foreground mt-1">{copy.officialForalNote}</p>
                    )}
                  </>
                )}
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-semibold">{copy.officialSpending}</p>
                {selectedOfficialSpending ? (
                  <>
                    <p className="text-sm font-semibold mt-1">
                      {copy.officialSpendingTotal}:{" "}
                      {formatNumber(selectedOfficialSpending.total, 0)} M€
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {copy.officialSpendingTopDivision}: {selectedTopDivisionLabel} (
                      {formatNumber(selectedOfficialSpending.topDivisionPct, 1)}%)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {copy.officialBasedOnYear} {latestSpendingYear}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">{copy.officialUnavailable}</p>
                )}
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-semibold">{copy.regionalDeficit}</p>
                {selectedDebtYoYChange == null ? (
                  <p className="text-xs text-muted-foreground mt-1">{copy.unavailableProxy}</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold mt-1">
                      {selectedDebtYoYChange >= 0 ? copy.deficitProxy : copy.surplusProxy}:{" "}
                      {selectedDebtYoYChange >= 0 ? "+" : "-"}
                      {formatCompact(Math.abs(selectedDebtYoYChange))}
                    </p>
                    {selectedDebtYoYChangePct != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedDebtYoYChange >= 0 ? "+" : ""}
                        {formatNumber(selectedDebtYoYChangePct, 1)}%
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{copy.proxyNote}</p>
                  </>
                )}
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-semibold">{copy.regionalSpending}</p>
                {selectedSpendingProxyEuros == null ? (
                  <p className="text-xs text-muted-foreground mt-1">{copy.unavailableProxy}</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold mt-1">
                      {copy.spendingProxy}: {formatCompact(selectedSpendingProxyEuros)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedIsForal ? copy.foralTaxRevenueRef : copy.taxRevenueRef}:{" "}
                      {formatCompact(selectedTaxRevenueEuros ?? 0)} ({copy.basedOnYear}{" "}
                      {selectedIsForal ? latestForalYear : taxRevenueYear})
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{copy.proxyNote}</p>
                  </>
                )}
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
