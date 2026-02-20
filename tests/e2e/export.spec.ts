import { expect, test } from "@playwright/test";

test.describe("Export PNG", () => {
  test("exporta el bloque de deuda con un enlace de descarga válido", async ({ page }) => {
    await page.addInitScript(() => {
      const originalClick = HTMLAnchorElement.prototype.click;
      (window as { __exportDownloads?: Array<{ href: string; download: string }> }).__exportDownloads =
        [];

      HTMLAnchorElement.prototype.click = function patchedAnchorClick(this: HTMLAnchorElement) {
        if (this.download) {
          (
            window as { __exportDownloads?: Array<{ href: string; download: string }> }
          ).__exportDownloads?.push({
            href: this.href,
            download: this.download,
          });
        }
        return originalClick.call(this);
      };
    });

    await page.goto("/");

    const debtSection = page.locator("#deuda");
    const exportButton = debtSection.getByRole("button", { name: /Exportar PNG|Export PNG/i });
    await expect(exportButton).toBeVisible();

    await exportButton.click();

    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              (
                window as { __exportDownloads?: Array<{ href: string; download: string }> }
              ).__exportDownloads?.length ?? 0,
          ),
        { timeout: 12_000 },
      )
      .toBeGreaterThan(0);

    const downloads = await page.evaluate(
      () =>
        (
          window as { __exportDownloads?: Array<{ href: string; download: string }> }
        ).__exportDownloads ?? [],
    );
    const exportedFile = downloads[downloads.length - 1];

    expect(exportedFile.download).toMatch(/^cuentas-publicas-deuda-\d{4}-\d{2}-\d{2}\.png$/);
    expect(exportedFile.href).toMatch(/^(blob:|data:image\/png)/);

    const exportError = debtSection.locator("output").filter({
      hasText: /No se pudo exportar|Export failed/,
    });
    await expect(exportError).toHaveCount(0);
  });
});
