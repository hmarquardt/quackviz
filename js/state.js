import { nowIso, uid } from "./utils.js";

export function createWorkspace() {
  const id = uid("workspace");
  return {
    id,
    version: 1,
    name: "QuackViz workspace",
    dataSources: [],
    queries: [],
    visualizations: [],
    dashboards: [],
    active: {
      dataSourceId: null,
      queryId: null,
      visualizationId: null,
      dashboardId: null,
    },
    settings: {
      theme: "dark",
      ai: {
        enabled: false,
        model: "openai/gpt-4.1-mini",
        systemPrompt: "",
        maxSampleRows: 0,
        maxResultRows: 500,
      },
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export const state = {
  workspace: createWorkspace(),
  tables: [],
  profiles: {},
  currentResult: { queryId: null, rows: [], columns: [], runtimeMs: null },
  currentSpec: null,
  diagnostics: {
    duckdbVersion: "unknown",
    echartsVersion: "unknown",
    opfs: false,
    indexedDb: "unknown",
    lastSqlError: "",
    lastAiError: "",
    selfTest: "not run",
  },
};

export function touchWorkspace() {
  state.workspace.updatedAt = nowIso();
}

export function upsertQuery(query) {
  const index = state.workspace.queries.findIndex((item) => item.id === query.id);
  if (index >= 0) state.workspace.queries[index] = query;
  else state.workspace.queries.push(query);
  state.workspace.active.queryId = query.id;
  touchWorkspace();
}

export function upsertVisualization(viz) {
  const index = state.workspace.visualizations.findIndex((item) => item.id === viz.id);
  if (index >= 0) state.workspace.visualizations[index] = viz;
  else state.workspace.visualizations.push(viz);
  state.workspace.active.visualizationId = viz.id;
  touchWorkspace();
}

export function addDataSource(source) {
  const existing = state.workspace.dataSources.find((item) => item.tableName === source.tableName);
  if (!existing) state.workspace.dataSources.push(source);
  state.workspace.active.dataSourceId = source.id;
  touchWorkspace();
}

