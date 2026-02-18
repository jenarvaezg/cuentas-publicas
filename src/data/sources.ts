import type { SourceDetail } from "@/components/StatCard";
import type { DataSourceAttribution } from "@/data/types";

// Banco de España
export const BDE_BE11B: SourceDetail = {
  name: "BdE — CSV be11b",
  url: "https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be11b.csv",
  note: "Avance mensual deuda PDE",
};

export const BDE_BE1101: SourceDetail = {
  name: "BdE — CSV be1101",
  url: "https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be1101.csv",
  note: "Deficit/superavit y deuda PDE trimestral",
};

// INE
export const INE_POBLACION: SourceDetail = {
  name: "INE — Cifras de Poblacion",
  url: "https://www.ine.es/jaxiT3/Tabla.htm?t=56934",
  note: "Tabla 56934",
};

export const INE_EPA: SourceDetail = {
  name: "INE — EPA (Encuesta Poblacion Activa)",
  url: "https://www.ine.es/jaxiT3/Tabla.htm?t=4247",
  note: "Tabla 4247, valor de referencia",
};

export const INE_PIB: SourceDetail = {
  name: "INE — Contabilidad Nacional Trimestral",
  url: "https://www.ine.es/jaxiT3/Tabla.htm?t=24912",
  note: "Tabla 24912",
};

// Seguridad Social
export const SS_NOMINA: SourceDetail = {
  name: "MITES — Estadisticas Seg. Social",
  url: "https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas",
  note: "Nomina mensual pensiones contributivas",
};

export const SS_AFILIADOS: SourceDetail = {
  name: "MITES — Afiliacion Seg. Social",
  url: "https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas",
  note: "Afiliados medios",
};

export const SS_PENSIONES: SourceDetail = {
  name: "MITES — Pensiones en vigor",
  url: "https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas",
  note: "Numero y pension media",
};

// IGAE
export const IGAE_COFOG: SourceDetail = {
  name: "IGAE — Clasificacion funcional COFOG",
  url: "https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/Publicaciones/Documents/AAPP_A/COFOG_A_AAPP.xlsx",
  note: "Gasto Total AAPP por funciones (COFOG), millones de euros",
};

// Derived / estimated
export const ESTIMACION_INTERESES: SourceDetail = {
  name: "Estimacion propia",
  note: "~2,3% coste medio sobre deuda total (PGE 2025)",
};

export const CALCULO_DERIVADO: SourceDetail = {
  name: "Calculo derivado",
  note: "Combinacion de fuentes anteriores",
};

export const PGE_COTIZACIONES: SourceDetail = {
  name: "PGE — Cotizaciones sociales",
  url: "https://www.sepg.pap.hacienda.gob.es/sitios/sepg/es-ES/Presupuestos/PGE/Paginas/PGE2025.aspx",
  note: "Presupuestos Generales del Estado",
};

/** Helper: add the data date to a source */
export function withDate(source: SourceDetail, date: string): SourceDetail {
  return { ...source, date };
}

/** Helper: convert DataSourceAttribution to SourceDetail */
export function fromAttribution(attr: DataSourceAttribution): SourceDetail {
  return {
    name: attr.source + (attr.type === "fallback" ? " (referencia)" : ""),
    url: attr.url,
    date: attr.date,
    note: attr.note,
  };
}
