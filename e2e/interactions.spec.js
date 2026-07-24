const { test, expect, gotoApp, waitForDuckDB, loadSampleAndRunQuery, saveQueryAndVisualization, selectWorkspaceTab } = require("./fixtures");

test("cross-filter interaction updates only compatible target cards", async ({ page }) => {
  await gotoApp(page);
  await waitForDuckDB(page);
  await loadSampleAndRunQuery(page);
  await saveQueryAndVisualization(page);

  await selectWorkspaceTab(page, "dashboard");
  await page.getByTestId("new-dashboard").click();
  await page.getByTestId("add-dashboard-viz").click();
  await page.getByTestId("add-dashboard-viz").click();
  await page.getByTestId("refresh-dashboard").click();
  await expect(page.getByTestId("dashboard-card").filter({ hasText: "ready" })).toHaveCount(2, { timeout: 30_000 });

  const monthValue = await page.evaluate(() => {
    const value = window.__QUACKVIZ_E2E__.state.currentResult.rows[0].month;
    if (typeof value === "number") return new Date(value).toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  });
  await page.getByTestId("interaction-source-field").fill("month");
  await page.getByTestId("interaction-value").fill(monthValue);
  await page.getByTestId("interaction-action").selectOption("filter");
  await page.getByTestId("add-interaction-binding").click();
  await page.getByTestId("emit-interaction").click();

  await expect(page.getByTestId("interaction-state")).toContainText("Filtered: month", { timeout: 30_000 });
  await expect(page.getByTestId("dashboard-card").filter({ hasText: "ready" })).toHaveCount(2);
  const interactionStats = await page.evaluate(() => ({
    reQueried: window.__QUACKVIZ_E2E__.state.interaction.cardsRequeried.length,
    highlighted: window.__QUACKVIZ_E2E__.state.interaction.cardsHighlighted.length,
    skipped: window.__QUACKVIZ_E2E__.state.interaction.lastResolution.skippedTargets.length,
  }));
  expect(interactionStats).toEqual({ reQueried: 1, highlighted: 0, skipped: 0 });
});
