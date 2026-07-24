const { test: base, expect } = require("@playwright/test");

const echartsMock = `
export const version = "6.0.0-e2e";
export function init(container) {
  container.textContent = "";
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  container.appendChild(canvas);
  return {
    setOption(option) { this.option = option; },
    resize() { this.resized = true; },
    dispose() { container.textContent = ""; },
    on() {},
    off() {},
  };
}
`;

const maplibreMock = `
export const version = "5.24.0-e2e";
export class AttributionControl {}
export class ScaleControl {}
export class Map {
  constructor(options = {}) {
    this.options = options;
    this.sources = new globalThis.Map();
    this.layers = new globalThis.Map();
    this.handlers = [];
    this.canvas = document.createElement("canvas");
    this.canvas.width = 640;
    this.canvas.height = 360;
    this.canvas.className = "maplibregl-canvas";
    options.container.appendChild(this.canvas);
  }
  loaded() { return true; }
  once(_event, fn) { setTimeout(fn, 0); }
  addControl() {}
  setStyle(style) { this.style = style; }
  addSource(id, source) { this.sources.set(id, { ...source, setData(data) { this.data = data; } }); }
  getSource(id) { return this.sources.get(id); }
  addLayer(layer) { this.layers.set(layer.id, layer); }
  getLayer(id) { return this.layers.get(id); }
  fitBounds(bounds, options) { this.bounds = bounds; this.fitOptions = options; }
  resize() { this.resized = true; }
  remove() { this.options.container.textContent = ""; }
  on(event, layerId, fn) { this.handlers.push({ event, layerId, fn }); }
  off(event, layerId, fn) { this.handlers = this.handlers.filter((item) => item.event !== event || item.layerId !== layerId || item.fn !== fn); }
  getCanvas() { return this.canvas; }
}
export default { version, Map, AttributionControl, ScaleControl };
`;

const harmlessConsole = [
  /Download the Vue Devtools/i,
];

exports.test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const failures = [];
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (harmlessConsole.some((pattern) => pattern.test(text))) return;
      failures.push(`console error: ${text}`);
    });
    page.on("requestfailed", (request) => {
      const url = request.url();
      const local = url.startsWith("http://127.0.0.1:8080/");
      if (local) failures.push(`local request failed: ${url} ${request.failure()?.errorText || ""}`);
    });
    await page.route("https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.esm.min.js", (route) => route.fulfill({
      contentType: "application/javascript",
      body: echartsMock,
    }));
    await page.route("https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/+esm", (route) => route.fulfill({
      contentType: "application/javascript",
      body: maplibreMock,
    }));
    await page.route("https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.css", (route) => route.fulfill({
      contentType: "text/css",
      body: ".maplibregl-canvas{display:block;width:100%;height:100%;}",
    }));
    await page.route("https://openrouter.ai/**", async (route) => {
      const url = route.request().url();
      if (url.endsWith("/models")) {
        await route.fulfill({ json: { data: [{ id: "mock/model", name: "Mock Model" }] } });
        return;
      }
      await route.fulfill({
        json: {
          choices: [{ message: { content: JSON.stringify({ contract: "quackviz-ai-package-plan", contractVersion: 1, recommendedMode: "standalone", recommendedDataMode: "external", entrypoints: [], include: {}, privacyRecommendations: [], capabilities: { filters: true, dataExport: false }, cautions: [] }) } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
      });
    });
    page.__e2eFailures = failures;
    await use(page);
    expect(failures, `Unexpected browser failures in ${testInfo.title}`).toEqual([]);
  },
});

exports.expect = expect;

exports.gotoApp = async function gotoApp(page, path = "/") {
  await page.goto(path);
  await page.waitForFunction(() => window.__QUACKVIZ_E2E__?.appReady === true);
};

async function selectWorkspaceTab(page, name) {
  await page.getByTestId(`tab-${name}`).click();
  await page.waitForFunction((tabName) => document.getElementById(`${tabName}Tab`)?.classList.contains("active"), name);
}

exports.waitForDuckDB = async function waitForDuckDB(page) {
  await page.waitForFunction(() => window.__QUACKVIZ_E2E__?.dbReady === true, null, { timeout: 60_000 });
};

exports.waitForRender = async function waitForRender(page) {
  await page.waitForFunction(() => window.__QUACKVIZ_E2E__?.renderReady === true, null, { timeout: 30_000 });
};

exports.loadSampleAndRunQuery = async function loadSampleAndRunQuery(page) {
  await page.getByTestId("load-sample").click();
  await page.waitForFunction(() => window.__QUACKVIZ_E2E__?.state.statuses.some((status) => status.source === "sample" && status.operation === "load" && /loaded/i.test(status.message)), null, { timeout: 30_000 });
  await expect(page.getByTestId("schema-view")).toContainText("sales", { timeout: 30_000 });
  await selectWorkspaceTab(page, "sql");
  await page.getByTestId("run-sql").click();
  await expect(page.getByTestId("query-rows")).toContainText(/Rows: [1-9]/, { timeout: 30_000 });
  await expect(page.getByTestId("results-table")).toContainText("revenue");
  await page.waitForFunction(() => Boolean(window.__QUACKVIZ_E2E__?.state.currentResult?.rows?.length), null, { timeout: 30_000 });
};

exports.loadTelemetryAndRunMapQuery = async function loadTelemetryAndRunMapQuery(page) {
  await page.evaluate(async () => {
    const [{ importSample }, { updateWorkspace, markTableLoaded, setActive }, { addOrUpdateDataSource }] = await Promise.all([
      import("/js/import.js"),
      import("/js/state.js"),
      import("/js/workspace.js"),
    ]);
    const source = await importSample("/samples/telemetry.csv", "telemetry", "Telemetry", "telemetry.csv");
    updateWorkspace((workspace) => addOrUpdateDataSource(workspace, source));
    markTableLoaded(source.tableName, true);
    setActive({ dataSourceId: source.id });
  });
  await selectWorkspaceTab(page, "sql");
  await page.getByTestId("query-name").fill("Telemetry locations");
  await page.getByTestId("sql-editor").fill("SELECT latitude, longitude, site, temperature FROM telemetry ORDER BY site;");
  await page.getByTestId("run-sql").click();
  await expect(page.getByTestId("query-rows")).toContainText(/Rows: [1-9]/, { timeout: 30_000 });
  await expect(page.getByTestId("results-table")).toContainText("latitude");
  await page.waitForFunction(() => Boolean(window.__QUACKVIZ_E2E__?.state.currentResult?.rows?.length), null, { timeout: 30_000 });
};

exports.saveQueryAndVisualization = async function saveQueryAndVisualization(page) {
  await selectWorkspaceTab(page, "sql");
  await page.getByTestId("save-query").click();
  await expect(page.getByTestId("saved-queries")).toContainText("Monthly revenue");
  await page.getByTestId("run-sql").click();
  await page.waitForFunction(() => Boolean(window.__QUACKVIZ_E2E__?.state.currentOption), null, { timeout: 30_000 });
  await selectWorkspaceTab(page, "visualize");
  await exports.waitForRender(page);
  await page.getByTestId("save-viz").click();
  await expect(page.getByTestId("saved-visualizations")).toContainText(/Revenue by Month|Monthly revenue/);
  await page.evaluate(async () => {
    const { saveWorkspace } = await import("/js/storage.js");
    await saveWorkspace(window.__QUACKVIZ_E2E__.state.workspace);
  });
};

exports.selectWorkspaceTab = selectWorkspaceTab;

exports.runBrowserUnitTests = async function runBrowserUnitTests(page) {
  await page.goto("/tests/");
  await expect(page.locator("#results")).toContainText(/passed/, { timeout: 30_000 });
  const failures = await page.locator(".fail").count();
  expect(failures).toBe(0);
};
