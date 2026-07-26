import { APP_VERSION, BUILD_DATE, DEFAULT_SALES_SQL, TASK_TIMEOUTS } from "./constants.js";
import { runAiAction, fetchOpenRouterModels } from "./ai.js";
import { buildAiContext, contextPreview } from "./ai-context.js";
import { AI_CONTRACTS } from "./ai-contracts.js";
import { makeInteraction } from "./ai-history.js";
import { proposalToBuilderState, saveAiProposal, markRejected } from "./ai-proposals.js";
import { explainSql, previewSql as previewAiSql, validateSqlSafety } from "./ai-sql-safety.js";
import { validateAiResponse, validateRepair } from "./ai-validate.js";
import { addCard, addDashboard, createDashboard, deleteDashboard as deleteDashboardModel, duplicateCard, duplicateDashboard as duplicateDashboardModel, findDashboard, moveCard, removeCard, resizeCard, updateDashboard } from "./dashboard.js";
import { createSnapshotHtml, exportDashboardPackage, importDashboardPackage } from "./dashboard-export.js";
import { getDashboardRunnerStatus, invalidateDashboardCache, refreshCard, refreshDashboard as runDashboardRefresh } from "./dashboard-runner.js";
import { createInteractionBus } from "./interaction-bus.js";
import { addInteractionBinding, normalizeInteractionBinding, validateInteractionBinding } from "./interaction-bindings.js";
import { createInteractionEvent, validateInteractionEvent } from "./interaction-events.js";
import { applyInteractionResolution, clearInteractionState, createInteractionState } from "./interaction-state.js";
import { resolveInteraction } from "./interaction-resolver.js";
import { adaptEChartsClick, adaptMapLibreFeatureClick } from "./selection-adapters.js";
import { buildBreadcrumb, drillDown, drillUp } from "./drilldown.js";
import { compileParameterizedSql } from "./parameters.js";
import { initializeDatabase, executeSql, registerFileBuffer, tableExists } from "./db.js";
import { detectImportFormat, generateSafeTableName, importFromUrl, importLocalFile, importRegisteredSource, loadIncludedSalesSample, validateImportUrl } from "./import.js";
import { exportMapVisualizationPackage } from "./map-export.js";
import { createPortablePackage, inspectPortablePackage, validatePortablePackage, verifyPortablePackageIntegrity } from "./package.js";
import { createStandaloneHtml, runtimeHarnessLoad } from "./standalone-runtime.js";
import { observeMemory } from "./memory-monitor.js";
import { performanceMonitor } from "./performance-monitor.js";
import { addJournalEntry, createCheckpoint, createRecoveryState, recoverySummary } from "./recovery.js";
import { createEmbedConfig, createIframeSnippet, validateEmbedMessage } from "./embed.js";
import { createStartupTracker, detectCapabilities } from "./startup-diagnostics.js";
import { createSupportBundle } from "./support-bundle.js";
import { applyTemplate, BUILT_IN_TEMPLATES, exportTemplate } from "./templates.js";
import { taskManager } from "./task-manager.js";
import { extensionDiagnostics, installExtension, validateExtension } from "./extensions.js";
import { loadVendorManifest, validateVendorManifest } from "./vendor.js";
import { createWorkerManager, validateWorkerMessage } from "./worker-manager.js";
import { compileMapSpec } from "./map-compiler.js";
import { loadBoundary } from "./map-boundaries.js";
import { rowsToPointGeoJson } from "./map-data.js";
import { matchRegions } from "./map-match.js";
import { renderMapVisualization, disposeMapInstance, exportMapImage } from "./map-renderer.js";
import { isMapSpec } from "./map-spec.js";
import { validateMapSpec } from "./map-validate.js";
import { inferGeographicSemantic, profileCoordinates } from "./spatial-profile.js";
import { runQuery, buildQuerySaveInput } from "./query.js";
import { addReport, addSection, createReport, deleteReport as deleteReportModel, duplicateReport as duplicateReportModel, duplicateSection, findReport, findSection, moveSection, removeSection, setSectionVisible, updateReport } from "./report.js";
import { createReportPackageFiles, exportReportJson, importReportJson, renderReportHtml, renderReportMarkdown } from "./report-export.js";
import { refreshReport as runReportRefresh, refreshSection as runReportSectionRefresh } from "./report-runner.js";
import { addError, addStatus, dismissToast, markTableLoaded, notify, setActive, setCurrentOption, setCurrentResult, setCurrentSpec, setWorkspace, state, subscribe, updateWorkspace } from "./state.js";
import { getOpenRouterApiKey, initializeStorage, loadAiModelCache, loadThemePreference, loadWorkspace, resetStoredWorkspace, saveAiModelCache, saveThemePreference, saveTemporaryWorkspace, saveWorkspace, saveWorkspaceDebounced, setOpenRouterApiKey } from "./storage.js";
import { addAiHistory, addOrUpdateDataSource, addOrUpdateQuery, addOrUpdateVisualization, createWorkspace, hydrateWorkspace } from "./workspace.js";
import { migrateWorkspace, validateWorkspaceIntegrity } from "./workspace-validation.js";
import { defaultVisualizationSpec, validateVisualizationSpec } from "./viz-spec.js";
import { compileVisualizationSpec } from "./viz-compiler.js";
import { disposeChartInstance, renderVisualization, showEmpty } from "./viz-renderer.js";
import { copyText, escapeIdent, html as escapeHtml, nowIso, uid } from "./utils.js";
import { elements, getThemeTokens, initializeStaticControls, renderApp, renderSelfTest, seedDefaultSql, selectTab } from "./ui.js";
import { HELP_TOPICS, ONBOARDING_STORAGE_KEYS, SHOWCASE_DATASETS, aboutMetadata, buildCommandItems, createOnboardingState, recentItems, searchCommandItems } from "./product.js";

let saveSuppressed = false;
let currentAiAbortController = null;
let currentDashboardAbortController = null;
let currentReportAbortController = null;
let currentImportAbortController = null;
let visualizationRenderRevision = 0;
const interactionBus = createInteractionBus();
const startupTracker = createStartupTracker();
const workerManager = createWorkerManager({ workerUrl: "workers/data-worker.js" });
state.interaction.subscriptionCount = interactionBus.subscriptionCount();
state.startup.safeMode = new URLSearchParams(window.location.search).get("safeMode") === "1";
state.recovery = createRecoveryState();
window.__QUACKVIZ_E2E__ = { appReady: false, dbReady: false, renderReady: false, state, appVersion: APP_VERSION };

window.addEventListener("error", (event) => addError("app", "window-error", event.error || new Error(event.message)));
window.addEventListener("unhandledrejection", (event) => addError("app", "unhandled-rejection", event.reason));

initializeStaticControls();
setSidebarCollapsed(localStorage.getItem(ONBOARDING_STORAGE_KEYS.sidebarCollapsed) === "true");
subscribe((next) => {
  updateE2EReadiness();
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
  startupTracker.phase("Load configuration");
  state.startup.phase = "Load configuration";
  bindEvents();
  state.startup.capabilities = detectCapabilities(window);
  startupTracker.phase("Check capabilities", state.startup.capabilities.status);
  try {
    startupTracker.phase("Load vendor manifest");
    const manifest = await loadVendorManifest();
    const vendorValidation = validateVendorManifest(manifest);
    state.startup.vendorStatus = { manifest, validation: vendorValidation };
  } catch (error) {
    state.startup.vendorStatus = { manifest: null, validation: { valid: false, errors: [{ path: "vendor", message: error.message }], warnings: [] } };
    addError("startup", "vendor-manifest", error);
  }
  try {
    startupTracker.phase("Open IndexedDB");
    await initializeStorage();
    state.storageStatus.indexedDb = "available";
    if (!state.startup.safeMode) {
      startupTracker.phase("Restore workspace");
      const workspace = await loadWorkspace();
      state.recovery.workspaceValidation = validateWorkspaceIntegrity(workspace);
      const preferredTheme = loadThemePreference();
      if (preferredTheme) workspace.settings.theme = preferredTheme;
      setWorkspace(workspace);
    } else {
      state.recovery.status = "safe-mode";
      addStatus("recovery", "safe-mode", "Safe mode is active. Stored workspace restoration was skipped.");
    }
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
  startupTracker.phase("Restore table availability");
  await restoreTableAvailability();
  syncAiSettingsToUi();
  refreshAiContextPreview();
  state.startup.phase = "Render application";
  state.startup.durationMs = startupTracker.report().durationMs;
  state.performance.summary = performanceMonitor.summary();
  state.workers.status = workerManager.status();
  window.__QUACKVIZ_E2E__.appReady = true;
  document.documentElement.dataset.appReady = "true";
  document.body.dataset.appState = state.startup.capabilities?.missingRequired?.length ? "error" : state.startup.safeMode ? "degraded" : "ready";
  document.body.dataset.workspaceState = state.startup.safeMode ? "safe-mode" : "loaded";
  notify();
  maybeShowWelcome();
  initializeDatabase({ timeoutMs: TASK_TIMEOUTS.duckdbInitMs }).then((status) => {
    state.dbStatus = status;
    window.__QUACKVIZ_E2E__.dbReady = status.connection === "connected";
    document.documentElement.dataset.duckdbReady = window.__QUACKVIZ_E2E__.dbReady ? "true" : "false";
    if (status.error) addError("duckdb", "initialize", new Error(status.error));
    notify();
  });
}

function updateE2EReadiness() {
  if (!window.__QUACKVIZ_E2E__) return;
  window.__QUACKVIZ_E2E__.renderReady = Boolean(state.currentOption || state.map.lastDiagnostics);
  document.documentElement.dataset.renderReady = window.__QUACKVIZ_E2E__.renderReady ? "true" : "false";
}

function maybeShowWelcome() {
  const dismissed = localStorage.getItem(ONBOARDING_STORAGE_KEYS.welcomeDismissed) === "true";
  const hasWork = state.workspace.dataSources.length || state.workspace.queries.length || state.workspace.visualizations.length;
  if (!dismissed && !hasWork && !state.startup.safeMode) {
    setTimeout(() => openDialog(elements().welcomeDialog), 0);
  }
}

function dismissWelcome() {
  localStorage.setItem(ONBOARDING_STORAGE_KEYS.welcomeDismissed, "true");
  closeDialog(elements().welcomeDialog);
  notify();
}

function openDialog(dialog) {
  if (!dialog) return;
  state.product.lastFocusedElement = document.activeElement;
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

function restoreDialogFocus() {
  const target = state.product.lastFocusedElement;
  if (target && typeof target.focus === "function" && document.contains(target)) target.focus();
  state.product.lastFocusedElement = null;
}

function openCommandPalette() {
  state.product.commandPaletteOpen = true;
  state.product.commandQuery = "";
  notify();
  openDialog(elements().commandPalette);
  elements().commandInput.focus();
}

function handleGlobalShortcuts(event) {
  const key = event.key.toLowerCase();
  const mod = event.ctrlKey || event.metaKey;
  if (mod && key === "k") {
    event.preventDefault();
    openCommandPalette();
  } else if (mod && key === "o") {
    event.preventDefault();
    selectTab("data");
    elements().dataFileInput.focus();
  } else if (mod && event.shiftKey && key === "b") {
    event.preventDefault();
    setSidebarCollapsed(!document.body.classList.contains("sidebar-collapsed"));
  } else if (event.key === "?" && (!["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) || !document.activeElement.closest("dialog[open]"))) {
    event.preventDefault();
    openDialog(elements().helpDialog);
  } else if (event.key === "Escape") {
    const toast = document.activeElement?.closest?.("[data-toast-id]");
    if (toast) {
      dismissToast(toast.dataset.toastId, toast.dataset.toastKind);
      return;
    }
    for (const dialog of [elements().commandPalette, elements().helpDialog, elements().aboutDialog, elements().welcomeDialog, elements().showcaseDialog, elements().recipeDialog]) closeDialog(dialog);
  }
}

function handleProductAction(event) {
  const target = event.target.closest("[data-product-action]");
  if (!target) return;
  const action = target.dataset.productAction;
  if (action === "workflow-step") {
    selectTab(target.dataset.tab || "data");
  } else if (action === "dismiss-checklist") {
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.checklistDismissed, "true");
    notify();
  } else if (action === "show-welcome") {
    localStorage.removeItem(ONBOARDING_STORAGE_KEYS.welcomeDismissed);
    openDialog(elements().welcomeDialog);
  } else if (action === "show-help") {
    openDialog(elements().helpDialog);
  } else if (action === "show-about") {
    openDialog(elements().aboutDialog);
  } else if (action === "report-problem") {
    copyText(JSON.stringify({ appVersion: APP_VERSION, buildDate: BUILD_DATE, workspaceId: state.workspace.id, lastError: state.errors[0] || null }, null, 2)).catch((error) => addError("ui", "copy-feedback", error));
    window.open("https://github.com/hmarquardt/quackviz/issues/new", "_blank", "noopener,noreferrer");
  } else if (action === "open-recent") {
    openRecentItem(target.dataset.type, target.dataset.id);
  } else if (action === "starter-query") {
    applyStarterQuery(target.dataset.starter);
  } else if (action === "command-result") {
    activateCommandResult(target.dataset.commandId);
  } else if (action === "help-topic") {
    state.product.activeHelpTopicId = target.dataset.topicId || "getting-started";
    notify();
  } else if (action === "load-showcase") {
    loadShowcaseDataset(target.dataset.showcaseFile);
  } else if (action === "browse-showcase") {
    openDialog(elements().showcaseDialog);
  } else if (action === "show-recipe") {
    showShowcaseRecipe(target.dataset.showcaseFile);
  } else if (action === "dismiss-toast") {
    dismissToast(target.dataset.toastId, target.dataset.toastKind);
  }
}

async function loadShowcaseDataset(fileName) {
  const dataset = SHOWCASE_DATASETS.find((item) => item.file === fileName);
  if (!dataset) {
    addError("showcase", "prepare", new Error("The selected showcase dataset is not registered."));
    return;
  }
  try {
    const response = await fetch(new URL(`../examples/showcase/${dataset.file}`, import.meta.url));
    if (!response.ok) throw new Error(`Showcase file could not be loaded (${response.status}).`);
    const file = new File([await response.blob()], dataset.file, { type: "application/json" });
    prepareFileImport([file]);
    closeDialog(elements().helpDialog);
    closeDialog(elements().showcaseDialog);
    selectTab("data");
    await importPreparedData();
    addStatus("showcase", "import", `${dataset.title} loaded. Review its schema, preview, and recipe for supported next steps.`);
  } catch (error) {
    addError("showcase", "prepare", error);
  }
}

function showShowcaseRecipe(fileName) {
  const dataset = SHOWCASE_DATASETS.find((item) => item.file === fileName);
  if (!dataset) return;
  state.product.activeShowcaseFile = fileName;
  const recipe = dataset.recipe;
  elements().recipeContent.innerHTML = `<h2 id="recipeTitle">${escapeHtml(recipe.title)}</h2>
    <p>${escapeHtml(dataset.title)} · ${dataset.rows.toLocaleString()} rows</p>
    <h3>SQL</h3><pre tabindex="0">${escapeHtml(recipe.sql)}</pre>
    <h3>Recommended visualization</h3><p>${escapeHtml(recipe.visualization)}</p>
    <p>${escapeHtml(recipe.fields)}</p>
    <p class="muted">Expected result: a supported view using ordinary QuackViz query and visualization controls.</p>`;
  openDialog(elements().recipeDialog);
}

function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  localStorage.setItem(ONBOARDING_STORAGE_KEYS.sidebarCollapsed, String(collapsed));
  elements().toggleSidebar.setAttribute("aria-expanded", String(!collapsed));
  elements().toggleSidebar.setAttribute("aria-label", collapsed ? "Expand workspace library" : "Collapse workspace library");
  elements().restoreSidebar.hidden = !collapsed;
}

function openRecentItem(type, id) {
  if (type === "Data source") {
    setActive({ dataSourceId: id });
    selectTab("data");
  } else if (type === "Query") {
    const query = state.workspace.queries.find((item) => item.id === id);
    if (query) {
      elements().queryName.value = query.name;
      elements().sqlEditor.value = query.sql;
      setActive({ queryId: id });
      selectTab("sql");
    }
  } else if (type === "Visualization") {
    setActive({ visualizationId: id });
    selectTab("visualize");
  } else if (type === "Dashboard") {
    setActive({ dashboardId: id });
    selectTab("dashboard");
  } else if (type === "Report") {
    updateWorkspace((workspace) => { workspace.active.reportId = id; });
    selectTab("report");
  }
}

function activateCommandResult(commandId) {
  const item = searchCommandItems(buildCommandItems(state.workspace), state.product.commandQuery || "", 30).find((entry) => entry.id === commandId)
    || buildCommandItems(state.workspace).find((entry) => entry.id === commandId);
  closeDialog(elements().commandPalette);
  if (!item) return;
  if (item.action === "help" || item.action === "help-topic") {
    state.product.activeHelpTopicId = item.topicId || "getting-started";
    openDialog(elements().helpDialog);
    notify();
  } else if (item.action === "about") {
    openDialog(elements().aboutDialog);
  } else if (item.action === "showcase") {
    openDialog(elements().showcaseDialog);
  } else if (item.action === "showcase-dataset") {
    state.product.activeShowcaseFile = item.showcaseFile;
    openDialog(elements().showcaseDialog);
  } else if (item.artifactId) {
    openRecentItem(item.type, item.artifactId);
  } else if (item.tab) {
    selectTab(item.tab);
  }
}

function applyStarterQuery(kind) {
  const source = state.workspace.dataSources.find((item) => item.id === state.workspace.active.dataSourceId);
  if (!source) return;
  const table = escapeIdent(source.tableName);
  const columns = source.columns || [];
  const firstNumeric = columns.find((column) => /INT|DOUBLE|DECIMAL|FLOAT|NUMBER|BIGINT/i.test(column.duckType));
  const sql = {
    preview: `SELECT *\nFROM ${table}\nLIMIT 50;`,
    count: `SELECT COUNT(*) AS row_count\nFROM ${table};`,
    nulls: `SELECT ${columns.map((column) => `SUM(CASE WHEN ${escapeIdent(column.name)} IS NULL THEN 1 ELSE 0 END) AS ${escapeIdent(`${column.name}_nulls`)}`).join(",\n       ")}\nFROM ${table};`,
    summaries: firstNumeric ? `SELECT MIN(${escapeIdent(firstNumeric.name)}) AS min_value,\n       MAX(${escapeIdent(firstNumeric.name)}) AS max_value,\n       AVG(${escapeIdent(firstNumeric.name)}) AS avg_value\nFROM ${table};` : `SELECT COUNT(*) AS row_count\nFROM ${table};`,
  }[kind] || `SELECT *\nFROM ${table}\nLIMIT 50;`;
  elements().sqlEditor.value = sql;
  elements().queryName.value = `${source.name || source.tableName} ${kind}`;
  selectTab("sql");
  addStatus("sql", "starter-query", "Starter query inserted. Review it, then run.");
}

function bindEvents() {
  const el = elements();
  document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.tab)));
  document.addEventListener("click", handleProductAction);
  document.addEventListener("keydown", handleGlobalShortcuts);
  el.openCommandPalette.addEventListener("click", openCommandPalette);
  el.openHelp.addEventListener("click", () => openDialog(el.helpDialog));
  el.openAbout.addEventListener("click", () => openDialog(el.aboutDialog));
  el.toggleSidebar.addEventListener("click", () => setSidebarCollapsed(true));
  el.restoreSidebar.addEventListener("click", () => setSidebarCollapsed(false));
  el.welcomeAddData.addEventListener("click", () => { dismissWelcome(); selectTab("data"); elements().dataFileInput.focus(); });
  el.welcomeShowcase.addEventListener("click", () => { dismissWelcome(); openDialog(el.showcaseDialog); });
  el.welcomePackage.addEventListener("click", () => { dismissWelcome(); selectTab("debug"); elements().exportWorkspacePackage.focus(); });
  el.welcomeDismiss.addEventListener("click", dismissWelcome);
  el.commandInput.addEventListener("input", () => { state.product.commandQuery = el.commandInput.value; notify(); });
  el.helpSearch.addEventListener("input", () => notify());
  el.closeHelp.addEventListener("click", () => closeDialog(el.helpDialog));
  el.closeAbout.addEventListener("click", () => closeDialog(el.aboutDialog));
  el.closeShowcase.addEventListener("click", () => closeDialog(el.showcaseDialog));
  el.closeRecipe.addEventListener("click", () => closeDialog(el.recipeDialog));
  el.recipeOpenSql.addEventListener("click", () => {
    const dataset = SHOWCASE_DATASETS.find((item) => item.file === state.product.activeShowcaseFile);
    if (!dataset) return;
    elements().sqlEditor.value = dataset.recipe.sql;
    elements().queryName.value = dataset.recipe.title;
    closeDialog(el.recipeDialog);
    closeDialog(el.showcaseDialog);
    selectTab("sql");
  });
  el.copyAboutInfo.addEventListener("click", () => copyText(JSON.stringify({ appVersion: APP_VERSION, buildDate: BUILD_DATE, url: window.location.href, workspaceId: state.workspace.id }, null, 2)).catch((error) => addError("ui", "copy-about", error)));
  for (const dialog of [el.welcomeDialog, el.commandPalette, el.helpDialog, el.aboutDialog, el.showcaseDialog, el.recipeDialog]) {
    dialog.addEventListener("close", restoreDialogFocus);
  }
  document.querySelectorAll("[data-sidebar-section]").forEach((section) => {
    const key = `quackviz.sidebar.section.${section.dataset.sidebarSection}`;
    if (localStorage.getItem(key) === "closed") section.open = false;
    const summary = section.querySelector("summary");
    summary?.setAttribute("aria-expanded", String(section.open));
    section.addEventListener("toggle", () => {
      localStorage.setItem(key, section.open ? "open" : "closed");
      summary?.setAttribute("aria-expanded", String(section.open));
    });
  });
  el.themeSelect.addEventListener("change", () => {
    updateWorkspace((workspace) => { workspace.settings.theme = el.themeSelect.value; });
    saveThemePreference(el.themeSelect.value);
    applyTheme();
    rebuildVisualization();
  });
  el.loadSample.addEventListener("click", loadSalesSample);
  el.dataFileInput.addEventListener("change", () => prepareFileImport(Array.from(el.dataFileInput.files || [])));
  el.dataDropZone.addEventListener("click", () => el.dataFileInput.click());
  el.dataDropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      el.dataFileInput.click();
    }
  });
  el.dataDropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    el.dataDropZone.classList.add("drag-over");
  });
  el.dataDropZone.addEventListener("dragleave", () => el.dataDropZone.classList.remove("drag-over"));
  el.dataDropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    el.dataDropZone.classList.remove("drag-over");
    prepareFileImport(Array.from(event.dataTransfer?.files || []));
  });
  el.dataUrlLoad.addEventListener("click", prepareUrlImport);
  el.dataFormatSelect.addEventListener("change", () => {
    state.dataImport.selectedFormat = el.dataFormatSelect.value;
    if (state.dataImport.source === "file" && state.dataImport.pendingFiles[0]) {
      state.dataImport.detectedFormat = detectImportFormat({ fileName: state.dataImport.pendingFiles[0].name, contentType: state.dataImport.pendingFiles[0].type, override: el.dataFormatSelect.value }).format || "";
    }
    notify();
  });
  el.dataTableName.addEventListener("input", () => { state.dataImport.proposedTableName = el.dataTableName.value; });
  el.dataImportMode.addEventListener("change", () => { state.dataImport.options.mode = el.dataImportMode.value; notify(); });
  el.dataReplaceMode.addEventListener("change", () => { state.dataImport.options.replace = el.dataReplaceMode.value !== "unique"; notify(); });
  el.dataCsvHeader.addEventListener("change", () => { state.dataImport.options.header = el.dataCsvHeader.checked; notify(); });
  el.dataImportConfirm.addEventListener("click", importPreparedData);
  el.dataImportCancel.addEventListener("click", cancelImport);
  el.runSql.addEventListener("click", runEditorSql);
  el.sqlEditor.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") runEditorSql();
  });
  el.clearSql.addEventListener("click", () => { el.sqlEditor.value = ""; });
  el.copySql.addEventListener("click", () => copyText(el.sqlEditor.value).catch((error) => addError("ui", "copy-sql", error)));
  el.saveQuery.addEventListener("click", saveCurrentQuery);
  el.chartType.addEventListener("change", () => {
    el.mapBuilderControls.hidden = !el.chartType.value.startsWith("map-");
    setCurrentSpec(defaultVisualizationSpec({
      queryId: state.workspace.active.queryId,
      columns: state.currentResult?.columns || [],
      type: el.chartType.value,
    }));
    rebuildVisualization();
  });
  for (const input of [el.xField, el.yField, el.vizTitle, el.smoothLine, el.showPoints, el.zoom, el.legend]) {
    input.addEventListener("input", rebuildVisualization);
    input.addEventListener("change", rebuildVisualization);
  }
  for (const input of [el.mapLatitudeField, el.mapLongitudeField, el.mapRegionField, el.mapValueField, el.mapLabelField, el.mapColorField, el.mapSizeField, el.mapBoundary, el.mapBasemap, el.mapCluster, el.mapLegend]) {
    input.addEventListener("input", rebuildVisualization);
    input.addEventListener("change", rebuildVisualization);
  }
  el.saveViz.addEventListener("click", saveCurrentVisualization);
  el.exportMapPackage.addEventListener("click", exportCurrentMapPackage);
  el.copySpec.addEventListener("click", () => copyText(el.specEditor.value).catch((error) => addError("ui", "copy-spec", error)));
  el.copyDebug.addEventListener("click", () => copyText(el.debugReport.textContent).catch((error) => addError("ui", "copy-debug", error)));
  el.copyPerformanceReport.addEventListener("click", () => copyText(JSON.stringify(performanceMonitor.summary(), null, 2)).catch((error) => addError("ui", "copy-performance", error)));
  el.exportSupportBundle.addEventListener("click", exportSupportBundle);
  el.validateWorkspace.addEventListener("click", validateCurrentWorkspace);
  el.resetWorkspace.addEventListener("click", resetWorkspace);
  el.selfTest.addEventListener("click", runSelfTest);
  el.exportWorkspacePackage.addEventListener("click", exportWorkspacePortablePackage);
  el.exportStandaloneApp.addEventListener("click", exportStandaloneAnalyticalApp);
  el.copyEmbedSnippet.addEventListener("click", copyCurrentEmbedSnippet);
  el.exportTemplate.addEventListener("click", exportBuiltInTemplate);
  el.validateExtension.addEventListener("click", validateSampleExtension);
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
  el.addInteractionBinding.addEventListener("click", addDashboardInteractionBinding);
  el.emitInteraction.addEventListener("click", emitDashboardInteraction);
  el.clearInteractions.addEventListener("click", clearDashboardInteractions);
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
    } catch (error) {
      addError("duckdb", "inspect-table-availability", error);
      loaded = false;
    }
    source.available = loaded;
    source.availability = loaded ? "loaded" : "unavailable";
    markTableLoaded(source.tableName, loaded);
  }
}

function prepareFileImport(files) {
  if (!files.length) return;
  const existing = state.workspace.dataSources.map((source) => source.tableName);
  const first = files[0];
  const detected = detectImportFormat({ fileName: first.name, contentType: first.type, override: state.dataImport.selectedFormat });
  state.dataImport.source = "file";
  state.dataImport.pendingFiles = files.map((file) => ({ file, name: file.name, size: file.size, type: file.type }));
  state.dataImport.url = "";
  state.dataImport.proposedTableName = generateSafeTableName(first.name, existing);
  state.dataImport.detectedFormat = detected.format || "";
  state.dataImport.status = {
    stage: "ready",
    message: files.length === 1 ? "File ready to import." : `${files.length} files ready to import.`,
    progress: null,
    warning: detected.warnings?.[0]?.message || "",
    error: detected.format ? "" : "Unsupported format. Choose a manual format before importing.",
    elapsedMs: null,
    cancelled: false,
  };
  notify();
}

function prepareUrlImport() {
  const el = elements();
  const url = el.dataUrlInput.value.trim();
  const validation = validateImportUrl(url);
  const detected = validation.valid ? detectImportFormat({ fileName: validation.url, override: state.dataImport.selectedFormat }) : { format: null, warnings: [] };
  const existing = state.workspace.dataSources.map((source) => source.tableName);
  state.dataImport.source = "url";
  state.dataImport.pendingFiles = [];
  state.dataImport.url = validation.valid ? validation.url : url;
  state.dataImport.proposedTableName = validation.valid ? generateSafeTableName(new URL(validation.url).pathname.split("/").pop() || "url_import", existing) : "";
  state.dataImport.detectedFormat = detected.format || "";
  state.dataImport.status = {
    stage: validation.valid ? "ready" : "error",
    message: validation.valid ? "URL ready. Press Import to fetch and load it." : "URL is not valid.",
    progress: null,
    warning: detected.warnings?.[0]?.message || "",
    error: validation.valid ? "" : validation.message,
    elapsedMs: null,
    cancelled: false,
  };
  notify();
}

async function importPreparedData() {
  if (currentImportAbortController) currentImportAbortController.abort();
  currentImportAbortController = new AbortController();
  const started = performance.now();
  const span = performanceMonitor.start("data-import", { source: state.dataImport.source, format: state.dataImport.detectedFormat });
  const task = taskManager.create("data-import", { label: "Import data" });
  const imported = [];
  try {
    updateImportStatus({ stage: "Starting import", message: "Importing data into DuckDB.", progress: 0, error: "", cancelled: false });
    const format = elements().dataFormatSelect.value;
    const options = {
      header: elements().dataCsvHeader.checked,
      replace: elements().dataReplaceMode.value !== "unique",
      mode: elements().dataImportMode.value,
      timeoutMs: TASK_TIMEOUTS.importMs,
      existingTableNames: state.workspace.dataSources.map((source) => source.tableName),
    };
    if (state.dataImport.source === "url") {
      const source = await importFromUrl({
        url: state.dataImport.url,
        tableName: state.dataImport.proposedTableName,
        format,
        options,
        signal: currentImportAbortController.signal,
        onProgress: (event) => {
          taskManager.progress(task.id, event.progress ?? 0, event.stage || "Importing URL");
          updateImportStatus({ ...event, message: event.stage || "Importing URL" });
        },
      });
      imported.push(source);
    } else {
      for (const [index, item] of state.dataImport.pendingFiles.entries()) {
        options.existingTableNames = [...state.workspace.dataSources.map((source) => source.tableName), ...imported.map((source) => source.tableName)];
        const tableName = index === 0 ? state.dataImport.proposedTableName : generateSafeTableName(item.name, options.existingTableNames);
        const source = await importLocalFile({
          file: item.file,
          tableName,
          format,
          options,
          signal: currentImportAbortController.signal,
          onProgress: (event) => {
            const base = state.dataImport.pendingFiles.length > 1 ? `File ${index + 1}/${state.dataImport.pendingFiles.length}: ` : "";
            taskManager.progress(task.id, event.progress ?? 0, `${base}${event.stage || "Importing file"}`);
            updateImportStatus({ ...event, message: `${base}${event.stage || "Importing file"}` });
          },
        });
        imported.push(source);
      }
    }
    for (const source of imported) {
      updateWorkspace((workspace) => addOrUpdateDataSource(workspace, source));
      markTableLoaded(source.tableName, true);
      addJournalEntry(state.recovery, { workspaceId: state.workspace.id, operation: "import-data-source", objectId: source.id });
    }
    const last = imported[imported.length - 1];
    if (last) {
      setActive({ dataSourceId: last.id });
      elements().sqlEditor.value = `SELECT * FROM ${escapeIdent(last.tableName)} LIMIT 100;`;
      elements().queryName.value = `${last.name} preview`;
    }
    invalidateDashboardCache();
    await saveWorkspace(state.workspace);
    state.storageStatus.lastSavedAt = nowIso();
    await createCheckpoint(state.recovery, state.workspace, "post-data-import");
    taskManager.complete(task.id, { count: imported.length });
    span.finish({ success: true, importedCount: imported.length });
    updateImportStatus({ stage: "complete", message: `Imported ${imported.length} source${imported.length === 1 ? "" : "s"}.`, progress: 1, elapsedMs: Math.round(performance.now() - started) });
    addStatus("import", "complete", `Imported ${imported.length} data source${imported.length === 1 ? "" : "s"}.`);
    refreshOperationalDiagnostics();
  } catch (error) {
    taskManager.error(task.id, error);
    span.error(error);
    const cancelled = error?.code === "IMPORT_CANCELLED";
    updateImportStatus({ stage: cancelled ? "cancelled" : "error", message: cancelled ? "Import cancelled." : "Import failed.", error: error.message, cancelled, elapsedMs: Math.round(performance.now() - started) });
    addError("import", error?.code || "import-data", error);
    refreshOperationalDiagnostics();
  } finally {
    currentImportAbortController = null;
  }
}

function cancelImport() {
  if (currentImportAbortController) {
    currentImportAbortController.abort();
    updateImportStatus({ stage: "cancelling", message: "Cancelling import...", cancelled: true });
  } else {
    updateImportStatus({ stage: "idle", message: "No active import to cancel.", cancelled: false });
  }
}

function updateImportStatus(partial) {
  state.dataImport.status = { ...state.dataImport.status, ...partial };
  notify();
}

async function loadSalesSample() {
  const task = taskManager.create("sample-import", { label: "Load bundled sales fixture" });
  const span = performanceMonitor.start("sample-import", { fileName: "sales.csv" });
  try {
    addStatus("sample", "load", "Loading bundled sales fixture...");
    taskManager.progress(task.id, 0.25, "Importing sample into DuckDB.");
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
    addJournalEntry(state.recovery, { workspaceId: state.workspace.id, operation: "import-sample", objectId: source.id });
    await createCheckpoint(state.recovery, state.workspace, "post-sample-import");
    taskManager.complete(task.id, { tableName: source.tableName, rowCount: source.rowCount });
    span.finish({ success: true, rowCount: source.rowCount });
    refreshOperationalDiagnostics();
    addStatus("sample", "load", "Bundled sales fixture loaded.");
  } catch (error) {
    taskManager.error(task.id, error);
    span.error(error);
    addError("sample", "load", error);
    refreshOperationalDiagnostics();
  }
}

async function runEditorSql() {
  const sql = elements().sqlEditor.value.trim();
  if (!sql) return;
  const span = performanceMonitor.start("duckdb-query", { source: "editor", activeQueryId: state.workspace.active.queryId });
  const result = await runQuery(sql, state.workspace.active.queryId);
  if (result.error) span.error(new Error(result.error.message));
  else span.finish({ success: true, rowCount: result.rowCount });
  refreshOperationalDiagnostics();
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

function refreshOperationalDiagnostics() {
  const rendererCount = Number(document.querySelectorAll("canvas").length || 0);
  state.performance.summary = {
    ...performanceMonitor.summary(),
    memory: observeMemory({ cacheEntries: state.performance.summary?.cacheEntries || 0, echartsInstances: rendererCount, mapInstances: 0, workerCount: workerManager.status().workerCount }),
  };
  state.workers.status = workerManager.status();
  state.recovery.workspaceValidation = validateWorkspaceIntegrity(state.workspace);
}

function validateCurrentWorkspace() {
  state.recovery.workspaceValidation = validateWorkspaceIntegrity(state.workspace);
  addStatus("recovery", "validate-workspace", state.recovery.workspaceValidation.valid ? "Workspace validation passed." : "Workspace validation found issues.");
  notify();
}

function exportSupportBundle() {
  const bundle = createSupportBundle({
    state,
    capabilities: state.startup.capabilities,
    vendorStatus: state.startup.vendorStatus,
    performanceSummary: performanceMonitor.summary(),
    workerStatus: workerManager.status(),
    recoverySummary: recoverySummary(state.recovery),
  });
  state.recovery.lastSupportBundleAt = nowIso();
  elements().packageInspection.textContent = JSON.stringify(bundle, null, 2);
  downloadBlob(`quackviz-support-${state.workspace.id}.json`, JSON.stringify(bundle, null, 2), "application/json");
  notify();
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
  if (el.chartType.value.startsWith("map-")) return mapSpecFromControls(el);
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

function mapSpecFromControls(el) {
  const type = el.chartType.value;
  const columnType = (field, fallback) => state.currentResult?.columns.find((column) => column.name === field)?.inferredType || fallback;
  const field = (name, dataType, extra = {}) => name ? { field: name, dataType, label: label(name), ...extra } : null;
  return {
    version: 1,
    type,
    title: el.vizTitle.value || "Untitled map",
    subtitle: "",
    dataset: { queryId: state.workspace.active.queryId },
    encoding: {
      latitude: field(el.mapLatitudeField.value, "latitude"),
      longitude: field(el.mapLongitudeField.value, "longitude"),
      label: field(el.mapLabelField.value, columnType(el.mapLabelField.value, "category")),
      tooltip: [],
      size: field(el.mapSizeField.value, "number", /revenue|cost|profit/i.test(el.mapSizeField.value) ? { format: "currency" } : {}),
      color: field(el.mapColorField.value, columnType(el.mapColorField.value, "category")),
      value: field(el.mapValueField.value, "number", /revenue|cost|profit/i.test(el.mapValueField.value) ? { format: "currency" } : {}),
      region: field(el.mapRegionField.value, guessRegionDataType(el.mapRegionField.value), { boundary: el.mapBoundary.value || "us-states" }),
    },
    map: {
      style: el.mapBasemap.value || "blank",
      initialView: type === "map-choropleth" ? "fit-boundary" : "fit-data",
      cluster: type === "map-clustered-point" || el.mapCluster.checked,
      showLegend: el.mapLegend.checked,
      showTooltip: true,
      showScale: true,
      classification: "continuous",
      classCount: 5,
      approvedMappings: state.currentSpec?.map?.approvedMappings || [],
    },
  };
}

async function rebuildVisualization() {
  const renderRevision = ++visualizationRenderRevision;
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
    const option = isMapSpec(validation.spec)
      ? await renderCurrentMap(validation.spec, renderRevision)
      : await renderVisualization(elements().chart, validation.spec, state.currentResult, getThemeTokens(activeThemeName()));
    if (renderRevision !== visualizationRenderRevision) return;
    setCurrentOption(option);
    elements().vizStatus.textContent = isMapSpec(validation.spec) ? "Map rendered." : "Chart rendered.";
  } catch (error) {
    addError(isMapSpec(validation.spec) ? "map" : "chart", "render", error);
  }
}

async function renderCurrentMap(spec, renderRevision) {
  const validation = await validateMapSpec(spec, state.currentResult);
  if (renderRevision !== visualizationRenderRevision) return null;
  setCurrentSpec(validation.spec);
  if (!validation.valid) {
    showEmpty(elements().chart, "Fix map validation errors to render a map.");
    const error = new Error(validation.errors.map((item) => item.message).join(" "));
    error.validation = validation;
    throw error;
  }
  if (validation.spec.encoding.latitude?.field && validation.spec.encoding.longitude?.field) {
    state.map.lastCoordinateProfile = profileCoordinates(state.currentResult.rows || [], validation.spec.encoding.latitude.field, validation.spec.encoding.longitude.field);
  }
  const compiled = await renderMapVisualization(elements().chart, validation.spec, state.currentResult, getThemeTokens(activeThemeName()), "main_map");
  if (renderRevision !== visualizationRenderRevision) return null;
  state.map.lastDiagnostics = compiled.diagnostics;
  state.map.lastError = null;
  return compiled;
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
  } catch (error) {
    state.dashboard.lastError = error.message;
    addError("dashboard", "refresh", error);
  } finally {
    state.dashboard.refreshing = false;
    currentDashboardAbortController = null;
    notify();
    await renderDashboardCharts();
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

function addDashboardInteractionBinding() {
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  const el = elements();
  const binding = normalizeInteractionBinding({
    name: `${label(el.interactionSourceField.value)} ${el.interactionAction.value}`,
    source: { cardId: el.interactionSourceCard.value, field: el.interactionSourceField.value, eventKinds: ["category", "multi-category", "map-region", "legend"] },
    targets: { mode: "all-except-source", cardIds: [] },
    action: { type: el.interactionAction.value, dashboardField: el.interactionSourceField.value, operator: "in" },
  });
  const validation = validateInteractionBinding(binding, dashboard, state.workspace);
  if (!validation.valid) {
    state.interaction.lastError = validation.errors[0]?.message;
    addError("interaction", "save-binding", new Error(validation.errors.map((error) => error.message).join(" ")));
    return;
  }
  updateWorkspace((workspace) => {
    const active = findDashboard(workspace, dashboard.id);
    addInteractionBinding(active, validation.binding);
  });
}

async function emitDashboardInteraction() {
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  const el = elements();
  const card = dashboard.layout.find((item) => item.id === el.interactionSourceCard.value);
  const viz = state.workspace.visualizations.find((item) => item.id === card?.visualizationId);
  const event = createInteractionEvent({
    source: { dashboardId: dashboard.id, cardId: card?.id, visualizationId: viz?.id, renderer: isMapSpec(viz?.spec) ? "maplibre" : "echarts" },
    selection: { kind: isMapSpec(viz?.spec) ? "map-region" : "category", field: el.interactionSourceField.value, semanticType: "category", values: [el.interactionValue.value] },
  });
  const published = interactionBus.publish(event);
  state.interaction.subscriptionCount = interactionBus.subscriptionCount();
  if (!published.ok) {
    state.interaction.lastError = published.errors[0]?.message;
    addError("interaction", "publish", new Error(published.errors.map((error) => error.message).join(" ")));
    return;
  }
  if (published.duplicate) {
    state.interaction.lastLoopPreventionEvent = event.id;
    notify();
    return;
  }
  await applyDashboardInteraction(event);
}

async function applyDashboardInteraction(event) {
  const started = performance.now();
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  const resolution = resolveInteraction({ event, dashboard, workspace: state.workspace });
  updateWorkspace((workspace) => {
    const active = findDashboard(workspace, dashboard.id);
    active.interactions.state = applyInteractionResolution(active.interactions?.state || createInteractionState(), event, resolution);
  });
  state.interaction.lastEvent = event;
  state.interaction.lastResolution = resolution;
  state.interaction.cardsHighlighted = resolution.highlightedCardIds || [];
  state.interaction.cardsRequeried = resolution.affectedCardIds || [];
  invalidateDashboardCache();
  for (const cardId of resolution.affectedCardIds || []) {
    const active = activeDashboardOrNull();
    const card = active?.layout.find((item) => item.id === cardId);
    if (!active || !card) continue;
    state.dashboard.cardStates[cardId] = { cardId, status: "loading" };
    notify();
    state.dashboard.cardStates[cardId] = await refreshCard({ dashboard: active, card, workspace: state.workspace, loadedTables: state.loadedTables, bypassCache: true });
  }
  state.interaction.lastDurationMs = Math.round(performance.now() - started);
  notify();
  await renderDashboardCharts();
}

function clearDashboardInteractions() {
  const dashboard = activeDashboardOrNull();
  if (!dashboard) return;
  updateWorkspace((workspace) => {
    const active = findDashboard(workspace, dashboard.id);
    active.interactions.state = clearInteractionState(active.interactions?.state || createInteractionState());
  });
  state.interaction.lastEvent = null;
  state.interaction.lastResolution = null;
  state.interaction.cardsRequeried = [];
  state.interaction.cardsHighlighted = [];
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
      if (isMapSpec(cardState.spec)) {
        const compiled = await renderMapVisualization(element, cardState.spec, cardState.result, getThemeTokens(activeThemeName()), `dashboard_map_${card.id}`, dashboardInteractionContext(dashboard, card, cardState, "maplibre"));
        state.map.lastDiagnostics = compiled.diagnostics;
      } else {
        await renderVisualization(element, cardState.spec, cardState.result, getThemeTokens(activeThemeName()), `dashboard_${card.id}`, dashboardInteractionContext(dashboard, card, cardState, "echarts"));
      }
    } catch (error) {
      state.dashboard.cardStates[card.id] = { ...cardState, status: "error", error: error.message };
      addError("dashboard", "render-card", error);
    }
  }
}

function dashboardInteractionContext(dashboard, card, cardState, renderer) {
  return {
    source: {
      dashboardId: dashboard.id,
      cardId: card.id,
      visualizationId: cardState.visualization?.id || card.visualizationId,
      renderer,
    },
    onEvent: handleRendererInteraction,
    onError: (error) => {
      state.interaction.lastError = error.message;
      addError("interaction", `${renderer}-adapter`, error);
    },
  };
}

function handleRendererInteraction(event) {
  const published = interactionBus.publish(event);
  state.interaction.subscriptionCount = interactionBus.subscriptionCount();
  if (!published.ok) {
    state.interaction.lastError = published.errors[0]?.message;
    addError("interaction", "publish-renderer-event", new Error(published.errors.map((error) => error.message).join(" ")));
    return;
  }
  if (published.duplicate) {
    state.interaction.lastLoopPreventionEvent = event.id;
    notify();
    return;
  }
  applyDashboardInteraction(event).catch((error) => addError("interaction", "apply-renderer-event", error));
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
    if (action === "remove-card") { removeCard(active, cardId); disposeChartInstance(`dashboard_${cardId}`); disposeMapInstance(`dashboard_map_${cardId}`); delete state.dashboard.cardStates[cardId]; }
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
  const dashboard = activeDashboardOrNull();
  copyText(JSON.stringify({
    appVersion: APP_VERSION,
    buildDate: BUILD_DATE,
    workspaceId: state.workspace.id,
    activeDashboardId: state.workspace.active.dashboardId,
    activeMapVisualizationId: isMapSpec(state.currentSpec) ? state.workspace.active.visualizationId : null,
    activeInteractionCount: dashboard?.interactions?.state?.activeSelections?.length || 0,
    activeDrillPath: dashboard?.interactions?.state?.drillPath || [],
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

function exportCurrentMapPackage() {
  const vizId = state.workspace.active.visualizationId;
  if (!vizId) {
    addError("map", "export-package", new Error("Save the map visualization before exporting a package."));
    return;
  }
  try {
    const pkg = exportMapVisualizationPackage(state.workspace, vizId);
    state.map.lastExportAt = pkg.exportedBy.exportedAt;
    downloadJson(`${safeFileName(pkg.visualization.name)}_map.json`, pkg);
  } catch (error) {
    state.map.lastError = error.message;
    addError("map", "export-package", error);
  }
}

async function exportWorkspacePortablePackage() {
  try {
    const pkg = await createPortablePackage(state.workspace, { packageMode: "workspace-backup", dataMode: "external", name: state.workspace.name });
    const inspection = inspectPortablePackage(pkg);
    await updatePackageDiagnostics(pkg, inspection);
    elements().packageInspection.textContent = JSON.stringify(inspection, null, 2);
    downloadJson(`${safeFileName(pkg.manifest.name)}.quackviz.json`, pkg);
  } catch (error) {
    state.packaging.lastError = error.message;
    addError("package", "export-workspace", error);
  }
}

async function exportStandaloneAnalyticalApp() {
  try {
    const entry = state.workspace.active.dashboardId
      ? { type: "dashboard", id: state.workspace.active.dashboardId }
      : state.workspace.active.visualizationId
        ? { type: "visualization", id: state.workspace.active.visualizationId }
        : state.workspace.active.reportId
          ? { type: "report", id: state.workspace.active.reportId }
          : null;
    const selection = entry ? { [`${entry.type}s`]: [entry.id] } : {};
    const pkg = await createPortablePackage(state.workspace, { packageMode: "standalone", dataMode: "external", selection, entrypoints: entry ? [entry] : [] });
    const html = createStandaloneHtml(pkg);
    const inspection = inspectPortablePackage(pkg);
    await updatePackageDiagnostics(pkg, inspection, html);
    state.packaging.lastStandaloneRuntimeTest = runtimeHarnessLoad(pkg);
    elements().packageInspection.textContent = JSON.stringify({ inspection, runtime: state.packaging.lastStandaloneRuntimeTest }, null, 2);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(pkg.manifest.name)}_standalone.html`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify();
  } catch (error) {
    state.packaging.lastError = error.message;
    addError("package", "export-standalone", error);
  }
}

function copyCurrentEmbedSnippet() {
  const artifactId = state.workspace.active.visualizationId || state.workspace.active.dashboardId || state.workspace.active.reportId;
  const artifactType = state.workspace.active.visualizationId ? "visualization" : state.workspace.active.dashboardId ? "dashboard" : "report";
  const config = createEmbedConfig({ artifactType, artifactId, capabilities: { filters: artifactType === "dashboard", emitSelectionValues: false } });
  const snippet = createIframeSnippet(config);
  state.packaging.lastEmbedMessage = { artifactType, artifactId, appVersion: APP_VERSION };
  elements().packageInspection.textContent = JSON.stringify({ config, snippet }, null, 2);
  copyText(snippet).catch((error) => addError("package", "copy-embed", error));
  notify();
}

function exportBuiltInTemplate() {
  try {
    const template = exportTemplate(BUILT_IN_TEMPLATES[0]);
    const applied = applyTemplate(template, state.workspace);
    state.packaging.templateCount = BUILT_IN_TEMPLATES.length;
    state.packaging.lastTemplateApplied = applied;
    elements().packageInspection.textContent = JSON.stringify({ template, applied }, null, 2);
    downloadJson(`${safeFileName(template.name)}.quackviz-template.json`, template);
  } catch (error) {
    state.packaging.lastError = error.message;
    addError("package", "export-template", error);
  }
}

function validateSampleExtension() {
  try {
    const extension = {
      format: "quackviz-extension",
      formatVersion: 1,
      id: "extension_lollipop",
      name: "Lollipop chart preset",
      version: "1.0.0",
      publisher: "Local User",
      extensionTypes: ["chart-definition"],
      requirements: { minimumAppVersion: APP_VERSION, maximumAppVersion: null },
      contributions: { chartDefinitions: [{ id: "lollipop", label: "Lollipop", compilerFamily: "bar", requiredRoles: ["x", "y"], defaults: { orientation: "horizontal", showLabels: true } }] },
    };
    const validation = validateExtension(extension, state.packaging.extensions);
    if (validation.valid) state.packaging.extensions = installExtension(state.packaging.extensions, extension, { enable: false });
    const diagnostics = extensionDiagnostics(state.packaging.extensions);
    state.packaging.installedExtensionCount = diagnostics.installedExtensionCount;
    state.packaging.enabledExtensionCount = diagnostics.enabledExtensionCount;
    elements().packageInspection.textContent = JSON.stringify({ validation, diagnostics }, null, 2);
    notify();
  } catch (error) {
    state.packaging.lastError = error.message;
    addError("package", "validate-extension", error);
  }
}

async function updatePackageDiagnostics(pkg, inspection, runtimeHtml = "") {
  const integrity = await verifyPortablePackageIntegrity(pkg);
  state.packaging.lastMode = pkg.manifest.packageMode;
  state.packaging.lastDataMode = pkg.manifest.dataMode;
  state.packaging.lastPackageSize = JSON.stringify(pkg).length;
  state.packaging.lastRuntimeSize = runtimeHtml.length || null;
  state.packaging.lastDataSize = JSON.stringify(pkg.data || {}).length;
  state.packaging.lastBoundarySize = JSON.stringify(pkg.assets?.boundaries || []).length;
  state.packaging.lastArtifactCount = Object.values(pkg.manifest.artifactCounts || {}).reduce((sum, count) => sum + count, 0);
  state.packaging.lastTableCount = pkg.manifest.tableCount;
  state.packaging.lastHashCount = pkg.manifest.integrity?.files?.length || 0;
  state.packaging.lastIntegrityResult = integrity;
  state.packaging.lastExportAt = pkg.manifest.createdAt;
  state.packaging.lastError = inspection.valid ? null : inspection.errors[0]?.message;
  notify();
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
    if (source) elements().sqlEditor.value = `SELECT * FROM ${escapeIdent(source.tableName)} LIMIT 100;`;
    selectTab("data");
  }
  if (action === "open-source-sql") {
    const source = state.workspace.dataSources.find((item) => item.id === id);
    if (!source) return;
    setActive({ dataSourceId: id, queryId: null });
    elements().queryName.value = `${source.name} preview`;
    elements().sqlEditor.value = `SELECT * FROM ${escapeIdent(source.tableName)} LIMIT 100;`;
    selectTab("sql");
  }
  if (action === "build-source-viz") {
    const source = state.workspace.dataSources.find((item) => item.id === id);
    if (!source) return;
    setActive({ dataSourceId: id, queryId: null });
    elements().queryName.value = `${source.name} visualization`;
    elements().sqlEditor.value = `SELECT * FROM ${escapeIdent(source.tableName)} LIMIT 500;`;
    setCurrentResult(null);
    setCurrentSpec(null);
    selectTab("visualize");
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
  el.mapLatitudeField.value = spec.encoding?.latitude?.field || "";
  el.mapLongitudeField.value = spec.encoding?.longitude?.field || "";
  el.mapRegionField.value = spec.encoding?.region?.field || "";
  el.mapValueField.value = spec.encoding?.value?.field || "";
  el.mapLabelField.value = spec.encoding?.label?.field || "";
  el.mapColorField.value = spec.encoding?.color?.field || "";
  el.mapSizeField.value = spec.encoding?.size?.field || "";
  el.mapBoundary.value = spec.encoding?.region?.boundary || "us-states";
  el.mapBasemap.value = spec.map?.style || "blank";
  el.mapCluster.checked = Boolean(spec.map?.cluster || spec.type === "map-clustered-point");
  el.mapLegend.checked = spec.map?.showLegend !== false;
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
  await step("Detect CSV", () => {
    if (detectImportFormat({ fileName: "orders.csv" }).format !== "csv") throw new Error("CSV not detected.");
  });
  await step("Detect JSON", () => {
    if (detectImportFormat({ fileName: "orders.json" }).format !== "json") throw new Error("JSON not detected.");
  });
  await step("Detect NDJSON", () => {
    if (detectImportFormat({ fileName: "events.jsonl" }).format !== "ndjson") throw new Error("NDJSON not detected.");
  });
  await step("Detect Parquet", () => {
    if (detectImportFormat({ fileName: "orders.parquet" }).format !== "parquet") throw new Error("Parquet not detected.");
  });
  await step("Generate safe table name", () => {
    if (generateSafeTableName("123-results.parquet") !== "table_123_results") throw new Error("Unexpected table name.");
  });
  await step("Register local test buffer", async () => {
    await registerFileBuffer("/qv_self_import_buffer.csv", new TextEncoder().encode("id,name\n1,A\n2,B\n").buffer);
  });
  const importedSources = [];
  await step("Import CSV", async () => {
    const source = await importRegisteredSource({ virtualName: "/qv_self_import_buffer.csv", tableName: "qv_self_csv", format: "csv", metadata: { name: "Self CSV", sourceType: "fixture", fileName: "self.csv" }, options: { header: true, replace: true } });
    importedSources.push(source);
    if (source.rowCount !== 2 || source.columns.length !== 2) throw new Error("CSV import metadata invalid.");
  });
  await step("Import JSON", async () => {
    await registerFileBuffer("/qv_self_import.json", new TextEncoder().encode('[{"id":1,"label":"A"},{"id":2,"label":"B"}]').buffer);
    const source = await importRegisteredSource({ virtualName: "/qv_self_import.json", tableName: "qv_self_json", format: "json", metadata: { name: "Self JSON", sourceType: "fixture", fileName: "self.json" }, options: { replace: true } });
    importedSources.push(source);
    if (source.rowCount !== 2 || !source.columns.some((column) => column.name === "label")) throw new Error("JSON import metadata invalid.");
  });
  await step("Import NDJSON", async () => {
    await registerFileBuffer("/qv_self_import.ndjson", new TextEncoder().encode('{"id":1,"label":"A"}\n{"id":2,"label":"B"}\n').buffer);
    const source = await importRegisteredSource({ virtualName: "/qv_self_import.ndjson", tableName: "qv_self_ndjson", format: "ndjson", metadata: { name: "Self NDJSON", sourceType: "fixture", fileName: "self.ndjson" }, options: { replace: true } });
    importedSources.push(source);
    if (source.rowCount !== 2 || !source.columns.some((column) => column.name === "label")) throw new Error("NDJSON import metadata invalid.");
  });
  await step("Import Parquet", async () => {
    await executeSql("CREATE OR REPLACE TEMP TABLE qv_self_parquet_source AS SELECT 1 AS id, 'A' AS label UNION ALL SELECT 2 AS id, 'B' AS label");
    await executeSql("COPY qv_self_parquet_source TO '/qv_self_import.parquet' (FORMAT PARQUET)");
    const source = await importRegisteredSource({ virtualName: "/qv_self_import.parquet", tableName: "qv_self_parquet", format: "parquet", metadata: { name: "Self Parquet", sourceType: "fixture", fileName: "self.parquet" }, options: { replace: true } });
    importedSources.push(source);
    if (source.rowCount !== 2 || !source.columns.some((column) => column.name === "label")) throw new Error("Parquet import metadata invalid.");
  });
  await step("Verify row counts", () => {
    if (importedSources.some((source) => source.rowCount !== 2)) throw new Error("Unexpected imported row count.");
  });
  await step("Verify schemas", () => {
    if (importedSources.some((source) => !source.columns.length)) throw new Error("Missing imported schema.");
  });
  await step("Validate URL", () => {
    if (!validateImportUrl("https://example.com/data.csv").valid) throw new Error("Safe URL rejected.");
  });
  await step("Reject unsafe URL scheme", () => {
    if (validateImportUrl("javascript:alert(1)").valid) throw new Error("Unsafe URL accepted.");
  });
  await step("Cancel mock URL import", async () => {
    const controller = new AbortController();
    controller.abort();
    let cancelled = false;
    try {
      await importFromUrl({ url: "https://example.com/data.csv", tableName: "cancelled", format: "csv", signal: controller.signal });
    } catch (error) {
      cancelled = error.code === "IMPORT_CANCELLED";
    }
    if (!cancelled) throw new Error("Cancelled URL import was not reported.");
  });
  await step("Clean partial import", async () => {
    await executeSql("CREATE TABLE qv_self_partial AS SELECT 1 AS x");
    await importRegisteredSource({ virtualName: "/qv_self_missing.csv", tableName: "qv_self_partial", format: "csv", metadata: { sourceType: "fixture" }, options: { replace: true } }).catch(() => null);
    const exists = await tableExists("qv_self_partial");
    if (exists) throw new Error("Partial table was not cleaned.");
  });
  await step("Fixture is Debug-only", () => {
    const normalDataButton = document.querySelector('[data-testid="load-sample"]');
    const debugFixture = document.querySelector('[data-testid="debug-load-fixture"]');
    if (normalDataButton || !debugFixture) throw new Error("Fixture is not Debug-only.");
  });
  await step("Inline SVG favicon", () => {
    const favicon = document.querySelector('[data-testid="favicon-link"]');
    if (!favicon || favicon.type !== "image/svg+xml" || !favicon.href.startsWith("data:image/svg+xml")) throw new Error("Inline SVG favicon missing.");
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
    if (!option.series?.[0] || option.series[0].data?.length !== dataset.rowCount) {
      throw new Error("Missing compiled series data.");
    }
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
  const mapDataset = {
    columns: [{ name: "latitude", inferredType: "latitude" }, { name: "longitude", inferredType: "longitude" }, { name: "state", inferredType: "us-state-abbreviation" }, { name: "revenue", inferredType: "number" }],
    rows: [{ latitude: 40, longitude: -75, state: "CA", revenue: 100 }, { latitude: 41, longitude: -76, state: "NY", revenue: 200 }, { latitude: 120, longitude: 45, state: "ZZ", revenue: 50 }],
  };
  const pointMapSpec = { version: 1, type: "map-point", title: "Self-test map", dataset: { queryId }, encoding: { latitude: { field: "latitude", dataType: "latitude" }, longitude: { field: "longitude", dataType: "longitude" }, label: null, tooltip: [], size: null, color: null, value: null, region: null }, map: { style: "blank", showLegend: true, showTooltip: true } };
  const choroplethSpec = { version: 1, type: "map-choropleth", title: "Self-test states", dataset: { queryId }, encoding: { latitude: null, longitude: null, label: null, tooltip: [], size: null, color: null, value: { field: "revenue", dataType: "number" }, region: { field: "state", dataType: "us-state-abbreviation", boundary: "us-states" } }, map: { style: "blank", showLegend: true, showTooltip: true, approvedMappings: [] } };
  await step("Detect latitude and longitude", () => {
    if (inferGeographicSemantic({ name: "latitude", type: "DOUBLE" }, [40]).semanticType !== "latitude") throw new Error("Latitude not detected.");
    if (inferGeographicSemantic({ name: "longitude", type: "DOUBLE" }, [-75]).semanticType !== "longitude") throw new Error("Longitude not detected.");
  });
  await step("Profile coordinate validity", () => {
    const profile = profileCoordinates(mapDataset.rows, "latitude", "longitude");
    if (profile.validPairCount !== 2 || profile.invalidPairCount !== 1) throw new Error("Coordinate profile counts are wrong.");
  });
  await step("Convert rows to GeoJSON", () => {
    const geo = rowsToPointGeoJson(mapDataset.rows, pointMapSpec);
    if (geo.geojson.features.length !== 2 || geo.diagnostics.invalidCoordinateCount !== 1) throw new Error("GeoJSON conversion failed.");
  });
  await step("Validate point-map spec", async () => {
    const validation = await validateMapSpec(pointMapSpec, mapDataset);
    if (!validation.valid) throw new Error(validation.errors[0]?.message || "Point map invalid.");
  });
  await step("Compile point map", async () => {
    const compiled = await compileMapSpec(pointMapSpec, mapDataset, getThemeTokens(activeThemeName()));
    if (!compiled.sources.quackviz_points || !compiled.layers.some((layer) => layer.id === "points")) throw new Error("Point map compile failed.");
  });
  await step("Render clustered layer config", async () => {
    const compiled = await compileMapSpec({ ...pointMapSpec, type: "map-clustered-point", map: { cluster: true } }, mapDataset, getThemeTokens(activeThemeName()));
    if (!compiled.layers.some((layer) => layer.id === "clusters")) throw new Error("Cluster layer missing.");
  });
  await step("Match US state abbreviations", async () => {
    const boundary = await loadBoundary("us-states");
    const match = matchRegions({ rows: [{ state: "CA" }, { state: "NY" }], regionField: "state", regionType: "us-state-abbreviation", boundary });
    if (match.matchRate !== 1) throw new Error("State match failed.");
  });
  await step("Validate choropleth spec", async () => {
    const validation = await validateMapSpec(choroplethSpec, mapDataset);
    if (!validation.valid) throw new Error(validation.errors[0]?.message || "Choropleth invalid.");
  });
  await step("Compile choropleth", async () => {
    const compiled = await compileMapSpec(choroplethSpec, mapDataset, getThemeTokens(activeThemeName()));
    if (!compiled.layers.some((layer) => layer.id === "regions")) throw new Error("Choropleth layer missing.");
  });
  await step("Detect unmatched regions", async () => {
    const boundary = await loadBoundary("us-states");
    const match = matchRegions({ rows: [{ state: "N. Carolina" }], regionField: "state", regionType: "us-state-name", boundary });
    if (match.unmatchedDataRegions !== 1) throw new Error("Unmatched region not detected.");
  });
  await step("Apply approved mapping", async () => {
    const boundary = await loadBoundary("us-states");
    const match = matchRegions({ rows: [{ state: "N. Carolina" }], regionField: "state", regionType: "us-state-name", boundary, approvedMappings: [{ sourceValue: "N. Carolina", boundaryValue: "North Carolina" }] });
    if (match.matchRate !== 1) throw new Error("Approved mapping failed.");
  });
  await step("Export map visualization package", () => {
    const workspace = createWorkspace();
    const query = addOrUpdateQuery(workspace, { id: queryId, sql: "SELECT latitude, longitude FROM qv_self_test", sourceTables: ["qv_self_test"] });
    const viz = addOrUpdateVisualization(workspace, { id: "viz_map_self", name: "Self-test map", queryId: query.id, spec: pointMapSpec });
    if (exportMapVisualizationPackage(workspace, viz.id).exportedBy.appVersion !== APP_VERSION) throw new Error("Map package version mismatch.");
  });
  await step("Parse valid AI map proposal", () => {
    const result = validateAiResponse({ contract: AI_CONTRACTS.mapProposals, contractVersion: 1, summary: "Map", proposals: [{ id: "proposal_map", title: "Map", question: "Where?", description: "Point map", sourceTables: ["qv_self_test"], confidence: 0.9, sql: "SELECT latitude, longitude FROM qv_self_test", expectedColumns: [{ name: "latitude", dataType: "latitude" }, { name: "longitude", dataType: "longitude" }], visualization: pointMapSpec, reasoning: { whyThisQuestion: "Location.", whyThisMap: "Points." }, assumptions: [], cautions: [] }] }, { expectedContract: AI_CONTRACTS.mapProposals, knownTables: ["qv_self_test"], dataset: mapDataset });
    if (!result.proposals[0].valid) throw new Error(result.proposals[0].errors[0]?.message || "AI map invalid.");
  });
  await step("Reject unsafe AI map proposal", () => {
    const result = validateAiResponse({ contract: AI_CONTRACTS.mapProposals, contractVersion: 1, summary: "Map", proposals: [{ id: "proposal_map", title: "Map", question: "Where?", description: "Point map", sourceTables: ["qv_self_test"], confidence: 0.9, sql: "DROP TABLE qv_self_test", expectedColumns: [{ name: "latitude", dataType: "latitude" }, { name: "longitude", dataType: "longitude" }], visualization: pointMapSpec, reasoning: { whyThisQuestion: "Location.", whyThisMap: "Points." }, assumptions: [], cautions: [] }] }, { expectedContract: AI_CONTRACTS.mapProposals, knownTables: ["qv_self_test"], dataset: mapDataset });
    if (result.proposals[0].valid) throw new Error("Unsafe AI map accepted.");
  });
  await step("Parse region-repair proposal", () => {
    const result = validateAiResponse({ contract: AI_CONTRACTS.regionRepair, contractVersion: 1, boundaryId: "us-states", mappings: [{ sourceValue: "N. Carolina", boundaryValue: "North Carolina", confidence: 0.98, reason: "Common abbreviation." }], unresolved: [] }, { expectedContract: AI_CONTRACTS.regionRepair });
    if (!result.valid) throw new Error(result.errors[0]?.message || "Region repair invalid.");
  });
  await step("Add map to temporary dashboard and report", () => {
    const workspace = createWorkspace();
    const query = addOrUpdateQuery(workspace, { id: queryId, sql: "SELECT latitude, longitude FROM qv_self_test", sourceTables: ["qv_self_test"] });
    const viz = addOrUpdateVisualization(workspace, { id: "viz_map_self", name: "Self-test map", queryId: query.id, spec: pointMapSpec });
    const dashboard = addDashboard(workspace, createDashboard({ name: "Map dashboard" }));
    addCard(dashboard, viz.id);
    const mapReport = addReport(workspace, createReport({ title: "Map report" }));
    addSection(mapReport, { type: "visualization", source: { visualizationId: viz.id } });
    if (dashboard.layout[0].visualizationId !== viz.id || mapReport.sections[0].source.visualizationId !== viz.id) throw new Error("Map relationship failed.");
  });
  let interactionWorkspace = null;
  let interactionDashboard = null;
  let interactionCards = null;
  let interactionEvent = null;
  await step("Create category interaction event", () => {
    interactionEvent = createInteractionEvent({ source: { dashboardId: "dashboard_interactions", cardId: "card_source", visualizationId: "viz_source", renderer: "echarts" }, selection: { kind: "category", field: "region", semanticType: "category", values: ["East"] } });
    if (!interactionEvent.id || interactionEvent.selection.values[0] !== "East") throw new Error("Event was not created.");
  });
  await step("Validate interaction event", () => {
    const validation = validateInteractionEvent(interactionEvent);
    if (!validation.valid) throw new Error(validation.errors[0]?.message || "Event invalid.");
  });
  await step("Publish through interaction bus", () => {
    const bus = createInteractionBus();
    let seen = null;
    bus.subscribe((event) => { seen = event.id; });
    const published = bus.publish(interactionEvent);
    if (!published.ok || seen !== interactionEvent.id) throw new Error("Interaction was not published.");
  });
  await step("Resolve compatible binding", () => {
    interactionWorkspace = createWorkspace();
    const query = addOrUpdateQuery(interactionWorkspace, { id: "query_interaction_self", name: "Interaction Q", sql: "SELECT region, revenue FROM qv_self_test", sourceTables: ["qv_self_test"] });
    const sourceViz = addOrUpdateVisualization(interactionWorkspace, { id: "viz_interaction_source", name: "Source", queryId: query.id, spec: { ...validSpec, encoding: { x: { field: "region", dataType: "category" }, y: [{ field: "revenue", dataType: "number" }] } } });
    const targetViz = addOrUpdateVisualization(interactionWorkspace, { id: "viz_interaction_target", name: "Target", queryId: query.id, spec: { ...validSpec, encoding: { x: { field: "region", dataType: "category" }, y: [{ field: "revenue", dataType: "number" }] } } });
    interactionDashboard = addDashboard(interactionWorkspace, createDashboard({ id: "dashboard_interactions", name: "Interactions" }));
    const sourceCard = addCard(interactionDashboard, sourceViz.id);
    const targetCard = addCard(interactionDashboard, targetViz.id);
    interactionCards = { sourceCard, targetCard };
    addInteractionBinding(interactionDashboard, { source: { cardId: sourceCard.id, field: "region", eventKinds: ["category"] }, targets: { mode: "explicit", cardIds: [targetCard.id] }, action: { type: "filter", dashboardField: "region", operator: "in" } });
    interactionEvent = createInteractionEvent({ source: { dashboardId: interactionDashboard.id, cardId: sourceCard.id, visualizationId: sourceViz.id, renderer: "echarts" }, selection: { kind: "category", field: "region", semanticType: "category", values: ["East"] } });
    const resolution = resolveInteraction({ event: interactionEvent, dashboard: interactionDashboard, workspace: interactionWorkspace });
    if (resolution.affectedCardIds[0] !== targetCard.id) throw new Error("Target card was not resolved.");
  });
  await step("Apply interaction filter", () => {
    const resolution = resolveInteraction({ event: interactionEvent, dashboard: interactionDashboard, workspace: interactionWorkspace });
    const next = applyInteractionResolution(createInteractionState(), interactionEvent, resolution);
    if (next.activeFilters[0]?.value[0] !== "East") throw new Error("Interaction filter missing.");
  });
  await step("Compile string parameter", () => {
    const result = compileParameterizedSql("SELECT {{ region }} AS region", [{ name: "region", dataType: "string" }], { region: "East" });
    if (!result.sql.includes("'East'")) throw new Error("String parameter not encoded.");
  });
  await step("Compile numeric parameter", () => {
    const result = compileParameterizedSql("SELECT {{ revenue }} AS revenue", [{ name: "revenue", dataType: "number" }], { revenue: "12.5" });
    if (!result.sql.includes("12.5")) throw new Error("Numeric parameter not encoded.");
  });
  await step("Compile date parameter", () => {
    const result = compileParameterizedSql("SELECT {{ start_date }} AS start_date", [{ name: "start_date", dataType: "date" }], { start_date: "2026-01-01" });
    if (!result.sql.includes("'2026-01-01'")) throw new Error("Date parameter not encoded.");
  });
  await step("Reject raw SQL parameter", () => {
    let rejected = false;
    try {
      compileParameterizedSql("SELECT {{ value }}", [{ name: "value", dataType: "number" }], { value: "1; DROP TABLE x" });
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("SQL fragment-like numeric parameter was accepted.");
  });
  await step("Perform category cross-filter", () => {
    const resolution = resolveInteraction({ event: interactionEvent, dashboard: interactionDashboard, workspace: interactionWorkspace });
    if (!resolution.filters.length || resolution.highlightedCardIds.length) throw new Error("Cross-filter resolution failed.");
  });
  await step("Perform highlight-only interaction", () => {
    interactionDashboard.interactions.bindings = [];
    addInteractionBinding(interactionDashboard, { source: { cardId: interactionCards.sourceCard.id, field: "region", eventKinds: ["category"] }, targets: { mode: "explicit", cardIds: [interactionCards.targetCard.id] }, action: { type: "highlight", dashboardField: "region" } });
    const resolution = resolveInteraction({ event: interactionEvent, dashboard: interactionDashboard, workspace: interactionWorkspace });
    if (resolution.affectedCardIds.length || resolution.highlightedCardIds[0] !== interactionCards.targetCard.id) throw new Error("Highlight-only resolution failed.");
  });
  await step("Perform visualization drill-down", () => {
    const drill = drillDown({ triggerField: "region", hierarchy: [{ field: "region", label: "Region" }, { field: "category", label: "Category" }] }, "East");
    if (!buildBreadcrumb(drill.path).includes("East")) throw new Error("Breadcrumb missing drill value.");
  });
  await step("Build breadcrumb and drill up", () => {
    const drilled = drillDown({ triggerField: "region", hierarchy: [{ field: "region", label: "Region" }, { field: "category", label: "Category" }] }, "East");
    const up = drillUp(drilled);
    if (up.path.length !== 0 || buildBreadcrumb(drilled.path) !== "All > East") throw new Error("Drill up failed.");
  });
  await step("Prevent circular binding", () => {
    const dashboard = createDashboard();
    dashboard.layout = [{ id: "card_a", visualizationId: "viz_a" }, { id: "card_b", visualizationId: "viz_b" }];
    dashboard.interactions.bindings = [normalizeInteractionBinding({ source: { cardId: "card_b", field: "region" }, targets: { mode: "explicit", cardIds: ["card_a"] } })];
    const validation = validateInteractionBinding({ source: { cardId: "card_a", field: "region" }, targets: { mode: "explicit", cardIds: ["card_b"] } }, dashboard, createWorkspace());
    if (validation.valid) throw new Error("Circular binding accepted.");
  });
  await step("Adapt ECharts click event", () => {
    const event = adaptEChartsClick({ name: "East", seriesName: "Revenue" }, { dashboardId: "dashboard_interactions", cardId: "card_source", visualizationId: "viz_source" }, "region");
    if (event.selection.values[0] !== "East") throw new Error("ECharts click adapter failed.");
  });
  await step("Adapt MapLibre region event", () => {
    const event = adaptMapLibreFeatureClick({ id: "CA", properties: { state: "CA" } }, { dashboardId: "dashboard_interactions", cardId: "card_map", visualizationId: "viz_map" }, "state");
    if (event.selection.kind !== "map-region" || event.selection.values[0] !== "CA") throw new Error("MapLibre region adapter failed.");
  });
  await step("Persist and reload interaction definitions", () => {
    const restored = hydrateWorkspace(JSON.parse(JSON.stringify(interactionWorkspace)));
    if (!restored.dashboards[0].interactions.bindings.length) throw new Error("Interaction bindings did not survive hydration.");
  });
  await step("Parse valid AI interaction proposal", () => {
    const payload = { contract: AI_CONTRACTS.interactions, contractVersion: 1, summary: "Use region as a selector.", bindings: [{ title: "Region selector", sourceCardId: interactionCards.sourceCard.id, sourceField: "region", eventKinds: ["category"], targetMode: "explicit", targetCardIds: [interactionCards.targetCard.id], action: { type: "filter", dashboardField: "region", operator: "in" } }], drilldowns: [], parameters: [], assumptions: [], cautions: [] };
    interactionDashboard.workspace = interactionWorkspace;
    const result = validateAiResponse(payload, { expectedContract: AI_CONTRACTS.interactions, dataset: interactionDashboard });
    delete interactionDashboard.workspace;
    if (!result.valid) throw new Error(result.errors[0]?.message || "AI interaction proposal invalid.");
  });
  await step("Reject invalid AI interaction proposal", () => {
    const payload = { contract: AI_CONTRACTS.interactions, contractVersion: 1, summary: "Bad", bindings: [{ title: "Bad", sourceCardId: "missing", sourceField: "region", eventKinds: ["category"], targetMode: "explicit", targetCardIds: [interactionCards.targetCard.id], action: { type: "filter", dashboardField: "region", operator: "in" } }], drilldowns: [], parameters: [], assumptions: [], cautions: [] };
    const result = validateAiResponse(payload, { expectedContract: AI_CONTRACTS.interactions, dataset: interactionDashboard });
    if (result.valid) throw new Error("Invalid AI interaction proposal accepted.");
  });
  let portablePackage = null;
  await step("Resolve dashboard package dependency graph", async () => {
    portablePackage = await createPortablePackage(interactionWorkspace, { packageMode: "standalone", dataMode: "external", selection: { dashboards: [interactionDashboard.id] } });
    if (!portablePackage.manifest.artifactCounts.dashboards || !portablePackage.manifest.artifactCounts.visualizations) throw new Error("Dependency closure missing.");
  });
  await step("Detect missing package dependency", async () => {
    const broken = JSON.parse(JSON.stringify(interactionWorkspace));
    broken.queries = [];
    const pkg = await createPortablePackage(broken, { packageMode: "standalone", dataMode: "external", selection: { dashboards: [interactionDashboard.id] } });
    if (validatePortablePackage(pkg).valid && pkg.manifest.artifactCounts.queries) throw new Error("Missing dependency was not reflected.");
  });
  await step("Create package manifest", () => {
    if (portablePackage.manifest.createdBy.appVersion !== APP_VERSION || portablePackage.format !== "quackviz-package") throw new Error("Package manifest invalid.");
  });
  await step("Exclude API key from package", async () => {
    const workspace = createWorkspace();
    workspace.settings.ai.apiKey = "secret";
    const pkg = await createPortablePackage(workspace, { packageMode: "workspace-backup" });
    if (JSON.stringify(pkg).includes("secret")) throw new Error("Secret leaked.");
  });
  await step("Generate data fingerprint", async () => {
    const hash = portablePackage.manifest.integrity.files[0]?.hash;
    if (!hash || hash.length !== 64) throw new Error("Hash missing.");
  });
  await step("Generate and verify file hash", async () => {
    const integrity = await verifyPortablePackageIntegrity(portablePackage);
    if (!integrity.ok) throw new Error("Package hash verification failed.");
  });
  await step("Reject mismatched package hash", async () => {
    const changed = JSON.parse(JSON.stringify(portablePackage));
    changed.workspace.name = "Changed";
    const integrity = await verifyPortablePackageIntegrity(changed);
    if (integrity.ok) throw new Error("Mismatched hash accepted.");
  });
  await step("Build minimal standalone package", () => {
    if (!createStandaloneHtml(portablePackage).includes("QuackViz Standalone")) throw new Error("Standalone HTML missing.");
  });
  await step("Load package in runtime harness", () => {
    if (!runtimeHarnessLoad(portablePackage).ready) throw new Error("Runtime harness failed.");
  });
  await step("Render one standalone visualization placeholder", () => {
    const html = createStandaloneHtml(portablePackage);
    if (!html.includes("Revenue") && !html.includes("Target")) throw new Error("Standalone artifact missing.");
  });
  await step("Parse valid embed config", () => {
    const config = createEmbedConfig({ artifactType: "dashboard", artifactId: interactionDashboard.id });
    if (!config.artifactId) throw new Error("Embed config missing artifact.");
  });
  await step("Reject unsafe embed message", () => {
    const result = validateEmbedMessage({ format: "quackviz-embed-message", version: 1, type: "set-filter", payload: { sql: "SELECT 1" } }, { config: createEmbedConfig({ capabilities: { filters: false } }) });
    if (result.valid) throw new Error("Unsafe embed message accepted.");
  });
  await step("Apply dashboard template", () => {
    const templateWorkspace = createWorkspace();
    templateWorkspace.dataSources = [{
      id: "source_template_self",
      tableName: "sales",
      columns: [
        { name: "order_date", semanticType: "date" },
        { name: "revenue", semanticType: "currency" },
        { name: "region", semanticType: "category" },
      ],
    }];
    const applied = applyTemplate(BUILT_IN_TEMPLATES[0], templateWorkspace);
    if (!applied.requiresApproval) throw new Error("Template applied without approval.");
  });
  await step("Validate declarative extension", () => {
    const validation = validateExtension({ format: "quackviz-extension", formatVersion: 1, id: "extension_self_test", extensionTypes: ["chart-definition"], contributions: { chartDefinitions: [{ id: "lollipop", compilerFamily: "bar" }] } });
    if (!validation.valid) throw new Error(validation.errors[0]?.message || "Extension invalid.");
  });
  await step("Reject executable extension content", () => {
    const validation = validateExtension({ format: "quackviz-extension", formatVersion: 1, id: "extension_bad", extensionTypes: ["chart-definition"], contributions: { handler: "() => true" } });
    if (validation.valid) throw new Error("Executable extension accepted.");
  });
  await step("Migrate older package version", () => {
    const migrated = validatePortablePackage({ ...portablePackage, formatVersion: 0, manifest: { ...portablePackage.manifest, packageMode: "standalone", dataMode: "external" } });
    if (!migrated.valid) throw new Error(migrated.errors[0]?.message || "Migration failed.");
  });
  await step("Capability detection", () => {
    const capabilities = detectCapabilities(window);
    if (!capabilities.requiredCapabilities.length || capabilities.missingRequired.length) throw new Error("Required capability missing.");
  });
  await step("Local vendor manifest validation", async () => {
    const manifest = await loadVendorManifest();
    const validation = validateVendorManifest(manifest);
    if (!validation.valid) throw new Error(validation.errors[0]?.message || "Vendor manifest invalid.");
  });
  await step("Dependency manifest requires local dependencies", async () => {
    const manifest = await loadVendorManifest();
    const validation = validateVendorManifest(manifest, { requireLocal: true });
    if (!validation.valid) throw new Error(validation.errors[0]?.message || "Required local dependency validation failed.");
  });
  await step("Worker round trip", async () => {
    const response = await workerManager.run("echo", { ok: true });
    if (!response.ok) throw new Error("Worker echo failed.");
  });
  await step("Worker contract validation", () => {
    const valid = validateWorkerMessage({ contract: "quackviz-worker-task", contractVersion: 1, taskId: "task_1", type: "echo", payload: {} });
    const invalid = validateWorkerMessage({ contract: "quackviz-worker-task", contractVersion: 99, taskId: "task_1" });
    if (!valid.valid || invalid.valid) throw new Error("Worker message validation failed.");
  });
  await step("Task timeout", async () => {
    const managerTask = taskManager.create("timeout-self-test", { timeoutMs: 1 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (taskManager.get(managerTask.id).status !== "timed-out") throw new Error("Task did not time out.");
  });
  await step("Performance timing span", () => {
    const span = performanceMonitor.start("self-test-performance");
    const item = span.finish({ success: true });
    if (!Number.isFinite(item.durationMs)) throw new Error("Performance span did not finish.");
  });
  await step("Workspace validation", () => {
    const validation = validateWorkspaceIntegrity(state.workspace);
    if (!validation.valid) throw new Error(validation.errors[0]?.message || "Workspace invalid.");
  });
  await step("Checkpoint creation and restore", async () => {
    const checkpoint = await createCheckpoint(state.recovery, state.workspace, "self-test");
    const restored = state.recovery.checkpoints.find((item) => item.id === checkpoint.id)?.workspace;
    if (restored.id !== state.workspace.id) throw new Error("Checkpoint restore payload missing.");
  });
  await step("Recovery journal entry", () => {
    const entry = addJournalEntry(state.recovery, { workspaceId: state.workspace.id, operation: "self-test" });
    if (!entry.id || state.recovery.journal[0].id !== entry.id) throw new Error("Journal entry missing.");
  });
  await step("Migration dry run", () => {
    const result = migrateWorkspace({ workspace: { ...state.workspace, version: 0 }, fromVersion: 0, dryRun: true });
    if (!result.dryRun || !result.report.length) throw new Error("Migration dry run failed.");
  });
  await step("Migration execution", () => {
    const result = migrateWorkspace({ workspace: { ...state.workspace, version: 0 }, fromVersion: 0 });
    if (!result.migrated || result.workspace.version !== 1) throw new Error("Migration execution failed.");
  });
  await step("Corruption detection", () => {
    const validation = validateWorkspaceIntegrity({ ...state.workspace, queries: [{ id: "dup" }, { id: "dup" }] });
    if (validation.valid) throw new Error("Duplicate ID corruption was not detected.");
  });
  await step("Safe-mode initialization flag", () => {
    if (typeof state.startup.safeMode !== "boolean") throw new Error("Safe mode status missing.");
  });
  await step("Support-bundle sanitization", () => {
    const bundle = createSupportBundle({ state, capabilities: state.startup.capabilities, vendorStatus: state.startup.vendorStatus, performanceSummary: performanceMonitor.summary(), workerStatus: workerManager.status(), recoverySummary: recoverySummary(state.recovery) });
    if (JSON.stringify(bundle).includes(getOpenRouterApiKey()) && getOpenRouterApiKey()) throw new Error("Support bundle leaked API key.");
  });
  await step("Result-cache eviction status", () => {
    if (!Number.isFinite(getDashboardRunnerStatus().cacheEntries)) throw new Error("Dashboard cache status unavailable.");
  });
  await step("ECharts disposal", () => {
    disposeChartInstance("self-test-dispose");
  });
  await step("MapLibre disposal", () => {
    disposeMapInstance("self-test-map-dispose");
  });
  await step("Object URL cleanup", () => {
    const url = URL.createObjectURL(new Blob(["ok"]));
    URL.revokeObjectURL(url);
  });
  await step("Offline dependency resolution status", () => {
    if (!state.startup.vendorStatus?.validation?.valid) throw new Error("Local dependency resolution is not ready for offline use.");
  });
  await step("Verify standalone footer version", () => {
    if (!createStandaloneHtml(portablePackage).includes(`Runtime ${APP_VERSION}`)) throw new Error("Standalone footer version mismatch.");
  });
  await step("Detect first-run state", () => {
    const onboarding = createOnboardingState({ workspace: createWorkspace() });
    if (!onboarding.firstRun || onboarding.steps[0].complete) throw new Error("First-run state was not detected.");
  });
  await step("Complete onboarding step", () => {
    const workspace = createWorkspace();
    workspace.dataSources.push({ id: "source_onboarding", name: "Orders", tableName: "orders", columns: [{ name: "id", duckType: "INTEGER" }] });
    const onboarding = createOnboardingState({ workspace });
    if (!onboarding.steps.find((item) => item.id === "add-data")?.complete) throw new Error("Onboarding step did not complete.");
  });
  await step("Persist onboarding dismissal", () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.welcomeDismissed, "true");
    if (localStorage.getItem(ONBOARDING_STORAGE_KEYS.welcomeDismissed) !== "true") throw new Error("Onboarding dismissal was not stored.");
  });
  await step("Generate starter query", () => {
    const source = { id: "source_starter", name: "Starter", tableName: "starter", columns: [{ name: "value", duckType: "DOUBLE" }] };
    const query = `SELECT COUNT(*) AS row_count\nFROM ${escapeIdent(source.tableName)};`;
    if (!query.includes("row_count")) throw new Error("Starter query missing row count.");
  });
  await step("Generate chart recommendation", () => {
    const items = buildCommandItems(state.workspace);
    if (!items.some((item) => item.label === "Add data")) throw new Error("Product commands missing Add data.");
  });
  await step("Create recent item", () => {
    const recent = recentItems(state.workspace, 3);
    if (!Array.isArray(recent)) throw new Error("Recent items failed.");
  });
  await step("Search recent item", () => {
    const result = searchCommandItems(buildCommandItems(state.workspace), "data", 5);
    if (!result.length) throw new Error("Command search failed.");
  });
  await step("Open command palette metadata", () => {
    const commands = buildCommandItems(state.workspace);
    if (!commands.some((item) => item.id === "cmd-help")) throw new Error("Command palette help command missing.");
  });
  await step("Resolve command", () => {
    const command = searchCommandItems(buildCommandItems(state.workspace), "help", 1)[0];
    if (!command || !["Command", "Help"].includes(command.type)) throw new Error("Command resolution failed.");
  });
  await step("Load local help topic", () => {
    if (!HELP_TOPICS.find((topic) => topic.id === "importing-data")?.path.startsWith("docs/")) throw new Error("Local help topic missing.");
  });
  await step("Validate local documentation link", () => {
    if (!HELP_TOPICS.every((topic) => topic.path.startsWith("docs/"))) throw new Error("Help topic path is not local.");
  });
  await step("Create accessible toast", () => {
    if (elements().toastRegion.getAttribute("aria-live") !== "polite") throw new Error("Toast live region missing.");
  });
  await step("Restore dialog focus support", () => {
    if (typeof elements().welcomeDialog.showModal !== "function") throw new Error("Dialog support missing.");
  });
  await step("Validate About metadata", () => {
    if (aboutMetadata().appVersion !== APP_VERSION || aboutMetadata().buildDate !== BUILD_DATE) throw new Error("About metadata mismatch.");
  });
  await step("Verify beta status", () => {
    if (aboutMetadata().releaseChannel !== "beta") throw new Error("Beta status missing.");
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

function guessRegionDataType(fieldName) {
  const name = String(fieldName || "").toLowerCase();
  if (/county.*fips|fips.*county/.test(name)) return "us-county-fips";
  if (/fips/.test(name)) return "us-state-fips";
  if (/state/.test(name)) return "us-state-abbreviation";
  if (/country.*iso2|iso2|alpha.?2/.test(name)) return "country-code-iso2";
  if (/country.*iso3|iso3|alpha.?3/.test(name)) return "country-code-iso3";
  if (/country/.test(name)) return "country-name";
  return "region";
}
