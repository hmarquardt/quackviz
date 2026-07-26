const { test, expect, gotoApp } = require("../fixtures");

test.use({ realRenderers: true });

async function loadShowcaseRecipe(page, title, rowCount) {
  await gotoApp(page);
  await page.getByTestId("browse-showcase").click();
  const card = page.getByTestId("showcase-gallery").locator(".showcase-card").filter({ hasText: title });
  await card.getByRole("button", { name: `Load ${title}` }).click();
  await expect(page.getByTestId("data-import-status")).toContainText("Imported", { timeout: 30_000 });
  await expect(page.getByTestId("schema-view")).toContainText(`${rowCount} rows`);
  await page.getByTestId("browse-showcase").click();
  await card.getByRole("button", { name: `View ${title} demo recipe` }).click();
  await page.getByRole("button", { name: "Open SQL in Analyze" }).click();
  await page.getByTestId("query-name").fill(`${title} recipe`);
  await page.getByTestId("save-query").click();
  await page.getByTestId("run-sql").click();
}

test("Tech Stock recipe renders a real line chart", async ({ page }) => {
  await loadShowcaseRecipe(page, "Tech Stock Time Machine", 630);
  await expect(page.getByTestId("query-rows")).toContainText("Rows: 105", { timeout: 30_000 });
  const diagnostics = await page.evaluate(async () => {
    const renderer = await import("/js/viz-renderer.js");
    const result = window.__QUACKVIZ_E2E__.state.currentResult;
    const container = document.createElement("div");
    container.style.cssText = "width:800px;height:480px";
    document.body.appendChild(container);
    const spec = {
      version: 1,
      type: "line",
      title: "Apple index history",
      dataset: { queryId: result.queryId },
      encoding: {
        x: { field: "date", dataType: "date" },
        y: [{ field: "price_index", dataType: "number", aggregate: null }],
        color: null,
        size: null,
        label: null,
        tooltip: [],
      },
      options: { smooth: false, showPoints: false, zoom: true, legend: false },
    };
    await renderer.renderVisualization(container, spec, result, { background: "#fff" }, "showcase_tech");
    const value = { ...renderer.getChartInstanceDiagnostics("showcase_tech"), canvasCount: container.querySelectorAll("canvas").length };
    renderer.disposeChartInstance("showcase_tech");
    container.remove();
    return { ...value, disposed: renderer.getChartInstanceDiagnostics("showcase_tech") === null };
  });
  expect(diagnostics.runtimeVersion).toBe("6.1.0");
  expect(diagnostics.seriesTypes).toEqual(["line"]);
  expect(diagnostics.datasetRowCount).toBe(105);
  expect(diagnostics.canvasCount).toBe(1);
  expect(diagnostics.disposed).toBe(true);
});

test("Global Development recipe renders a real proportional point map", async ({ page, browserName }) => {
  await gotoApp(page);
  const webgl = await page.evaluate(() => Boolean(document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl")));
  test.skip(!webgl, `${browserName} Playwright environment does not expose WebGL; QuackViz shows its map error alternative.`);

  await page.getByTestId("browse-showcase").click();
  const card = page.getByTestId("showcase-gallery").locator(".showcase-card").filter({ hasText: "Global Development Odyssey" });
  await card.getByRole("button", { name: "Load Global Development Odyssey" }).click();
  await expect(page.getByTestId("data-import-status")).toContainText("Imported", { timeout: 30_000 });
  await expect(page.getByTestId("schema-view")).toContainText("1704 rows");
  await page.getByTestId("browse-showcase").click();
  await card.getByRole("button", { name: "View Global Development Odyssey demo recipe" }).click();
  await page.getByRole("button", { name: "Open SQL in Analyze" }).click();
  await page.getByTestId("query-name").fill("Global Development recipe");
  await page.getByTestId("save-query").click();
  await page.getByTestId("run-sql").click();
  await expect(page.getByTestId("query-rows")).toContainText("Rows: 142", { timeout: 30_000 });

  const diagnostics = await page.evaluate(async () => {
    const renderer = await import("/js/map-renderer.js");
    const result = window.__QUACKVIZ_E2E__.state.currentResult;
    const container = document.createElement("div");
    container.style.cssText = "width:800px;height:480px";
    document.body.appendChild(container);
    const spec = {
      version: 1,
      type: "map-proportional-symbol",
      title: "Population by country centroid",
      dataset: { queryId: result.queryId },
      encoding: {
        latitude: { field: "centroid_lat", dataType: "latitude" },
        longitude: { field: "centroid_lon", dataType: "longitude" },
        label: { field: "country", dataType: "category" },
        tooltip: [],
        size: { field: "population_millions", dataType: "number" },
        color: null,
        value: null,
        region: null,
      },
      map: { style: "blank", initialView: "fit-data", cluster: false, showLegend: true, showTooltip: true, showScale: true },
    };
    await renderer.renderMapVisualization(container, spec, result, { background: "#fff", accent: "#167c72" }, "showcase_global");
    const value = renderer.getMapInstanceDiagnostics("showcase_global");
    renderer.disposeMapInstance("showcase_global");
    container.remove();
    return { ...value, disposed: renderer.getMapInstanceDiagnostics("showcase_global") === null };
  });
  expect(diagnostics.runtimeVersion).toBe("5.24.0");
  expect(diagnostics.sourceIds).toContain("quackviz_points");
  expect(diagnostics.layerIds).toContain("points");
  expect(diagnostics.featureCount).toBe(142);
  expect(diagnostics.disposed).toBe(true);
});
