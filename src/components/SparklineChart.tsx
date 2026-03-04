import { memo, useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface SparklineChartProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  placeholder?: boolean;
}

export const SparklineChart = memo(function SparklineChart({
  data,
  color = "hsl(var(--primary))",
  width = 120,
  height = 40,
  placeholder = false,
}: SparklineChartProps) {
  const gradientId = useId();
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={placeholder ? 0.16 : 0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={placeholder ? 1.6 : 2}
          strokeOpacity={placeholder ? 0.7 : 1}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
          style={{ filter: placeholder ? "none" : `drop-shadow(0 0 6px ${color})` }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});
