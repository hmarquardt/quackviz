const { test, expect, gotoApp, waitForDuckDB, loadSampleAndRunQuery, saveQueryAndVisualization } = require("./fixtures");

test("saved metadata survives reload while in-memory DuckDB source availability is honest", async ({ page }) => {
  await gotoApp(page);
  await waitForDuckDB(page);
  await loadSampleAndRunQuery(page);
  await saveQueryAndVisualization(page);

  await page.reload();
  await page.waitForFunction(() => window.__QUACKVIZ_E2E__?.appReady === true);
  await expect(page.getByTestId("saved-queries")).toContainText("Monthly revenue");
  await expect(page.getByTestId("saved-visualizations")).toContainText(/Revenue by Month|Monthly revenue/);
  await expect(page.getByTestId("schema-view")).toContainText(/not loaded|needs reload/i, { timeout: 30_000 });
});
