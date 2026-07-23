import { addCard, addDashboard, createDashboard } from "../js/dashboard.js";
import { createSnapshotHtml, exportDashboardPackage, importDashboardPackage } from "../js/dashboard-export.js";
import { APP_VERSION } from "../js/constants.js";
import { addOrUpdateQuery, addOrUpdateVisualization, createWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fixture() {
  const workspace = createWorkspace();
  const query = addOrUpdateQuery(workspace, { id: "query_1", name: "Q", sql: "SELECT 1 AS x, 2 AS y", sourceTables: ["sales"] });
  const viz = addOrUpdateVisualization(workspace, { id: "viz_1", name: "V", queryId: query.id, spec: { version: 1, type: "line", title: "V", dataset: { queryId: query.id }, encoding: { x: { field: "x" }, y: [{ field: "y" }] }, options: { tooltip: "axis", orientation: "vertical" } } });
  const dashboard = addDashboard(workspace, createDashboard({ id: "dashboard_1", name: "D" }));
  addCard(dashboard, viz.id);
  return { workspace, dashboard, query, viz };
}

export const dashboardExportTests = [
  { name: "dashboard-export: package includes refs", run: () => { const { workspace, dashboard } = fixture(); const pkg = exportDashboardPackage(workspace, dashboard.id); assert(pkg.visualizations.length === 1 && pkg.queries.length === 1, "refs missing"); } },
  { name: "dashboard-export: omits API key", run: () => { const { workspace, dashboard } = fixture(); const pkg = exportDashboardPackage(workspace, dashboard.id); assert(!JSON.stringify(pkg).includes("apiKey"), "key leaked"); } },
  { name: "dashboard-export: import remaps collisions", run: () => { const { workspace, dashboard } = fixture(); const pkg = exportDashboardPackage(workspace, dashboard.id); const result = importDashboardPackage(workspace, pkg); assert(result.dashboard.id !== dashboard.id && workspace.dashboards.length === 2, "collision not remapped"); } },
  { name: "dashboard-export: reject future version", run: () => { const { workspace, dashboard } = fixture(); const pkg = exportDashboardPackage(workspace, dashboard.id); pkg.formatVersion = 99; let failed = false; try { importDashboardPackage(workspace, pkg); } catch { failed = true; } assert(failed, "future accepted"); } },
  { name: "dashboard-export: snapshot version matches", run: () => { const { dashboard } = fixture(); assert(createSnapshotHtml({ dashboard }).includes(APP_VERSION), "snapshot version missing"); } },
];
