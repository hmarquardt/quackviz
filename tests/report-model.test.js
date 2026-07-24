import { addReport, addSection, createReport, deleteReport, duplicateReport, duplicateSection, moveSection, removeSection, setSectionVisible, validateReport } from "../js/report.js";
import { addOrUpdateQuery, addOrUpdateVisualization, createWorkspace, hydrateWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fixture() {
  const workspace = createWorkspace();
  const query = addOrUpdateQuery(workspace, { id: "query_1", name: "Q", sql: "SELECT 1 AS x, 2 AS y", sourceTables: ["sales"] });
  const viz = addOrUpdateVisualization(workspace, { id: "viz_1", name: "V", queryId: query.id, spec: { version: 1, type: "line", title: "V", dataset: { queryId: query.id }, encoding: { x: { field: "x" }, y: [{ field: "y" }] }, options: { tooltip: "axis", orientation: "vertical" } } });
  return { workspace, query, viz };
}

export const reportModelTests = [
  { name: "report-model: create report", run: () => { const { workspace } = fixture(); const report = addReport(workspace, createReport({ title: "R" })); assert(workspace.active.reportId === report.id, "not active"); } },
  { name: "report-model: duplicate report", run: () => { const { workspace } = fixture(); const report = addReport(workspace, createReport()); addSection(report, { type: "text" }); const copy = duplicateReport(workspace, report.id); assert(copy.id !== report.id && copy.sections[0].id !== report.sections[0].id, "duplicate failed"); } },
  { name: "report-model: delete report", run: () => { const { workspace } = fixture(); const report = addReport(workspace, createReport()); deleteReport(workspace, report.id); assert(!workspace.reports.length, "delete failed"); } },
  { name: "report-model: add all section types", run: () => { const report = createReport(); for (const type of ["cover", "heading", "text", "finding", "kpi", "visualization", "dashboard-snapshot", "query-table", "sql", "divider", "appendix", "methodology", "data-source-summary"]) addSection(report, { type }); assert(report.sections.length === 13, "sections missing"); } },
  { name: "report-model: remove section", run: () => { const report = createReport(); const section = addSection(report, { type: "text" }); removeSection(report, section.id); assert(!report.sections.length, "remove failed"); } },
  { name: "report-model: reorder sections", run: () => { const report = createReport(); const a = addSection(report, { type: "text", title: "A" }); addSection(report, { type: "text", title: "B" }); moveSection(report, a.id, 1); assert(report.sections[1].id === a.id, "move failed"); } },
  { name: "report-model: hide show section", run: () => { const report = createReport(); const section = addSection(report, { type: "text" }); setSectionVisible(report, section.id, false); assert(!section.visible, "hide failed"); } },
  { name: "report-model: preserve references", run: () => { const { workspace, viz } = fixture(); const report = addReport(workspace, createReport()); const section = addSection(report, { type: "visualization", source: { visualizationId: viz.id } }); assert(section.source.visualizationId === viz.id, "ref lost"); } },
  { name: "report-model: validate missing ref", run: () => { const { workspace } = fixture(); const report = addReport(workspace, createReport()); addSection(report, { type: "visualization", source: { visualizationId: "missing" } }); assert(!validateReport(report, workspace).valid, "missing accepted"); } },
  { name: "report-model: workspace round trip", run: () => { const { workspace } = fixture(); const report = addReport(workspace, createReport()); addSection(report, { type: "text" }); const restored = hydrateWorkspace(JSON.parse(JSON.stringify(workspace))); assert(restored.reports[0].sections.length === 1, "round trip failed"); } },
];
