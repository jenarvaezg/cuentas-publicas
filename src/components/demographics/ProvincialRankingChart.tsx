import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/ChartTooltip";
import { useTabKeyboardNav } from "@/hooks/useTabKeyboardNav";
import { formatNumber } from "@/utils/formatters";

const COLOR_LARGE = "hsl(var(--chart-2))";
const COLOR_NORMAL = "hsl(var(--chart-1))";
const LARGE_THRESHOLD = 5_000_000;

interface ChartEntry {
  name: string;
  population: number;
}

interface ProvincialRankingChartProps {
  entries: Array<{
    code: string;
    name: string;
    ccaa: string;
    population: number;
  }>;
  latestYear: number;
  title: string;
  ccaaLabel: string;
  provincesLabel: string;
  populationLabel: string;
  millionLabel: string;
}

export function ProvincialRankingChart({
  entries,
  latestYear,
  title,
  ccaaLabel,
  provincesLabel,
  populationLabel,
  millionLabel,
}: ProvincialRankingChartProps) {
  const [view, setView] = useState<"ccaa" | "provinces">("ccaa");
  const VIEW_TABS = ["ccaa", "provinces"] as const;
  const { onKeyDown: viewTabKeyDown } = useTabKeyboardNav(VIEW_TABS, view, setView);

  if (entries.length === 0) return null;

  const ccaaData: ChartEntry[] = (() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      map.set(e.ccaa, (map.get(e.ccaa) ?? 0) + e.population);
    }
    return [...map.entries()]
      .map(([name, population]) => ({ name, population }))
      .sort((a, b) => b.population - a.population);
  })();

  const provincesData: ChartEntry[] = [...entries]
    .sort((a, b) => b.population - a.population)
    .slice(0, 20)
    .map(({ name, population }) => ({ name, population }));

  const data = view === "ccaa" ? ccaaData : provincesData;
  const chartHeight = data.length * 28 + 40;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {title} ({latestYear})
        </h3>
        <div className="flex gap-1" role="tablist" onKeyDown={viewTabKeyDown}>
          <button
            type="button"
            role="tab"
            id="prov-tab-ccaa"
            aria-selected={view === "ccaa"}
            aria-controls="prov-panel-ccaa"
            tabIndex={view === "ccaa" ? 0 : -1}
            onClick={() => setView("ccaa")}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              view === "ccaa"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-input hover:bg-muted"
            }`}
          >
            {ccaaLabel}
          </button>
          <button
            type="button"
            role="tab"
            id="prov-tab-provinces"
            aria-selected={view === "provinces"}
            aria-controls="prov-panel-provinces"
            tabIndex={view === "provinces" ? 0 : -1}
            onClick={() => setView("provinces")}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              view === "provinces"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-input hover:bg-muted"
            }`}
          >
            {provincesLabel}
          </button>
        </div>
      </div>
      <div role="tabpanel" id={`prov-panel-${view}`} aria-labelledby={`prov-tab-${view}`}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}${millionLabel}`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              width={120}
            />
            <Tooltip
              content={({ active, payload }) => (
                <ChartTooltip<ChartEntry>
                  active={active}
                  payload={payload as Array<{ payload: ChartEntry }>}
                >
                  {(pl) => {
                    const d = pl[0].payload;
                    return (
                      <>
                        <p className="font-semibold text-foreground">{d.name}</p>
                        <p className="text-muted-foreground">
                          {formatNumber(d.population, 0)} {populationLabel}
                        </p>
                      </>
                    );
                  }}
                </ChartTooltip>
              )}
            />
            <Bar dataKey="population" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.population > LARGE_THRESHOLD ? COLOR_LARGE : COLOR_NORMAL}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
