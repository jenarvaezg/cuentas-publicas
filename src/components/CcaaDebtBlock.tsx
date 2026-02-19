import { useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/hooks/useData";
import { formatCompact, formatNumber } from "@/utils/formatters";

type MetricKey = "debtToGDP" | "debtAbsolute";

const METRIC_LABELS: Record<MetricKey, string> = {
  debtToGDP: "Deuda/PIB (%)",
  debtAbsolute: "Deuda total (€)",
};

const COLOR_TOP = "hsl(215, 65%, 45%)";
const COLOR_OTHER = "hsl(215, 30%, 65%)";

interface ChartDatum {
  name: string;
  code: string;
  value: number;
  isTop3: boolean;
}

export function CcaaDebtBlock() {
  const { ccaaDebt } = useData();
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("debtToGDP");

  const data = useMemo<ChartDatum[]>(() => {
    const sorted = ccaaDebt.ccaa
      .map((entry) => ({
        name: entry.name,
        code: entry.code,
        value: entry[selectedMetric],
        isTop3: false,
      }))
      .sort((a, b) => b.value - a.value);

    return sorted.map((d, i) => ({ ...d, isTop3: i < 3 }));
  }, [ccaaDebt, selectedMetric]);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ChartDatum }>;
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const formatted =
      selectedMetric === "debtToGDP"
        ? `${formatNumber(d.value, 1)}% del PIB`
        : `${formatCompact(d.value)}`;
    return (
      <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
        <p className="font-semibold text-foreground">{d.name}</p>
        <p className="text-muted-foreground">{formatted}</p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>Deuda por Comunidad Autónoma</CardTitle>
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="ccaa-metric"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              Métrica
            </label>
            <select
              id="ccaa-metric"
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {(Object.entries(METRIC_LABELS) as [MetricKey, string][]).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_TOP }} />
            Top 3
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_OTHER }} />
            Resto de CCAA
          </span>
          {selectedMetric === "debtToGDP" && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-muted-foreground" />
              Total nacional
            </span>
          )}
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={480}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <XAxis
              type="number"
              tickFormatter={
                selectedMetric === "debtToGDP"
                  ? (v: number) => `${formatNumber(v, 1)}%`
                  : (v: number) => formatCompact(v)
              }
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<CustomTooltip />} />
            {selectedMetric === "debtToGDP" && (
              <ReferenceLine
                x={ccaaDebt.total.debtToGDP}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{
                  value: `Total: ${formatNumber(ccaaDebt.total.debtToGDP, 1)}%`,
                  position: "top",
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
            )}
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell key={entry.code} fill={entry.isTop3 ? COLOR_TOP : COLOR_OTHER} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <p className="text-[10px] text-muted-foreground/70 text-center">
          Datos del{" "}
          <a
            href="https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be1310.csv"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Banco de España
          </a>{" "}
          — {ccaaDebt.quarter}
        </p>
      </CardContent>
    </Card>
  );
}
