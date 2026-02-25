import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  fromAttribution,
  INE_IDB,
  INE_LIFE_EXPECTANCY,
  INE_POBLACION,
  INE_PYRAMID,
} from "@/data/sources";
import type { TimeSeriesPoint } from "@/data/types";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber, formatPercent } from "@/utils/formatters";
import { ExportBlockButton } from "./ExportBlockButton";
import { PopulationPyramidChart } from "./PopulationPyramidChart";
import { StatCard } from "./StatCard";

function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n));
}

function sparkline(series: TimeSeriesPoint[], n = 15): number[] {
  return lastN(series, n).map((p) => p.value);
}

function yoyTrend(
  series: TimeSeriesPoint[],
  unit: string,
): { value: number; label: string } | undefined {
  if (series.length < 2) return undefined;
  const curr = series[series.length - 1].value;
  const prev = series[series.length - 2].value;
  const diff = curr - prev;
  const sign = diff >= 0 ? "+" : "";
  return { value: diff, label: `${sign}${formatNumber(diff, 2)} ${unit}` };
}

interface SimpleTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    name: string;
  }>;
  label?: number;
  suffix?: string;
}

function SimpleTooltip({ active, payload, label, suffix = "" }: SimpleTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-popover/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatNumber(p.value, 2)}
          {suffix}
        </p>
      ))}
    </div>
  );
}

const DEMO_EU_INDICATORS = ["birthRate", "deathRate", "fertilityRate", "lifeExpectancy"] as const;

type DemoEUIndicator = (typeof DEMO_EU_INDICATORS)[number];

const COLOR_SPAIN = "hsl(215, 65%, 45%)";
const COLOR_OTHER = "hsl(215, 30%, 65%)";
const COLOR_EU27 = "hsl(215, 15%, 55%)";

export function DemographicsBlock() {
  const { demographics, eurostat } = useData();
  const { msg, lang } = useI18n();
  const dm = msg.blocks.demographics;

  const { vitalStats, lifeExpectancy, pyramid, dependencyRatio, immigrationShare, cpi } =
    demographics;

  const dmTooltips =
    lang === "en"
      ? {
          population:
            "The total number of people registered as residents in Spain, including Spanish nationals and foreign residents.",
          birthRate: "How many babies are born for every 1,000 people in the population each year.",
          fertilityRate:
            "The average number of children a woman is expected to have over her lifetime. A rate of 2.1 is needed to keep the population stable without immigration.",
          dependencyRatio:
            "For every 100 working-age people, this many are aged 65 or over. A higher ratio means more pensioners relative to workers.",
          lifeExpectancy:
            "How many years a baby born today is expected to live on average, based on current mortality rates.",
          naturalGrowth:
            "The difference between births and deaths per 1,000 people. Negative means more people are dying than being born.",
          deathRate: "How many people die for every 1,000 residents each year.",
          immigrationShare:
            "The percentage of people living in Spain who were born in another country.",
          inflationRate:
            "How much more expensive things are compared to a year ago, measured by the Consumer Price Index (CPI). A rate of 2% means a basket of goods that cost €100 last year now costs €102.",
        }
      : {
          population:
            "El número total de personas registradas como residentes en España, incluyendo nacionales y extranjeros.",
          birthRate: "Cuántos bebés nacen por cada 1.000 habitantes al año.",
          fertilityRate:
            "El número medio de hijos que tendría una mujer a lo largo de su vida. Se necesita un índice de 2,1 para que la población no disminuya sin inmigración.",
          dependencyRatio:
            "Por cada 100 personas en edad de trabajar, este número tiene 65 años o más. Cuanto más alto, más pensionistas hay en relación a los trabajadores.",
          lifeExpectancy:
            "Cuántos años se espera que viva de media un bebé nacido hoy, según las tasas de mortalidad actuales.",
          naturalGrowth:
            "La diferencia entre nacimientos y defunciones por cada 1.000 habitantes. Si es negativo, muere más gente de la que nace.",
          deathRate: "Cuántas personas fallecen por cada 1.000 habitantes al año.",
          immigrationShare:
            "El porcentaje de personas que viven en España pero nacieron en otro país.",
          inflationRate:
            "Cuánto más caras están las cosas respecto al año anterior, medido por el Índice de Precios al Consumo (IPC). Una tasa del 2% significa que lo que costaba 100 € el año pasado ahora cuesta 102 €.",
        };

  const [selectedYear, setSelectedYear] = useState<string>(() =>
    pyramid?.years?.length ? String(pyramid.years[pyramid.years.length - 1]) : "",
  );

  const [selectedEUIndicator, setSelectedEUIndicator] = useState<DemoEUIndicator>("birthRate");

  const euCopy =
    lang === "en"
      ? {
          title: "European Comparison",
          indicatorLabels: {
            birthRate: "Birth rate",
            deathRate: "Death rate",
            fertilityRate: "Fertility rate",
            lifeExpectancy: "Life expectancy",
          } as Record<DemoEUIndicator, string>,
          units: {
            birthRate: "\u2030",
            deathRate: "\u2030",
            fertilityRate: "children/woman",
            lifeExpectancy: "years",
          } as Record<DemoEUIndicator, string>,
          countryNames: {
            ES: "Spain",
            DE: "Germany",
            FR: "France",
            IT: "Italy",
            PT: "Portugal",
            EL: "Greece",
            NL: "Netherlands",
            EU27_2020: "EU-27",
          } as Record<string, string>,
          eu27Avg: "EU-27 avg",
        }
      : {
          title: "Comparativa europea",
          indicatorLabels: {
            birthRate: "Natalidad",
            deathRate: "Mortalidad",
            fertilityRate: "Fecundidad",
            lifeExpectancy: "Esperanza de vida",
          } as Record<DemoEUIndicator, string>,
          units: {
            birthRate: "\u2030",
            deathRate: "\u2030",
            fertilityRate: "hijos/mujer",
            lifeExpectancy: "a\u00F1os",
          } as Record<DemoEUIndicator, string>,
          countryNames: {} as Record<string, string>,
          eu27Avg: "Media UE-27",
        };

  const euChartData = useMemo(() => {
    const indicatorData = eurostat.indicators[selectedEUIndicator];
    if (!indicatorData) return [];

    const entries = eurostat.countries
      .filter((code: string) => indicatorData[code] !== undefined)
      .map((code: string) => ({
        country: euCopy.countryNames[code] ?? eurostat.countryNames[code] ?? code,
        countryCode: code,
        value: indicatorData[code],
        isSpain: code === "ES",
        isEU: code === "EU27_2020",
      }));

    // Higher is "better" for life expectancy, lower for death rate
    if (selectedEUIndicator === "deathRate") {
      entries.sort((a: { value: number }, b: { value: number }) => a.value - b.value);
    } else {
      entries.sort((a: { value: number }, b: { value: number }) => b.value - a.value);
    }

    return entries;
  }, [eurostat, selectedEUIndicator, euCopy.countryNames]);

  const eu27Value = eurostat.indicators[selectedEUIndicator]?.EU27_2020 ?? null;

  // Source helpers
  const populationSource = demographics.sourceAttribution?.population
    ? fromAttribution(demographics.sourceAttribution.population)
    : INE_POBLACION;

  const vitalSource = demographics.sourceAttribution?.vitalStats
    ? fromAttribution(demographics.sourceAttribution.vitalStats)
    : INE_IDB;

  const lifeExpSource = demographics.sourceAttribution?.lifeExpectancy
    ? fromAttribution(demographics.sourceAttribution.lifeExpectancy)
    : INE_LIFE_EXPECTANCY;

  const pyramidSource = demographics.sourceAttribution?.pyramid
    ? fromAttribution(demographics.sourceAttribution.pyramid)
    : INE_PYRAMID;

  // Latest vital stats values
  const latestBirthRate = vitalStats?.birthRate?.length
    ? vitalStats.birthRate[vitalStats.birthRate.length - 1].value
    : null;
  const latestDeathRate = vitalStats?.deathRate?.length
    ? vitalStats.deathRate[vitalStats.deathRate.length - 1].value
    : null;
  const latestFertility = vitalStats?.fertilityRate?.length
    ? vitalStats.fertilityRate[vitalStats.fertilityRate.length - 1].value
    : null;
  const latestNaturalGrowth = vitalStats?.naturalGrowth?.length
    ? vitalStats.naturalGrowth[vitalStats.naturalGrowth.length - 1].value
    : null;

  const latestLifeExpBoth = lifeExpectancy?.both?.length
    ? lifeExpectancy.both[lifeExpectancy.both.length - 1].value
    : null;

  // CPI year-over-year inflation rate
  const { latestInflationRate, inflationSparkline, inflationTrend } = useMemo(() => {
    const byYear = cpi?.byYear;
    if (!byYear)
      return {
        latestInflationRate: null,
        inflationSparkline: undefined,
        inflationTrend: undefined,
      };
    const years = Object.keys(byYear)
      .map(Number)
      .sort((a, b) => a - b);
    if (years.length < 2)
      return {
        latestInflationRate: null,
        inflationSparkline: undefined,
        inflationTrend: undefined,
      };
    const rates = years.slice(1).map((y) => (byYear[String(y)] / byYear[String(y - 1)] - 1) * 100);
    const latest = rates[rates.length - 1];
    const prev = rates[rates.length - 2];
    const diff = latest - prev;
    const sign = diff >= 0 ? "+" : "";
    return {
      latestInflationRate: latest,
      inflationSparkline: rates,
      inflationTrend: {
        value: diff,
        label: `${sign}${formatNumber(diff, 1)} pp`,
      },
    };
  }, [cpi]);

  // Vital trends chart data (aligned by year)
  const vitalTrendsData = useMemo(() => {
    if (!vitalStats?.birthRate?.length || !vitalStats?.deathRate?.length) return [];
    const byYear = new Map<number, { year: number; birthRate?: number; deathRate?: number }>();
    for (const p of vitalStats.birthRate) {
      byYear.set(p.year, {
        ...byYear.get(p.year),
        year: p.year,
        birthRate: p.value,
      });
    }
    for (const p of vitalStats.deathRate) {
      byYear.set(p.year, {
        ...byYear.get(p.year),
        year: p.year,
        deathRate: p.value,
      });
    }
    return [...byYear.values()].sort((a, b) => a.year - b.year);
  }, [vitalStats?.birthRate, vitalStats?.deathRate]);

  // Life expectancy chart data
  const lifeExpData = useMemo(() => {
    if (!lifeExpectancy?.both?.length) return [];
    const byYear = new Map<
      number,
      { year: number; both?: number; male?: number; female?: number }
    >();
    for (const p of lifeExpectancy.both) {
      byYear.set(p.year, {
        ...byYear.get(p.year),
        year: p.year,
        both: p.value,
      });
    }
    for (const p of lifeExpectancy.male ?? []) {
      byYear.set(p.year, {
        ...byYear.get(p.year),
        year: p.year,
        male: p.value,
      });
    }
    for (const p of lifeExpectancy.female ?? []) {
      byYear.set(p.year, {
        ...byYear.get(p.year),
        year: p.year,
        female: p.value,
      });
    }
    return [...byYear.values()].sort((a, b) => a.year - b.year);
  }, [lifeExpectancy?.both, lifeExpectancy?.male, lifeExpectancy?.female]);

  // Immigration trend chart data
  const immigrationData = useMemo(() => {
    if (!immigrationShare?.historical?.length) return [];
    return immigrationShare.historical.map((p) => ({
      year: p.year,
      share: p.value * 100,
    }));
  }, [immigrationShare?.historical]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>{dm.title}</CardTitle>
          <ExportBlockButton targetId="demografia" filenamePrefix="cuentas-publicas-demografia" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Row 1: 4 StatCards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label={dm.population}
            value={formatCompact(demographics.population)}
            tooltip={dmTooltips.population}
            delay={0.05}
            sparklineData={undefined}
            sources={[populationSource]}
          />
          <StatCard
            label={dm.birthRate}
            value={
              latestBirthRate != null
                ? `${formatNumber(latestBirthRate, 2)}\u2030`
                : msg.common.notAvailable
            }
            tooltip={dmTooltips.birthRate}
            delay={0.1}
            sparklineData={vitalStats?.birthRate ? sparkline(vitalStats.birthRate) : undefined}
            trend={
              vitalStats?.birthRate ? yoyTrend(vitalStats.birthRate, dm.perThousand) : undefined
            }
            sources={[vitalSource]}
          />
          <StatCard
            label={dm.fertilityRate}
            value={
              latestFertility != null
                ? `${formatNumber(latestFertility, 2)} ${dm.childrenPerWoman}`
                : msg.common.notAvailable
            }
            tooltip={dmTooltips.fertilityRate}
            delay={0.15}
            sparklineData={
              vitalStats?.fertilityRate ? sparkline(vitalStats.fertilityRate) : undefined
            }
            trend={
              vitalStats?.fertilityRate
                ? yoyTrend(vitalStats.fertilityRate, dm.childrenPerWoman)
                : undefined
            }
            sources={[vitalSource]}
          />
          <StatCard
            label={dm.dependencyRatio}
            value={
              dependencyRatio
                ? formatPercent(dependencyRatio.oldAge * 100)
                : msg.common.notAvailable
            }
            tooltip={dmTooltips.dependencyRatio}
            delay={0.2}
            sources={[pyramidSource]}
          />
        </div>

        {/* Row 2: 4 StatCards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label={dm.lifeExpectancy}
            value={
              latestLifeExpBoth != null
                ? `${formatNumber(latestLifeExpBoth, 1)} ${dm.years}`
                : msg.common.notAvailable
            }
            tooltip={dmTooltips.lifeExpectancy}
            delay={0.25}
            sparklineData={lifeExpectancy?.both ? sparkline(lifeExpectancy.both) : undefined}
            trend={lifeExpectancy?.both ? yoyTrend(lifeExpectancy.both, dm.years) : undefined}
            sources={[lifeExpSource]}
          />
          <StatCard
            label={dm.naturalGrowth}
            value={
              latestNaturalGrowth != null
                ? `${formatNumber(latestNaturalGrowth, 2)}\u2030`
                : msg.common.notAvailable
            }
            tooltip={dmTooltips.naturalGrowth}
            delay={0.3}
            sparklineData={
              vitalStats?.naturalGrowth ? sparkline(vitalStats.naturalGrowth) : undefined
            }
            trend={
              vitalStats?.naturalGrowth
                ? yoyTrend(vitalStats.naturalGrowth, dm.perThousand)
                : undefined
            }
            sources={[vitalSource]}
          />
          <StatCard
            label={dm.deathRate}
            value={
              latestDeathRate != null
                ? `${formatNumber(latestDeathRate, 2)}\u2030`
                : msg.common.notAvailable
            }
            tooltip={dmTooltips.deathRate}
            delay={0.35}
            sparklineData={vitalStats?.deathRate ? sparkline(vitalStats.deathRate) : undefined}
            trend={
              vitalStats?.deathRate ? yoyTrend(vitalStats.deathRate, dm.perThousand) : undefined
            }
            sources={[vitalSource]}
          />
          <StatCard
            label={dm.immigrationShare}
            value={
              immigrationShare
                ? formatPercent(immigrationShare.total * 100)
                : msg.common.notAvailable
            }
            tooltip={dmTooltips.immigrationShare}
            delay={0.4}
            sparklineData={
              immigrationShare?.historical ? sparkline(immigrationShare.historical) : undefined
            }
            trend={
              immigrationShare?.historical ? yoyTrend(immigrationShare.historical, "%") : undefined
            }
            sources={[pyramidSource]}
          />
        </div>

        {/* Row 3: inflation StatCard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label={dm.inflationRate}
            value={
              latestInflationRate != null
                ? `${formatNumber(latestInflationRate, 1)}%`
                : msg.common.notAvailable
            }
            tooltip={dmTooltips.inflationRate}
            delay={0.45}
            sparklineData={inflationSparkline}
            trend={inflationTrend}
            sources={[populationSource]}
          />
        </div>

        {/* Population Pyramid with year selector */}
        {pyramid && pyramid.years.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground">{dm.pyramidTitle}</h3>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {[...pyramid.years].reverse().map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <PopulationPyramidChart data={pyramid} selectedYear={selectedYear} />
          </div>
        )}

        {/* Vital stats trend chart */}
        {vitalTrendsData.length > 1 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
              {dm.vitalTrendsTitle}
            </h3>
            <div className="flex items-center justify-center gap-5 mb-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
                {dm.birthRate}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-rose-500" />
                {dm.deathRate}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={vitalTrendsData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v: number) => formatNumber(v, 1)}
                />
                <Tooltip content={<SimpleTooltip suffix={`\u2030`} />} />
                <Line
                  type="monotone"
                  dataKey="birthRate"
                  name={dm.birthRate}
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="deathRate"
                  name={dm.deathRate}
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Life expectancy chart */}
        {lifeExpData.length > 1 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
              {dm.lifeExpectancyTitle}
            </h3>
            <div className="flex items-center justify-center gap-5 mb-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
                {dm.lifeExpectancy}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-teal-500" />
                {dm.pyramidMale}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-rose-500" />
                {dm.pyramidFemale}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lifeExpData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  domain={["dataMin - 2", "dataMax + 2"]}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v: number) => formatNumber(v, 1)}
                />
                <Tooltip content={<SimpleTooltip suffix={` ${dm.years}`} />} />
                <Line
                  type="monotone"
                  dataKey="both"
                  name={dm.lifeExpectancy}
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="male"
                  name={dm.pyramidMale}
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="female"
                  name={dm.pyramidFemale}
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Immigration trend chart */}
        {immigrationData.length > 1 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
              {dm.immigrationTrendTitle}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={immigrationData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v: number) => `${formatNumber(v, 1)}%`}
                />
                <Tooltip content={<SimpleTooltip suffix="%" />} />
                <Area
                  type="monotone"
                  dataKey="share"
                  name={dm.immigrationShare}
                  stroke="hsl(var(--chart-4))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* EU Demographic Comparison */}
        {euChartData.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground">{euCopy.title}</h3>
              <select
                value={selectedEUIndicator}
                onChange={(e) => setSelectedEUIndicator(e.target.value as DemoEUIndicator)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {DEMO_EU_INDICATORS.map((key) => (
                  <option key={key} value={key}>
                    {euCopy.indicatorLabels[key]}
                  </option>
                ))}
              </select>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={euChartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v: number) =>
                    `${formatNumber(v, selectedEUIndicator === "fertilityRate" ? 1 : 0)}`
                  }
                />
                <YAxis
                  type="category"
                  dataKey="country"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={80}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as {
                      country: string;
                      value: number;
                    };
                    return (
                      <div className="bg-popover/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-xl text-sm">
                        <p className="font-semibold text-foreground">{d.country}</p>
                        <p className="text-muted-foreground">
                          {formatNumber(d.value, 1)} {euCopy.units[selectedEUIndicator]}
                        </p>
                      </div>
                    );
                  }}
                />
                {eu27Value != null && (
                  <ReferenceLine
                    x={eu27Value}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    label={{
                      value: `${euCopy.eu27Avg}: ${formatNumber(eu27Value, 1)}`,
                      position: "top",
                      style: {
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      },
                    }}
                  />
                )}
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {euChartData.map(
                    (entry: { countryCode: string; isSpain: boolean; isEU: boolean }) => (
                      <Cell
                        key={entry.countryCode}
                        fill={entry.isSpain ? COLOR_SPAIN : entry.isEU ? COLOR_EU27 : COLOR_OTHER}
                        opacity={entry.isSpain ? 1 : 0.8}
                      />
                    ),
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Eurostat {eurostat.year}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
