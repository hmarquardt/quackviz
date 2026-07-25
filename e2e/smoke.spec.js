const { test, expect, gotoApp, waitForDuckDB, runBrowserUnitTests, selectWorkspaceTab } = require("./fixtures");

test("application loads, footer version is canonical, browser unit tests and self-test pass", async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByTestId("app-footer")).toContainText("v1.0.0-beta.2");
  await waitForDuckDB(page);
  await expect(page.getByTestId("data-status")).toContainText("DuckDB connected");

  await page.getByTestId("theme-select").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByTestId("theme-select").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await selectWorkspaceTab(page, "debug");
  await page.getByTestId("self-test").click();
  await expect(page.getByTestId("self-test-results")).toContainText("Footer version matches APP_VERSION", { timeout: 60_000 });
  await expect(page.getByTestId("self-test-results")).not.toContainText("FAIL");

  await runBrowserUnitTests(page);
});
