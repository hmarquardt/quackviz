import { AI_CONTRACTS } from "../js/ai-contracts.js";
import { validateAiResponse } from "../js/ai-validate.js";
import { addDashboard, createDashboard } from "../js/dashboard.js";
import { addOrUpdateQuery, addOrUpdateVisualization, createWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function workspaceFixture() {
  const workspace = createWorkspace();
  const query = addOrUpdateQuery(workspace, { id: "query_1", name: "Monthly revenue", sql: "SELECT month, revenue FROM sales", sourceTables: ["sales"] });
  addOrUpdateVisualization(workspace, { id: "viz_1", name: "Monthly revenue", queryId: query.id, spec: { version: 1, type: "line", title: "Monthly revenue", dataset: { queryId: query.id }, encoding: { x: { field: "month", dataType: "date" }, y: [{ field: "revenue", dataType: "number" }] }, options: { tooltip: "axis", orientation: "vertical" } } });
  addDashboard(workspace, createDashboard({ id: "dashboard_1", name: "Sales dashboard" }));
  return workspace;
}

const validOutline = {
  contract: AI_CONTRACTS.reportOutline,
  contractVersion: 1,
  title: "Sales review",
  subtitle: "Revenue and performance",
  audience: "Leadership",
  sections: [
    { type: "cover", title: "Sales review", reason: "Introduce scope." },
    { type: "visualization", visualizationId: "viz_1", title: "Monthly revenue", reason: "Shows trend.", draftNarrative: "Revenue trend overview." },
    { type: "query-table", queryId: "query_1", title: "Revenue table", reason: "Supports the chart." },
    { type: "dashboard-snapshot", dashboardId: "dashboard_1", title: "Dashboard snapshot", reason: "Shows the workspace." },
  ],
  assumptions: [],
  cautions: [],
};

export const aiReportTests = [
  { name: "ai-report: valid outline", run: () => { const result = validateAiResponse(validOutline, { expectedContract: AI_CONTRACTS.reportOutline, dataset: workspaceFixture() }); assert(result.valid, result.errors[0]?.message || "outline rejected"); } },
  { name: "ai-report: invalid section type rejected", run: () => { const result = validateAiResponse({ ...validOutline, sections: [{ type: "map", title: "Map" }] }, { expectedContract: AI_CONTRACTS.reportOutline, dataset: workspaceFixture() }); assert(!result.valid, "invalid section accepted"); } },
  { name: "ai-report: missing source id rejected", run: () => { const result = validateAiResponse({ ...validOutline, sections: [{ type: "visualization", visualizationId: "missing", title: "Missing" }] }, { expectedContract: AI_CONTRACTS.reportOutline, dataset: workspaceFixture() }); assert(!result.valid, "missing source accepted"); } },
  { name: "ai-report: excessive section count rejected", run: () => { const result = validateAiResponse({ ...validOutline, sections: Array.from({ length: 41 }, () => ({ type: "text", title: "T" })) }, { expectedContract: AI_CONTRACTS.reportOutline, dataset: workspaceFixture() }); assert(!result.valid, "excessive outline accepted"); } },
  { name: "ai-report: html rejected", run: () => { const result = validateAiResponse({ ...validOutline, title: "<script>alert(1)</script>" }, { expectedContract: AI_CONTRACTS.reportOutline, dataset: workspaceFixture() }); assert(!result.valid, "html accepted"); } },
  { name: "ai-report: valid narrative", run: () => { const result = validateAiResponse({ contract: AI_CONTRACTS.reportNarrative, contractVersion: 1, headline: "Revenue increased", summary: "Revenue increased in the provided result.", findings: [{ label: "Peak", detail: "November was highest." }], recommendations: [], cautions: [], sourceReferences: [{ type: "visualization", id: "viz_1" }] }, { expectedContract: AI_CONTRACTS.reportNarrative }); assert(result.valid, result.errors[0]?.message || "narrative rejected"); } },
  { name: "ai-report: unsupported claim warning", run: () => { const result = validateAiResponse({ contract: AI_CONTRACTS.reportNarrative, contractVersion: 1, headline: "Revenue increased", summary: "The campaign caused statistically significant revenue growth.", findings: [], recommendations: [], cautions: [], sourceReferences: [] }, { expectedContract: AI_CONTRACTS.reportNarrative }); assert(result.warnings.length > 0, "claim warning missing"); } },
  { name: "ai-report: valid critique", run: () => { const result = validateAiResponse({ contract: AI_CONTRACTS.reportCritique, contractVersion: 1, summary: "Clear report.", issues: [], recommendations: [], missingElements: [], unsupportedClaims: [], cautions: [] }, { expectedContract: AI_CONTRACTS.reportCritique }); assert(result.valid, result.errors[0]?.message || "critique rejected"); } },
];
