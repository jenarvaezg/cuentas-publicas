import type { CcaaDebtEntry } from "@/data/types";
import { formatCompact, formatNumber } from "@/utils/formatters";

type MetricKey = "debtToGDP" | "debtAbsolute";

interface CcaaFiscalBalanceEntry {
  code: string;
  name: string;
  netBalance: number;
  cededTaxes: number;
  transfers: number;
}

interface CcaaForalFlowEntry {
  code: string;
  name: string;
  paymentToState: number;
  adjustmentsWithState?: number;
  netFlowToState?: number;
  taxRevenue?: number;
}

interface CcaaSpendingEntry {
  code: string;
  name: string;
  total: number;
  topDivisionCode: string;
  topDivisionName: string;
  topDivisionPct: number;
  divisions: Record<string, number>;
}

interface CcaaDetailPanelProps {
  selectedEntry: CcaaDebtEntry;
  quarter: string;
  selectedRank: number | undefined;
  dataLength: number;
  selectedMetric: MetricKey;
  nationalMetricValue: number;
  differenceLabel: string;
  selectedBalance: CcaaFiscalBalanceEntry | undefined;
  selectedForalFlow: CcaaForalFlowEntry | undefined;
  selectedIsForal: boolean;
  latestBalanceYear: number | undefined;
  latestForalYear: number | undefined;
  selectedOfficialSpending: CcaaSpendingEntry | undefined;
  latestSpendingYear: number | undefined;
  selectedTopDivisionLabel: string | null;
  selectedDeficitEuros: number | null;
  deficitYear: number | undefined;
  selectedSpendingProxyEuros: number | null;
  selectedTaxRevenueEuros: number | null;
  selectedIsForal2: boolean;
  latestForalYear2: number | undefined;
  taxRevenueYear: number | undefined;
  copy: {
    detail: string;
    totalDebt: string;
    debtToGdp: string;
    ranking: string;
    ofLabel: string;
    metricLabels: Record<MetricKey, string>;
    differenceVsNational: string;
    officialBalance: string;
    officialNetBalance: string;
    officialCededTaxes: string;
    officialTransfers: string;
    officialBasedOnYear: string;
    officialFormulaNote: string;
    officialUnavailableForalFlow: string;
    foralPaymentToState: string;
    foralAdjustmentsWithState: string;
    foralNetFlowToState: string;
    foralBasedOnYear: string;
    officialForalNote: string;
    officialUnavailable: string;
    officialSpending: string;
    officialSpendingTotal: string;
    officialSpendingTopDivision: string;
    regionalDeficit: string;
    deficitOfficialNote: string;
    unavailableProxy: string;
    basedOnYear: string;
    regionalSpending: string;
    spendingProxy: string;
    foralTaxRevenueRef: string;
    taxRevenueRef: string;
    proxyNote: string;
    surplus: string;
    deficit: string;
  };
  notAvailable: string;
}

export function CcaaDetailPanel({
  selectedEntry,
  quarter,
  selectedRank,
  dataLength,
  selectedMetric,
  differenceLabel,
  selectedBalance,
  selectedForalFlow,
  selectedIsForal,
  latestBalanceYear,
  latestForalYear,
  selectedOfficialSpending,
  latestSpendingYear,
  selectedTopDivisionLabel,
  selectedDeficitEuros,
  deficitYear,
  selectedSpendingProxyEuros,
  selectedTaxRevenueEuros,
  latestForalYear2,
  taxRevenueYear,
  copy,
  notAvailable,
}: CcaaDetailPanelProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {copy.detail}: {selectedEntry.name}
        </h3>
        <span className="text-xs text-muted-foreground">{quarter}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-md border bg-background p-3 min-w-0">
          <p className="text-[11px] text-muted-foreground">{copy.totalDebt}</p>
          <p className="text-sm font-semibold">{formatCompact(selectedEntry.debtAbsolute)}</p>
        </div>
        <div className="rounded-md border bg-background p-3 min-w-0">
          <p className="text-[11px] text-muted-foreground">{copy.debtToGdp}</p>
          <p className="text-sm font-semibold">{formatNumber(selectedEntry.debtToGDP, 1)}%</p>
        </div>
        <div className="rounded-md border bg-background p-3 min-w-0">
          <p className="text-[11px] text-muted-foreground">
            {copy.ranking} ({copy.metricLabels[selectedMetric]})
          </p>
          <p className="text-sm font-semibold">
            {selectedRank ? `${selectedRank} ${copy.ofLabel} ${dataLength}` : notAvailable}
          </p>
        </div>
        <div className="rounded-md border bg-background p-3 min-w-0">
          <p className="text-[11px] text-muted-foreground">{copy.differenceVsNational}</p>
          <p className="text-sm font-semibold">{differenceLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-md border bg-background p-3 min-w-0">
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
                {copy.foralPaymentToState}: {formatNumber(selectedForalFlow.paymentToState, 0)} M€
              </p>
              {selectedForalFlow.adjustmentsWithState != null && (
                <p className="text-xs text-muted-foreground mt-1">
                  {copy.foralAdjustmentsWithState}:{" "}
                  {formatNumber(selectedForalFlow.adjustmentsWithState, 0)} M€
                </p>
              )}
              {selectedForalFlow.netFlowToState != null && (
                <p className="text-xs text-muted-foreground mt-1">
                  {copy.foralNetFlowToState}: {selectedForalFlow.netFlowToState >= 0 ? "+" : ""}
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

        <div className="rounded-md border bg-background p-3 min-w-0">
          <p className="text-xs font-semibold">{copy.officialSpending}</p>
          {selectedOfficialSpending ? (
            <>
              <p className="text-sm font-semibold mt-1">
                {copy.officialSpendingTotal}: {formatNumber(selectedOfficialSpending.total, 0)} M€
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {copy.officialSpendingTopDivision}: {selectedTopDivisionLabel} (
                {formatNumber(selectedOfficialSpending.topDivisionPct, 1)}
                %)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {copy.officialBasedOnYear} {latestSpendingYear}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">{copy.officialUnavailable}</p>
          )}
        </div>

        <div className="rounded-md border bg-background p-3 min-w-0">
          <p className="text-xs font-semibold">{copy.regionalDeficit}</p>
          {selectedDeficitEuros == null ? (
            <p className="text-xs text-muted-foreground mt-1">{copy.unavailableProxy}</p>
          ) : (
            <>
              <p className="text-sm font-semibold mt-1">
                {selectedDeficitEuros >= 0 ? copy.surplus : copy.deficit}:{" "}
                {selectedDeficitEuros >= 0 ? "+" : "-"}
                {formatCompact(Math.abs(selectedDeficitEuros))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {copy.basedOnYear} {deficitYear}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{copy.deficitOfficialNote}</p>
            </>
          )}
        </div>

        <div className="rounded-md border bg-background p-3 min-w-0">
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
                {selectedIsForal ? latestForalYear2 : taxRevenueYear})
              </p>
              <p className="text-xs text-muted-foreground mt-1">{copy.proxyNote}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
