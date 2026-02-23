import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
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
    <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
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

export function DemographicsBlock() {
  const { demographics } = useData();
  const { msg } = useI18n();
  const dm = msg.blocks.demographics;

  const { vitalStats, lifeExpectancy, pyramid, dependencyRatio, immigrationShare } = demographics;

  const [selectedYear, setSelectedYear] = useState<string>(() =>
    pyramid?.years?.length ? String(pyramid.years[pyramid.years.length - 1]) : "",
  );

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
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="deathRate"
                  name={dm.deathRate}
                  stroke="#f43f5e"
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
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="male"
                  name={dm.pyramidMale}
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="female"
                  name={dm.pyramidFemale}
                  stroke="#f43f5e"
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
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
