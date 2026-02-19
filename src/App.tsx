import { BudgetBlock } from "@/components/BudgetBlock";
import { CcaaDebtBlock } from "@/components/CcaaDebtBlock";
import { ComparativaEUBlock } from "@/components/ComparativaEUBlock";
import { DebtBlock } from "@/components/DebtBlock";
import { DebtCostBlock } from "@/components/DebtCostBlock";
import { EquivalenciasBlock } from "@/components/EquivalenciasBlock";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MethodologySection } from "@/components/MethodologySection";
import { PensionsBlock } from "@/components/PensionsBlock";
import { RealtimeCounter } from "@/components/RealtimeCounter";
import { RevenueBlock } from "@/components/RevenueBlock";
import { RoadmapSection } from "@/components/RoadmapSection";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BDE_BE11B, CALCULO_DERIVADO, SS_NOMINA } from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { formatCompact, formatDate, formatNumber } from "@/utils/formatters";

function App() {
  useDocumentMeta(
    "Cuentas Públicas de España en Tiempo Real",
    "Deuda pública, pensiones y gasto público de España. Datos oficiales actualizados en tiempo real.",
  );

  const { debt, pensions } = useData();

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
      : "N/D";
  const pensionDate = formatDate(pensions.lastUpdated);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <Header />

        <main className="max-w-5xl mx-auto px-4 py-6 lg:py-8">
          {/* Hero section - two main counters side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="p-8 border rounded-xl bg-card shadow-sm flex flex-col items-center gap-3 animate-slide-up hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Deuda Pública Total
              </div>
              <RealtimeCounter
                baseValue={currentDebt}
                perSecond={debtPerSecond}
                suffix=" €"
                size="xl"
                label=""
              />
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Extrapolación sobre{" "}
                <a
                  href={BDE_BE11B.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  BdE be11b.csv
                </a>{" "}
                (último dato: {lastDebtDate})
              </p>
            </div>
            <div
              className="p-8 border rounded-xl bg-card shadow-sm flex flex-col items-center gap-3 animate-slide-up hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: "0.05s" }}
            >
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Déficit Contributivo Acumulado
              </div>
              <RealtimeCounter
                baseValue={cumulativeBase}
                perSecond={deficitPerSecond}
                suffix=" €"
                size="xl"
                decimals={0}
                label=""
              />
              <p className="text-xs text-muted-foreground text-center">
                Desde 2011 — ritmo actual: {formatCompact(pensions.current.contributoryDeficit)}/año
                ({formatNumber(deficitPerSecond, 2)} €/s)
              </p>
              <div className="w-full border-t pt-3 flex flex-col items-center gap-1">
                <div className="flex gap-6 text-center">
                  <div>
                    <div className="text-sm font-semibold tabular-nums">
                      {formatCompact(accumulatedDeficit)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      en {new Date().getFullYear()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold tabular-nums">
                      {formatCompact(pensions.current.contributoryDeficit)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">déficit anual</div>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/70 text-center">
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

          {/* Detailed sections */}
          <div className="space-y-6">
            <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
              <DebtBlock />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
              <DebtCostBlock />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <EquivalenciasBlock />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
              <PensionsBlock />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
              <RevenueBlock />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "0.35s" }}>
              <BudgetBlock />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "0.4s" }}>
              <ComparativaEUBlock />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "0.45s" }}>
              <CcaaDebtBlock />
            </div>
            <MethodologySection />
            <RoadmapSection />
          </div>
        </main>

        <Footer />
      </div>
    </TooltipProvider>
  );
}

export default App;
