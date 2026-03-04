import type { ProvincialPopulationData } from "@/data/types";

export interface PopulationSeriesPoint {
  year: number;
  value: number;
}

export function buildPopulationSeries(
  provincialPopulation?: ProvincialPopulationData,
): PopulationSeriesPoint[] {
  if (!provincialPopulation?.entries?.length) return [];

  const totalsByYear = new Map<number, number>();
  for (const province of provincialPopulation.entries) {
    if (!Array.isArray(province.historical)) continue;
    for (const point of province.historical) {
      if (typeof point?.year !== "number" || typeof point?.value !== "number") continue;
      totalsByYear.set(point.year, (totalsByYear.get(point.year) ?? 0) + point.value);
    }
  }

  return [...totalsByYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, value]) => ({ year, value }));
}
