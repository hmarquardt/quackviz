import { APP_VERSION, BUILD_DATE, REPORT_CONCURRENCY_LIMIT } from "./constants.js";
import { refreshCard } from "./dashboard-runner.js";
import { runQuery } from "./query.js";
import { isSectionStale } from "./report.js";
import { validateVisualizationSpec } from "./viz-spec.js";
import { nowIso } from "./utils.js";

let lastStats = { durationMs: null, successful: 0, failed: 0, cancelled: 0, concurrencyLimit: REPORT_CONCURRENCY_LIMIT };

export function getReportRunnerStatus() {
  return { ...lastStats };
}

export async function refreshReport({ report, workspace, loadedTables = new Set(), sections = null, signal = null, execute = runQuery }) {
  const startedAt = performance.now();
  const targets = (sections || report.sections).filter((section) => section.visible !== false && isDynamicSection(section));
  const queue = targets.slice();
  const states = {};
  let successful = 0;
  let failed = 0;
  let cancelled = 0;
  async function worker() {
    while (queue.length) {
      if (signal?.aborted) { cancelled += queue.length; queue.length = 0; return; }
      const section = queue.shift();
      const state = await refreshSection({ report, section, workspace, loadedTables, signal, execute });
      states[section.id] = state;
      if (state.status === "ready") successful += 1;
      else if (state.status === "cancelled") cancelled += 1;
      else failed += 1;
    }
  }
  await Promise.all(Array.from({ length: Math.min(REPORT_CONCURRENCY_LIMIT, Math.max(1, targets.length)) }, worker));
  lastStats = { durationMs: Math.round(performance.now() - startedAt), successful, failed, cancelled, concurrencyLimit: REPORT_CONCURRENCY_LIMIT };
  return { states, ...lastStats };
}

export async function refreshSection({ report, section, workspace, loadedTables = new Set(), signal = null, execute = runQuery }) {
  if (signal?.aborted) return sectionState(section.id, "cancelled", "Refresh cancelled.");
  try {
    if (section.type === "visualization") return refreshVisualizationSection(section, workspace, loadedTables, execute);
    if (section.type === "query-table") return refreshQueryTableSection(section, workspace, loadedTables, execute);
    if (section.type === "kpi") return refreshKpiSection(section, workspace, loadedTables, execute);
    if (section.type === "dashboard-snapshot") return refreshDashboardSection(section, workspace, loadedTables, execute);
    if (section.type === "data-source-summary") return refreshDataSourceSummary(section, workspace);
    return sectionState(section.id, "ready", null, { refreshedAt: nowIso() });
  } catch (error) {
    section.snapshot.error = error.message;
    return sectionState(section.id, "error", error.message);
  }
}

async function refreshVisualizationSection(section, workspace, loadedTables, execute) {
  const viz = workspace.visualizations.find((item) => item.id === section.source.visualizationId);
  if (!viz) return sectionState(section.id, "unavailable", "Referenced visualization is missing.");
  const query = workspace.queries.find((item) => item.id === viz.queryId);
  if (!query) return sectionState(section.id, "unavailable", "Referenced query is missing.");
  const missing = (query.sourceTables || []).find((table) => !loadedTables.has(table));
  if (missing) return sectionState(section.id, "unavailable", `Source table '${missing}' is not loaded.`);
  const result = await execute(query.sql, query.id);
  if (result.error) return sectionState(section.id, "error", result.error.message);
  const spec = { ...viz.spec, dataset: { queryId: query.id } };
  const validation = validateVisualizationSpec(spec, result);
  if (!validation.valid) return sectionState(section.id, "error", validation.errors[0]?.message || "Visualization spec is invalid.");
  writeSnapshot(section, { result, query, viz, imageDataUrl: section.snapshot.imageDataUrl || placeholderImage(viz.name) });
  return sectionState(section.id, "ready", null, { runtimeMs: result.runtimeMs, rowCount: result.rowCount, refreshedAt: section.snapshot.generatedAt });
}

async function refreshQueryTableSection(section, workspace, loadedTables, execute) {
  const query = workspace.queries.find((item) => item.id === section.source.queryId);
  if (!query) return sectionState(section.id, "unavailable", "Referenced query is missing.");
  const missing = (query.sourceTables || []).find((table) => !loadedTables.has(table));
  if (missing) return sectionState(section.id, "unavailable", `Source table '${missing}' is not loaded.`);
  const limit = Number(section.content.table?.rowLimit || 25);
  const result = await execute(`SELECT * FROM (${query.sql.replace(/;+\s*$/, "")}) AS __quackviz_report_table LIMIT ${limit}`, query.id);
  if (result.error) return sectionState(section.id, "error", result.error.message);
  writeSnapshot(section, { result, query });
  return sectionState(section.id, "ready", null, { runtimeMs: result.runtimeMs, rowCount: result.rowCount, refreshedAt: section.snapshot.generatedAt });
}

async function refreshKpiSection(section, workspace, loadedTables, execute) {
  const state = await refreshQueryTableSection(section, workspace, loadedTables, execute);
  if (state.status !== "ready") return state;
  if ((section.snapshot.rows || []).length !== 1) state.warning = "KPI query should return one row.";
  return state;
}

async function refreshDashboardSection(section, workspace, loadedTables, execute) {
  const dashboard = workspace.dashboards.find((item) => item.id === section.source.dashboardId);
  if (!dashboard) return sectionState(section.id, "unavailable", "Referenced dashboard is missing.");
  const cardStates = {};
  for (const card of dashboard.layout) {
    cardStates[card.id] = await refreshCard({ dashboard, card, workspace, loadedTables, execute });
  }
  section.snapshot.generatedAt = nowIso();
  section.snapshot.rows = [];
  section.snapshot.columns = [];
  section.snapshot.rowCount = Object.values(cardStates).reduce((sum, state) => sum + Number(state.rowCount || 0), 0);
  section.snapshot.runtimeMs = Object.values(cardStates).reduce((sum, state) => sum + Number(state.runtimeMs || 0), 0);
  section.snapshot.imageDataUrl = section.snapshot.imageDataUrl || placeholderImage(dashboard.name);
  section.snapshotRevision = { capturedAt: section.snapshot.generatedAt, appVersion: APP_VERSION, buildDate: BUILD_DATE, dashboardUpdatedAt: dashboard.updatedAt };
  return sectionState(section.id, "ready", null, { runtimeMs: section.snapshot.runtimeMs, rowCount: section.snapshot.rowCount, refreshedAt: section.snapshot.generatedAt });
}

function refreshDataSourceSummary(section, workspace) {
  section.snapshot.generatedAt = nowIso();
  section.snapshot.rows = workspace.dataSources.map((source) => ({ table: source.tableName, rows: source.rowCount, columns: source.columns.length, type: source.sourceType, loaded: source.available !== false }));
  section.snapshot.columns = [{ name: "table" }, { name: "rows" }, { name: "columns" }, { name: "type" }, { name: "loaded" }];
  section.snapshot.rowCount = section.snapshot.rows.length;
  section.snapshotRevision = { capturedAt: section.snapshot.generatedAt, appVersion: APP_VERSION, buildDate: BUILD_DATE };
  return sectionState(section.id, "ready", null, { rowCount: section.snapshot.rowCount, refreshedAt: section.snapshot.generatedAt });
}

function writeSnapshot(section, { result, query, viz, imageDataUrl = null }) {
  section.snapshot.generatedAt = nowIso();
  section.snapshot.rows = result.rows || [];
  section.snapshot.columns = result.columns || [];
  section.snapshot.rowCount = result.rowCount;
  section.snapshot.runtimeMs = result.runtimeMs;
  section.snapshot.imageDataUrl = imageDataUrl;
  section.snapshot.error = null;
  section.snapshotRevision = {
    capturedAt: section.snapshot.generatedAt,
    appVersion: APP_VERSION,
    buildDate: BUILD_DATE,
    queryUpdatedAt: query?.updatedAt || null,
    visualizationUpdatedAt: viz?.updatedAt || null,
  };
}

export function reportStaleness(report, workspace) {
  return report.sections.map((section) => ({ sectionId: section.id, stale: isSectionStale(section, workspace) }));
}

function sectionState(sectionId, status, error = null, extra = {}) {
  return { sectionId, status, error, refreshedAt: extra.refreshedAt || null, runtimeMs: extra.runtimeMs ?? null, rowCount: extra.rowCount ?? null, ...extra };
}

function isDynamicSection(section) {
  return ["visualization", "dashboard-snapshot", "query-table", "kpi", "data-source-summary"].includes(section.type);
}

function placeholderImage(label) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><rect width="1200" height="700" fill="#f5f7fa"/><text x="60" y="110" font-family="Arial" font-size="42" fill="#17202f">${escapeXml(label || "QuackViz chart snapshot")}</text><text x="60" y="170" font-family="Arial" font-size="22" fill="#5b6878">Refresh in a browser to capture final chart imagery.</text></svg>`)}`;
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
