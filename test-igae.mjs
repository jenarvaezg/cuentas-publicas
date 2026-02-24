import https from 'https'

const url = 'https://www.hacienda.gob.es/Documentacion/Publico/NormativaDoctrina/EstrategiaPoliticaEconomica/ContabilidadNacional/SubsectorCCAA/1.capacidad_necesidad_financiacion_sectores.xlsx'

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
  }
}, (res) => {
  console.log(`Status: ${res.statusCode}`)
  if (res.headers.location) console.log(`Redirect: ${res.headers.location}`)
}).on('error', console.error)
