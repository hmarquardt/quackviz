import { initDuckDb, queryRows, explain } from "./db.js";
import { importFile, importSample } from "./import.js";
import { profileTable } from "./profile.js";
import { chartTypes } from "./viz-spec.js";
import { buildQuery, specFromBuilder } from "./query-builder.js";
import { recommendVisualizations } from "./viz-recommend.js";
import { renderChart, exportChartPNG } from "./viz-renderer.js";
import { validateAnalyticalSql, previewSql } from "./query.js";
import { requestAiProposals, fetchModels } from "./ai.js";
import { exportWorkspace, importWorkspace } from "./workspace.js";
import { createWorkspace, state, upsertQuery, upsertVisualization } from "./state.js";
import { copyText, downloadText, nowIso, truncate, uid, APP_VERSION } from "./utils.js";
import { getApiKey, saveWorkspace, setApiKey } from "./storage.js";

const $ = (id) => document.getElementById(id);

function activeTheme() {
  return state.workspace.settings.theme || "dark";
}

export function bindUi() {
  setupStaticControls();
  bindEvents();
  syncSettingsToUi();
  renderAll();
}

function setupStaticControls() {
  $("chartType").innerHTML = chartTypes().map((type) => `<option value="${type}">${type}</option>`).join("");
  $("aggregation").innerHTML = ["sum", "avg", "count", "min", "max"].map((a) => `<option value="${a}">${a}</option>`).join("");
  $("sortMode").innerHTML = `<option value="measure-desc">Measure descending</option><option value="x">X ascending</option>`;
  $("dateBucket").innerHTML = ["none", "day", "week", "month", "quarter", "year"].map((b) => `<option value="${b}">${b}</option>`).join("");
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.tab)));
  $("themeToggle").onclick = async () => { state.workspace.settings.theme = activeTheme() === "dark" ? "light" : "dark"; applyTheme(); await saveWorkspace(); };
  $("loadSales").onclick = () => loadSample("samples/sales.csv", "sales");
  $("loadTelemetry").onclick = () => loadSample("samples/telemetry.csv", "telemetry");
  $("fileInput").onchange = async (event) => handleImport(event.target.files[0]);
  $("runSql").onclick = runEditorSql;
  $("sqlEditor").addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") runEditorSql(); });
  $("copySql").onclick = () => copyText($("sqlEditor").value);
  $("saveQuery").onclick = () => saveCurrentQuery();
  $("applyBuilder").onclick = applyBuilder;
  $("builderTable").onchange = () => {
    const source = state.workspace.dataSources.find((s) => s.tableName === $("builderTable").value);
    state.workspace.active.dataSourceId = source?.id || null;
    renderSchema();
    renderBuilder();
  };
  $("applySpec").onclick = applyRawSpec;
  $("saveViz").onclick = saveCurrentVisualization;
  $("exportPng").onclick = () => exportChartPNG();
  $("exportSpec").onclick = () => downloadText("quackviz-spec.json", $("specEditor").value);
  $("exportWorkspace").onclick = () => downloadText("quackviz-workspace.json", exportWorkspace());
  $("workspaceInput").onchange = async (event) => { const file = event.target.files[0]; if (file) { importWorkspace(await file.text()); await saveWorkspace(); renderAll(); } };
  $("newWorkspace").onclick = async () => { state.workspace = createWorkspace(); await saveWorkspace(); renderAll(); };
  $("resetWorkspace").onclick = async () => { if (confirm("Reset saved workspace metadata? Imported DuckDB tables for this page session remain until reload.")) { state.workspace = createWorkspace(); await saveWorkspace(); renderAll(); } };
  $("copyDebug").onclick = () => copyText($("debugReport").textContent);
  $("downloadDebug").onclick = () => downloadText("quackviz-debug.json", $("debugReport").textContent);
  $("selfTest").onclick = runSelfTest;
  $("apiKey").onchange = () => setApiKey($("apiKey").value);
  $("aiEnabled").onchange = persistAiSettings;
  $("aiModel").onchange = persistAiSettings;
  $("systemPrompt").onchange = persistAiSettings;
  $("maxSampleRows").onchange = persistAiSettings;
  $("maxResultRows").onchange = persistAiSettings;
  $("refreshModels").onclick = refreshModels;
  $("requestAi").onclick = generateAiProposals;
}

function selectTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `${name}Tab`));
}

async function loadSample(url, tableName) {
  setStatus(`Loading ${tableName}...`);
  await importSample(url, tableName);
  await refreshTableState(tableName);
  setStatus(`Loaded ${tableName}`);
}

async function handleImport(file) {
  if (!file) return;
  setStatus(`Importing ${file.name}...`);
  const tableName = await importFile(file);
  await refreshTableState(tableName);
  setStatus(`Imported ${file.name}`);
}

async function refreshTableState(tableName) {
  const source = state.workspace.dataSources.find((s) => s.tableName === tableName);
  const columns = source.columns.map((c) => ({ name: c.column_name || c.name, type: c.column_type || c.type }));
  const profiles = await profileTable(tableName, source.columns);
  state.profiles[tableName] = profiles;
  source.profile = profiles;
  state.tables = state.workspace.dataSources.map((s) => ({ name: s.tableName, rowCount: s.rowCount, columns: s.columns }));
  if (!state.workspace.active.dataSourceId) state.workspace.active.dataSourceId = source.id;
  if (!state.workspace.queries.find((q) => q.sql.includes(`FROM ${tableName}`))) {
    $("sqlEditor").value = `SELECT * FROM ${tableName} LIMIT 100;`;
  }
  await saveWorkspace();
  renderAll();
  renderRecommendations(tableName);
}

async function runEditorSql() {
  const sql = $("sqlEditor").value;
  try {
    $("queryError").textContent = "";
    const result = await queryRows(sql);
    state.currentResult = { queryId: state.workspace.active.queryId, ...result };
    state.diagnostics.lastSqlError = "";
    $("queryRuntime").textContent = `Runtime: ${result.runtimeMs} ms`;
    $("queryRows").textContent = `Rows: ${result.rows.length}`;
    renderResultTable(result.rows, result.columns);
    renderDebug();
    return result;
  } catch (error) {
    state.diagnostics.lastSqlError = error.message;
    $("queryError").textContent = error.message;
    renderDebug();
    throw error;
  }
}

function saveCurrentQuery(name = "Saved query", sql = $("sqlEditor").value, createdBy = "user") {
  const existingId = state.workspace.active.queryId;
  const existing = state.workspace.queries.find((q) => q.id === existingId && q.sql === sql);
  const query = existing || { id: uid("query"), name, description: "", sql, parameters: [], sourceTables: [], createdBy, createdAt: nowIso(), updatedAt: nowIso(), lastRunAt: null, runCount: 0 };
  query.sql = sql;
  query.updatedAt = nowIso();
  upsertQuery(query);
  saveWorkspace();
  renderAll();
  return query;
}

async function applyBuilder() {
  const table = $("builderTable").value;
  const chartType = $("chartType").value;
  const params = { table, chartType, xField: $("xField").value, yField: $("yField").value, seriesField: $("seriesField").value || null, aggregation: $("aggregation").value, sortMode: $("sortMode").value, topN: Number($("topN").value || 0), dateBucket: $("dateBucket").value };
  const sql = buildQuery(params);
  $("sqlEditor").value = sql;
  const query = saveCurrentQuery(`${chartType} ${table}`, sql);
  const result = await runEditorSql();
  const spec = specFromBuilder({ queryId: query.id, chartType, yField: params.yField, aggregation: params.aggregation, seriesField: params.seriesField });
  spec.options.stack = $("stacking").checked;
  spec.options.labels = $("labels").checked;
  spec.options.legend = $("legend").checked;
  spec.options.tooltip = $("tooltip").checked ? "axis" : false;
  spec.options.zoom = $("zoom").checked;
  setCurrentSpec(spec);
  renderChart($("chart"), spec, result.rows, result.columns, activeTheme());
  selectTab("visualize");
}

async function applyRawSpec() {
  const spec = JSON.parse($("specEditor").value);
  setCurrentSpec(spec);
  const query = state.workspace.queries.find((q) => q.id === spec.dataset.queryId);
  if (!query) throw new Error("Spec queryId does not match a saved query.");
  $("sqlEditor").value = query.sql;
  const result = await runEditorSql();
  renderChart($("chart"), spec, result.rows, result.columns, activeTheme());
}

function setCurrentSpec(spec) {
  state.currentSpec = spec;
  $("specEditor").value = JSON.stringify(spec, null, 2);
}

function saveCurrentVisualization() {
  if (!state.currentSpec) return;
  const viz = { id: uid("viz"), name: state.currentSpec.title || "Visualization", description: "", question: "", queryId: state.currentSpec.dataset.queryId, spec: state.currentSpec, provenance: { createdBy: "user", model: null, createdAt: nowIso() }, createdAt: nowIso(), updatedAt: nowIso() };
  upsertVisualization(viz);
  saveWorkspace();
  renderAll();
}

function renderAll() {
  applyTheme();
  renderBrowser();
  renderSchema();
  renderBuilder();
  renderDebug();
}

function renderBrowser() {
  $("tableList").innerHTML = listItems(state.workspace.dataSources, (s) => `${s.tableName}<small>${s.rowCount} rows</small>`);
  $("queryList").innerHTML = listItems(state.workspace.queries, (q) => `${q.name}<small>${truncate(q.sql, 48)}</small>`);
  $("vizList").innerHTML = listItems(state.workspace.visualizations, (v) => `${v.name}<small>${v.spec.type}</small>`);
}

function listItems(items, html) {
  if (!items.length) return `<div class="empty">None</div>`;
  return items.map((item, index) => `<button class="object-item" data-index="${index}">${html(item)}</button>`).join("");
}

function selectTable(tableName) {
  const source = state.workspace.dataSources.find((s) => s.tableName === tableName);
  state.workspace.active.dataSourceId = source?.id || null;
  $("sqlEditor").value = `SELECT * FROM ${tableName} LIMIT 100;`;
  renderSchema();
  renderBuilder();
  renderRecommendations(tableName);
  selectTab("data");
}

function renderSchema() {
  const source = state.workspace.dataSources.find((s) => s.id === state.workspace.active.dataSourceId) || state.workspace.dataSources[0];
  if (!source) { $("schemaView").innerHTML = "Load a sample or import a file."; return; }
  const profiles = state.profiles[source.tableName] || [];
  $("schemaView").innerHTML = profiles.map((p) => `<article class="column-card"><h3>${p.name}</h3><p>${p.type} · ${p.semanticType}</p><dl><dt>Nulls</dt><dd>${p.nullCount}</dd><dt>Distinct</dt><dd>${p.distinctCount}</dd><dt>Min</dt><dd>${truncate(p.min)}</dd><dt>Max</dt><dd>${truncate(p.max)}</dd><dt>Avg</dt><dd>${truncate(p.average)}</dd></dl><small>${p.topValues.map((v) => `${truncate(v.value, 18)} (${v.count})`).join(", ")}</small></article>`).join("");
}

function renderBuilder() {
  const sources = state.workspace.dataSources;
  $("builderTable").innerHTML = sources.map((s) => `<option value="${s.tableName}">${s.tableName}</option>`).join("");
  const source = sources.find((s) => s.id === state.workspace.active.dataSourceId) || sources[0];
  const profiles = source ? state.profiles[source.tableName] || [] : [];
  const options = `<option value=""></option>${profiles.map((p) => `<option value="${p.name}">${p.name} · ${p.semanticType}</option>`).join("")}`;
  $("xField").innerHTML = options;
  $("yField").innerHTML = options;
  $("seriesField").innerHTML = options;
  const firstCat = profiles.find((p) => p.semanticType === "category") || profiles[0];
  const firstNum = profiles.find((p) => p.semanticType === "numeric" || p.semanticType === "currency") || profiles[1] || profiles[0];
  if (firstCat) $("xField").value = firstCat.name;
  if (firstNum) $("yField").value = firstNum.name;
}

function renderResultTable(rows, columns) {
  if (!rows.length) { $("resultsTable").innerHTML = "Query returned no rows."; return; }
  $("resultsTable").innerHTML = `<table><thead><tr>${columns.map((c) => `<th>${c.name}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, 500).map((r) => `<tr>${columns.map((c) => `<td>${truncate(r[c.name])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function renderRecommendations(tableName) {
  const profiles = state.profiles[tableName] || [];
  const recs = recommendVisualizations(tableName, profiles);
  $("recommendations").innerHTML = recs.map((r, i) => `<button class="rec-card" data-index="${i}"><strong>${r.chartType}</strong><span>${Math.round(r.confidence * 100)}%</span><p>${r.reason}</p></button>`).join("");
  $("recommendations").querySelectorAll(".rec-card").forEach((button) => button.onclick = async () => {
    const rec = recs[Number(button.dataset.index)];
    $("sqlEditor").value = rec.sql;
    const query = saveCurrentQuery(`${rec.chartType} recommendation`, rec.sql, "system");
    const result = await runEditorSql();
    const spec = rec.makeSpec(query.id);
    setCurrentSpec(spec);
    renderChart($("chart"), spec, result.rows, result.columns, activeTheme());
  });
}

function applyTheme() {
  document.documentElement.dataset.theme = activeTheme();
}

function syncSettingsToUi() {
  applyTheme();
  $("apiKey").value = getApiKey();
  const ai = state.workspace.settings.ai;
  $("aiEnabled").checked = ai.enabled;
  $("aiModel").innerHTML = `<option value="${ai.model}">${ai.model}</option>`;
  $("systemPrompt").value = ai.systemPrompt || "";
  $("maxSampleRows").value = ai.maxSampleRows ?? 0;
  $("maxResultRows").value = ai.maxResultRows ?? 500;
}

async function persistAiSettings() {
  state.workspace.settings.ai = { enabled: $("aiEnabled").checked, model: $("aiModel").value, systemPrompt: $("systemPrompt").value, maxSampleRows: Number($("maxSampleRows").value), maxResultRows: Number($("maxResultRows").value) };
  await saveWorkspace();
}

async function refreshModels() {
  const models = await fetchModels(getApiKey());
  $("aiModel").innerHTML = models.slice(0, 100).map((m) => `<option value="${m.id}">${m.id}</option>`).join("");
  await persistAiSettings();
}

async function generateAiProposals() {
  await persistAiSettings();
  if (!state.workspace.settings.ai.enabled) throw new Error("AI is disabled.");
  try {
    const payload = await requestAiProposals({ apiKey: getApiKey(), model: $("aiModel").value, systemPrompt: $("systemPrompt").value, workspace: state.workspace, tables: state.tables, profiles: state.profiles });
    $("aiCards").innerHTML = payload.visualizations.map((p, i) => `<article class="proposal"><h3>${p.title}</h3><p>${p.question || ""}</p><p>${p.description || ""}</p><p>${p.why || ""}</p><pre>${p.sql}</pre><small>${p.spec?.type || ""} · ${(p.expectedColumns || []).map((c) => c.name).join(", ")}</small><div class="button-row"><button data-action="validate" data-index="${i}">Validate SQL</button><button data-action="preview" data-index="${i}">Preview</button><button data-action="save" data-index="${i}">Save</button><button data-action="reject" data-index="${i}">Reject</button></div></article>`).join("");
    $("aiCards").querySelectorAll("button").forEach((button) => button.onclick = async () => {
      const p = payload.visualizations[Number(button.dataset.index)];
      if (button.dataset.action === "reject") { button.closest(".proposal").remove(); return; }
      const safe = validateAnalyticalSql(p.sql);
      if (!safe.valid) throw new Error(safe.errors.join(" "));
      await explain(safe.sql);
      if (button.dataset.action === "validate") return;
      $("sqlEditor").value = previewSql(safe.sql, Number($("maxResultRows").value));
      if (button.dataset.action === "preview") { selectTab("sql"); return; }
      const query = saveCurrentQuery(p.title, safe.sql, "ai");
      const spec = { ...p.spec, dataset: { queryId: query.id } };
      setCurrentSpec(spec);
      saveCurrentVisualization();
      selectTab("visualize");
    });
  } catch (error) {
    state.diagnostics.lastAiError = error.message;
    renderDebug();
    throw error;
  }
}

async function runSelfTest() {
  try {
    await initDuckDb();
    await queryRows("CREATE OR REPLACE TEMP TABLE qv_self_test AS SELECT 1 AS x, 2 AS y");
    await queryRows("SELECT * FROM qv_self_test");
    const query = saveCurrentQuery("Self-test query", "SELECT 1 AS x, 2 AS y", "system");
    const spec = specFromBuilder({ queryId: query.id, chartType: "vertical-bar", yField: "y", aggregation: "sum" });
    renderChart($("chart"), spec, [{ x_value: "ok", sum_y: 2 }], [{ name: "x_value" }, { name: "sum_y" }], activeTheme());
    const exported = exportWorkspace();
    importWorkspace(exported);
    await saveWorkspace();
    state.diagnostics.selfTest = "passed";
  } catch (error) {
    state.diagnostics.selfTest = `failed: ${error.message}`;
  }
  renderAll();
}

function renderDebug() {
  state.diagnostics.echartsVersion = window.echarts?.version || "not loaded";
  $("debugReport").textContent = JSON.stringify({
    appVersion: APP_VERSION,
    duckdbVersion: state.diagnostics.duckdbVersion,
    echartsVersion: state.diagnostics.echartsVersion,
    capabilities: { fileApi: Boolean(window.FileReader), opfs: state.diagnostics.opfs, indexedDb: state.diagnostics.indexedDb, clipboard: Boolean(navigator.clipboard) },
    loadedTableCount: state.workspace.dataSources.length,
    savedQueryCount: state.workspace.queries.length,
    savedVisualizationCount: state.workspace.visualizations.length,
    currentWorkspaceId: state.workspace.id,
    lastQueryRuntime: state.currentResult.runtimeMs,
    lastSqlError: state.diagnostics.lastSqlError,
    lastAiError: state.diagnostics.lastAiError,
    currentAiModel: state.workspace.settings.ai.model,
    selfTest: state.diagnostics.selfTest,
  }, null, 2);
}

function setStatus(text) {
  $("dataStatus").textContent = text;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest(".object-item");
  if (!button) return;
  const list = button.parentElement.id;
  const index = Number(button.dataset.index);
  if (list === "tableList") selectTable(state.workspace.dataSources[index].tableName);
  if (list === "queryList") { const q = state.workspace.queries[index]; state.workspace.active.queryId = q.id; $("sqlEditor").value = q.sql; selectTab("sql"); }
  if (list === "vizList") {
    const v = state.workspace.visualizations[index];
    state.workspace.active.visualizationId = v.id;
    setCurrentSpec(v.spec);
    const q = state.workspace.queries.find((item) => item.id === v.queryId);
    if (q) {
      $("sqlEditor").value = q.sql;
      runEditorSql().then((result) => {
        renderChart($("chart"), v.spec, result.rows, result.columns, activeTheme());
        selectTab("visualize");
      });
    }
  }
});
