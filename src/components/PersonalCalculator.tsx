import { Calculator, ChevronDown } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact } from "@/utils/formatters";
import { calculatePersonalTax } from "@/utils/personalTaxCalculator";

export interface SpendingCategory {
  id: string;
  label: string;
  amount: number;
}

interface Props {
  spendingCategories: SpendingCategory[];
  totalSpending: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export const PersonalCalculator: React.FC<Props> = ({ spendingCategories, totalSpending }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [grossSalary, setGrossSalary] = useState(35_000);
  const { lang } = useI18n();

  const result = useMemo(() => calculatePersonalTax({ grossSalary }), [grossSalary]);

  const distribution = useMemo(() => {
    if (totalSpending <= 0) return [];
    return spendingCategories
      .map((cat) => ({
        ...cat,
        personal: (cat.amount / totalSpending) * result.totalPersonalTax,
        share: cat.amount / totalSpending,
      }))
      .filter((d) => d.personal >= 1)
      .sort((a, b) => b.personal - a.personal);
  }, [spendingCategories, totalSpending, result.totalPersonalTax]);

  const maxPersonal = distribution[0]?.personal ?? 1;

  const copy =
    lang === "en"
      ? {
          toggle: "How much do you pay?",
          salary: "Annual gross salary",
          irpf: "Income Tax (IRPF)",
          irpfState: "State",
          irpfCcaa: "Autonomous Community",
          ss: "Social Security (worker)",
          ssEmployer: "Social Security (employer)",
          iva: "Estimated VAT",
          net: "Net salary",
          effectiveRate: "Effective IRPF rate",
          totalTax: "Your total tax contribution",
          totalWithEmployer: "Full labour cost to employer",
          destination: "Where your taxes go",
          destinationSub: "Proportional estimate based on public spending distribution",
          approx: "Estimated",
          brackets: "IRPF brackets",
        }
      : {
          toggle: "¿Cuánto pagas tú?",
          salary: "Salario bruto anual",
          irpf: "IRPF",
          irpfState: "Tramo estatal",
          irpfCcaa: "Tramo autonómico",
          ss: "Seguridad Social (trabajador)",
          ssEmployer: "Seguridad Social (empresa)",
          iva: "IVA estimado",
          net: "Salario neto",
          effectiveRate: "Tipo efectivo IRPF",
          totalTax: "Tu contribución fiscal total",
          totalWithEmployer: "Coste laboral total para la empresa",
          destination: "Destino de tus impuestos",
          destinationSub: "Estimación proporcional basada en la distribución del gasto público",
          approx: "Estimado",
          brackets: "Tramos IRPF",
        };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Calculator className="w-4 h-4" />
        {copy.toggle}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="mt-3 space-y-4">
          {/* Salary input */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label
              htmlFor="personal-calc-salary"
              className="text-sm font-medium text-muted-foreground whitespace-nowrap"
            >
              {copy.salary}
            </label>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="range"
                min={12_000}
                max={200_000}
                step={500}
                value={grossSalary}
                onChange={(e) => setGrossSalary(Number(e.target.value))}
                className="flex-1 sm:w-48 accent-primary"
              />
              <div className="flex items-center gap-1">
                <input
                  id="personal-calc-salary"
                  type="number"
                  min={0}
                  max={1_000_000}
                  step={500}
                  value={grossSalary}
                  onChange={(e) => setGrossSalary(Math.max(0, Number(e.target.value)))}
                  className="w-24 px-2 py-1 text-sm text-right border rounded-md bg-background"
                />
                <span className="text-sm text-muted-foreground">€</span>
              </div>
            </div>
          </div>

          {/* Tax breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TaxCard
              label={copy.irpf}
              amount={result.irpf.total}
              sub={pct(result.irpf.effectiveRate)}
            />
            <TaxCard label={copy.ss} amount={result.ss.worker} sub={pct(0.0647)} />
            <TaxCard label={`${copy.iva} *`} amount={result.iva.estimated} sub={copy.approx} />
            <TaxCard
              label={copy.net}
              amount={result.netSalary}
              sub={pct(result.netSalary / grossSalary)}
              highlight
            />
          </div>

          {/* IRPF detail row */}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">{copy.brackets}</summary>
            <div className="mt-2 grid gap-1">
              {result.irpf.brackets.map((b) => (
                <div key={b.from} className="flex justify-between bg-muted/30 rounded px-2 py-0.5">
                  <span>
                    {fmt(b.from)}–{b.to >= 300_000 ? "∞" : fmt(b.to)} € @ {pct(b.rate)}
                  </span>
                  <span className="font-medium">{fmt(b.tax)} €</span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between px-2">
              <span>
                {copy.irpfState}: {fmt(result.irpf.statePortion)} € | {copy.irpfCcaa}:{" "}
                {fmt(result.irpf.ccaaPortion)} €
              </span>
            </div>
          </details>

          {/* Totals */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3">
            <span>
              {copy.totalTax}:{" "}
              <strong className="text-foreground">{fmt(result.totalPersonalTax)} €</strong>
            </span>
            <span>
              {copy.ssEmployer}: {fmt(result.ss.employer)} €
            </span>
            <span>
              {copy.totalWithEmployer}: {fmt(result.totalWithEmployer)} €
            </span>
          </div>

          {/* Spending distribution */}
          {distribution.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium text-muted-foreground">{copy.destination}</p>
              <p className="text-xs text-muted-foreground/70 mb-2">{copy.destinationSub}</p>
              <div className="space-y-1.5">
                {distribution.slice(0, 10).map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-xs">
                    <span className="w-32 sm:w-40 truncate text-muted-foreground">{d.label}</span>
                    <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-sm transition-all duration-300"
                        style={{
                          width: `${(d.personal / maxPersonal) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-20 text-right font-medium tabular-nums">
                      {formatCompact(d.personal)}
                    </span>
                    <span className="w-12 text-right text-muted-foreground tabular-nums">
                      {pct(d.share)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Small helper component for the tax breakdown cards
const TaxCard: React.FC<{
  label: string;
  amount: number;
  sub: string;
  highlight?: boolean;
}> = ({ label, amount, sub, highlight }) => (
  <div
    className={`rounded-lg border p-2.5 ${highlight ? "bg-primary/5 border-primary/20" : "bg-muted/20"}`}
  >
    <p className="text-xs text-muted-foreground truncate">{label}</p>
    <p className={`text-base font-semibold tabular-nums ${highlight ? "text-primary" : ""}`}>
      {fmt(amount)} €
    </p>
    <p className="text-xs text-muted-foreground">{sub}</p>
  </div>
);
