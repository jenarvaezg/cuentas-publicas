import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CALCULO_DERIVADO, EUROSTAT_GOV_MAIN, fromAttribution } from "@/data/sources";
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
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const millions = millionSuffix ?? "M€";
  return (
    <div className="bg-popover/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">
        {formatNumber(d.amount, 0)} {millions} ({formatNumber(d.percentage, 1)}
        %)
      </p>
    </div>
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

const BREAKDOWN_COLORS = {
  taxesDirect: "hsl(215, 65%, 45%)",
  taxesIndirect: "hsl(30, 75%, 50%)",
  socialContributions: "hsl(155, 55%, 40%)",
  otherRevenue: "hsl(265, 50%, 55%)",
};

export function RevenueBlock() {
  const { revenue, demographics } = useData();
  const { msg, lang } = useI18n();

  const copy =
    lang === "en"
      ? {
          taxesDirect: "Direct taxes (PIT, CIT)",
          taxesIndirect: "Indirect taxes (VAT, excise)",
          socialContributions: "Social contributions",
          otherRevenue: "Other revenue",
          totalRevenue: "Total revenue",
          totalRevenueTooltip:
            "All the money the government collects in a year: taxes, social contributions, fees, and any other income.",
          totalExpenditure: "Total expenditure",
          totalExpenditureTooltip:
            "Everything the government spends in a year across all public services, benefits, salaries, and debt interest.",
          surplus: "Surplus",
          surplusTooltip:
            "The government collected more than it spent this year — the leftover is called a surplus.",
          deficit: "Deficit",
          deficitTooltip:
            "The government spent more than it collected this year — the shortfall is called a deficit and adds to the debt.",
          taxBurden: "Tax burden",
          taxBurdenTooltip:
            "What percentage of the country's total wealth (GDP) is taken by the government through taxes and contributions.",
          compositionTitle: "Revenue composition",
          historicalTitle: "Historical revenue vs expenditure",
          revenueLegend: "Revenue",
          spendingLegend: "Spending",
          adminScope: "General government (S.13)",
          millionEuros: "Million euros",
          yearLabel: "Year",
          derivativeNote: "Total revenue / nominal GDP",
        }
      : {
          taxesDirect: "Impuestos directos (IRPF, IS)",
          taxesIndirect: "Impuestos indirectos (IVA, IIEE)",
          socialContributions: "Cotizaciones sociales",
          otherRevenue: "Otros ingresos",
          totalRevenue: "Ingresos totales",
          totalRevenueTooltip:
            "Todo el dinero que recauda el Estado en un año: impuestos, cotizaciones sociales, tasas y otros ingresos.",
          totalExpenditure: "Gastos totales",
          totalExpenditureTooltip:
            "Todo lo que gasta el Estado en un año: servicios públicos, prestaciones, sueldos de funcionarios e intereses de la deuda.",
          surplus: "Superávit",
          surplusTooltip:
            "Este año el Estado ha ingresado más de lo que ha gastado. El sobrante se llama superávit.",
          deficit: "Déficit",
          deficitTooltip:
            "Este año el Estado ha gastado más de lo que ha ingresado. La diferencia se llama déficit y se suma a la deuda.",
          taxBurden: "Presión fiscal",
          taxBurdenTooltip:
            "Qué porcentaje de la riqueza total del país (PIB) acaba en manos del Estado en forma de impuestos y cotizaciones.",
          compositionTitle: "Composición de los ingresos",
          historicalTitle: "Evolución histórica ingresos vs gastos",
          revenueLegend: "Ingresos",
          spendingLegend: "Gastos",
          adminScope: "Total Administraciones Públicas (S.13)",
          millionEuros: "Millones de euros",
          yearLabel: "Año",
          derivativeNote: "Ingresos totales / PIB nominal",
        };

  const breakdownLabels: Record<string, string> = {
    taxesDirect: copy.taxesDirect,
    taxesIndirect: copy.taxesIndirect,
    socialContributions: copy.socialContributions,
    otherRevenue: copy.otherRevenue,
  };

  const years = revenue.years;
  const latestYear = revenue.latestYear;

  const [selectedYear, setSelectedYear] = useState(latestYear);

  const yearData = revenue.byYear[String(selectedYear)];

  const revenueSource = revenue.sourceAttribution?.revenue
    ? fromAttribution(revenue.sourceAttribution.revenue)
    : EUROSTAT_GOV_MAIN;

  // Breakdown bar chart data
  const breakdownData = useMemo<BreakdownDatum[]>(() => {
    if (!yearData) return [];
    const total = yearData.totalRevenue;
    if (!total) return [];

    const items: BreakdownDatum[] = [
      {
        name: breakdownLabels.taxesDirect,
        key: "taxesDirect",
        amount: yearData.taxesDirect,
        percentage: (yearData.taxesDirect / total) * 100,
      },
      {
        name: breakdownLabels.socialContributions,
        key: "socialContributions",
        amount: yearData.socialContributions,
        percentage: (yearData.socialContributions / total) * 100,
      },
      {
        name: breakdownLabels.taxesIndirect,
        key: "taxesIndirect",
        amount: yearData.taxesIndirect,
        percentage: (yearData.taxesIndirect / total) * 100,
      },
      {
        name: breakdownLabels.otherRevenue,
        key: "otherRevenue",
        amount: yearData.otherRevenue,
        percentage: (yearData.otherRevenue / total) * 100,
      },
    ];

    return items.sort((a, b) => b.amount - a.amount);
  }, [
    breakdownLabels.otherRevenue,
    breakdownLabels.socialContributions,
    breakdownLabels.taxesDirect,
    breakdownLabels.taxesIndirect,
    yearData,
  ]);

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

        {/* Revenue breakdown bar chart */}
        {breakdownData.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
              {copy.compositionTitle} ({selectedYear})
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={breakdownData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => formatNumber(v, 0)}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={220}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip content={<BreakdownTooltip millionSuffix="M€" />} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {breakdownData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={BREAKDOWN_COLORS[entry.key as keyof typeof BREAKDOWN_COLORS]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

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
