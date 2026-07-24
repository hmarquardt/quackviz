import { refreshSection, reportStaleness } from "../js/report-runner.js";
import { addReport, addSection, createReport } from "../js/report.js";
import { addOrUpdateQuery, addOrUpdateVisualization, createWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fixture() {
  const workspace = createWorkspace();
  const query = addOrUpdateQuery(workspace, { id: "query_1", name: "Q", sql: "SELECT x, y FROM sales", sourceTables: ["sales"] });
  const viz = addOrUpdateVisualization(workspace, { id: "viz_1", name: "V", queryId: query.id, spec: { version: 1, type: "line", title: "V", dataset: { queryId: query.id }, encoding: { x: { field: "x", dataType: "number" }, y: [{ field: "y", dataType: "number" }] }, options: { tooltip: "axis", orientation: "vertical" } } });
  const report = addReport(workspace, createReport());
  return { workspace, query, viz, report };
}

const okExecute = async (sql, queryId) => ({ columns: [{ name: "x", inferredType: "number" }, { name: "y", inferredType: "number" }], rows: [{ x: 1, y: 2 }], rowCount: 1, runtimeMs: 1, sql, queryId, executedAt: "2026-07-23T00:00:00.000Z", error: null });

export const reportRunnerTests = [
  { name: "report-runner: visualization section", run: async () => { const f = fixture(); const section = addSection(f.report, { type: "visualization", source: { visualizationId: f.viz.id } }); const state = await refreshSection({ report: f.report, section, workspace: f.workspace, loadedTables: new Set(["sales"]), execute: okExecute }); assert(state.status === "ready" && section.snapshot.rowCount === 1, "viz refresh failed"); } },
  { name: "report-runner: query table section", run: async () => { const f = fixture(); const section = addSection(f.report, { type: "query-table", source: { queryId: f.query.id } }); const state = await refreshSection({ report: f.report, section, workspace: f.workspace, loadedTables: new Set(["sales"]), execute: okExecute }); assert(state.status === "ready" && section.snapshot.rows.length === 1, "table failed"); } },
  { name: "report-runner: kpi multi-row warning path", run: async () => { const f = fixture(); const section = addSection(f.report, { type: "kpi", source: { queryId: f.query.id } }); const state = await refreshSection({ report: f.report, section, workspace: f.workspace, loadedTables: new Set(["sales"]), execute: async (...args) => ({ ...(await okExecute(...args)), rows: [{ x: 1 }, { x: 2 }], rowCount: 2 }) }); assert(state.warning, "warning missing"); } },
  { name: "report-runner: missing source handled", run: async () => { const f = fixture(); const section = addSection(f.report, { type: "query-table", source: { queryId: f.query.id } }); const state = await refreshSection({ report: f.report, section, workspace: f.workspace, loadedTables: new Set(), execute: okExecute }); assert(state.status === "unavailable", "missing source not handled"); } },
  { name: "report-runner: stale detection", run: async () => { const f = fixture(); const section = addSection(f.report, { type: "query-table", source: { queryId: f.query.id } }); await refreshSection({ report: f.report, section, workspace: f.workspace, loadedTables: new Set(["sales"]), execute: okExecute }); f.query.updatedAt = "changed"; assert(reportStaleness(f.report, f.workspace)[0].stale, "stale not detected"); } },
];
