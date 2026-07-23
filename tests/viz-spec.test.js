import { defaultVisualizationSpec, validateVisualizationSpec } from "../js/viz-spec.js";

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

function spec(type = "line") {
  return {
    version: 1,
    type,
    title: "Revenue",
    dataset: { queryId: "query_1" },
    encoding: {
      x: { field: type === "bar" ? "category" : "month", dataType: type === "bar" ? "string" : "date", label: "X" },
      y: [{ field: "revenue", dataType: "number", label: "Revenue" }],
    },
    options: { smooth: true, showPoints: false, zoom: true, legend: false, tooltip: "axis", orientation: "vertical" },
  };
}

export const vizSpecTests = [
  { name: "viz-spec: valid line spec", run: () => assert(validateVisualizationSpec(spec("line"), dataset).valid, "line spec should be valid") },
  { name: "viz-spec: valid bar spec", run: () => assert(validateVisualizationSpec(spec("bar"), dataset).valid, "bar spec should be valid") },
  { name: "viz-spec: missing X field", run: () => assert(!validateVisualizationSpec({ ...spec(), encoding: { ...spec().encoding, x: null } }, dataset).valid, "missing x should fail") },
  { name: "viz-spec: missing Y field", run: () => assert(!validateVisualizationSpec({ ...spec(), encoding: { ...spec().encoding, y: [] } }, dataset).valid, "missing y should fail") },
  { name: "viz-spec: unknown result field", run: () => assert(!validateVisualizationSpec({ ...spec(), encoding: { ...spec().encoding, x: { field: "missing" }, y: spec().encoding.y } }, dataset).valid, "unknown field should fail") },
  { name: "viz-spec: unsupported spec version", run: () => assert(!validateVisualizationSpec({ ...spec(), version: 99 }, dataset).valid, "future version should fail") },
  { name: "viz-spec: unsupported chart type", run: () => assert(!validateVisualizationSpec({ ...spec(), type: "pie" }, dataset).valid, "pie should fail") },
  { name: "viz-spec: function value rejected", run: () => assert(!validateVisualizationSpec({ ...spec(), options: { ...spec().options, tooltip: "() => 1" } }, dataset).valid, "function string should fail") },
  { name: "viz-spec: caller object not mutated", run: () => {
    const original = spec();
    const before = JSON.stringify(original);
    validateVisualizationSpec(original, dataset);
    assert(JSON.stringify(original) === before, "spec mutated");
  } },
  { name: "viz-spec: default spec validates", run: () => assert(validateVisualizationSpec(defaultVisualizationSpec({ queryId: "query_1", columns: dataset.columns }), dataset).valid, "default spec invalid") },
];
