import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/utils/formatters";

const COLOR_TOP = "hsl(215, 65%, 45%)";
const COLOR_OTHER = "hsl(215, 30%, 65%)";
const COLOR_BALANCE_POSITIVE = "hsl(150, 58%, 40%)";
const COLOR_BALANCE_NEGATIVE = "hsl(0, 67%, 50%)";

export type TaxTypeKey = "total" | "irpf" | "iva" | "sociedades" | "iiee" | "irnr";
export type CcaaModeKey = "aeat" | "balance";
export type BalanceMetricKey = "netBalance" | "cededTaxes" | "transfers";

export interface CcaaBarDatum {
  name: string;
  code: string;
  value: number;
  isTop3: boolean;
}

interface CcaaTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CcaaBarDatum }>;
  metricLabel: string;
}

const CcaaTooltip = ({ active, payload, metricLabel }: CcaaTooltipProps) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">
        {metricLabel}: {formatNumber(d.value, 0)} M€
      </p>
    </div>
  );
};

interface CcaaTaxTabProps {
  data: CcaaBarDatum[];
  chartHeight: number;
  xDomain: [number, number];
  ccaaMode: CcaaModeKey;
  selectedTaxType: TaxTypeKey;
  selectedBalanceMetric: BalanceMetricKey;
  metricLabel: string;
  taxNames: Record<string, string>;
  onCcaaModeChange: (mode: CcaaModeKey) => void;
  onTaxTypeChange: (type: TaxTypeKey) => void;
  onBalanceMetricChange: (metric: BalanceMetricKey) => void;
  copy: {
    ccaaMode: string;
    ccaaModeAeat: string;
    ccaaModeBalance: string;
    taxType: string;
    allTaxes: string;
    balanceMetric: string;
    balanceNet: string;
    balanceCeded: string;
    balanceTransfers: string;
    top3: string;
    restRegions: string;
    balancePositive: string;
    balanceNegative: string;
    ccaaNoData: string;
    balanceNoData: string;
    foralNote: string;
    balanceCoverageNote: string;
    balanceFormulaNote: string;
  };
}

export function CcaaTaxTab({
  data,
  chartHeight,
  xDomain,
  ccaaMode,
  selectedTaxType,
  selectedBalanceMetric,
  metricLabel,
  taxNames,
  onCcaaModeChange,
  onTaxTypeChange,
  onBalanceMetricChange,
  copy,
}: CcaaTaxTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="taxrevenue-ccaa-mode"
            className="text-xs text-muted-foreground whitespace-nowrap"
          >
            {copy.ccaaMode}
          </label>
          <select
            id="taxrevenue-ccaa-mode"
            value={ccaaMode}
            onChange={(e) => onCcaaModeChange(e.target.value as CcaaModeKey)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="aeat">{copy.ccaaModeAeat}</option>
            <option value="balance">{copy.ccaaModeBalance}</option>
          </select>
        </div>

        {ccaaMode === "aeat" ? (
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="taxrevenue-type"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              {copy.taxType}
            </label>
            <select
              id="taxrevenue-type"
              value={selectedTaxType}
              onChange={(e) => onTaxTypeChange(e.target.value as TaxTypeKey)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="total">{copy.allTaxes}</option>
              {(["irpf", "iva", "sociedades", "iiee", "irnr"] as TaxTypeKey[]).map((key) => (
                <option key={key} value={key}>
                  {taxNames[key]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="taxrevenue-balance-metric"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              {copy.balanceMetric}
            </label>
            <select
              id="taxrevenue-balance-metric"
              value={selectedBalanceMetric}
              onChange={(e) => onBalanceMetricChange(e.target.value as BalanceMetricKey)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="netBalance">{copy.balanceNet}</option>
              <option value="cededTaxes">{copy.balanceCeded}</option>
              <option value="transfers">{copy.balanceTransfers}</option>
            </select>
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {ccaaMode === "aeat" ? copy.ccaaNoData : copy.balanceNoData}
        </p>
      ) : (
        <>
          {/* Legend */}
          {ccaaMode === "balance" && selectedBalanceMetric === "netBalance" ? (
            <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: COLOR_BALANCE_POSITIVE }}
                />
                {copy.balancePositive}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: COLOR_BALANCE_NEGATIVE }}
                />
                {copy.balanceNegative}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: COLOR_TOP }}
                />
                {copy.top3}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: COLOR_OTHER }}
                />
                {copy.restRegions}
              </span>
            </div>
          )}

          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <XAxis
                type="number"
                domain={xDomain}
                tickFormatter={(v: number) => formatNumber(v, 0)}
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
              <Tooltip content={<CcaaTooltip metricLabel={metricLabel} />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={entry.code}
                    fill={
                      ccaaMode === "balance" && selectedBalanceMetric === "netBalance"
                        ? entry.value < 0
                          ? COLOR_BALANCE_NEGATIVE
                          : COLOR_BALANCE_POSITIVE
                        : entry.isTop3
                          ? COLOR_TOP
                          : COLOR_OTHER
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <p className="text-xs text-muted-foreground/80 text-center">
            {ccaaMode === "aeat" ? copy.foralNote : copy.balanceCoverageNote}
          </p>
          {ccaaMode === "balance" && (
            <p className="text-xs text-muted-foreground/70 text-center">
              {copy.balanceFormulaNote}
            </p>
          )}
        </>
      )}
    </div>
  );
}
