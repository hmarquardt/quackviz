import { addCard, addDashboard, createDashboard, deleteDashboard, duplicateDashboard, moveCard, resizeCard, validateDashboard } from "../js/dashboard.js";
import { addOrUpdateQuery, addOrUpdateVisualization, createWorkspace, hydrateWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function workspaceWithViz() {
  const workspace = createWorkspace();
  const query = addOrUpdateQuery(workspace, { id: "query_1", name: "Q", sql: "SELECT 1 AS x, 2 AS y", sourceTables: ["sales"] });
  const viz = addOrUpdateVisualization(workspace, { id: "viz_1", name: "V", queryId: query.id, spec: { version: 1, type: "line", title: "V", dataset: { queryId: query.id }, encoding: { x: { field: "x" }, y: [{ field: "y" }] }, options: { tooltip: "axis", orientation: "vertical" } } });
  return { workspace, query, viz };
}

export const dashboardModelTests = [
  { name: "dashboard-model: create dashboard", run: () => { const { workspace } = workspaceWithViz(); const dashboard = addDashboard(workspace, createDashboard({ name: "D" })); assert(workspace.active.dashboardId === dashboard.id, "not active"); } },
  { name: "dashboard-model: rename dashboard", run: () => { const dashboard = createDashboard({ name: "Old" }); dashboard.name = "New"; assert(dashboard.name === "New", "rename failed"); } },
  { name: "dashboard-model: duplicate dashboard", run: () => { const { workspace, viz } = workspaceWithViz(); const d = addDashboard(workspace, createDashboard()); addCard(d, viz.id); const copy = duplicateDashboard(workspace, d.id); assert(copy.id !== d.id && copy.layout[0].id !== d.layout[0].id, "duplicate failed"); } },
  { name: "dashboard-model: delete dashboard", run: () => { const { workspace } = workspaceWithViz(); const d = addDashboard(workspace, createDashboard()); deleteDashboard(workspace, d.id); assert(!workspace.dashboards.length, "delete failed"); } },
  { name: "dashboard-model: add visualization card", run: () => { const { workspace, viz } = workspaceWithViz(); const d = addDashboard(workspace, createDashboard()); const card = addCard(d, viz.id); assert(card.visualizationId === viz.id, "card missing viz"); } },
  { name: "dashboard-model: layout bounds", run: () => { const { workspace, viz } = workspaceWithViz(); const d = addDashboard(workspace, createDashboard()); const card = addCard(d, viz.id); resizeCard(d, card.id, 99, 0); moveCard(d, card.id, 99, 0); assert(card.width <= 12 && card.x + card.width <= 12, "bounds broken"); } },
  { name: "dashboard-model: reject missing visualization", run: () => { const { workspace } = workspaceWithViz(); const d = addDashboard(workspace, createDashboard({ layout: [{ visualizationId: "missing", width: 6, height: 4 }] })); assert(!validateDashboard(d, workspace).valid, "missing accepted"); } },
  { name: "dashboard-model: workspace round trip", run: () => { const { workspace, viz } = workspaceWithViz(); const d = addDashboard(workspace, createDashboard()); addCard(d, viz.id); const restored = hydrateWorkspace(JSON.parse(JSON.stringify(workspace))); assert(restored.dashboards[0].layout[0].visualizationId === viz.id, "round trip failed"); } },
];
