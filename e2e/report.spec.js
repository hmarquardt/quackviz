const { test, expect, gotoApp, waitForDuckDB, loadSampleAndRunQuery, saveQueryAndVisualization, selectWorkspaceTab } = require("./fixtures");

test("report captures a saved visualization section", async ({ page }) => {
  await gotoApp(page);
  await waitForDuckDB(page);
  await loadSampleAndRunQuery(page);
  await saveQueryAndVisualization(page);

  await selectWorkspaceTab(page, "report");
  await page.getByTestId("new-report").click();
  await page.getByTestId("report-section-type").selectOption("visualization");
  const visualizationId = await page.evaluate(() => window.__QUACKVIZ_E2E__.state.workspace.visualizations[0].id);
  await page.getByTestId("report-source-viz").selectOption(visualizationId);
  await page.getByTestId("add-report-section").click();
  await expect(page.getByTestId("report-outline")).toContainText("Visualization");

  await page.getByTestId("refresh-report-section").click();
  await expect(page.getByTestId("report-preview")).toContainText(/visualization · ready/i, { timeout: 30_000 });
  await expect(page.getByTestId("report-preview").locator("img")).toHaveCount(1);
});
