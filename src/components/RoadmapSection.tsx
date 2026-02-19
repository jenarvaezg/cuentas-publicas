import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function RoadmapSection() {
  const [isOpen, setIsOpen] = useState(false);

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
          <h2 className="text-lg font-semibold">Roadmap y wishlist</h2>
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
              Este es el estado actual del proyecto y las funcionalidades que nos gustaría añadir.
              El código es{" "}
              <a
                href="https://github.com/jenarvaezg/cuentas-publicas"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-primary transition-colors"
              >
                open source
              </a>{" "}
              — contribuciones bienvenidas.
            </p>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
              Fase 1: Deuda + Pensiones (MVP) ✅
            </h3>
            <ul className="list-disc list-inside pl-4 space-y-1 text-xs text-muted-foreground">
              <li>Contadores en tiempo real de deuda y gasto en pensiones</li>
              <li>Deuda PDE: total, per cápita, ratio PIB, desglose por subsectores</li>
              <li>Coste de la deuda: intereses anuales, intereses/segundo</li>
              <li>Pensiones: gasto/segundo, nómina mensual, déficit contributivo</li>
              <li>Dark/light mode, PWA, deploy automático a GitHub Pages</li>
              <li>Actualización semanal de datos via GitHub Actions</li>
            </ul>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
              Fase 2: Gasto Público + Comparativas ✅
            </h3>
            <ul className="list-disc list-inside pl-4 space-y-1 text-xs text-muted-foreground">
              <li>Gasto público por funciones COFOG (30 años, 10 divisiones + subcategorías)</li>
              <li>Comparativas EU-27: deuda/PIB, gasto social, paro (8 países)</li>
              <li>Equivalencias: "La deuda equivale a X meses de SMI por persona"</li>
              <li>Ingresos vs gastos públicos: 30 años de datos Eurostat</li>
            </ul>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
              Fase 3: CCAA + Polish
            </h3>
            <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
              <li className="text-muted-foreground">
                ✅ Datos desglosados por CCAA (ranking general de 17 comunidades)
              </li>
              <li>Selector de Comunidad Autónoma (drill-down detallado)</li>
              <li>Deuda, déficit y gasto por comunidad (vista detallada)</li>
              <li>SSG/pre-rendering para SEO</li>
              <li>Compartir: URL con parámetros, captura de imagen</li>
              <li>Tests E2E con Playwright</li>
              <li>i18n (castellano + inglés)</li>
            </ul>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
              Wishlist — Datos fiscales
            </h3>
            <div className="space-y-2 text-muted-foreground">
              <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                <li>
                  <strong className="text-foreground">Recaudación por impuesto y año</strong>:
                  desglose de IRPF, IVA, Sociedades, IIEE, etc. (fuente: AEAT o Eurostat
                  gov_10a_taxag)
                </li>
                <li>
                  <strong className="text-foreground">Tipos efectivos por impuesto</strong>: tipo
                  efectivo medio de IRPF, Sociedades, IVA — evolución temporal
                </li>
                <li>
                  <strong className="text-foreground">Recaudación por CCAA</strong>: impuestos
                  cedidos vs transferencias recibidas (balanzas fiscales)
                </li>
              </ul>
            </div>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
              Wishlist — Nuevas visualizaciones
            </h3>
            <div className="space-y-2 text-muted-foreground">
              <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                <li>
                  <strong className="text-foreground">Proyecciones demográficas</strong>: pirámide
                  de población + proyecciones INE a 20-30 años
                </li>
                <li>
                  <strong className="text-foreground">Deuda hogares/empresas</strong>: panorama
                  completo de deuda pública + privada
                </li>
                <li>
                  <strong className="text-foreground">Simulador de ajuste fiscal</strong>: "¿Qué
                  pasaría si subimos/bajamos X impuesto un Y%?"
                </li>
                <li>
                  <strong className="text-foreground">Timeline de hitos</strong>: crisis 2008,
                  COVID, reformas superpuestos en gráficos históricos
                </li>
              </ul>
            </div>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
              Wishlist — UX y educación
            </h3>
            <div className="space-y-2 text-muted-foreground">
              <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                <li>
                  <strong className="text-foreground">Tooltips explicativos por métrica</strong>:
                  icono de ayuda (?) en cada gráfica y dato que explique qué es, cómo se calcula y
                  por qué es importante — para que cualquier persona entienda cada cifra
                </li>
              </ul>
            </div>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
              Wishlist — Mejoras de datos
            </h3>
            <div className="space-y-2 text-muted-foreground">
              <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                <li>Afiliados SS automatizados (ahora hardcodeado)</li>
                <li>Cotizaciones sociales reales (ahora estimación PGE)</li>
                <li>Serie histórica de pensiones real (ahora interpolada a mano)</li>
                <li>Tipo de interés medio de la deuda (Tesoro Público)</li>
                <li>SMI automático (ahora actualización manual cada enero)</li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t text-xs text-muted-foreground/80">
              <p>
                ¿Tienes una idea o quieres contribuir? Abre un{" "}
                <a
                  href="https://github.com/jenarvaezg/cuentas-publicas/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-primary transition-colors"
                >
                  issue en GitHub
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
