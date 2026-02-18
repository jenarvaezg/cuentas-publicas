import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BudgetCategory } from "@/data/types";
import { formatNumber } from "@/utils/formatters";

export type CompareMode = "absoluto" | "pesos" | "cambio";

/** 10 fixed colors for COFOG divisions, consistent across years */
const COFOG_COLORS: Record<string, string> = {
  "01": "hsl(215, 65%, 45%)", // Servicios públicos generales — blue
  "02": "hsl(0, 65%, 50%)", // Defensa — red
  "03": "hsl(30, 75%, 50%)", // Orden público — orange
  "04": "hsl(155, 55%, 40%)", // Asuntos económicos — teal
  "05": "hsl(120, 45%, 40%)", // Medio ambiente — green
  "06": "hsl(45, 70%, 50%)", // Vivienda — gold
  "07": "hsl(340, 60%, 50%)", // Salud — pink
  "08": "hsl(265, 50%, 55%)", // Ocio, cultura — purple
  "09": "hsl(190, 60%, 45%)", // Educación — cyan
  "10": "hsl(20, 70%, 50%)", // Protección social — dark orange
};

function getColor(code: string): string {
  const div = code.substring(0, 2);
  return COFOG_COLORS[div] || "hsl(220, 10%, 50%)";
}

interface BudgetChartProps {
  categories: BudgetCategory[];
  comparisonCategories?: BudgetCategory[];
  comparisonYear?: number;
  selectedYear: number;
  drilldownCategory: string | null;
  onDrilldown: (code: string | null) => void;
  compareMode: CompareMode;
  euroLabel?: string;
}

interface ChartDatum {
  name: string;
  code: string;
  amount: number;
  percentage: number;
  comparison?: number;
  comparisonPercentage?: number;
  change?: number;
}

function resolveItems(
  categories: BudgetCategory[],
  drilldownCategory: string | null,
): BudgetCategory[] {
  if (drilldownCategory) {
    const parent = categories.find((c) => c.code === drilldownCategory);
    return parent?.children || [];
  }
  return categories;
}

export function BudgetChart({
  categories,
  comparisonCategories,
  comparisonYear,
  selectedYear,
  drilldownCategory,
  onDrilldown,
  compareMode,
  euroLabel,
}: BudgetChartProps) {
  const data = useMemo<ChartDatum[]>(() => {
    const items = resolveItems(categories, drilldownCategory);

    return items.map((cat) => {
      const datum: ChartDatum = {
        name: cat.name,
        code: cat.code,
        amount: cat.amount,
        percentage: cat.percentage,
      };

      if (comparisonCategories) {
        const compItems = resolveItems(comparisonCategories, drilldownCategory);
        const match = compItems.find((c) => c.code === cat.code);
        datum.comparison = match?.amount || 0;
        datum.comparisonPercentage = match?.percentage || 0;
        datum.change =
          match?.amount && match.amount > 0
            ? ((cat.amount - match.amount) / match.amount) * 100
            : undefined;
      }

      return datum;
    });
  }, [categories, comparisonCategories, drilldownCategory]);

  const hasComparison = comparisonCategories && comparisonYear;

  // Determine which dataKeys and formatters to use based on mode
  const isChangeMode = compareMode === "cambio" && hasComparison;
  const isWeightMode = compareMode === "pesos" && hasComparison;

  const primaryKey = isChangeMode
    ? "change"
    : isWeightMode
      ? "percentage"
      : "amount";
  const secondaryKey = isWeightMode ? "comparisonPercentage" : "comparison";

  const formatAxis = (v: number) => {
    if (isChangeMode || isWeightMode) return `${formatNumber(v, 1)}%`;
    return formatNumber(v, 0);
  };

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ChartDatum }>;
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;

    if (isChangeMode) {
      return (
        <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
          <p className="font-semibold text-foreground">{d.name}</p>
          <p className="text-muted-foreground">
            {selectedYear}: {formatNumber(d.amount, 0)} M€
          </p>
          {d.comparison !== undefined && (
            <p className="text-muted-foreground">
              {comparisonYear}: {formatNumber(d.comparison, 0)} M€
            </p>
          )}
          {d.change !== undefined && (
            <p
              className={
                d.change >= 0
                  ? "text-emerald-600 font-medium"
                  : "text-red-500 font-medium"
              }
            >
              {d.change >= 0 ? "+" : ""}
              {formatNumber(d.change, 1)}%
            </p>
          )}
        </div>
      );
    }

    if (isWeightMode) {
      return (
        <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
          <p className="font-semibold text-foreground">{d.name}</p>
          <p className="text-muted-foreground">
            {selectedYear}: {formatNumber(d.percentage, 1)}% (
            {formatNumber(d.amount, 0)} M€)
          </p>
          {hasComparison && d.comparisonPercentage !== undefined && (
            <p className="text-muted-foreground">
              {comparisonYear}: {formatNumber(d.comparisonPercentage, 1)}% (
              {formatNumber(d.comparison ?? 0, 0)} M€)
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
        <p className="font-semibold text-foreground">{d.name}</p>
        <p className="text-muted-foreground">
          {selectedYear}: {formatNumber(d.amount, 0)} M€ (
          {formatNumber(d.percentage, 1)}%)
        </p>
        {hasComparison && d.comparison !== undefined && (
          <p className="text-muted-foreground">
            {comparisonYear}: {formatNumber(d.comparison, 0)} M€ (
            {formatNumber(d.comparisonPercentage ?? 0, 1)}%)
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      {drilldownCategory && (
        <div className="flex items-center gap-2 mb-3 text-sm">
          <button
            type="button"
            onClick={() => onDrilldown(null)}
            className="text-primary hover:underline cursor-pointer"
          >
            Todas las funciones
          </button>
          <span className="text-muted-foreground">&rsaquo;</span>
          <span className="text-foreground font-medium">
            {categories.find((c) => c.code === drilldownCategory)?.name ||
              drilldownCategory}
          </span>
        </div>
      )}

      {hasComparison && !isChangeMode && (
        <div className="flex items-center justify-center gap-5 mb-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[hsl(215,65%,45%)]" />
            {selectedYear}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[hsl(215,65%,45%)] opacity-40" />
            {comparisonYear}
          </span>
          {euroLabel && !isWeightMode && (
            <span className="text-muted-foreground/60">({euroLabel})</span>
          )}
        </div>
      )}
      {isChangeMode && (
        <div className="flex items-center justify-center gap-5 mb-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[hsl(155,55%,40%)]" />
            Aumento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[hsl(0,65%,50%)]" />
            Descenso
          </span>
          {euroLabel && (
            <span className="text-muted-foreground/60">({euroLabel})</span>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={data.length > 6 ? 480 : 400}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <XAxis
            type="number"
            tickFormatter={formatAxis}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            domain={isChangeMode ? ["dataMin", "dataMax"] : undefined}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip content={<CustomTooltip />} />
          {isChangeMode && (
            <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
          )}
          <Bar
            dataKey={primaryKey}
            name={primaryKey}
            radius={[0, 4, 4, 0]}
            cursor={drilldownCategory ? undefined : "pointer"}
            onClick={(entry: ChartDatum) => {
              if (!drilldownCategory && entry?.code) {
                const cat = categories.find((c) => c.code === entry.code);
                if (cat?.children && cat.children.length > 0) {
                  onDrilldown(entry.code);
                }
              }
            }}
          >
            {data.map((entry) => (
              <Cell
                key={entry.code}
                fill={
                  isChangeMode
                    ? (entry.change ?? 0) >= 0
                      ? "hsl(155, 55%, 40%)"
                      : "hsl(0, 65%, 50%)"
                    : getColor(entry.code)
                }
              />
            ))}
          </Bar>
          {hasComparison && !isChangeMode && (
            <Bar
              dataKey={secondaryKey}
              name={secondaryKey}
              radius={[0, 4, 4, 0]}
              fillOpacity={0.4}
            >
              {data.map((entry) => (
                <Cell key={entry.code} fill={getColor(entry.code)} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>

      {!drilldownCategory && (
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
          Haz clic en una barra para ver el desglose por subcategorías
        </p>
      )}
    </div>
  );
}
