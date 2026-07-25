const { test, expect, gotoApp, loadTelemetryAndRunMapQuery, selectWorkspaceTab } = require("../fixtures");

test.use({ realRenderers: true });
test.skip(({ browserName }) => browserName !== "chromium", "Headless WebGL release gate is required in Chromium; other engines retain coordination coverage.");

test("renders and disposes a real local MapLibre point map", async ({ page }) => {
  await gotoApp(page);
  await loadTelemetryAndRunMapQuery(page);
  await selectWorkspaceTab(page, "sql");
  await page.getByTestId("save-query").click();
  await page.getByTestId("run-sql").click();
  await selectWorkspaceTab(page, "visualize");
  await page.getByTestId("chart-type").evaluate((select) => {
    select.value = "map-point";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByTestId("viz-status")).toContainText("Map rendered", { timeout: 30_000 });
  const diagnostics = await page.evaluate(async () => {
    const renderer = await import("/js/map-renderer.js");
    const before = renderer.getMapInstanceDiagnostics("main_map");
    renderer.resizeMapInstance("main_map");
    renderer.disposeMapInstance("main_map");
    return { before, after: renderer.getMapRendererStatus().instanceCount };
  });
  expect(diagnostics.before.runtimeVersion).toBe("5.24.0");
  expect(diagnostics.before.sourceIds).toContain("quackviz_points");
  expect(diagnostics.before.layerIds).toContain("points");
  expect(diagnostics.after).toBe(0);
});
