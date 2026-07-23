import { validateVisualizationSpec } from "./viz-spec.js";

function values(rows, field) {
  return rows.map((row) => row[field]);
}

function groupedSeries(rows, xField, yField, seriesField, stack) {
  const xs = [...new Set(values(rows, xField))];
  const groups = [...new Set(values(rows, seriesField))];
  return {
    xData: xs,
    series: groups.map((group) => ({
      type: "bar",
      name: String(group),
      stack: stack ? "total" : undefined,
      data: xs.map((x) => {
        const found = rows.find((row) => row[xField] === x && row[seriesField] === group);
        return found ? Number(found[yField]) : 0;
      }),
    })),
  };
}

function boxValues(rows, field) {
  const sorted = values(rows, field).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return [0, 0, 0, 0, 0];
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
  return [sorted[0], pick(0.25), pick(0.5), pick(0.75), sorted[sorted.length - 1]];
}

export function compileVisualizationSpec(spec, rows, columns, theme = "dark") {
  const result = validateVisualizationSpec(spec);
  if (!result.valid) throw new Error(result.errors.join(" "));
  const s = result.spec;
  const y = s.encoding.y[0];
  const x = s.encoding.x;
  const dark = theme === "dark";
  const base = {
    backgroundColor: "transparent",
    aria: { enabled: true },
    title: { text: s.title, subtext: s.subtitle || "", left: 8, textStyle: { color: dark ? "#e7edf7" : "#17202f" } },
    color: ["#2aa198", "#4c78a8", "#f58518", "#e45756", "#72b7b2", "#b279a2", "#54a24b"],
    tooltip: s.options.tooltip ? { trigger: s.options.tooltip === "item" ? "item" : "axis" } : undefined,
    legend: s.options.legend ? { top: 28, textStyle: { color: dark ? "#c7d0dd" : "#4d5968" } } : undefined,
    toolbox: { right: 8, feature: { restore: {}, saveAsImage: {} } },
    dataset: { dimensions: columns.map((c) => c.name), source: rows },
  };

  const cartesian = {
    ...base,
    grid: { left: 48, right: 28, top: 76, bottom: s.options.zoom ? 72 : 42, containLabel: true },
    xAxis: { type: "category", name: x?.label || x?.field, axisLabel: { color: dark ? "#b8c2d0" : "#4d5968" } },
    yAxis: { type: "value", name: y?.label || y?.field, axisLabel: { color: dark ? "#b8c2d0" : "#4d5968" } },
    dataZoom: s.options.zoom ? [{ type: "inside" }, { type: "slider", bottom: 22 }] : undefined,
  };

  if (s.type === "horizontal-bar") {
    return { ...cartesian, xAxis: cartesian.yAxis, yAxis: { ...cartesian.xAxis, type: "category" }, series: [{ type: "bar", encode: { x: y.field, y: x.field }, label: { show: s.options.labels } }] };
  }
  if (["vertical-bar", "grouped-bar", "stacked-bar"].includes(s.type)) {
    if (s.encoding.series?.field) {
      const grouped = groupedSeries(rows, x.field, y.field, s.encoding.series.field, s.type === "stacked-bar" || s.options.stack);
      return { ...cartesian, dataset: undefined, xAxis: { ...cartesian.xAxis, data: grouped.xData }, series: grouped.series.map((item) => ({ ...item, label: { show: s.options.labels } })) };
    }
    const ys = s.encoding.y.length > 1 ? s.encoding.y : [y];
    return { ...cartesian, series: ys.map((field) => ({ type: "bar", name: field.label || field.field, stack: s.type === "stacked-bar" || s.options.stack ? "total" : undefined, encode: { x: x.field, y: field.field }, label: { show: s.options.labels } })) };
  }
  if (s.type === "line" || s.type === "area") {
    return { ...cartesian, series: s.encoding.y.map((field) => ({ type: "line", name: field.label || field.field, smooth: s.options.smooth, showSymbol: s.options.showPoints, areaStyle: s.type === "area" ? {} : undefined, encode: { x: x.field, y: field.field } })) };
  }
  if (s.type === "scatter" || s.type === "bubble") {
    return { ...cartesian, xAxis: { ...cartesian.yAxis, name: x.label || x.field }, series: [{ type: "scatter", symbolSize: s.type === "bubble" && s.encoding.size ? (value) => Math.max(6, Math.sqrt(Number(value[s.encoding.size.field]) || 1) * 2) : 10, encode: { x: x.field, y: y.field, tooltip: columns.map((c) => c.name) } }] };
  }
  if (s.type === "pie" || s.type === "donut") {
    return { ...base, tooltip: { trigger: "item" }, series: [{ type: "pie", radius: s.type === "donut" ? ["42%", "70%"] : "70%", center: ["50%", "55%"], encode: { itemName: x?.field, value: y.field }, label: { show: s.options.labels } }] };
  }
  if (s.type === "heatmap") {
    const seriesField = s.encoding.series?.field;
    return { ...base, xAxis: { type: "category", data: [...new Set(values(rows, x.field))] }, yAxis: { type: "category", data: [...new Set(values(rows, seriesField))] }, visualMap: { min: 0, max: Math.max(...values(rows, y.field).map(Number).filter(Number.isFinite), 1), calculable: true, orient: "horizontal", left: "center", bottom: 8 }, series: [{ type: "heatmap", data: rows.map((r) => [r[x.field], r[seriesField], r[y.field]]), label: { show: s.options.labels } }] };
  }
  if (s.type === "histogram") {
    return { ...cartesian, series: [{ type: "bar", encode: { x: x.field, y: y.field }, barWidth: "98%" }] };
  }
  if (s.type === "boxplot") {
    return { ...base, grid: cartesian.grid, xAxis: { type: "category", data: [y.label || y.field] }, yAxis: { type: "value" }, series: [{ type: "boxplot", data: [boxValues(rows, y.field)] }] };
  }
  return cartesian;
}
