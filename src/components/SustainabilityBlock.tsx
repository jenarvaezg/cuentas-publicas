import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionExpander } from "@/components/ui/SectionExpander";
import {
  AGEING_REPORT,
  CALCULO_DERIVADO,
  EUROSTAT_GOV_MAIN,
  resolveSource,
  SS_FONDO_RESERVA,
} from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber, formatPercent } from "@/utils/formatters";
import { ExportBlockButton } from "./ExportBlockButton";
import { StatCard } from "./StatCard";

export function SustainabilityBlock() {
  const { ssSustainability } = useData();
  const { msg } = useI18n();

  const copy = msg.blocks.sustainability;

  const data = ssSustainability;
  const latestYear = String(data.latestYear);
  const latestData = data.byYear[latestYear];

  // StatCard data
  const balanceSparkline = data.years.map((y) => data.byYear[String(y)]?.ssBalance ?? 0);
  const reserveFundLatest = data.reserveFund[data.reserveFund.length - 1];
  const reserveSparkline = data.reserveFund.map((r) => r.balance);
  const contributorsLatest =
    data.contributorsPerPensioner[data.contributorsPerPensioner.length - 1];
  const pensionGDPSparkline = data.pensionToGDP.spain.years.map(
    (year) => data.pensionToGDP.spain.byYear[String(year)] ?? 0,
  );
  const projectedPensionGDPSparkline = data.projections.spain.map((point) => point.pensionToGDP);

  const spainProjection2050 = data.projections.spain.find((p) => p.year === 2050);

  // Cumulative balance (running total for sparkline + final value)
  const cumulativeByYear: number[] = [];
  data.years.reduce((sum, y) => {
    const next = sum + (data.byYear[String(y)]?.ssBalance ?? 0);
    cumulativeByYear.push(next);
    return next;
  }, 0);
  const cumulativeBalance = cumulativeByYear[cumulativeByYear.length - 1] ?? 0;

  // Source attribution
  const eurostatSource = resolveSource(data.sourceAttribution?.ssSustainability, EUROSTAT_GOV_MAIN);

  // ─── Chart 1: Revenue vs Expenditure ───
  const revenueVsExpData = data.years.map((year) => {
    const yd = data.byYear[String(year)];
    return {
      year,
      contributions: yd?.socialContributions ?? 0,
      expenditure: yd?.pensionExpenditure ?? 0,
    };
  });

  // ─── Chart 2: Reserve Fund ───
  const reserveFundData = data.reserveFund.map((r) => ({
    year: r.year,
    balance: r.balance,
  }));

  // ─── Chart 3: Pension/GDP with projections ───
  const gdpChartData = buildGDPChartData(data, copy);

  // ─── Chart 4: Contributors per pensioner ───
  const contributorsData = data.contributorsPerPensioner.map((c) => ({
    year: c.year,
    ratio: c.ratio,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{msg.blocks.sustainability.title}</CardTitle>
          <ExportBlockButton
            targetId="sostenibilidad-ss"
            filenamePrefix="cuentas-publicas-sostenibilidad-ss"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {copy.executiveSnapshot} · {data.latestYear}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <StatCard
              label={copy.ssBalance}
              value={formatCompact(latestData?.ssBalance ?? 0)}
              tooltip={copy.ssBalanceTooltip}
              delay={0.05}
              className="lg:col-span-2"
              sparklineData={balanceSparkline}
              trend={{
                value: latestData?.ssBalance ?? 0,
                label: `${data.latestYear}`,
              }}
              sources={[eurostatSource]}
            />
            <div className="grid grid-cols-1 gap-4">
              <StatCard
                label={copy.pensionGDP}
                value={formatPercent(latestData?.pensionToGDP ?? 0)}
                tooltip={copy.pensionGDPTooltip}
                delay={0.1}
                sparklineData={pensionGDPSparkline}
                sources={[
                  eurostatSource,
                  {
                    name: `${copy.vsEU}: ${formatPercent(data.pensionToGDP.eu27.byYear[latestYear] ?? 0)}`,
                  },
                ]}
              />
              <StatCard
                label={copy.contributorsRatio}
                value={formatNumber(contributorsLatest?.ratio ?? 0, 2)}
                tooltip={copy.contributorsRatioTooltip}
                delay={0.15}
                sparklineData={data.contributorsPerPensioner.map((c) => c.ratio)}
                sources={[{ ...CALCULO_DERIVADO, note: "SS monthly reports" }]}
              />
            </div>
          </div>
        </div>

        {/* Chart 1: SS Revenue vs Expenditure */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{copy.chartRevenueVsExp}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueVsExpData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v)} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                label={{
                  value: copy.mEur,
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11 },
                }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${formatNumber(value, 0)} ${copy.mEur}`,
                  name === "contributions" ? copy.contributions : copy.pensionSpending,
                ]}
                labelFormatter={(label) => String(label)}
              />
              <Legend
                formatter={(value) =>
                  value === "contributions" ? copy.contributions : copy.pensionSpending
                }
              />
              <Area
                type="monotone"
                dataKey="contributions"
                stroke="hsl(var(--chart-4))"
                fill="hsl(var(--chart-4))"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="expenditure"
                stroke="hsl(var(--chart-2))"
                fill="hsl(var(--chart-2))"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <SectionExpander id="sustainability-detail" count={3}>
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {copy.complementaryIndicators}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label={copy.reserveFund}
                  value={formatCompact((reserveFundLatest?.balance ?? 0) * 1e6)}
                  tooltip={copy.reserveFundTooltip}
                  delay={0.2}
                  sparklineData={reserveSparkline}
                  sources={[SS_FONDO_RESERVA]}
                />
                <StatCard
                  label={copy.projectedGDP2050}
                  value={formatPercent(spainProjection2050?.pensionToGDP ?? 0)}
                  tooltip={copy.projectedGDP2050Tooltip}
                  delay={0.25}
                  sparklineData={projectedPensionGDPSparkline}
                  sources={[AGEING_REPORT]}
                />
                <StatCard
                  label={copy.cumulativeGap}
                  value={formatCompact(Math.abs(cumulativeBalance) * 1e6)}
                  tooltip={copy.cumulativeGapTooltip}
                  delay={0.3}
                  sparklineData={cumulativeByYear.map((v) => -v)}
                  trend={{
                    value: Math.abs(cumulativeBalance),
                    label: `${data.latestYear}`,
                  }}
                  sources={[eurostatSource]}
                />
              </div>
            </div>

            {/* Chart 2: Reserve Fund Evolution */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {copy.chartReserveFund}
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={reserveFundData}
                  margin={{ top: 5, right: 20, bottom: 5, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v)} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    label={{
                      value: copy.mEur,
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11 },
                    }}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `${formatNumber(value, 0)} ${copy.mEur}`,
                      copy.reserveFund,
                    ]}
                    labelFormatter={(label) => String(label)}
                  />
                  <ReferenceLine
                    y={66815}
                    stroke="hsl(var(--chart-3))"
                    strokeDasharray="4 4"
                    label={{
                      value: `${copy.peak}: 66.815 M\u20AC (2011)`,
                      position: "top",
                      style: { fontSize: 10, fill: "hsl(var(--chart-3))" },
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 3: Pension/GDP Spain vs EU + Projections */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {copy.chartPensionGDP}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={gdpChartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v)} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => `${v}%`}
                    label={{
                      value: "% PIB",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11 },
                    }}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: string) => {
                      if (value === null || value === undefined) return ["-", name];
                      return [`${Number(value).toFixed(1)}%`, name];
                    }}
                    labelFormatter={(label) => String(label)}
                  />
                  <Legend />
                  {/* Historical solid lines */}
                  <Line
                    type="monotone"
                    dataKey="spainHistorical"
                    name={copy.spain}
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="eu27Historical"
                    name={copy.eu27}
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  {/* Projection dotted lines */}
                  <Line
                    type="monotone"
                    dataKey="spainProjection"
                    name={copy.spainProjection}
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="eu27Projection"
                    name={copy.eu27Projection}
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground text-center">
                {copy.sourceAgeing}: {data.projections.source}
              </p>
            </div>

            {/* Chart 4: Contributors per Pensioner */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {copy.chartContributors}
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={contributorsData}
                  margin={{ top: 5, right: 20, bottom: 5, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v)} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    domain={[1.8, "auto"]}
                    tickFormatter={(v) => v.toFixed(1)}
                  />
                  <Tooltip
                    formatter={(value: number) => [value.toFixed(2), copy.contributorsRatio]}
                    labelFormatter={(label) => String(label)}
                  />
                  <ReferenceLine
                    y={2.0}
                    stroke="hsl(var(--chart-2))"
                    strokeDasharray="4 4"
                    label={{
                      value: copy.stressZone,
                      position: "right",
                      style: { fontSize: 10, fill: "hsl(var(--chart-2))" },
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ratio"
                    stroke="hsl(var(--chart-5))"
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SectionExpander>
      </CardContent>
    </Card>
  );
}

/**
 * Build combined chart data merging historical pension/GDP with Ageing Report projections
 */
function buildGDPChartData(
  data: ReturnType<typeof useData>["ssSustainability"],
  _copy: Record<string, string>,
) {
  type GDPPoint = {
    year: number;
    spainHistorical?: number | null;
    eu27Historical?: number | null;
    spainProjection?: number | null;
    eu27Projection?: number | null;
  };

  const pointsByYear = new Map<number, GDPPoint>();

  const ensurePoint = (year: number): GDPPoint => {
    if (!pointsByYear.has(year)) {
      pointsByYear.set(year, { year });
    }
    return pointsByYear.get(year) as GDPPoint;
  };

  // Historical Spain
  for (const year of data.pensionToGDP.spain.years) {
    const p = ensurePoint(year);
    p.spainHistorical = data.pensionToGDP.spain.byYear[String(year)] ?? null;
  }

  // Historical EU27
  for (const year of data.pensionToGDP.eu27.years) {
    const p = ensurePoint(year);
    p.eu27Historical = data.pensionToGDP.eu27.byYear[String(year)] ?? null;
  }

  // Compute offset: Ageing Report uses a different scope than Eurostat, so projections
  // need rebasing to match the historical level at the overlapping base year.
  const projBaseSpain = data.projections.spain[0];
  const projBaseEU = data.projections.eu27[0];

  const spainOffset = projBaseSpain
    ? (data.pensionToGDP.spain.byYear[String(projBaseSpain.year)] ?? projBaseSpain.pensionToGDP) -
      projBaseSpain.pensionToGDP
    : 0;

  const eu27Offset = projBaseEU
    ? (data.pensionToGDP.eu27.byYear[String(projBaseEU.year)] ?? projBaseEU.pensionToGDP) -
      projBaseEU.pensionToGDP
    : 0;

  // Last historical year — projections only shown after this point
  const lastSpainYear = Math.max(...data.pensionToGDP.spain.years);
  const lastEU27Year = Math.max(...data.pensionToGDP.eu27.years);

  // Projections Spain (rebased, starting from last historical year)
  for (const proj of data.projections.spain) {
    if (proj.year < lastSpainYear) continue;
    const p = ensurePoint(proj.year);
    const rebased = Math.round((proj.pensionToGDP + spainOffset) * 10) / 10;
    p.spainProjection = rebased;
    // Bridge: duplicate historical value at transition year so lines connect
    if (proj.year === lastSpainYear) {
      p.spainHistorical =
        p.spainHistorical ?? data.pensionToGDP.spain.byYear[String(proj.year)] ?? rebased;
    }
  }

  // Projections EU27 (rebased, starting from last historical year)
  for (const proj of data.projections.eu27) {
    if (proj.year < lastEU27Year) continue;
    const p = ensurePoint(proj.year);
    const rebased = Math.round((proj.pensionToGDP + eu27Offset) * 10) / 10;
    p.eu27Projection = rebased;
    if (proj.year === lastEU27Year) {
      p.eu27Historical =
        p.eu27Historical ?? data.pensionToGDP.eu27.byYear[String(proj.year)] ?? rebased;
    }
  }

  // Bridge point: ensure projections connect to last historical value
  const lastSpainValue = data.pensionToGDP.spain.byYear[String(lastSpainYear)];
  if (lastSpainValue != null) {
    const p = ensurePoint(lastSpainYear);
    p.spainProjection = p.spainProjection ?? lastSpainValue;
  }
  const lastEU27Value = data.pensionToGDP.eu27.byYear[String(lastEU27Year)];
  if (lastEU27Value != null) {
    const p = ensurePoint(lastEU27Year);
    p.eu27Projection = p.eu27Projection ?? lastEU27Value;
  }

  return [...pointsByYear.values()].sort((a, b) => a.year - b.year);
}
