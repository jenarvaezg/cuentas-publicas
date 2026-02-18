import { useCallback } from "react";
import { useData } from "@/hooks/useData";

export function useDeflator() {
  const { demographics } = useData();
  const cpi = demographics.cpi;

  const deflate = useCallback(
    (amount: number, year: number): number => {
      if (!cpi) return amount;
      const yearIndex = cpi.byYear[String(year)];
      const baseIndex = cpi.byYear[String(cpi.baseYear)];
      if (!yearIndex || !baseIndex) return amount;
      return amount * (baseIndex / yearIndex);
    },
    [cpi],
  );

  return { deflate, baseYear: cpi?.baseYear ?? null, available: !!cpi };
}
