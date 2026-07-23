import { AI_CONTRACTS } from "../js/ai-contracts.js";
import { validateAiDashboard, validateAiDashboardCritique } from "../js/ai-validate.js";
import { addOrUpdateQuery, addOrUpdateVisualization, createWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function workspace() {
  const workspace = createWorkspace();
  const query = addOrUpdateQuery(workspace, { id: "query_1", sql: "SELECT 1 AS x, 2 AS y FROM sales", sourceTables: ["sales"] });
  addOrUpdateVisualization(workspace, { id: "viz_1", name: "V", queryId: query.id, spec: { version: 1, type: "line", title: "V", dataset: { queryId: query.id }, encoding: { x: { field: "x" }, y: [{ field: "y" }] }, options: { tooltip: "axis", orientation: "vertical" } } });
  return workspace;
}

function payload(overrides = {}) {
  return {
    contract: AI_CONTRACTS.dashboard,
    contractVersion: 1,
    title: "Sales overview",
    description: "Overview",
    audience: "Executive",
    proposals: [{ type: "existing-visualization", visualizationId: "viz_1", reason: "Useful", layout: { width: 6, height: 4 } }],
    filters: [{ name: "Region", field: "region", semanticType: "category" }],
    narrativeOrder: ["Trend"],
    assumptions: [],
    cautions: [],
    ...overrides,
  };
}

export const aiDashboardTests = [
  { name: "ai-dashboard: existing visualization proposal", run: () => assert(validateAiDashboard(payload(), ["sales"], workspace()).valid, "existing rejected") },
  { name: "ai-dashboard: new visualization proposal", run: () => assert(validateAiDashboard(payload({ proposals: [{ type: "new-visualization", title: "New", sql: "SELECT 1 AS x, 2 AS y FROM sales", expectedColumns: [{ name: "x", dataType: "number" }, { name: "y", dataType: "number" }], visualization: { version: 1, type: "line", title: "New", dataset: { queryId: null }, encoding: { x: { field: "x" }, y: [{ field: "y" }] }, options: { tooltip: "axis", orientation: "vertical" } }, layout: { width: 6, height: 4 } }] }), ["sales"], workspace()).valid, "new rejected") },
  { name: "ai-dashboard: invalid visualization ID", run: () => assert(!validateAiDashboard(payload({ proposals: [{ type: "existing-visualization", visualizationId: "missing", layout: { width: 6, height: 4 } }] }), ["sales"], workspace()).valid, "missing accepted") },
  { name: "ai-dashboard: unsafe SQL rejected", run: () => assert(!validateAiDashboard(payload({ proposals: [{ type: "new-visualization", sql: "DROP TABLE sales", layout: { width: 6, height: 4 } }] }), ["sales"], workspace()).valid, "unsafe accepted") },
  { name: "ai-dashboard: invalid layout rejected", run: () => assert(!validateAiDashboard(payload({ proposals: [{ type: "existing-visualization", visualizationId: "viz_1", layout: { width: 99, height: 4 } }] }), ["sales"], workspace()).valid, "bad layout accepted") },
  { name: "ai-dashboard: excessive card count rejected", run: () => assert(!validateAiDashboard(payload({ proposals: Array.from({ length: 13 }, () => ({ type: "existing-visualization", visualizationId: "viz_1", layout: { width: 6, height: 4 } })) }), ["sales"], workspace()).valid, "too many accepted") },
  { name: "ai-dashboard: HTML rejected", run: () => assert(!validateAiDashboard(payload({ description: "<script>alert(1)</script>" }), ["sales"], workspace()).valid, "html accepted") },
  { name: "ai-dashboard: critique contract", run: () => assert(validateAiDashboardCritique({ contract: AI_CONTRACTS.dashboardCritique, contractVersion: 1, summary: "Ok", issues: [], recommendations: [], proposedLayoutChanges: [], proposedAdditions: [], proposedRemovals: [], cautions: [] }).valid, "critique rejected") },
];
