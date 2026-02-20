import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SparklineChart } from "../SparklineChart";

vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    AreaChart: ({ children }: any) => (
      <svg data-testid="spark-chart" aria-hidden="true">
        {children}
      </svg>
    ),
  };
});

describe("SparklineChart", () => {
  it("renders correctly with data", () => {
    render(<SparklineChart data={[1, 2, 3]} />);
    expect(screen.getByTestId("spark-chart")).toBeDefined();
  });
});
