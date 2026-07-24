import { APP_VERSION, BUILD_DATE, DEPENDENCIES, PACKAGE_DATA_MODES, PACKAGE_FORMAT_VERSION, PACKAGE_MODES, WORKSPACE_SCHEMA_VERSION } from "./constants.js";
import { resolvePackageDependencies } from "./package-dependencies.js";
import { createExternalDataRequirements, createIncludedData, createPreAggregatedPlan, createColumnPrunedExtractPlan, privacyReview } from "./package-data.js";
import { createIntegrity, verifyIntegrity } from "./package-integrity.js";
import { migratePackage } from "./package-migrations.js";
import { hydrateWorkspace, serializeWorkspace } from "./workspace.js";
import { deepClone, nowIso, uid } from "./utils.js";

export async function createPortablePackage(workspace, options = {}) {
  const packageMode = normalizeChoice(options.packageMode, PACKAGE_MODES, "workspace-backup");
  const dataMode = normalizeChoice(options.dataMode, PACKAGE_DATA_MODES, "external");
  const selection = selectionFor(workspace, options.selection || {}, packageMode);
  const plan = resolvePackageDependencies(workspace, selection);
  const artifacts = collectArtifacts(workspace, plan.required);
  const data = await packageData(workspace, plan, dataMode, options.tableRows || {});
  const privacy = privacyReview(workspace, plan, { dataMode, includeAiHistory: options.includeAiHistory, capabilities: options.capabilities });
  const workspacePayload = packageMode === "workspace-backup" ? sanitizeWorkspace(workspace, options) : minimalWorkspace(workspace, artifacts);
  const manifest = createManifest({ workspace, packageMode, dataMode, plan, artifacts, data, options, privacy });
  const files = [
    { path: "manifest.json", content: JSON.stringify(manifest), critical: true },
    { path: "workspace.json", content: JSON.stringify(workspacePayload), critical: true },
    { path: "artifacts.json", content: JSON.stringify(artifacts), critical: true },
    { path: "data.json", content: JSON.stringify(data), critical: dataMode === "included" },
  ];
  manifest.integrity = await createIntegrity(files);
  return {
    format: "quackviz-package",
    formatVersion: PACKAGE_FORMAT_VERSION,
    manifest,
    workspace: workspacePayload,
    artifacts,
    data,
    assets: { boundaries: plan.required.boundaries || [], images: [] },
    extensions: artifacts.extensions || [],
  };
}

export function validatePortablePackage(input) {
  const errors = [];
  const warnings = [];
  let pkg = null;
  try {
    pkg = migratePackage(input).package;
  } catch (error) {
    return { valid: false, errors: [{ path: "$", message: error.message }], warnings, package: null };
  }
  if (pkg.formatVersion !== PACKAGE_FORMAT_VERSION) errors.push({ path: "formatVersion", message: "Unsupported package format version." });
  if (!pkg.manifest?.createdBy?.appVersion) errors.push({ path: "manifest.createdBy.appVersion", message: "Package app version is required." });
  if (!PACKAGE_MODES.includes(pkg.manifest?.packageMode)) errors.push({ path: "manifest.packageMode", message: "Unsupported package mode." });
  if (!PACKAGE_DATA_MODES.includes(pkg.manifest?.dataMode)) errors.push({ path: "manifest.dataMode", message: "Unsupported data mode." });
  if (containsSecret(pkg)) errors.push({ path: "$", message: "Package appears to contain a secret or API key." });
  if (containsExecutable(pkg)) errors.push({ path: "$", message: "Package metadata must not contain executable JavaScript or HTML script tags." });
  if (!pkg.workspace || typeof pkg.workspace !== "object") errors.push({ path: "workspace", message: "Workspace payload is required." });
  if (!pkg.artifacts || typeof pkg.artifacts !== "object") errors.push({ path: "artifacts", message: "Artifacts payload is required." });
  return { valid: errors.length === 0, errors, warnings, package: pkg };
}

export async function verifyPortablePackageIntegrity(pkg) {
  const manifestForHash = { ...pkg.manifest, integrity: {} };
  return verifyIntegrity([
    { path: "manifest.json", content: JSON.stringify(manifestForHash) },
    { path: "workspace.json", content: JSON.stringify(pkg.workspace) },
    { path: "artifacts.json", content: JSON.stringify(pkg.artifacts) },
    { path: "data.json", content: JSON.stringify(pkg.data) },
  ], pkg.manifest?.integrity);
}

export function inspectPortablePackage(pkg) {
  const validation = validatePortablePackage(pkg);
  const manifest = validation.package?.manifest || {};
  return {
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
    name: manifest.name || "",
    format: validation.package?.format,
    formatVersion: validation.package?.formatVersion,
    createdBy: manifest.createdBy,
    packageMode: manifest.packageMode,
    dataMode: manifest.dataMode,
    artifactCounts: manifest.artifactCounts || {},
    tableCount: manifest.tableCount || 0,
    capabilities: manifest.capabilities || {},
    privacy: manifest.privacy || {},
    integrityFileCount: manifest.integrity?.files?.length || 0,
  };
}

export function importPortablePackage(currentWorkspace, pkg, { mode = "merge" } = {}) {
  const validation = validatePortablePackage(pkg);
  if (!validation.valid) throw new Error(validation.errors[0]?.message || "Package is invalid.");
  const imported = hydrateWorkspace(validation.package.workspace);
  if (mode === "replace") return { workspace: imported, imported: true, summary: "Workspace replaced from package." };
  const next = deepClone(currentWorkspace);
  mergeById(next.queries, imported.queries || []);
  mergeById(next.visualizations, imported.visualizations || []);
  mergeById(next.dashboards, imported.dashboards || []);
  mergeById(next.reports, imported.reports || []);
  mergeById(next.dataSources, imported.dataSources || []);
  next.updatedAt = nowIso();
  return { workspace: hydrateWorkspace(next), imported: true, summary: "Package artifacts merged into workspace." };
}

function createManifest({ workspace, packageMode, dataMode, plan, artifacts, data, options, privacy }) {
  const artifactCounts = Object.fromEntries(Object.entries(artifacts).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0]));
  const dataSize = JSON.stringify(data).length;
  return {
    id: options.id || uid("package"),
    name: options.name || workspace.name || "QuackViz package",
    description: options.description || "",
    createdAt: nowIso(),
    createdBy: { app: "QuackViz", appVersion: APP_VERSION, buildDate: BUILD_DATE },
    packageMode,
    dataMode,
    workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION,
    entrypoints: options.entrypoints || defaultEntrypoints(plan.required),
    capabilities: {
      filters: true,
      crossFiltering: true,
      drilldown: true,
      queryEditing: false,
      dataExport: false,
      openInQuackViz: true,
      ...(options.capabilities || {}),
    },
    dependencies: Object.values(DEPENDENCIES).map((dep) => ({ packageName: dep.packageName, version: dep.version })),
    artifactCounts,
    tableCount: Object.keys(data.tables || data.requirements || {}).length || (plan.required.dataSources || []).length,
    dataSize,
    boundaryAssets: plan.required.boundaries || [],
    extensions: plan.required.extensions || [],
    licenses: [],
    attribution: [],
    privacy,
    integrity: {},
    dataFingerprints: Object.fromEntries(Object.entries(data.tables || {}).map(([name, table]) => [name, table.fingerprint])),
    limitations: data.limitations || [],
  };
}

function selectionFor(workspace, selection, packageMode) {
  if (packageMode === "workspace-backup") {
    return {
      dashboards: workspace.dashboards?.map((item) => item.id) || [],
      reports: workspace.reports?.map((item) => item.id) || [],
      visualizations: workspace.visualizations?.map((item) => item.id) || [],
      queries: workspace.queries?.map((item) => item.id) || [],
      dataSources: workspace.dataSources?.map((item) => item.id) || [],
    };
  }
  return selection;
}

function collectArtifacts(workspace, required) {
  return {
    queries: (workspace.queries || []).filter((item) => required.queries.includes(item.id)),
    visualizations: (workspace.visualizations || []).filter((item) => required.visualizations.includes(item.id)),
    dashboards: (workspace.dashboards || []).filter((item) => required.dashboards.includes(item.id)),
    reports: (workspace.reports || []).filter((item) => required.reports.includes(item.id)),
    dataSources: (workspace.dataSources || []).filter((item) => required.dataSources.includes(item.id)),
    interactions: (workspace.dashboards || []).flatMap((dashboard) => dashboard.interactions?.bindings || []).filter((item) => required.interactions.includes(item.id)),
    extensions: [],
    templates: [],
  };
}

async function packageData(workspace, plan, dataMode, tableRows) {
  if (dataMode === "included") return { mode: dataMode, tables: await createIncludedData(workspace, plan, tableRows), limitations: [] };
  if (dataMode === "pre-aggregated") return { mode: dataMode, materializedQueries: createPreAggregatedPlan(workspace, plan), columnPruning: createColumnPrunedExtractPlan(workspace, plan), limitations: ["Original source tables are not included."] };
  if (dataMode === "snapshot-only") return { mode: dataMode, snapshots: true, limitations: ["Queries cannot be refreshed without source data."] };
  return { mode: "external", requirements: createExternalDataRequirements(workspace, plan), limitations: ["External-data packages require compatible local data before refresh."] };
}

function sanitizeWorkspace(workspace, options) {
  const next = serializeWorkspace(workspace);
  next.settings = { ...next.settings, ai: { ...next.settings?.ai, enabled: false } };
  if (!options.includeAiHistory) next.aiHistory = [];
  return stripSecrets(next);
}

function minimalWorkspace(workspace, artifacts) {
  return stripSecrets({
    ...serializeWorkspace(workspace),
    dataSources: artifacts.dataSources,
    queries: artifacts.queries,
    visualizations: artifacts.visualizations,
    dashboards: artifacts.dashboards,
    reports: artifacts.reports,
    aiHistory: [],
    settings: { ...workspace.settings, ai: { ...workspace.settings?.ai, enabled: false } },
  });
}

function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/api.?key|authorization|token|secret/i.test(key)).map(([key, item]) => [key, stripSecrets(item)]));
}

function containsSecret(value) {
  if (Array.isArray(value)) return value.some(containsSecret);
  if (!value || typeof value !== "object") {
    return typeof value === "string" && /bearer\s+[a-z0-9._-]+/i.test(value);
  }
  return Object.entries(value).some(([key, item]) => {
    if (/^(apiKey|api_key|authorization|accessToken|access_token|secret|token)$/i.test(key) && item) return true;
    return containsSecret(item);
  });
}

function containsExecutable(value) {
  if (typeof value === "function") return true;
  if (typeof value === "string") return /^\s*(function|\(?\s*[\w,\s]*\)?\s*=>|<script\b)/i.test(value);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsExecutable);
}

function defaultEntrypoints(required) {
  if (required.dashboards?.[0]) return [{ type: "dashboard", id: required.dashboards[0] }];
  if (required.reports?.[0]) return [{ type: "report", id: required.reports[0] }];
  if (required.visualizations?.[0]) return [{ type: "visualization", id: required.visualizations[0] }];
  return [];
}

function normalizeChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function mergeById(target, items) {
  for (const item of items) {
    const copy = { ...item };
    while (target.some((existing) => existing.id === copy.id)) copy.id = uid(copy.id.split("_")[0] || "item");
    target.push(copy);
  }
}
