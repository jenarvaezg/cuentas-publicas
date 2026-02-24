import XLSX from 'xlsx'
import { fetchWithRetry } from '../lib/fetch-utils.mjs'
import fs from 'fs'
import path from 'path'

const SS_BASE = 'https://www.seg-social.es'
const EST24_URL = `${SS_BASE}/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/EST23/EST24`
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const REGION_MAP = {
    'Andalucía': 'CA01',
    'Aragón': 'CA02',
    'Asturias': 'CA03',
    'Balears': 'CA04',
    'Canarias': 'CA05',
    'Cantabria': 'CA06',
    'Castilla y León': 'CA07',
    'Castilla - La Mancha': 'CA08',
    'Cataluña': 'CA09',
    'Comunitat Valenciana': 'CA10',
    'Extremadura': 'CA11',
    'Galicia': 'CA12',
    'Madrid': 'CA13',
    'Murcia': 'CA14',
    'Navarra': 'CA15',
    'País Vasco': 'CA16',
    'Rioja (La)': 'CA17',
    'Ceuta': 'CA18',
    'Melilla': 'CA19'
};

// Aliases for matching rows from Excel
const ALIASES = {
    'ASTURIAS (PRINCIPADO DE)': 'CA03',
    'BALEARS (ILLES)': 'CA04',
    'COMUNITAT VALENCIANA': 'CA10',
    'MADRID (COMUNIDAD DE)': 'CA13',
    'MURCIA (REGION DE)': 'CA14',
    'NAVARRA (COMUNIDAD FORAL DE)': 'CA15',
    'LA RIOJA': 'CA17',
    'RIOJA (LA)': 'CA17'
};

function normalizeExcelUrl(pathOrUrl) {
    const cleaned = String(pathOrUrl || '').replace(/&amp;/g, '&').trim()
    if (!cleaned) return null

    try {
        return new URL(cleaned, `${SS_BASE}/`).toString()
    } catch {
        if (cleaned.startsWith('http')) return cleaned
        return `${SS_BASE}${cleaned}`
    }
}

function buildRecentCAFallbackUrls(months = 4) {
    const fallback = []
    const today = new Date()

    for (let i = 0; i < months; i++) {
        const dt = new Date(today.getFullYear(), today.getMonth() - i, 1)
        const yyyymm = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}`
        fallback.push(`${SS_BASE}/CA${yyyymm}.xlsx`)
        fallback.push(`${SS_BASE}/wps/wcm/connect/wss/CA${yyyymm}.xlsx`)
    }

    return fallback
}

function collectExcelCandidates(html) {
    const allXlsx = [...html.matchAll(/href=["']([^"']*\.xlsx[^"']*)["']/gi)]
    const caUrlsFromPage = allXlsx
        .map(match => normalizeExcelUrl(match[1]))
        .filter(Boolean)
        .filter(url => /CA\d{6}\.xlsx/i.test(url))

    const candidateUrls = [
        ...caUrlsFromPage,
        ...buildRecentCAFallbackUrls(4)
    ].filter(Boolean)

    return [...new Set(candidateUrls)]
}

function parseExcelMetadata(excelUrl) {
    const filename = excelUrl.split('/').pop()?.split('?')[0] || 'CA_unknown.xlsx'
    const dateMatch = filename.match(/CA(\d{4})(\d{2})/)
    const excelDate = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2]}-01`
        : new Date().toISOString().split('T')[0]
    const monthLabel = dateMatch
        ? `${MONTH_NAMES[parseInt(dateMatch[2]) - 1]} ${dateMatch[1]}`
        : 'fecha desconocida'

    const year = dateMatch ? parseInt(dateMatch[1]) : new Date().getFullYear();

    return { filename, excelDate, monthLabel, year }
}

function normalizeRegionName(name) {
    return name.trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/\s+/g, ' '); // collapse all whitespace and newlines
}

function standardizeRegionCode(rawName) {
    const normalized = normalizeRegionName(rawName);

    // Check aliases
    for (const [key, code] of Object.entries(ALIASES)) {
        if (normalizeRegionName(key) === normalized) return code;
    }

    // Try exact match or partial match
    for (const [key, code] of Object.entries(REGION_MAP)) {
        if (normalizeRegionName(key) === normalized) return code;
    }
    return null;
}

function parseCAExcelBuffer(buffer, excelUrl) {
    const { excelDate, monthLabel, year } = parseExcelMetadata(excelUrl)
    const wb = XLSX.read(Buffer.from(buffer), { type: 'buffer' })
    console.log(`    Hojas: ${wb.SheetNames.join(', ')}`)

    // Parse "CA_Total sistema" sheet for regional totals
    const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('ca_total sistema'))
        || wb.SheetNames[1] // Usually second sheet

    if (!sheetName) {
        throw new Error('No se encontró hoja de CA Total sistema')
    }

    console.log(`    Usando hoja: "${sheetName}"`)

    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

    const entries = [];

    // Find table rows
    // Structure: [RegionName, totalNum, totalImporte, totalMedia, ...]
    let totalNacional = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue;

        const firstCell = String(row[0] || '').trim();
        if (!firstCell) continue;

        // Check if it's the Total
        if (firstCell.toUpperCase() === 'TOTAL SISTEMA') {
            const imp = parseFloat(row[2]);
            if (!isNaN(imp)) totalNacional = imp * 14;
            continue;
        }

        // Check if it's a valid region mapping
        const code = standardizeRegionCode(firstCell);
        if (code) {
            // We found a CCAA
            const numPensions = parseFloat(row[1]);
            const monthlyAmount = parseFloat(row[2]);

            if (!isNaN(monthlyAmount)) {
                // Pensiones are paid in 14 payrolls a year
                const annualAmount = monthlyAmount * 14;

                // Find name from standard map just for cleanliness
                const stdName = Object.keys(REGION_MAP).find(k => REGION_MAP[k] === code) || firstCell;

                entries.push({
                    code,
                    name: stdName,
                    annualAmount,
                    monthlyAmount,
                    pensionsCount: numPensions
                });
            }
        }
    }

    if (entries.length === 0) {
        throw new Error('No se encontraron filas válidas de Comunidades Autónomas en el Excel')
    }

    // Sort by code
    entries.sort((a, b) => a.code.localeCompare(b.code));

    console.log()
    console.log('  📊 Datos extraídos del Excel:')
    console.log(`    CCAA encontradas: ${entries.length}`)
    console.log(`    Gasto Anual Estimado (x14): ${(totalNacional / 1_000_000_000).toFixed(3)}B€`)

    return {
        lastUpdated: new Date().toISOString(),
        latestYear: year,
        byYear: {
            [year]: {
                year,
                date: excelDate,
                dateLabel: monthLabel,
                entries
            }
        },
        source: `Seg. Social — Excel REG CA (${monthLabel})`,
        url: excelUrl
    }
}

export async function downloadRegionalPensionsData() {
    console.log('\n=== Descargando pensiones por CCAA (Seguridad Social) ===')
    console.log()
    console.log('  Estrategia: scraping Excel territorial desde Seg. Social')
    console.log(`  Página índice: ${EST24_URL}`)
    console.log()

    let liveData = null
    let liveDataError = null

    try {
        liveData = await fetchFromSSCAExcel()
    } catch (error) {
        liveDataError = error?.message || 'error desconocido'
        console.log(`  ❌ Error en scraping: ${error.message}`)
    }

    if (liveData) {
        console.log()
        console.log('  ✅ Datos territoriales obtenidos de Seg. Social (Excel)')
        console.log()
        return liveData;
    } else {
        console.log()
        console.log('  ⚠️  No se pudieron obtener datos en vivo → usando fallback estático')
        console.log()
        return getFallbackData();
    }
}

async function fetchFromSSCAExcel() {
    console.log('  1. Descargando página índice EST24...')
    console.log(`    URL: ${EST24_URL}`)

    const pageResponse = await fetchWithRetry(EST24_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DashboardFiscal/1.0)',
            'Accept': 'text/html'
        }
    }, { timeoutMs: 15000 })

    const html = await pageResponse.text()

    console.log()
    console.log('  2. Buscando enlaces CA*.xlsx...')
    const candidateExcelUrls = collectExcelCandidates(html)
    console.log(`    Candidatos CA*.xlsx: ${candidateExcelUrls.length}`)

    if (candidateExcelUrls.length === 0) {
        throw new Error('No se encontraron candidatos CA*.xlsx en la página ni en fallback local')
    }

    console.log()
    console.log('  3. Descargando y validando Excel territorial...')

    let lastError = null
    for (let i = 0; i < Math.min(candidateExcelUrls.length, 5); i++) {
        const candidateUrl = candidateExcelUrls[i]
        const { filename, monthLabel } = parseExcelMetadata(candidateUrl)
        console.log(`    [${i + 1}] Probando ${filename} (${monthLabel})`)

        try {
            const xlsxResponse = await fetchWithRetry(candidateUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; DashboardFiscal/1.0)'
                }
            }, { timeoutMs: 15000 })

            const buffer = await xlsxResponse.arrayBuffer()
            console.log(`      Descargado: ${(buffer.byteLength / 1024).toFixed(1)} KB`)
            return parseCAExcelBuffer(buffer, candidateUrl)
        } catch (error) {
            lastError = error
            console.warn(`      ⚠️  Falló ${filename}: ${error.message}`)
        }
    }

    throw new Error(`No se pudo procesar ningún Excel CA*.xlsx. Último error: ${lastError?.message || 'desconocido'}`)
}

function getFallbackData() {
    // 2024 Reference points if fetching fails
    const year = 2024;
    return {
        lastUpdated: new Date().toISOString(),
        latestYear: year,
        byYear: {
            "2024": {
                year: 2024,
                date: "2024-12-01",
                dateLabel: "diciembre 2024",
                entries: [
                    { code: "CA01", name: "Andalucía", annualAmount: 28400000000, pensionsCount: 1650000 },
                    { code: "CA02", name: "Aragón", annualAmount: 6200000000, pensionsCount: 310000 },
                    { code: "CA03", name: "Asturias", annualAmount: 6400000000, pensionsCount: 300000 },
                    { code: "CA04", name: "Balears", annualAmount: 2700000000, pensionsCount: 200000 },
                    { code: "CA05", name: "Canarias", annualAmount: 4800000000, pensionsCount: 350000 },
                    { code: "CA06", name: "Cantabria", annualAmount: 2400000000, pensionsCount: 145000 },
                    { code: "CA07", name: "Castilla y León", annualAmount: 9700000000, pensionsCount: 620000 },
                    { code: "CA08", name: "Castilla - La Mancha", annualAmount: 5500000000, pensionsCount: 385000 },
                    { code: "CA09", name: "Cataluña", annualAmount: 31000000000, pensionsCount: 1770000 },
                    { code: "CA10", name: "Comunitat Valenciana", annualAmount: 16500000000, pensionsCount: 1040000 },
                    { code: "CA11", name: "Extremadura", annualAmount: 3400000000, pensionsCount: 235000 },
                    { code: "CA12", name: "Galicia", annualAmount: 10500000000, pensionsCount: 770000 },
                    { code: "CA13", name: "Madrid", annualAmount: 23000000000, pensionsCount: 1220000 },
                    { code: "CA14", name: "Murcia", annualAmount: 3500000000, pensionsCount: 255000 },
                    { code: "CA15", name: "Navarra", annualAmount: 2600000000, pensionsCount: 140000 },
                    { code: "CA16", name: "País Vasco", annualAmount: 10200000000, pensionsCount: 575000 },
                    { code: "CA17", name: "Rioja (La)", annualAmount: 1100000000, pensionsCount: 73000 }
                ]
            }
        },
        source: "Estimación Fallback",
        url: ""
    }
}
