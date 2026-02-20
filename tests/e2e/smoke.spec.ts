import { expect, test } from '@playwright/test'

test.describe('Smoke', () => {
  test('renderiza los bloques principales', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Dashboard Fiscal de España' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ingresos vs Gastos Públicos' })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Gasto Público por Funciones (COFOG)' })
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Deuda por Comunidad Autónoma' })).toBeVisible()
  })

  test('cambia entre tema claro y oscuro y persiste en localStorage', async ({ page }) => {
    await page.goto('/')

    const toggle = page.getByRole('button', { name: /Cambiar a modo/i })
    await expect(toggle).toBeVisible()

    const initialDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    )
    await toggle.click()

    await expect
      .poll(
        () => page.evaluate(() => document.documentElement.classList.contains('dark')),
        { timeout: 5000 }
      )
      .toBe(!initialDark)

    const storedTheme = await page.evaluate(() => localStorage.getItem('cuentas-publicas-theme'))
    expect(storedTheme).toBe(initialDark ? 'light' : 'dark')
  })

  test('permite activar comparación y cambiar a vista de porcentaje de cambio', async ({ page }) => {
    await page.goto('/')

    const compareSelect = page.getByLabel('Comparar')
    await expect(compareSelect).toBeVisible()

    const options = compareSelect.locator('option')
    const optionCount = await options.count()
    expect(optionCount).toBeGreaterThan(1)
    const comparisonYear = await options.nth(1).getAttribute('value')
    expect(comparisonYear).toBeTruthy()

    await compareSelect.selectOption(comparisonYear as string)

    const changeButton = page.getByRole('button', { name: '% cambio' })
    await expect(changeButton).toBeVisible()
    await changeButton.click()

    await expect(page.getByText('Aumento')).toBeVisible()
    await expect(page.getByText('Descenso')).toBeVisible()
  })

  test('permite drilldown en COFOG y volver al nivel superior', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Gasto COFOG' }).click()
    await expect(page).toHaveURL(/section=gasto-cofog/)

    const cofogSection = page.locator('#gasto-cofog')
    await expect(
      cofogSection.getByText('Haz clic en una barra para ver el desglose por subcategorías')
    ).toBeVisible()

    const firstBar = cofogSection.locator('.recharts-bar-rectangle').first()
    const backButton = cofogSection.getByRole('button', { name: 'Todas las funciones' })
    await expect(firstBar).toBeVisible()

    const bars = cofogSection.locator('.recharts-bar-rectangle')
    const barCount = await bars.count()
    let drilldownActivated = false

    for (let i = 0; i < barCount; i++) {
      await bars.nth(i).click({ force: true })
      if (await backButton.isVisible()) {
        drilldownActivated = true
        break
      }
    }

    expect(drilldownActivated).toBe(true)
    await backButton.click()

    await expect(
      cofogSection.getByText('Haz clic en una barra para ver el desglose por subcategorías')
    ).toBeVisible()
  })

  test('mantiene enlaces de fuentes oficiales en resumen y bloque CCAA', async ({ page }) => {
    await page.goto('/')

    const debtSourceLink = page.locator('#resumen').getByRole('link', { name: 'BdE be11b.csv' })
    await expect(debtSourceLink).toHaveAttribute('href', /be11b\.csv/)
    await expect(debtSourceLink).toHaveAttribute('target', '_blank')

    await page.getByRole('link', { name: 'CCAA' }).click()
    await expect(page).toHaveURL(/section=ccaa/)

    const ccaaSection = page.locator('#ccaa')
    const metricSelect = ccaaSection.getByLabel('Métrica')
    await expect(metricSelect).toBeVisible()

    const sourceLink = ccaaSection.locator('p:has-text("Datos del") a')
    await expect(sourceLink).toHaveAttribute('href', /be1310\.csv/)

    await metricSelect.selectOption('debtAbsolute')
    await expect(sourceLink).toHaveAttribute('href', /be1309\.csv/)
  })

  test('sincroniza estado CCAA en query params y lo restaura tras recarga', async ({ page }) => {
    await page.goto('/?section=ccaa&ccaa=CA09&ccaaMetric=debtAbsolute')

    await expect(page).not.toHaveURL(/section=/)
    await expect(page).toHaveURL(/ccaa=CA09/)
    await expect(page).toHaveURL(/ccaaMetric=debtAbsolute/)

    const ccaaSection = page.locator('#ccaa')
    await expect(ccaaSection.getByLabel('Comunidad')).toHaveValue('CA09')
    await expect(ccaaSection.getByLabel('Métrica')).toHaveValue('debtAbsolute')
    await expect(ccaaSection.getByText('Detalle: Cataluña')).toBeVisible()
    await expect(ccaaSection.getByText('Déficit CCAA')).toBeVisible()
    await expect(ccaaSection.getByText('Gasto CCAA')).toBeVisible()

    await ccaaSection.getByLabel('Comunidad').selectOption('CA13')
    await expect(page).toHaveURL(/ccaa=CA13/)

    await page.reload()
    await expect(ccaaSection.getByLabel('Comunidad')).toHaveValue('CA13')
    await expect(ccaaSection.getByText('Detalle: Madrid')).toBeVisible()
  })
})
