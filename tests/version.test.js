import { APP_VERSION, BUILD_DATE } from "../js/constants.js";
import { createWorkspace } from "../js/workspace.js";
import { createReport } from "../js/report.js";
import { createReportManifest, renderReportHtml, renderReportMarkdown } from "../js/report-export.js";
import { exportMapVisualizationPackage } from "../js/map-export.js";
import { addOrUpdateQuery, addOrUpdateVisualization } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export const versionTests = [
  { name: "version: workspace metadata uses canonical version", run: () => assert(createWorkspace().metadata.appVersion === APP_VERSION, "workspace version mismatch") },
  { name: "version: canonical app version", run: () => assert(APP_VERSION === "1.0.0-beta.5", "app version mismatch") },
  { name: "version: build date present", run: () => assert(BUILD_DATE === "2026-07-26", "build date mismatch") },
  { name: "version: report metadata uses canonical version", run: () => assert(createReport().metadata.appVersion === APP_VERSION, "report version mismatch") },
  { name: "version: report html export uses canonical version", run: () => assert(renderReportHtml(createReport()).includes(APP_VERSION), "html version mismatch") },
  { name: "version: report markdown export uses canonical version", run: () => assert(renderReportMarkdown(createReport()).includes(APP_VERSION), "markdown version mismatch") },
  { name: "version: report package manifest uses canonical version", run: () => assert(createReportManifest(createReport()).generatedBy.appVersion === APP_VERSION, "manifest version mismatch") },
  { name: "version: map export uses canonical version", run: () => { const workspace = createWorkspace(); const query = addOrUpdateQuery(workspace, { id: "query_map", sql: "SELECT 1", sourceTables: [] }); const viz = addOrUpdateVisualization(workspace, { id: "viz_map", name: "Map", queryId: query.id, spec: { version: 1, type: "map-point", title: "Map", dataset: { queryId: query.id }, encoding: { latitude: { field: "lat", dataType: "latitude" }, longitude: { field: "lon", dataType: "longitude" }, label: null, tooltip: [], size: null, color: null, value: null, region: null }, map: { style: "blank" } } }); assert(exportMapVisualizationPackage(workspace, viz.id).exportedBy.appVersion === APP_VERSION, "map export version mismatch"); } },
];
