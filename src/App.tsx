import { BudgetBlock } from "@/components/BudgetBlock";
import { DebtBlock } from "@/components/DebtBlock";
import { DebtCostBlock } from "@/components/DebtCostBlock";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MethodologySection } from "@/components/MethodologySection";
import { PensionsBlock } from "@/components/PensionsBlock";
import { RealtimeCounter } from "@/components/RealtimeCounter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BDE_BE11B, CALCULO_DERIVADO, SS_NOMINA } from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { formatDate, formatNumber } from "@/utils/formatters";

function App() {
  useDocumentMeta(
    "Dashboard Fiscal de España - Deuda y Pensiones en Tiempo Real",
    "Visualización en tiempo real de la deuda pública, pensiones y gasto público en España",
  );

  const { debt, pensions } = useData();

  const currentDebt = debt.regression.intercept + debt.regression.slope * Date.now();
  const debtPerSecond = debt.regression.debtPerSecond;

  const deficitPerSecond = pensions.current.contributoryDeficit / (365.25 * 86_400);

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
                Déficit de las Pensiones
              </div>
              <RealtimeCounter
                baseValue={0}
                perSecond={deficitPerSecond}
                suffix=" €"
                size="xl"
                decimals={0}
                label=""
              />
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {formatNumber(deficitPerSecond, 2)} €/s — diferencia entre gasto anual (
                {formatNumber(pensions.current.annualExpense / 1e9, 1)} mm€) y cotizaciones (
                {formatNumber(pensions.current.socialContributions / 1e9, 0)} mm€) —{" "}
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
              <PensionsBlock />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
              <BudgetBlock />
            </div>
            <MethodologySection />
          </div>
        </main>

        <Footer />
      </div>
    </TooltipProvider>
  );
}

export default App;
