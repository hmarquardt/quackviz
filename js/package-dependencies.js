import { isMapSpec } from "./map-spec.js";
import { deepClone } from "./utils.js";

export function resolvePackageDependencies(workspace, selection = {}) {
  const input = deepClone(selection);
  const required = {
    dashboards: new Set(input.dashboards || []),
    reports: new Set(input.reports || []),
    visualizations: new Set(input.visualizations || []),
    queries: new Set(input.queries || []),
    dataSources: new Set(input.dataSources || []),
    boundaries: new Set(input.boundaries || []),
    interactions: new Set(),
    extensions: new Set(input.extensions || []),
    templates: new Set(input.templates || []),
  };
  const missing = [];
  const optional = [];
  const warnings = [];
  const seenReports = new Set();
  const dashboardsById = new Map((workspace.dashboards || []).map((item) => [item.id, item]));
  const reportsById = new Map((workspace.reports || []).map((item) => [item.id, item]));
  const visualizationsById = new Map((workspace.visualizations || []).map((item) => [item.id, item]));
  const queriesById = new Map((workspace.queries || []).map((item) => [item.id, item]));
  const sourcesByTable = new Map((workspace.dataSources || []).map((item) => [item.tableName, item]));

  for (const dashboardId of [...required.dashboards]) {
    const dashboard = dashboardsById.get(dashboardId);
    if (!dashboard) { missing.push(ref("dashboard", dashboardId, "Selected dashboard is missing.")); continue; }
    for (const card of dashboard.layout || []) addRequired(required.visualizations, card.visualizationId);
    for (const binding of dashboard.interactions?.bindings || []) required.interactions.add(binding.id);
  }

  for (const reportId of [...required.reports]) resolveReport(reportId);
  for (const vizId of [...required.visualizations]) resolveVisualization(vizId);
  for (const queryId of [...required.queries]) resolveQuery(queryId);

  function resolveReport(reportId) {
    if (seenReports.has(reportId)) return;
    seenReports.add(reportId);
    const report = reportsById.get(reportId);
    if (!report) { missing.push(ref("report", reportId, "Selected report is missing.")); return; }
    for (const section of report.sections || []) {
      if (section.visible === false) optional.push(ref("report-section", section.id, "Hidden section is optional."));
      addRequired(required.visualizations, section.source?.visualizationId);
      addRequired(required.queries, section.source?.queryId);
      addRequired(required.dashboards, section.source?.dashboardId);
      if (section.source?.dashboardId) {
        const dashboard = dashboardsById.get(section.source.dashboardId);
        if (dashboard) for (const card of dashboard.layout || []) addRequired(required.visualizations, card.visualizationId);
      }
    }
  }

  function resolveVisualization(vizId) {
    const viz = visualizationsById.get(vizId);
    if (!viz) { missing.push(ref("visualization", vizId, "Referenced visualization is missing.")); return; }
    addRequired(required.queries, viz.queryId || viz.spec?.dataset?.queryId);
    if (isMapSpec(viz.spec)) {
      const boundary = viz.spec?.encoding?.region?.boundary;
      if (boundary) required.boundaries.add(boundary);
    }
  }

  function resolveQuery(queryId) {
    const query = queriesById.get(queryId);
    if (!query) { missing.push(ref("query", queryId, "Referenced query is missing.")); return; }
    for (const tableName of query.sourceTables || []) {
      const source = sourcesByTable.get(tableName);
      if (source) required.dataSources.add(source.id);
      else missing.push(ref("data-source", tableName, `Source table '${tableName}' is missing.`));
    }
  }

  const circular = detectReportDashboardCycles(workspace, required);
  warnings.push(...circular.map((id) => ref("cycle", id, "Dashboard/report reference cycle detected and preserved as metadata.")));
  return {
    valid: missing.length === 0,
    required: materialize(required),
    optional,
    missing,
    warnings,
    selection: input,
  };
}

function addRequired(set, id) {
  if (id) set.add(id);
}

function materialize(required) {
  return Object.fromEntries(Object.entries(required).map(([key, value]) => [key, [...value]]));
}

function ref(type, id, reason) {
  return { type, id, reason };
}

function detectReportDashboardCycles(workspace, required) {
  const cycles = [];
  const dashboards = new Set(required.dashboards);
  const reports = (workspace.reports || []).filter((report) => required.reports.has(report.id));
  for (const report of reports) {
    for (const section of report.sections || []) {
      if (section.source?.dashboardId && dashboards.has(section.source.dashboardId)) cycles.push(`${report.id}:${section.source.dashboardId}`);
    }
  }
  return cycles;
}
