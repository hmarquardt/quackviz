const { test, expect, gotoApp, waitForDuckDB, loadSampleAndRunQuery, saveQueryAndVisualization, selectWorkspaceTab } = require("./fixtures");

test("dashboard renders multiple cards and isolates a failed card", async ({ page }) => {
  await gotoApp(page);
  await waitForDuckDB(page);
  await loadSampleAndRunQuery(page);
  await saveQueryAndVisualization(page);

  await selectWorkspaceTab(page, "dashboard");
  await page.getByTestId("new-dashboard").click();
  await page.getByTestId("add-dashboard-viz").click();
  await page.getByTestId("add-dashboard-viz").click();
  await expect(page.getByTestId("dashboard-status")).toContainText("2 cards");
  await page.getByTestId("refresh-dashboard").click();
  await expect(page.getByTestId("dashboard-card").first()).toContainText("ready", { timeout: 30_000 });
  await expect(page.getByTestId("dashboard-card-chart").first().locator("canvas,svg")).toHaveCount(1);

  await page.evaluate(() => {
    const workspace = window.__QUACKVIZ_E2E__.state.workspace;
    const dashboard = workspace.dashboards.find((item) => item.id === workspace.active.dashboardId);
    const goodQuery = workspace.queries.find((item) => item.id === workspace.active.queryId);
    const goodViz = workspace.visualizations[0];
    const badQuery = {
      ...goodQuery,
      id: "query_e2e_broken",
      name: "Broken query",
      sql: "SELECT missing_column FROM sales",
      updatedAt: new Date().toISOString(),
    };
    const badViz = {
      ...goodViz,
      id: "viz_e2e_broken",
      name: "Broken visualization",
      queryId: badQuery.id,
      spec: { ...goodViz.spec, dataset: { queryId: badQuery.id } },
      updatedAt: new Date().toISOString(),
    };
    workspace.queries.push(badQuery);
    workspace.visualizations.push(badViz);
    dashboard.layout[0].visualizationId = goodViz.id;
    dashboard.layout[1].visualizationId = badViz.id;
  });
  await page.getByTestId("refresh-dashboard").click();
  await expect(page.getByTestId("dashboard-card").filter({ hasText: "ready" })).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId("dashboard-card").filter({ hasText: "error" })).toHaveCount(1);
});
