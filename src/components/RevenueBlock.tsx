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
import { formatCompact, formatNumber, formatPercent } from "@/utils/formatters";
import { StatCard } from "./StatCard";

const BREAKDOWN_COLORS = {
  taxesDirect: "hsl(215, 65%, 45%)",
  taxesIndirect: "hsl(30, 75%, 50%)",
  socialContributions: "hsl(155, 55%, 40%)",
  otherRevenue: "hsl(265, 50%, 55%)",
};

const BREAKDOWN_LABELS: Record<string, string> = {
  taxesDirect: "Impuestos directos (IRPF, IS)",
  taxesIndirect: "Impuestos indirectos (IVA, IIEE)",
  socialContributions: "Cotizaciones sociales",
  otherRevenue: "Otros ingresos",
};

interface BreakdownDatum {
  name: string;
  key: string;
  amount: number;
  percentage: number;
}

export function RevenueBlock() {
  const { revenue, demographics } = useData();

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
        name: BREAKDOWN_LABELS.taxesDirect,
        key: "taxesDirect",
        amount: yearData.taxesDirect,
        percentage: (yearData.taxesDirect / total) * 100,
      },
      {
        name: BREAKDOWN_LABELS.socialContributions,
        key: "socialContributions",
        amount: yearData.socialContributions,
        percentage: (yearData.socialContributions / total) * 100,
      },
      {
        name: BREAKDOWN_LABELS.taxesIndirect,
        key: "taxesIndirect",
        amount: yearData.taxesIndirect,
        percentage: (yearData.taxesIndirect / total) * 100,
      },
      {
        name: BREAKDOWN_LABELS.otherRevenue,
        key: "otherRevenue",
        amount: yearData.otherRevenue,
        percentage: (yearData.otherRevenue / total) * 100,
      },
    ];

    return items.sort((a, b) => b.amount - a.amount);
  }, [yearData]);

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

  const BreakdownTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: BreakdownDatum }>;
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
        <p className="font-semibold text-foreground">{d.name}</p>
        <p className="text-muted-foreground">
          {formatNumber(d.amount, 0)} M€ ({formatNumber(d.percentage, 1)}%)
        </p>
      </div>
    );
  };

  const HistoricalTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ dataKey: string; value: number; color: string }>;
    label?: number;
  }) => {
    if (!active || !payload?.length || !label) return null;
    const ingresos = payload.find((p) => p.dataKey === "ingresos")?.value ?? 0;
    const gastos = payload.find((p) => p.dataKey === "gastos")?.value ?? 0;
    const balance = ingresos - gastos;
    return (
      <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-emerald-600">Ingresos: {formatNumber(ingresos, 0)} M€</p>
        <p className="text-rose-500">Gastos: {formatNumber(gastos, 0)} M€</p>
        <p className={balance >= 0 ? "text-emerald-600 font-medium" : "text-rose-500 font-medium"}>
          {balance >= 0 ? "Superávit" : "Déficit"}: {formatNumber(balance, 0)} M€
        </p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>Ingresos vs Gastos Públicos</CardTitle>
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="revenue-year"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              Año
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
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Ingresos totales"
            value={formatCompact(totalRevenueEuros)}
            delay={0.05}
            sources={[revenueSource]}
          />
          <StatCard
            label="Gastos totales"
            value={formatCompact(totalExpenditureEuros)}
            delay={0.1}
            sources={[revenueSource]}
          />
          <StatCard
            label={balanceEuros >= 0 ? "Superávit" : "Déficit"}
            value={formatCompact(balanceEuros)}
            delay={0.15}
            className={balanceEuros >= 0 ? "border-emerald-500/30" : "border-rose-500/30"}
            sources={[revenueSource]}
          />
          <StatCard
            label="Presión fiscal"
            value={formatPercent(presionFiscal)}
            delay={0.2}
            sources={[
              { ...CALCULO_DERIVADO, note: "Ingresos totales / PIB nominal" },
              revenueSource,
            ]}
          />
        </div>

        {/* Revenue breakdown bar chart */}
        {breakdownData.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
              Composición de los ingresos ({selectedYear})
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
                <Tooltip content={<BreakdownTooltip />} />
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
              Evolución histórica ingresos vs gastos
            </h3>
            <div className="flex items-center justify-center gap-5 mb-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />
                Ingresos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-rose-500" />
                Gastos
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
                <Tooltip content={<HistoricalTooltip />} />
                <Area
                  type="monotone"
                  dataKey="ingresos"
                  stroke="hsl(155, 55%, 40%)"
                  fill="hsl(155, 55%, 40%)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="gastos"
                  stroke="hsl(0, 65%, 50%)"
                  fill="hsl(0, 65%, 50%)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/70 text-center">
          Total Administraciones Públicas (S.13) — Millones de euros —{" "}
          <a
            href={EUROSTAT_GOV_MAIN.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Eurostat gov_10a_main
          </a>{" "}
          — Año {selectedYear}
        </p>
      </CardContent>
    </Card>
  );
}
