import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SimpleTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number | null;
    color: string;
    name: string;
  }>;
  label?: number;
}

function ProjectionTooltip({ active, payload, label }: SimpleTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-xl text-sm max-w-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <p key={p.dataKey} style={{ color: p.color }} className="text-xs">
            {p.name}: {p.value?.toFixed(2)}
          </p>
        ))}
    </div>
  );
}

// Colors for projection series — warm tones to contrast with the blue actual line
const PROJECTION_COLORS = [
  "#f87171", // red-400
  "#fb923c", // orange-400
  "#ef4444", // red-500
  "#dc2626", // red-600
  "#f59e0b", // amber-500
  "#d97706", // amber-600
  "#b45309", // amber-700
  "#e11d48", // rose-600
];

export interface FertilityProjectionSeries {
  source: string;
  publishedYear: number;
  points: Array<{ year: number; value: number }>;
}

export interface FertilityProjectionsChartProps {
  actual: Array<{ year: number; value: number }>;
  projections: FertilityProjectionSeries[];
  linearRegression: Array<{ year: number; value: number }>;
  ourEstimate: Array<{ year: number; value: number }>;
  replacementLevel: number;
  title: string;
  actualLabel: string;
  regressionLabel: string;
  ourEstimateLabel: string;
  replacementLabel: string;
}

export function FertilityProjectionsChart({
  actual,
  projections,
  linearRegression,
  ourEstimate,
  replacementLevel,
  title,
  actualLabel,
  regressionLabel,
  ourEstimateLabel,
  replacementLabel,
}: FertilityProjectionsChartProps) {
  if (!actual.length) return null;

  // Build unified dataset across all years
  const allYears = new Set<number>();
  for (const p of actual) allYears.add(p.year);
  for (const s of projections) for (const p of s.points) allYears.add(p.year);
  for (const p of linearRegression) allYears.add(p.year);
  for (const p of ourEstimate) allYears.add(p.year);

  const chartData = [...allYears]
    .sort((a, b) => a - b)
    .map((year) => {
      const row: Record<string, number | null> = { year };

      const actualPoint = actual.find((p) => p.year === year);
      row.actual = actualPoint?.value ?? null;

      for (const proj of projections) {
        const point = proj.points.find((p) => p.year === year);
        row[`proj_${proj.source}`] = point?.value ?? null;
      }

      const regPoint = linearRegression.find((p) => p.year === year);
      row.regression = regPoint?.value ?? null;

      const estPoint = ourEstimate.find((p) => p.year === year);
      row.ourEstimate = estPoint?.value ?? null;

      return row;
    });

  // Determine the last actual year to draw the separator line
  const lastActualYear = actual.reduce((max, p) => Math.max(max, p.year), 0);

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">{title}</h3>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mb-3 text-xs text-muted-foreground">
        {/* Actual */}
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-5 h-0.5"
            style={{ backgroundColor: "hsl(var(--chart-1))", height: "3px" }}
          />
          {actualLabel}
        </span>
        {/* Projections */}
        {projections.map((proj, i) => (
          <span key={proj.source} className="flex items-center gap-1.5">
            <svg width="20" height="6" className="inline-block" role="img" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="20"
                y2="3"
                stroke={PROJECTION_COLORS[i % PROJECTION_COLORS.length]}
                strokeWidth="1.5"
                strokeDasharray="5 5"
              />
            </svg>
            {proj.source}
          </span>
        ))}
        {/* Regression 10y */}
        <span className="flex items-center gap-1.5">
          <svg width="20" height="6" className="inline-block" role="img" aria-hidden="true">
            <line
              x1="0"
              y1="3"
              x2="20"
              y2="3"
              stroke="hsl(var(--chart-3))"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
          </svg>
          {regressionLabel}
        </span>
        {/* Our estimate 5y */}
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-5 h-0.5"
            style={{ backgroundColor: "hsl(var(--chart-5))", height: "3px" }}
          />
          {ourEstimateLabel}
        </span>
        {/* Replacement level */}
        <span className="flex items-center gap-1.5">
          <svg width="20" height="6" className="inline-block" role="img" aria-hidden="true">
            <line
              x1="0"
              y1="3"
              x2="20"
              y2="3"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          </svg>
          {replacementLabel}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            domain={[0.5, 2.5]}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <Tooltip content={<ProjectionTooltip />} />

          {/* Replacement level reference line */}
          <ReferenceLine
            y={replacementLevel}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="3 3"
            strokeWidth={1}
            label={{
              value: replacementLabel,
              position: "insideTopRight",
              fontSize: 10,
              fill: "hsl(var(--muted-foreground))",
            }}
          />

          {/* Vertical separator: actual vs projection */}
          {lastActualYear > 0 && (
            <ReferenceLine
              x={lastActualYear}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}

          {/* Actual TFR — solid thick blue */}
          <Line
            type="monotone"
            dataKey="actual"
            name={actualLabel}
            stroke="hsl(var(--chart-1))"
            strokeWidth={3}
            dot={false}
          />

          {/* Each projection series — dashed warm colors */}
          {projections.map((proj, i) => (
            <Line
              key={proj.source}
              type="monotone"
              dataKey={`proj_${proj.source}`}
              name={proj.source}
              stroke={PROJECTION_COLORS[i % PROJECTION_COLORS.length]}
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              connectNulls
            />
          ))}

          {/* Linear regression 10y — dotted green */}
          <Line
            type="monotone"
            dataKey="regression"
            name={regressionLabel}
            stroke="hsl(var(--chart-3))"
            strokeWidth={2}
            strokeDasharray="3 3"
            dot={false}
            connectNulls
          />

          {/* Our estimate 5y — solid bold */}
          <Line
            type="monotone"
            dataKey="ourEstimate"
            name={ourEstimateLabel}
            stroke="hsl(var(--chart-5))"
            strokeWidth={3}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
