import { compileMapSpec } from "../js/map-compiler.js";
import { exportMapVisualizationPackage } from "../js/map-export.js";
import { defaultMapSpec } from "../js/map-spec.js";
import { APP_VERSION } from "../js/constants.js";
import { validateMapSpec } from "../js/map-validate.js";
import { addOrUpdateQuery, addOrUpdateVisualization, createWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const dataset = {
  columns: [{ name: "latitude", inferredType: "latitude" }, { name: "longitude", inferredType: "longitude" }, { name: "segment", inferredType: "category" }, { name: "revenue", inferredType: "number" }, { name: "state", inferredType: "us-state-abbreviation" }],
  rows: [{ latitude: 40, longitude: -75, segment: "A", revenue: 100, state: "CA" }, { latitude: 41, longitude: -76, segment: "B", revenue: 200, state: "NY" }],
};

const point = { version: 1, type: "map-point", title: "Points", dataset: { queryId: "query_1" }, encoding: { latitude: { field: "latitude", dataType: "latitude" }, longitude: { field: "longitude", dataType: "longitude" }, label: null, tooltip: [], size: null, color: null, value: null, region: null }, map: { style: "blank", showLegend: true, showTooltip: true } };
const choropleth = { version: 1, type: "map-choropleth", title: "States", dataset: { queryId: "query_1" }, encoding: { latitude: null, longitude: null, label: null, tooltip: [], size: null, color: null, value: { field: "revenue", dataType: "number" }, region: { field: "state", dataType: "us-state-abbreviation", boundary: "us-states" } }, map: { style: "blank", showLegend: true, showTooltip: true } };

export const mapSpecTests = [
  { name: "map-spec: default point spec", run: () => assert(defaultMapSpec({ queryId: "query_1", columns: dataset.columns }).encoding.latitude.field === "latitude", "default missing lat") },
  { name: "map-spec: valid point", run: async () => assert((await validateMapSpec(point, dataset)).valid, "point invalid") },
  { name: "map-spec: valid clustered point", run: async () => assert((await validateMapSpec({ ...point, type: "map-clustered-point", map: { cluster: true } }, dataset)).valid, "cluster invalid") },
  { name: "map-spec: valid proportional symbol", run: async () => assert((await validateMapSpec({ ...point, type: "map-proportional-symbol", encoding: { ...point.encoding, size: { field: "revenue", dataType: "number" } } }, dataset)).valid, "size invalid") },
  { name: "map-spec: valid choropleth", run: async () => assert((await validateMapSpec(choropleth, dataset)).valid, "choropleth invalid") },
  { name: "map-spec: missing latitude", run: async () => assert(!(await validateMapSpec({ ...point, encoding: { ...point.encoding, latitude: null } }, dataset)).valid, "missing latitude accepted") },
  { name: "map-spec: invalid numeric size", run: async () => assert(!(await validateMapSpec({ ...point, type: "map-proportional-symbol", encoding: { ...point.encoding, size: { field: "segment", dataType: "category" } } }, dataset)).valid, "bad size accepted") },
  { name: "map-spec: unknown boundary", run: async () => assert(!(await validateMapSpec({ ...choropleth, encoding: { ...choropleth.encoding, region: { ...choropleth.encoding.region, boundary: "missing" } } }, dataset)).valid, "bad boundary accepted") },
  { name: "map-compiler: point source and layer", run: async () => { const compiled = await compileMapSpec(point, dataset, { accent: "#167c72" }); assert(compiled.sources.quackviz_points && compiled.layers.some((layer) => layer.id === "points"), "point compile failed"); } },
  { name: "map-compiler: cluster layers", run: async () => { const compiled = await compileMapSpec({ ...point, type: "map-clustered-point", map: { cluster: true } }, dataset, { accent: "#167c72" }); assert(compiled.layers.some((layer) => layer.id === "clusters"), "cluster layer missing"); } },
  { name: "map-compiler: choropleth fill", run: async () => { const compiled = await compileMapSpec(choropleth, dataset, { accent: "#167c72" }); assert(compiled.layers.some((layer) => layer.id === "regions"), "regions layer missing"); } },
  { name: "map-export: package version", run: () => { const workspace = createWorkspace(); const query = addOrUpdateQuery(workspace, { id: "query_1", sql: "SELECT * FROM t", sourceTables: ["t"] }); const viz = addOrUpdateVisualization(workspace, { id: "viz_1", name: "Map", queryId: query.id, spec: point }); const pkg = exportMapVisualizationPackage(workspace, viz.id); assert(pkg.exportedBy.appVersion === APP_VERSION && pkg.format === "quackviz-visualization", "package invalid"); } },
];
