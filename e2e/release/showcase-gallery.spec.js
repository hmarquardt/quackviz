const { test, expect, gotoApp } = require("../fixtures");

test("Help showcase prepares an ordinary JSON import", async ({ page }) => {
  await gotoApp(page);
  await page.getByTestId("open-help").click();
  await page.getByRole("button", { name: /Showcase examples/ }).click();
  await page.getByTestId("showcase-load-04_iris_morphology_lab").click();
  await expect(page.getByTestId("data-import-status")).toContainText("ready", { ignoreCase: true });
  await expect(page.getByTestId("data-format-select")).toHaveValue("auto");
  expect(await page.evaluate(() => window.__QUACKVIZ_E2E__.state.dataImport.detectedFormat)).toBe("json");
  await expect(page.getByTestId("data-table-name")).toHaveValue("table_04_iris_morphology_lab");
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("data-import-status")).toContainText("Imported", { timeout: 30_000 });
  await expect(page.getByTestId("schema-view")).toContainText("150 rows");
});
