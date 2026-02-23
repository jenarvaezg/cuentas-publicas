# Checklist Territorial — CCAA -> Provincia -> Ayuntamiento

Estado del checklist: **23 febrero 2026** (actualizado tras `npm run download-data`).

## Objetivo

Construir cobertura fiscal territorial máxima y fresca para responder, con trazabilidad, a la pregunta: **en qué se gasta cada euro público en España**, bajando desde CCAA hasta ayuntamiento.

## Reglas de calidad

1. **Fallback = error** en pipeline: no se considera descarga válida.
2. **Identificador territorial canónico**: usar siempre códigos `CA01...CA17`.
3. **Trazabilidad obligatoria** por dataset: `source`, `url`, `date`, `type`.
4. **No publicar capa territorial incompleta** sin dejar explícito alcance y exclusiones.

## Cobertura actual (foto real)

| Capa | Cobertura | Último dato real | Estado |
| --- | --- | --- | --- |
| Deuda CCAA (BdE) | 17/17 | 2025-09-30 (`2025-Q3`) | ✅ |
| Recaudación CCAA (AEAT delegaciones) | 17/17 | 2024-12-31 (año 2024 completo) | ✅ |
| Balanzas fiscales CCAA (Hacienda) | 15/17 (régimen común) | 2023-12-31 | 🟡 |
| Gasto funcional por CCAA (oficial) | 17/17 | 2024-12-31 | ✅ |
| Cobertura provincial | 0/50 | N/A | ❌ |
| Cobertura municipal | 0/8.000+ | N/A | ❌ |

## Avances ya cerrados

- [x] Unificación de códigos `CAxx` entre BdE, AEAT y Hacienda para evitar cruces erróneos.
- [x] Integración en UI CCAA de saldo oficial de Hacienda (cuando aplica), manteniendo proxy como apoyo.
- [x] Test de integridad para detectar desalineación de códigos CCAA entre datasets.
- [x] Integración de gasto funcional oficial por CCAA (IGAE COFOG detalle, 17/17) en pipeline, API y bloque CCAA.

## Matriz Comunidad a Comunidad

| Código | Comunidad | Deuda CCAA | Recaudación AEAT | Balanza Hacienda | Gasto CCAA funcional | Provincia | Ayuntamiento | Próximo hito |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CA01 | Andalucía | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel provincial |
| CA02 | Aragón | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel provincial |
| CA03 | Asturias | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel provincial |
| CA04 | Illes Balears / Baleares | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel insular/local |
| CA05 | Canarias | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel isla/municipio |
| CA06 | Cantabria | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel municipal |
| CA07 | Castilla y León | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel provincial |
| CA08 | Castilla-La Mancha | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel provincial |
| CA09 | Cataluña | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel provincial |
| CA10 | C. Valenciana | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel provincial |
| CA11 | Extremadura | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel provincial |
| CA12 | Galicia | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel provincial |
| CA13 | Madrid | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel municipal |
| CA14 | Murcia | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel municipal |
| CA15 | Navarra | ✅ | ✅* | N/A** | ✅ | ❌ | ❌ | Definir fuente foral equivalente y bajar a provincia/municipio |
| CA16 | País Vasco | ✅ | ✅* | N/A** | ✅ | ❌ | ❌ | Definir fuente foral equivalente y bajar a provincia/municipio |
| CA17 | La Rioja | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Bajar a nivel municipal |

\* En AEAT delegaciones, Navarra y País Vasco no representan toda la recaudación foral.  
\** La fuente de balanzas de Hacienda es de régimen común y excluye territorios forales.

## Checklist operativo por comunidad

- [ ] CA01 Andalucía: completar provincia y ayuntamientos.
- [ ] CA02 Aragón: completar provincia y ayuntamientos.
- [ ] CA03 Asturias: completar provincia y ayuntamientos.
- [ ] CA04 Illes Balears: completar nivel insular/provincial y ayuntamientos.
- [ ] CA05 Canarias: completar nivel insular/provincial y ayuntamientos.
- [ ] CA06 Cantabria: completar ayuntamientos.
- [ ] CA07 Castilla y León: completar provincia y ayuntamientos.
- [ ] CA08 Castilla-La Mancha: completar provincia y ayuntamientos.
- [ ] CA09 Cataluña: completar provincia y ayuntamientos.
- [ ] CA10 C. Valenciana: completar provincia y ayuntamientos.
- [ ] CA11 Extremadura: completar provincia y ayuntamientos.
- [ ] CA12 Galicia: completar provincia y ayuntamientos.
- [ ] CA13 Madrid: completar ayuntamientos.
- [ ] CA14 Murcia: completar ayuntamientos.
- [ ] CA15 Navarra: completar fuente foral equivalente, provincia y ayuntamientos.
- [ ] CA16 País Vasco: completar fuente foral equivalente, provincia y ayuntamientos.
- [ ] CA17 La Rioja: completar ayuntamientos.

## Pendientes transversales (documentación y gobernanza)

- [ ] Registrar formalmente `ccaa-foral-flows` en `DATA-REGISTRY.md` (fuente, cobertura, frecuencia, fallback y mapa de archivos).
- [ ] Verificar que `API.md` documenta el endpoint `/api/v1/ccaa-foral-flows.json` y su semántica de comparabilidad foral vs régimen común.
- [ ] Añadir regla operativa: alta de dataset en pipeline/API implica actualización obligatoria de `DATA-REGISTRY.md` y `API.md` en el mismo PR.

## Orden recomendado de ejecución

1. **Bajar a provincia** empezando por CCAA con mayor peso presupuestario (Andalucía, Cataluña, Madrid, C. Valenciana).
2. **Bajar a ayuntamiento** con un MVP de grandes municipios y escalar al resto.
3. **Resolver fuente foral equivalente** para CA15 y CA16 en balanzas (aunque el gasto COFOG sí está cubierto).
4. **Añadir control de frescura por capa** (CCAA/provincia/municipio) en `meta.json`.
