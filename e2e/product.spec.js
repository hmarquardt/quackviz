const path = require("path");
const { test, expect, gotoApp, waitForDuckDB, selectWorkspaceTab } = require("./fixtures");

test("first-run journey works without AI", async ({ page }) => {
  await gotoApp(page, "/", { showWelcome: true });
  await expect(page.getByTestId("welcome-dialog")).toBeVisible();
  await expect(page.getByTestId("beta-badge")).toContainText("Beta");
  await page.getByTestId("welcome-add-data").click();
  await expect(page.getByTestId("workflow-checklist")).toContainText("Add data");
  await waitForDuckDB(page);

  await page.getByTestId("data-file-input").setInputFiles(path.join(__dirname, "../samples/sales.csv"));
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("schema-view")).toContainText("sales", { timeout: 30_000 });
  await expect(page.getByTestId("data-preview")).toContainText("order_date");

  await selectWorkspaceTab(page, "sql");
  await page.getByText("Row count").click();
  await page.getByTestId("run-sql").click();
  await expect(page.getByTestId("query-rows")).toContainText(/Rows: [1-9]/, { timeout: 30_000 });
  await page.getByTestId("query-name").fill("Monthly revenue");
  await page.getByTestId("sql-editor").fill(`SELECT
  date_trunc('month', order_date) AS month,
  ROUND(SUM(revenue), 2) AS revenue
FROM sales
GROUP BY 1
ORDER BY 1;`);
  await page.getByTestId("save-query").click();
  await page.getByTestId("run-sql").click();
  await expect(page.getByTestId("results-table")).toContainText("revenue", { timeout: 30_000 });

  await selectWorkspaceTab(page, "visualize");
  await page.getByTestId("save-viz").click();
  await expect(page.getByTestId("saved-visualizations")).toContainText(/Revenue by Month|Monthly revenue|sales count/i);

  await selectWorkspaceTab(page, "dashboard");
  await page.getByTestId("new-dashboard").click();
  await page.getByTestId("add-dashboard-viz").click();
  await expect(page.getByTestId("dashboard-canvas")).toContainText(/Revenue by Month|Monthly revenue|sales count/i);
  await expect(page.getByTestId("app-footer")).toContainText("v1.0.0-beta.1");
});

test("command palette and help are keyboard accessible", async ({ page }) => {
  await gotoApp(page);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByTestId("command-input").fill("cors");
  await expect(page.getByTestId("command-results")).toContainText("Importing data");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("command-palette")).not.toBeVisible();

  await page.keyboard.press("?");
  await expect(page.getByTestId("help-dialog")).toBeVisible();
  await page.getByTestId("help-search").fill("cors");
  await expect(page.getByTestId("help-content")).toContainText(/CORS|cross-origin/i);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("help-dialog")).not.toBeVisible();
});

test("AI privacy onboarding is visible before requests", async ({ page }) => {
  await gotoApp(page);
  await selectWorkspaceTab(page, "ai");
  await expect(page.getByText("AI privacy basics")).toBeVisible();
  await expect(page.getByText("AI-generated SQL is treated as untrusted")).toBeVisible();
  await expect(page.getByLabel("Context mode")).toHaveValue("metadata");
});

test("About dialog shows canonical beta metadata", async ({ page }) => {
  await gotoApp(page);
  await page.getByTestId("open-about").click();
  await expect(page.getByTestId("about-dialog")).toBeVisible();
  await expect(page.getByTestId("about-content")).toContainText("1.0.0-beta.1");
  await expect(page.getByTestId("about-content")).toContainText("beta");
});
