const { test, expect, gotoApp, waitForDuckDB, waitForRender, loadSampleAndRunQuery, saveQueryAndVisualization } = require("./fixtures");

test("loads sample, executes SQL, renders visualization, and saves query plus visualization", async ({ page }) => {
  await gotoApp(page);
  await waitForDuckDB(page);
  await loadSampleAndRunQuery(page);
  await saveQueryAndVisualization(page);
  await waitForRender(page);
  await expect(page.getByTestId("viz-status")).toContainText("Chart rendered");
  await expect(page.getByTestId("chart").locator("canvas,svg")).toHaveCount(1);
});
