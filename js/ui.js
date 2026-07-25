import { AI_CONTRACT_VERSION, APP_VERSION, BUILD_DATE, DEFAULT_SALES_SQL, DEPENDENCIES, IMPORT_FORMAT_LABELS, MAP_SPEC_VERSION, RELEASE_CHANNEL, SUPPORTED_IMPORT_FORMATS, VIZ_SPEC_VERSION, WORKSPACE_SCHEMA_VERSION } from "./constants.js";
import { AI_ACTIONS } from "./ai-contracts.js";
import { getDatabaseStatus } from "./db.js";
import { getDashboardRunnerStatus } from "./dashboard-runner.js";
import { getReportRunnerStatus } from "./report-runner.js";
import { REPORT_SECTION_TYPES } from "./report.js";
import { boundaryCatalog, getBoundaryStatus } from "./map-boundaries.js";
import { getMapRendererStatus } from "./map-renderer.js";
import { isMapSpec } from "./map-spec.js";
import { getRendererStatus } from "./viz-renderer.js";
import { chartTypes, defaultVisualizationSpec, validateVisualizationSpec } from "./viz-spec.js";
import { html, safeString, truncate } from "./utils.js";
import { HELP_TOPICS, KEYBOARD_SHORTCUTS, aboutMetadata, buildCommandItems, createOnboardingState, recentItems, searchCommandItems } from "./product.js";

const $ = (id) => document.getElementById(id);

export function elements() {
  return {
    themeSelect: $("themeSelect"),
    openCommandPalette: $("openCommandPalette"),
    openHelp: $("openHelp"),
    openAbout: $("openAbout"),
    workflowChecklist: $("workflowChecklist"),
    recentWork: $("recentWork"),
    loadSample: $("loadSample"),
    dataFileInput: $("dataFileInput"),
    dataDropZone: $("dataDropZone"),
    dataUrlInput: $("dataUrlInput"),
    dataUrlLoad: $("dataUrlLoad"),
    dataTableName: $("dataTableName"),
    dataFormatSelect: $("dataFormatSelect"),
    dataImportMode: $("dataImportMode"),
    dataReplaceMode: $("dataReplaceMode"),
    dataCsvHeader: $("dataCsvHeader"),
    dataImportConfirm: $("dataImportConfirm"),
    dataImportCancel: $("dataImportCancel"),
    dataImportStatus: $("dataImportStatus"),
    dataPreview: $("dataPreview"),
    sourceList: $("sourceList"),
    savedQueries: $("savedQueries"),
    savedVisualizations: $("savedVisualizations"),
    dataStatus: $("dataStatus"),
    schemaView: $("schemaView"),
    clearSql: $("clearSql"),
    copySql: $("copySql"),
    saveQuery: $("saveQuery"),
    runSql: $("runSql"),
    queryName: $("queryName"),
    starterQueries: $("starterQueries"),
    sqlEditor: $("sqlEditor"),
    queryRuntime: $("queryRuntime"),
    queryRows: $("queryRows"),
    queryError: $("queryError"),
    resultsTable: $("resultsTable"),
    vizStatus: $("vizStatus"),
    chart: $("chart"),
    copyDebug: $("copyDebug"),
    copyPerformanceReport: $("copyPerformanceReport"),
    exportSupportBundle: $("exportSupportBundle"),
    validateWorkspace: $("validateWorkspace"),
    resetWorkspace: $("resetWorkspace"),
    selfTest: $("selfTest"),
    debugReport: $("debugReport"),
    recoveryStatus: $("recoveryStatus"),
    selfTestResults: $("selfTestResults"),
    exportWorkspacePackage: $("exportWorkspacePackage"),
    exportStandaloneApp: $("exportStandaloneApp"),
    copyEmbedSnippet: $("copyEmbedSnippet"),
    exportTemplate: $("exportTemplate"),
    validateExtension: $("validateExtension"),
    packageInspection: $("packageInspection"),
    chartType: $("chartType"),
    xField: $("xField"),
    yField: $("yField"),
    mapBuilderControls: $("mapBuilderControls"),
    mapLatitudeField: $("mapLatitudeField"),
    mapLongitudeField: $("mapLongitudeField"),
    mapRegionField: $("mapRegionField"),
    mapValueField: $("mapValueField"),
    mapLabelField: $("mapLabelField"),
    mapColorField: $("mapColorField"),
    mapSizeField: $("mapSizeField"),
    mapBoundary: $("mapBoundary"),
    mapBasemap: $("mapBasemap"),
    mapCluster: $("mapCluster"),
    mapLegend: $("mapLegend"),
    exportMapPackage: $("exportMapPackage"),
    vizTitle: $("vizTitle"),
    smoothLine: $("smoothLine"),
    showPoints: $("showPoints"),
    zoom: $("zoom"),
    legend: $("legend"),
    saveViz: $("saveViz"),
    vizErrors: $("vizErrors"),
    copySpec: $("copySpec"),
    specStatus: $("specStatus"),
    specEditor: $("specEditor"),
    dashboardStatus: $("dashboardStatus"),
    dashboardSelect: $("dashboardSelect"),
    newDashboard: $("newDashboard"),
    renameDashboard: $("renameDashboard"),
    duplicateDashboard: $("duplicateDashboard"),
    deleteDashboard: $("deleteDashboard"),
    dashboardVizChooser: $("dashboardVizChooser"),
    addDashboardViz: $("addDashboardViz"),
    refreshDashboard: $("refreshDashboard"),
    refreshFailedCards: $("refreshFailedCards"),
    cancelDashboardRefresh: $("cancelDashboardRefresh"),
    addRegionFilter: $("addRegionFilter"),
    clearDashboardFilters: $("clearDashboardFilters"),
    exportDashboard: $("exportDashboard"),
    dashboardImportInput: $("dashboardImportInput"),
    snapshotDashboard: $("snapshotDashboard"),
    copyDeploymentInfo: $("copyDeploymentInfo"),
    interactionSourceCard: $("interactionSourceCard"),
    interactionSourceField: $("interactionSourceField"),
    interactionValue: $("interactionValue"),
    interactionAction: $("interactionAction"),
    addInteractionBinding: $("addInteractionBinding"),
    emitInteraction: $("emitInteraction"),
    clearInteractions: $("clearInteractions"),
    interactionStateBar: $("interactionStateBar"),
    dashboardFilterBar: $("dashboardFilterBar"),
    dashboardCanvas: $("dashboardCanvas"),
    reportStatus: $("reportStatus"),
    newReport: $("newReport"),
    renameReport: $("renameReport"),
    duplicateReport: $("duplicateReport"),
    deleteReport: $("deleteReport"),
    reportSelect: $("reportSelect"),
    reportSectionType: $("reportSectionType"),
    addReportSection: $("addReportSection"),
    reportOutline: $("reportOutline"),
    reportPreview: $("reportPreview"),
    reportSectionTitle: $("reportSectionTitle"),
    reportSectionNarrative: $("reportSectionNarrative"),
    reportSourceViz: $("reportSourceViz"),
    reportSourceQuery: $("reportSourceQuery"),
    reportSourceDashboard: $("reportSourceDashboard"),
    reportSqlVisible: $("reportSqlVisible"),
    reportTableLimit: $("reportTableLimit"),
    refreshReportSection: $("refreshReportSection"),
    refreshReport: $("refreshReport"),
    exportReportHtml: $("exportReportHtml"),
    exportReportMarkdown: $("exportReportMarkdown"),
    exportReportJson: $("exportReportJson"),
    reportImportInput: $("reportImportInput"),
    exportReportPackage: $("exportReportPackage"),
    printReport: $("printReport"),
    copyReportMetadata: $("copyReportMetadata"),
    footerVersion: $("footerVersion"),
    toastRegion: $("toastRegion"),
    welcomeDialog: $("welcomeDialog"),
    welcomeAddData: $("welcomeAddData"),
    welcomeFixture: $("welcomeFixture"),
    welcomePackage: $("welcomePackage"),
    welcomeDismiss: $("welcomeDismiss"),
    commandPalette: $("commandPalette"),
    commandInput: $("commandInput"),
    commandResults: $("commandResults"),
    helpDialog: $("helpDialog"),
    helpSearch: $("helpSearch"),
    helpTopicList: $("helpTopicList"),
    helpContent: $("helpContent"),
    closeHelp: $("closeHelp"),
    aboutDialog: $("aboutDialog"),
    aboutContent: $("aboutContent"),
    copyAboutInfo: $("copyAboutInfo"),
    closeAbout: $("closeAbout"),
    aiStatus: $("aiStatus"),
    aiEnabled: $("aiEnabled"),
    openRouterKey: $("openRouterKey"),
    refreshModels: $("refreshModels"),
    clearAiHistory: $("clearAiHistory"),
    aiModel: $("aiModel"),
    aiAction: $("aiAction"),
    aiTables: $("aiTables"),
    aiQuestion: $("aiQuestion"),
    aiContextMode: $("aiContextMode"),
    aiTemperature: $("aiTemperature"),
    aiMaxTokens: $("aiMaxTokens"),
    aiMaxSampleRows: $("aiMaxSampleRows"),
    aiMaxResultRows: $("aiMaxResultRows"),
    aiTimeout: $("aiTimeout"),
    aiSystemPrompt: $("aiSystemPrompt"),
    aiSharingNotice: $("aiSharingNotice"),
    aiContextPreview: $("aiContextPreview"),
    previewAiContext: $("previewAiContext"),
    runAi: $("runAi"),
    cancelAi: $("cancelAi"),
    aiProposals: $("aiProposals"),
    aiCurrentAnalysis: $("aiCurrentAnalysis"),
    aiHistory: $("aiHistory"),
  };
}

export function initializeStaticControls() {
  document.body.dataset.activeTab = "data";
  elements().chartType.innerHTML = chartTypes().map((type) => `<option value="${type}">${html(labelType(type))}</option>`).join("");
  elements().dataFormatSelect.innerHTML = ["auto", ...SUPPORTED_IMPORT_FORMATS].map((format) => `<option value="${format}">${html(IMPORT_FORMAT_LABELS[format] || format)}</option>`).join("");
  elements().mapBoundary.innerHTML = boundaryCatalog().map((boundary) => `<option value="${html(boundary.id)}">${html(boundary.label)}${boundary.unavailable ? " (not vendored)" : ""}</option>`).join("");
  elements().aiAction.innerHTML = AI_ACTIONS.map((action) => `<option value="${action.id}">${html(action.label)}</option>`).join("");
  elements().reportSectionType.innerHTML = REPORT_SECTION_TYPES.map((type) => `<option value="${type}">${html(type)}</option>`).join("");
  elements().footerVersion.textContent = `v${APP_VERSION} (${BUILD_DATE})`;
}

export function selectTab(name) {
  document.body.dataset.activeTab = name;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `${name}Tab`));
}

export function renderApp(state) {
  renderSources(state);
  renderImportWorkspace(state);
  renderProductShell(state);
  renderSavedQueries(state);
  renderSavedVisualizations(state);
  renderSchema(state);
  renderResult(state.currentResult);
  renderBuilder(state);
  renderSpec(state.currentSpec, state.currentResult);
  renderDashboard(state);
  renderReport(state);
  renderAi(state);
  renderDebug(state);
}

function renderProductShell(state) {
  const el = elements();
  const dismissedWelcome = localStorage.getItem("quackviz.onboarding.welcomeDismissed") === "true";
  const dismissedChecklist = localStorage.getItem("quackviz.onboarding.checklistDismissed") === "true";
  const onboarding = createOnboardingState({ workspace: state.workspace, welcomeDismissed: dismissedWelcome, checklistDismissed: dismissedChecklist });
  state.product.onboarding = onboarding;
  renderWorkflowChecklist(el.workflowChecklist, onboarding);
  renderRecentWork(el.recentWork, state.workspace);
  renderCommandPalette(state);
  renderHelp(state);
  renderAbout();
  renderToasts(el.toastRegion, state);
}

function renderWorkflowChecklist(container, onboarding) {
  if (onboarding.checklistDismissed) {
    container.innerHTML = "";
    return;
  }
  const completeCount = onboarding.steps.filter((step) => step.complete).length;
  container.innerHTML = `<div>
    <strong>Primary workflow</strong>
    <span>${completeCount}/${onboarding.steps.length} complete</span>
  </div>
  <ol>${onboarding.steps.map((step) => `<li class="${step.complete ? "complete" : ""}">
    <button data-product-action="workflow-step" data-tab="${html(step.tab)}">${step.complete ? "Done" : "Next"}: ${html(step.label)}</button>
  </li>`).join("")}</ol>
  <button class="link-button" data-product-action="dismiss-checklist">Hide checklist</button>`;
}

function renderRecentWork(container, workspace) {
  const items = recentItems(workspace, 6);
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">Recent data, queries, charts, dashboards, and reports appear here.</div>`;
    return;
  }
  container.innerHTML = items.map((item) => `<button class="object-item" data-product-action="open-recent" data-type="${html(item.type)}" data-id="${html(item.id)}">
    <strong>${html(item.name)}</strong>
    <small>${html(item.type)} · ${html(item.updatedAt || "not saved")}</small>
  </button>`).join("");
}

function renderCommandPalette(state) {
  const el = elements();
  const query = state.product.commandQuery || "";
  if (document.activeElement !== el.commandInput) el.commandInput.value = query;
  const results = searchCommandItems(buildCommandItems(state.workspace), query, 10);
  el.commandResults.innerHTML = results.length ? results.map((item) => `<button class="command-result" data-product-action="command-result" data-command-id="${html(item.id)}">
    <strong>${html(item.label)}</strong>
    <small>${html(item.type)}</small>
  </button>`).join("") : `<div class="empty-state">No matching commands or saved work.</div>`;
}

function renderHelp(state) {
  const el = elements();
  const query = String(el.helpSearch?.value || "").toLowerCase();
  const topics = HELP_TOPICS.filter((topic) => !query || topic.title.toLowerCase().includes(query) || topic.keywords.join(" ").toLowerCase().includes(query));
  const activeId = topics.some((topic) => topic.id === state.product.activeHelpTopicId)
    ? state.product.activeHelpTopicId
    : topics[0]?.id || "getting-started";
  el.helpTopicList.innerHTML = topics.map((topic) => `<button class="object-item${topic.id === activeId ? " active" : ""}" data-product-action="help-topic" data-topic-id="${html(topic.id)}">
    <strong>${html(topic.title)}</strong>
    <small>${html(topic.path)}</small>
  </button>`).join("");
  const active = HELP_TOPICS.find((topic) => topic.id === activeId) || HELP_TOPICS[0];
  el.helpContent.innerHTML = helpContent(active);
}

function renderAbout() {
  const meta = aboutMetadata();
  elements().aboutContent.innerHTML = `<dl class="metadata-list">
    <dt>Product</dt><dd>${html(meta.product)} ${html(meta.releaseChannel)}</dd>
    <dt>Version</dt><dd>${html(meta.appVersion)}</dd>
    <dt>Build date</dt><dd>${html(meta.buildDate)}</dd>
    <dt>Runtime</dt><dd>Static browser app using DuckDB-WASM, Apache ECharts, and MapLibre GL JS.</dd>
    <dt>Privacy</dt><dd>Workspaces are local. QuackViz does not send usage analytics or upload data automatically.</dd>
    <dt>License</dt><dd>See repository license and dependency license metadata.</dd>
  </dl>`;
}

function renderToasts(container, state) {
  const messages = [...state.errors.slice(0, 2).map((error) => ({ level: "error", message: `${error.source}: ${error.message}` })), ...state.statuses.slice(0, 2).map((status) => ({ level: "info", message: status.message }))];
  container.innerHTML = messages.map((item) => `<div class="toast ${html(item.level)}">${html(item.message)}</div>`).join("");
}

function renderSources(state) {
  const el = elements().sourceList;
  if (!state.workspace.dataSources.length) {
    el.innerHTML = `<div class="empty-state">No data sources loaded.</div>`;
    return;
  }
  el.innerHTML = state.workspace.dataSources.map((source) => {
    const active = source.id === state.workspace.active.dataSourceId ? " active" : "";
    const available = state.loadedTables.has(source.tableName);
    const format = source.fileType || "unknown";
    const sourceType = source.sourceType || "file";
    return `<button class="object-item${active}" data-action="select-source" data-id="${html(source.id)}">
      <strong>${html(source.name)}</strong>
      <small>${html(source.tableName)} · ${html(sourceType)} ${html(format)} · ${source.rowCount} rows · ${available ? "loaded" : "needs reload"}</small>
    </button>`;
  }).join("");
}

function renderImportWorkspace(state) {
  const el = elements();
  const dataImport = state.dataImport || {};
  if (document.activeElement !== el.dataTableName) el.dataTableName.value = dataImport.proposedTableName || "";
  if (document.activeElement !== el.dataFormatSelect) el.dataFormatSelect.value = dataImport.selectedFormat || "auto";
  if (document.activeElement !== el.dataImportMode) el.dataImportMode.value = dataImport.options?.mode || "standard";
  if (document.activeElement !== el.dataReplaceMode) el.dataReplaceMode.value = dataImport.options?.replace === false ? "unique" : "replace";
  el.dataCsvHeader.checked = dataImport.options?.header !== false;
  const selected = dataImport.source === "url" ? `URL: ${dataImport.url || ""}` : dataImport.pendingFiles?.length ? `Files: ${dataImport.pendingFiles.map((file) => file.name).join(", ")}` : "No file or URL selected.";
  const detected = dataImport.detectedFormat ? `Detected format: ${dataImport.detectedFormat}.` : "Detected format: -.";
  const status = dataImport.status || {};
  const message = status.message || status.stage || "Choose a local file, drop files, or prepare a URL.";
  const progress = status.progress == null ? "" : ` · ${Math.round(status.progress * 100)}%`;
  const warning = status.warning ? `<p class="warning-text">${html(status.warning)}</p>` : "";
  const error = status.error ? `<p class="error-text">${html(status.error)}</p>` : "";
  el.dataImportStatus.innerHTML = `<strong>${html(message)}</strong><p>${html(selected)} · ${html(detected)}${progress}</p>${warning}${error}`;
  el.dataImportConfirm.disabled = !dataImport.pendingFiles?.length && dataImport.source !== "url";
  renderStarterQueries(state);
}

function renderStarterQueries(state) {
  const active = state.workspace.dataSources.find((source) => source.id === state.workspace.active.dataSourceId);
  if (!active) {
    elements().starterQueries.innerHTML = `<div class="empty-state">Load data to see starter queries.</div>`;
    return;
  }
  elements().starterQueries.innerHTML = `<div class="button-row wrap">
    <button data-product-action="starter-query" data-starter="preview">Preview rows</button>
    <button data-product-action="starter-query" data-starter="count">Row count</button>
    <button data-product-action="starter-query" data-starter="nulls">Null counts</button>
    <button data-product-action="starter-query" data-starter="summaries">Numeric summaries</button>
  </div>`;
}

function renderSavedQueries(state) {
  const el = elements().savedQueries;
  if (!state.workspace.queries.length) {
    el.innerHTML = `<div class="empty-state">No saved queries.</div>`;
    return;
  }
  el.innerHTML = state.workspace.queries.map((query) => {
    const active = query.id === state.workspace.active.queryId ? " active" : "";
    return `<button class="object-item${active}" data-action="select-query" data-id="${html(query.id)}">
      <strong>${html(query.name)}</strong>
      <small>${html(truncate(query.sql, 70))}</small>
    </button>`;
  }).join("");
}

function renderSavedVisualizations(state) {
  const el = elements().savedVisualizations;
  if (!state.workspace.visualizations.length) {
    el.innerHTML = `<div class="empty-state">No saved visualizations.</div>`;
    return;
  }
  el.innerHTML = state.workspace.visualizations.map((viz) => {
    const active = viz.id === state.workspace.active.visualizationId ? " active" : "";
    return `<button class="object-item${active}" data-action="select-viz" data-id="${html(viz.id)}">
      <strong>${html(viz.name)}</strong>
      <small>${html(viz.spec?.type || "")} · ${html(viz.queryId)}</small>
    </button>`;
  }).join("");
}

function renderSchema(state) {
  const active = state.workspace.dataSources.find((source) => source.id === state.workspace.active.dataSourceId);
  elements().dataStatus.textContent = databaseLabel(state);
  if (!active) {
    elements().schemaView.innerHTML = `<div class="empty-state"><h3>Add your first dataset</h3><p>Load a local CSV, JSON, NDJSON, or Parquet file, or import a direct URL.</p><p>Your data stays in this browser unless you explicitly use an external AI action.</p></div>`;
    renderDataPreview(null);
    return;
  }
  const availability = state.loadedTables.has(active.tableName)
    ? `<p class="muted">DuckDB table is loaded for this page session.</p>`
    : `<p class="error-text">This saved data source is not loaded in DuckDB. Re-import the original file or URL to make the table available again. Browser security prevents QuackViz from keeping local file handles without explicit support.</p>`;
  elements().schemaView.innerHTML = `
    <article class="column-card">
      <h3>${html(active.tableName)}</h3>
      <p>${active.rowCount} rows · ${active.columns.length} columns · ${html(active.fileType || "unknown")} · ${formatBytes(active.fileSize)}</p>
      <p>${html(active.sourceType || "file")} ${active.fileName ? `· ${html(active.fileName)}` : ""}${active.sourceUrl ? `· ${html(active.sourceUrl)}` : ""}</p>
      <p>Imported ${html(active.importedAt || "unknown")}</p>
      ${availability}
      <div class="button-row wrap">
        <button data-action="open-source-sql" data-id="${html(active.id)}">Open in SQL</button>
        <button data-action="build-source-viz" data-id="${html(active.id)}">Build visualization</button>
      </div>
    </article>
    ${active.columns.map((column) => `<article class="column-card">
      <h3>${html(column.name)}</h3>
      <p>${html(column.duckType)} · nullable: ${column.nullable ? "yes" : "no"}</p>
    </article>`).join("")}`;
  renderDataPreview(active);
}

function renderDataPreview(source) {
  const preview = source?.sampleRows?.length ? { columns: source.columns, rows: source.sampleRows } : null;
  if (!preview) {
    elements().dataPreview.innerHTML = `<div class="empty-state">Import or inspect a source to preview the first 50 rows.</div>`;
    return;
  }
  elements().dataPreview.innerHTML = `<table>
    <caption>First ${preview.rows.length} rows from ${html(source.tableName)}</caption>
    <thead><tr>${preview.columns.map((column) => `<th>${html(column.name)}</th>`).join("")}</tr></thead>
    <tbody>${preview.rows.map((row) => `<tr>${preview.columns.map((column) => `<td>${html(safeString(row[column.name]))}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

function renderResult(result) {
  if (!result) {
    elements().queryRuntime.textContent = "Runtime: -";
    elements().queryRows.textContent = "Rows: -";
    elements().queryError.textContent = "";
    elements().resultsTable.innerHTML = "Run a query to see results.";
    return;
  }
  elements().queryRuntime.textContent = `Runtime: ${result.runtimeMs} ms`;
  elements().queryRows.textContent = `Rows: ${result.rowCount}`;
  elements().queryError.textContent = result.error?.message || "";
  if (result.error) {
    elements().resultsTable.innerHTML = `<div class="empty-state">SQL failed.</div>`;
    return;
  }
  if (!result.rows.length) {
    elements().resultsTable.innerHTML = `<div class="empty-state">Query returned no rows.</div>`;
    return;
  }
  elements().resultsTable.innerHTML = `<table>
    <thead><tr>${result.columns.map((column) => `<th>${html(column.name)}</th>`).join("")}</tr></thead>
    <tbody>${result.rows.slice(0, 500).map((row) => `<tr>${result.columns.map((column) => `<td>${html(safeString(row[column.name]))}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

function renderBuilder(state) {
  const el = elements();
  const result = state.currentResult && !state.currentResult.error ? state.currentResult : null;
  const columns = result?.columns || [];
  const options = columns.map((column) => `<option value="${html(column.name)}">${html(column.name)} · ${html(column.inferredType)}</option>`).join("");
  const optionalOptions = `<option value=""></option>${options}`;
  el.xField.innerHTML = options;
  el.yField.innerHTML = options;
  for (const select of [el.mapLatitudeField, el.mapLongitudeField, el.mapRegionField, el.mapValueField, el.mapLabelField, el.mapColorField, el.mapSizeField]) select.innerHTML = optionalOptions;
  if (!columns.length) {
    el.saveViz.disabled = true;
    return;
  }
  const spec = state.currentSpec || defaultVisualizationSpec({ queryId: state.workspace.active.queryId, columns });
  el.chartType.value = spec.type;
  el.mapBuilderControls.hidden = !isMapSpec(spec);
  el.xField.value = spec.encoding.x?.field || columns[0]?.name || "";
  el.yField.value = spec.encoding.y?.[0]?.field || columns.find((column) => column.inferredType === "number")?.name || "";
  el.mapLatitudeField.value = spec.encoding.latitude?.field || "";
  el.mapLongitudeField.value = spec.encoding.longitude?.field || "";
  el.mapRegionField.value = spec.encoding.region?.field || "";
  el.mapValueField.value = spec.encoding.value?.field || "";
  el.mapLabelField.value = spec.encoding.label?.field || "";
  el.mapColorField.value = spec.encoding.color?.field || "";
  el.mapSizeField.value = spec.encoding.size?.field || "";
  el.mapBoundary.value = spec.encoding.region?.boundary || "us-states";
  el.mapBasemap.value = spec.map?.style || "blank";
  el.mapCluster.checked = Boolean(spec.map?.cluster || spec.type === "map-clustered-point");
  el.mapLegend.checked = spec.map?.showLegend !== false;
  el.vizTitle.value = spec.title || "";
  el.smoothLine.checked = Boolean(spec.options?.smooth);
  el.showPoints.checked = Boolean(spec.options?.showPoints);
  el.zoom.checked = spec.options?.zoom !== false;
  el.legend.checked = Boolean(spec.options?.legend);
  el.saveViz.disabled = !state.workspace.active.queryId;
}

function renderSpec(spec, result) {
  const el = elements();
  if (!spec) {
    el.specEditor.value = "";
    el.vizErrors.textContent = "";
    el.specStatus.textContent = `Spec version ${VIZ_SPEC_VERSION}`;
    return;
  }
  const validation = validateVisualizationSpec(spec, result || { columns: [] });
  el.specEditor.value = JSON.stringify(validation.spec, null, 2);
  el.specStatus.textContent = validation.valid ? `Valid spec v${validation.spec.version}` : `Invalid spec v${validation.spec.version}`;
  el.vizErrors.innerHTML = validation.errors.map((error) => `<p>${html(error.path)}: ${html(error.message)}</p>`).join("");
}

function renderDebug(state) {
  const db = getDatabaseStatus();
  const renderer = getRendererStatus();
  const mapRenderer = getMapRendererStatus();
  const boundaryStatus = getBoundaryStatus();
  const dashboardRunner = getDashboardRunnerStatus();
  const reportRunner = getReportRunnerStatus();
  const activeDashboard = state.workspace.dashboards.find((dashboard) => dashboard.id === state.workspace.active.dashboardId);
  const activeReport = state.workspace.reports.find((report) => report.id === state.workspace.active.reportId);
  const report = {
    appVersion: APP_VERSION,
    buildDate: BUILD_DATE,
    workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION,
    visualizationSpecVersion: VIZ_SPEC_VERSION,
    dependencies: {
      duckdbWasmPackageVersion: DEPENDENCIES.duckdbWasm.version,
      duckdbWasmUrl: DEPENDENCIES.duckdbWasm.url,
      echartsPackageVersion: DEPENDENCIES.echarts.version,
      echartsUrl: DEPENDENCIES.echarts.url,
      maplibrePackageVersion: DEPENDENCIES.maplibre.version,
      maplibreUrl: DEPENDENCIES.maplibre.url,
      maplibreCssUrl: DEPENDENCIES.maplibre.cssUrl,
    },
    runtime: {
      duckdbVersion: db.runtimeVersion,
      selectedDuckdbBundle: db.selectedBundle,
      connection: db.connection,
      echartsVersion: renderer.echartsRuntimeVersion,
      maplibreVersion: mapRenderer.maplibreRuntimeVersion,
      indexedDb: state.storageStatus.indexedDb,
      echartsInstanceCount: renderer.instanceCount,
      mapInstanceCount: mapRenderer.instanceCount,
    },
    startup: {
      phase: state.startup.phase,
      durationMs: state.startup.durationMs,
      safeMode: state.startup.safeMode,
      capabilityStatus: state.startup.capabilities?.status || "unknown",
      missingRequiredCapabilities: state.startup.capabilities?.missingRequired || [],
      missingOptionalCapabilities: state.startup.capabilities?.missingOptional || [],
      vendoredDependencyStatus: state.startup.vendorStatus,
      vendorManifestVersion: state.startup.vendorStatus?.manifest?.formatVersion || null,
    },
    performance: state.performance.summary,
    workers: state.workers.status,
    recovery: {
      checkpointCount: state.recovery.checkpoints.length,
      lastCheckpoint: state.recovery.lastCheckpointAt,
      journalEntryCount: state.recovery.journal.length,
      lastMigration: state.packaging.lastMigration,
      workspaceValidationStatus: state.recovery.workspaceValidation?.valid === true ? "valid" : state.recovery.workspaceValidation ? "invalid" : "unknown",
      recoveryStatus: state.recovery.status,
      lastSupportBundleExport: state.recovery.lastSupportBundleAt,
    },
    workspace: {
      id: state.workspace.id,
      dataSourceCount: state.workspace.dataSources.length,
      savedQueryCount: state.workspace.queries.length,
      savedVisualizationCount: state.workspace.visualizations.length,
      dashboardCount: state.workspace.dashboards.length,
      reportCount: state.workspace.reports.length,
      activeDashboardId: state.workspace.active.dashboardId,
      activeReportId: state.workspace.active.reportId,
      activeDashboardCardCount: activeDashboard?.layout.length || 0,
      activeReportSectionCount: activeReport?.sections.length || 0,
      active: state.workspace.active,
    },
    dashboard: {
      activeFilterCount: activeDashboard?.filters.filter((filter) => filter.enabled !== false).length || 0,
      lastRefreshDuration: dashboardRunner.durationMs,
      successfulCardCount: dashboardRunner.successful,
      failedCardCount: dashboardRunner.failed,
      cancelledCardCount: dashboardRunner.cancelled,
      queryConcurrencyLimit: dashboardRunner.concurrencyLimit,
      resultCacheEntryCount: dashboardRunner.cacheEntries,
      lastDashboardExportTime: state.dashboard.lastExportAt,
      lastSnapshotExportTime: state.dashboard.lastSnapshotAt,
      lastDashboardError: state.dashboard.lastError,
    },
    report: {
      reportSchemaVersion: 1,
      sectionCount: activeReport?.sections.length || 0,
      dynamicSectionCount: activeReport?.sections.filter((section) => ["visualization", "dashboard-snapshot", "query-table", "kpi", "data-source-summary"].includes(section.type)).length || 0,
      staleSectionCount: Object.values(state.report.sectionStates).filter((section) => section.status === "stale").length,
      brokenSectionCount: Object.values(state.report.sectionStates).filter((section) => ["error", "unavailable"].includes(section.status)).length,
      lastReportRefreshDuration: reportRunner.durationMs,
      lastHtmlExportTime: state.report.lastHtmlExportAt,
      lastMarkdownExportTime: state.report.lastMarkdownExportAt,
      lastZipExportTime: state.report.lastPackageExportAt,
      lastPrintAction: state.report.lastPrintAt,
      lastReportError: state.report.lastError,
      footerVersion: elements().footerVersion.textContent,
      buildDate: BUILD_DATE,
    },
    maps: {
      mapSpecVersion: MAP_SPEC_VERSION,
      activeMapVisualizationId: isMapSpec(state.currentSpec) ? state.workspace.active.visualizationId : null,
      currentBasemap: isMapSpec(state.currentSpec) ? state.currentSpec.map?.style || "blank" : null,
      boundaryCatalogCount: boundaryStatus.catalogCount,
      loadedBoundaryCount: boundaryStatus.loadedBoundaryCount,
      lastBoundaryId: boundaryStatus.boundaryId,
      lastBoundaryLoadDuration: boundaryStatus.durationMs,
      lastCoordinateProfile: state.map.lastCoordinateProfile,
      validPointCount: state.map.lastDiagnostics?.validFeatureCount ?? null,
      invalidPointCount: state.map.lastDiagnostics?.invalidCoordinateCount ?? null,
      regionMatchRate: state.map.lastDiagnostics?.regionMatch?.matchRate ?? null,
      unmatchedRegionCount: state.map.lastDiagnostics?.regionMatch?.unmatchedDataRegions ?? null,
      lastMapRenderDuration: mapRenderer.lastRenderDuration,
      lastMapExportTime: mapRenderer.lastExportAt || state.map.lastExportAt,
      lastAiMapAction: state.ai.lastDiagnostics?.action?.includes("map") ? state.ai.lastDiagnostics.action : null,
      lastAiMapProposalCount: state.ai.lastDiagnostics?.mapProposalCount || 0,
      lastMapError: state.map.lastError || mapRenderer.error,
      footerVersion: elements().footerVersion.textContent,
      buildDate: BUILD_DATE,
    },
    interactions: {
      activeInteractionCount: activeDashboard?.interactions?.state?.activeSelections?.length || 0,
      activeFilterInteractionCount: activeDashboard?.interactions?.state?.activeFilters?.length || 0,
      activeHighlightCount: activeDashboard?.interactions?.state?.activeHighlights?.length || 0,
      activeParameterCount: Object.keys(activeDashboard?.interactions?.state?.activeParameters || {}).length,
      currentDrillDepth: activeDashboard?.interactions?.state?.drillPath?.length || 0,
      interactionBindingCount: activeDashboard?.interactions?.bindings?.length || 0,
      lastInteractionType: state.interaction.lastEvent?.selection?.kind || null,
      lastSourceCard: state.interaction.lastEvent?.source?.cardId || null,
      lastAffectedCardCount: state.interaction.lastResolution?.affectedCardIds?.length || 0,
      lastSkippedCardCount: state.interaction.lastResolution?.skippedTargets?.length || 0,
      lastPropagationDepth: state.interaction.lastEvent?.lineage?.length || 0,
      lastLoopPreventionEvent: state.interaction.lastLoopPreventionEvent,
      lastInteractionToRenderDuration: state.interaction.lastDurationMs,
      cardsRequeried: state.interaction.cardsRequeried,
      cardsHighlighted: state.interaction.cardsHighlighted,
      eventSubscriptionCount: state.interaction.subscriptionCount || 0,
      lastAiInteractionAction: ["suggest-interactions", "suggest-drilldowns", "suggest-parameters", "critique-interactions", "repair-binding"].includes(state.ai.lastDiagnostics?.action) ? state.ai.lastDiagnostics.action : null,
      lastAiInteractionProposalCount: state.ai.lastDiagnostics?.interactionProposalCount || 0,
      lastInteractionError: state.interaction.lastError,
      footerVersion: elements().footerVersion.textContent,
      buildDate: BUILD_DATE,
    },
    packages: {
      packageFormatVersion: 1,
      lastPackageMode: state.packaging.lastMode,
      lastDataMode: state.packaging.lastDataMode,
      lastPackageSize: state.packaging.lastPackageSize,
      lastRuntimeSize: state.packaging.lastRuntimeSize,
      lastDataSize: state.packaging.lastDataSize,
      lastBoundarySize: state.packaging.lastBoundarySize,
      lastPackageArtifactCount: state.packaging.lastArtifactCount,
      lastPackageTableCount: state.packaging.lastTableCount,
      lastPackageHashCount: state.packaging.lastHashCount,
      lastIntegrityResult: state.packaging.lastIntegrityResult,
      lastPackageExportTime: state.packaging.lastExportAt,
      lastPackageImportTime: state.packaging.lastImportAt,
      lastPackageMigration: state.packaging.lastMigration,
      installedExtensionCount: state.packaging.installedExtensionCount,
      enabledExtensionCount: state.packaging.enabledExtensionCount,
      templateCount: state.packaging.templateCount,
      lastTemplateApplied: state.packaging.lastTemplateApplied,
      lastStandaloneRuntimeTest: state.packaging.lastStandaloneRuntimeTest,
      lastEmbedMessage: state.packaging.lastEmbedMessage,
      lastPackagingError: state.packaging.lastError,
      footerVersion: elements().footerVersion.textContent,
      buildDate: BUILD_DATE,
    },
    lastQueryRuntime: state.currentResult?.runtimeMs ?? null,
    lastError: state.errors[0] || null,
    ai: {
      enabled: Boolean(state.workspace.settings.ai?.enabled),
      provider: "openrouter",
      selectedModel: state.workspace.settings.ai?.model,
      modelListLastRefreshed: state.ai.modelListRefreshedAt,
      interactionCount: state.workspace.aiHistory?.length || 0,
      lastAction: state.ai.lastDiagnostics?.action || null,
      lastDuration: state.ai.lastDiagnostics?.durationMs || null,
      lastHttpStatus: state.ai.lastDiagnostics?.httpStatus || null,
      lastContractVersion: state.ai.lastDiagnostics?.contractVersion || null,
      lastProposalCount: state.ai.lastDiagnostics?.proposalCount || 0,
      lastParseError: state.ai.lastParseError,
      lastSqlSafetyError: state.ai.lastSqlSafetyError,
      lastRepairAttemptCount: state.ai.lastRepairAttemptCount,
      sampleRowMode: state.workspace.settings.ai?.contextMode,
      sensitiveColumnsExcluded: state.ai.contextWarnings,
      apiKeyConfigured: state.ai.apiKeyConfigured ? "yes" : "no",
    },
  };
  elements().debugReport.textContent = JSON.stringify(report, null, 2);
  elements().recoveryStatus.textContent = `Startup: ${report.startup.phase || "unknown"} · Capabilities: ${report.startup.capabilityStatus} · Workspace validation: ${report.recovery.workspaceValidationStatus} · Checkpoints: ${report.recovery.checkpointCount}`;
}

function labelType(type) {
  return {
    line: "Line",
    bar: "Vertical bar",
    "map-point": "Point map",
    "map-clustered-point": "Clustered point map",
    "map-proportional-symbol": "Proportional symbol map",
    "map-category-point": "Category-colored point map",
    "map-choropleth": "Choropleth map",
    "map-region-symbol": "Region-symbol map",
  }[type] || type;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "size unknown";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function helpContent(topic) {
  const commonFooter = `<p><a href="${html(topic.path)}" target="_blank" rel="noreferrer">Open local documentation file</a></p>`;
  const content = {
    "getting-started": `<h3>Getting started</h3><p>Use the main workflow: add data, inspect columns, run SQL, build a chart, then save it for dashboards or reports.</p>`,
    "importing-data": `<h3>Importing data</h3><p>Choose or drop CSV, JSON, NDJSON/JSONL, or Parquet files. URL imports are explicit and depend on the remote server allowing browser CORS access.</p>`,
    sql: `<h3>Writing SQL</h3><p>QuackViz runs DuckDB SQL locally. Use starter queries for row counts, previews, summaries, and date ranges.</p>`,
    visualizations: `<h3>Building charts</h3><p>Run a query first, then choose chart settings. Save the visualization before adding it to dashboards or reports.</p>`,
    dashboards: `<h3>Dashboards</h3><p>Dashboards combine saved visualizations. Linked filtering applies only when compatible fields or parameters exist.</p>`,
    reports: `<h3>Reports</h3><p>Reports contain editable sections and snapshots. Refresh dynamic sections before exporting when source data changes.</p>`,
    maps: `<h3>Maps</h3><p>Maps use coordinates or matched regions. Remote basemaps make tile requests, but imported data is not sent to tile providers.</p>`,
    "ai-privacy": `<h3>AI and privacy</h3><p>AI is optional. Metadata-only context is the default. Raw sample rows require explicit opt-in, and generated SQL is never executed silently.</p>`,
    packages: `<h3>Export and backup</h3><p>Use backup and standalone exports to move local analytical work. Packages never include OpenRouter API keys.</p>`,
    recovery: `<h3>Recovery</h3><p>Use More for validation, checkpoints, safe mode, and support bundles. Safe mode does not delete workspace data.</p>`,
    shortcuts: `<h3>Keyboard shortcuts</h3><ul>${KEYBOARD_SHORTCUTS.map((shortcut) => `<li><strong>${html(shortcut.keys)}</strong> - ${html(shortcut.action)}</li>`).join("")}</ul>`,
    troubleshooting: `<h3>Troubleshooting</h3><p id="beta-limitations">Beta limitations: browser memory limits apply, local files may need re-import after reload, URL import depends on CORS, AI requires OpenRouter, and Firefox/WebKit behavior may differ.</p>`,
    limitations: `<h3>Beta limitations</h3><p>Local files may need re-import, large files may require reduced modes, remote basemaps require network access, and server-backed sharing is not implemented.</p>`,
  }[topic.id] || `<h3>${html(topic.title)}</h3><p>See the local documentation for this topic.</p>`;
  return `${content}${commonFooter}`;
}

function renderReport(state) {
  const el = elements();
  const reports = state.workspace.reports || [];
  const active = reports.find((report) => report.id === state.workspace.active.reportId) || reports[0];
  el.reportSelect.innerHTML = reports.map((report) => `<option value="${html(report.id)}">${html(report.name)}</option>`).join("");
  if (active) el.reportSelect.value = active.id;
  el.reportSourceViz.innerHTML = `<option value=""></option>${state.workspace.visualizations.map((viz) => `<option value="${html(viz.id)}">${html(viz.name)}</option>`).join("")}`;
  el.reportSourceQuery.innerHTML = `<option value=""></option>${state.workspace.queries.map((query) => `<option value="${html(query.id)}">${html(query.name)}</option>`).join("")}`;
  el.reportSourceDashboard.innerHTML = `<option value=""></option>${state.workspace.dashboards.map((dashboard) => `<option value="${html(dashboard.id)}">${html(dashboard.name)}</option>`).join("")}`;
  if (!active) {
    el.reportStatus.textContent = "No report selected.";
    el.reportOutline.innerHTML = `<div class="empty-state">Create a report.</div>`;
    el.reportPreview.innerHTML = `<div class="empty-state">Create a report to preview sections.</div>`;
    return;
  }
  el.reportStatus.textContent = `${active.title} · ${active.sections.length} sections`;
  const orderedSections = [...active.sections].sort((a, b) => a.position - b.position);
  el.reportOutline.innerHTML = orderedSections.map((section) => `<article class="object-item${section.id === state.report.selectedSectionId ? " active" : ""}">
    <button class="link-button report-outline-select" data-report-action="select-section" data-section-id="${html(section.id)}">
      <strong>${html(section.visible ? "" : "Hidden · ")}${html(section.title)}</strong>
      <small>${html(section.type)} · ${html(state.report.sectionStates[section.id]?.status || "idle")}</small>
    </button>
    <div class="inline-actions">
      <button data-report-action="move-section-top" data-section-id="${html(section.id)}">Top</button>
      <button data-report-action="move-section-up" data-section-id="${html(section.id)}">Up</button>
      <button data-report-action="move-section-down" data-section-id="${html(section.id)}">Down</button>
      <button data-report-action="move-section-bottom" data-section-id="${html(section.id)}">Bottom</button>
      <button data-report-action="toggle-section-visible" data-section-id="${html(section.id)}">${html(section.visible ? "Hide" : "Show")}</button>
      <button data-report-action="duplicate-section" data-section-id="${html(section.id)}">Duplicate</button>
      <button data-report-action="remove-section" data-section-id="${html(section.id)}">Remove</button>
    </div>
  </article>`).join("") || `<div class="empty-state">No sections.</div>`;
  el.reportPreview.innerHTML = `<section class="report-section cover"><h1>${html(active.title)}</h1><p>${html(active.subtitle)}</p></section>${orderedSections.map((section) => renderReportSection(section, state)).join("")}`;
  const selected = active.sections.find((section) => section.id === state.report.selectedSectionId) || active.sections[0];
  if (selected) {
    el.reportSectionTitle.value = selected.title;
    el.reportSectionNarrative.value = selected.content.narrative || selected.content.markdown || "";
    el.reportSourceViz.value = selected.source.visualizationId || "";
    el.reportSourceQuery.value = selected.source.queryId || "";
    el.reportSourceDashboard.value = selected.source.dashboardId || "";
    el.reportSqlVisible.checked = Boolean(selected.content.sqlVisible);
    el.reportTableLimit.value = selected.content.table?.rowLimit || 25;
  }
}

function renderReportSection(section, state) {
  const status = state.report.sectionStates[section.id];
  const hidden = section.visible === false ? " hidden" : "";
  const body = section.snapshot?.imageDataUrl
    ? `<img src="${html(section.snapshot.imageDataUrl)}" alt="${html(section.title)}">`
    : section.snapshot?.rows?.length
      ? renderSnapshotTable(section)
      : `<p>${html(section.content.narrative || section.content.finding || section.content.markdown || "")}</p>`;
  return `<section class="report-section${hidden}" data-section-id="${html(section.id)}">
    <h2>${html(section.title)}</h2>
    <p class="muted">${html(section.type)} · ${html(status?.status || "idle")}${status?.error ? ` · ${html(status.error)}` : ""}</p>
    ${body}
    ${section.content.caption ? `<p>${html(section.content.caption)}</p>` : ""}
  </section>`;
}

function renderSnapshotTable(section) {
  const columns = section.snapshot.columns || [];
  return `<table><thead><tr>${columns.map((column) => `<th>${html(column.name)}</th>`).join("")}</tr></thead><tbody>${(section.snapshot.rows || []).map((row) => `<tr>${columns.map((column) => `<td>${html(row[column.name])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function renderDashboard(state) {
  const el = elements();
  const dashboards = state.workspace.dashboards || [];
  const active = dashboards.find((dashboard) => dashboard.id === state.workspace.active.dashboardId) || dashboards[0];
  el.dashboardSelect.innerHTML = dashboards.map((dashboard) => `<option value="${html(dashboard.id)}">${html(dashboard.name)}</option>`).join("");
  if (active) el.dashboardSelect.value = active.id;
  el.dashboardVizChooser.innerHTML = state.workspace.visualizations.map((viz) => {
    const query = state.workspace.queries.find((item) => item.id === viz.queryId);
    return `<option value="${html(viz.id)}">${html(viz.name)} · ${html(viz.spec?.type || "")} · ${html(query?.name || "missing query")}</option>`;
  }).join("");
  if (!active) {
    el.dashboardStatus.textContent = "No dashboard selected.";
    el.dashboardFilterBar.innerHTML = "";
    el.dashboardCanvas.innerHTML = `<div class="empty-state">Create a dashboard to add saved visualizations.</div>`;
    return;
  }
  el.interactionSourceCard.innerHTML = active.layout.map((card) => {
    const viz = state.workspace.visualizations.find((item) => item.id === card.visualizationId);
    return `<option value="${html(card.id)}">${html(viz?.name || card.id)}</option>`;
  }).join("");
  el.dashboardStatus.textContent = `${active.name} · ${active.layout.length} cards`;
  const interactionState = active.interactions?.state;
  el.interactionStateBar.innerHTML = interactionState?.activeSelections?.length
    ? [
      ...interactionState.activeFilters.map((filter) => `<span class="notice">Filtered: ${html(filter.field)} ${html(filter.operator)} ${html(Array.isArray(filter.value) ? filter.value.join(", ") : filter.value ?? "")}</span>`),
      ...interactionState.activeHighlights.map((item) => `<span class="notice">Highlighted: ${html(item.field)} ${html((item.values || []).join(", "))}</span>`),
      ...(state.interaction.lastResolution?.skippedTargets || []).map((item) => `<span class="notice">Skipped ${html(item.cardId)}: ${html(item.reason)}</span>`),
    ].join("")
    : `<span class="status">No active linked selections.</span>`;
  el.dashboardFilterBar.innerHTML = active.filters.length
    ? active.filters.map((filter) => `<span class="notice">${html(filter.name)} ${html(filter.operator)} ${html(Array.isArray(filter.value) ? filter.value.join(", ") : filter.value ?? "")}</span>`).join("")
    : `<span class="status">No shared filters. Dashboard filters apply only when a compatible result field exists.</span>`;
  el.dashboardCanvas.innerHTML = active.layout.map((card) => renderDashboardCard(card, state)).join("");
}

function renderDashboardCard(card, state) {
  const viz = state.workspace.visualizations.find((item) => item.id === card.visualizationId);
  const query = viz ? state.workspace.queries.find((item) => item.id === viz.queryId) : null;
  const cardState = state.dashboard.cardStates[card.id] || { status: "idle" };
  const broken = !viz || !query || ["error", "unavailable"].includes(cardState.status);
  const title = card.titleOverride || viz?.name || "Broken visualization";
  return `<article class="dashboard-card${broken ? " broken" : ""}" data-testid="dashboard-card" data-card-id="${html(card.id)}" style="grid-column: ${card.x + 1} / span ${card.width}; grid-row: span ${card.height};">
    <header>
      <div>
        <h3>${html(card.showTitle ? title : "")}</h3>
        <small>${html(cardState.status)}${cardState.cached ? " · cached" : ""}${cardState.error ? ` · ${cardState.error}` : ""}</small>
      </div>
      <div class="card-controls">
        <button data-dashboard-action="refresh-card" data-card-id="${html(card.id)}">Refresh</button>
        <button data-dashboard-action="view-sql" data-card-id="${html(card.id)}">SQL</button>
        <button data-dashboard-action="open-viz" data-card-id="${html(card.id)}">Open</button>
        <button data-dashboard-action="duplicate-card" data-card-id="${html(card.id)}">Duplicate</button>
        <button data-dashboard-action="remove-card" data-card-id="${html(card.id)}">Remove</button>
      </div>
    </header>
    <div id="dashboardChart_${html(card.id)}" class="dashboard-card-chart" data-testid="dashboard-card-chart" role="img" aria-label="${html(title)} chart">${chartPlaceholder(cardState)}</div>
    <footer>
      <span>Rows: ${html(cardState.rowCount ?? "-")} · Runtime: ${html(cardState.runtimeMs ?? "-")} ms</span>
      <span>Refreshed: ${html(cardState.refreshedAt || "never")}</span>
      <span class="card-controls">
        <button data-dashboard-action="move-left" data-card-id="${html(card.id)}">Left</button>
        <button data-dashboard-action="move-right" data-card-id="${html(card.id)}">Right</button>
        <button data-dashboard-action="move-up" data-card-id="${html(card.id)}">Up</button>
        <button data-dashboard-action="move-down" data-card-id="${html(card.id)}">Down</button>
        <button data-dashboard-action="wider" data-card-id="${html(card.id)}">W+</button>
        <button data-dashboard-action="narrower" data-card-id="${html(card.id)}">W-</button>
        <button data-dashboard-action="taller" data-card-id="${html(card.id)}">H+</button>
        <button data-dashboard-action="shorter" data-card-id="${html(card.id)}">H-</button>
      </span>
    </footer>
  </article>`;
}

function chartPlaceholder(cardState) {
  if (cardState.status === "ready") return "";
  if (cardState.status === "loading") return `<div class="empty-state">Loading...</div>`;
  if (cardState.error) return `<div class="empty-state">Broken: ${html(cardState.error)}</div>`;
  return `<div class="empty-state">Refresh this card to render.</div>`;
}

function renderAi(state) {
  const el = elements();
  const settings = state.workspace.settings.ai;
  el.aiStatus.textContent = settings.enabled ? `AI enabled · ${settings.model}` : "AI disabled.";
  if (document.activeElement !== el.aiModel) {
    const models = state.ai.modelList.length ? state.ai.modelList : [{ id: settings.model, name: settings.model, fallback: true }];
    el.aiModel.innerHTML = models.map((model) => `<option value="${html(model.id)}">${html(model.name || model.id)}${model.fallback ? " (fallback)" : ""}</option>`).join("");
    if (settings.model) el.aiModel.value = settings.model;
  }
  if (document.activeElement !== el.aiTables) {
    el.aiTables.innerHTML = state.workspace.dataSources.map((source) => `<option value="${html(source.tableName)}">${html(source.tableName)} · ${source.rowCount} rows</option>`).join("");
    for (const option of el.aiTables.options) option.selected = state.ai.selectedTables.includes(option.value);
  }
  el.aiEnabled.checked = Boolean(settings.enabled);
  el.openRouterKey.placeholder = state.ai.apiKeyConfigured ? "API key configured" : "Stored locally only";
  el.aiContextMode.value = settings.contextMode;
  el.aiTemperature.value = settings.temperature;
  el.aiMaxTokens.value = settings.maxOutputTokens;
  el.aiMaxSampleRows.value = settings.maxSampleRows;
  el.aiMaxResultRows.value = settings.maxResultRows;
  el.aiTimeout.value = settings.timeoutMs;
  el.aiSystemPrompt.value = settings.customSystemPrompt || "";
  el.aiContextPreview.textContent = state.ai.contextPreview || "Refresh context preview before sending.";
  el.aiSharingNotice.textContent = sharingNotice(state);
  renderAiProposals(state);
  renderAiCurrentAnalysis(state);
  renderAiHistory(state);
}

function sharingNotice(state) {
  const settings = state.workspace.settings.ai;
  const base = settings.contextMode === "sampleRows"
    ? `These sample rows will be sent to the selected external AI provider, limited to ${settings.maxSampleRows}.`
    : "By default QuackViz sends schema metadata, not full tables.";
  return [base, ...(state.ai.contextWarnings || [])].filter(Boolean).join(" ");
}

function renderAiProposals(state) {
  const el = elements().aiProposals;
  const proposals = state.ai.proposals || [];
  if (!proposals.length) {
    el.innerHTML = `<div class="empty-state">No active AI proposals.</div>`;
    return;
  }
  el.innerHTML = proposals.map((item) => {
    const p = item.proposal;
    return `<article class="proposal-card${item.rejected ? " rejected" : ""}">
      <h3>${html(p.title)}</h3>
      <p>${html(p.question)}</p>
      <p class="muted">${html(p.description)}</p>
      <small>${html(p.visualization?.type || "sql")} · ${html((p.sourceTables || []).join(", "))} · confidence ${Math.round(Number(p.confidence || 0) * 100)}%</small>
      <p>${item.valid ? "Validation: valid" : `Validation: ${html(item.errors.map((error) => error.message).join(" "))}`}</p>
      <div class="button-row wrap">
        <button data-ai-action="inspect" data-id="${html(item.id)}">Inspect</button>
        <button data-ai-action="validate" data-id="${html(item.id)}">Validate</button>
        <button data-ai-action="preview-data" data-id="${html(item.id)}">Preview data</button>
        <button data-ai-action="preview-chart" data-id="${html(item.id)}">Preview chart</button>
        <button data-ai-action="open-builder" data-id="${html(item.id)}">Open in builder</button>
        <button data-ai-action="save" data-id="${html(item.id)}">Save</button>
        <button data-ai-action="copy-sql" data-id="${html(item.id)}">Copy SQL</button>
        <button data-ai-action="copy-json" data-id="${html(item.id)}">Copy JSON</button>
        <button data-ai-action="reject" data-id="${html(item.id)}">Reject</button>
      </div>
    </article>`;
  }).join("");
}

function renderAiCurrentAnalysis(state) {
  const el = elements().aiCurrentAnalysis;
  const item = (state.ai.proposals || []).find((proposal) => proposal.id === state.ai.selectedProposalId);
  if (!item) {
    const current = state.ai.currentResult;
    if (current?.validation?.interactions || current?.validation?.critique) {
      el.innerHTML = `<h3>${html(current.action)}</h3>
        <p>${current.validation.valid ? "Validation: valid" : `Validation: ${html(current.validation.errors.map((error) => error.message).join(" "))}`}</p>
        <pre class="code-block">${html(JSON.stringify({
          contract: current.raw?.contract,
          contractVersion: current.raw?.contractVersion,
          summary: current.raw?.summary,
          bindings: current.raw?.bindings,
          drilldowns: current.raw?.drilldowns,
          parameters: current.raw?.parameters,
          issues: current.raw?.issues,
          recommendations: current.raw?.recommendations,
          cautions: current.raw?.cautions,
        }, null, 2))}</pre>`;
      return;
    }
    el.innerHTML = `<div class="empty-state">Inspect a proposal to see SQL, validation, EXPLAIN, preview, and chart status.</div>`;
    return;
  }
  const p = item.proposal;
  el.innerHTML = `<h3>${html(p.title)}</h3>
    <p>${html(p.reasoning?.whyThisQuestion || "")}</p>
    <p>${html(p.reasoning?.whyThisChart || "")}</p>
    <h3>SQL</h3><pre class="code-block">${html(p.sql)}</pre>
    <h3>Validation</h3><pre class="code-block">${html(JSON.stringify({ valid: item.valid, errors: item.errors, warnings: item.warnings, sqlSafety: item.sqlSafety }, null, 2))}</pre>
    <h3>EXPLAIN</h3><pre class="code-block">${html(item.explain?.plan || item.explain?.error || "Not run")}</pre>
    <h3>Preview</h3><pre class="code-block">${html(item.preview ? JSON.stringify({ rowCount: item.preview.result?.rowCount, columns: item.preview.result?.columns }, null, 2) : "Not run")}</pre>`;
}

function renderAiHistory(state) {
  const el = elements().aiHistory;
  const history = state.workspace.aiHistory || [];
  if (!history.length) {
    el.innerHTML = `<div class="empty-state">No AI history.</div>`;
    return;
  }
  el.innerHTML = history.map((item) => `<button class="object-item" data-ai-history-id="${html(item.id)}">
    <strong>${html(item.action)} · ${html(item.status)}</strong>
    <small>${html(item.model)} · ${html(item.timestamp)} · ${html(item.summary || "")}</small>
  </button>`).join("");
}

export function renderSelfTest(results) {
  elements().selfTestResults.innerHTML = results.map((item) => `<div class="${item.ok ? "test-pass" : "test-fail"}">${item.ok ? "PASS" : "FAIL"} · ${html(item.name)}${item.message ? ` · ${html(item.message)}` : ""}</div>`).join("");
}

function databaseLabel(state) {
  const db = getDatabaseStatus();
  if (db.initializing) return "DuckDB initializing...";
  if (db.connection === "failed") return `DuckDB failed: ${db.error}`;
  if (db.connection === "connected") return "DuckDB connected";
  return "DuckDB not connected";
}

export function getThemeTokens(themeName) {
  const style = getComputedStyle(document.documentElement);
  return {
    themeName,
    background: style.getPropertyValue("--panel").trim(),
    panel: style.getPropertyValue("--panel").trim(),
    text: style.getPropertyValue("--text").trim(),
    muted: style.getPropertyValue("--muted").trim(),
    border: style.getPropertyValue("--border").trim(),
    accent: style.getPropertyValue("--accent").trim(),
    grid: style.getPropertyValue("--grid").trim(),
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

export function seedDefaultSql() {
  elements().sqlEditor.value = DEFAULT_SALES_SQL;
  elements().queryName.value = "Monthly revenue";
}
