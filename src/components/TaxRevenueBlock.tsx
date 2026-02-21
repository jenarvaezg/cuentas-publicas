import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AEAT_DELEGACIONES, AEAT_SERIES, CALCULO_DERIVADO } from "@/data/sources";
import type {
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

const TAX_COLORS: Record<string, string> = {
  irpf: "hsl(215, 65%, 45%)",
  iva: "hsl(155, 55%, 40%)",
  sociedades: "hsl(30, 75%, 50%)",
  iiee: "hsl(340, 60%, 50%)",
  irnr: "hsl(265, 50%, 55%)",
  resto: "hsl(45, 70%, 50%)",
};

const COLOR_TOP = "hsl(215, 65%, 45%)";
const COLOR_OTHER = "hsl(215, 30%, 65%)";

type TabKey = "nacional" | "ccaa";
type TaxTypeKey = "total" | "irpf" | "iva" | "sociedades" | "iiee" | "irnr";
type DrilldownKey = "iiee" | "resto" | null;

interface NationalBarDatum {
  name: string;
  key: string;
  amount: number;
  percentage: number;
}

interface CcaaBarDatum {
  name: string;
  code: string;
  value: number;
  isTop3: boolean;
}

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

const NationalTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: NationalBarDatum }>;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">
        {formatNumber(d.amount, 0)} M€ ({formatNumber(d.percentage, 1)}%)
      </p>
    </div>
  );
};

const CcaaTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CcaaBarDatum }>;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">{formatNumber(d.value, 0)} M€</p>
    </div>
  );
};

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
    <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
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
  const { taxRevenue, demographics } = useData();
  const { msg, lang } = useI18n();

  const copy =
    lang === "en"
      ? {
          nacional: "National",
          porCcaa: "By region",
          totalRevenue: "Total net revenue",
          largestTax: "Largest tax",
          yearOverYear: "Year-over-year",
          perCapita: "Revenue per capita",
          taxType: "Tax type",
          allTaxes: "All taxes",
          backToOverview: "Back to overview",
          top3: "Top 3",
          restRegions: "Rest of regions",
          foralNote:
            "Navarra and País Vasco have their own tax collection system (foral regime). Amounts shown reflect only the central government share.",
          dataInMillions: "Data in millions of euros",
          netRevenue: "Net revenue (after refunds)",
          ccaaNoData: "CCAA data not available for this year.",
          irpf: "Personal Income Tax (IRPF)",
          iva: "Value Added Tax (VAT)",
          sociedades: "Corporate Tax",
          irnr: "Non-resident Tax (IRNR)",
          iiee: "Excise Duties",
          resto: "Other Taxes",
          alcohol: "Alcohol",
          cerveza: "Beer",
          productosIntermedios: "Intermediate products",
          hidrocarburos: "Hydrocarbons",
          tabaco: "Tobacco",
          electricidad: "Electricity",
          envasesPlastico: "Plastic packaging",
          carbon: "Coal",
          mediosTransporte: "Vehicle registration",
          medioambientales: "Environmental taxes",
          traficoExterior: "External trade",
          primasSeguros: "Insurance premiums",
          transaccionesFinancieras: "Financial transactions",
          serviciosDigitales: "Digital services",
          juego: "Gambling",
          tasas: "Fees and duties",
          derivativePerCapita: "Total tax revenue / population",
          derivativeYoY: "((current year - previous year) / previous year) × 100",
          effectiveRatesTitle: "Effective tax rates by tax (proxy)",
          effectiveRatesSubtitle: "Time series over total net tax revenue",
          effectiveRateIrpf: "IRPF effective rate (proxy)",
          effectiveRateIva: "VAT effective rate (proxy)",
          effectiveRateSociedades: "Corporate tax effective rate (proxy)",
          effectiveRateFormulaIrpf: "IRPF net revenue / total net tax revenue × 100",
          effectiveRateFormulaIva: "VAT net revenue / total net tax revenue × 100",
          effectiveRateFormulaSociedades: "Corporate tax net revenue / total net tax revenue × 100",
          effectiveRateProxyNote:
            "Fiscal proxy: it measures each tax weight within total net revenue, not the legal rate or taxable-base effective rate.",
          noEffectiveRatesData: "No enough years to build effective-rate series.",
        }
      : {
          nacional: "Nacional",
          porCcaa: "Por CCAA",
          totalRevenue: "Recaudación neta total",
          largestTax: "Mayor impuesto",
          yearOverYear: "Variación interanual",
          perCapita: "Recaudación per cápita",
          taxType: "Impuesto",
          allTaxes: "Todos",
          backToOverview: "Volver al resumen",
          top3: "Top 3",
          restRegions: "Resto de CCAA",
          foralNote:
            "Navarra y País Vasco tienen sistema de recaudación propio (régimen foral). Las cifras mostradas reflejan solo la participación estatal.",
          dataInMillions: "Datos en millones de euros",
          netRevenue: "Ingresos netos (tras devoluciones)",
          ccaaNoData: "Datos por CCAA no disponibles para este año.",
          irpf: "IRPF",
          iva: "IVA",
          sociedades: "Impuesto de Sociedades",
          irnr: "IRNR",
          iiee: "Impuestos Especiales",
          resto: "Resto de impuestos",
          alcohol: "Alcohol",
          cerveza: "Cerveza",
          productosIntermedios: "Productos intermedios",
          hidrocarburos: "Hidrocarburos",
          tabaco: "Tabaco",
          electricidad: "Electricidad",
          envasesPlastico: "Envases de plástico",
          carbon: "Carbón",
          mediosTransporte: "Matriculación",
          medioambientales: "Medioambientales",
          traficoExterior: "Tráfico exterior",
          primasSeguros: "Primas de seguros",
          transaccionesFinancieras: "Transacciones financieras",
          serviciosDigitales: "Servicios digitales",
          juego: "Juego",
          tasas: "Tasas y otros",
          derivativePerCapita: "Recaudación total / población",
          derivativeYoY: "((año actual - año anterior) / año anterior) × 100",
          effectiveRatesTitle: "Tipos efectivos por impuesto (proxy)",
          effectiveRatesSubtitle: "Serie temporal sobre recaudación neta total",
          effectiveRateIrpf: "Tipo efectivo IRPF (proxy)",
          effectiveRateIva: "Tipo efectivo IVA (proxy)",
          effectiveRateSociedades: "Tipo efectivo Sociedades (proxy)",
          effectiveRateFormulaIrpf: "IRPF neto / recaudación neta total × 100",
          effectiveRateFormulaIva: "IVA neto / recaudación neta total × 100",
          effectiveRateFormulaSociedades: "Sociedades neto / recaudación neta total × 100",
          effectiveRateProxyNote:
            "Proxy fiscal: mide el peso de cada impuesto dentro de la recaudación neta total, no el tipo legal ni el tipo efectivo sobre base imponible.",
          noEffectiveRatesData:
            "No hay años suficientes para construir la serie de tipos efectivos.",
        };

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

  const [activeTab, setActiveTab] = useState<TabKey>(() => parseTabFromQuery());
  const [selectedTaxType, setSelectedTaxType] = useState<TaxTypeKey>(() => parseTaxTypeFromQuery());
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    parseTaxYearFromQuery(years, latestYear),
  );
  const [drilldown, setDrilldown] = useState<DrilldownKey>(null);

  useEffect(() => {
    updateSearchParams({
      taxTab: activeTab === "nacional" ? null : activeTab,
      taxType: selectedTaxType === "total" ? null : selectedTaxType,
      taxYear: selectedYear === latestYear ? null : String(selectedYear),
    });
  }, [activeTab, selectedTaxType, selectedYear, latestYear]);

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

  const ccaaEntries: TaxRevenueCcaaEntry[] = taxRevenue.ccaa[String(selectedYear)]?.entries ?? [];

  const ccaaChartData = useMemo<CcaaBarDatum[]>(() => {
    if (!ccaaEntries.length) return [];
    const sorted = ccaaEntries
      .map((entry) => ({
        name: entry.name,
        code: entry.code,
        value: selectedTaxType === "total" ? entry.total : (entry[selectedTaxType] ?? 0),
        isTop3: false,
      }))
      .sort((a, b) => b.value - a.value);
    return sorted.map((d, i) => ({ ...d, isTop3: i < 3 }));
  }, [ccaaEntries, selectedTaxType]);

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
    return [Math.min(0, min), max];
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
                  {[...years].reverse().map((y) => (
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
        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={copy.totalRevenue}
            value={formatCompact(totalEuros)}
            delay={0.05}
            sources={[AEAT_SERIES]}
          />
          <StatCard
            label={copy.largestTax}
            value={largestTaxKey ? taxNames[largestTaxKey] : "—"}
            delay={0.1}
            sources={[
              largestTaxKey
                ? {
                    name: formatCompact(
                      ((yearData?.[largestTaxKey as keyof TaxRevenueYearNational] as number) ?? 0) *
                        1_000_000,
                    ),
                  }
                : AEAT_SERIES,
            ]}
          />
          <StatCard
            label={copy.yearOverYear}
            value={
              yoyPercent !== null
                ? `${yoyPercent >= 0 ? "+" : ""}${formatNumber(yoyPercent, 1)}%`
                : "—"
            }
            delay={0.15}
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
            delay={0.2}
            sources={[{ ...CALCULO_DERIVADO, note: copy.derivativePerCapita }, AEAT_SERIES]}
          />
          <StatCard
            label={copy.effectiveRateIrpf}
            value={
              selectedEffectiveRates ? `${formatNumber(selectedEffectiveRates.irpf, 1)}%` : "—"
            }
            delay={0.25}
            sources={[{ ...CALCULO_DERIVADO, note: copy.effectiveRateFormulaIrpf }, AEAT_SERIES]}
          />
          <StatCard
            label={copy.effectiveRateIva}
            value={selectedEffectiveRates ? `${formatNumber(selectedEffectiveRates.iva, 1)}%` : "—"}
            delay={0.3}
            sources={[{ ...CALCULO_DERIVADO, note: copy.effectiveRateFormulaIva }, AEAT_SERIES]}
          />
          <StatCard
            label={copy.effectiveRateSociedades}
            value={
              selectedEffectiveRates
                ? `${formatNumber(selectedEffectiveRates.sociedades, 1)}%`
                : "—"
            }
            delay={0.35}
            sources={[
              { ...CALCULO_DERIVADO, note: copy.effectiveRateFormulaSociedades },
              AEAT_SERIES,
            ]}
          />
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

            {drilldown && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setDrilldown(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  ← {copy.backToOverview}
                </button>
              </div>
            )}

            {activeNationalData.length > 0 ? (
              <ResponsiveContainer width="100%" height={nationalChartHeight}>
                <BarChart
                  data={activeNationalData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => formatNumber(v, 0)}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={190}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip content={<NationalTooltip />} />
                  <Bar
                    dataKey="amount"
                    radius={[0, 4, 4, 0]}
                    cursor={!drilldown ? "pointer" : undefined}
                    onClick={
                      !drilldown
                        ? (data: NationalBarDatum) => {
                            if (data.key === "iiee" && iieeChartData.length > 0) {
                              setDrilldown("iiee");
                            } else if (data.key === "resto" && restoChartData.length > 0) {
                              setDrilldown("resto");
                            }
                          }
                        : undefined
                    }
                  >
                    {activeNationalData.map((entry) => (
                      <Cell key={entry.key} fill={TAX_COLORS[entry.key] ?? TAX_COLORS.resto} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{copy.ccaaNoData}</p>
            )}

            {!drilldown && (
              <p className="text-xs text-muted-foreground/70 text-center mt-1">
                {lang === "en"
                  ? "Click on Excise Duties or Other Taxes bars to see breakdown."
                  : "Haz clic en Impuestos Especiales o Resto para ver el desglose."}
              </p>
            )}
          </div>
        )}

        {/* CCAA tab */}
        {activeTab === "ccaa" && (
          <div className="space-y-4">
            {/* Tax type selector */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="taxrevenue-type"
                className="text-xs text-muted-foreground whitespace-nowrap"
              >
                {copy.taxType}
              </label>
              <select
                id="taxrevenue-type"
                value={selectedTaxType}
                onChange={(e) => setSelectedTaxType(e.target.value as TaxTypeKey)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="total">{copy.allTaxes}</option>
                {(["irpf", "iva", "sociedades", "iiee", "irnr"] as TaxTypeKey[]).map((key) => (
                  <option key={key} value={key}>
                    {taxNames[key]}
                  </option>
                ))}
              </select>
            </div>

            {ccaaChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{copy.ccaaNoData}</p>
            ) : (
              <>
                {/* Legend */}
                <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ background: COLOR_TOP }}
                    />
                    {copy.top3}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ background: COLOR_OTHER }}
                    />
                    {copy.restRegions}
                  </span>
                </div>

                <ResponsiveContainer width="100%" height={ccaaChartHeight}>
                  <BarChart
                    data={ccaaChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      domain={ccaaXDomain}
                      tickFormatter={(v: number) => formatNumber(v, 0)}
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
                    <Tooltip content={<CcaaTooltip />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {ccaaChartData.map((entry) => (
                        <Cell key={entry.code} fill={entry.isTop3 ? COLOR_TOP : COLOR_OTHER} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <p className="text-xs text-muted-foreground/80 text-center">{copy.foralNote}</p>
              </>
            )}
          </div>
        )}

        {/* Footer note */}
        <p className="text-xs text-muted-foreground/80 text-center">
          {copy.netRevenue} —{" "}
          <a
            href={activeTab === "ccaa" ? AEAT_DELEGACIONES.url : AEAT_SERIES.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            {activeTab === "ccaa" ? AEAT_DELEGACIONES.name : AEAT_SERIES.name}
          </a>{" "}
          — {copy.dataInMillions} — {selectedYear}
        </p>
      </CardContent>
    </Card>
  );
}
