export const SITE_URL = "https://cuentas-publicas.es";

export const SECTION_PAGE_DEFS = [
  {
    id: "resumen",
    slugEs: "resumen",
    slugEn: "overview",
    titleEs: "Resumen Fiscal de España",
    titleEn: "Spain Fiscal Overview",
    descriptionEs:
      "Visión general de deuda, pensiones, gasto e ingresos públicos de España.",
    descriptionEn:
      "High-level overview of Spain debt, pensions, spending and public revenue.",
  },
  {
    id: "deuda",
    slugEs: "deuda",
    slugEn: "debt",
    titleEs: "Deuda Pública de España",
    titleEn: "Spain Public Debt",
    descriptionEs:
      "Métricas clave de deuda pública PDE, per cápita y ratio deuda/PIB.",
    descriptionEn:
      "Key EDP public debt metrics, debt per capita and debt-to-GDP ratio.",
  },
  {
    id: "coste-deuda",
    slugEs: "coste-deuda",
    slugEn: "debt-cost",
    titleEs: "Coste de la Deuda Pública",
    titleEn: "Public Debt Cost",
    descriptionEs:
      "Gasto anual en intereses y coste medio estimado de la deuda pública.",
    descriptionEn:
      "Annual interest spending and estimated average cost of public debt.",
  },
  {
    id: "pensiones",
    slugEs: "pensiones",
    slugEn: "pensions",
    titleEs: "Pensiones y Seguridad Social",
    titleEn: "Pensions and Social Security",
    descriptionEs:
      "Nómina mensual, déficit contributivo y ratio cotizantes/pensionista.",
    descriptionEn:
      "Monthly payroll, contributory deficit and contributors-per-pensioner ratio.",
  },
  {
    id: "ingresos-gastos",
    slugEs: "ingresos-gastos",
    slugEn: "revenue-spending",
    titleEs: "Ingresos y Gastos Públicos",
    titleEn: "Public Revenue and Expenditure",
    descriptionEs:
      "Evolución histórica de ingresos, gastos y balance fiscal en España.",
    descriptionEn:
      "Historical evolution of public revenue, expenditure and fiscal balance in Spain.",
  },
  {
    id: "gasto-cofog",
    slugEs: "gasto-cofog",
    slugEn: "cofog-spending",
    titleEs: "Gasto Público COFOG",
    titleEn: "COFOG Public Spending",
    descriptionEs:
      "Desglose funcional del gasto público por categorías COFOG.",
    descriptionEn:
      "Functional public spending breakdown by COFOG categories.",
  },
  {
    id: "recaudacion",
    slugEs: "recaudacion",
    slugEn: "tax-revenue",
    titleEs: "Recaudación Tributaria",
    titleEn: "Tax Revenue",
    descriptionEs:
      "Desglose de la recaudación tributaria por impuesto y comunidad autónoma.",
    descriptionEn:
      "Tax revenue breakdown by tax type and autonomous community.",
  },
  {
    id: "ue",
    slugEs: "comparativa-ue",
    slugEn: "eu-comparison",
    titleEs: "Comparativa Europea",
    titleEn: "European Comparison",
    descriptionEs:
      "Comparación de España frente a UE-27 y países de referencia.",
    descriptionEn:
      "Comparison of Spain vs EU-27 and benchmark countries.",
  },
  {
    id: "ccaa",
    slugEs: "ccaa",
    slugEn: "regions",
    titleEs: "Deuda por Comunidad Autónoma",
    titleEn: "Debt by Region",
    descriptionEs:
      "Ranking y detalle de deuda de las Comunidades Autónomas.",
    descriptionEn:
      "Ranking and details of debt across autonomous regions.",
  },
  {
    id: "sostenibilidad-ss",
    slugEs: "sostenibilidad-ss",
    slugEn: "ss-sustainability",
    titleEs: "Sostenibilidad de la Seguridad Social",
    titleEn: "Social Security Sustainability",
    descriptionEs:
      "Ingresos, gastos, Fondo de Reserva, cotizantes/pensionista y proyecciones del sistema de pensiones.",
    descriptionEn:
      "Revenue, expenditure, Reserve Fund, contributors per pensioner and pension system projections.",
  },
  {
    id: "metodologia",
    slugEs: "metodologia",
    slugEn: "methodology",
    titleEs: "Metodología y Fuentes",
    titleEn: "Methodology and Sources",
    descriptionEs:
      "Cómo se descargan, validan y transforman los datos del dashboard.",
    descriptionEn:
      "How dashboard data is downloaded, validated and transformed.",
  },
];

export function buildSeoSnapshotHtml({ meta, debt, pensions, budget, revenue }) {
  const debtTotal = debt?.current?.totalDebt;
  const debtDate =
    debt?.historical?.[debt.historical.length - 1]?.date || "N/D";
  const pensionsMonthly = pensions?.current?.monthlyPayroll;
  const pensionsDate =
    pensions?.sourceAttribution?.monthlyPayroll?.date || "N/D";
  const latestBudgetYear = budget?.latestYear || "N/D";
  const budgetTotal =
    latestBudgetYear !== "N/D"
      ? budget?.byYear?.[String(latestBudgetYear)]?.total
      : null;
  const latestRevenueYear = revenue?.latestYear || "N/D";

  const fmt = new Intl.NumberFormat("es-ES");
  const fmtCompact = new Intl.NumberFormat("es-ES", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const debtLabel = Number.isFinite(debtTotal)
    ? `${fmtCompact.format(debtTotal)} €`
    : "N/D";
  const pensionsLabel = Number.isFinite(pensionsMonthly)
    ? `${fmtCompact.format(pensionsMonthly)} €/mes`
    : "N/D";
  const budgetLabel = Number.isFinite(budgetTotal)
    ? `${fmt.format(Math.round(budgetTotal))} M€`
    : "N/D";

  const lastUpdated = new Date(meta.lastDownload).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Snapshot SEO | Cuentas Públicas</title>
    <meta name="description" content="Resumen estático pre-renderizado de Cuentas Públicas de España para SEO." />
    <link rel="canonical" href="${SITE_URL}/seo-snapshot.html" />
    <style>
      body { font-family: Manrope, system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #0f172a; }
      h1 { margin-bottom: .5rem; }
      .muted { color: #475569; }
      .grid { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 1rem; }
      .card { border: 1px solid #cbd5e1; border-radius: .75rem; padding: .85rem 1rem; background: #f8fafc; }
      .label { font-size: .82rem; color: #334155; margin-bottom: .35rem; }
      .value { font-weight: 700; font-size: 1.05rem; }
      ul { margin-top: .5rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Cuentas Públicas de España en Tiempo Real</h1>
      <p class="muted">Snapshot pre-renderizado para motores de búsqueda. Actualizado: ${lastUpdated}.</p>

      <section class="grid" aria-label="Métricas principales">
        <article class="card">
          <div class="label">Deuda pública total</div>
          <div class="value">${debtLabel}</div>
          <div class="muted">Último dato oficial: ${debtDate}</div>
        </article>
        <article class="card">
          <div class="label">Nómina mensual de pensiones</div>
          <div class="value">${pensionsLabel}</div>
          <div class="muted">Referencia de dato: ${pensionsDate}</div>
        </article>
        <article class="card">
          <div class="label">Gasto COFOG (último año)</div>
          <div class="value">${budgetLabel}</div>
          <div class="muted">Año: ${latestBudgetYear}</div>
        </article>
        <article class="card">
          <div class="label">Ingresos/Gastos públicos (último año)</div>
          <div class="value">${latestRevenueYear}</div>
          <div class="muted">Serie anual Eurostat</div>
        </article>
      </section>

      <section>
        <h2>Fuentes oficiales</h2>
        <ul>
          <li>Banco de España (deuda PDE)</li>
          <li>INE (población, PIB, IPC, EPA)</li>
          <li>Seguridad Social (pensiones contributivas)</li>
          <li>IGAE (COFOG)</li>
          <li>Eurostat (comparativa UE e ingresos/gastos)</li>
        </ul>
      </section>

      <p class="muted">Versión interactiva: <a href="${SITE_URL}/">${SITE_URL}/</a></p>
    </main>
  </body>
</html>`;
}

export function formatSnapshotMetrics({
  debt,
  pensions,
  budget,
  revenue,
  locale,
}) {
  const debtTotal = debt?.current?.totalDebt;
  const debtDate =
    debt?.historical?.[debt.historical.length - 1]?.date ||
    (locale === "en-US" ? "N/A" : "N/D");
  const pensionsMonthly = pensions?.current?.monthlyPayroll;
  const pensionsDate =
    pensions?.sourceAttribution?.monthlyPayroll?.date ||
    (locale === "en-US" ? "N/A" : "N/D");
  const latestBudgetYear =
    budget?.latestYear || (locale === "en-US" ? "N/A" : "N/D");
  const budgetTotal =
    typeof latestBudgetYear === "number"
      ? budget?.byYear?.[String(latestBudgetYear)]?.total
      : null;
  const latestRevenueYear =
    revenue?.latestYear || (locale === "en-US" ? "N/A" : "N/D");

  const fmt = new Intl.NumberFormat(locale);
  const fmtCompact = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const debtLabel = Number.isFinite(debtTotal)
    ? `${fmtCompact.format(debtTotal)} €`
    : locale === "en-US"
      ? "N/A"
      : "N/D";
  const pensionsLabel = Number.isFinite(pensionsMonthly)
    ? `${fmtCompact.format(pensionsMonthly)} ${locale === "en-US" ? "€/month" : "€/mes"}`
    : locale === "en-US"
      ? "N/A"
      : "N/D";
  const budgetLabel = Number.isFinite(budgetTotal)
    ? `${fmt.format(Math.round(budgetTotal))} ${locale === "en-US" ? "M€" : "M€"}`
    : locale === "en-US"
      ? "N/A"
      : "N/D";

  return {
    debtLabel,
    debtDate,
    pensionsLabel,
    pensionsDate,
    budgetLabel,
    latestBudgetYear,
    latestRevenueYear,
  };
}

export function buildSectionPath(section, lang) {
  return lang === "en"
    ? `/en/sections/${section.slugEn}.html`
    : `/secciones/${section.slugEs}.html`;
}

export function buildSectionSnapshotPages({
  meta,
  debt,
  pensions,
  budget,
  revenue,
}) {
  const pages = {};

  for (const section of SECTION_PAGE_DEFS) {
    for (const lang of ["es", "en"]) {
      const routePath = buildSectionPath(section, lang);
      pages[`public${routePath}`] = buildSectionSnapshotHtml({
        section,
        lang,
        meta,
        debt,
        pensions,
        budget,
        revenue,
      });
    }
  }

  return pages;
}

export function buildSectionSnapshotHtml({
  section,
  lang,
  meta,
  debt,
  pensions,
  budget,
  revenue,
}) {
  const isEnglish = lang === "en";
  const locale = isEnglish ? "en-US" : "es-ES";
  const title = isEnglish ? section.titleEn : section.titleEs;
  const description = isEnglish ? section.descriptionEn : section.descriptionEs;
  const routePath = buildSectionPath(section, lang);
  const interactiveUrl = `${SITE_URL}/?section=${section.id}${isEnglish ? "&lang=en" : ""}`;
  const lastUpdated = new Date(meta.lastDownload).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const metrics = formatSnapshotMetrics({
    debt,
    pensions,
    budget,
    revenue,
    locale,
  });

  const labels = isEnglish
    ? {
        heading: "Static route for SEO indexing",
        debt: "Public debt",
        debtDate: "Latest official date",
        pensions: "Monthly pensions payroll",
        pensionsDate: "Data reference",
        budget: "COFOG spending",
        budgetYear: "Year",
        revenue: "Revenue/expenditure latest year",
        revenueSeries: "Eurostat annual series",
        cta: "Open interactive dashboard section",
        home: "Back to dashboard home",
        language: "Language",
        methodology:
          "This page is generated automatically from the same datasets used by the SPA.",
      }
    : {
        heading: "Ruta estática para indexación SEO",
        debt: "Deuda pública",
        debtDate: "Última fecha oficial",
        pensions: "Nómina mensual de pensiones",
        pensionsDate: "Referencia de dato",
        budget: "Gasto COFOG",
        budgetYear: "Año",
        revenue: "Ingresos/gastos último año",
        revenueSeries: "Serie anual Eurostat",
        cta: "Abrir sección interactiva del dashboard",
        home: "Volver al inicio del dashboard",
        language: "Idioma",
        methodology:
          "Esta página se genera automáticamente con los mismos datasets de la SPA.",
      };

  return `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} | ${isEnglish ? "Spain Public Accounts" : "Cuentas Públicas de España"}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${SITE_URL}${routePath}" />
    <link rel="alternate" hreflang="es" href="${SITE_URL}${buildSectionPath(section, "es")}" />
    <link rel="alternate" hreflang="en" href="${SITE_URL}${buildSectionPath(section, "en")}" />
    <style>
      body { font-family: Manrope, system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #0f172a; }
      h1 { margin-bottom: .4rem; }
      .muted { color: #475569; }
      .grid { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 1rem; }
      .card { border: 1px solid #cbd5e1; border-radius: .75rem; padding: .85rem 1rem; background: #f8fafc; }
      .label { font-size: .82rem; color: #334155; margin-bottom: .35rem; }
      .value { font-weight: 700; font-size: 1.05rem; }
      .cta { display: inline-block; margin-top: 1rem; border: 1px solid #1d4ed8; color: #1d4ed8; text-decoration: none; border-radius: .6rem; padding: .5rem .75rem; }
      .cta:hover { background: #eff6ff; }
      .links { margin-top: .8rem; display: flex; gap: .8rem; flex-wrap: wrap; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p class="muted">${labels.heading} · ${description}</p>
      <p class="muted">${labels.methodology} ${isEnglish ? "Updated" : "Actualizado"}: ${lastUpdated}.</p>

      <section class="grid" aria-label="${isEnglish ? "Main metrics" : "Métricas principales"}">
        <article class="card">
          <div class="label">${labels.debt}</div>
          <div class="value">${metrics.debtLabel}</div>
          <div class="muted">${labels.debtDate}: ${metrics.debtDate}</div>
        </article>
        <article class="card">
          <div class="label">${labels.pensions}</div>
          <div class="value">${metrics.pensionsLabel}</div>
          <div class="muted">${labels.pensionsDate}: ${metrics.pensionsDate}</div>
        </article>
        <article class="card">
          <div class="label">${labels.budget}</div>
          <div class="value">${metrics.budgetLabel}</div>
          <div class="muted">${labels.budgetYear}: ${metrics.latestBudgetYear}</div>
        </article>
        <article class="card">
          <div class="label">${labels.revenue}</div>
          <div class="value">${metrics.latestRevenueYear}</div>
          <div class="muted">${labels.revenueSeries}</div>
        </article>
      </section>

      <a class="cta" href="${interactiveUrl}">${labels.cta}</a>
      <div class="links">
        <a href="${SITE_URL}/">${labels.home}</a>
        <a href="${SITE_URL}${routePath}">${labels.language}: ${lang.toUpperCase()}</a>
      </div>
    </main>
  </body>
</html>`;
}

export function buildSitemapXml(lastDownload) {
  const isoDate = new Date(lastDownload).toISOString();
  const routes = [
    { path: "/", priority: "1.0", changefreq: "daily" },
    { path: "/seo-snapshot.html", priority: "0.8", changefreq: "weekly" },
    { path: "/api/v1/index.json", priority: "0.6", changefreq: "weekly" },
    { path: "/feed.xml", priority: "0.6", changefreq: "daily" },
  ];

  for (const section of SECTION_PAGE_DEFS) {
    routes.push({
      path: buildSectionPath(section, "es"),
      priority: "0.55",
      changefreq: "weekly",
    });
    routes.push({
      path: buildSectionPath(section, "en"),
      priority: "0.55",
      changefreq: "weekly",
    });
  }

  const urls = routes
    .map(
      (route) => `  <url>
    <loc>${SITE_URL}${route.path}</loc>
    <lastmod>${isoDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildRssFeed(meta) {
  const updatedAt = new Date(meta.lastDownload);
  const buildDate = updatedAt.toUTCString();
  const sourceEntries = Object.entries(meta.sources || {});

  const overviewItem = {
    title: "Actualización automática de datasets fiscales",
    link: `${SITE_URL}/seo-snapshot.html`,
    guid: `update-${updatedAt.toISOString()}`,
    pubDate: buildDate,
    description: `Generación completada en ${updatedAt.toISOString()} con ${sourceEntries.length} fuentes monitorizadas.`,
  };

  const sourceItems = sourceEntries.map(([name, info]) => {
    const freshnessDate =
      info.lastRealDataDate || info.lastUpdated || meta.lastDownload;
    const statusLabel = info.success ? "OK" : "ERROR";
    const fallbackNote =
      name === "pensions" && info.criticalFallback
        ? ` FALLBACK CRÍTICO: ${info.criticalFallbackReason || "sin motivo reportado"}.`
        : "";

    return {
      title: `[${statusLabel}] ${name}`,
      link: `${SITE_URL}/api/v1/meta.json`,
      guid: `${name}-${freshnessDate}-${info.lastFetchAt || meta.lastDownload}`,
      pubDate: new Date(
        info.lastFetchAt || meta.lastDownload,
      ).toUTCString(),
      description: `Fuente ${name}. Fecha real de dato: ${freshnessDate}.${fallbackNote}`,
    };
  });

  const allItems = [overviewItem, ...sourceItems]
    .map(
      (item) => `  <item>
    <title>${escapeXml(item.title)}</title>
    <link>${escapeXml(item.link)}</link>
    <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
    <pubDate>${escapeXml(item.pubDate)}</pubDate>
    <description>${escapeXml(item.description)}</description>
  </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Cuentas Públicas de España — Actualizaciones</title>
  <link>${SITE_URL}/</link>
  <description>Feed RSS con actualizaciones automáticas del pipeline de datos fiscales.</description>
  <language>es-es</language>
  <lastBuildDate>${buildDate}</lastBuildDate>
${allItems}
</channel>
</rss>`;
}
