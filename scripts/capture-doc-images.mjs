import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.QUACKVIZ_BASE_URL || "http://127.0.0.1:8080";
const output = "docs/images";
await mkdir(output, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.addInitScript(() => localStorage.setItem("quackviz.onboarding.welcomeDismissed", "true"));

async function ready() {
  await page.goto(baseUrl);
  await page.waitForFunction(() => window.__QUACKVIZ_E2E__?.appReady && window.__QUACKVIZ_E2E__?.dbReady, null, { timeout: 60_000 });
}

async function shot(name) {
  await page.screenshot({ path: `${output}/${name}`, animations: "disabled" });
}

async function openTab(name) {
  await page.getByTestId(`tab-${name}`).click();
  await page.locator(`#${name}Tab`).waitFor({ state: "visible" });
}

async function dismissNotifications() {
  const buttons = page.locator(".toast-dismiss");
  while (await buttons.count()) await buttons.first().click();
}

await ready();
await shot("quackviz-data.png");
await page.getByTestId("browse-showcase").click();
await shot("quackviz-showcase.png");
const techCard = page.getByTestId("showcase-gallery").locator(".showcase-card").filter({ hasText: "Tech Stock Time Machine" });
await techCard.getByRole("button", { name: "Load Tech Stock Time Machine" }).click();
await page.getByTestId("data-import-status").getByText(/Imported/).waitFor({ timeout: 30_000 });
await dismissNotifications();
await shot("quackviz-data.png");

await page.getByTestId("browse-showcase").click();
await techCard.getByRole("button", { name: "View Tech Stock Time Machine demo recipe" }).click();
await page.getByRole("button", { name: "Open SQL in Analyze" }).click();
await page.getByTestId("query-name").fill("Quarterly Apple index");
await page.getByTestId("sql-editor").fill("SELECT quarter, ROUND(AVG(price_index), 3) AS price_index FROM table_03_tech_stock_time_machine WHERE symbol = 'AAPL' GROUP BY quarter ORDER BY quarter");
await page.getByTestId("save-query").click();
await page.getByTestId("run-sql").click();
await page.getByTestId("query-rows").getByText(/Rows: 8/).waitFor({ timeout: 30_000 });
await dismissNotifications();
await shot("quackviz-analysis.png");

await openTab("visualize");
await page.waitForFunction(() => window.__QUACKVIZ_E2E__?.renderReady === true, null, { timeout: 30_000 });
const chartDiagnostics = await page.evaluate(async () => (await import("/js/viz-renderer.js")).getChartInstanceDiagnostics("main"));
if (chartDiagnostics?.seriesDataCounts?.[0] !== 8) throw new Error("Documentation chart did not render all expected points.");
console.log(`Chart diagnostics: ${JSON.stringify(chartDiagnostics)}`);
await shot("quackviz-chart.png");
await page.getByTestId("save-viz").click();
await dismissNotifications();

await openTab("dashboard");
await page.getByTestId("new-dashboard").click();
await page.getByTestId("add-dashboard-viz").click();
await page.getByTestId("refresh-dashboard").click();
await page.getByTestId("dashboard-card").filter({ hasText: "ready" }).waitFor({ timeout: 30_000 });
await dismissNotifications();
await shot("quackviz-dashboard.png");

await openTab("report");
await page.getByTestId("new-report").click();
await page.getByTestId("report-section-type").selectOption("visualization");
const visualizationId = await page.evaluate(() => window.__QUACKVIZ_E2E__.state.workspace.visualizations[0].id);
await page.getByTestId("report-source-viz").selectOption(visualizationId);
await page.getByTestId("add-report-section").click();
await page.getByTestId("refresh-report-section").click();
await page.getByTestId("report-preview").getByText(/visualization · ready/i).waitFor({ timeout: 30_000 });
await dismissNotifications();
await shot("quackviz-report.png");

await openTab("data");
await page.getByTestId("browse-showcase").click();
const montrealCard = page.getByTestId("showcase-gallery").locator(".showcase-card").filter({ hasText: "Montreal Mobility Constellation" });
await montrealCard.getByRole("button", { name: "Load Montreal Mobility Constellation" }).click();
await page.waitForFunction(() => window.__QUACKVIZ_E2E__.state.workspace.dataSources.some((source) => (
  source.fileName === "02_montreal_mobility_constellation.json" && source.rowCount === 249
)), null, { timeout: 30_000 });
const montrealTable = await page.evaluate(() => window.__QUACKVIZ_E2E__.state.workspace.dataSources.find((source) => (
  source.fileName === "02_montreal_mobility_constellation.json"
)).tableName);
await openTab("sql");
await page.getByTestId("sql-editor").fill(`SELECT hotspot_id, latitude, longitude, car_hours, peak_period FROM "${montrealTable.replaceAll('"', '""')}" ORDER BY hotspot_id`);
await page.getByTestId("run-sql").click();
await page.waitForFunction(() => document.querySelector('[data-testid="query-rows"]')?.textContent.includes("Rows: 249"), null, { timeout: 30_000 });
await openTab("visualize");
await page.evaluate(async () => {
  const { setCurrentSpec } = await import("/js/state.js");
  const renderer = await import("/js/map-renderer.js");
  const result = window.__QUACKVIZ_E2E__.state.currentResult;
  const spec = {
    version: 1,
    type: "map-clustered-point",
    title: "Montreal mobility hotspots",
    dataset: { queryId: result.queryId },
    encoding: {
      latitude: { field: "latitude", dataType: "latitude" },
      longitude: { field: "longitude", dataType: "longitude" },
      label: { field: "hotspot_id", dataType: "category" },
      tooltip: [],
      size: null,
      color: null,
      value: null,
      region: null,
    },
    map: { style: "blank", initialView: "fit-data", cluster: true, showLegend: true, showTooltip: true, showScale: true },
  };
  setCurrentSpec(spec);
  await renderer.renderMapVisualization(document.getElementById("chart"), spec, result, { background: "#fff", accent: "#167c72" }, "docs_map");
});
await page.locator("#chart .maplibregl-canvas").waitFor({ timeout: 30_000 });
await dismissNotifications();
await shot("quackviz-map.png");

await page.getByTestId("theme-select").selectOption("dark");
await shot("quackviz-dark.png");

await browser.close();
console.log(`Captured QuackViz documentation images in ${output}.`);
