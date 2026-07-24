import { createWorkspace } from "./workspace.js";
import { nowIso } from "./utils.js";

const listeners = new Set();

export const state = {
  workspace: createWorkspace(),
  dbStatus: {
    initialized: false,
    initializing: false,
    connection: "not-started",
    selectedBundle: null,
    packageVersion: null,
    runtimeVersion: "unknown",
    error: null,
  },
  storageStatus: {
    indexedDb: "unknown",
    lastSavedAt: null,
    lastError: null,
  },
  rendererStatus: {
    echartsPackageVersion: null,
    echartsRuntimeVersion: "not loaded",
    error: null,
  },
  loadedTables: new Set(),
  currentResult: null,
  currentSpec: null,
  currentOption: null,
  dashboard: {
    selectedCardId: null,
    cardStates: {},
    refreshing: false,
    lastRefresh: null,
    lastExportAt: null,
    lastSnapshotAt: null,
    lastError: null,
  },
  report: {
    selectedSectionId: null,
    sectionStates: {},
    refreshing: false,
    lastRefresh: null,
    lastHtmlExportAt: null,
    lastMarkdownExportAt: null,
    lastPackageExportAt: null,
    lastPrintAt: null,
    lastError: null,
  },
  map: {
    lastDiagnostics: null,
    lastCoordinateProfile: null,
    lastExportAt: null,
    lastError: null,
  },
  ai: {
    apiKeyConfigured: false,
    modelList: [],
    modelListRefreshedAt: null,
    modelListError: null,
    selectedTables: [],
    contextPreview: "",
    contextWarnings: [],
    currentResult: null,
    proposals: [],
    selectedProposalId: null,
    lastDiagnostics: null,
    lastParseError: null,
    lastSqlSafetyError: null,
    lastRepairAttemptCount: 0,
  },
  activeTab: "data",
  statuses: [],
  errors: [],
  selfTest: [],
};

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify() {
  for (const listener of listeners) listener(state);
}

export function setWorkspace(workspace) {
  state.workspace = workspace;
  notify();
}

export function updateWorkspace(mutator) {
  mutator(state.workspace);
  state.workspace.updatedAt = nowIso();
  notify();
}

export function setActive(partial) {
  updateWorkspace((workspace) => {
    workspace.active = { ...workspace.active, ...partial };
  });
}

export function setCurrentResult(result) {
  state.currentResult = result;
  notify();
}

export function setCurrentSpec(spec) {
  state.currentSpec = spec;
  notify();
}

export function setCurrentOption(option) {
  state.currentOption = option;
  notify();
}

export function addStatus(source, operation, message) {
  state.statuses.unshift({ source, operation, message, timestamp: nowIso() });
  state.statuses = state.statuses.slice(0, 20);
  notify();
}

export function addError(source, operation, error) {
  const item = {
    source,
    operation,
    message: error?.message || String(error),
    detail: error?.stack || "",
    timestamp: nowIso(),
  };
  state.errors.unshift(item);
  state.errors = state.errors.slice(0, 20);
  notify();
  return item;
}

export function markTableLoaded(tableName, loaded = true) {
  if (loaded) state.loadedTables.add(tableName);
  else state.loadedTables.delete(tableName);
  notify();
}
