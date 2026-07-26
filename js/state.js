import { createWorkspace } from "./workspace.js";
import { nowIso, uid } from "./utils.js";

const listeners = new Set();
const TOAST_LIMIT = 3;
const TOAST_DISMISS_MS = {
  success: 4000,
  info: 6000,
};

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
  dataImport: {
    source: null,
    pendingFiles: [],
    proposedTableName: "",
    detectedFormat: "",
    selectedFormat: "auto",
    options: {
      header: true,
      replace: true,
      mode: "standard",
    },
    status: {
      stage: "idle",
      message: "",
      progress: null,
      warning: "",
      error: "",
      elapsedMs: null,
      cancelled: false,
    },
    preview: {
      columns: [],
      rows: [],
    },
  },
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
  interaction: {
    lastEvent: null,
    lastResolution: null,
    lastDurationMs: null,
    cardsRequeried: [],
    cardsHighlighted: [],
    lastLoopPreventionEvent: null,
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
    modelSearch: "",
    modelProvider: "all",
    favoriteModelIds: [],
    recentModelIds: [],
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
  packaging: {
    lastMode: null,
    lastDataMode: null,
    lastPackageSize: null,
    lastRuntimeSize: null,
    lastDataSize: null,
    lastBoundarySize: null,
    lastArtifactCount: 0,
    lastTableCount: 0,
    lastHashCount: 0,
    lastIntegrityResult: null,
    lastExportAt: null,
    lastImportAt: null,
    lastMigration: null,
    installedExtensionCount: 0,
    enabledExtensionCount: 0,
    templateCount: 0,
    lastTemplateApplied: null,
    lastStandaloneRuntimeTest: null,
    lastEmbedMessage: null,
    lastError: null,
    templates: [],
    extensions: [],
  },
  startup: {
    safeMode: false,
    phase: "not-started",
    durationMs: null,
    capabilities: null,
    vendorStatus: null,
  },
  performance: {
    summary: null,
  },
  workers: {
    status: null,
  },
  recovery: {
    checkpoints: [],
    journal: [],
    lastCheckpointAt: null,
    lastJournalAt: null,
    status: "ready",
    workspaceValidation: null,
    lastSupportBundleAt: null,
  },
  product: {
    welcomeOpen: false,
    helpOpen: false,
    aboutOpen: false,
    commandPaletteOpen: false,
    commandQuery: "",
    activeHelpTopicId: "getting-started",
    lastFocusedElement: null,
    onboarding: null,
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

export function addStatus(source, operation, message, level = "success") {
  const timestamp = nowIso();
  const item = {
    id: uid("toast"),
    source,
    operation,
    message,
    level: ["success", "info", "warning"].includes(level) ? level : "info",
    timestamp,
    dismissedAt: null,
  };
  state.statuses = state.statuses.filter((status) => (
    status.source !== source || status.operation !== operation || status.message !== message
  ));
  state.statuses.unshift(item);
  state.statuses = state.statuses.slice(0, 20);
  notify();
  const dismissAfter = TOAST_DISMISS_MS[item.level];
  if (dismissAfter) {
    setTimeout(() => {
      if (!item.dismissedAt) dismissToast(item.id, "status");
    }, dismissAfter);
  }
  return item;
}

export function addError(source, operation, error) {
  const item = {
    id: uid("toast"),
    source,
    operation,
    message: error?.message || String(error),
    detail: error?.stack || "",
    level: "error",
    timestamp: nowIso(),
    dismissedAt: null,
  };
  state.errors = state.errors.filter((existing) => (
    existing.source !== source || existing.operation !== operation || existing.message !== item.message
  ));
  state.errors.unshift(item);
  state.errors = state.errors.slice(0, 20);
  notify();
  return item;
}

export function dismissToast(id, kind) {
  const collection = kind === "error" ? state.errors : state.statuses;
  const item = collection.find((candidate) => candidate.id === id);
  if (!item || item.dismissedAt) return false;
  item.dismissedAt = nowIso();
  notify();
  return true;
}

export function visibleToasts() {
  return [
    ...state.errors.filter((item) => !item.dismissedAt).map((item) => ({ ...item, kind: "error" })),
    ...state.statuses.filter((item) => !item.dismissedAt).map((item) => ({ ...item, kind: "status" })),
  ]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, TOAST_LIMIT);
}

export function markTableLoaded(tableName, loaded = true) {
  if (loaded) state.loadedTables.add(tableName);
  else state.loadedTables.delete(tableName);
  notify();
}
