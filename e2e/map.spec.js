const { test, expect, gotoApp, waitForDuckDB, loadTelemetryAndRunMapQuery, selectWorkspaceTab } = require("./fixtures");

test("map visualization renders from deterministic local telemetry data", async ({ page }) => {
  await gotoApp(page);
  await waitForDuckDB(page);
  await loadTelemetryAndRunMapQuery(page);
  await selectWorkspaceTab(page, "sql");
  await page.getByTestId("save-query").click();
  await expect(page.getByTestId("saved-queries")).toContainText("Telemetry locations");
  await page.getByTestId("run-sql").click();
  await page.waitForFunction(() => Boolean(window.__QUACKVIZ_E2E__?.state.currentResult?.rows?.length), null, { timeout: 30_000 });

  await selectWorkspaceTab(page, "visualize");
  await page.getByTestId("chart-type").selectOption("map-point");
  await page.getByTestId("map-latitude-field").selectOption("latitude");
  await page.getByTestId("map-longitude-field").selectOption("longitude");
  await page.getByTestId("map-label-field").selectOption("site");
  await page.getByTestId("map-size-field").selectOption("temperature");
  await expect(page.getByTestId("viz-status")).toContainText("Map rendered", { timeout: 30_000 });
  await expect(page.getByTestId("chart").locator("canvas.maplibregl-canvas")).toHaveCount(1);
});
