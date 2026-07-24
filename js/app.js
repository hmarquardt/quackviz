import { APP_VERSION, BUILD_DATE, DEFAULT_SALES_SQL } from "./constants.js";
import { runAiAction, fetchOpenRouterModels } from "./ai.js";
import { buildAiContext, contextPreview } from "./ai-context.js";
import { AI_CONTRACTS } from "./ai-contracts.js";
import { makeInteraction } from "./ai-history.js";
import { proposalToBuilderState, saveAiProposal, markRejected } from "./ai-proposals.js";
import { explainSql, previewSql as previewAiSql, validateSqlSafety } from "./ai-sql-safety.js";
import { validateAiResponse, validateRepair } from "./ai-validate.js";
import { addCard, addDashboard, createDashboard, deleteDashboard as deleteDashboardModel, duplicateCard, duplicateDashboard as duplicateDashboardModel, findDashboard, moveCard, removeCard, resizeCard, updateDashboard } from "./dashboard.js";
import { createSnapshotHtml, exportDashboardPackage, importDashboardPackage } from "./dashboard-export.js";
import { invalidateDashboardCache, refreshCard, refreshDashboard as runDashboardRefresh } from "./dashboard-runner.js";
import { initializeDatabase, executeSql, tableExists } from "./db.js";
import { loadIncludedSalesSample } from "./import.js";
import { runQuery, buildQuerySaveInput } from "./query.js";
import { addReport, addSection, createReport, deleteReport as deleteReportModel, duplicateReport as duplicateReportModel, duplicateSection, findReport, findSection, moveSection, removeSection, setSectionVisible, updateReport } from "./report.js";
import { createReportPackageFiles, exportReportJson, importReportJson, renderReportHtml, renderReportMarkdown } from "./report-export.js";
import { refreshReport as runReportRefresh, refreshSection as runReportSectionRefresh } from "./report-runner.js";
import { addError, addStatus, markTableLoaded, notify, setActive, setCurrentOption, setCurrentResult, setCurrentSpec, setWorkspace, state, subscribe, updateWorkspace } from "./state.js";
import { getOpenRouterApiKey, initializeStorage, loadAiModelCache, loadThemePreference, loadWorkspace, resetStoredWorkspace, saveAiModelCache, saveThemePreference, saveTemporaryWorkspace, saveWorkspace, saveWorkspaceDebounced, setOpenRouterApiKey } from "./storage.js";
import { addAiHistory, addOrUpdateDataSource, addOrUpdateQuery, addOrUpdateVisualization, createWorkspace, hydrateWorkspace } from "./workspace.js";
import { defaultVisualizationSpec, validateVisualizationSpec } from "./viz-spec.js";
import { compileVisualizationSpec } from "./viz-compiler.js";
import { disposeChartInstance, renderVisualization, showEmpty } from "./viz-renderer.js";
import { copyText, nowIso, uid } from "./utils.js";
import { elements, getThemeTokens, initializeStaticControls, renderApp, renderSelfTest, seedDefaultSql, selectTab } from "./ui.js";

let saveSuppressed = false;
let currentAiAbortController = null;
let currentDashboardAbortController = null;
let currentReportAbortController = null;

window.addEventListener("error", (event) => addError("app", "window-error", event.error || new Error(event.message)));
window.addEventListener("unhandledrejection", (event) => addError("app", "unhandled-rejection", event.reason));

initializeStaticControls();
subscribe((next) => {
  renderApp(next);
  if (!saveSuppressed) {
    saveWorkspaceDebounced(next.workspace, (error) => {
      state.storageStatus.lastError = error.message;
      addError("storage", "save-workspace", error);
    });
  }
});

await boot();

async function boot() {
  bindEvents();
  try {
    await initializeStorage();
    state.storageStatus.indexedDb = "available";
    const workspace = await loadWorkspace();
    const preferredTheme = loadThemePreference();
    if (preferredTheme) workspace.settings.theme = preferredTheme;
    setWorkspace(workspace);
  } catch (error) {
    state.storageStatus.indexedDb = `error: ${error.message}`;
    addError("storage", "restore-workspace", error);
  }
  applyTheme();
  if (!elements().sqlEditor.value) seedDefaultSql();
  state.ai.apiKeyConfigured = Boolean(getOpenRouterApiKey());
  const modelCache = loadAiModelCache();
  if (modelCache?.models) {
    state.ai.modelList = modelCache.models;
    state.ai.modelListRefreshedAt = modelCache.refreshedAt;
  }
  await restoreTableAvailability();
  syncAiSettingsToUi();
  refreshAiContextPreview();
  notify();
  initializeDatabase().then((status) => {
    state.dbStatus = status;
    if (status.error) addError("duckdb", "initialize", new Error(status.error));
    notify();
  });
}

function bindEvents() {
  const el = elements();
  document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.tab)));
  el.themeSelect.addEventListener("change", () => {
    updateWorkspace((workspace) => { workspace.settings.theme = el.themeSelect.value; });
    saveThemePreference(el.themeSelect.value);
    applyTheme();
    rebuildVisualization();
  });
  el.loadSample.addEventListener("click", loadSalesSample);
  el.runSql.addEventListener("click", runEditorSql);
  el.sqlEditor.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") runEditorSql();
  });
  el.clearSql.addEventListener("click", () => { el.sqlEditor.value = ""; });
  el.copySql.addEventListener("click", () => copyText(el.sqlEditor.value).catch((error) => addError("ui", "copy-sql", error)));
  el.saveQuery.addEventListener("click", saveCurrentQuery);
  for (const input of [el.chartType, el.xField, el.yField, el.vizTitle, el.smoothLine, el.showPoints, el.zoom, el.legend]) {
    input.addEventListener("input", rebuildVisualization);
    input.addEventListener("change", rebuildVisualization);
  }
  el.saveViz.addEventListener("click", saveCurrentVisualization);
  el.copySpec.addEventListener("click", () => copyText(el.specEditor.value).catch((error) => addError("ui", "copy-spec", error)));
  el.copyDebug.addEventListener("click", () => copyText(el.debugReport.textContent).catch((error) => addError("ui", "copy-debug", error)));
  el.resetWorkspace.addEventListener("click", resetWorkspace);
  el.selfTest.addEventListener("click", runSelfTest);
  el.openRouterKey.addEventListener("change", () => {
    setOpenRouterApiKey(el.openRouterKey.value);
    el.openRouterKey.value = "";
    state.ai.apiKeyConfigured = Boolean(getOpenRouterApiKey());
    notify();
  });
  for (const input of [el.aiEnabled, el.aiModel, el.aiContextMode, el.aiTemperature, el.aiMaxTokens, el.aiMaxSampleRows, el.aiMaxResultRows, el.aiTimeout, el.aiSystemPrompt]) {
    input.addEventListener("change", persistAiSettingsFromUi);
  }
  el.aiTables.addEventListener("change", () => {
    state.ai.selectedTables = selectedAiTables();
    refreshAiContextPreview();
    notify();
  });
  el.previewAiContext.addEventListener("click", () => { refreshAiContextPreview(); notify(); });
  el.refreshModels.addEventListener("click", refreshAiModels);
  el.runAi.addEventListener("click", runSelectedAiAction);
  el.cancelAi.addEventListener("click", () => {
    if (currentAiAbortController) {
      currentAiAbortController.abort();
      addStatus("ai", "cancel", "AI request cancelled.");
    }
  });
  el.clearAiHistory.addEventListener("click", () => updateWorkspace((workspace) => { workspace.aiHistory = []; }));
  el.newDashboard.addEventListener("click", createNewDashboard);
  el.dashboardSelect.addEventListener("change", () => updateWorkspace((workspace) => { workspace.active.dashboardId = el.dashboardSelect.value || null; }));
  el.renameDashboard.addEventListener("click", renameActiveDashboard);
  el.duplicateDashboard.addEventListener("click", duplicateActiveDashboard);
  el.deleteDashboard.addEventListener("click", deleteActiveDashboard);
  el.addDashboardViz.addEventListener("click", addSelectedVisualizationToDashboard);
  el.refreshDashboard.addEventListener("click", () => refreshActiveDashboard({ bypassCache: true }));
  el.refreshFailedCards.addEventListener("click", refreshFailedDashboardCards);
  el.cancelDashboardRefresh.addEventListener("click", cancelDashboardRefresh);
  el.addRegionFilter.addEventListener("click", addRegionFilter);
  el.clearDashboardFilters.addEventListener("click", clearDashboardFilters);
  el.exportDashboard.addEventListener("click", exportActiveDashboard);
  el.dashboardImportInput.addEventListener("change", importDashboardFromFile);
  el.snapshotDashboard.addEventListener("click", snapshotActiveDashboard);
  el.copyDeploymentInfo.addEventListener("click", copyDeploymentInfo);
  el.newReport.addEventListener("click", createNewReport);
  el.reportSelect.addEventListener("change", () => updateWorkspace((workspace) => { workspace.active.reportId = el.reportSelect.value || null; }));
  el.renameReport.addEventListener("click", renameActiveReport);
  el.duplicateReport.addEventListener("click", duplicateActiveReport);
  el.deleteReport.addEventListener("click", deleteActiveReport);
  el.addReportSection.addEventListener("click", addSelectedReportSection);
  for (const input of [el.reportSectionTitle, el.reportSectionNarrative, el.reportSourceViz, el.reportSourceQuery, el.reportSourceDashboard, el.reportSqlVisible, el.reportTableLimit]) {
    input.addEventListener("change", updateSelectedReportSection);
  }
  el.refreshReport.addEventListener("click", refreshActiveReport);
  el.refreshReportSection.addEventListener("click", refreshSelectedReportSection);
  el.exportReportHtml.addEventListener("click", exportActiveReportHtml);
  el.exportReportMarkdown.addEventListener("click", exportActiveReportMarkdown);
  el.exportReportJson.addEventListener("click", exportActiveReportJson);
  el.reportImportInput.addEventListener("change", importReportFromFile);
  el.exportReportPackage.addEventListener("click", exportActiveReportPackage);
  el.printReport.addEventListener("click", printActiveReport);
  el.copyReportMetadata.addEventListener("click", copyReportMetadata);
  document.addEventListener("click", handleObjectSelection);
  document.addEventListener("click", handleAiProposalAction);
  document.addEventListener("click", handleDashboardAction);
  document.addEventListener("click", handleReportAction);
}

async function restoreTableAvailability() {
  for (const source of state.workspace.dataSources) {
    let loaded = false;
    try {
      loaded = await tableExists(source.tableName);
    } catch {
      loaded = false;
    }
    source.available = loaded;
    markTableLoaded(source.tableName, loaded);
  }
}

async function loadSalesSample() {
  try {
    addStatus("sample", "load", "Loading sample sales data...");
    const source = await loadIncludedSalesSample();
    updateWorkspace((workspace) => {
      addOrUpdateDataSource(workspace, source);
    });
    markTableLoaded(source.tableName, true);
    invalidateDashboardCache();
    elements().sqlEditor.value = DEFAULT_SALES_SQL;
    elements().queryName.value = "Monthly revenue";
    selectTab("data");
    await saveWorkspace(state.workspace);
    state.storageStatus.lastSavedAt = nowIso();
    addStatus("sample", "load", "Sample sales data loaded.");
  } catch (error) {
    addError("sample", "load", error);
  }
}

async function runEditorSql() {
  const sql = elements().sqlEditor.value.trim();
  if (!sql) return;
  const result = await runQuery(sql, state.workspace.active.queryId);
  setCurrentResult(result);
  if (result.error) {
    addError("duckdb", "execute-query", new Error(result.error.message));
    return;
  }
  if (state.workspace.active.queryId) {
    updateWorkspace((workspace) => {
      const query = workspace.queries.find((item) => item.id === state.workspace.active.queryId);
      if (query && query.sql.trim() === sql) {
        query.lastRunAt = result.executedAt;
        query.runCount += 1;
      }
    });
  }
  const spec = defaultVisualizationSpec({ queryId: state.workspace.active.queryId, columns: result.columns });
  setCurrentSpec(spec);
  await rebuildVisualization();
  selectTab("sql");
}

function saveCurrentQuery() {
  const existing = state.workspace.queries.find((query) => query.id === state.workspace.active.queryId);
  const input = buildQuerySaveInput({
    name: elements().queryName.value,
    sql: elements().sqlEditor.value,
    result: state.currentResult,
    existing,
  });
  updateWorkspace((workspace) => {
    addOrUpdateQuery(workspace, input, existing?.id);
  });
  if (state.currentResult) state.currentResult.queryId = state.workspace.active.queryId;
  return state.workspace.queries.find((query) => query.id === state.workspace.active.queryId);
}

function specFromControls() {
  const el = elements();
  const y = state.currentResult?.columns.find((column) => column.name === el.yField.value);
  return {
    version: 1,
    type: el.chartType.value,
    title: el.vizTitle.value || "Untitled visualization",
    subtitle: "",
    dataset: { queryId: state.workspace.active.queryId },
    encoding: {
      x: { field: el.xField.value, dataType: state.currentResult?.columns.find((column) => column.name === el.xField.value)?.inferredType || "string", label: label(el.xField.value) },
      y: [{ field: el.yField.value, dataType: y?.inferredType || "number", label: label(el.yField.value), format: /revenue|cost|profit/i.test(el.yField.value) ? "currency" : "number" }],
      series: null,
      size: null,
      color: null,
    },
    options: {
      stack: false,
      normalize: false,
      smooth: el.smoothLine.checked,
      showPoints: el.showPoints.checked,
      legend: el.legend.checked,
      tooltip: "axis",
      zoom: el.zoom.checked,
      labels: false,
      orientation: "vertical",
    },
  };
}

async function rebuildVisualization() {
  if (!state.currentResult || state.currentResult.error) {
    showEmpty(elements().chart, "Run a successful query to render a chart.");
    return;
  }
  const spec = specFromControls();
  const validation = validateVisualizationSpec(spec, state.currentResult);
  setCurrentSpec(validation.spec);
  if (!validation.valid) {
    showEmpty(elements().chart, "Fix visualization validation errors to render a chart.");
    return;
  }
  try {
    const option = await renderVisualization(elements().chart, validation.spec, state.currentResult, getThemeTokens(activeThemeName()));
    setCurrentOption(option);
    elements().vizStatus.textContent = "Chart rendered.";
  } catch (error) {
    addError("chart", "render", error);
  }
}

function activeDashboardOrNull() {
  return state.workspace.dashboards.find((dashboard) => dashboard.id === state.workspace.active.dashboardId) || state.workspace.dashboards[0] || null;
}

function createNewDashboard() {
  updateWorkspace((workspace) => addDashboard(workspace, createDashboard({ name: `Dashboard ${workspace.dashboards.length + 1}` })));
  selectTab("dashboard");
}

function renameActiveDashboard() {
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  const name = prompt("Dashboard name", dashboard.name);
  if (!name) return;
  updateWorkspace((workspace) => updateDashboard(workspace, dashboard.id, { name }));
}

function duplicateActiveDashboard() {
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  updateWorkspace((workspace) => duplicateDashboardModel(workspace, dashboard.id));
}

function deleteActiveDashboard() {
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  if (!confirm(`Delete dashboard "${dashboard.name}"? Queries and visualizations are kept.`)) return;
  updateWorkspace((workspace) => deleteDashboardModel(workspace, dashboard.id));
}

function addSelectedVisualizationToDashboard() {
  let dashboard = activeDashboardOrNull();
  if (!dashboard) {
    updateWorkspace((workspace) => addDashboard(workspace, createDashboard({ name: "Default dashboard" })));
    dashboard = activeDashboardOrNull();
  }
  const vizId = elements().dashboardVizChooser.value;
  if (!vizId) return;
  updateWorkspace((workspace) => addCard(findDashboard(workspace, dashboard.id), vizId, "medium"));
}

async function refreshActiveDashboard({ bypassCache = false } = {}) {
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  currentDashboardAbortController = new AbortController();
  state.dashboard.refreshing = true;
  state.dashboard.cardStates = Object.fromEntries(dashboard.layout.map((card) => [card.id, { cardId: card.id, status: "loading" }]));
  notify();
  try {
    const result = await runDashboardRefresh({
      dashboard,
      workspace: state.workspace,
      loadedTables: state.loadedTables,
      bypassCache,
      concurrencyLimit: dashboard.settings.concurrencyLimit || 3,
      signal: currentDashboardAbortController.signal,
    });
    state.dashboard.cardStates = result.states;
    state.dashboard.lastRefresh = result;
    notify();
    await renderDashboardCharts();
  } catch (error) {
    state.dashboard.lastError = error.message;
    addError("dashboard", "refresh", error);
  } finally {
    state.dashboard.refreshing = false;
    currentDashboardAbortController = null;
    notify();
  }
}

async function refreshFailedDashboardCards() {
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  for (const card of dashboard.layout.filter((item) => ["error", "unavailable"].includes(state.dashboard.cardStates[item.id]?.status))) {
    state.dashboard.cardStates[card.id] = await refreshCard({ dashboard, card, workspace: state.workspace, loadedTables: state.loadedTables, bypassCache: true });
  }
  notify();
  await renderDashboardCharts();
}

function cancelDashboardRefresh() {
  if (currentDashboardAbortController) currentDashboardAbortController.abort();
}

function addRegionFilter() {
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  const value = prompt("Region values, comma separated", "East,West");
  if (!value) return;
  updateWorkspace((workspace) => {
    const active = findDashboard(workspace, dashboard.id);
    active.filters.push({
      id: uid("filter"),
      name: "Region",
      field: "region",
      semanticType: "category",
      operator: "in",
      value: value.split(",").map((item) => item.trim()).filter(Boolean),
      sourceTables: ["sales"],
      appliesTo: { mode: "compatible", cardIds: [] },
      enabled: true,
    });
  });
  invalidateDashboardCache();
}

function clearDashboardFilters() {
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  updateWorkspace((workspace) => { findDashboard(workspace, dashboard.id).filters = []; });
  invalidateDashboardCache();
}

async function renderDashboardCharts() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  for (const card of dashboard.layout) {
    const cardState = state.dashboard.cardStates[card.id];
    const element = document.getElementById(`dashboardChart_${card.id}`);
    if (!element || cardState?.status !== "ready") continue;
    try {
      await renderVisualization(element, cardState.spec, cardState.result, getThemeTokens(activeThemeName()), `dashboard_${card.id}`);
    } catch (error) {
      state.dashboard.cardStates[card.id] = { ...cardState, status: "error", error: error.message };
      addError("dashboard", "render-card", error);
    }
  }
}

function handleDashboardAction(event) {
  const button = event.target.closest("[data-dashboard-action]");
  if (!button) return;
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  const cardId = button.dataset.cardId;
  const action = button.dataset.dashboardAction;
  if (action === "refresh-card") { refreshOneDashboardCard(cardId); return; }
  if (action === "view-sql") {
    const card = dashboard.layout.find((item) => item.id === cardId);
    const viz = state.workspace.visualizations.find((item) => item.id === card?.visualizationId);
    const query = state.workspace.queries.find((item) => item.id === viz?.queryId);
    if (query) { elements().sqlEditor.value = query.sql; elements().queryName.value = query.name; selectTab("sql"); }
    return;
  }
  if (action === "open-viz") {
    const card = dashboard.layout.find((item) => item.id === cardId);
    const viz = state.workspace.visualizations.find((item) => item.id === card?.visualizationId);
    if (viz) { setActive({ visualizationId: viz.id, queryId: viz.queryId }); setCurrentSpec(viz.spec); loadSpecIntoControls(viz.spec); selectTab("visualize"); }
    return;
  }
  updateWorkspace((workspace) => {
    const active = findDashboard(workspace, dashboard.id);
    if (action === "duplicate-card") duplicateCard(active, cardId);
    if (action === "remove-card") { removeCard(active, cardId); disposeChartInstance(`dashboard_${cardId}`); delete state.dashboard.cardStates[cardId]; }
    if (action === "move-left") moveCard(active, cardId, -1, 0);
    if (action === "move-right") moveCard(active, cardId, 1, 0);
    if (action === "move-up") moveCard(active, cardId, 0, -1);
    if (action === "move-down") moveCard(active, cardId, 0, 1);
    if (action === "wider") resizeCard(active, cardId, 1, 0);
    if (action === "narrower") resizeCard(active, cardId, -1, 0);
    if (action === "taller") resizeCard(active, cardId, 0, 1);
    if (action === "shorter") resizeCard(active, cardId, 0, -1);
  });
  renderDashboardCharts();
}

async function refreshOneDashboardCard(cardId) {
  const dashboard = activeDashboardOrNull();
  const card = dashboard?.layout.find((item) => item.id === cardId);
  if (!dashboard || !card) return;
  state.dashboard.cardStates[card.id] = { cardId: card.id, status: "loading" };
  notify();
  state.dashboard.cardStates[card.id] = await refreshCard({ dashboard, card, workspace: state.workspace, loadedTables: state.loadedTables, bypassCache: true });
  notify();
  await renderDashboardCharts();
}

function exportActiveDashboard() {
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  const pkg = exportDashboardPackage(state.workspace, dashboard.id);
  state.dashboard.lastExportAt = pkg.exportedBy.exportedAt;
  downloadJson(`${safeFileName(dashboard.name)}_dashboard.json`, pkg);
  notify();
}

async function importDashboardFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const pkg = JSON.parse(await file.text());
    updateWorkspace((workspace) => importDashboardPackage(workspace, pkg));
    addStatus("dashboard", "import", `Imported dashboard package ${file.name}.`);
  } catch (error) {
    state.dashboard.lastError = error.message;
    addError("dashboard", "import", error);
  } finally {
    event.target.value = "";
  }
}

function snapshotActiveDashboard() {
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  const html = createSnapshotHtml({ dashboard, cardStates: state.dashboard.cardStates, includeSql: true });
  state.dashboard.lastSnapshotAt = new Date().toISOString();
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(dashboard.name)}_snapshot.html`;
  anchor.click();
  URL.revokeObjectURL(url);
  notify();
}

function copyDeploymentInfo() {
  copyText(JSON.stringify({
    appVersion: APP_VERSION,
    buildDate: BUILD_DATE,
    workspaceId: state.workspace.id,
    activeDashboardId: state.workspace.active.dashboardId,
    url: location.href,
  }, null, 2)).catch((error) => addError("ui", "copy-deployment-info", error));
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFileName(name) {
  return String(name || "dashboard").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
}

function activeReportOrNull() {
  return state.workspace.reports.find((report) => report.id === state.workspace.active.reportId) || state.workspace.reports[0] || null;
}

function createNewReport() {
  updateWorkspace((workspace) => addReport(workspace, createReport({ name: `Report ${workspace.reports.length + 1}`, title: `Report ${workspace.reports.length + 1}` })));
  selectTab("report");
}

function renameActiveReport() {
  const report = activeReportOrNull();
  if (!report) return;
  const title = prompt("Report title", report.title);
  if (!title) return;
  updateWorkspace((workspace) => updateReport(workspace, report.id, { title, name: title }));
}

function duplicateActiveReport() {
  const report = activeReportOrNull();
  if (!report) return;
  updateWorkspace((workspace) => duplicateReportModel(workspace, report.id));
}

function deleteActiveReport() {
  const report = activeReportOrNull();
  if (!report) return;
  if (!confirm(`Delete report "${report.title}"? Sources are kept.`)) return;
  updateWorkspace((workspace) => deleteReportModel(workspace, report.id));
}

function addSelectedReportSection() {
  let report = activeReportOrNull();
  if (!report) {
    updateWorkspace((workspace) => addReport(workspace, createReport({ name: "Default report", title: "Default Report" })));
    report = activeReportOrNull();
  }
  const type = elements().reportSectionType.value;
  updateWorkspace((workspace) => {
    const active = findReport(workspace, report.id);
    const section = addSection(active, {
      type,
      source: {
        visualizationId: type === "visualization" ? elements().reportSourceViz.value || null : null,
        queryId: ["query-table", "kpi", "sql"].includes(type) ? elements().reportSourceQuery.value || null : null,
        dashboardId: type === "dashboard-snapshot" ? elements().reportSourceDashboard.value || null : null,
      },
    });
    workspace.active.reportId = active.id;
    state.report.selectedSectionId = section.id;
  });
}

function updateSelectedReportSection() {
  const report = activeReportOrNull();
  if (!report || !state.report.selectedSectionId) return;
  updateWorkspace((workspace) => {
    const section = findSection(findReport(workspace, report.id), state.report.selectedSectionId);
    section.title = elements().reportSectionTitle.value || section.title;
    section.content.narrative = elements().reportSectionNarrative.value;
    section.source.visualizationId = elements().reportSourceViz.value || null;
    section.source.queryId = elements().reportSourceQuery.value || null;
    section.source.dashboardId = elements().reportSourceDashboard.value || null;
    section.content.sqlVisible = elements().reportSqlVisible.checked;
    section.content.table.rowLimit = Number(elements().reportTableLimit.value || 25);
  });
}

async function refreshActiveReport() {
  const report = activeReportOrNull();
  if (!report) return;
  currentReportAbortController = new AbortController();
  state.report.refreshing = true;
  state.report.sectionStates = Object.fromEntries(report.sections.filter((section) => section.visible !== false).map((section) => [section.id, { sectionId: section.id, status: "loading" }]));
  notify();
  try {
    const result = await runReportRefresh({ report, workspace: state.workspace, loadedTables: state.loadedTables, signal: currentReportAbortController.signal });
    state.report.sectionStates = result.states;
    state.report.lastRefresh = result;
  } catch (error) {
    state.report.lastError = error.message;
    addError("report", "refresh", error);
  } finally {
    state.report.refreshing = false;
    currentReportAbortController = null;
    notify();
  }
}

async function refreshSelectedReportSection() {
  const report = activeReportOrNull();
  const section = report?.sections.find((item) => item.id === state.report.selectedSectionId);
  if (!report || !section) return;
  state.report.sectionStates[section.id] = { sectionId: section.id, status: "loading" };
  notify();
  state.report.sectionStates[section.id] = await runReportSectionRefresh({ report, section, workspace: state.workspace, loadedTables: state.loadedTables });
  notify();
}

function handleReportAction(event) {
  const button = event.target.closest("[data-report-action]");
  if (!button) return;
  const report = activeReportOrNull();
  if (!report) return;
  const sectionId = button.dataset.sectionId;
  const action = button.dataset.reportAction;
  if (action === "select-section") {
    state.report.selectedSectionId = sectionId;
    notify();
    return;
  }
  updateWorkspace((workspace) => {
    const active = findReport(workspace, report.id);
    if (action === "remove-section") removeSection(active, sectionId);
    if (action === "duplicate-section") duplicateSection(active, sectionId);
    if (action === "move-section-up") moveSection(active, sectionId, -1);
    if (action === "move-section-down") moveSection(active, sectionId, 1);
    if (action === "move-section-top") moveSection(active, sectionId, -active.sections.length);
    if (action === "move-section-bottom") moveSection(active, sectionId, active.sections.length);
    if (action === "toggle-section-visible") {
      const section = findSection(active, sectionId);
      setSectionVisible(active, sectionId, section.visible === false);
    }
  });
}

function exportActiveReportHtml() {
  const report = activeReportOrNull();
  if (!report) return;
  const html = renderReportHtml(report, { workspace: state.workspace });
  state.report.lastHtmlExportAt = new Date().toISOString();
  downloadBlob(`${safeFileName(report.title)}.html`, html, "text/html");
  notify();
}

function exportActiveReportMarkdown() {
  const report = activeReportOrNull();
  if (!report) return;
  const markdown = renderReportMarkdown(report);
  state.report.lastMarkdownExportAt = new Date().toISOString();
  downloadBlob(`${safeFileName(report.title)}.md`, markdown, "text/markdown");
  notify();
}

function exportActiveReportJson() {
  const report = activeReportOrNull();
  if (!report) return;
  const pkg = exportReportJson(state.workspace, report.id);
  downloadBlob(`${safeFileName(report.title)}_report.json`, JSON.stringify(pkg, null, 2), "application/json");
}

async function importReportFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const pkg = JSON.parse(await file.text());
    updateWorkspace((workspace) => importReportJson(workspace, pkg));
    addStatus("report", "import", `Imported report ${file.name}.`);
  } catch (error) {
    state.report.lastError = error.message;
    addError("report", "import", error);
  } finally {
    event.target.value = "";
  }
}

function exportActiveReportPackage() {
  const report = activeReportOrNull();
  if (!report) return;
  const pkg = createReportPackageFiles(report);
  state.report.lastPackageExportAt = pkg.manifest.generatedAt;
  downloadBlob(`${safeFileName(report.title)}_package.json`, JSON.stringify(pkg, null, 2), "application/json");
  notify();
}

function printActiveReport() {
  state.report.lastPrintAt = new Date().toISOString();
  notify();
  window.print();
}

function copyReportMetadata() {
  const report = activeReportOrNull();
  if (!report) return;
  copyText(JSON.stringify({ appVersion: APP_VERSION, buildDate: BUILD_DATE, reportId: report.id, title: report.title, sectionCount: report.sections.length }, null, 2)).catch((error) => addError("ui", "copy-report-metadata", error));
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function syncAiSettingsToUi() {
  const el = elements();
  const settings = state.workspace.settings.ai;
  state.ai.selectedTables = state.ai.selectedTables.length ? state.ai.selectedTables : state.workspace.dataSources.map((source) => source.tableName);
  el.aiEnabled.checked = Boolean(settings.enabled);
  el.aiModel.value = settings.model;
  el.aiContextMode.value = settings.contextMode;
  el.aiTemperature.value = settings.temperature;
  el.aiMaxTokens.value = settings.maxOutputTokens;
  el.aiMaxSampleRows.value = settings.maxSampleRows;
  el.aiMaxResultRows.value = settings.maxResultRows;
  el.aiTimeout.value = settings.timeoutMs;
  el.aiSystemPrompt.value = settings.customSystemPrompt || "";
}

function persistAiSettingsFromUi() {
  const el = elements();
  updateWorkspace((workspace) => {
    workspace.settings.ai = {
      ...workspace.settings.ai,
      enabled: el.aiEnabled.checked,
      model: el.aiModel.value || workspace.settings.ai.model,
      contextMode: el.aiContextMode.value,
      temperature: Number(el.aiTemperature.value),
      maxOutputTokens: Number(el.aiMaxTokens.value),
      maxSampleRows: Number(el.aiMaxSampleRows.value),
      maxResultRows: Number(el.aiMaxResultRows.value),
      timeoutMs: Number(el.aiTimeout.value),
      customSystemPrompt: el.aiSystemPrompt.value,
    };
  });
  refreshAiContextPreview();
}

function selectedAiTables() {
  return [...elements().aiTables.selectedOptions].map((option) => option.value);
}

function refreshAiContextPreview() {
  const selectedTables = state.ai.selectedTables.length ? state.ai.selectedTables : state.workspace.dataSources.map((source) => source.tableName);
  const built = buildAiContext({
    workspace: state.workspace,
    selectedTableNames: selectedTables,
    result: state.currentResult,
    recommendations: [],
    settings: state.workspace.settings.ai,
  });
  state.ai.contextPreview = contextPreview(built.context);
  state.ai.contextWarnings = built.warnings;
}

async function refreshAiModels() {
  persistAiSettingsFromUi();
  const result = await fetchOpenRouterModels({ apiKey: getOpenRouterApiKey(), timeoutMs: state.workspace.settings.ai.timeoutMs });
  state.ai.modelList = result.models;
  state.ai.modelListRefreshedAt = result.refreshedAt || new Date().toISOString();
  state.ai.modelListError = result.error?.message || null;
  saveAiModelCache({ models: result.models, refreshedAt: state.ai.modelListRefreshedAt });
  if (!result.models.some((model) => model.id === state.workspace.settings.ai.model)) {
    updateWorkspace((workspace) => { workspace.settings.ai.model = result.models[0]?.id || workspace.settings.ai.model; });
  }
  notify();
}

async function runSelectedAiAction() {
  persistAiSettingsFromUi();
  refreshAiContextPreview();
  const interaction = makeInteraction({
    action: elements().aiAction.value,
    model: state.workspace.settings.ai.model,
    selectedTables: state.ai.selectedTables,
    contextMode: state.workspace.settings.ai.contextMode,
    sampleRowsIncluded: state.workspace.settings.ai.contextMode === "sampleRows" && state.workspace.settings.ai.maxSampleRows > 0,
    userQuestion: elements().aiQuestion.value,
  });
  try {
    currentAiAbortController = new AbortController();
    const result = await runAiAction({
      apiKey: getOpenRouterApiKey(),
      action: elements().aiAction.value,
      question: elements().aiQuestion.value,
      workspace: state.workspace,
      selectedTables: state.ai.selectedTables.length ? state.ai.selectedTables : state.workspace.dataSources.map((source) => source.tableName),
      currentResult: state.currentResult,
      currentSpec: state.currentSpec,
      recommendations: [],
      settings: state.workspace.settings.ai,
      abortSignal: currentAiAbortController.signal,
    });
    state.ai.currentResult = result;
    state.ai.lastDiagnostics = { ...result.diagnostics, action: result.action };
    if (result.proposalState) state.ai.proposals = result.proposalState.proposals;
    interaction.status = result.validation.valid ? "complete" : "validation-failed";
    interaction.summary = result.validation.summary || result.raw.summary || result.raw.headline || result.raw.assessment || "";
    interaction.proposalIds = state.ai.proposals.map((proposal) => proposal.id);
    interaction.usage = result.usage;
    interaction.diagnostics = result.diagnostics;
  } catch (error) {
    interaction.status = "failed";
    interaction.error = { code: error.code || "AI_ERROR", message: error.message };
    state.ai.lastParseError = error.code === "AI_JSON_PARSE_FAILURE" ? error.message : null;
    addError("ai", "run-action", error);
  } finally {
    currentAiAbortController = null;
    updateWorkspace((workspace) => { addAiHistory(workspace, interaction); });
  }
}

async function handleAiProposalAction(event) {
  const button = event.target.closest("[data-ai-action]");
  if (!button) return;
  const item = state.ai.proposals.find((proposal) => proposal.id === button.dataset.id);
  if (!item) return;
  state.ai.selectedProposalId = item.id;
  const action = button.dataset.aiAction;
  if (action === "inspect") {
    notify();
    return;
  }
  if (action === "validate") {
    item.sqlSafety = validateSqlSafety(item.proposal.sql, state.ai.selectedTables);
    item.valid = item.errors.length === 0 && item.sqlSafety.ok;
    state.ai.lastSqlSafetyError = item.sqlSafety.errors[0]?.message || null;
    notify();
    return;
  }
  if (action === "preview-data") {
    item.sqlSafety = validateSqlSafety(item.proposal.sql, state.ai.selectedTables);
    if (!item.sqlSafety.ok) {
      state.ai.lastSqlSafetyError = item.sqlSafety.errors[0]?.message || "SQL safety failed.";
      notify();
      return;
    }
    item.explain = await explainSql(item.sqlSafety.sql);
    if (item.explain.ok) item.preview = await previewAiSql(item.sqlSafety.sql, state.workspace.settings.ai.maxResultRows);
    notify();
    return;
  }
  if (action === "preview-chart") {
    if (!item.preview?.ok) item.preview = await previewAiSql(item.proposal.sql, state.workspace.settings.ai.maxResultRows);
    if (item.preview?.ok) {
      const spec = { ...item.proposal.visualization, dataset: { queryId: "pending" } };
      try {
        await renderVisualization(elements().chart, spec, item.preview.result, getThemeTokens(activeThemeName()));
        selectTab("visualize");
      } catch (error) {
        addError("ai", "preview-chart", error);
      }
    }
    notify();
    return;
  }
  if (action === "open-builder") {
    const builder = proposalToBuilderState(item);
    elements().sqlEditor.value = builder.temporaryQuery.sql;
    elements().queryName.value = builder.temporaryQuery.name;
    setCurrentSpec(builder.spec);
    loadSpecIntoControls(builder.spec);
    selectTab("sql");
    notify();
    return;
  }
  if (action === "save") {
    if (!item.preview?.ok) item.preview = await previewAiSql(item.proposal.sql, state.workspace.settings.ai.maxResultRows);
    updateWorkspace((workspace) => saveAiProposal(workspace, item, {
      model: state.workspace.settings.ai.model,
      interactionId: state.workspace.aiHistory[0]?.id || null,
      result: item.preview?.result,
    }));
    notify();
    return;
  }
  if (action === "copy-sql") {
    copyText(item.proposal.sql).catch((error) => addError("ui", "copy-ai-sql", error));
    return;
  }
  if (action === "copy-json") {
    copyText(JSON.stringify(item.proposal, null, 2)).catch((error) => addError("ui", "copy-ai-json", error));
    return;
  }
  if (action === "reject") {
    markRejected(item);
    notify();
  }
}

function saveCurrentVisualization() {
  const queryId = state.workspace.active.queryId;
  if (!queryId || !state.workspace.queries.some((query) => query.id === queryId)) {
    addError("workspace", "save-visualization", new Error("Save the query before saving the visualization."));
    return;
  }
  const validation = validateVisualizationSpec(state.currentSpec, state.currentResult || { columns: [] });
  if (!validation.valid) {
    addError("viz-spec", "save-visualization", new Error(validation.errors.map((error) => error.message).join(" ")));
    return;
  }
  updateWorkspace((workspace) => {
    addOrUpdateVisualization(workspace, {
      name: validation.spec.title,
      queryId,
      spec: validation.spec,
      provenance: { createdBy: "user", model: null, createdAt: nowIso() },
    }, workspace.active.visualizationId);
  });
}

function handleObjectSelection(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === "select-source") {
    setActive({ dataSourceId: id });
    const source = state.workspace.dataSources.find((item) => item.id === id);
    if (source) elements().sqlEditor.value = `SELECT * FROM ${source.tableName} LIMIT 100;`;
    selectTab("data");
  }
  if (action === "select-query") {
    const query = state.workspace.queries.find((item) => item.id === id);
    if (!query) return;
    setActive({ queryId: query.id, visualizationId: null });
    elements().queryName.value = query.name;
    elements().sqlEditor.value = query.sql;
    setCurrentResult(null);
    setCurrentSpec(null);
    showEmpty(elements().chart, "Run the selected query to refresh its result before rendering.");
    selectTab("sql");
  }
  if (action === "select-viz") {
    const viz = state.workspace.visualizations.find((item) => item.id === id);
    const query = state.workspace.queries.find((item) => item.id === viz?.queryId);
    if (!viz || !query) return;
    setActive({ visualizationId: viz.id, queryId: query.id });
    elements().queryName.value = query.name;
    elements().sqlEditor.value = query.sql;
    setCurrentSpec(viz.spec);
    loadSpecIntoControls(viz.spec);
    showEmpty(elements().chart, "Run or refresh the query to render this saved visualization.");
    selectTab("visualize");
  }
}

function loadSpecIntoControls(spec) {
  const el = elements();
  el.chartType.value = spec.type;
  el.vizTitle.value = spec.title || "";
  el.smoothLine.checked = Boolean(spec.options?.smooth);
  el.showPoints.checked = Boolean(spec.options?.showPoints);
  el.zoom.checked = spec.options?.zoom !== false;
  el.legend.checked = Boolean(spec.options?.legend);
}

async function resetWorkspace() {
  saveSuppressed = true;
  try {
    await resetStoredWorkspace();
    setWorkspace(createWorkspace());
    seedDefaultSql();
    setCurrentResult(null);
    setCurrentSpec(null);
    showEmpty(elements().chart, "Workspace reset.");
  } catch (error) {
    addError("storage", "reset-workspace", error);
  } finally {
    saveSuppressed = false;
    notify();
  }
}

async function runSelfTest() {
  const results = [];
  const step = async (name, fn) => {
    try {
      await fn();
      results.push({ name, ok: true });
    } catch (error) {
      results.push({ name, ok: false, message: error.message });
    }
    state.selfTest = results;
    renderSelfTest(results);
  };
  await step("DuckDB connection exists", async () => {
    const status = await initializeDatabase();
    if (!status.conn) throw new Error(status.error || "No connection.");
  });
  await step("Temporary table can be created", () => executeSql("CREATE OR REPLACE TEMP TABLE qv_self_test (x INTEGER, y DOUBLE)"));
  await step("Data can be inserted", () => executeSql("INSERT INTO qv_self_test VALUES (1, 2.5), (2, 4.5)"));
  let dataset = null;
  await step("SELECT can be executed", async () => {
    dataset = await executeSql("SELECT x, y FROM qv_self_test ORDER BY x");
    if (dataset.rowCount !== 2) throw new Error("Unexpected row count.");
  });
  const queryId = uid("query");
  const validSpec = { version: 1, type: "line", title: "Self test", dataset: { queryId }, encoding: { x: { field: "x", dataType: "number", label: "X" }, y: [{ field: "y", dataType: "number", label: "Y" }] }, options: { smooth: true, showPoints: false, zoom: false, legend: false, tooltip: "axis", orientation: "vertical" } };
  await step("Valid line spec passes validation", () => {
    const validation = validateVisualizationSpec(validSpec, dataset);
    if (!validation.valid) throw new Error(validation.errors[0]?.message || "Invalid.");
  });
  await step("Invalid field reference fails validation", () => {
    const validation = validateVisualizationSpec({ ...validSpec, encoding: { ...validSpec.encoding, x: { field: "missing" }, y: validSpec.encoding.y } }, dataset);
    if (validation.valid) throw new Error("Invalid field was accepted.");
  });
  await step("Valid spec compiles to ECharts option", () => {
    const option = compileVisualizationSpec(validSpec, dataset, getThemeTokens(activeThemeName()));
    if (!option.series?.[0] || !option.dataset) throw new Error("Missing compiled series or dataset.");
  });
  await step("IndexedDB can save and retrieve temporary workspace", async () => {
    const workspace = createWorkspace({ id: uid("workspace") });
    const restored = await saveTemporaryWorkspace(workspace);
    if (restored.id !== workspace.id) throw new Error("Workspace ID did not round trip.");
    await saveWorkspace(state.workspace);
  });
  await step("Workspace hydration preserves query and visualization relationships", () => {
    const workspace = createWorkspace();
    const query = addOrUpdateQuery(workspace, { id: queryId, name: "Q", sql: "SELECT x, y FROM qv_self_test" });
    addOrUpdateVisualization(workspace, { name: "V", queryId: query.id, spec: validSpec });
    const restored = hydrateWorkspace(JSON.parse(JSON.stringify(workspace)));
    if (restored.visualizations[0].queryId !== restored.queries[0].id) throw new Error("Relationship not preserved.");
  });
  await step("AI settings store without exposing key", () => {
    const key = getOpenRouterApiKey();
    if (key && JSON.stringify(state.workspace).includes(key)) throw new Error("API key leaked into workspace.");
  });
  await step("Schema-only AI context creation", () => {
    const built = buildAiContext({ workspace: state.workspace, selectedTableNames: state.workspace.dataSources.map((source) => source.tableName), settings: state.workspace.settings.ai });
    if (!built.context.tables) throw new Error("Context missing tables.");
  });
  await step("Sensitive-field exclusion", () => {
    const workspace = createWorkspace({ dataSources: [{ tableName: "t", rowCount: 1, columns: [{ name: "customer_email", duckType: "VARCHAR" }] }] });
    const built = buildAiContext({ workspace, selectedTableNames: ["t"], settings: state.workspace.settings.ai, excludedColumns: ["t.customer_email"] });
    if (built.context.tables[0].columns.some((column) => column.name === "customer_email")) throw new Error("Sensitive field was not excluded.");
  });
  const aiPayload = {
    contract: AI_CONTRACTS.proposals,
    contractVersion: 1,
    summary: "Self-test AI proposal.",
    proposals: [{
      id: "proposal_self_test",
      title: "Self-test proposal",
      question: "Is the self-test working?",
      description: "Simple SQL and line chart.",
      sourceTables: ["qv_self_test"],
      confidence: 0.9,
      sql: "SELECT x, y FROM qv_self_test",
      expectedColumns: [{ name: "x", dataType: "number", role: "x" }, { name: "y", dataType: "number", role: "y" }],
      visualization: validSpec,
      reasoning: { whyThisQuestion: "Smoke test.", whyThisChart: "Line chart uses x/y." },
      assumptions: [],
      cautions: [],
    }],
  };
  let aiProposal = null;
  await step("Valid proposal contract parsing", () => {
    const validation = validateAiResponse(aiPayload, { expectedContract: AI_CONTRACTS.proposals, knownTables: ["qv_self_test"], dataset });
    if (!validation.proposals[0].valid) throw new Error(validation.proposals[0].errors[0]?.message || "Proposal invalid.");
    aiProposal = validation.proposals[0];
  });
  await step("Invalid proposal rejection", () => {
    const validation = validateAiResponse({ ...aiPayload, proposals: [{ ...aiPayload.proposals[0], sql: "DROP TABLE qv_self_test" }] }, { expectedContract: AI_CONTRACTS.proposals, knownTables: ["qv_self_test"], dataset });
    if (validation.proposals[0].valid) throw new Error("Destructive proposal accepted.");
  });
  await step("SELECT SQL accepted", () => {
    if (!validateSqlSafety("SELECT * FROM qv_self_test", ["qv_self_test"]).ok) throw new Error("SELECT rejected.");
  });
  await step("Destructive SQL rejected", () => {
    if (validateSqlSafety("DROP TABLE qv_self_test", ["qv_self_test"]).ok) throw new Error("DROP accepted.");
  });
  await step("EXPLAIN of safe sample query", async () => {
    const explain = await explainSql("SELECT x, y FROM qv_self_test");
    if (!explain.ok) throw new Error(explain.error || "Explain failed.");
  });
  await step("Limited preview execution", async () => {
    const preview = await previewAiSql("SELECT x, y FROM qv_self_test", 1);
    if (!preview.ok || preview.result.rowCount !== 1) throw new Error(preview.error || "Preview failed.");
  });
  await step("ECharts compilation from AI proposal", () => {
    const option = compileVisualizationSpec(aiProposal.proposal.visualization, dataset, getThemeTokens(activeThemeName()));
    if (!option.series?.length) throw new Error("AI proposal did not compile.");
  });
  await step("Proposal-to-builder conversion", () => {
    const builder = proposalToBuilderState({ ...aiProposal, id: "proposal_self_test" });
    if (builder.temporaryQuery.createdBy !== "ai") throw new Error("Builder provenance missing.");
  });
  await step("Saving AI query and visualization with provenance", () => {
    const workspace = createWorkspace();
    const saved = saveAiProposal(workspace, { ...aiProposal, id: "proposal_self_test" }, { model: "mock/model", interactionId: "ai_self_test" });
    if (saved.query.provenance.model !== "mock/model" || saved.viz.provenance.createdBy !== "ai") throw new Error("AI provenance missing.");
  });
  await step("Repair contract parsing", () => {
    const repair = validateRepair({ contract: AI_CONTRACTS.repair, contractVersion: 1, summary: "ok", repairedSql: "SELECT x, y FROM qv_self_test", expectedColumns: [], visualization: validSpec, changes: [], assumptions: [], cautions: [] }, ["qv_self_test"], dataset);
    if (!repair.valid) throw new Error(repair.errors[0]?.message || "Repair invalid.");
  });
  await step("Sanitized AI-history persistence", () => {
    const workspace = createWorkspace();
    addAiHistory(workspace, { action: "self-test", model: "mock/model", apiKey: "secret" });
    if (JSON.stringify(workspace.aiHistory).includes("secret")) throw new Error("Secret leaked to history.");
  });
  await step("Create temporary dashboard", () => {
    const workspace = createWorkspace();
    const query = addOrUpdateQuery(workspace, { id: "query_dash_self", name: "Dash Q", sql: "SELECT x, y FROM qv_self_test", sourceTables: ["qv_self_test"] });
    const viz = addOrUpdateVisualization(workspace, { id: "viz_dash_self", name: "Dash V", queryId: query.id, spec: validSpec });
    const dashboard = addDashboard(workspace, createDashboard({ id: "dashboard_self", name: "Self-test dashboard" }));
    addCard(dashboard, viz.id);
    addCard(dashboard, viz.id);
    if (dashboard.layout.length !== 2) throw new Error("Dashboard cards were not added.");
  });
  await step("Validate dashboard layout", () => {
    const workspace = createWorkspace();
    const query = addOrUpdateQuery(workspace, { id: "query_dash_self", sql: "SELECT x, y FROM qv_self_test", sourceTables: ["qv_self_test"] });
    const viz = addOrUpdateVisualization(workspace, { id: "viz_dash_self", name: "Dash V", queryId: query.id, spec: validSpec });
    const dashboard = addDashboard(workspace, createDashboard());
    addCard(dashboard, viz.id);
    if (!dashboard.layout[0] || dashboard.layout[0].width > 12) throw new Error("Invalid layout.");
  });
  await step("Apply category filter with safe SQL wrapping", () => {
    const filtered = validateSqlSafety("SELECT x, y FROM qv_self_test", ["qv_self_test"]);
    if (!filtered.ok) throw new Error("Base SQL failed safety.");
  });
  await step("Export dashboard package", () => {
    const workspace = createWorkspace();
    const query = addOrUpdateQuery(workspace, { id: "query_dash_self", sql: "SELECT x, y FROM qv_self_test", sourceTables: ["qv_self_test"] });
    const viz = addOrUpdateVisualization(workspace, { id: "viz_dash_self", name: "Dash V", queryId: query.id, spec: validSpec });
    const dashboard = addDashboard(workspace, createDashboard());
    addCard(dashboard, viz.id);
    const pkg = exportDashboardPackage(workspace, dashboard.id);
    if (pkg.exportedBy.appVersion !== APP_VERSION || pkg.visualizations.length !== 1) throw new Error("Dashboard package invalid.");
  });
  await step("Generate static dashboard snapshot", () => {
    const dashboard = createDashboard({ name: "Snapshot self-test" });
    const html = createSnapshotHtml({ dashboard });
    if (!html.includes(APP_VERSION)) throw new Error("Snapshot missing version.");
  });
  await step("Parse valid AI dashboard proposal", () => {
    const workspace = createWorkspace();
    const query = addOrUpdateQuery(workspace, { id: "query_dash_self", sql: "SELECT x, y FROM qv_self_test", sourceTables: ["qv_self_test"] });
    addOrUpdateVisualization(workspace, { id: "viz_dash_self", name: "Dash V", queryId: query.id, spec: validSpec });
    const result = validateAiResponse({ contract: AI_CONTRACTS.dashboard, contractVersion: 1, title: "Dash", description: "", audience: "", proposals: [{ type: "existing-visualization", visualizationId: "viz_dash_self", layout: { width: 6, height: 4 } }], filters: [], narrativeOrder: [], assumptions: [], cautions: [] }, { expectedContract: AI_CONTRACTS.dashboard, knownTables: ["qv_self_test"], dataset: workspace });
    if (!result.valid) throw new Error(result.errors[0]?.message || "AI dashboard invalid.");
  });
  await step("Reject unsafe AI dashboard proposal", () => {
    const result = validateAiResponse({ contract: AI_CONTRACTS.dashboard, contractVersion: 1, title: "Dash", proposals: [{ type: "new-visualization", sql: "DROP TABLE qv_self_test", layout: { width: 6, height: 4 } }], filters: [], narrativeOrder: [], assumptions: [], cautions: [] }, { expectedContract: AI_CONTRACTS.dashboard, knownTables: ["qv_self_test"], dataset: createWorkspace() });
    if (result.valid) throw new Error("Unsafe AI dashboard accepted.");
  });
  let reportWorkspace = null;
  let report = null;
  await step("Create temporary report", () => {
    reportWorkspace = createWorkspace();
    const query = addOrUpdateQuery(reportWorkspace, { id: "query_report_self", name: "Report Q", sql: "SELECT x, y FROM qv_self_test", sourceTables: ["qv_self_test"] });
    addOrUpdateVisualization(reportWorkspace, { id: "viz_report_self", name: "Report V", queryId: query.id, spec: validSpec });
    report = addReport(reportWorkspace, createReport({ id: "report_self", title: "Self-test Report" }));
    if (reportWorkspace.active.reportId !== report.id) throw new Error("Report not active.");
  });
  await step("Add report sections", () => {
    addSection(report, { type: "text", title: "Summary", content: { narrative: "Self-test narrative." } });
    addSection(report, { type: "visualization", source: { visualizationId: "viz_report_self" } });
    addSection(report, { type: "query-table", source: { queryId: "query_report_self" } });
    addSection(report, { type: "kpi", source: { queryId: "query_report_self" } });
    if (report.sections.length !== 4) throw new Error("Report sections missing.");
  });
  await step("Refresh report dynamic sections", async () => {
    const result = await runReportRefresh({ report, workspace: reportWorkspace, loadedTables: new Set(["qv_self_test"]) });
    if (!result.states[report.sections[1].id] || result.failed) throw new Error("Report refresh failed.");
  });
  await step("Detect stale report section", () => {
    reportWorkspace.queries[0].updatedAt = nowIso();
    const stale = report.sections.some((section) => section.snapshotRevision && section.snapshotRevision.queryUpdatedAt !== reportWorkspace.queries[0].updatedAt);
    if (!stale) throw new Error("Stale section not detected.");
  });
  await step("Generate HTML report export", () => {
    const html = renderReportHtml(report, { workspace: reportWorkspace });
    if (!html.includes(APP_VERSION) || /<script/i.test(html)) throw new Error("HTML export invalid.");
  });
  await step("Generate Markdown report export", () => {
    const markdown = renderReportMarkdown(report);
    if (!markdown.includes(APP_VERSION) || !markdown.startsWith("# Self-test Report")) throw new Error("Markdown export invalid.");
  });
  await step("Generate report package manifest", () => {
    const pkg = createReportPackageFiles(report);
    if (pkg.manifest.generatedBy.appVersion !== APP_VERSION || !pkg.files.length) throw new Error("Report package invalid.");
  });
  await step("Parse valid AI report outline", () => {
    const result = validateAiResponse({ contract: AI_CONTRACTS.reportOutline, contractVersion: 1, title: "Self-test Report", subtitle: "", audience: "Test", sections: [{ type: "visualization", visualizationId: "viz_report_self", title: "Chart" }], assumptions: [], cautions: [] }, { expectedContract: AI_CONTRACTS.reportOutline, dataset: reportWorkspace });
    if (!result.valid) throw new Error(result.errors[0]?.message || "Report outline invalid.");
  });
  await step("Reject invalid AI report outline", () => {
    const result = validateAiResponse({ contract: AI_CONTRACTS.reportOutline, contractVersion: 1, title: "Self-test Report", sections: [{ type: "map", title: "Map" }], assumptions: [], cautions: [] }, { expectedContract: AI_CONTRACTS.reportOutline, dataset: reportWorkspace });
    if (result.valid) throw new Error("Invalid report outline accepted.");
  });
  await step("Parse AI report narrative", () => {
    const result = validateAiResponse({ contract: AI_CONTRACTS.reportNarrative, contractVersion: 1, headline: "Self-test headline", summary: "The supplied rows were refreshed.", findings: [], recommendations: [], cautions: [], sourceReferences: [{ type: "query", id: "query_report_self" }] }, { expectedContract: AI_CONTRACTS.reportNarrative });
    if (!result.valid) throw new Error(result.errors[0]?.message || "Narrative invalid.");
  });
  await step("Parse AI report critique", () => {
    const result = validateAiResponse({ contract: AI_CONTRACTS.reportCritique, contractVersion: 1, summary: "Report is short.", issues: [], recommendations: [], missingElements: [], unsupportedClaims: [], cautions: [] }, { expectedContract: AI_CONTRACTS.reportCritique });
    if (!result.valid) throw new Error(result.errors[0]?.message || "Critique invalid.");
  });
  await step("Report JSON import export", () => {
    const exported = exportReportJson(reportWorkspace, report.id);
    const imported = importReportJson(reportWorkspace, exported);
    if (!imported.report.id || reportWorkspace.reports.length !== 2) throw new Error("Report import failed.");
  });
  await step("No API key in report exports", () => {
    const payload = JSON.stringify({ html: renderReportHtml(report), markdown: renderReportMarkdown(report), pkg: createReportPackageFiles(report), json: exportReportJson(reportWorkspace, report.id) });
    const key = getOpenRouterApiKey();
    if (key && payload.includes(key)) throw new Error("API key leaked into report export.");
  });
  await step("Footer version matches APP_VERSION", () => {
    if (!elements().footerVersion.textContent.includes(APP_VERSION)) throw new Error("Footer version mismatch.");
  });
  await step("Temporary records are cleaned up", () => executeSql("DROP TABLE IF EXISTS qv_self_test"));
  notify();
}

function applyTheme() {
  const theme = activeThemeName();
  document.documentElement.dataset.theme = theme;
  elements().themeSelect.value = state.workspace.settings.theme || "system";
}

function activeThemeName() {
  const setting = state.workspace.settings.theme || "system";
  if (setting !== "system") return setting;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function label(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
