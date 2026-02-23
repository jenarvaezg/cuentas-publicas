import { execFileSync } from 'child_process'
import { fetchWithRetry } from '../lib/fetch-utils.mjs'

const NAVARRA_URL =
  'https://www.navarra.es/es/web/memoria-2024/cuadro-n%C2%BA-64.-flujos-financieros-convenio-economico'
const EUSKADI_URL =
  'https://www.euskadi.eus/noticia/2024/la-cmce-acuerda-modificacion-del-concierto-economico-aumentando-autogobierno-economico-y-participacion-instituciones-vascas-foros-fiscales-internacionales/web01-ejeduki/es/'

const FALLBACK_2024 = {
  navarra: {
    paymentToState: 698.644,
    adjustmentsWithState: 1375.927,
    netFlowToState: -677.283,
  },
  paisVasco: {
    paymentToState: 1504.5,
    adjustmentsWithState: null,
    netFlowToState: null,
  },
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&iacute;', 'í')
    .replaceAll('&aacute;', 'á')
    .replaceAll('&eacute;', 'é')
    .replaceAll('&oacute;', 'ó')
    .replaceAll('&uacute;', 'ú')
    .replaceAll('&ntilde;', 'ñ')
    .replaceAll('&Iacute;', 'Í')
    .replaceAll('&Aacute;', 'Á')
    .replaceAll('&Eacute;', 'É')
    .replaceAll('&Oacute;', 'Ó')
    .replaceAll('&Uacute;', 'Ú')
    .replaceAll('&Ntilde;', 'Ñ')
    .replaceAll('&euro;', '€')
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
}

function parseSpanishNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(/\./g, '').replace(/,/g, '.').trim()
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function thousandsToMillions(value) {
  return value == null ? null : Number((value / 1000).toFixed(3))
}

function findRowValueByLabel(rows, expectedLabel, valueIndex) {
  const expected = normalizeText(expectedLabel)
  const row = rows.find((cells) => normalizeText(cells[0]).includes(expected))
  if (!row) return null
  return parseSpanishNumber(row[valueIndex])
}

function htmlTableToRows(html) {
  const rows = []
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || []
  for (const rowHtml of rowMatches) {
    const cells = [...rowHtml.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)].map((match) => {
      const withoutTags = decodeHtmlEntities(match[1]).replace(/<[^>]+>/g, ' ')
      return withoutTags.replace(/\s+/g, ' ').trim()
    })
    if (cells.length >= 3 && cells[0]) rows.push(cells)
  }
  return rows
}

export function parseNavarraForalFlow(html) {
  const rows = htmlTableToRows(html)
  const paymentThousands = findRowValueByLabel(rows, 'Total Pagos Aportación Neta', 2)
  const adjustmentsThousands = findRowValueByLabel(rows, 'Total Ajustes fiscales', 2)

  if (paymentThousands == null || adjustmentsThousands == null) {
    throw new Error('No se pudieron extraer métricas clave de Navarra (Cuadro 64)')
  }

  const paymentToState = thousandsToMillions(paymentThousands)
  const adjustmentsWithState = thousandsToMillions(adjustmentsThousands)

  return {
    paymentToState,
    adjustmentsWithState,
    netFlowToState: Number((paymentToState - adjustmentsWithState).toFixed(3)),
  }
}

export function parseEuskadiForalFlow(html) {
  const normalizedHtml = decodeHtmlEntities(html)
  const match = normalizedHtml.match(
    /CUPO\s+L[ÍI]QUIDO\s+PROV\s+M(?:€|EUR)?[\s\S]{0,300}?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
  )

  if (!match) {
    throw new Error('No se pudo localizar el cupo líquido provisional en la nota de Euskadi')
  }

  const paymentToState = parseSpanishNumber(match[1])
  if (paymentToState == null) {
    throw new Error('Valor de cupo líquido provisional no parseable')
  }

  return {
    paymentToState: Number(paymentToState.toFixed(3)),
    adjustmentsWithState: null,
    netFlowToState: null,
  }
}

function curlDownload(url) {
  return execFileSync(
    'curl',
    [
      '-LsS',
      '--retry',
      '2',
      '--retry-delay',
      '1',
      '--max-time',
      '60',
      url,
    ],
    { encoding: 'utf8', maxBuffer: 25 * 1024 * 1024 },
  )
}

async function fetchTextPreferFetchThenCurl(url) {
  try {
    const response = await fetchWithRetry(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DashboardFiscal/1.0)' } },
      { maxRetries: 2, timeoutMs: 45000 },
    )
    return await response.text()
  } catch (error) {
    console.warn(`  ⚠️ fetch falló para ${url}. Intentando curl...`)
    return curlDownload(url)
  }
}

function buildFallbackDataset() {
  return {
    lastUpdated: new Date().toISOString(),
    years: [2024],
    latestYear: 2024,
    byYear: {
      '2024': {
        entries: [
          {
            code: 'CA15',
            name: 'Navarra',
            regime: 'foral',
            paymentToState: FALLBACK_2024.navarra.paymentToState,
            adjustmentsWithState: FALLBACK_2024.navarra.adjustmentsWithState,
            netFlowToState: FALLBACK_2024.navarra.netFlowToState,
            detail: {
              paymentLabel: 'Total Pagos Aportación Neta',
              adjustmentsLabel: 'Total Ajustes fiscales',
              unit: 'M€',
            },
          },
          {
            code: 'CA16',
            name: 'País Vasco',
            regime: 'foral',
            paymentToState: FALLBACK_2024.paisVasco.paymentToState,
            adjustmentsWithState: FALLBACK_2024.paisVasco.adjustmentsWithState,
            netFlowToState: FALLBACK_2024.paisVasco.netFlowToState,
            detail: {
              paymentLabel: 'Cupo líquido provisional',
              adjustmentsLabel: null,
              unit: 'M€',
            },
          },
        ],
      },
    },
    coverage: {
      regime: 'foral',
      notes:
        'Indicadores forales (Navarra y País Vasco) no equivalentes metodológicamente a la liquidación de régimen común.',
    },
    sourceAttribution: {
      foral: {
        source: 'Gobierno de Navarra + Gobierno Vasco (CMCE)',
        type: 'fallback',
        url: NAVARRA_URL,
        date: '2024-12-31',
        note:
          'Fallback local: Navarra (Total Pagos Aportación Neta, Total Ajustes fiscales) + Euskadi (Cupo líquido provisional).',
      },
      navarra: {
        source: 'Gobierno de Navarra — Cuadro nº 64',
        type: 'fallback',
        url: NAVARRA_URL,
        date: '2024-12-31',
      },
      euskadi: {
        source: 'Gobierno Vasco — CMCE 2024',
        type: 'fallback',
        url: EUSKADI_URL,
        date: '2024-11-13',
      },
    },
  }
}

export async function downloadCcaaForalFlowsData() {
  console.log('\n=== Descargando flujos forales CCAA (Navarra y País Vasco) ===')
  console.log(`  Navarra: ${NAVARRA_URL}`)
  console.log(`  Euskadi:  ${EUSKADI_URL}`)

  try {
    const [navarraHtml, euskadiHtml] = await Promise.all([
      fetchTextPreferFetchThenCurl(NAVARRA_URL),
      fetchTextPreferFetchThenCurl(EUSKADI_URL),
    ])

    const navarra = parseNavarraForalFlow(navarraHtml)
    const paisVasco = parseEuskadiForalFlow(euskadiHtml)

    return {
      lastUpdated: new Date().toISOString(),
      years: [2024],
      latestYear: 2024,
      byYear: {
        '2024': {
          entries: [
            {
              code: 'CA15',
              name: 'Navarra',
              regime: 'foral',
              paymentToState: navarra.paymentToState,
              adjustmentsWithState: navarra.adjustmentsWithState,
              netFlowToState: navarra.netFlowToState,
              detail: {
                paymentLabel: 'Total Pagos Aportación Neta',
                adjustmentsLabel: 'Total Ajustes fiscales',
                unit: 'M€',
              },
            },
            {
              code: 'CA16',
              name: 'País Vasco',
              regime: 'foral',
              paymentToState: paisVasco.paymentToState,
              adjustmentsWithState: paisVasco.adjustmentsWithState,
              netFlowToState: paisVasco.netFlowToState,
              detail: {
                paymentLabel: 'Cupo líquido provisional',
                adjustmentsLabel: null,
                unit: 'M€',
              },
            },
          ],
        },
      },
      coverage: {
        regime: 'foral',
        notes:
          'Indicadores forales (Navarra y País Vasco) no equivalentes metodológicamente a la liquidación de régimen común.',
      },
      sourceAttribution: {
        foral: {
          source: 'Gobierno de Navarra + Gobierno Vasco (CMCE)',
          type: 'api',
          url: NAVARRA_URL,
          date: '2024-12-31',
          note:
            'Navarra: Cuadro nº 64 (Aportación neta y ajustes fiscales). Euskadi: nota CMCE 2024 (cupo líquido provisional).',
        },
        navarra: {
          source: 'Gobierno de Navarra — Cuadro nº 64',
          type: 'api',
          url: NAVARRA_URL,
          date: '2024-12-31',
        },
        euskadi: {
          source: 'Gobierno Vasco — CMCE 2024',
          type: 'api',
          url: EUSKADI_URL,
          date: '2024-11-13',
        },
      },
    }
  } catch (error) {
    console.warn(`  ⚠️ Error en descarga de flujos forales: ${error.message}`)
    console.warn('  ⚠️ Usando fallback local 2024')
    return buildFallbackDataset()
  }
}
