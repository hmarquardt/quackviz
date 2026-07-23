import { addOrUpdateQuery, addOrUpdateVisualization, createWorkspace, hydrateWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validSpec(queryId) {
  return {
    version: 1,
    type: "line",
    title: "Revenue",
    dataset: { queryId },
    encoding: { x: { field: "month" }, y: [{ field: "revenue" }] },
    options: { tooltip: "axis", orientation: "vertical" },
  };
}

export const workspaceTests = [
  { name: "workspace: creates stable IDs", run: () => {
    const workspace = createWorkspace();
    assert(workspace.id.startsWith("workspace_") && workspace.version === 1, "bad workspace id");
  } },
  { name: "workspace: saves query", run: () => {
    const workspace = createWorkspace();
    const query = addOrUpdateQuery(workspace, { name: "Q", sql: "SELECT 1" });
    assert(workspace.queries[0].id === query.id && workspace.active.queryId === query.id, "query not saved");
  } },
  { name: "workspace: saves visualization", run: () => {
    const workspace = createWorkspace();
    const query = addOrUpdateQuery(workspace, { name: "Q", sql: "SELECT 1" });
    const viz = addOrUpdateVisualization(workspace, { name: "V", queryId: query.id, spec: validSpec(query.id) });
    assert(workspace.visualizations[0].id === viz.id, "viz not saved");
  } },
  { name: "workspace: preserves queryId", run: () => {
    const workspace = createWorkspace();
    const query = addOrUpdateQuery(workspace, { name: "Q", sql: "SELECT 1" });
    const viz = addOrUpdateVisualization(workspace, { name: "V", queryId: query.id, spec: validSpec(query.id) });
    assert(viz.queryId === query.id && viz.spec.dataset.queryId === query.id, "queryId lost");
  } },
  { name: "workspace: rejects visualization referencing missing query", run: () => {
    const workspace = createWorkspace();
    let failed = false;
    try { addOrUpdateVisualization(workspace, { name: "V", queryId: "missing", spec: validSpec("missing") }); } catch { failed = true; }
    assert(failed, "missing query accepted");
  } },
  { name: "workspace: export hydration round trip", run: () => {
    const workspace = createWorkspace();
    const query = addOrUpdateQuery(workspace, { name: "Q", sql: "SELECT 1" });
    addOrUpdateVisualization(workspace, { name: "V", queryId: query.id, spec: validSpec(query.id) });
    const restored = hydrateWorkspace(JSON.parse(JSON.stringify(workspace)));
    assert(restored.queries[0].id === query.id && restored.visualizations[0].queryId === query.id, "round trip failed");
  } },
];
