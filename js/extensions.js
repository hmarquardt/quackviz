import { APP_VERSION, EXTENSION_FORMAT_VERSION } from "./constants.js";
import { deepClone, nowIso } from "./utils.js";

const TYPES = ["chart-definition", "recommendation-rule", "semantic-type-rule", "formatting-preset", "report-section-preset", "template-pack", "boundary-catalog-entry", "color-scale-preset", "aggregate-definition"];
const COMPILER_FAMILIES = ["line", "bar", "map-point", "map-choropleth"];
const PROTECTED_IDS = new Set(["line", "bar", "map-point", "map-choropleth"]);

export function validateExtension(input, installed = []) {
  const errors = [];
  const warnings = [];
  const extension = normalizeExtension(input);
  if (input?.format !== "quackviz-extension") errors.push({ path: "format", message: "Unsupported extension format." });
  if (extension.formatVersion !== EXTENSION_FORMAT_VERSION) errors.push({ path: "formatVersion", message: "Unsupported extension version." });
  if (!extension.id) errors.push({ path: "id", message: "Extension ID is required." });
  if (PROTECTED_IDS.has(extension.id)) errors.push({ path: "id", message: "Built-in contribution IDs cannot be overridden." });
  for (const type of extension.extensionTypes) if (!TYPES.includes(type)) errors.push({ path: "extensionTypes", message: `Unsupported extension type '${type}'.` });
  if (extension.requirements.minimumAppVersion && compareVersions(APP_VERSION, extension.requirements.minimumAppVersion) < 0) warnings.push({ path: "requirements.minimumAppVersion", message: "Extension requires a newer QuackViz version." });
  if (installed.some((item) => item.id === extension.id)) warnings.push({ path: "id", message: "An extension with this ID is already installed." });
  validateContributions(extension, errors, warnings);
  if (containsExecutable(input)) errors.push({ path: "$", message: "Extensions are declarative and cannot contain executable JavaScript or script tags." });
  return { valid: errors.length === 0, errors, warnings, extension };
}

export function installExtension(registry, input, { enable = false } = {}) {
  const validation = validateExtension(input, registry);
  if (!validation.valid) throw new Error(validation.errors[0]?.message || "Extension invalid.");
  const next = registry.filter((item) => item.id !== validation.extension.id);
  next.push({ ...validation.extension, enabled: Boolean(enable), installedAt: nowIso(), source: validation.extension.source || "imported-file" });
  return next;
}

export function disableExtension(registry, id) {
  return registry.map((item) => item.id === id ? { ...item, enabled: false } : item);
}

export function enableExtension(registry, id) {
  return registry.map((item) => item.id === id ? { ...item, enabled: true } : item);
}

export function uninstallExtension(registry, id) {
  return registry.filter((item) => item.id !== id || item.source === "built-in");
}

export function extensionDiagnostics(registry) {
  return {
    appVersion: APP_VERSION,
    installedExtensionCount: registry.length,
    enabledExtensionCount: registry.filter((item) => item.enabled).length,
    ids: registry.map((item) => ({ id: item.id, version: item.version, enabled: item.enabled })),
  };
}

function normalizeExtension(input = {}) {
  return {
    format: "quackviz-extension",
    formatVersion: input.formatVersion ?? EXTENSION_FORMAT_VERSION,
    id: input.id || "",
    name: input.name || input.id || "Extension",
    version: input.version || "1.0.0",
    publisher: input.publisher || "Local User",
    description: input.description || "",
    extensionTypes: Array.isArray(input.extensionTypes) ? input.extensionTypes : [],
    requirements: {
      minimumAppVersion: input.requirements?.minimumAppVersion || null,
      maximumAppVersion: input.requirements?.maximumAppVersion || null,
    },
    contributions: deepClone(input.contributions || {}),
    source: input.source || "imported-file",
    enabled: Boolean(input.enabled),
  };
}

function validateContributions(extension, errors, warnings) {
  for (const chart of extension.contributions.chartDefinitions || []) {
    if (!COMPILER_FAMILIES.includes(chart.compilerFamily)) errors.push({ path: "contributions.chartDefinitions", message: `Unsupported compiler family '${chart.compilerFamily}'.` });
    if (chart.rawOption || chart.echartsOption) errors.push({ path: "contributions.chartDefinitions", message: "Raw ECharts options are not allowed." });
  }
  for (const rule of extension.contributions.semanticTypeRules || []) {
    for (const pattern of rule.columnNamePatterns || rule.sampleValuePatterns || []) {
      if (String(pattern).length > 120) errors.push({ path: "contributions.semanticTypeRules", message: "Pattern is too long." });
      try { new RegExp(pattern); } catch { errors.push({ path: "contributions.semanticTypeRules", message: "Pattern is not a valid regular expression." }); }
    }
  }
  for (const boundary of extension.contributions.boundaries || []) {
    if (boundary.url) errors.push({ path: "contributions.boundaries", message: "Boundary extension entries cannot fetch remote URLs in this milestone." });
  }
  if (!extension.extensionTypes.length) warnings.push({ path: "extensionTypes", message: "Extension does not declare contribution types." });
}

function containsExecutable(value) {
  if (typeof value === "function") return true;
  if (typeof value === "string") return /^\s*(function|\(?\s*[\w,\s]*\)?\s*=>|<script\b|javascript:)/i.test(value);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsExecutable);
}

function compareVersions(left, right) {
  const a = String(left).split(".").map(Number);
  const b = String(right).split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0) ? 1 : -1;
  }
  return 0;
}
