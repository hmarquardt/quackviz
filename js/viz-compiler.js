import { deepClone, formatNumber } from "./utils.js";
import { validateVisualizationSpec } from "./viz-spec.js";

export function compileVisualizationSpec(inputSpec, dataset, themeTokens) {
  const validation = validateVisualizationSpec(inputSpec, dataset);
  if (!validation.valid) {
    const error = new Error("Visualization spec is invalid.");
    error.validation = validation;
    throw error;
  }
  const spec = validation.spec;
  const rows = deepClone(dataset.rows || []);
  const columns = deepClone(dataset.columns || []);
  const x = spec.encoding.x;
  const yFields = spec.encoding.y;
  const isLine = spec.type === "line";
  const xAxisType = isLine && x.dataType === "date" ? "time" : "category";
  return {
    backgroundColor: themeTokens.background,
    color: [themeTokens.accent, "#4c78a8", "#f58518", "#e45756"],
    animation: !themeTokens.reducedMotion,
    textStyle: { color: themeTokens.text },
    title: {
      text: spec.title,
      subtext: spec.subtitle,
      left: 8,
      top: 6,
      textStyle: { color: themeTokens.text, fontSize: 16 },
      subtextStyle: { color: themeTokens.muted },
    },
    grid: {
      left: 56,
      right: 24,
      top: spec.subtitle ? 78 : 58,
      bottom: spec.options.zoom ? 76 : 42,
      containLabel: true,
    },
    dataset: {
      dimensions: columns.map((column) => column.name),
      source: rows,
    },
    xAxis: {
      type: xAxisType,
      name: x.label,
      axisLine: { lineStyle: { color: themeTokens.border } },
      axisLabel: { color: themeTokens.muted, formatter: xAxisType === "time" ? "{yyyy}-{MM}" : undefined },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: yFields[0]?.label || "",
      axisLine: { lineStyle: { color: themeTokens.border } },
      axisLabel: { color: themeTokens.muted, formatter: axisFormatter(yFields[0]) },
      splitLine: { lineStyle: { color: themeTokens.grid } },
    },
    tooltip: spec.options.tooltip ? {
      trigger: spec.options.tooltip,
      valueFormatter: (value) => formatTooltipValue(value, yFields[0]),
    } : undefined,
    legend: spec.options.legend ? {
      top: 28,
      right: 12,
      textStyle: { color: themeTokens.muted },
    } : undefined,
    dataZoom: spec.options.zoom ? [
      { type: "inside", filterMode: "none" },
      { type: "slider", bottom: 22, borderColor: themeTokens.border, textStyle: { color: themeTokens.muted } },
    ] : undefined,
    series: yFields.map((field) => ({
      type: isLine ? "line" : "bar",
      name: field.label || field.field,
      smooth: isLine ? spec.options.smooth : undefined,
      showSymbol: isLine ? spec.options.showPoints : undefined,
      symbolSize: isLine ? 7 : undefined,
      barMaxWidth: isLine ? undefined : 48,
      label: { show: spec.options.labels, color: themeTokens.text },
      encode: { x: x.field, y: field.field, tooltip: columns.map((column) => column.name) },
    })),
  };
}

function axisFormatter(field) {
  if (field?.format === "currency") return (value) => `$${formatNumber(value, { notation: "compact", maximumFractionDigits: 1 })}`;
  return (value) => formatNumber(value, { notation: "compact", maximumFractionDigits: 1 });
}

function formatTooltipValue(value, field) {
  if (field?.format === "currency") return `$${formatNumber(value, { maximumFractionDigits: 2 })}`;
  if (field?.dataType === "number") return formatNumber(value, { maximumFractionDigits: 2 });
  return value;
}
