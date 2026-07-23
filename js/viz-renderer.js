import { DEPENDENCIES } from "./constants.js";
import { compileVisualizationSpec } from "./viz-compiler.js";

let echartsModule = null;
const instances = new Map();
let status = {
  echartsPackageVersion: DEPENDENCIES.echarts.version,
  echartsRuntimeVersion: "not loaded",
  error: null,
};

export async function loadECharts() {
  if (!echartsModule) {
    echartsModule = await import(DEPENDENCIES.echarts.url);
    status.echartsRuntimeVersion = echartsModule.version || "unknown";
  }
  return echartsModule;
}

export function getRendererStatus() {
  return { ...status, instanceCount: instances.size };
}

export async function createChartInstance(container, instanceId, themeName = "light") {
  const echarts = await loadECharts();
  const existing = instances.get(instanceId);
  if (existing?.container === container) return existing.chart;
  if (existing) disposeChartInstance(instanceId);
  container.textContent = "";
  const chart = echarts.init(container, themeName === "dark" ? "dark" : null);
  const observer = new ResizeObserver(() => chart.resize());
  observer.observe(container);
  instances.set(instanceId, { chart, container, observer, themeName });
  return chart;
}

export function renderChartInstance(instanceId, option) {
  const entry = instances.get(instanceId);
  if (!entry) throw new Error(`Chart instance '${instanceId}' does not exist.`);
  entry.chart.setOption(option, true);
}

export function resizeChartInstance(instanceId) {
  instances.get(instanceId)?.chart.resize();
}

export function disposeChartInstance(instanceId) {
  const entry = instances.get(instanceId);
  if (!entry) return;
  entry.observer.disconnect();
  entry.chart.dispose();
  instances.delete(instanceId);
}

export function disposeAllCharts() {
  for (const id of [...instances.keys()]) disposeChartInstance(id);
}

export async function renderVisualization(element, spec, dataset, themeTokens, instanceId = "main") {
  try {
    if (!dataset?.rows?.length) {
      showEmpty(element, "Run a query to render a chart.", instanceId);
      return null;
    }
    const option = compileVisualizationSpec(spec, dataset, themeTokens);
    await createChartInstance(element, instanceId, themeTokens.themeName);
    renderChartInstance(instanceId, option);
    status.error = null;
    return option;
  } catch (error) {
    status.error = error.message;
    disposeChartInstance(instanceId);
    showEmpty(element, `Chart failed to render: ${error.message}`, instanceId);
    throw error;
  }
}

export function disposeChart() {
  disposeChartInstance("main");
}

export function resizeChart() {
  resizeChartInstance("main");
}

export function showEmpty(element, message = "No chart to display.", instanceId = null) {
  if (instanceId) disposeChartInstance(instanceId);
  element.innerHTML = `<div class="empty-state">${message}</div>`;
}
