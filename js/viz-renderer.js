import { DEPENDENCIES } from "./constants.js";
import { compileVisualizationSpec } from "./viz-compiler.js";

let echartsModule = null;
let chart = null;
let observer = null;
let currentElement = null;
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
  return { ...status };
}

export async function renderVisualization(element, spec, dataset, themeTokens) {
  try {
    if (!dataset?.rows?.length) {
      showEmpty(element, "Run a query to render a chart.");
      return null;
    }
    const echarts = await loadECharts();
    const option = compileVisualizationSpec(spec, dataset, themeTokens);
    const instance = ensureChart(echarts, element, themeTokens.themeName);
    instance.setOption(option, true);
    status.error = null;
    return option;
  } catch (error) {
    status.error = error.message;
    disposeChart();
    showEmpty(element, `Chart failed to render: ${error.message}`);
    throw error;
  }
}

function ensureChart(echarts, element, themeName) {
  if (chart && currentElement !== element) disposeChart();
  if (!chart) {
    currentElement = element;
    element.textContent = "";
    chart = echarts.init(element, themeName === "dark" ? "dark" : null);
    observer = new ResizeObserver(() => chart?.resize());
    observer.observe(element);
  }
  return chart;
}

export function disposeChart() {
  if (observer) observer.disconnect();
  if (chart) chart.dispose();
  observer = null;
  chart = null;
  currentElement = null;
}

export function resizeChart() {
  if (chart) chart.resize();
}

export function showEmpty(element, message = "No chart to display.") {
  disposeChart();
  element.innerHTML = `<div class="empty-state">${message}</div>`;
}
