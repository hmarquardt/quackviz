const path = require("node:path");
const { test, expect, gotoApp, selectWorkspaceTab } = require("../fixtures");

test.use({ realRenderers: true });

test("real JSON import renders stable line and bar charts", async ({ page }) => {
  await gotoApp(page);
  await page.getByTestId("data-file-input").setInputFiles(path.join(process.cwd(), "examples/showcase/01_global_development_odyssey.json"));
  await page.getByTestId("data-table-name").fill("global_development_odyssey");
  await page.getByTestId("data-import-confirm").click();
  await expect(page.getByTestId("data-import-status")).toContainText("Imported", { timeout: 30_000 });
  await expect(page.getByTestId("schema-view")).toContainText("1704 rows");

  await selectWorkspaceTab(page, "sql");
  await page.getByTestId("query-name").fill("European development trend");
  await page.getByTestId("sql-editor").fill("SELECT year, AVG(lifeExp) AS life_expectancy FROM global_development_odyssey WHERE continent = 'Europe' GROUP BY year ORDER BY year");
  await page.getByTestId("save-query").click();
  await page.getByTestId("run-sql").click();
  await expect(page.getByTestId("query-rows")).toContainText("Rows: 12", { timeout: 30_000 });

  const matrix = await page.evaluate(async () => {
    const result = window.__QUACKVIZ_E2E__.state.currentResult;
    const renderer = await import("/js/viz-renderer.js");
    const diagnostics = [];
    for (const type of ["line", "bar"]) {
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
          x: { field: "year", dataType: "number" },
          y: [{ field: "life_expectancy", dataType: "number", aggregate: null }],
          color: null,
          size: null,
          label: null,
          tooltip: [],
        },
        options: { smooth: false, showPoints: true, zoom: true, legend: false },
      };
      await renderer.renderVisualization(container, spec, result, { background: "#fff" }, instanceId);
      renderer.resizeChartInstance(instanceId);
      diagnostics.push({ type, ...renderer.getChartInstanceDiagnostics(instanceId), canvasCount: container.querySelectorAll("canvas").length });
      renderer.disposeChartInstance(instanceId);
      container.remove();
    }
    return {
      diagnostics,
      matrixInstancesDisposed: ["matrix_line", "matrix_bar"].every((instanceId) => renderer.getChartInstanceDiagnostics(instanceId) === null),
    };
  });
  for (const diagnostics of matrix.diagnostics) {
    expect(diagnostics.runtimeVersion).toBe("6.1.0");
    expect(diagnostics.seriesTypes).toEqual([diagnostics.type]);
    expect(diagnostics.datasetRowCount).toBe(12);
    expect(diagnostics.canvasCount).toBe(1);
  }
  expect(matrix.matrixInstancesDisposed).toBe(true);
});
