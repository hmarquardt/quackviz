const path = require("node:path");
const { test, expect, gotoApp, selectWorkspaceTab } = require("../fixtures");

test.skip(({ browserName }) => browserName !== "chromium", "Real Parquet release gate is required in Chromium.");

test("imports and queries a real Parquet file", async ({ page }) => {
  await gotoApp(page);
  await page.getByTestId("data-file-input").setInputFiles(path.join(process.cwd(), "e2e/fixtures/data/sales.parquet"));
  await expect(page.getByTestId("data-table-name")).toHaveValue("sales");
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("data-import-status")).toContainText("Imported", { timeout: 30_000 });
  await expect(page.getByTestId("schema-view")).toContainText("12 rows");
  await expect(page.getByTestId("schema-view")).toContainText("amount");
  await selectWorkspaceTab(page, "sql");
  await page.getByTestId("sql-editor").fill("SELECT category, SUM(amount) AS total FROM sales GROUP BY category ORDER BY category");
  await page.getByTestId("run-sql").click();
  await expect(page.getByTestId("results-table")).toContainText("East", { timeout: 30_000 });
  await expect(page.getByTestId("results-table")).toContainText("West");
});
