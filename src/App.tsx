import { lazy, Suspense, useEffect, useMemo } from "react";
import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { OfflineStatus } from "@/components/OfflineStatus";
import { RealtimeCounter } from "@/components/RealtimeCounter";
import { SectionNav, type SectionNavGroup } from "@/components/SectionNav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BDE_BE11B, CALCULO_DERIVADO, SS_NOMINA } from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatDate, formatNumber } from "@/utils/formatters";
import { getSearchParam } from "@/utils/url-state";

/* Lazy-loaded sections — each becomes its own chunk, fetched on first render */
const namedLazy = <T extends Record<string, React.ComponentType>>(
  factory: () => Promise<T>,
  name: keyof T,
) => lazy(() => factory().then((m) => ({ default: m[name] })));

const BudgetBlock = namedLazy(() => import("@/components/BudgetBlock"), "BudgetBlock");
const CcaaDebtBlock = namedLazy(() => import("@/components/CcaaDebtBlock"), "CcaaDebtBlock");
const ComparativaEUBlock = namedLazy(
  () => import("@/components/ComparativaEUBlock"),
  "ComparativaEUBlock",
);
const DebtBlock = namedLazy(() => import("@/components/DebtBlock"), "DebtBlock");
const DebtImplicationsBlock = namedLazy(
  () => import("@/components/DebtImplicationsBlock"),
  "DebtImplicationsBlock",
);
const DemographicsBlock = namedLazy(
  () => import("@/components/DemographicsBlock"),
  "DemographicsBlock",
);
const FlowsSankeyBlock = namedLazy(
  () => import("@/components/FlowsSankeyBlock"),
  "FlowsSankeyBlock",
);
const MethodologySection = namedLazy(
  () => import("@/components/MethodologySection"),
  "MethodologySection",
);
const PensionsBlock = namedLazy(() => import("@/components/PensionsBlock"), "PensionsBlock");
const RevenueDashboardBlock = namedLazy(
  () => import("@/components/RevenueDashboardBlock"),
  "RevenueDashboardBlock",
);
const SustainabilityBlock = namedLazy(
  () => import("@/components/SustainabilityBlock"),
  "SustainabilityBlock",
);

const SECTION_IDS = [
  "resumen",
  "mapa-fiscal",
  "ingresos-gastos",
  "gasto-cofog",
  "demografia",
  "pensiones",
  "sostenibilidad-ss",
  "deuda",
  "coste-deuda",
  "ccaa",
  "ue",
  "metodologia",
] as const;

const SECTION_ALIASES: Record<string, (typeof SECTION_IDS)[number]> = {
  recaudacion: "ingresos-gastos",
  "economia-social": "ingresos-gastos",
};

function ChapterDivider({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pt-3">
      <p className="text-xs font-semibold tracking-[0.1em] uppercase text-muted-foreground">
        {title}
      </p>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function NarrativeBridge({ title, text }: { title?: string; text: string }) {
  return (
    <FadeIn delay={0.1} className="max-w-3xl mx-auto text-center py-6 px-4">
      {title && <h3 className="text-lg font-medium text-foreground mb-3">{title}</h3>}
      <p className="text-base text-muted-foreground leading-relaxed balance-text text-pretty">
        {text}
      </p>
    </FadeIn>
  );
}

function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-6 bg-muted rounded w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-32 bg-muted rounded-xl" />
      </div>
    </div>
  );
}

function App() {
  const { msg } = useI18n();

  useDocumentMeta(msg.app.pageTitle, msg.app.pageDescription);

  const { debt, pensions } = useData();

  const chapterCopy = msg.chapters;

  const sectionGroups = useMemo<SectionNavGroup[]>(
    () => [
      {
        id: "c1-balance",
        label: chapterCopy.c1.navLabel,
        items: [
          { id: "resumen", label: msg.sections.resumen },
          {
            id: "mapa-fiscal",
            label: msg.sections.mapaFiscal,
          },
        ],
      },
      {
        id: "c2-recaudacion",
        label: chapterCopy.c2.navLabel,
        items: [
          { id: "ingresos-gastos", label: msg.sections.ingresosGastos },
          { id: "gasto-cofog", label: msg.sections.gastoCofog },
        ],
      },
      {
        id: "c3-demografia",
        label: chapterCopy.c3.navLabel,
        items: [
          { id: "demografia", label: msg.sections.demografia },
          { id: "pensiones", label: msg.sections.pensiones },
          { id: "sostenibilidad-ss", label: msg.sections.sostenibilidadSS },
        ],
      },
      {
        id: "c4-hipoteca",
        label: chapterCopy.c4.navLabel,
        items: [
          { id: "deuda", label: msg.sections.deuda },
          { id: "coste-deuda", label: msg.sections.costeDeuda },
        ],
      },
      {
        id: "c5-territorio",
        label: chapterCopy.c5.navLabel,
        items: [
          { id: "ccaa", label: msg.sections.ccaa },
          { id: "ue", label: msg.sections.ue },
          { id: "metodologia", label: msg.sections.metodologia },
        ],
      },
    ],
    [chapterCopy, msg.sections],
  );

  const currentDebt = debt.regression.intercept + debt.regression.slope * Date.now();
  const debtPerSecond = debt.regression.debtPerSecond;

  const deficitPerSecond = pensions.current.contributoryDeficit / (365.25 * 86_400);

  // Cumulative deficit since 2009 (base − time elapsed since baseDate)
  // base is negative, deficitPerSecond is positive (annual deficit as absolute value),
  // so we subtract to make the cumulative grow more negative over time.
  const cumDef = pensions.current.cumulativeDeficit;
  const cumulativeBase = cumDef
    ? cumDef.base - deficitPerSecond * ((Date.now() - new Date(cumDef.baseDate).getTime()) / 1000)
    : 0;

  const lastDebtDate =
    debt.historical.length > 0
      ? formatDate(debt.historical[debt.historical.length - 1].date)
      : msg.common.notAvailable;
  const pensionDate = formatDate(pensions.lastUpdated);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawSection = getSearchParam("section");
    const section = rawSection ? (SECTION_ALIASES[rawSection] ?? rawSection) : rawSection;
    const isValidSection = SECTION_IDS.some((item) => item === section);
    if (!section || !isValidSection || section === "resumen") return;

    const url = new URL(window.location.href);
    if (url.hash !== `#${section}`) {
      url.hash = section;
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }

    const sectionElement = document.getElementById(section);
    sectionElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <OfflineStatus />
        <Header />
        <SectionNav groups={sectionGroups} />

        <main className="w-full max-w-[95vw] 2xl:max-w-[1600px] mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-12">
          <section id="resumen" className="scroll-mt-28 relative">
            {/* Background Glows for the hero section */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-chart-2/10 rounded-full blur-3xl pointer-events-none -z-10" />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
              <FadeIn delay={0.1} className="lg:col-span-3">
                <div className="h-full p-8 md:p-10 border border-white/10 rounded-2xl bg-card/60 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center gap-4 hover:shadow-primary/5 transition-[box-shadow,transform] duration-500 hover:-translate-y-1 cursor-default relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="text-sm font-bold text-muted-foreground mb-2 uppercase tracking-[0.15em] relative z-10 w-full text-center">
                    {msg.app.debtSummaryLabel}
                  </div>
                  <RealtimeCounter
                    baseValue={currentDebt}
                    perSecond={debtPerSecond}
                    suffix=" €"
                    size="xl"
                    label=""
                    className="relative z-10 text-primary"
                  />
                  <p className="text-sm text-muted-foreground text-center relative z-10 mt-4 max-w-md">
                    {msg.app.debtSummaryNotePrefix}{" "}
                    <a
                      href={BDE_BE11B.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground font-medium transition-colors"
                    >
                      BdE be11b.csv
                    </a>{" "}
                    <br className="hidden sm:block" />
                    <span className="opacity-70">
                      ({msg.app.debtSummaryNoteSuffix} {lastDebtDate})
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 text-center relative z-10">
                    {msg.app.counterDisclaimer}
                  </p>
                </div>
              </FadeIn>

              {/* Deficit Summary (col-span-2) */}
              <FadeIn delay={0.2} className="lg:col-span-2">
                <div className="h-full p-8 md:p-10 border border-white/10 rounded-2xl bg-card/60 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-between gap-4 hover:shadow-chart-2/5 transition-[box-shadow,transform] duration-500 hover:-translate-y-1 cursor-default relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-chart-2/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="text-sm font-bold text-muted-foreground mb-2 uppercase tracking-[0.15em] relative z-10 w-full text-center">
                    {msg.app.deficitSummaryLabel}
                  </div>
                  <RealtimeCounter
                    baseValue={cumulativeBase}
                    perSecond={-deficitPerSecond}
                    suffix=" €"
                    size="lg"
                    decimals={0}
                    label=""
                    className="relative z-10 text-destructive"
                  />
                  <p className="text-sm text-muted-foreground text-center relative z-10">
                    {msg.app.deficitSummarySince}{" "}
                    <span className="font-semibold text-foreground">
                      {formatCompact(pensions.current.contributoryDeficit)}
                    </span>
                    {msg.app.perYear} ( {formatNumber(deficitPerSecond, 2)} €/s)
                  </p>
                  <div className="w-full border-t border-border/50 pt-4 mt-2 flex flex-col items-center gap-1 relative z-10">
                    <div className="text-base font-bold tabular-nums text-foreground">
                      {formatCompact(pensions.current.contributoryDeficit)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {msg.app.annualDeficit}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 text-center relative z-10 mt-2">
                    Eurostat gov_10a_main (S1314) —{" "}
                    <a
                      href={SS_NOMINA.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground transition-colors"
                    >
                      {CALCULO_DERIVADO.name}
                    </a>{" "}
                    ({pensionDate})
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 text-center relative z-10">
                    {msg.app.counterDisclaimer}
                  </p>
                </div>
              </FadeIn>
            </div>
          </section>

          {/* CHAPTER 1: EL GRAN BALANCE */}
          <section className="space-y-6">
            <ChapterDivider title={chapterCopy.c1.title} subtitle={chapterCopy.c1.subtitle} />
            {/* The wrapper that makes it edge-to-edge goes here for the Sankey */}
            <section
              id="mapa-fiscal"
              className="scroll-mt-28 w-screen relative left-1/2 right-1/2 -mx-[50vw] bg-card/10 backdrop-blur-3xl border-y border-white/5 py-12 mt-8 shadow-2xl"
            >
              <Suspense fallback={<SectionSkeleton />}>
                <FadeIn delay={0.2}>
                  <div className="w-full max-w-[95vw] 2xl:max-w-[1600px] mx-auto px-4 lg:px-8">
                    <FlowsSankeyBlock />
                  </div>
                </FadeIn>
              </Suspense>
            </section>
          </section>

          {/* CHAPTER 2: LA MAQUINA DE RECAUDAR */}
          <section className="space-y-6 pt-8">
            <ChapterDivider title={chapterCopy.c2.title} subtitle={chapterCopy.c2.subtitle} />

            <NarrativeBridge
              title={msg.narrativeBridges.eurostatVsAeatTitle}
              text={msg.narrativeBridges.eurostatVsAeatText}
            />

            <section id="ingresos-gastos" className="scroll-mt-28">
              <Suspense fallback={<SectionSkeleton />}>
                <FadeIn delay={0.1}>
                  <RevenueDashboardBlock />
                </FadeIn>
              </Suspense>
            </section>
            <section id="gasto-cofog" className="scroll-mt-28">
              <Suspense fallback={<SectionSkeleton />}>
                <FadeIn delay={0.2}>
                  <BudgetBlock />
                </FadeIn>
              </Suspense>
            </section>
          </section>

          {/* CHAPTER 3: EL INVIERNO DEMOGRAFICO */}
          <section className="space-y-6 pt-8">
            <ChapterDivider title={chapterCopy.c3.title} subtitle={chapterCopy.c3.subtitle} />

            <NarrativeBridge
              title={msg.narrativeBridges.demographicClockTitle}
              text={msg.narrativeBridges.demographicClockText}
            />

            <section id="demografia" className="scroll-mt-28">
              <Suspense fallback={<SectionSkeleton />}>
                <FadeIn delay={0.1}>
                  <DemographicsBlock compact />
                </FadeIn>
              </Suspense>
            </section>
            <section id="pensiones" className="scroll-mt-28">
              <Suspense fallback={<SectionSkeleton />}>
                <FadeIn delay={0.2}>
                  <PensionsBlock />
                </FadeIn>
              </Suspense>
            </section>
            <section id="sostenibilidad-ss" className="scroll-mt-28">
              <Suspense fallback={<SectionSkeleton />}>
                <FadeIn delay={0.3}>
                  <SustainabilityBlock />
                </FadeIn>
              </Suspense>
            </section>
          </section>

          {/* CHAPTER 4: LA HIPOTECA NACIONAL */}
          <section className="space-y-6 pt-8">
            <ChapterDivider title={chapterCopy.c4.title} subtitle={chapterCopy.c4.subtitle} />

            <NarrativeBridge
              title={msg.narrativeBridges.costOfDebtTitle}
              text={msg.narrativeBridges.costOfDebtText}
            />

            <section id="deuda" className="scroll-mt-28">
              <Suspense fallback={<SectionSkeleton />}>
                <FadeIn delay={0.1}>
                  <DebtBlock />
                </FadeIn>
              </Suspense>
            </section>
            <section id="coste-deuda" className="scroll-mt-28">
              <Suspense fallback={<SectionSkeleton />}>
                <FadeIn delay={0.2}>
                  <DebtImplicationsBlock />
                </FadeIn>
              </Suspense>
            </section>
          </section>

          {/* CHAPTER 5: EL JUEGO TERRITORIAL */}
          <section className="space-y-6 pt-8">
            <ChapterDivider title={chapterCopy.c5.title} subtitle={chapterCopy.c5.subtitle} />
            <section id="ccaa" className="scroll-mt-28">
              <Suspense fallback={<SectionSkeleton />}>
                <FadeIn delay={0.1}>
                  <CcaaDebtBlock />
                </FadeIn>
              </Suspense>
            </section>
            <section id="ue" className="scroll-mt-28">
              <Suspense fallback={<SectionSkeleton />}>
                <FadeIn delay={0.2}>
                  <ComparativaEUBlock />
                </FadeIn>
              </Suspense>
            </section>
            <section id="metodologia" className="scroll-mt-28 pt-8">
              <Suspense fallback={<SectionSkeleton />}>
                <MethodologySection />
              </Suspense>
            </section>
          </section>
        </main>

        <Footer />
      </div>
    </TooltipProvider>
  );
}

export default App;
