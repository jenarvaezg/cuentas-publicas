import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AEAT_DELEGACIONES,
  AEAT_SERIES,
  CALCULO_DERIVADO,
  HACIENDA_CCAA_FINANCIACION,
} from "@/data/sources";
import type {
  CcaaFiscalBalanceEntry,
  IIEEBreakdown,
  RestoBreakdown,
  TaxRevenueCcaaEntry,
  TaxRevenueYearNational,
} from "@/data/types";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber } from "@/utils/formatters";
import { getSearchParam, updateSearchParams } from "@/utils/url-state";
import { ExportBlockButton } from "./ExportBlockButton";
import { StatCard } from "./StatCard";
import {
  type BalanceMetricKey,
  type CcaaBarDatum,
  type CcaaModeKey,
  CcaaTaxTab,
  type TaxTypeKey,
} from "./tax-revenue/CcaaTaxTab";
import { type NationalBarDatum, NationalTaxChart } from "./tax-revenue/NationalTaxChart";

const TAX_COLORS: Record<string, string> = {
  irpf: "hsl(215, 65%, 45%)",
  iva: "hsl(155, 55%, 40%)",
  sociedades: "hsl(30, 75%, 50%)",
  iiee: "hsl(340, 60%, 50%)",
  irnr: "hsl(265, 50%, 55%)",
  resto: "hsl(45, 70%, 50%)",
};

type TabKey = "nacional" | "ccaa";
type DrilldownKey = "iiee" | "resto" | null;

interface EffectiveRateDatum {
  year: number;
  irpf: number;
  iva: number;
  sociedades: number;
}

function parseTabFromQuery(): TabKey {
  const param = getSearchParam("taxTab");
  return param === "ccaa" ? "ccaa" : "nacional";
}

function parseTaxTypeFromQuery(): TaxTypeKey {
  const allowed: TaxTypeKey[] = ["total", "irpf", "iva", "sociedades", "iiee", "irnr"];
  const param = getSearchParam("taxType") as TaxTypeKey | null;
  return param && allowed.includes(param) ? param : "total";
}

function parseTaxYearFromQuery(years: number[], latestYear: number): number {
  const param = getSearchParam("taxYear");
  if (!param) return latestYear;
  const n = Number(param);
  return years.includes(n) ? n : latestYear;
}

function parseCcaaModeFromQuery(): CcaaModeKey {
  return getSearchParam("taxCcaaMode") === "balance" ? "balance" : "aeat";
}

function parseCcaaBalanceMetricFromQuery(): BalanceMetricKey {
  const allowed: BalanceMetricKey[] = ["netBalance", "cededTaxes", "transfers"];
  const param = getSearchParam("taxCcaaMetric") as BalanceMetricKey | null;
  return param && allowed.includes(param) ? param : "netBalance";
}

const EffectiveRateTooltip = ({
  active,
  payload,
  label,
  irpfLabel,
  ivaLabel,
  sociedadesLabel,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: number;
  irpfLabel: string;
  ivaLabel: string;
  sociedadesLabel: string;
}) => {
  if (!active || !payload?.length || !label) return null;
  const irpf = payload.find((p) => p.dataKey === "irpf")?.value ?? 0;
  const iva = payload.find((p) => p.dataKey === "iva")?.value ?? 0;
  const sociedades = payload.find((p) => p.dataKey === "sociedades")?.value ?? 0;
  return (
    <div className="bg-popover/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">
        {irpfLabel}: {formatNumber(irpf, 1)}%
      </p>
      <p className="text-muted-foreground">
        {ivaLabel}: {formatNumber(iva, 1)}%
      </p>
      <p className="text-muted-foreground">
        {sociedadesLabel}: {formatNumber(sociedades, 1)}%
      </p>
    </div>
  );
};

export function TaxRevenueBlock() {
  const { taxRevenue, demographics, ccaaFiscalBalance } = useData();
  const { msg, lang } = useI18n();

  const copy = msg.blocks.taxRevenue;

  const taxNames = useMemo<Record<string, string>>(
    () => ({
      irpf: copy.irpf,
      iva: copy.iva,
      sociedades: copy.sociedades,
      irnr: copy.irnr,
      iiee: copy.iiee,
      resto: copy.resto,
    }),
    [copy.irpf, copy.iva, copy.sociedades, copy.irnr, copy.iiee, copy.resto],
  );

  const { years, latestYear } = taxRevenue;
  const balanceYears = ccaaFiscalBalance?.years ?? [];
  const latestBalanceYear = ccaaFiscalBalance?.latestYear ?? balanceYears[balanceYears.length - 1];

  const [activeTab, setActiveTab] = useState<TabKey>(() => parseTabFromQuery());
  const [selectedTaxType, setSelectedTaxType] = useState<TaxTypeKey>(() => parseTaxTypeFromQuery());
  const [ccaaMode, setCcaaMode] = useState<CcaaModeKey>(() => parseCcaaModeFromQuery());
  const [selectedBalanceMetric, setSelectedBalanceMetric] = useState<BalanceMetricKey>(() =>
    parseCcaaBalanceMetricFromQuery(),
  );
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    parseTaxYearFromQuery(years, latestYear),
  );
  const [drilldown, setDrilldown] = useState<DrilldownKey>(null);

  const yearOptions = useMemo<number[]>(() => {
    if (activeTab === "ccaa" && ccaaMode === "balance") return balanceYears;
    return years;
  }, [activeTab, ccaaMode, balanceYears, years]);

  const defaultYearForMode = useMemo<number>(() => {
    if (activeTab === "ccaa" && ccaaMode === "balance") {
      return latestBalanceYear ?? latestYear;
    }
    return latestYear;
  }, [activeTab, ccaaMode, latestBalanceYear, latestYear]);

  useEffect(() => {
    if (yearOptions.length === 0) return;
    if (!yearOptions.includes(selectedYear)) {
      setSelectedYear(defaultYearForMode);
      setDrilldown(null);
    }
  }, [yearOptions, selectedYear, defaultYearForMode]);

  useEffect(() => {
    updateSearchParams({
      taxTab: activeTab === "nacional" ? null : activeTab,
      taxType: selectedTaxType === "total" ? null : selectedTaxType,
      taxCcaaMode: ccaaMode === "aeat" ? null : ccaaMode,
      taxCcaaMetric: selectedBalanceMetric === "netBalance" ? null : selectedBalanceMetric,
      taxYear: selectedYear === defaultYearForMode ? null : String(selectedYear),
    });
  }, [
    activeTab,
    selectedTaxType,
    ccaaMode,
    selectedBalanceMetric,
    selectedYear,
    defaultYearForMode,
  ]);

  const yearData: TaxRevenueYearNational | undefined = taxRevenue.national[String(selectedYear)];
  const prevYearData: TaxRevenueYearNational | undefined =
    taxRevenue.national[String(selectedYear - 1)];

  // ── Stat card derived values ─────────────────────────────────────────────────

  const totalEuros = yearData ? yearData.total * 1_000_000 : 0;

  const largestTaxKey = useMemo<string | null>(() => {
    if (!yearData) return null;
    const keys: Array<keyof typeof TAX_COLORS> = [
      "irpf",
      "iva",
      "sociedades",
      "iiee",
      "irnr",
      "resto",
    ];
    return keys.reduce((max, key) =>
      (yearData[key as keyof TaxRevenueYearNational] as number) >
      (yearData[max as keyof TaxRevenueYearNational] as number)
        ? key
        : max,
    );
  }, [yearData]);

  const largestTaxAmount = useMemo<number>(() => {
    if (!yearData || !largestTaxKey) return 0;
    return ((yearData[largestTaxKey as keyof TaxRevenueYearNational] as number) ?? 0) * 1_000_000;
  }, [yearData, largestTaxKey]);

  const yoyPercent = useMemo<number | null>(() => {
    if (!yearData || !prevYearData || !prevYearData.total) return null;
    return ((yearData.total - prevYearData.total) / prevYearData.total) * 100;
  }, [yearData, prevYearData]);

  const perCapita = useMemo<number>(() => {
    if (!demographics.population || !totalEuros) return 0;
    return totalEuros / demographics.population;
  }, [totalEuros, demographics.population]);

  const selectedEffectiveRates = useMemo(() => {
    if (!yearData || !yearData.total) return null;
    return {
      irpf: (yearData.irpf / yearData.total) * 100,
      iva: (yearData.iva / yearData.total) * 100,
      sociedades: (yearData.sociedades / yearData.total) * 100,
    };
  }, [yearData]);

  const effectiveRatesSeries = useMemo<EffectiveRateDatum[]>(() => {
    return years
      .map((year) => {
        const data = taxRevenue.national[String(year)];
        if (!data || !data.total) return null;
        return {
          year,
          irpf: (data.irpf / data.total) * 100,
          iva: (data.iva / data.total) * 100,
          sociedades: (data.sociedades / data.total) * 100,
        };
      })
      .filter((item): item is EffectiveRateDatum => item !== null);
  }, [years, taxRevenue.national]);

  // ── National chart data ──────────────────────────────────────────────────────

  const nationalChartData = useMemo<NationalBarDatum[]>(() => {
    if (!yearData) return [];
    const total = yearData.total || 1;
    const keys: Array<keyof typeof TAX_COLORS> = [
      "irpf",
      "iva",
      "sociedades",
      "iiee",
      "irnr",
      "resto",
    ];
    return keys
      .map((key) => ({
        name: taxNames[key],
        key,
        amount: (yearData[key as keyof TaxRevenueYearNational] as number) ?? 0,
        percentage:
          (((yearData[key as keyof TaxRevenueYearNational] as number) ?? 0) / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [yearData, taxNames]);

  const iieeChartData = useMemo<NationalBarDatum[]>(() => {
    const breakdown = yearData?.iieeBreakdown;
    if (!breakdown) return [];
    const total = yearData?.total || 1;
    const keys: Array<keyof IIEEBreakdown> = [
      "alcohol",
      "cerveza",
      "productosIntermedios",
      "hidrocarburos",
      "tabaco",
      "electricidad",
      "envasesPlastico",
      "carbon",
      "mediosTransporte",
    ];
    return keys
      .map((key) => ({
        name: copy[key as keyof typeof copy] as string,
        key,
        amount: breakdown[key] ?? 0,
        percentage: ((breakdown[key] ?? 0) / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [yearData, copy]);

  const restoChartData = useMemo<NationalBarDatum[]>(() => {
    const breakdown = yearData?.restoBreakdown;
    if (!breakdown) return [];
    const total = yearData?.total || 1;
    const keys: Array<keyof RestoBreakdown> = [
      "medioambientales",
      "traficoExterior",
      "primasSeguros",
      "transaccionesFinancieras",
      "serviciosDigitales",
      "juego",
      "tasas",
    ];
    return keys
      .map((key) => ({
        name: copy[key as keyof typeof copy] as string,
        key,
        amount: breakdown[key] ?? 0,
        percentage: ((breakdown[key] ?? 0) / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [yearData, copy]);

  // ── CCAA chart data ──────────────────────────────────────────────────────────

  const ccaaRevenueEntries: TaxRevenueCcaaEntry[] =
    taxRevenue.ccaa[String(selectedYear)]?.entries ?? [];
  const ccaaBalanceEntries: CcaaFiscalBalanceEntry[] =
    ccaaFiscalBalance?.byYear?.[String(selectedYear)]?.entries ?? [];

  const ccaaMetricLabel = useMemo(() => {
    if (ccaaMode === "aeat") {
      return selectedTaxType === "total"
        ? copy.netRevenue
        : (taxNames[selectedTaxType] ?? copy.netRevenue);
    }
    if (selectedBalanceMetric === "cededTaxes") return copy.balanceCeded;
    if (selectedBalanceMetric === "transfers") return copy.balanceTransfers;
    return copy.balanceNet;
  }, [ccaaMode, selectedTaxType, selectedBalanceMetric, copy, taxNames]);

  const ccaaChartData = useMemo<CcaaBarDatum[]>(() => {
    const base =
      ccaaMode === "aeat"
        ? ccaaRevenueEntries.map((entry) => ({
            name: entry.name,
            code: entry.code,
            value: selectedTaxType === "total" ? entry.total : (entry[selectedTaxType] ?? 0),
          }))
        : ccaaBalanceEntries.map((entry) => ({
            name: entry.name,
            code: entry.code,
            value: entry[selectedBalanceMetric],
          }));
    if (!base.length) return [];
    const sorted = base
      .map((entry) => ({ ...entry, isTop3: false }))
      .sort((a, b) => b.value - a.value);
    return sorted.map((d, i) => ({ ...d, isTop3: i < 3 }));
  }, [ccaaMode, ccaaRevenueEntries, ccaaBalanceEntries, selectedTaxType, selectedBalanceMetric]);

  // ── Active chart data (drilldown or top-level) ───────────────────────────────

  const activeNationalData: NationalBarDatum[] =
    drilldown === "iiee"
      ? iieeChartData
      : drilldown === "resto"
        ? restoChartData
        : nationalChartData;

  const nationalChartHeight = Math.max(180, activeNationalData.length * 44);
  const ccaaChartHeight = Math.max(300, ccaaChartData.length * 26);

  // Explicit domain prevents Recharts nice() from rounding a small negative
  // (e.g. Navarra -50) down to -35,000 while the max is ~100,000.
  const ccaaXDomain = useMemo<[number, number]>(() => {
    if (!ccaaChartData.length) return [0, 0];
    const values = ccaaChartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return [Math.min(0, min), Math.max(0, max)];
  }, [ccaaChartData]);

  // ── Tab toggle ───────────────────────────────────────────────────────────────

  const TabButton = ({ tab, label }: { tab: TabKey; label: string }) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
        activeTab === tab
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>{msg.blocks.taxRevenue.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              {/* Tab toggle */}
              <div className="flex items-center rounded-md border border-input bg-background p-0.5">
                <TabButton tab="nacional" label={copy.nacional} />
                <TabButton tab="ccaa" label={copy.porCcaa} />
              </div>

              {/* Year selector */}
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="taxrevenue-year"
                  className="text-xs text-muted-foreground whitespace-nowrap"
                >
                  {msg.common.year}
                </label>
                <select
                  id="taxrevenue-year"
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value));
                    setDrilldown(null);
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {[...yearOptions].reverse().map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <ExportBlockButton
                targetId="recaudacion"
                filenamePrefix="cuentas-publicas-recaudacion"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {copy.snapshotTitle} · {selectedYear}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={copy.totalRevenue}
              value={formatCompact(totalEuros)}
              tooltip={copy.totalRevenueTooltip}
              delay={0.05}
              className="md:col-span-2 lg:col-span-2"
              sources={[AEAT_SERIES]}
            />
            <StatCard
              label={copy.yearOverYear}
              value={
                yoyPercent !== null
                  ? `${yoyPercent >= 0 ? "+" : ""}${formatNumber(yoyPercent, 1)}%`
                  : "—"
              }
              tooltip={copy.yearOverYearTooltip}
              delay={0.1}
              className={
                yoyPercent !== null
                  ? yoyPercent >= 0
                    ? "border-emerald-500/30"
                    : "border-rose-500/30"
                  : undefined
              }
              sources={[{ ...CALCULO_DERIVADO, note: copy.derivativeYoY }]}
            />
            <StatCard
              label={copy.perCapita}
              value={perCapita > 0 ? `${formatNumber(perCapita, 0)} €` : "—"}
              tooltip={copy.perCapitaTooltip}
              delay={0.15}
              sources={[{ ...CALCULO_DERIVADO, note: copy.derivativePerCapita }, AEAT_SERIES]}
            />
          </div>
          <p className="text-xs text-muted-foreground/80">
            {copy.largestTax}:{" "}
            <span className="font-medium text-foreground">
              {largestTaxKey ? taxNames[largestTaxKey] : "—"}
            </span>
            {largestTaxKey && largestTaxAmount > 0 && (
              <span> · {formatCompact(largestTaxAmount)}</span>
            )}
          </p>
        </div>

        {/* Nacional tab */}
        {activeTab === "nacional" && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-1 text-center">
                {copy.effectiveRatesTitle}
              </h3>
              <p className="text-xs text-muted-foreground/80 text-center mb-3">
                {copy.effectiveRatesSubtitle}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <StatCard
                  label={copy.effectiveRateIrpf}
                  value={
                    selectedEffectiveRates
                      ? `${formatNumber(selectedEffectiveRates.irpf, 1)}%`
                      : "—"
                  }
                  tooltip={copy.effectiveRateIrpfTooltip}
                  delay={0.2}
                  sources={[
                    {
                      ...CALCULO_DERIVADO,
                      note: copy.effectiveRateFormulaIrpf,
                    },
                    AEAT_SERIES,
                  ]}
                />
                <StatCard
                  label={copy.effectiveRateIva}
                  value={
                    selectedEffectiveRates ? `${formatNumber(selectedEffectiveRates.iva, 1)}%` : "—"
                  }
                  tooltip={copy.effectiveRateIvaTooltip}
                  delay={0.25}
                  sources={[
                    { ...CALCULO_DERIVADO, note: copy.effectiveRateFormulaIva },
                    AEAT_SERIES,
                  ]}
                />
                <StatCard
                  label={copy.effectiveRateSociedades}
                  value={
                    selectedEffectiveRates
                      ? `${formatNumber(selectedEffectiveRates.sociedades, 1)}%`
                      : "—"
                  }
                  tooltip={copy.effectiveRateSociedadesTooltip}
                  delay={0.3}
                  sources={[
                    {
                      ...CALCULO_DERIVADO,
                      note: copy.effectiveRateFormulaSociedades,
                    },
                    AEAT_SERIES,
                  ]}
                />
              </div>
              {effectiveRatesSeries.length > 1 ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={effectiveRatesSeries}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <XAxis
                        dataKey="year"
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tickFormatter={(v: number) => `${formatNumber(v, 0)}%`}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        content={
                          <EffectiveRateTooltip
                            irpfLabel={copy.irpf}
                            ivaLabel={copy.iva}
                            sociedadesLabel={copy.sociedades}
                          />
                        }
                      />
                      <Bar dataKey="irpf" fill={TAX_COLORS.irpf} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="iva" fill={TAX_COLORS.iva} radius={[3, 3, 0, 0]} />
                      <Bar
                        dataKey="sociedades"
                        fill={TAX_COLORS.sociedades}
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground mt-2">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ background: TAX_COLORS.irpf }}
                      />
                      {copy.irpf}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ background: TAX_COLORS.iva }}
                      />
                      {copy.iva}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ background: TAX_COLORS.sociedades }}
                      />
                      {copy.sociedades}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground/80 text-center mt-2">
                    {copy.effectiveRateProxyNote}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {copy.noEffectiveRatesData}
                </p>
              )}
            </div>

            <NationalTaxChart
              data={activeNationalData}
              height={nationalChartHeight}
              drilldown={drilldown}
              iieeData={iieeChartData}
              restoData={restoChartData}
              onBarClick={(data) => {
                if (data.key === "iiee" && iieeChartData.length > 0) {
                  setDrilldown("iiee");
                } else if (data.key === "resto" && restoChartData.length > 0) {
                  setDrilldown("resto");
                }
              }}
              onBackToOverview={() => setDrilldown(null)}
              backToOverviewLabel={copy.backToOverview}
              noDataLabel={copy.ccaaNoData}
              clickHintLabel={
                lang === "en"
                  ? "Click on Excise Duties or Other Taxes bars to see breakdown."
                  : "Haz clic en Impuestos Especiales o Resto para ver el desglose."
              }
              lang={lang}
            />
          </div>
        )}

        {/* CCAA tab */}
        {activeTab === "ccaa" && (
          <CcaaTaxTab
            data={ccaaChartData}
            chartHeight={ccaaChartHeight}
            xDomain={ccaaXDomain}
            ccaaMode={ccaaMode}
            selectedTaxType={selectedTaxType}
            selectedBalanceMetric={selectedBalanceMetric}
            metricLabel={ccaaMetricLabel}
            taxNames={taxNames}
            onCcaaModeChange={setCcaaMode}
            onTaxTypeChange={setSelectedTaxType}
            onBalanceMetricChange={setSelectedBalanceMetric}
            copy={{
              ccaaMode: copy.ccaaMode,
              ccaaModeAeat: copy.ccaaModeAeat,
              ccaaModeBalance: copy.ccaaModeBalance,
              taxType: copy.taxType,
              allTaxes: copy.allTaxes,
              balanceMetric: copy.balanceMetric,
              balanceNet: copy.balanceNet,
              balanceCeded: copy.balanceCeded,
              balanceTransfers: copy.balanceTransfers,
              top3: copy.top3,
              restRegions: copy.restRegions,
              balancePositive: copy.balancePositive,
              balanceNegative: copy.balanceNegative,
              ccaaNoData: copy.ccaaNoData,
              balanceNoData: copy.balanceNoData,
              foralNote: copy.foralNote,
              balanceCoverageNote: copy.balanceCoverageNote,
              balanceFormulaNote: copy.balanceFormulaNote,
            }}
          />
        )}

        {/* Footer note */}
        <p className="text-xs text-muted-foreground/80 text-center">
          {activeTab === "ccaa" && ccaaMode === "balance" ? copy.balanceMetric : copy.netRevenue} —{" "}
          <a
            href={
              activeTab === "ccaa"
                ? ccaaMode === "balance"
                  ? HACIENDA_CCAA_FINANCIACION.url
                  : AEAT_DELEGACIONES.url
                : AEAT_SERIES.url
            }
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            {activeTab === "ccaa"
              ? ccaaMode === "balance"
                ? HACIENDA_CCAA_FINANCIACION.name
                : AEAT_DELEGACIONES.name
              : AEAT_SERIES.name}
          </a>{" "}
          — {copy.dataInMillions} — {selectedYear}
        </p>
      </CardContent>
    </Card>
  );
}
