import { compileVisualizationSpec } from "../js/viz-compiler.js";

const theme = { background: "#fff", panel: "#fff", text: "#111", muted: "#555", border: "#ddd", accent: "#167c72", grid: "#eee", reducedMotion: false };
const dataset = {
  columns: [
    { name: "month", inferredType: "date", duckType: "DATE" },
    { name: "category", inferredType: "string", duckType: "VARCHAR" },
    { name: "revenue", inferredType: "number", duckType: "DOUBLE" },
  ],
  rows: [{ month: "2026-01-01", category: "Hardware", revenue: 100 }],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function spec(type = "line", zoom = true) {
  return {
    version: 1,
    type,
    title: "Revenue",
    dataset: { queryId: "query_1" },
    encoding: {
      x: { field: type === "bar" ? "category" : "month", dataType: type === "bar" ? "string" : "date", label: "X" },
      y: [{ field: "revenue", dataType: "number", label: "Revenue", format: "currency" }],
    },
    options: { smooth: true, showPoints: false, zoom, legend: false, tooltip: "axis", orientation: "vertical" },
  };
}

export const vizCompilerTests = [
  { name: "viz-compiler: produces line series", run: () => assert(compileVisualizationSpec(spec("line"), dataset, theme).series[0].type === "line", "not line") },
  { name: "viz-compiler: produces bar series", run: () => assert(compileVisualizationSpec(spec("bar"), dataset, theme).series[0].type === "bar", "not bar") },
  { name: "viz-compiler: uses expected fields", run: () => {
    const option = compileVisualizationSpec(spec("line"), dataset, theme);
    assert(option.series[0].encode.x === 0 && option.series[0].encode.y === 1, "bad encode");
    assert(option.series[0].data[0][0] === "2026-01-01" && option.series[0].data[0][1] === 100, "bad series data");
  } },
  { name: "viz-compiler: category axis receives all category values", run: () => {
    const barDataset = {
      columns: dataset.columns,
      rows: [
        { month: "2026-01-01", category: "Hardware", revenue: 100 },
        { month: "2026-02-01", category: "Software", revenue: 140 },
      ],
    };
    const option = compileVisualizationSpec(spec("bar"), barDataset, theme);
    assert(option.xAxis.data.join(",") === "Hardware,Software", "category axis data missing");
    assert(option.series[0].data.join(",") === "100,140", "category series data missing");
  } },
  { name: "viz-compiler: includes zoom only when enabled", run: () => {
    const zoom = compileVisualizationSpec(spec("line", true), dataset, theme).dataZoom;
    assert(zoom.length === 1 && zoom.every((item) => item.start === 0 && item.end === 100), "zoom missing full range");
    assert(compileVisualizationSpec(spec("line", false), dataset, theme).dataZoom === undefined, "zoom present");
  } },
  { name: "viz-compiler: applies title and theme tokens", run: () => {
    const option = compileVisualizationSpec(spec("bar"), dataset, theme);
    assert(option.title.text === "Revenue" && option.color[0] === theme.accent, "theme/title missing");
  } },
  { name: "viz-compiler: does not mutate spec or rows", run: () => {
    const input = spec("line");
    const rowsBefore = JSON.stringify(dataset.rows);
    const specBefore = JSON.stringify(input);
    compileVisualizationSpec(input, dataset, theme);
    assert(JSON.stringify(input) === specBefore, "spec mutated");
    assert(JSON.stringify(dataset.rows) === rowsBefore, "rows mutated");
  } },
];
