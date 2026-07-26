const path = require("node:path");
const { test, expect, gotoApp, selectWorkspaceTab } = require("../fixtures");

test.use({ realRenderers: true });
test.skip(({ browserName }) => browserName !== "chromium", "Offline nested-path release gate is required in Chromium.");

test("offline core works from a nested path without public CDNs", async ({ page }) => {
  const external = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:8080") {
      external.push(url.href);
      return route.abort("internetdisconnected");
    }
    if (url.pathname.startsWith("/quackviz/")) {
      const target = new URL(url.href);
      target.pathname = url.pathname.slice("/quackviz".length) || "/";
      const response = await route.fetch({ url: target.href });
      return route.fulfill({ response });
    }
    return route.continue();
  });
  await gotoApp(page, "/quackviz/");
  await page.getByTestId("data-file-input").setInputFiles(path.join(process.cwd(), "samples/sales.csv"));
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("schema-view")).toContainText("sales", { timeout: 30_000 });
  await selectWorkspaceTab(page, "sql");
  await page.getByTestId("query-name").fill("Offline regional revenue");
  await page.getByTestId("sql-editor").fill("SELECT region, SUM(revenue) AS revenue FROM sales GROUP BY region ORDER BY region");
  await page.getByTestId("save-query").click();
  await page.getByTestId("run-sql").click();
  await selectWorkspaceTab(page, "visualize");
  await expect(page.getByTestId("chart").locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  expect(external).toEqual([]);
  await expect(page.getByTestId("app-footer")).toContainText("v1.0.0-beta.3");
});
