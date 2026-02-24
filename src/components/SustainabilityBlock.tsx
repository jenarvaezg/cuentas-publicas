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
import {
  AGEING_REPORT,
  CALCULO_DERIVADO,
  EUROSTAT_GOV_MAIN,
  fromAttribution,
  SS_FONDO_RESERVA,
} from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber, formatPercent } from "@/utils/formatters";
import { ExportBlockButton } from "./ExportBlockButton";
import { StatCard } from "./StatCard";

export function SustainabilityBlock() {
  const { ssSustainability } = useData();
  const { msg, lang } = useI18n();

  const copy =
    lang === "en"
      ? {
          ssBalance: "SS System Balance",
          ssBalanceTooltip:
            "Difference between social contributions and contributory cash benefits. Negative values indicate a structural contributory deficit.",
          pensionGDP: "Contributory Spending / GDP",
          pensionGDPTooltip:
            "Share of GDP devoted to contributory social benefits. Higher values imply stronger pressure on payroll-funded spending.",
          reserveFund: "Reserve Fund",
          reserveFundTooltip:
            "The SS reserve fund peaked at \u20AC66.8B in 2011, was nearly depleted by 2019, and is now being rebuilt.",
          contributorsRatio: "Contributors per Pensioner",
          contributorsRatioTooltip:
            "Active contributors per pension in payment. Below 2.0 is considered a stress zone for pay-as-you-go systems.",
          projectedGDP2050: "Projected Pension/GDP 2050",
          projectedGDP2050Tooltip:
            "European Commission Ageing Report 2024 baseline projection for Spain in 2050.",
          cumulativeGap: "Cumulative Balance Gap",
          cumulativeGapTooltip:
            "Sum of annual system balances since the first year of available data. Shows accumulated surplus/deficit over time.",
          chartRevenueVsExp: "Social Contributions vs Contributory Spending",
          chartReserveFund: "Reserve Fund Evolution",
          chartPensionGDP: "Contributory Spending % GDP — Spain vs EU + Projections",
          chartContributors: "Contributors per Pensioner",
          contributions: "Contributions",
          pensionSpending: "Contributory spending",
          balance: "Balance",
          spain: "Spain",
          eu27: "EU-27",
          spainProjection: "Spain (projection)",
          eu27Projection: "EU-27 (projection)",
          mEur: "M\u20AC",
          stressZone: "Stress zone",
          peak: "Peak",
          sourceAgeing: "Ageing Report 2024",
          vsEU: "vs EU",
        }
      : {
          ssBalance: "Balance del sistema SS",
          ssBalanceTooltip:
            "Diferencia entre cotizaciones sociales y prestaciones contributivas en efectivo. Un valor negativo indica deficit estructural.",
          pensionGDP: "Gasto contributivo / PIB",
          pensionGDPTooltip:
            "Porcentaje del PIB destinado a prestaciones contributivas. Valores altos reflejan mayor presion sobre un sistema financiado por cotizaciones.",
          reserveFund: "Fondo de Reserva",
          reserveFundTooltip:
            "El fondo de reserva de la SS alcanzo 66.815 M\u20AC en 2011, se agoto casi por completo en 2019 y ahora se esta reponiendo.",
          contributorsRatio: "Cotizantes por pensionista",
          contributorsRatioTooltip:
            "Trabajadores en activo por pension en vigor. Por debajo de 2,0 se considera zona de estres para sistemas de reparto.",
          projectedGDP2050: "Proyeccion pensiones/PIB 2050",
          projectedGDP2050Tooltip:
            "Proyeccion base del Ageing Report 2024 de la Comision Europea para España en 2050.",
          cumulativeGap: "Brecha acumulada del sistema",
          cumulativeGapTooltip:
            "Suma de balances anuales del sistema desde el primer año de datos. Muestra el superavit/deficit acumulado.",
          chartRevenueVsExp: "Cotizaciones sociales vs gasto contributivo",
          chartReserveFund: "Evolucion del Fondo de Reserva",
          chartPensionGDP: "Gasto contributivo % PIB — España vs UE + Proyecciones",
          chartContributors: "Cotizantes por pensionista",
          contributions: "Cotizaciones",
          pensionSpending: "Gasto contributivo",
          balance: "Balance",
          spain: "España",
          eu27: "UE-27",
          spainProjection: "España (proyeccion)",
          eu27Projection: "UE-27 (proyeccion)",
          mEur: "M\u20AC",
          stressZone: "Zona de estres",
          peak: "Maximo",
          sourceAgeing: "Ageing Report 2024",
          vsEU: "vs UE",
        };

  const data = ssSustainability;
  const latestYear = String(data.latestYear);
  const latestData = data.byYear[latestYear];

  // StatCard data
  const balanceSparkline = data.years.map((y) => data.byYear[String(y)]?.ssBalance ?? 0);
  const reserveFundLatest = data.reserveFund[data.reserveFund.length - 1];
  const reserveSparkline = data.reserveFund.map((r) => r.balance);
  const contributorsLatest =
    data.contributorsPerPensioner[data.contributorsPerPensioner.length - 1];

  const spainProjection2050 = data.projections.spain.find((p) => p.year === 2050);

  // Cumulative balance
  const cumulativeBalance = data.years.reduce(
    (sum, y) => sum + (data.byYear[String(y)]?.ssBalance ?? 0),
    0,
  );

  // Source attribution
  const eurostatSource = data.sourceAttribution?.ssSustainability
    ? fromAttribution(data.sourceAttribution.ssSustainability)
    : EUROSTAT_GOV_MAIN;

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
        {/* Row 1: 3 StatCards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label={copy.ssBalance}
            value={formatCompact(latestData?.ssBalance ?? 0)}
            tooltip={copy.ssBalanceTooltip}
            delay={0.05}
            sparklineData={balanceSparkline}
            trend={{
              value: latestData?.ssBalance ?? 0,
              label: `${data.latestYear}`,
            }}
            sources={[eurostatSource]}
          />
          <StatCard
            label={copy.pensionGDP}
            value={formatPercent(latestData?.pensionToGDP ?? 0)}
            tooltip={copy.pensionGDPTooltip}
            delay={0.1}
            sources={[
              eurostatSource,
              {
                name: `${copy.vsEU}: ${formatPercent(data.pensionToGDP.eu27.byYear[latestYear] ?? 0)}`,
              },
            ]}
          />
          <StatCard
            label={copy.reserveFund}
            value={formatCompact((reserveFundLatest?.balance ?? 0) * 1e6)}
            tooltip={copy.reserveFundTooltip}
            delay={0.15}
            sparklineData={reserveSparkline}
            sources={[SS_FONDO_RESERVA]}
          />
        </div>

        {/* Row 2: 3 StatCards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label={copy.contributorsRatio}
            value={formatNumber(contributorsLatest?.ratio ?? 0, 2)}
            tooltip={copy.contributorsRatioTooltip}
            delay={0.2}
            sparklineData={data.contributorsPerPensioner.map((c) => c.ratio)}
            sources={[{ ...CALCULO_DERIVADO, note: "SS monthly reports" }]}
          />
          <StatCard
            label={copy.projectedGDP2050}
            value={formatPercent(spainProjection2050?.pensionToGDP ?? 0)}
            tooltip={copy.projectedGDP2050Tooltip}
            delay={0.25}
            sources={[AGEING_REPORT]}
          />
          <StatCard
            label={copy.cumulativeGap}
            value={formatCompact(cumulativeBalance * 1e6)}
            tooltip={copy.cumulativeGapTooltip}
            delay={0.3}
            sources={[eurostatSource]}
          />
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
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="expenditure"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Reserve Fund Evolution */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{copy.chartReserveFund}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={reserveFundData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
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
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{
                  value: `${copy.peak}: 66.815 M\u20AC (2011)`,
                  position: "top",
                  style: { fontSize: 10, fill: "#f59e0b" },
                }}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Pension/GDP Spain vs EU + Projections */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{copy.chartPensionGDP}</h3>
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
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="eu27Historical"
                name={copy.eu27}
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              {/* Projection dotted lines */}
              <Line
                type="monotone"
                dataKey="spainProjection"
                name={copy.spainProjection}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="eu27Projection"
                name={copy.eu27Projection}
                stroke="#3b82f6"
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
          <h3 className="text-sm font-semibold text-muted-foreground">{copy.chartContributors}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={contributorsData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
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
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{
                  value: copy.stressZone,
                  position: "right",
                  style: { fontSize: 10, fill: "#ef4444" },
                }}
              />
              <Line
                type="monotone"
                dataKey="ratio"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
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

  // Connect historical to projections: add the first projection year as historical too
  const lastHistoricalYear = Math.max(
    ...data.pensionToGDP.spain.years,
    ...data.pensionToGDP.eu27.years,
  );

  // Projections Spain
  for (const proj of data.projections.spain) {
    const p = ensurePoint(proj.year);
    p.spainProjection = proj.pensionToGDP;
    // Connect: if this is the earliest projection year and within historical range
    if (proj.year <= lastHistoricalYear) {
      p.spainHistorical = p.spainHistorical ?? data.pensionToGDP.spain.byYear[String(proj.year)];
    }
  }

  // Projections EU27
  for (const proj of data.projections.eu27) {
    const p = ensurePoint(proj.year);
    p.eu27Projection = proj.pensionToGDP;
    if (proj.year <= lastHistoricalYear) {
      p.eu27Historical = p.eu27Historical ?? data.pensionToGDP.eu27.byYear[String(proj.year)];
    }
  }

  return [...pointsByYear.values()].sort((a, b) => a.year - b.year);
}
