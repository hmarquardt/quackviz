const path = require("node:path");
const { test, expect, gotoApp, selectWorkspaceTab } = require("../fixtures");

test.use({ realRenderers: true });

test("real Montreal JSON renders the stable point-map matrix", async ({ page, browserName }) => {
  await gotoApp(page);
  const webgl = await page.evaluate(() => Boolean(document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl")));
  test.skip(!webgl, `${browserName} Playwright environment does not expose WebGL; QuackViz shows its map error alternative.`);

  await page.getByTestId("data-file-input").setInputFiles(path.join(process.cwd(), "examples/showcase/02_montreal_mobility_constellation.json"));
  await page.getByTestId("data-table-name").fill("montreal_mobility_constellation");
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("data-import-status")).toContainText("Imported", { timeout: 30_000 });

  await selectWorkspaceTab(page, "sql");
  await page.getByTestId("query-name").fill("Montreal mobility map");
  await page.getByTestId("sql-editor").fill("SELECT hotspot_id, latitude, longitude, car_hours, peak_period FROM montreal_mobility_constellation ORDER BY hotspot_id");
  await page.getByTestId("save-query").click();
  await page.getByTestId("run-sql").click();
  await expect(page.getByTestId("query-rows")).toContainText("Rows: 249", { timeout: 30_000 });
  const matrix = await page.evaluate(async () => {
    const renderer = await import("/js/map-renderer.js");
    const result = window.__QUACKVIZ_E2E__.state.currentResult;
    const types = ["map-point", "map-clustered-point", "map-proportional-symbol", "map-category-point"];
    const diagnostics = [];
    for (const type of types) {
      const container = document.createElement("div");
      container.style.cssText = "width:800px;height:480px";
      document.body.appendChild(container);
      const instanceId = `matrix_${type}`;
      const spec = {
        version: 1,
        type,
        title: type,
        dataset: { queryId: result.queryId },
        encoding: {
          latitude: { field: "latitude", dataType: "latitude" },
          longitude: { field: "longitude", dataType: "longitude" },
          label: { field: "hotspot_id", dataType: "category" },
          tooltip: [],
          size: type === "map-proportional-symbol" ? { field: "car_hours", dataType: "number" } : null,
          color: type === "map-category-point" ? { field: "peak_period", dataType: "category" } : null,
          value: null,
          region: null,
        },
        map: { style: "blank", initialView: "fit-data", cluster: type === "map-clustered-point", showLegend: true, showTooltip: true, showScale: true },
      };
      await renderer.renderMapVisualization(container, spec, result, { background: "#fff", accent: "#167c72" }, instanceId);
      renderer.resizeMapInstance(instanceId);
      diagnostics.push({ type, ...renderer.getMapInstanceDiagnostics(instanceId) });
      renderer.disposeMapInstance(instanceId);
      container.remove();
    }
    return { diagnostics, remaining: renderer.getMapRendererStatus().instanceCount };
  });

  for (const diagnostics of matrix.diagnostics) {
    expect(diagnostics.runtimeVersion).toBe("5.24.0");
    expect(diagnostics.sourceIds).toContain("quackviz_points");
    expect(diagnostics.layerIds).toContain("points");
    expect(diagnostics.featureCount).toBe(249);
    if (diagnostics.type === "map-clustered-point") expect(diagnostics.layerIds).toContain("clusters");
  }
  expect(matrix.remaining).toBe(0);
});
