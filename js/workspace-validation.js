import { WORKSPACE_SCHEMA_VERSION } from "./constants.js";
import { hydrateWorkspace } from "./workspace.js";

export function validateWorkspaceIntegrity(input) {
  const errors = [];
  const warnings = [];
  const repairable = [];
  const orphaned = [];
  if (!input || typeof input !== "object") return { valid: false, errors: [{ path: "$", message: "Workspace is not an object." }], warnings, repairable, orphaned };
  if (input.version > WORKSPACE_SCHEMA_VERSION) errors.push({ path: "version", message: "Unsupported future workspace version." });
  if (input.version == null) repairable.push({ path: "version", message: "Missing workspace version can be filled from current schema." });
  for (const key of ["dataSources", "queries", "visualizations", "dashboards", "reports"]) {
    if (!Array.isArray(input[key])) repairable.push({ path: key, message: "Missing collection can be restored as an empty array." });
  }
  detectDuplicateIds(input.queries, "queries", errors);
  detectDuplicateIds(input.visualizations, "visualizations", errors);
  detectDuplicateIds(input.dashboards, "dashboards", errors);
  detectDuplicateIds(input.reports, "reports", errors);
  const queryIds = new Set((input.queries || []).map((query) => query.id));
  for (const viz of input.visualizations || []) {
    if (viz.queryId && !queryIds.has(viz.queryId)) errors.push({ path: `visualizations.${viz.id}.queryId`, message: `Missing query ${viz.queryId}.` });
  }
  const vizIds = new Set((input.visualizations || []).map((viz) => viz.id));
  for (const dashboard of input.dashboards || []) {
    for (const card of dashboard.layout || []) {
      if (card.visualizationId && !vizIds.has(card.visualizationId)) errors.push({ path: `dashboards.${dashboard.id}.layout.${card.id}`, message: `Missing visualization ${card.visualizationId}.` });
    }
  }
  const dashboardIds = new Set((input.dashboards || []).map((dashboard) => dashboard.id));
  for (const report of input.reports || []) {
    for (const section of report.sections || []) {
      const source = section.source || {};
      if (source.visualizationId && !vizIds.has(source.visualizationId)) errors.push({ path: `reports.${report.id}.sections.${section.id}`, message: `Missing visualization ${source.visualizationId}.` });
      if (source.queryId && !queryIds.has(source.queryId)) errors.push({ path: `reports.${report.id}.sections.${section.id}`, message: `Missing query ${source.queryId}.` });
      if (source.dashboardId && !dashboardIds.has(source.dashboardId)) errors.push({ path: `reports.${report.id}.sections.${section.id}`, message: `Missing dashboard ${source.dashboardId}.` });
    }
  }
  for (const activeKey of Object.keys(input.active || {})) {
    const id = input.active[activeKey];
    if (id && !knownActiveId(input, activeKey, id)) repairable.push({ path: `active.${activeKey}`, message: "Invalid active selection can be cleared." });
  }
  return { valid: errors.length === 0, errors, warnings, repairable, orphaned };
}

export function repairWorkspace(input) {
  const next = structuredClone(input);
  next.version ??= WORKSPACE_SCHEMA_VERSION;
  next.dataSources ||= [];
  next.queries ||= [];
  next.visualizations ||= [];
  next.dashboards ||= [];
  next.reports ||= [];
  next.active ||= {};
  const validation = validateWorkspaceIntegrity(next);
  if (validation.errors.length) return { repaired: false, workspace: next, validation };
  const hydrated = hydrateWorkspace(next);
  return { repaired: true, workspace: hydrated, validation: validateWorkspaceIntegrity(hydrated) };
}

export const WORKSPACE_MIGRATIONS = {
  0(workspace) {
    return repairWorkspace({ ...workspace, version: WORKSPACE_SCHEMA_VERSION }).workspace;
  },
};

export function migrateWorkspace({ workspace, fromVersion = workspace?.version, toVersion = WORKSPACE_SCHEMA_VERSION, dryRun = false }) {
  if (fromVersion > toVersion) throw new Error(`Unsupported future workspace version ${fromVersion}.`);
  const report = [];
  let next = structuredClone(workspace);
  for (let version = fromVersion; version < toVersion; version += 1) {
    const migration = WORKSPACE_MIGRATIONS[version];
    if (!migration) throw new Error(`No workspace migration registered for version ${version}.`);
    report.push(`Migrated workspace ${version} to ${version + 1}.`);
    if (!dryRun) next = migration(next);
  }
  return { workspace: dryRun ? structuredClone(workspace) : next, migrated: fromVersion !== toVersion, report, dryRun };
}

function detectDuplicateIds(items = [], path, errors) {
  const seen = new Set();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) errors.push({ path, message: `Duplicate id ${item.id}.` });
    seen.add(item.id);
  }
}

function knownActiveId(workspace, key, id) {
  const map = { queryId: "queries", visualizationId: "visualizations", dashboardId: "dashboards", reportId: "reports", dataSourceId: "dataSources" };
  return (workspace[map[key]] || []).some((item) => item.id === id);
}
