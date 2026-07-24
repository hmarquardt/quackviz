import { APP_VERSION, BUILD_DATE, DEFAULT_AI_SETTINGS, WORKSPACE_SCHEMA_VERSION } from "./constants.js";
import { normalizeDashboard } from "./dashboard.js";
import { normalizeReport } from "./report.js";
import { deepClone, nowIso, uid } from "./utils.js";

export function createWorkspace(overrides = {}) {
  const timestamp = nowIso();
  return hydrateWorkspace({
    version: WORKSPACE_SCHEMA_VERSION,
    id: uid("workspace"),
    name: "Default Workspace",
    createdAt: timestamp,
    updatedAt: timestamp,
    dataSources: [],
    queries: [],
    visualizations: [],
    dashboards: [],
    reports: [],
    active: {
      dataSourceId: null,
      queryId: null,
      visualizationId: null,
      dashboardId: null,
      reportId: null,
    },
    settings: {
      theme: "system",
      reducedMotion: false,
      ai: DEFAULT_AI_SETTINGS,
    },
    aiHistory: [],
    metadata: {
      appVersion: APP_VERSION,
      buildDate: BUILD_DATE,
    },
    ...overrides,
  });
}

export function hydrateWorkspace(input) {
  if (!input || typeof input !== "object") throw new Error("Stored workspace is not an object.");
  if (input.version > WORKSPACE_SCHEMA_VERSION) throw new Error(`Unsupported future workspace version ${input.version}.`);
  if (input.version !== WORKSPACE_SCHEMA_VERSION) throw new Error(`Unsupported workspace version ${input.version}.`);
  const timestamp = nowIso();
  const workspace = {
    version: WORKSPACE_SCHEMA_VERSION,
    id: typeof input.id === "string" ? input.id : uid("workspace"),
    name: typeof input.name === "string" ? input.name : "Default Workspace",
    createdAt: typeof input.createdAt === "string" ? input.createdAt : timestamp,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : timestamp,
    dataSources: Array.isArray(input.dataSources) ? input.dataSources.map(hydrateDataSource) : [],
    queries: Array.isArray(input.queries) ? input.queries.map(hydrateQuery) : [],
    visualizations: Array.isArray(input.visualizations) ? input.visualizations.map((viz) => hydrateVisualization(viz, input.queries || [])) : [],
    dashboards: Array.isArray(input.dashboards) ? input.dashboards.map(normalizeDashboard) : [],
    reports: Array.isArray(input.reports) ? input.reports.map(normalizeReport) : [],
    aiHistory: Array.isArray(input.aiHistory) ? input.aiHistory.map(sanitizeAiHistoryItem).slice(-100) : [],
    metadata: {
      appVersion: APP_VERSION,
      buildDate: BUILD_DATE,
    },
    active: {
      dataSourceId: input.active?.dataSourceId ?? null,
      queryId: input.active?.queryId ?? null,
      visualizationId: input.active?.visualizationId ?? null,
      dashboardId: input.active?.dashboardId ?? null,
      reportId: input.active?.reportId ?? null,
    },
    settings: {
      theme: ["system", "light", "dark"].includes(input.settings?.theme) ? input.settings.theme : "system",
      reducedMotion: Boolean(input.settings?.reducedMotion),
      ai: hydrateAiSettings(input.settings?.ai),
    },
  };
  return workspace;
}

function hydrateAiSettings(settings = {}) {
  return {
    ...DEFAULT_AI_SETTINGS,
    ...settings,
    enabled: Boolean(settings.enabled),
    provider: "openrouter",
    contextMode: ["metadata", "profiles", "sampleRows"].includes(settings.contextMode) ? settings.contextMode : DEFAULT_AI_SETTINGS.contextMode,
    temperature: Number.isFinite(Number(settings.temperature)) ? Number(settings.temperature) : DEFAULT_AI_SETTINGS.temperature,
    maxOutputTokens: Number(settings.maxOutputTokens || DEFAULT_AI_SETTINGS.maxOutputTokens),
    maxSchemaColumns: Number(settings.maxSchemaColumns || DEFAULT_AI_SETTINGS.maxSchemaColumns),
    maxProfileValues: Number(settings.maxProfileValues || DEFAULT_AI_SETTINGS.maxProfileValues),
    maxSampleRows: Number(settings.maxSampleRows || 0),
    maxResultRows: Number(settings.maxResultRows || DEFAULT_AI_SETTINGS.maxResultRows),
    timeoutMs: Number(settings.timeoutMs || DEFAULT_AI_SETTINGS.timeoutMs),
  };
}

function sanitizeAiHistoryItem(item) {
  return {
    id: item.id || uid("ai"),
    timestamp: item.timestamp || nowIso(),
    action: item.action || "unknown",
    provider: item.provider || "openrouter",
    model: item.model || "",
    selectedTables: Array.isArray(item.selectedTables) ? item.selectedTables : [],
    contextMode: item.contextMode || "metadata",
    sampleRowsIncluded: Boolean(item.sampleRowsIncluded),
    userQuestion: item.userQuestion || "",
    summary: item.summary || "",
    proposalIds: Array.isArray(item.proposalIds) ? item.proposalIds : [],
    usage: item.usage || null,
    diagnostics: item.diagnostics || {},
    status: item.status || "complete",
    error: item.error || null,
  };
}

function hydrateDataSource(source) {
  return {
    id: source.id || uid("source"),
    name: source.name || source.tableName || "Data source",
    tableName: source.tableName,
    sourceType: source.sourceType || "sample",
    fileName: source.fileName || "",
    rowCount: Number(source.rowCount || 0),
    columns: Array.isArray(source.columns) ? source.columns.map((column) => ({
      name: column.name || column.column_name,
      duckType: column.duckType || column.column_type || column.type || "UNKNOWN",
      nullable: column.nullable !== false,
    })) : [],
    importedAt: source.importedAt || null,
    available: false,
  };
}

function hydrateQuery(query) {
  return {
    id: query.id || uid("query"),
    name: query.name || "Untitled query",
    description: query.description || "",
    sql: query.sql || "",
    parameters: Array.isArray(query.parameters) ? query.parameters : [],
    sourceTables: Array.isArray(query.sourceTables) ? query.sourceTables : [],
    createdBy: query.createdBy || "user",
    createdAt: query.createdAt || nowIso(),
    updatedAt: query.updatedAt || nowIso(),
    lastRunAt: query.lastRunAt || null,
    runCount: Number(query.runCount || 0),
  };
}

function hydrateVisualization(viz, queries) {
  const queryIds = new Set(queries.map((query) => query.id));
  if (viz.queryId && !queryIds.has(viz.queryId)) throw new Error(`Visualization ${viz.id || "(unknown)"} references missing query ${viz.queryId}.`);
  return {
    id: viz.id || uid("viz"),
    name: viz.name || "Untitled visualization",
    description: viz.description || "",
    question: viz.question || "",
    queryId: viz.queryId || viz.spec?.dataset?.queryId,
    spec: deepClone(viz.spec || {}),
    provenance: {
      createdBy: viz.provenance?.createdBy || "user",
      model: viz.provenance?.model ?? null,
      createdAt: viz.provenance?.createdAt || viz.createdAt || nowIso(),
    },
    createdAt: viz.createdAt || nowIso(),
    updatedAt: viz.updatedAt || nowIso(),
  };
}

export function serializeWorkspace(workspace) {
  return deepClone(workspace);
}

export function addOrUpdateDataSource(workspace, source) {
  const next = { ...source };
  const index = workspace.dataSources.findIndex((item) => item.sourceType === next.sourceType && item.tableName === next.tableName);
  if (index >= 0) {
    next.id = workspace.dataSources[index].id;
    workspace.dataSources[index] = { ...workspace.dataSources[index], ...next };
  } else {
    workspace.dataSources.push(next);
  }
  workspace.active.dataSourceId = next.id;
  workspace.updatedAt = nowIso();
  return next;
}

export function addOrUpdateQuery(workspace, input, activeQueryId = null) {
  const timestamp = nowIso();
  const existing = activeQueryId ? workspace.queries.find((query) => query.id === activeQueryId) : null;
  const query = {
    id: existing?.id || input.id || uid("query"),
    name: input.name || existing?.name || "Untitled query",
    description: input.description ?? existing?.description ?? "",
    sql: input.sql ?? existing?.sql ?? "",
    parameters: input.parameters || existing?.parameters || [],
    sourceTables: input.sourceTables || existing?.sourceTables || inferSourceTables(input.sql || existing?.sql || ""),
    createdBy: input.createdBy || existing?.createdBy || "user",
    createdAt: existing?.createdAt || input.createdAt || timestamp,
    updatedAt: timestamp,
    lastRunAt: input.lastRunAt ?? existing?.lastRunAt ?? null,
    runCount: input.runCount ?? existing?.runCount ?? 0,
    provenance: input.provenance || existing?.provenance || null,
  };
  const index = workspace.queries.findIndex((item) => item.id === query.id);
  if (index >= 0) workspace.queries[index] = query;
  else workspace.queries.push(query);
  workspace.active.queryId = query.id;
  workspace.updatedAt = timestamp;
  return query;
}

export function addOrUpdateVisualization(workspace, input, activeVisualizationId = null) {
  if (!workspace.queries.some((query) => query.id === input.queryId)) {
    throw new Error(`Cannot save visualization because query ${input.queryId} is not saved.`);
  }
  const timestamp = nowIso();
  const existing = activeVisualizationId ? workspace.visualizations.find((viz) => viz.id === activeVisualizationId) : null;
  const viz = {
    id: existing?.id || input.id || uid("viz"),
    name: input.name || existing?.name || "Untitled visualization",
    description: input.description ?? existing?.description ?? "",
    question: input.question ?? existing?.question ?? "",
    queryId: input.queryId,
    spec: deepClone(input.spec),
    provenance: input.provenance || existing?.provenance || { createdBy: "user", model: null, createdAt: timestamp },
    createdAt: existing?.createdAt || input.createdAt || timestamp,
    updatedAt: timestamp,
  };
  const index = workspace.visualizations.findIndex((item) => item.id === viz.id);
  if (index >= 0) workspace.visualizations[index] = viz;
  else workspace.visualizations.push(viz);
  workspace.active.visualizationId = viz.id;
  workspace.updatedAt = timestamp;
  return viz;
}

export function inferSourceTables(sql) {
  const tables = [];
  const pattern = /\b(?:FROM|JOIN)\s+("?)([a-zA-Z_][\w]*)\1/gi;
  let match = pattern.exec(sql || "");
  while (match) {
    if (!tables.includes(match[2])) tables.push(match[2]);
    match = pattern.exec(sql || "");
  }
  return tables;
}

export function exportWorkspace(workspace) {
  return JSON.stringify(serializeWorkspace(workspace), null, 2);
}

export function addAiHistory(workspace, item) {
  workspace.aiHistory = [sanitizeAiHistoryItem(item), ...(workspace.aiHistory || [])].slice(0, 100);
  workspace.updatedAt = nowIso();
  return workspace.aiHistory[0];
}
