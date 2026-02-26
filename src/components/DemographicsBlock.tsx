import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fromAttribution,
  INE_IDB,
  INE_LIFE_EXPECTANCY,
  INE_MIGRACIONES,
  INE_POBLACION,
  INE_PROJECTIONS,
  INE_PYRAMID,
} from "@/data/sources";
import type { TimeSeriesPoint } from "@/data/types";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber, formatPercent } from "@/utils/formatters";
import {
  type DemoEUIndicator,
  EUDemographicComparison,
} from "./demographics/EUDemographicComparison";
import { ImmigrationChart } from "./demographics/ImmigrationChart";
import { LifeExpectancyChart } from "./demographics/LifeExpectancyChart";
import { MigrationFlowsChart } from "./demographics/MigrationFlowsChart";
import { ProjectionsChart } from "./demographics/ProjectionsChart";
import { ProvincialRankingChart } from "./demographics/ProvincialRankingChart";
import { VitalTrendsChart } from "./demographics/VitalTrendsChart";
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

export function DemographicsBlock() {
  const { demographics, eurostat } = useData();
  const { msg } = useI18n();
  const dm = msg.blocks.demographics;

  const {
    vitalStats,
    lifeExpectancy,
    pyramid,
    dependencyRatio,
    immigrationShare,
    cpi,
    projections,
    migrationFlows,
    provincialPopulation,
  } = demographics;

  const dmTooltips = dm.tooltips;

  const [selectedYear, setSelectedYear] = useState<string>(() =>
    pyramid?.years?.length ? String(pyramid.years[pyramid.years.length - 1]) : "",
  );

  const [selectedEUIndicator, setSelectedEUIndicator] = useState<DemoEUIndicator>("birthRate");

  const euCopy = dm.euComparison;

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

        {/* Row 4: Projections & Migration highlights */}
        {(projections || migrationFlows) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {projections?.shortTerm?.national?.length ? (
              <StatCard
                label={dm.projectedPopulation}
                value={formatCompact(
                  projections.shortTerm.national[projections.shortTerm.national.length - 1].value,
                )}
                tooltip={dmTooltips.projectedPopulation}
                delay={0.5}
                sources={[INE_PROJECTIONS]}
              />
            ) : null}
            {projections?.indicators?.dependencyOldAge?.length
              ? (() => {
                  const target2050 = projections.indicators.dependencyOldAge.find(
                    (p) => p.year === 2050,
                  );
                  return target2050 ? (
                    <StatCard
                      label={dm.projectedDependency2050}
                      value={`${formatNumber(target2050.value, 1)}%`}
                      tooltip={dmTooltips.projectedDependency2050}
                      delay={0.55}
                      sources={[INE_PROJECTIONS]}
                    />
                  ) : null;
                })()
              : null}
            {migrationFlows?.netMigration?.length
              ? (() => {
                  const latest =
                    migrationFlows.netMigration[migrationFlows.netMigration.length - 1];
                  return (
                    <StatCard
                      label={dm.netMigrationLatest}
                      value={`+${formatCompact(latest.value)}`}
                      tooltip={dmTooltips.netMigrationLatest}
                      delay={0.6}
                      sparklineData={migrationFlows.netMigration.map((p) => p.value)}
                      sources={[INE_MIGRACIONES]}
                    />
                  );
                })()
              : null}
          </div>
        )}

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

        <VitalTrendsChart
          data={vitalTrendsData}
          title={dm.vitalTrendsTitle}
          birthRateLabel={dm.birthRate}
          deathRateLabel={dm.deathRate}
        />

        <LifeExpectancyChart
          data={lifeExpData}
          title={dm.lifeExpectancyTitle}
          bothLabel={dm.lifeExpectancy}
          maleLabel={dm.pyramidMale}
          femaleLabel={dm.pyramidFemale}
          yearsLabel={dm.years}
        />

        <ImmigrationChart
          data={immigrationData}
          title={dm.immigrationTrendTitle}
          shareLabel={dm.immigrationShare}
        />

        {/* Population Projections */}
        {projections && (
          <ProjectionsChart
            populationData={projections.shortTerm.national.map((p) => ({
              year: p.year,
              population: p.value,
            }))}
            agingData={projections.indicators.dependencyOldAge.map((p, i) => ({
              year: p.year,
              dependencyOldAge: p.value,
              proportionOver65: projections.indicators.proportionOver65[i]?.value ?? 0,
            }))}
            populationTitle={dm.projections.populationTitle}
            agingTitle={dm.projections.agingTitle}
            populationLabel={dm.projections.populationLabel}
            dependencyLabel={dm.projections.dependencyLabel}
            proportionLabel={dm.projections.proportionLabel}
            millionLabel={dm.projections.millionLabel}
          />
        )}

        {/* Migration Flows */}
        {migrationFlows && migrationFlows.immigration.length > 0 && (
          <MigrationFlowsChart
            data={migrationFlows.immigration.map((p) => ({
              year: p.year,
              immigration: p.value,
              emigration: migrationFlows.emigration.find((e) => e.year === p.year)?.value ?? 0,
              netMigration: migrationFlows.netMigration.find((n) => n.year === p.year)?.value ?? 0,
            }))}
            title={dm.migrationFlows.title}
            immigrationLabel={dm.migrationFlows.immigration}
            emigrationLabel={dm.migrationFlows.emigration}
            netLabel={dm.migrationFlows.netMigration}
          />
        )}

        {/* Provincial Population Ranking */}
        {provincialPopulation && provincialPopulation.entries.length > 0 && (
          <ProvincialRankingChart
            entries={provincialPopulation.entries.map((e) => ({
              code: e.code,
              name: e.name,
              ccaa: e.ccaa,
              population: e.population,
            }))}
            latestYear={provincialPopulation.latestYear}
            title={dm.provincial.title}
            ccaaLabel={dm.provincial.ccaaLabel}
            provincesLabel={dm.provincial.provincesLabel}
            populationLabel={dm.provincial.populationLabel}
            millionLabel={dm.provincial.millionLabel}
          />
        )}

        <EUDemographicComparison
          data={euChartData}
          eu27Value={eu27Value}
          selectedIndicator={selectedEUIndicator}
          onIndicatorChange={setSelectedEUIndicator}
          title={euCopy.title}
          indicatorLabels={euCopy.indicatorLabels}
          units={euCopy.units}
          eu27Avg={euCopy.eu27Avg}
          eurostatYear={eurostat.year}
        />
      </CardContent>
    </Card>
  );
}
