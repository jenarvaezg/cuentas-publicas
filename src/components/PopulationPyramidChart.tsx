import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PopulationPyramidData } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { formatNumber } from "@/utils/formatters";

interface PopulationPyramidChartProps {
  data: PopulationPyramidData;
  selectedYear: string;
}

const REGION_KEYS = ["spain", "eu", "restEurope", "africa", "americas", "asiaOceania"] as const;

const REGION_COLORS: Record<string, string> = {
  spain: "#3b82f6",
  eu: "#14b8a6",
  restEurope: "#10b981",
  africa: "#f59e0b",
  americas: "#f43f5e",
  asiaOceania: "#a855f7",
};

interface PyramidDatum {
  ageGroup: string;
  maleSpain: number;
  maleEu: number;
  maleRestEurope: number;
  maleAfrica: number;
  maleAmericas: number;
  maleAsiaOceania: number;
  femaleSpain: number;
  femaleEu: number;
  femaleRestEurope: number;
  femaleAfrica: number;
  femaleAmericas: number;
  femaleAsiaOceania: number;
}

interface PyramidTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    fill: string;
    name: string;
  }>;
  label?: string;
  regionLabels: Record<string, string>;
  maleLabel: string;
  femaleLabel: string;
}

function PyramidTooltip({
  active,
  payload,
  label,
  regionLabels,
  maleLabel,
  femaleLabel,
}: PyramidTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  const maleEntries = payload.filter((p) => p.dataKey.startsWith("male"));
  const femaleEntries = payload.filter((p) => p.dataKey.startsWith("female"));

  const maleTotal = maleEntries.reduce((sum, p) => sum + Math.abs(p.value), 0);
  const femaleTotal = femaleEntries.reduce((sum, p) => sum + p.value, 0);

  const renderGroup = (
    entries: typeof payload,
    total: number,
    groupLabel: string,
    negate: boolean,
  ) => (
    <div className="mt-1">
      <p className="font-medium text-foreground">
        {groupLabel}: {formatNumber(total, 0)}
      </p>
      {entries
        .filter((e) => (negate ? Math.abs(e.value) : e.value) > 0)
        .map((entry) => {
          const regionKey = entry.dataKey.replace("male", "").replace("female", "");
          const regionKeyLower = regionKey.charAt(0).toLowerCase() + regionKey.slice(1);
          const absVal = Math.abs(entry.value);
          const pct = total > 0 ? (absVal / total) * 100 : 0;
          return (
            <p key={entry.dataKey} className="text-muted-foreground text-xs">
              <span
                className="inline-block w-2 h-2 rounded-sm mr-1"
                style={{ backgroundColor: entry.fill }}
              />
              {regionLabels[regionKeyLower] ?? regionKeyLower}: {formatNumber(absVal, 0)} (
              {formatNumber(pct, 1)}%)
            </p>
          );
        })}
    </div>
  );

  return (
    <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm max-w-xs">
      <p className="font-semibold text-foreground">{label}</p>
      {renderGroup(maleEntries, maleTotal, maleLabel, true)}
      {renderGroup(femaleEntries, femaleTotal, femaleLabel, false)}
    </div>
  );
}

export function PopulationPyramidChart({ data, selectedYear }: PopulationPyramidChartProps) {
  const { msg } = useI18n();
  const dm = msg.blocks.demographics;

  const regionLabels: Record<string, string> = useMemo(
    () => ({
      spain: dm.regionSpain,
      eu: dm.regionEU,
      restEurope: dm.regionRestEurope,
      africa: dm.regionAfrica,
      americas: dm.regionAmericas,
      asiaOceania: dm.regionAsiaOceania,
    }),
    [
      dm.regionSpain,
      dm.regionEU,
      dm.regionRestEurope,
      dm.regionAfrica,
      dm.regionAmericas,
      dm.regionAsiaOceania,
    ],
  );

  const chartData = useMemo<PyramidDatum[]>(() => {
    const yearData = data.byYear[selectedYear];
    if (!yearData) return [];

    return data.ageGroups.map((ageGroup, idx) => ({
      ageGroup,
      maleSpain: -(yearData.male.spain[idx] ?? 0),
      maleEu: -(yearData.male.eu[idx] ?? 0),
      maleRestEurope: -(yearData.male.restEurope[idx] ?? 0),
      maleAfrica: -(yearData.male.africa[idx] ?? 0),
      maleAmericas: -(yearData.male.americas[idx] ?? 0),
      maleAsiaOceania: -(yearData.male.asiaOceania[idx] ?? 0),
      femaleSpain: yearData.female.spain[idx] ?? 0,
      femaleEu: yearData.female.eu[idx] ?? 0,
      femaleRestEurope: yearData.female.restEurope[idx] ?? 0,
      femaleAfrica: yearData.female.africa[idx] ?? 0,
      femaleAmericas: yearData.female.americas[idx] ?? 0,
      femaleAsiaOceania: yearData.female.asiaOceania[idx] ?? 0,
    }));
  }, [data.ageGroups, data.byYear, selectedYear]);

  if (chartData.length === 0) return null;

  const legendItems = REGION_KEYS.map((key) => ({
    value: regionLabels[key] ?? key,
    type: "square" as const,
    color: REGION_COLORS[key],
    id: key,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(400, chartData.length * 28)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        stackOffset="sign"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          tickFormatter={(v: number) => {
            const abs = Math.abs(v);
            if (abs >= 1_000_000) return `${formatNumber(abs / 1_000_000, 1)}M`;
            if (abs >= 1_000) return `${formatNumber(abs / 1_000, 0)}k`;
            return formatNumber(abs, 0);
          }}
          tick={{ fontSize: 10 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis
          type="category"
          dataKey="ageGroup"
          width={50}
          tick={{ fontSize: 10 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip
          content={
            <PyramidTooltip
              regionLabels={regionLabels}
              maleLabel={dm.pyramidMale}
              femaleLabel={dm.pyramidFemale}
            />
          }
        />
        <Legend payload={legendItems} />

        {/* Male bars (negative / left side) */}
        <Bar
          dataKey="maleSpain"
          stackId="male"
          fill={REGION_COLORS.spain}
          name={`${dm.pyramidMale} - ${dm.regionSpain}`}
        />
        <Bar
          dataKey="maleEu"
          stackId="male"
          fill={REGION_COLORS.eu}
          name={`${dm.pyramidMale} - ${dm.regionEU}`}
        />
        <Bar
          dataKey="maleRestEurope"
          stackId="male"
          fill={REGION_COLORS.restEurope}
          name={`${dm.pyramidMale} - ${dm.regionRestEurope}`}
        />
        <Bar
          dataKey="maleAfrica"
          stackId="male"
          fill={REGION_COLORS.africa}
          name={`${dm.pyramidMale} - ${dm.regionAfrica}`}
        />
        <Bar
          dataKey="maleAmericas"
          stackId="male"
          fill={REGION_COLORS.americas}
          name={`${dm.pyramidMale} - ${dm.regionAmericas}`}
        />
        <Bar
          dataKey="maleAsiaOceania"
          stackId="male"
          fill={REGION_COLORS.asiaOceania}
          name={`${dm.pyramidMale} - ${dm.regionAsiaOceania}`}
        />

        {/* Female bars (positive / right side) */}
        <Bar
          dataKey="femaleSpain"
          stackId="female"
          fill={REGION_COLORS.spain}
          name={`${dm.pyramidFemale} - ${dm.regionSpain}`}
        />
        <Bar
          dataKey="femaleEu"
          stackId="female"
          fill={REGION_COLORS.eu}
          name={`${dm.pyramidFemale} - ${dm.regionEU}`}
        />
        <Bar
          dataKey="femaleRestEurope"
          stackId="female"
          fill={REGION_COLORS.restEurope}
          name={`${dm.pyramidFemale} - ${dm.regionRestEurope}`}
        />
        <Bar
          dataKey="femaleAfrica"
          stackId="female"
          fill={REGION_COLORS.africa}
          name={`${dm.pyramidFemale} - ${dm.regionAfrica}`}
        />
        <Bar
          dataKey="femaleAmericas"
          stackId="female"
          fill={REGION_COLORS.americas}
          name={`${dm.pyramidFemale} - ${dm.regionAmericas}`}
        />
        <Bar
          dataKey="femaleAsiaOceania"
          stackId="female"
          fill={REGION_COLORS.asiaOceania}
          name={`${dm.pyramidFemale} - ${dm.regionAsiaOceania}`}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
