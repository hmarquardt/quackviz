import { APP_VERSION, BUILD_DATE, TEMPLATE_FORMAT_VERSION } from "./constants.js";
import { deepClone, nowIso, uid } from "./utils.js";

export const BUILT_IN_TEMPLATES = [
  template("template_sales_executive", "dashboard", "Executive sales dashboard", ["date", "currency", "category"], ["sales", "executive"]),
  template("template_operations_timeseries", "dashboard", "Time-series operations dashboard", ["date", "number", "category"], ["operations"]),
  template("template_data_quality", "dashboard", "Data-quality review", ["category", "number"], ["quality"]),
  template("template_geographic_performance", "dashboard", "Geographic performance overview", ["region", "currency"], ["map"]),
  template("template_experiment_report", "report", "Experiment-results report", ["category", "number"], ["experiment"]),
  template("template_telemetry_monitoring", "dashboard", "Telemetry monitoring dashboard", ["datetime", "number"], ["telemetry"]),
];

export function createTemplate(input = {}) {
  return {
    format: "quackviz-template",
    formatVersion: TEMPLATE_FORMAT_VERSION,
    id: input.id || uid("template"),
    templateType: input.templateType || "dashboard",
    name: input.name || "Untitled template",
    description: input.description || "",
    tags: Array.isArray(input.tags) ? input.tags : [],
    requiredSemanticRoles: Array.isArray(input.requiredSemanticRoles) ? input.requiredSemanticRoles : [],
    artifacts: input.artifacts || {},
    bindings: input.bindings || {},
    instructions: Array.isArray(input.instructions) ? input.instructions : [],
    metadata: { appVersion: APP_VERSION, buildDate: BUILD_DATE, createdAt: input.createdAt || nowIso() },
  };
}

export function validateTemplate(input) {
  const tpl = createTemplate(input);
  const errors = [];
  if (input?.format !== "quackviz-template") errors.push({ path: "format", message: "Unsupported template format." });
  if (tpl.formatVersion !== TEMPLATE_FORMAT_VERSION) errors.push({ path: "formatVersion", message: "Unsupported template version." });
  if (!["workspace", "dashboard", "report", "visualization", "ai-prompt", "interaction"].includes(tpl.templateType)) errors.push({ path: "templateType", message: "Unsupported template type." });
  if (containsExecutable(input)) errors.push({ path: "$", message: "Templates cannot contain executable JavaScript or HTML script tags." });
  return { valid: errors.length === 0, errors, template: tpl };
}

export function matchTemplate(template, workspace) {
  const tpl = createTemplate(template);
  const available = [];
  for (const source of workspace.dataSources || []) {
    for (const column of source.columns || []) available.push({ tableName: source.tableName, column: column.name, semanticType: column.semanticType || null, confidence: column.semanticConfidence ?? 0.5 });
  }
  const mappings = tpl.requiredSemanticRoles.map((role) => {
    const matches = available.filter((column) => column.semanticType === role || (role === "currency" && column.semanticType === "number"));
    return { role, matches, status: matches.length === 1 ? "matched" : matches.length > 1 ? "ambiguous" : "missing" };
  });
  return { valid: mappings.every((item) => item.status !== "missing"), requiresApproval: true, mappings, template: tpl };
}

export function applyTemplate(template, workspace, approvedMappings = {}) {
  const match = matchTemplate(template, workspace);
  if (!match.valid) throw new Error("Template cannot be applied because required semantic roles are missing.");
  if (!Object.keys(approvedMappings).length) return { applied: false, requiresApproval: true, proposedMappings: match.mappings };
  return {
    applied: true,
    requiresApproval: false,
    artifacts: deepClone(match.template.artifacts),
    bindings: deepClone(match.template.bindings),
    mappings: approvedMappings,
    createdBy: "template",
  };
}

export function exportTemplate(template) {
  const validation = validateTemplate(template);
  if (!validation.valid) throw new Error(validation.errors[0]?.message || "Template invalid.");
  return validation.template;
}

function template(id, type, name, roles, tags) {
  return createTemplate({ id, templateType: type, name, requiredSemanticRoles: roles, tags });
}

function containsExecutable(value) {
  if (typeof value === "function") return true;
  if (typeof value === "string") return /^\s*(function|\(?\s*[\w,\s]*\)?\s*=>|<script\b)/i.test(value);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsExecutable);
}
