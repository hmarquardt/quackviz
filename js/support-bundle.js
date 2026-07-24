import { APP_VERSION, BUILD_DATE } from "./constants.js";
import { validateWorkspaceIntegrity } from "./workspace-validation.js";

const SECRET_PATTERNS = [/sk-[a-z0-9_-]+/gi, /authorization/gi, /apiKey/gi];

export function createSupportBundle({ state, capabilities, vendorStatus, performanceSummary, workerStatus, recoverySummary }) {
  const workspace = state.workspace || {};
  const bundle = {
    format: "quackviz-support-bundle",
    formatVersion: 1,
    appVersion: APP_VERSION,
    buildDate: BUILD_DATE,
    generatedAt: new Date().toISOString(),
    browser: typeof navigator !== "undefined" ? { userAgent: navigator.userAgent, language: navigator.language } : null,
    capabilities,
    vendorStatus,
    performance: performanceSummary,
    workerStatus,
    recovery: recoverySummary,
    storage: { indexedDb: state.storageStatus?.indexedDb, lastSavedAt: state.storageStatus?.lastSavedAt, lastError: state.storageStatus?.lastError },
    workspace: {
      id: workspace.id,
      version: workspace.version,
      metadata: workspace.metadata,
      counts: {
        dataSources: workspace.dataSources?.length || 0,
        queries: workspace.queries?.length || 0,
        visualizations: workspace.visualizations?.length || 0,
        dashboards: workspace.dashboards?.length || 0,
        reports: workspace.reports?.length || 0,
        aiHistory: workspace.aiHistory?.length || 0,
      },
      validation: validateWorkspaceIntegrity(workspace),
    },
    recentErrors: (state.errors || []).slice(0, 10).map(redactObject),
    footerVersion: `v${APP_VERSION} (${BUILD_DATE})`,
  };
  return redactObject(bundle);
}

export function redactObject(value) {
  if (value == null || typeof value !== "object") return redactString(value);
  if (Array.isArray(value)) return value.map(redactObject);
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (/api.?key|authorization|secret|token/i.test(key)) out[key] = "[redacted]";
    else out[key] = redactObject(item);
  }
  return out;
}

function redactString(value) {
  if (typeof value !== "string") return value;
  return SECRET_PATTERNS.reduce((next, pattern) => next.replace(pattern, "[redacted]"), value);
}
