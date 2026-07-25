const fs = require("node:fs");
const path = require("node:path");
const { test, expect, gotoApp, selectWorkspaceTab } = require("../fixtures");

test.use({ realRenderers: true });
test.skip(({ browserName }) => browserName !== "chromium", "Real renderer release gate is required in Chromium.");

test("real local-file no-AI workflow", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("quackviz.openrouter.apiKey", "sk-release-secret"));
  await gotoApp(page);
  await expect(page.getByTestId("beta-badge")).toContainText("Beta");
  await page.getByTestId("data-file-input").setInputFiles(path.join(process.cwd(), "samples/sales.csv"));
  await expect(page.getByTestId("data-table-name")).toHaveValue("sales");
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("data-import-status")).toContainText("Imported", { timeout: 30_000 });
  await expect(page.getByTestId("schema-view")).toContainText("120 rows");
  await expect(page.getByTestId("data-preview")).toContainText("East");

  await selectWorkspaceTab(page, "sql");
  await page.getByTestId("query-name").fill("Release monthly revenue");
  await page.getByTestId("sql-editor").fill("SELECT date_trunc('month', order_date) AS month, SUM(revenue) AS revenue FROM sales GROUP BY 1 ORDER BY 1");
  await page.getByTestId("save-query").click();
  await page.getByTestId("run-sql").click();
  await expect(page.getByTestId("query-rows")).toContainText(/Rows: [1-9]/, { timeout: 30_000 });

  await selectWorkspaceTab(page, "visualize");
  await expect(page.getByTestId("chart").locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  const chart = await page.evaluate(async () => {
    const { getChartInstanceDiagnostics } = await import("/js/viz-renderer.js");
    return getChartInstanceDiagnostics("main");
  });
  expect(chart.runtimeVersion).toBe("6.1.0");
  expect(chart.seriesTypes).toEqual(["line"]);
  expect(chart.datasetRowCount).toBeGreaterThan(0);
  await page.getByTestId("save-viz").click();

  await selectWorkspaceTab(page, "dashboard");
  await page.getByTestId("new-dashboard").click();
  await page.getByTestId("add-dashboard-viz").click();
  await page.getByTestId("refresh-dashboard").click();
  await expect(page.getByTestId("dashboard-card-chart").locator("canvas")).toHaveCount(1, { timeout: 30_000 });

  await selectWorkspaceTab(page, "debug");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-workspace-package").click();
  const download = await downloadPromise;
  const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  expect(exported.format).toBe("quackviz-package");
  expect(exported.manifest.createdBy.appVersion).toBe("1.0.0-beta.2");
  expect(JSON.stringify(exported)).not.toContain("sk-release-secret");
  await expect(page.getByTestId("app-footer")).toContainText("v1.0.0-beta.2");
});
