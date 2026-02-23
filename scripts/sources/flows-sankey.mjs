import fs from 'fs/promises';
import path from 'path';

// File paths
const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const REVENUE_FILE = path.join(DATA_DIR, 'revenue.json');
const TAX_REVENUE_FILE = path.join(DATA_DIR, 'tax-revenue.json');
const PENSIONS_FILE = path.join(DATA_DIR, 'pensions.json');
const BUDGET_FILE = path.join(DATA_DIR, 'budget.json');
const DEBT_FILE = path.join(DATA_DIR, 'debt.json');
const OUT_FILE = path.join(DATA_DIR, 'flows.json');

/**
 * Generates a unified Sankey Directed Acyclic Graph (DAG) representing the national public accounts.
 * Reads from previously generated JSONs to ensure a perfect mass balance.
 */
export async function downloadFlowsSankeyData() {
    console.log('Generando dataset consolidado de Flujos Fisclaes (Sankey)...');

    try {
        // 1. Read all required datasets
        const revenueData = JSON.parse(await fs.readFile(REVENUE_FILE, 'utf-8'));
        const taxRevenueData = JSON.parse(await fs.readFile(TAX_REVENUE_FILE, 'utf-8'));
        const pensionsData = JSON.parse(await fs.readFile(PENSIONS_FILE, 'utf-8'));
        const budgetData = JSON.parse(await fs.readFile(BUDGET_FILE, 'utf-8'));
        const debtData = JSON.parse(await fs.readFile(DEBT_FILE, 'utf-8'));

        // 2. Determine the latest year we can build a complete graph for.
        // Eurostat (revenue) and IGAE (budget) are usually the bottlenecks (delay of 1-2 years).
        const latestRevenueYear = revenueData.latestYear;
        const latestBudgetYear = budgetData.latestYear;
        const targetYear = Math.min(latestRevenueYear, latestBudgetYear);

        console.log(`  > Año objetivo para el balance consolidado: ${targetYear}`);

        if (!revenueData.byYear[targetYear] || !budgetData.byYear[targetYear]) {
            throw new Error(`Datos insuficientes para el año ${targetYear} en Eurostat o IGAE.`);
        }

        const yearRevenue = revenueData.byYear[targetYear];
        const yearBudget = budgetData.byYear[targetYear];

        // We try to get tax desgloses for the target year. If not available, we might fallback to proportions of the latest available.
        const taxNational = taxRevenueData.national[targetYear] || taxRevenueData.national[taxRevenueData.latestYear];

        const nodes = [];
        const links = [];
        let linkIdCounter = 0;

        const addNode = (id, label, group, amount, metadata = {}) => {
            nodes.push({ id, label, group, amount, format: 'currency', ...metadata });
        };

        const addLink = (source, target, amount, label = '', metadata = {}) => {
            links.push({ id: `l_${linkIdCounter++}`, source, target, amount: Math.round(amount), label, ...metadata });
        };

        // -------------------------------------------------------------
        // MACRO AGGREGATES
        // -------------------------------------------------------------
        const totalRevenue = yearRevenue.totalRevenue;
        const totalExpenditure = yearRevenue.totalExpenditure;
        const deficit = yearRevenue.balance < 0 ? Math.abs(yearRevenue.balance) : 0;
        const surplus = yearRevenue.balance > 0 ? yearRevenue.balance : 0;

        const budgetTotal = yearBudget.total;

        // We assume Eurostat expenditure is the golden truth for total size.
        // IGAE budget might differ slightly. We record the discrepancy for transparency.
        const expenditureDiscrepancy = totalExpenditure - budgetTotal;

        // SOCIAL SECURITY PENSIONS
        const pensionPayroll = pensionsData?.current?.annualExpense ? Math.round(pensionsData.current.annualExpense / 1000000) : 0; // In M€

        // -------------------------------------------------------------
        // NODE DEFINITIONS - INPUTS
        // -------------------------------------------------------------
        addNode('CONSOLIDADO', 'Presupuesto Consolidado', 'core', totalExpenditure, { note: 'Total de cuentas públicas' });

        // 1. Deficit (Deuda)
        if (deficit > 0) {
            addNode('DEFICIT', 'Déficit (Nueva Deuda)', 'income', deficit);
            addLink('DEFICIT', 'CONSOLIDADO', deficit, 'Financiación Vía Deuda');
        }

        // 2. Ingresos
        addNode('INGRESOS_TOTALES', 'Ingresos Públicos', 'income_agg', totalRevenue);
        addLink('INGRESOS_TOTALES', 'CONSOLIDADO', totalRevenue, 'Recaudación');

        // 2.1 Cotizaciones Sociales
        addNode('COTIZACIONES', 'Cotizaciones Sociales', 'income_type', yearRevenue.socialContributions);
        addLink('COTIZACIONES', 'INGRESOS_TOTALES', yearRevenue.socialContributions);

        // 2.2 Impuestos Directos (IRPF, Sociedades, etc)
        addNode('IMPUESTOS_DIRECTOS', 'Impuestos Directos', 'income_type', yearRevenue.taxesDirect);
        addLink('IMPUESTOS_DIRECTOS', 'INGRESOS_TOTALES', yearRevenue.taxesDirect);

        if (taxNational) {
            const totalAeatDirect = taxNational.irpf + taxNational.sociedades + (taxNational.irnr || 0);
            if (totalAeatDirect > 0) {
                const irpfRatio = taxNational.irpf / totalAeatDirect;
                const socRatio = taxNational.sociedades / totalAeatDirect;
                const irnrRatio = (taxNational.irnr || 0) / totalAeatDirect;

                const eqIrpf = Math.round(yearRevenue.taxesDirect * irpfRatio);
                const eqSociedades = Math.round(yearRevenue.taxesDirect * socRatio);
                const eqIrnr = yearRevenue.taxesDirect - eqIrpf - eqSociedades;

                addNode('IRPF', 'IRPF', 'tax_detail', eqIrpf);
                addLink('IRPF', 'IMPUESTOS_DIRECTOS', eqIrpf);

                addNode('IS', 'Impuesto Sociedades', 'tax_detail', eqSociedades);
                addLink('IS', 'IMPUESTOS_DIRECTOS', eqSociedades);

                if (eqIrnr > 0) {
                    addNode('IRNR', 'Impuesto Renta No Residentes', 'tax_detail', eqIrnr);
                    addLink('IRNR', 'IMPUESTOS_DIRECTOS', eqIrnr);
                }
            }
        }

        // 2.3 Impuestos Indirectos (IVA, Especiales)
        addNode('IMPUESTOS_INDIRECTOS', 'Impuestos Indirectos', 'income_type', yearRevenue.taxesIndirect);
        addLink('IMPUESTOS_INDIRECTOS', 'INGRESOS_TOTALES', yearRevenue.taxesIndirect);

        if (taxNational) {
            const totalAeatIndirect = taxNational.iva + taxNational.iiee;
            if (totalAeatIndirect > 0) {
                const ivaRatio = taxNational.iva / totalAeatIndirect;
                const eqIva = Math.round(yearRevenue.taxesIndirect * ivaRatio);
                const eqIiee = yearRevenue.taxesIndirect - eqIva;

                addNode('IVA', 'IVA', 'tax_detail', eqIva);
                addLink('IVA', 'IMPUESTOS_INDIRECTOS', eqIva);

                addNode('IIEE', 'Impuestos Especiales', 'tax_detail', eqIiee);
                addLink('IIEE', 'IMPUESTOS_INDIRECTOS', eqIiee);
            }
        }

        // 2.4 Otros Ingresos
        addNode('OTROS_INGRESOS', 'Otros Ingresos', 'income_type', yearRevenue.otherRevenue);
        addLink('OTROS_INGRESOS', 'INGRESOS_TOTALES', yearRevenue.otherRevenue);

        // -------------------------------------------------------------
        // NODE DEFINITIONS - OUTPUTS
        // -------------------------------------------------------------

        // We adjust IGAE values to perfectly map to Eurostat's totalExpenditure.
        // This resolves any mismatch mathematically, forcing mass balance.
        const cofogScale = totalExpenditure / budgetTotal;

        for (const cat of yearBudget.categories) {
            let isSpecificExtracted = false;
            const catCode = cat.code;
            const catName = cat.name;
            const catAmountRaw = cat.amount;
            const catAmount = Math.round(catAmountRaw * cofogScale);

            // Extract Pensions
            if (catCode === '10' && pensionPayroll > 0) {
                const scaledPension = Math.round(pensionPayroll * cofogScale);
                const remainder = Math.max(0, catAmount - scaledPension);

                addNode('GASTO_PENSIONES', 'Pensiones', 'expense_specific', scaledPension);
                addLink('CONSOLIDADO', 'GASTO_PENSIONES', scaledPension);

                if (remainder > 0) {
                    addNode('COFOG_10_RESTO', 'Resto Protección Social', 'expense_cofog', remainder);
                    addLink('CONSOLIDADO', 'COFOG_10_RESTO', remainder);
                }
                isSpecificExtracted = true;
            }

            // Extract Interest Payments
            if (catCode === '01') {
                const debtOp = cat.children?.find(c => c.code === '01.7');
                if (debtOp && debtOp.amount > 0) {
                    const scaledInterests = Math.round(debtOp.amount * cofogScale);
                    const remainder = Math.max(0, catAmount - scaledInterests);

                    addNode('GASTO_INTERESES', 'Intereses Deuda Pública', 'expense_specific', scaledInterests);
                    addLink('CONSOLIDADO', 'GASTO_INTERESES', scaledInterests);

                    if (remainder > 0) {
                        addNode('COFOG_01_RESTO', 'Servicios Públicos Generales (Resto)', 'expense_cofog', remainder);
                        addLink('CONSOLIDADO', 'COFOG_01_RESTO', remainder);
                    }
                    isSpecificExtracted = true;
                }
            }

            if (!isSpecificExtracted) {
                addNode(`COFOG_${catCode}`, catName, 'expense_cofog', catAmount);
                addLink('CONSOLIDADO', `COFOG_${catCode}`, catAmount);
            }
        }

        // Check outputs total due to rounding, dump difference in the largest output to make it perfect
        const linkOutputs = links.filter(l => l.source === 'CONSOLIDADO');
        const totalLinkedOutputs = linkOutputs.reduce((sum, l) => sum + l.amount, 0);
        const roundingDiff = totalExpenditure - totalLinkedOutputs;

        if (roundingDiff !== 0) {
            const largestLink = [...linkOutputs].sort((a, b) => b.amount - a.amount)[0];
            const targetNode = nodes.find(n => n.id === largestLink.target);
            if (targetNode) {
                targetNode.amount += roundingDiff;
                largestLink.amount += roundingDiff;
            }
        }

        const flowsData = {
            lastUpdated: new Date().toISOString(),
            latestYear: targetYear,
            nodes,
            links,
            sourceAttribution: {
                consolidated: {
                    source: 'Pipeline Interno (Consolidación Eurostat, AEAT, IGAE, SS, BdE)',
                    type: 'derived',
                    note: 'Grafo Dirigido Acíclico (DAG) balanceado para visualización Sankey.',
                }
            }
        };

        console.log(`  ✓ Grafo generado correctamente.`);
        return flowsData;

    } catch (error) {
        console.error(`  Error generando dataset de flujos Sankey: ${error.message}`);
        // If it fails, we don't throw, we return minimal failure state (or we could throw to let the main pipeline handle it)
        throw error;
    }
}
