const { test, expect, gotoApp } = require("./fixtures");

const datasets = [
  ["Global Development Odyssey", "1,704"],
  ["Montreal Mobility Constellation", "249"],
  ["Tech Stock Time Machine", "630"],
  ["Iris Morphology Lab", "150"],
  ["Wind Rose Observatory", "128"],
];

test("showcase gallery is discoverable and every dataset imports normally", async ({ page }) => {
  await gotoApp(page);
  await page.getByTestId("browse-showcase").click();
  for (const [title, rows] of datasets) {
    const card = page.getByTestId("showcase-gallery").locator(".showcase-card").filter({ hasText: title });
    await expect(card).toContainText(`${rows} rows`);
    await card.getByRole("button", { name: `Load ${title}` }).click();
    await expect(page.getByTestId("data-import-status")).toContainText("Imported", { timeout: 30_000 });
    await expect(page.getByTestId("schema-view")).toContainText(`${rows.replace(",", "")} rows`);
    if (title !== datasets.at(-1)[0]) {
      await page.getByTestId("browse-showcase").click();
    }
  }
  await page.getByTestId("browse-showcase").click();
  await page.getByRole("button", { name: /View Montreal Mobility Constellation demo recipe/ }).click();
  await expect(page.getByTestId("recipe-content")).toContainText("Clustered or proportional-symbol point map");
  await expect(page.getByTestId("recipe-content").locator("pre")).toContainText("latitude");
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 1024, height: 768 }]) {
  test(`sidebar geometry is bounded at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await gotoApp(page);
    const sidebar = page.locator(".left-pane");
    const brand = page.locator(".brand");
    const footer = page.locator(".sidebar-footer");
    const box = await sidebar.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(240);
    expect(box.width).toBeLessThanOrEqual(320);
    for (const child of [brand, footer]) {
      const childBox = await child.boundingBox();
      expect(childBox.x).toBeGreaterThanOrEqual(box.x);
      expect(childBox.x + childBox.width).toBeLessThanOrEqual(box.x + box.width + 1);
    }
    expect((await brand.boundingBox()).y + (await brand.boundingBox()).height).toBeLessThanOrEqual((await footer.boundingBox()).y);
    await page.screenshot({ path: testInfo.outputPath(`sidebar-${viewport.width}.png`), fullPage: true });
    await page.getByTestId("toggle-sidebar").click();
    await expect(page.getByTestId("restore-sidebar")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("restore-sidebar")).toBeVisible();
    await page.getByTestId("restore-sidebar").click();
    await expect(sidebar).toBeVisible();
  });
}
