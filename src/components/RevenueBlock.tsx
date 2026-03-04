import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/ChartTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CALCULO_DERIVADO, EUROSTAT_GOV_MAIN, resolveSource } from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber, formatPercent } from "@/utils/formatters";
import { ExportBlockButton } from "./ExportBlockButton";
import { StatCard } from "./StatCard";

export interface BreakdownDatum {
  name: string;
  key: string;
  amount: number;
  percentage: number;
}

export const BreakdownTooltip = ({
  active,
  payload,
  millionSuffix,
}: {
  active?: boolean;
  payload?: Array<{ payload: BreakdownDatum }>;
  millionSuffix?: string;
}) => {
  const millions = millionSuffix ?? "M€";
  return (
    <ChartTooltip active={active} payload={payload}>
      {(pl) => {
        const d = pl[0].payload;
        return (
          <>
            <p className="font-semibold text-foreground">{d.name}</p>
            <p className="text-muted-foreground">
              {formatNumber(d.amount, 0)} {millions} ({formatNumber(d.percentage, 1)}%)
            </p>
          </>
        );
      }}
    </ChartTooltip>
  );
};

export const HistoricalTooltip = ({
  active,
  payload,
  label,
  revenueLabel,
  spendingLabel,
  surplusLabel,
  deficitLabel,
  millionSuffix,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: number;
  revenueLabel?: string;
  spendingLabel?: string;
  surplusLabel?: string;
  deficitLabel?: string;
  millionSuffix?: string;
}) => {
  if (!active || !payload?.length || !label) return null;
  const ingresos = payload.find((p) => p.dataKey === "ingresos")?.value ?? 0;
  const gastos = payload.find((p) => p.dataKey === "gastos")?.value ?? 0;
  const balance = ingresos - gastos;
  const revenueText = revenueLabel ?? "Ingresos";
  const spendingText = spendingLabel ?? "Gastos";
  const surplusText = surplusLabel ?? "Superávit";
  const deficitText = deficitLabel ?? "Déficit";
  const millions = millionSuffix ?? "M€";
  return (
    <div className="bg-popover/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-emerald-600">
        {revenueText}: {formatNumber(ingresos, 0)} {millions}
      </p>
      <p className="text-rose-500">
        {spendingText}: {formatNumber(gastos, 0)} {millions}
      </p>
      <p className={balance >= 0 ? "text-emerald-600 font-medium" : "text-rose-500 font-medium"}>
        {balance >= 0 ? surplusText : deficitText}: {formatNumber(balance, 0)} {millions}
      </p>
    </div>
  );
};

export function RevenueBlock() {
  const { revenue, demographics } = useData();
  const { msg } = useI18n();

  const copy = msg.blocks.revenue;

  const years = revenue.years;
  const latestYear = revenue.latestYear;

  const [selectedYear, setSelectedYear] = useState(latestYear);

  const yearData = revenue.byYear[String(selectedYear)];

  const revenueSource = resolveSource(revenue.sourceAttribution?.revenue, EUROSTAT_GOV_MAIN);

  // Historical area chart data
  const historicalData = useMemo(() => {
    return years.map((year) => {
      const d = revenue.byYear[String(year)];
      return {
        year,
        ingresos: d?.totalRevenue ?? 0,
        gastos: d?.totalExpenditure ?? 0,
        balance: d?.balance ?? 0,
      };
    });
  }, [years, revenue.byYear]);

  // Derived stats
  const totalRevenueEuros = yearData ? yearData.totalRevenue * 1_000_000 : 0;
  const totalExpenditureEuros = yearData ? yearData.totalExpenditure * 1_000_000 : 0;
  const balanceEuros = yearData ? yearData.balance * 1_000_000 : 0;

  const presionFiscal = useMemo(() => {
    if (!demographics.gdp || !totalRevenueEuros) return 0;
    return (totalRevenueEuros / demographics.gdp) * 100;
  }, [totalRevenueEuros, demographics.gdp]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>{msg.blocks.revenue.title}</CardTitle>
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="revenue-year"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              {msg.common.year}
            </label>
            <select
              id="revenue-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {[...years].reverse().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <ExportBlockButton
            targetId="ingresos-gastos"
            filenamePrefix="cuentas-publicas-ingresos-gastos"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={copy.totalRevenue}
            value={formatCompact(totalRevenueEuros)}
            tooltip={copy.totalRevenueTooltip}
            delay={0.05}
            sources={[revenueSource]}
          />
          <StatCard
            label={copy.totalExpenditure}
            value={formatCompact(totalExpenditureEuros)}
            tooltip={copy.totalExpenditureTooltip}
            delay={0.1}
            sources={[revenueSource]}
          />
          <StatCard
            label={balanceEuros >= 0 ? copy.surplus : copy.deficit}
            value={formatCompact(balanceEuros)}
            tooltip={balanceEuros >= 0 ? copy.surplusTooltip : copy.deficitTooltip}
            delay={0.15}
            className={balanceEuros >= 0 ? "border-emerald-500/30" : "border-rose-500/30"}
            sources={[revenueSource]}
          />
          <StatCard
            label={copy.taxBurden}
            value={formatPercent(presionFiscal)}
            tooltip={copy.taxBurdenTooltip}
            delay={0.2}
            sources={[{ ...CALCULO_DERIVADO, note: copy.derivativeNote }, revenueSource]}
          />
        </div>

        {/* Historical area chart */}
        {historicalData.length > 1 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
              {copy.historicalTitle}
            </h3>
            <div className="flex items-center justify-center gap-5 mb-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />
                {copy.revenueLegend}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-rose-500" />
                {copy.spendingLegend}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={historicalData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tickFormatter={(v: number) => `${formatNumber(v / 1000, 0)}k`}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  content={
                    <HistoricalTooltip
                      revenueLabel={copy.revenueLegend}
                      spendingLabel={copy.spendingLegend}
                      surplusLabel={copy.surplus}
                      deficitLabel={copy.deficit}
                      millionSuffix="M€"
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="ingresos"
                  stroke="hsl(var(--chart-4))"
                  fill="hsl(var(--chart-4))"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="gastos"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-xs text-muted-foreground/80 text-center">
          {copy.adminScope} — {copy.millionEuros} —{" "}
          <a
            href={EUROSTAT_GOV_MAIN.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Eurostat gov_10a_main
          </a>{" "}
          — {copy.yearLabel} {selectedYear}
        </p>
      </CardContent>
    </Card>
  );
}
