import { compileVisualizationSpec } from "./viz-compiler.js";

let chart = null;
let observer = null;

export function ensureChartInstance(element, theme) {
  if (!chart) {
    chart = echarts.init(element, theme);
    observer = new ResizeObserver(() => resizeChart());
    observer.observe(element);
  }
  return chart;
}

export function disposeChart() {
  if (observer) observer.disconnect();
  if (chart) chart.dispose();
  chart = null;
}

export function resizeChart() {
  if (chart) chart.resize();
}

export function renderChart(element, spec, rows, columns, theme) {
  const instance = ensureChartInstance(element, theme);
  const option = compileVisualizationSpec(spec, rows, columns, theme);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  instance.setOption({ ...option, animation: !reducedMotion }, true);
  return option;
}

export function exportChartPNG(filename = "quackviz-chart.png") {
  if (!chart) throw new Error("No chart has been rendered.");
  const url = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: getComputedStyle(document.body).getPropertyValue("--surface") });
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

