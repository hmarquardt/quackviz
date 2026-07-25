const path = require("path");
const fs = require("fs");
const { test, expect, gotoApp, waitForDuckDB } = require("./fixtures");

async function importFile(page, filePath, expectedTable, expectedText) {
  await page.getByTestId("tab-data").click();
  await page.getByTestId("data-file-input").setInputFiles(filePath);
  await expect(page.getByTestId("data-table-name")).toHaveValue(expectedTable);
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("data-import-status")).toContainText("Imported", { timeout: 30_000 });
  await expect(page.getByTestId("schema-view")).toContainText(expectedTable, { timeout: 30_000 });
  await expect(page.getByTestId("data-preview")).toContainText(expectedText);
}

test("empty Data tab emphasizes user imports and inline favicon is local", async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByTestId("schema-view")).toContainText("Add your first dataset");
  await expect(page.getByTestId("data-file-input")).toHaveCount(1);
  await expect(page.getByTestId("data-url-input")).toHaveCount(1);
  await expect(page.getByTestId("source-list")).not.toContainText("Load sample sales data");
  const favicon = page.getByTestId("favicon-link");
  await expect(favicon).toHaveAttribute("type", "image/svg+xml");
  await expect(favicon).toHaveAttribute("href", /^data:image\/svg\+xml/);
});

test("imports a local CSV, opens it in SQL, and renders a chart", async ({ page }) => {
  await gotoApp(page);
  await waitForDuckDB(page);
  await importFile(page, path.join(process.cwd(), "samples/sales.csv"), "sales", "East");
  await page.getByRole("button", { name: "Open in SQL" }).click();
  await page.getByTestId("sql-editor").fill("SELECT date_trunc('month', order_date) AS month, ROUND(SUM(revenue), 2) AS revenue FROM \"sales\" GROUP BY 1 ORDER BY 1;");
  await page.getByTestId("run-sql").click();
  await expect(page.getByTestId("query-rows")).toContainText(/Rows: [1-9]/, { timeout: 30_000 });
  await page.getByTestId("query-name").fill("Imported monthly revenue");
  await page.getByTestId("save-query").click();
  await expect(page.getByTestId("saved-queries")).toContainText("Imported monthly revenue");
  await page.getByTestId("run-sql").click();
  await page.getByTestId("tab-visualize").click();
  await page.waitForFunction(() => Boolean(window.__QUACKVIZ_E2E__?.state.currentOption), null, { timeout: 30_000 });
  await expect(page.getByTestId("chart").locator("canvas,svg")).toHaveCount(1);
});

test("imports local JSON array and NDJSON files", async ({ page }) => {
  await gotoApp(page);
  await waitForDuckDB(page);
  await importFile(page, path.join(process.cwd(), "samples/orders.json"), "orders", "West");
  await page.getByTestId("data-file-input").setInputFiles(path.join(process.cwd(), "samples/events.ndjson"));
  await expect(page.getByTestId("data-format-select")).toHaveValue("auto");
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("schema-view")).toContainText("events", { timeout: 30_000 });
  await expect(page.getByTestId("data-preview")).toContainText("purchase");
});

test("supports multiple local files in one import action", async ({ page }) => {
  await gotoApp(page);
  await waitForDuckDB(page);
  await page.getByTestId("data-file-input").setInputFiles([
    path.join(process.cwd(), "samples/orders.json"),
    path.join(process.cwd(), "samples/events.ndjson"),
  ]);
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("data-import-status")).toContainText("Imported 2 sources", { timeout: 30_000 });
  await expect(page.getByTestId("source-list")).toContainText("orders");
  await expect(page.getByTestId("source-list")).toContainText("events");
});

test("supports drag-and-drop local file import", async ({ page }) => {
  await gotoApp(page);
  await waitForDuckDB(page);
  const content = fs.readFileSync(path.join(process.cwd(), "samples/orders.json"), "utf8");
  const dataTransfer = await page.evaluateHandle(({ fileName, body }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([body], fileName, { type: "application/json" }));
    return transfer;
  }, { fileName: "Dropped Orders.json", body: content });
  await page.getByTestId("data-drop-zone").dispatchEvent("drop", { dataTransfer });
  await expect(page.getByTestId("data-table-name")).toHaveValue("dropped_orders");
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("schema-view")).toContainText("dropped_orders", { timeout: 30_000 });
});

test("imports a deterministic URL and reports URL failures clearly", async ({ page }) => {
  await page.route("http://127.0.0.1:8080/e2e-url.csv", (route) => route.fulfill({
    status: 200,
    contentType: "text/csv",
    body: "id,label\n1,URL row\n",
  }));
  await page.route("http://127.0.0.1:8080/e2e-404.csv", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.route("https://blocked.example/data.csv", (route) => route.abort("failed"));
  await gotoApp(page);
  await waitForDuckDB(page);

  await page.getByTestId("data-url-input").fill("http://127.0.0.1:8080/e2e-url.csv");
  await page.getByTestId("data-url-load").click();
  await expect(page.getByTestId("data-table-name")).toHaveValue("e2e_url");
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("data-preview")).toContainText("URL row", { timeout: 30_000 });

  await page.getByTestId("data-url-input").fill("http://127.0.0.1:8080/e2e-404.csv");
  await page.getByTestId("data-url-load").click();
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("data-import-status")).toContainText("HTTP 404", { timeout: 30_000 });

  await page.getByTestId("data-url-input").fill("https://blocked.example/data.csv");
  await page.getByTestId("data-url-load").click();
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("data-import-status")).toContainText("cross-origin", { timeout: 30_000 });
  const unexpectedFailures = page.__e2eFailures.filter((failure) => (
    !/Failed to load resource: the server responded with a status of 404/i.test(failure)
    && !/Failed to load resource: net::ERR_FAILED/i.test(failure)
  ));
  page.__e2eFailures.splice(0, page.__e2eFailures.length, ...unexpectedFailures);
});

test("URL import cancellation is visible", async ({ page }) => {
  await page.route("https://slow.example/slow.csv", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    await route.fulfill({ contentType: "text/csv", body: "id\n1\n" });
  });
  await gotoApp(page);
  await waitForDuckDB(page);
  await page.getByTestId("data-url-input").fill("https://slow.example/slow.csv");
  await page.getByTestId("data-url-load").click();
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("data-import-status")).toContainText("Downloading URL", { timeout: 10_000 });
  await page.getByTestId("data-import-cancel").click();
  await expect(page.getByTestId("data-import-status")).toContainText("cancel", { timeout: 30_000 });
});

test("bundled sales fixture is available only under Debug", async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByTestId("source-list")).not.toContainText("Load sample sales data");
  await expect(page.locator('[data-testid="load-sample"]')).toHaveCount(0);
  await page.getByTestId("tab-debug").click();
  await expect(page.getByTestId("debug-load-fixture")).toContainText("Load bundled sales fixture");
});
