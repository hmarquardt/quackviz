const path = require("path");
const { test, expect, gotoApp, selectWorkspaceTab } = require("./fixtures");

const fixtures = [
  ["nested-company.json", /departments/, 2],
  ["nested-commerce.json", /orders/, 2],
  ["api-envelope.json", /data/, 2],
  ["points.geojson", /features/, 2],
  ["nested-records.json", /periods/, 2],
  ["chat-archive.json", /channels/, 1],
];

test("deterministically models unrelated nested JSON documents with AI disabled", async ({ page }) => {
  await gotoApp(page);
  for (const [fileName, expectedTable, expectedRows] of fixtures) {
    await selectWorkspaceTab(page, "data");
    await page.getByTestId("data-file-input").setInputFiles(path.join(process.cwd(), "e2e/fixtures/data", fileName));
    await expect(page.getByTestId("json-model-dialog")).toBeVisible();
    await expect(page.getByTestId("json-model-summary")).toContainText(/candidate tables/);
    await expect(page.getByTestId("json-ai-context-preview")).not.toContainText("a@example.test");
    await page.getByTestId("json-import-approve").click();
    await expect(page.getByTestId("data-import-status")).toContainText(/Imported \d+ related tables/, { timeout: 30_000 });
    await expect(page.getByTestId("source-list")).toContainText(expectedTable);
    const source = await page.evaluate((pattern) => window.__QUACKVIZ_E2E__.state.workspace.dataSources.find((item) => new RegExp(pattern).test(item.tableName)), expectedTable.source);
    expect(source.rowCount).toBe(expectedRows);
    expect(source.jsonModeling.provenance.generatedBy).toBe("deterministic");
  }
});

test("imports related tables with inherited parent keys and queries DuckDB", async ({ page }) => {
  await gotoApp(page);
  await page.getByTestId("data-file-input").setInputFiles(path.join(process.cwd(), "e2e/fixtures/data/nested-company.json"));
  await expect(page.getByTestId("json-model-dialog")).toBeVisible();
  await expect(page.getByTestId("json-candidate-tables")).toContainText("employees");
  await page.getByTestId("json-import-approve").click();
  await expect(page.getByTestId("source-list")).toContainText("employees", { timeout: 30_000 });
  await selectWorkspaceTab(page, "sql");
  await page.getByTestId("sql-editor").fill("SELECT department_id, COUNT(*) AS employee_count FROM employees GROUP BY 1 ORDER BY 1;");
  await page.getByTestId("run-sql").click();
  await expect(page.getByTestId("query-rows")).toContainText("Rows: 2", { timeout: 30_000 });
  await expect(page.getByTestId("results-table")).toContainText("department_id");
});

test("GeoJSON plan exposes map-ready coordinates", async ({ page }) => {
  await gotoApp(page);
  await page.getByTestId("data-file-input").setInputFiles(path.join(process.cwd(), "e2e/fixtures/data/points.geojson"));
  await expect(page.getByTestId("json-model-summary")).toContainText("GeoJSON");
  await page.getByTestId("json-import-approve").click();
  await expect(page.getByTestId("schema-view")).toContainText("latitude", { timeout: 30_000 });
  await expect(page.getByTestId("schema-view")).toContainText("longitude");
});

test("AI proposes only a validated declarative plan and cache quota failure stays nonfatal", async ({ page }) => {
  let sharedContext;
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === "quackviz.ai.models") throw new DOMException("Quota exceeded", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.route("https://openrouter.ai/api/v1/models", (route) => route.fulfill({ json: { data: [{ id: "mock/model", name: "Mock Model" }] } }));
  await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
    const request = route.request().postDataJSON();
    sharedContext = JSON.parse(request.messages.at(-1).content);
    const proposedPlan = structuredClone(sharedContext.deterministicPlan);
    proposedPlan.tables[0].name = "modeled_records";
    await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify({
      contract: "quackviz-ai-json-modeling-plan",
      contractVersion: 1,
      sourceProfileId: sharedContext.sourceProfileId,
      summary: "Rename one table.",
      proposedPlan,
      rationale: ["The name is clearer."],
      warnings: [],
      confidence: 0.8,
    }) } }] } });
  });
  await gotoApp(page);
  await selectWorkspaceTab(page, "ai");
  await page.getByTestId("ai-enabled").check();
  await page.locator("#openRouterKey").fill("test-key");
  await page.locator("#openRouterKey").dispatchEvent("change");
  await page.getByRole("button", { name: "Refresh models" }).click();
  await expect(page.getByTestId("model-refresh-status")).toContainText("could not be cached");
  await selectWorkspaceTab(page, "data");
  await page.getByTestId("data-file-input").setInputFiles(path.join(process.cwd(), "e2e/fixtures/data/nested-records.json"));
  await expect(page.getByTestId("json-model-dialog")).toBeVisible();
  await page.getByTestId("json-ask-ai").click();
  await expect(page.getByTestId("json-ai-plan")).toContainText("Valid AI-assisted plan");
  expect(JSON.stringify(sharedContext)).not.toContain("e1");
  expect(JSON.stringify(sharedContext)).not.toContain("USD");
  await page.getByTestId("json-ai-plan").getByRole("button", { name: "Accept this rename" }).click();
  await page.getByTestId("json-import-approve").click();
  await expect(page.getByTestId("source-list")).toContainText("modeled_records", { timeout: 30_000 });
  const provenance = await page.evaluate(() => window.__QUACKVIZ_E2E__.state.workspace.dataSources.find((source) => source.tableName === "modeled_records").jsonModeling.provenance);
  expect(provenance.generatedBy).toBe("ai-assisted");
  expect(provenance.sampleValuesShared).toBe(false);
});
