import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function MethodologySection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
      <CardHeader>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="methodology-content"
          className="flex items-center justify-between w-full text-left hover:text-primary transition-colors"
        >
          <h2 className="text-lg font-semibold">Metodología y fuentes</h2>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {isOpen && (
        <CardContent id="methodology-content" className="space-y-6 text-sm leading-relaxed">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-muted-foreground">
              Este proyecto educativo muestra la evolución de la deuda pública y el gasto en
              pensiones en España utilizando datos oficiales de fuentes públicas. Toda la
              metodología es transparente y el código es open source.
            </p>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">Deuda Pública</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">Fuente:</strong>{" "}
                <a
                  href="https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be11b.csv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-primary transition-colors"
                >
                  Banco de España (be11b.csv)
                </a>{" "}
                — Avance mensual de la deuda según el Protocolo de Déficit Excesivo (PDE).
              </p>
              <p>
                <strong className="text-foreground">Método de obtención:</strong> Descarga directa
                del archivo CSV desde el servidor del BdE. El archivo utiliza formato español (coma
                decimal, punto de miles, separador punto y coma) y se procesa con un parser
                personalizado.
              </p>
              <p>
                <strong className="text-foreground">Datos extraídos:</strong>
              </p>
              <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                <li>Deuda total PDE (373 puntos mensuales desde 1994)</li>
                <li>
                  Desglose por subsector: Estado, Comunidades Autónomas, Corporaciones Locales,
                  Seguridad Social
                </li>
                <li>Serie temporal para análisis de tendencias</li>
              </ul>
              <p>
                <strong className="text-foreground">Cálculos derivados:</strong>
              </p>
              <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                <li>Deuda per cápita = Deuda total / Población (INE)</li>
                <li>Deuda por contribuyente = Deuda total / Población activa (EPA)</li>
                <li>Ratio deuda/PIB = Deuda total / PIB nominal (INE)</li>
                <li>
                  Variación interanual = (Deuda mes actual - Deuda mismo mes año anterior) / Deuda
                  año anterior × 100
                </li>
              </ul>
            </div>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">Pensiones</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">Fuente:</strong>{" "}
                <a
                  href="https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-primary transition-colors"
                >
                  Ministerio de Trabajo/Seguridad Social
                </a>{" "}
                — Estadísticas de pensiones contributivas.
              </p>
              <p>
                <strong className="text-foreground">Método de obtención:</strong> No existe API
                pública. El proceso es:
              </p>
              <ol className="list-decimal list-inside pl-4 space-y-1 text-xs">
                <li>
                  Descarga de la página HTML de estadísticas (EST24 - Pensiones contributivas en
                  vigor)
                </li>
                <li>
                  Extracción del enlace al archivo Excel (URLs con UUID que cambian mensualmente,
                  formato REG*.xlsx)
                </li>
                <li>Descarga del archivo Excel</li>
                <li>Parsing de la hoja "Régimen_clase", fila "Total sistema"</li>
              </ol>
              <p>
                <strong className="text-foreground">Datos extraídos:</strong>
              </p>
              <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                <li>Número total de pensiones contributivas (~10,45 millones)</li>
                <li>Nómina mensual total (~14,25 mil millones €)</li>
                <li>Pensión media del sistema</li>
                <li>Pensión media de jubilación</li>
              </ul>
              <p>
                <strong className="text-foreground">Clases Pasivas:</strong> Pensiones de
                funcionarios del Estado. Fuente separada (Ministerio de Hacienda), se estima en
                ~1.659 mil millones €/mes (valor de referencia).
              </p>
              <p>
                <strong className="text-foreground">Cálculos:</strong>
              </p>
              <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                <li>
                  Gasto anual en pensiones = Nómina mensual × 14 pagas (España tiene 14 pagas
                  anuales)
                </li>
                <li>
                  Cotizaciones sociales y Fondo de Reserva: estimaciones basadas en Presupuestos
                  Generales del Estado
                </li>
              </ul>
            </div>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">Gasto Público</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">Fuente:</strong>{" "}
                <a
                  href="https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/Publicaciones/Documents/AAPP_A/COFOG_A_AAPP.xlsx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-primary transition-colors"
                >
                  IGAE — Clasificación funcional COFOG
                </a>{" "}
                — Gasto del Total de Administraciones Públicas (S.13) por divisiones y grupos COFOG.
              </p>
              <p>
                <strong className="text-foreground">Método de obtención:</strong> Descarga directa
                del archivo Excel (.xlsx) desde el servidor de la IGAE. Cada año tiene su propia
                hoja con el desglose por funciones (10 divisiones COFOG) y subfunciones (~70
                grupos).
              </p>
              <p>
                <strong className="text-foreground">Clasificación COFOG:</strong> Estándar
                internacional de Eurostat/Naciones Unidas para clasificar el gasto público por
                funciones. Las 10 divisiones son: Servicios públicos generales, Defensa, Orden
                público, Asuntos económicos, Medio ambiente, Vivienda, Salud, Ocio/cultura/religión,
                Educación y Protección social.
              </p>
              <p>
                <strong className="text-foreground">Cobertura:</strong> Total Administraciones
                Públicas (S.13): Estado + CCAA + Corporaciones Locales + Seguridad Social. Datos
                anuales desde 1995. Los datos se publican con un desfase de ~1-2 años; el último año
                disponible puede ser provisional.
              </p>
              <p>
                <strong className="text-foreground">Unidades:</strong> Millones de euros. Los
                cálculos per cápita y ratio sobre PIB se derivan combinando con datos del INE.
              </p>
              <p>
                <strong className="text-foreground">Euros reales vs corrientes:</strong> Al comparar
                dos años, se puede activar la vista en{" "}
                <strong className="text-foreground">euros reales</strong> (constantes), que ajusta
                los importes por inflación usando el IPC del INE. El año base es el último año COFOG
                disponible (2024), de modo que los valores de ese año quedan intactos y los
                anteriores se ajustan al alza. Fórmula: importe real = importe nominal × (IPC año
                base / IPC año dato). Los porcentajes no se deflactan porque ya son ratios dentro
                del mismo año.
              </p>
            </div>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">Demografía y PIB</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">Fuente:</strong>{" "}
                <a
                  href="https://www.ine.es"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-primary transition-colors"
                >
                  Instituto Nacional de Estadística (INE)
                </a>{" "}
                — API Tempus para series temporales.
              </p>
              <p>
                <strong className="text-foreground">Series consultadas:</strong>
              </p>
              <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                <li>
                  <strong className="text-foreground">Población total</strong> (Serie ECP320): ~49,6
                  millones (diciembre 2025) — Endpoint:{" "}
                  <code className="text-xs">DATOS_SERIE/ECP320?nult=3</code>
                </li>
                <li>
                  <strong className="text-foreground">Población activa</strong> (Serie EPA387794):
                  ~24,9 millones (T3 2025, dato en miles) — Endpoint:{" "}
                  <code className="text-xs">DATOS_SERIE/EPA387794?nult=3</code>
                </li>
                <li>
                  <strong className="text-foreground">PIB a precios corrientes</strong> (Serie
                  CNTR6597): PIB trimestral, se suman 4 trimestres = ~1,686 billones € — Endpoint:{" "}
                  <code className="text-xs">DATOS_SERIE/CNTR6597?nult=8</code>
                </li>
                <li>
                  <strong className="text-foreground">Salario medio</strong> (Serie EAES741):
                  ~28.050€ (2022, encuesta con desfase de ~2 años) — Endpoint:{" "}
                  <code className="text-xs">DATOS_SERIE/EAES741?nult=5</code>
                </li>
                <li>
                  <strong className="text-foreground">IPC</strong> (Series IPC278296 + IPC290750):
                  Índice de Precios al Consumo, base 2021=100. La serie IPC278296 proporciona medias
                  anuales directas (2002-2025). Para años anteriores (1995-2001), se reconstruye
                  hacia atrás usando las variaciones anuales de IPC290750: índice[año-1] =
                  índice[año] / (1 + variación[año] / 100). Se usa para deflactar el gasto público
                  COFOG a euros constantes.
                </li>
              </ul>
              <p>
                <strong className="text-foreground">Salario Mínimo Interprofesional (SMI):</strong>{" "}
                Valor hardcodeado desde BOE (1.134€/mes × 14 pagas, actualización anual).
              </p>
            </div>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
              Contadores en tiempo real
            </h3>
            <div className="space-y-2 text-muted-foreground">
              <p>
                Los contadores que avanzan cada segundo utilizan{" "}
                <strong className="text-foreground">regresión lineal</strong> sobre datos históricos
                para estimar la tendencia y proyectar valores actuales:
              </p>
              <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                <li>
                  <strong className="text-foreground">Contador de deuda:</strong> Regresión lineal
                  sobre los últimos 24 meses de datos del BdE. La pendiente de la recta
                  (€/milisegundo) se aplica desde el último dato oficial para extrapolar el valor
                  actual.
                </li>
                <li>
                  <strong className="text-foreground">Contador de pensiones:</strong> Gasto anual
                  total (nómina mensual × 14) dividido entre 365,25 días y luego entre 86.400
                  segundos = €/segundo.
                </li>
                <li>
                  Todos los contadores se actualizan a ~20 fotogramas por segundo (intervalo de
                  50ms) con fuente <code className="text-xs">tabular-nums</code> para animación
                  fluida.
                </li>
              </ul>
            </div>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
              Frecuencia de actualización
            </h3>
            <div className="space-y-2 text-muted-foreground">
              <p>
                Los datos se actualizan automáticamente cada semana mediante{" "}
                <strong className="text-foreground">GitHub Actions</strong>:
              </p>
              <ul className="list-disc list-inside pl-4 space-y-1 text-xs">
                <li>
                  Workflow: <code className="text-xs">update-data.yml</code>, ejecutado cada lunes a
                  las 08:00 UTC
                </li>
                <li>
                  Los scripts descargan datos frescos de cada fuente y los comparan con los
                  existentes
                </li>
                <li>Si hay cambios, se genera un commit automático con los nuevos datos</li>
                <li>
                  <strong className="text-foreground">Valores de referencia:</strong> Si una fuente
                  falla en la descarga, el sistema mantiene los últimos valores conocidos. Estos se
                  marcan en la interfaz como "(referencia)" para que el usuario sepa que no son el
                  dato más reciente.
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t text-xs text-muted-foreground/80">
              <p>
                <strong className="text-foreground">Nota importante:</strong> Este dashboard es un
                proyecto educativo con fines informativos. Los datos provienen de fuentes oficiales
                públicas, pero las extrapolaciones y estimaciones son aproximadas. Para datos
                oficiales y actualizados, consulta siempre las fuentes primarias.
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
