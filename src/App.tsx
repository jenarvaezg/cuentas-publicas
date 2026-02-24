import { useEffect, useMemo } from "react";
import { BudgetBlock } from "@/components/BudgetBlock";
import { CcaaDebtBlock } from "@/components/CcaaDebtBlock";
import { ComparativaEUBlock } from "@/components/ComparativaEUBlock";
import { DebtBlock } from "@/components/DebtBlock";
import { DebtCostBlock } from "@/components/DebtCostBlock";
import { DemographicsBlock } from "@/components/DemographicsBlock";
import { EquivalenciasBlock } from "@/components/EquivalenciasBlock";
import { FlowsSankeyBlock } from "@/components/FlowsSankeyBlock";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MethodologySection } from "@/components/MethodologySection";
import { OfflineStatus } from "@/components/OfflineStatus";
import { PensionsBlock } from "@/components/PensionsBlock";
import { RealtimeCounter } from "@/components/RealtimeCounter";
import { RevenueBlock } from "@/components/RevenueBlock";
import { RoadmapSection } from "@/components/RoadmapSection";
import { SectionNav, type SectionNavGroup } from "@/components/SectionNav";
import { SustainabilityBlock } from "@/components/SustainabilityBlock";
import { TaxRevenueBlock } from "@/components/TaxRevenueBlock";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BDE_BE11B, CALCULO_DERIVADO, SS_NOMINA } from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatDate, formatNumber } from "@/utils/formatters";
import { getSearchParam } from "@/utils/url-state";

const SECTION_IDS = [
  "resumen",
  "deuda",
  "coste-deuda",
  "pensiones",
  "ingresos-gastos",
  "mapa-fiscal",
  "gasto-cofog",
  "recaudacion",
  "ue",
  "ccaa",
  "demografia",
  "sostenibilidad-ss",
  "metodologia",
] as const;

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

function App() {
  const { msg, lang } = useI18n();

  useDocumentMeta(msg.app.pageTitle, msg.app.pageDescription);

  const { debt, pensions } = useData();

  const chapterCopy =
    lang === "en"
      ? {
          fiscal: {
            title: "Fiscal Position",
            subtitle: "Debt, debt cost, revenue balance and tax collection.",
            navLabel: "Fiscal",
          },
          welfare: {
            title: "Spending & Welfare",
            subtitle: "Pensions, social sustainability and spending composition.",
            navLabel: "Welfare",
          },
          context: {
            title: "Context & Territory",
            subtitle: "EU comparison, regions, demographics and methodology.",
            navLabel: "Context",
          },
          fiscalMap: "Fiscal map",
        }
      : {
          fiscal: {
            title: "Situación fiscal",
            subtitle: "Deuda, coste de deuda, balance ingresos-gastos y recaudación.",
            navLabel: "Situación fiscal",
          },
          welfare: {
            title: "Gasto y estado social",
            subtitle: "Pensiones, sostenibilidad social y composición del gasto.",
            navLabel: "Estado social",
          },
          context: {
            title: "Contexto y territorio",
            subtitle: "Comparativa UE, CCAA, demografía y metodología.",
            navLabel: "Contexto",
          },
          fiscalMap: "Mapa fiscal",
        };

  const sectionGroups = useMemo<SectionNavGroup[]>(
    () => [
      {
        id: "situacion-fiscal",
        label: chapterCopy.fiscal.navLabel,
        items: [
          { id: "resumen", label: msg.sections.resumen },
          { id: "deuda", label: msg.sections.deuda },
          { id: "coste-deuda", label: msg.sections.costeDeuda },
          { id: "ingresos-gastos", label: msg.sections.ingresosGastos },
          { id: "recaudacion", label: msg.sections.recaudacion },
        ],
      },
      {
        id: "gasto-y-servicios",
        label: chapterCopy.welfare.navLabel,
        items: [
          { id: "pensiones", label: msg.sections.pensiones },
          { id: "sostenibilidad-ss", label: msg.sections.sostenibilidadSS },
          { id: "gasto-cofog", label: msg.sections.gastoCofog },
          { id: "mapa-fiscal", label: chapterCopy.fiscalMap },
        ],
      },
      {
        id: "contexto-territorial",
        label: chapterCopy.context.navLabel,
        items: [
          { id: "ue", label: msg.sections.ue },
          { id: "ccaa", label: msg.sections.ccaa },
          { id: "demografia", label: msg.sections.demografia },
          { id: "metodologia", label: msg.sections.metodologia },
        ],
      },
    ],
    [chapterCopy, msg.sections],
  );

  const currentDebt = debt.regression.intercept + debt.regression.slope * Date.now();
  const debtPerSecond = debt.regression.debtPerSecond;

  const deficitPerSecond = pensions.current.contributoryDeficit / (365.25 * 86_400);

  // Cumulative deficit since 2011 (base + time elapsed since baseDate)
  const cumDef = pensions.current.cumulativeDeficit;
  const cumulativeBase = cumDef
    ? cumDef.base + deficitPerSecond * ((Date.now() - new Date(cumDef.baseDate).getTime()) / 1000)
    : 0;

  // Year-to-date deficit
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const secondsSinceYearStart = (Date.now() - yearStart) / 1000;
  const accumulatedDeficit = deficitPerSecond * secondsSinceYearStart;

  const lastDebtDate =
    debt.historical.length > 0
      ? formatDate(debt.historical[debt.historical.length - 1].date)
      : msg.common.notAvailable;
  const pensionDate = formatDate(pensions.lastUpdated);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const section = getSearchParam("section");
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

        <main className="max-w-5xl mx-auto px-4 py-6 lg:py-8 space-y-8">
          <section id="resumen" className="scroll-mt-28">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              <div className="p-7 border rounded-xl bg-card shadow-sm flex flex-col items-center gap-3 animate-slide-up hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="text-sm font-semibold text-muted-foreground mb-1 uppercase tracking-[0.08em]">
                  {msg.app.debtSummaryLabel}
                </div>
                <RealtimeCounter
                  baseValue={currentDebt}
                  perSecond={debtPerSecond}
                  suffix=" €"
                  size="lg"
                  label=""
                />
                <p className="text-sm text-muted-foreground text-center">
                  {msg.app.debtSummaryNotePrefix}{" "}
                  <a
                    href={BDE_BE11B.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    BdE be11b.csv
                  </a>{" "}
                  ({msg.app.debtSummaryNoteSuffix} {lastDebtDate})
                </p>
              </div>

              <div
                className="p-7 border rounded-xl bg-card shadow-sm flex flex-col items-center gap-3 animate-slide-up hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                style={{ animationDelay: "0.05s" }}
              >
                <div className="text-sm font-semibold text-muted-foreground mb-1 uppercase tracking-[0.08em]">
                  {msg.app.deficitSummaryLabel}
                </div>
                <RealtimeCounter
                  baseValue={cumulativeBase}
                  perSecond={deficitPerSecond}
                  suffix=" €"
                  size="lg"
                  decimals={0}
                  label=""
                />
                <p className="text-sm text-muted-foreground text-center">
                  {msg.app.deficitSummarySince}{" "}
                  {formatCompact(pensions.current.contributoryDeficit)}
                  {msg.app.perYear} ( {formatNumber(deficitPerSecond, 2)} €/s)
                </p>
                <div className="w-full border-t pt-3 flex flex-col items-center gap-1">
                  <div className="flex gap-6 text-center">
                    <div>
                      <div className="text-sm font-semibold tabular-nums">
                        {formatCompact(accumulatedDeficit)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {msg.app.thisYear} {new Date().getFullYear()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold tabular-nums">
                        {formatCompact(pensions.current.contributoryDeficit)}
                      </div>
                      <div className="text-xs text-muted-foreground">{msg.app.annualDeficit}</div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground/80 text-center">
                  UV-Eje, Fedea SSA, BdE —{" "}
                  <a
                    href={SS_NOMINA.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    {CALCULO_DERIVADO.name}
                  </a>{" "}
                  ({pensionDate})
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <ChapterDivider
              title={chapterCopy.fiscal.title}
              subtitle={chapterCopy.fiscal.subtitle}
            />
            <section id="deuda" className="scroll-mt-28 animate-slide-up">
              <DebtBlock />
            </section>
            <section id="coste-deuda" className="scroll-mt-28 animate-slide-up">
              <DebtCostBlock />
            </section>
            <section className="scroll-mt-28 animate-slide-up">
              <EquivalenciasBlock />
            </section>
            <section id="ingresos-gastos" className="scroll-mt-28 animate-slide-up">
              <RevenueBlock />
            </section>
            <section id="recaudacion" className="scroll-mt-28 animate-slide-up">
              <TaxRevenueBlock />
            </section>
          </section>

          <section className="space-y-6">
            <ChapterDivider
              title={chapterCopy.welfare.title}
              subtitle={chapterCopy.welfare.subtitle}
            />
            <section id="pensiones" className="scroll-mt-28 animate-slide-up">
              <PensionsBlock />
            </section>
            <section id="sostenibilidad-ss" className="scroll-mt-28 animate-slide-up">
              <SustainabilityBlock />
            </section>
            <section id="gasto-cofog" className="scroll-mt-28 animate-slide-up">
              <BudgetBlock />
            </section>
            <section id="mapa-fiscal" className="scroll-mt-28 animate-slide-up">
              <FlowsSankeyBlock />
            </section>
          </section>

          <section className="space-y-6">
            <ChapterDivider
              title={chapterCopy.context.title}
              subtitle={chapterCopy.context.subtitle}
            />
            <section id="ue" className="scroll-mt-28 animate-slide-up">
              <ComparativaEUBlock />
            </section>
            <section id="ccaa" className="scroll-mt-28 animate-slide-up">
              <CcaaDebtBlock />
            </section>
            <section id="demografia" className="scroll-mt-28 animate-slide-up">
              <DemographicsBlock />
            </section>
            <section id="metodologia" className="scroll-mt-28">
              <MethodologySection />
            </section>
            <section className="scroll-mt-28">
              <RoadmapSection />
            </section>
          </section>
        </main>

        <Footer />
      </div>
    </TooltipProvider>
  );
}

export default App;
