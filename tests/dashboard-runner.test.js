import { addCard, addDashboard, createDashboard } from "../js/dashboard.js";
import { getDashboardRunnerStatus, invalidateDashboardCache, refreshCard, resolveCard } from "../js/dashboard-runner.js";
import { addOrUpdateQuery, addOrUpdateVisualization, createWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fixture() {
  const workspace = createWorkspace();
  const query = addOrUpdateQuery(workspace, { id: "query_1", name: "Q", sql: "SELECT x, y FROM sales", sourceTables: ["sales"] });
  const viz = addOrUpdateVisualization(workspace, { id: "viz_1", name: "V", queryId: query.id, spec: { version: 1, type: "line", title: "V", dataset: { queryId: query.id }, encoding: { x: { field: "x", dataType: "number" }, y: [{ field: "y", dataType: "number" }] }, options: { tooltip: "axis", orientation: "vertical" } } });
  const dashboard = addDashboard(workspace, createDashboard());
  const card = addCard(dashboard, viz.id);
  return { workspace, query, viz, dashboard, card };
}

const okExecute = async (sql, queryId) => ({
  columns: [{ name: "x", inferredType: "number" }, { name: "y", inferredType: "number" }],
  rows: sql.includes("LIMIT 0") ? [] : [{ x: 1, y: 2 }],
  rowCount: sql.includes("LIMIT 0") ? 0 : 1,
  runtimeMs: 1,
  sql,
  queryId,
  executedAt: "2026-07-23T00:00:00.000Z",
  error: null,
});

export const dashboardRunnerTests = [
  { name: "dashboard-runner: resolve query and visualization", run: () => { const f = fixture(); assert(resolveCard(f.card, f.workspace, new Set(["sales"])).ok, "resolve failed"); } },
  { name: "dashboard-runner: missing source unavailable", run: () => { const f = fixture(); assert(resolveCard(f.card, f.workspace, new Set()).status === "unavailable", "missing source not unavailable"); } },
  { name: "dashboard-runner: execute one card", run: async () => { const f = fixture(); const state = await refreshCard({ dashboard: f.dashboard, card: f.card, workspace: f.workspace, loadedTables: new Set(["sales"]), execute: okExecute, bypassCache: true }); assert(state.status === "ready" && state.rowCount === 1, "card not ready"); } },
  { name: "dashboard-runner: isolate failed card", run: async () => { const f = fixture(); const state = await refreshCard({ dashboard: f.dashboard, card: f.card, workspace: f.workspace, loadedTables: new Set(["sales"]), execute: async () => ({ error: { message: "boom" }, columns: [], rows: [], rowCount: 0 }) }); assert(state.status === "error", "failure not isolated"); } },
  { name: "dashboard-runner: cache records entries", run: async () => { invalidateDashboardCache(); const f = fixture(); await refreshCard({ dashboard: f.dashboard, card: f.card, workspace: f.workspace, loadedTables: new Set(["sales"]), execute: okExecute }); assert(getDashboardRunnerStatus().cacheEntries >= 1, "cache missing"); } },
  { name: "dashboard-runner: invalidate cache", run: () => { invalidateDashboardCache(); assert(getDashboardRunnerStatus().cacheEntries === 0, "cache not cleared"); } },
];
