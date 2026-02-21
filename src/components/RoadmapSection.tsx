import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";

interface Phase {
  title: string;
  items: string[];
}

interface RoadmapCopy {
  intro: string;
  statusLine: string;
  phases: Phase[];
  wishlists: Array<{ title: string; items: string[] }>;
  cta: string;
  openSourceLabel: string;
  issueLabel: string;
}

const copyByLang: Record<"es" | "en", RoadmapCopy> = {
  es: {
    intro: "Este es el estado actual del proyecto y las funcionalidades que nos gustaría añadir.",
    statusLine: "Estado validado: 21 febrero 2026. Leyenda: ✅ hecho, 🟡 parcial, ⏳ pendiente.",
    phases: [
      {
        title: "Fase 1: Deuda + Pensiones (MVP) ✅",
        items: [
          "Contadores en tiempo real de deuda y gasto en pensiones",
          "Deuda PDE: total, per cápita, ratio PIB, desglose por subsectores",
          "Coste de la deuda: intereses anuales, intereses/segundo",
          "Pensiones: gasto/segundo, nómina mensual, déficit contributivo",
          "Dark/light mode, PWA, deploy automático a GitHub Pages",
          "Actualización semanal de datos via GitHub Actions",
        ],
      },
      {
        title: "Fase 2: Gasto Público + Comparativas ✅",
        items: [
          "Gasto público por funciones COFOG (30 años, 10 divisiones + subcategorías)",
          "Comparativas EU-27: deuda/PIB, gasto social, paro (8 países)",
          'Equivalencias: "La deuda equivale a X meses de SMI por persona"',
          "Ingresos vs gastos públicos: 30 años de datos Eurostat",
        ],
      },
      {
        title: "Fase 3: CCAA + Polish",
        items: [
          "✅ Datos desglosados por CCAA (ranking general de 17 comunidades)",
          "✅ Selector de Comunidad Autónoma (con estado persistente en URL)",
          "✅ Recaudación tributaria por impuesto (IRPF, IVA, Sociedades, IIEE) y por CCAA",
          "🟡 Deuda, déficit y gasto por comunidad (detalle de deuda listo + proxy BdE/AEAT; pendiente fuente oficial CN regional)",
          "✅ SSG multi-ruta + snapshot SEO + sitemap",
          "✅ Compartir (hash + query params + exportación PNG por bloque)",
          "✅ PWA offline hardening (runtime caching + fallback offline)",
          "✅ Tests E2E con Playwright (smoke suite)",
          "✅ i18n (castellano + inglés en interfaz + contenidos largos)",
          "✅ Notificaciones de datos nuevos via RSS",
          "✅ Explicación detallada por métrica (panel clicable con qué es, cómo se calcula, por qué importa y fuentes; desktop + móvil)",
        ],
      },
    ],
    wishlists: [
      {
        title: "Wishlist — Datos fiscales",
        items: [
          "🟡 Tipos efectivos por impuesto (proxy IRPF/IVA/Sociedades sobre recaudación total ya integrado; pendiente versión canónica sobre bases imponibles)",
        ],
      },
      {
        title: "Wishlist — Nuevas visualizaciones",
        items: [
          "Sección de demografía: población en tiempo real (contador), natalidad, mortalidad, inmigración — desglose por provincia (INE)",
          "Sostenibilidad SS: serie histórica déficit contributivo (ingresos vs gastos desde 2006), déficit como % PIB, saldo por CCAA, evolución Fondo de Reserva y patrimonio neto SS (Fedea, IGAE, Ageing Report)",
          "Visión unificada ingresos vs gastos: fusionar Ingresos/Gastos (Eurostat), COFOG y Recaudación Tributaria en un panel global y por CCAA con máximo desglose por partidas",
          "Proyecciones demográficas a 20-30 años",
          "Panorama de deuda pública + privada",
          "Simulador de ajuste fiscal",
          "Timeline de hitos (2008, COVID, reformas)",
        ],
      },
      {
        title: "Wishlist — Mejoras de datos",
        items: [
          "Afiliados SS automatizados",
          "Cotizaciones sociales reales",
          "Serie histórica de pensiones real",
          "Tipo de interés medio de la deuda",
          "SMI automático",
        ],
      },
    ],
    cta: "¿Tienes una idea o quieres contribuir? Abre un",
    openSourceLabel: "open source",
    issueLabel: "issue en GitHub",
  },
  en: {
    intro: "This is the current project status and the features we want to add next.",
    statusLine: "Status validated: February 21, 2026. Legend: ✅ done, 🟡 partial, ⏳ pending.",
    phases: [
      {
        title: "Phase 1: Debt + Pensions (MVP) ✅",
        items: [
          "Real-time debt and pension spending counters",
          "EDP debt: total, per capita, debt-to-GDP, subsector breakdown",
          "Debt cost: annual interest and per-second interest",
          "Pensions: per-second spending, monthly payroll, contributory deficit",
          "Dark/light mode, PWA, automated GitHub Pages deploy",
          "Weekly data updates via GitHub Actions",
        ],
      },
      {
        title: "Phase 2: Public Spending + Comparisons ✅",
        items: [
          "COFOG public spending by function (30 years, 10 divisions + subcategories)",
          "EU-27 comparison: debt/GDP, social spending, unemployment (8 countries)",
          'Equivalences: "Debt equals X months of minimum wage per person"',
          "Public revenue vs spending: 30 years of Eurostat data",
        ],
      },
      {
        title: "Phase 3: Regions + Polish",
        items: [
          "✅ Regional debt breakdown (17 regions ranking)",
          "✅ Autonomous Community selector (persisted in URL)",
          "✅ Tax revenue by tax type (PIT, VAT, CIT, excise) and by region",
          "🟡 Regional debt, deficit and spending (debt detail ready + BdE/AEAT proxy; official regional national-accounts source pending)",
          "✅ Multi-route SSG + SEO snapshot + sitemap",
          "✅ Sharing (hash + query params + per-block PNG export)",
          "✅ PWA offline hardening (runtime caching + offline fallback)",
          "✅ Playwright E2E tests (smoke suite)",
          "✅ i18n (Spanish + English across interface + long-form content)",
          "✅ New-data notifications via RSS",
          "✅ Detailed per-metric explanations (clickable panel with what it is, how it's computed, why it matters and sources; desktop + mobile)",
        ],
      },
    ],
    wishlists: [
      {
        title: "Wishlist — Fiscal data",
        items: [
          "🟡 Effective tax rates by tax type (IRPF/VAT/Corporate proxy over total revenue already integrated; canonical taxable-base version pending)",
        ],
      },
      {
        title: "Wishlist — New visualizations",
        items: [
          "Demographics section: real-time population counter, birth rate, mortality, immigration — breakdown by province (INE)",
          "Social Security sustainability: historical contributory deficit (revenue vs spending since 2006), deficit as % GDP, balance by region, Reserve Fund evolution and SS net worth (Fedea, IGAE, Ageing Report)",
          "Unified revenue vs spending view: merge Revenue/Spending (Eurostat), COFOG and Tax Revenue into a single panel with national and regional breakdown by category",
          "20-30 year demographic projections",
          "Public + private debt panorama",
          "Fiscal adjustment simulator",
          "Economic milestones timeline (2008, COVID, reforms)",
        ],
      },
      {
        title: "Wishlist — Data improvements",
        items: [
          "Automated Social Security affiliates",
          "Real social contributions",
          "Real pension historical series",
          "Average debt interest rate",
          "Automatic minimum wage updates",
        ],
      },
    ],
    cta: "Do you have an idea or want to contribute? Open a",
    openSourceLabel: "open source",
    issueLabel: "GitHub issue",
  },
};

export function RoadmapSection() {
  const [isOpen, setIsOpen] = useState(false);
  const { msg, lang } = useI18n();

  const copy = useMemo(() => copyByLang[lang], [lang]);

  return (
    <Card className="animate-slide-up" style={{ animationDelay: "0.35s" }}>
      <CardHeader>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="roadmap-content"
          className="flex items-center justify-between w-full text-left hover:text-primary transition-colors"
        >
          <h2 className="text-lg font-semibold">{msg.blocks.roadmap.title}</h2>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {isOpen && (
        <CardContent id="roadmap-content" className="space-y-6 text-sm leading-relaxed">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-muted-foreground">
              {copy.intro}{" "}
              <a
                href="https://github.com/jenarvaezg/cuentas-publicas"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-primary transition-colors"
              >
                {copy.openSourceLabel}
              </a>
              .
            </p>
            <p className="text-[11px] text-muted-foreground/80">{copy.statusLine}</p>

            {copy.phases.map((phase) => (
              <div key={phase.title}>
                <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">{phase.title}</h3>
                <ul className="list-disc list-inside pl-4 space-y-1 text-xs text-muted-foreground">
                  {phase.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}

            {copy.wishlists.map((wishlist) => (
              <div key={wishlist.title}>
                <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
                  {wishlist.title}
                </h3>
                <ul className="list-disc list-inside pl-4 space-y-1 text-xs text-muted-foreground">
                  {wishlist.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="mt-6 pt-4 border-t text-xs text-muted-foreground/80">
              <p>
                {copy.cta}{" "}
                <a
                  href="https://github.com/jenarvaezg/cuentas-publicas/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-primary transition-colors"
                >
                  {copy.issueLabel}
                </a>
                .
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
