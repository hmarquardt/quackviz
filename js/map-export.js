import { APP_VERSION, BUILD_DATE } from "./constants.js";
import { boundaryCatalog } from "./map-boundaries.js";
import { isMapSpec } from "./map-spec.js";
import { deepClone, nowIso } from "./utils.js";

export function exportMapVisualizationPackage(workspace, visualizationId) {
  const visualization = workspace.visualizations.find((item) => item.id === visualizationId);
  if (!visualization) throw new Error("Visualization not found.");
  if (!isMapSpec(visualization.spec)) throw new Error("Visualization is not a map.");
  const query = workspace.queries.find((item) => item.id === visualization.queryId);
  const boundaryId = visualization.spec.encoding?.region?.boundary;
  return {
    format: "quackviz-visualization",
    formatVersion: 1,
    exportedBy: { app: "QuackViz", appVersion: APP_VERSION, buildDate: BUILD_DATE, exportedAt: nowIso() },
    query: deepClone(query || null),
    visualization: deepClone(visualization),
    boundaries: boundaryId ? boundaryCatalog().filter((item) => item.id === boundaryId).map(({ id, version, attribution, license }) => ({ id, version, attribution, license })) : [],
    approvedMappings: visualization.spec.map?.approvedMappings || [],
  };
}
