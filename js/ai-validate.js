import { AI_CONTRACT_VERSION } from "./constants.js";
import { AI_CONTRACTS } from "./ai-contracts.js";
import { validateSqlSafety } from "./ai-sql-safety.js";
import { validateVisualizationSpec } from "./viz-spec.js";
import { REPORT_SECTION_TYPES } from "./report.js";
import { boundaryCatalog } from "./map-boundaries.js";
import { isMapSpec } from "./map-spec.js";
import { normalizeInteractionBinding, validateInteractionBinding } from "./interaction-bindings.js";
import { createDrilldown } from "./drilldown.js";

const PROPOSAL_KEYS = new Set(["id", "title", "question", "description", "sourceTables", "confidence", "sql", "expectedColumns", "visualization", "reasoning", "assumptions", "cautions"]);
const ROOT_KEYS = new Set(["contract", "contractVersion", "summary", "proposals"]);
const REPAIR_KEYS = new Set(["contract", "contractVersion", "summary", "repairedSql", "expectedColumns", "visualization", "changes", "assumptions", "cautions"]);
const EXPLANATION_KEYS = new Set(["contract", "contractVersion", "headline", "summary", "findings", "cautions", "followUpQuestions"]);
const CRITIQUE_KEYS = new Set(["contract", "contractVersion", "assessment", "issues", "recommendations", "alternativeVisualization", "cautions"]);
const DASHBOARD_KEYS = new Set(["contract", "contractVersion", "title", "description", "audience", "proposals", "filters", "narrativeOrder", "assumptions", "cautions"]);
const DASHBOARD_CRITIQUE_KEYS = new Set(["contract", "contractVersion", "summary", "issues", "recommendations", "proposedLayoutChanges", "proposedAdditions", "proposedRemovals", "cautions"]);
const REPORT_OUTLINE_KEYS = new Set(["contract", "contractVersion", "title", "subtitle", "audience", "sections", "assumptions", "cautions"]);
const REPORT_NARRATIVE_KEYS = new Set(["contract", "contractVersion", "headline", "summary", "findings", "recommendations", "cautions", "sourceReferences"]);
const REPORT_CRITIQUE_KEYS = new Set(["contract", "contractVersion", "summary", "issues", "recommendations", "missingElements", "unsupportedClaims", "cautions"]);
const REGION_REPAIR_KEYS = new Set(["contract", "contractVersion", "boundaryId", "mappings", "unresolved"]);
const INTERACTION_KEYS = new Set(["contract", "contractVersion", "summary", "bindings", "drilldowns", "parameters", "assumptions", "cautions"]);
const INTERACTION_CRITIQUE_KEYS = new Set(["contract", "contractVersion", "summary", "issues", "recommendations", "circularRisks", "cautions"]);
const PACKAGE_PLAN_KEYS = new Set(["contract", "contractVersion", "recommendedMode", "recommendedDataMode", "entrypoints", "include", "privacyRecommendations", "capabilities", "cautions"]);

export function parseAiJson(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const json = fenced ? fenced[1].trim() : trimmed;
  try {
    return { ok: true, value: JSON.parse(json), error: null };
  } catch (error) {
    return { ok: false, value: null, error: { code: "AI_JSON_PARSE_FAILURE", message: error.message } };
  }
}

export function validateAiResponse(payload, { expectedContract, knownTables = [], dataset = null } = {}) {
  if (expectedContract === AI_CONTRACTS.repair) return validateRepair(payload, knownTables, dataset);
  if (expectedContract === AI_CONTRACTS.explanation) return validateExplanation(payload);
  if (expectedContract === AI_CONTRACTS.critique) return validateCritique(payload);
  if (expectedContract === AI_CONTRACTS.dashboard) return validateAiDashboard(payload, knownTables, dataset);
  if (expectedContract === AI_CONTRACTS.dashboardCritique) return validateAiDashboardCritique(payload);
  if (expectedContract === AI_CONTRACTS.reportOutline) return validateAiReportOutline(payload, dataset || {});
  if (expectedContract === AI_CONTRACTS.reportNarrative) return validateAiReportNarrative(payload);
  if (expectedContract === AI_CONTRACTS.reportCritique) return validateAiReportCritique(payload);
  if (expectedContract === AI_CONTRACTS.mapProposals) return validateMapProposalResponse(payload, knownTables, dataset);
  if (expectedContract === AI_CONTRACTS.regionRepair) return validateRegionRepair(payload);
  if (expectedContract === AI_CONTRACTS.interactions) return validateAiInteractions(payload, dataset || {});
  if (expectedContract === AI_CONTRACTS.interactionCritique) return validateAiInteractionCritique(payload);
  if (expectedContract === AI_CONTRACTS.packagePlan) return validateAiPackagePlan(payload, dataset || {});
  return validateProposalResponse(payload, knownTables, dataset);
}

export function validateAiInteractions(payload, dashboard = {}) {
  const errors = baseContract(payload, AI_CONTRACTS.interactions, INTERACTION_KEYS);
  if (!Array.isArray(payload?.bindings)) errors.push(error("bindings", "Interaction bindings must be an array."));
  if (!Array.isArray(payload?.drilldowns)) errors.push(error("drilldowns", "Drill-down proposals must be an array."));
  const workspace = dashboard.workspace || { visualizations: dashboard.visualizations || [], queries: dashboard.queries || [] };
  const normalizedBindings = [];
  for (const [index, proposed] of (payload?.bindings || []).entries()) {
    const binding = normalizeInteractionBinding({
      name: proposed.title || proposed.name,
      source: { cardId: proposed.sourceCardId, field: proposed.sourceField, eventKinds: proposed.eventKinds },
      targets: { mode: proposed.targetMode || "compatible", cardIds: proposed.targetCardIds || [] },
      action: proposed.action,
      clearBehavior: proposed.clearBehavior,
    });
    const validation = validateInteractionBinding(binding, dashboard, workspace);
    errors.push(...validation.errors.map((item) => error(`bindings[${index}].${item.path}`, item.message)));
    if (binding.action.transform && !["identity", "string", "number", "date", "lowercase", "uppercase"].includes(binding.action.transform)) errors.push(error(`bindings[${index}].action.transform`, "Unsupported parameter transform."));
    normalizedBindings.push(validation.binding);
  }
  const cardIds = new Set((dashboard.layout || []).map((card) => card.id));
  const vizIds = new Set((workspace.visualizations || []).map((viz) => viz.id));
  for (const [index, proposed] of (payload?.drilldowns || []).entries()) {
    if (proposed.sourceCardId && !cardIds.has(proposed.sourceCardId)) errors.push(error(`drilldowns[${index}].sourceCardId`, "Unknown source card."));
    if (!proposed.triggerField) errors.push(error(`drilldowns[${index}].triggerField`, "Trigger field is required."));
    if (proposed.targetVisualizationId && !vizIds.has(proposed.targetVisualizationId)) errors.push(error(`drilldowns[${index}].targetVisualizationId`, "Unknown target visualization."));
    createDrilldown({
      name: proposed.title,
      triggerField: proposed.triggerField,
      target: { type: proposed.targetVisualizationId ? "visualization" : "detail-table", visualizationId: proposed.targetVisualizationId || null, queryId: proposed.targetQueryId || null },
      parameterBindings: proposed.parameterBindings || [],
    });
  }
  return { valid: errors.length === 0, errors, warnings: [], interactions: { ...payload, normalizedBindings } };
}

export function validateAiInteractionCritique(payload) {
  const errors = baseContract(payload, AI_CONTRACTS.interactionCritique, INTERACTION_CRITIQUE_KEYS);
  if (!payload?.summary) errors.push(error("summary", "Interaction critique summary is required."));
  for (const key of ["issues", "recommendations", "circularRisks", "cautions"]) {
    if (!Array.isArray(payload?.[key])) errors.push(error(key, `${key} must be an array.`));
  }
  return { valid: errors.length === 0, errors, warnings: [], critique: payload };
}

export function validateAiPackagePlan(payload, workspace = {}) {
  const errors = baseContract(payload, AI_CONTRACTS.packagePlan, PACKAGE_PLAN_KEYS);
  const ids = {
    dashboard: new Set((workspace.dashboards || []).map((item) => item.id)),
    report: new Set((workspace.reports || []).map((item) => item.id)),
    visualization: new Set((workspace.visualizations || []).map((item) => item.id)),
    query: new Set((workspace.queries || []).map((item) => item.id)),
  };
  if (!["workspace-backup", "standalone", "dashboard-only", "report-only", "visualization", "template", "embed"].includes(payload?.recommendedMode)) errors.push(error("recommendedMode", "Unsupported package mode."));
  if (!["included", "external", "snapshot-only", "pre-aggregated"].includes(payload?.recommendedDataMode)) errors.push(error("recommendedDataMode", "Unsupported data mode."));
  for (const [index, entry] of (payload?.entrypoints || []).entries()) {
    if (!ids[entry.type]?.has(entry.id)) errors.push(error(`entrypoints[${index}].id`, `Unknown ${entry.type} '${entry.id}'.`));
  }
  for (const [kind, values] of Object.entries(payload?.include || {})) {
    const singular = kind.replace(/s$/, "");
    for (const id of values || []) if (ids[singular] && !ids[singular].has(id)) errors.push(error(`include.${kind}`, `Unknown ${singular} '${id}'.`));
  }
  for (const rec of payload?.privacyRecommendations || []) if (rec.action && !["exclude-column", "snapshot-only", "pre-aggregate", "external-data", "disable-data-export"].includes(rec.action)) errors.push(error("privacyRecommendations", "Unsupported privacy recommendation action."));
  if (payload?.capabilities?.queryEditing || payload?.capabilities?.rawSql) errors.push(error("capabilities", "Package plans cannot enable query editing or raw SQL capabilities."));
  return { valid: errors.length === 0, errors, warnings: [], plan: payload };
}

export function validateProposalResponse(payload, knownTables = [], dataset = null) {
  const errors = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) errors.push(error("$", "AI response must be a JSON object."));
  if (containsExecutable(payload)) errors.push(error("$", "AI response must not contain functions, script tags, or executable strings."));
  for (const key of Object.keys(payload || {})) if (!ROOT_KEYS.has(key)) errors.push(error(key, `Unknown top-level property '${key}'.`));
  if (payload?.contract !== AI_CONTRACTS.proposals) errors.push(error("contract", "Unsupported or missing proposal contract."));
  if (payload?.contractVersion !== AI_CONTRACT_VERSION) errors.push(error("contractVersion", "Unsupported AI contract version."));
  if (!Array.isArray(payload?.proposals)) errors.push(error("proposals", "Response must include proposals array."));
  const proposals = (payload?.proposals || []).map((proposal, index) => validateProposal(proposal, index, knownTables, dataset));
  return { valid: errors.length === 0, errors, warnings: [], proposals, summary: payload?.summary || "" };
}

export function validateProposal(proposal, index = 0, knownTables = [], dataset = null) {
  const errors = [];
  const warnings = [];
  const path = `proposals[${index}]`;
  if (!proposal || typeof proposal !== "object") errors.push(error(path, "Proposal must be an object."));
  for (const key of Object.keys(proposal || {})) if (!PROPOSAL_KEYS.has(key)) errors.push(error(`${path}.${key}`, `Unknown proposal property '${key}'.`));
  for (const key of ["title", "question", "description", "sql"]) if (!proposal?.[key]) errors.push(error(`${path}.${key}`, `${key} is required.`));
  if (typeof proposal?.confidence !== "number" || proposal.confidence < 0 || proposal.confidence > 1) errors.push(error(`${path}.confidence`, "Confidence must be between 0 and 1."));
  if (!Array.isArray(proposal?.sourceTables) || !proposal.sourceTables.length) errors.push(error(`${path}.sourceTables`, "At least one source table is required."));
  for (const table of proposal?.sourceTables || []) if (knownTables.length && !knownTables.includes(table)) errors.push(error(`${path}.sourceTables`, `Unknown source table '${table}'.`));
  const sqlSafety = validateSqlSafety(proposal?.sql || "", knownTables);
  errors.push(...sqlSafety.errors.map((item) => error(`${path}.sql`, item.message)));
  warnings.push(...sqlSafety.warnings.map((item) => ({ path: `${path}.sql`, message: item.message })));
  if (!Array.isArray(proposal?.expectedColumns) || !proposal.expectedColumns.length) errors.push(error(`${path}.expectedColumns`, "Expected columns are required."));
  const expectedNames = new Set((proposal?.expectedColumns || []).map((column) => column.name));
  const viz = proposal?.visualization ? { ...proposal.visualization, dataset: { queryId: "pending" } } : null;
  if (viz) {
    const validationDataset = dataset || { columns: [...expectedNames].map((name) => ({ name, inferredType: expectedType(proposal, name), duckType: "" })) };
    const specValidation = validateVisualizationSpec(viz, validationDataset);
    errors.push(...specValidation.errors.map((item) => error(`${path}.visualization.${item.path}`, item.message)));
    for (const field of proposalFields(viz)) {
      if (field?.field && !expectedNames.has(field.field)) errors.push(error(`${path}.visualization`, `Field '${field.field}' is not produced by expectedColumns.`));
    }
  }
  return { proposal, valid: errors.length === 0, errors, warnings, sqlSafety, status: "new" };
}

export function validateMapProposalResponse(payload, knownTables = [], dataset = null) {
  const result = validateProposalResponse({ ...payload, contract: AI_CONTRACTS.proposals }, knownTables, dataset);
  if (payload?.contract !== AI_CONTRACTS.mapProposals) result.errors.push(error("contract", "Unsupported or missing map proposal contract."));
  const boundaryIds = new Set(boundaryCatalog().map((item) => item.id));
  for (const [index, item] of (result.proposals || []).entries()) {
    const viz = item.proposal?.visualization;
    if (!isMapSpec(viz)) item.errors.push(error(`proposals[${index}].visualization.type`, "Map proposals must include a supported map visualization spec."));
    if (viz?.map && Object.hasOwn(viz.map, "rawStyle")) item.errors.push(error(`proposals[${index}].visualization.map.rawStyle`, "Raw MapLibre styles are not allowed."));
    const boundary = viz?.encoding?.region?.boundary;
    if (boundary && !boundaryIds.has(boundary)) item.errors.push(error(`proposals[${index}].visualization.encoding.region.boundary`, `Unknown boundary '${boundary}'.`));
    item.valid = item.errors.length === 0;
  }
  result.valid = result.errors.length === 0;
  return result;
}

export function validateRegionRepair(payload) {
  const errors = baseContract(payload, AI_CONTRACTS.regionRepair, REGION_REPAIR_KEYS);
  const boundaryIds = new Set(boundaryCatalog().map((item) => item.id));
  if (!boundaryIds.has(payload?.boundaryId)) errors.push(error("boundaryId", "Unknown boundary ID."));
  if (!Array.isArray(payload?.mappings)) errors.push(error("mappings", "Mappings must be an array."));
  for (const [index, mapping] of (payload?.mappings || []).entries()) {
    if (!mapping.sourceValue) errors.push(error(`mappings[${index}].sourceValue`, "Source value is required."));
    if (!mapping.boundaryValue) errors.push(error(`mappings[${index}].boundaryValue`, "Boundary value is required."));
    if (typeof mapping.confidence !== "number" || mapping.confidence < 0 || mapping.confidence > 1) errors.push(error(`mappings[${index}].confidence`, "Confidence must be between 0 and 1."));
  }
  if (!Array.isArray(payload?.unresolved)) errors.push(error("unresolved", "Unresolved values must be an array."));
  return { valid: errors.length === 0, errors, warnings: [], repair: payload };
}

export function validateRepair(payload, knownTables = [], dataset = null) {
  const errors = baseContract(payload, AI_CONTRACTS.repair, REPAIR_KEYS);
  if (!payload?.repairedSql) errors.push(error("repairedSql", "Repaired SQL is required."));
  const sqlSafety = validateSqlSafety(payload?.repairedSql || "", knownTables);
  errors.push(...sqlSafety.errors.map((item) => error("repairedSql", item.message)));
  return { valid: errors.length === 0, errors, warnings: [], repair: payload, sqlSafety };
}

export function validateExplanation(payload) {
  const errors = baseContract(payload, AI_CONTRACTS.explanation, EXPLANATION_KEYS);
  if (!payload?.headline) errors.push(error("headline", "Headline is required."));
  if (!Array.isArray(payload?.findings)) errors.push(error("findings", "Findings must be an array."));
  return { valid: errors.length === 0, errors, warnings: [], explanation: payload };
}

export function validateCritique(payload) {
  const errors = baseContract(payload, AI_CONTRACTS.critique, CRITIQUE_KEYS);
  if (!payload?.assessment) errors.push(error("assessment", "Assessment is required."));
  if (!Array.isArray(payload?.recommendations)) errors.push(error("recommendations", "Recommendations must be an array."));
  for (const [index, rec] of (payload?.recommendations || []).entries()) {
    if (rec.proposedSpecPatch && Object.keys(rec.proposedSpecPatch).some((key) => !["title", "subtitle", "encoding", "options"].includes(key))) {
      errors.push(error(`recommendations[${index}].proposedSpecPatch`, "Spec patches may only change title, subtitle, encoding, or options."));
    }
  }
  return { valid: errors.length === 0, errors, warnings: [], critique: payload };
}

export function validateAiDashboard(payload, knownTables = [], workspace = { visualizations: [] }) {
  const errors = baseContract(payload, AI_CONTRACTS.dashboard, DASHBOARD_KEYS);
  if (!payload?.title) errors.push(error("title", "Dashboard title is required."));
  if (!Array.isArray(payload?.proposals)) errors.push(error("proposals", "Dashboard proposals must be an array."));
  if ((payload?.proposals || []).length > 12) errors.push(error("proposals", "Dashboard proposals exceed the 12-card milestone limit."));
  const vizIds = new Set((workspace.visualizations || []).map((viz) => viz.id));
  for (const [index, proposal] of (payload?.proposals || []).entries()) {
    if (!["existing-visualization", "new-visualization"].includes(proposal.type)) errors.push(error(`proposals[${index}].type`, "Unsupported dashboard proposal type."));
    if (proposal.type === "existing-visualization" && !vizIds.has(proposal.visualizationId)) errors.push(error(`proposals[${index}].visualizationId`, `Unknown visualization '${proposal.visualizationId}'.`));
    if (proposal.layout && (proposal.layout.width < 1 || proposal.layout.width > 12 || proposal.layout.height < 2 || proposal.layout.height > 12)) errors.push(error(`proposals[${index}].layout`, "Layout is outside allowed bounds."));
    if (proposal.sql) {
      const sqlSafety = validateSqlSafety(proposal.sql, knownTables);
      errors.push(...sqlSafety.errors.map((item) => error(`proposals[${index}].sql`, item.message)));
    }
    if (proposal.visualization) {
      const expected = proposal.expectedColumns || [];
      const dataset = { columns: expected.map((column) => ({ name: column.name, inferredType: column.dataType || "string", duckType: "" })) };
      const spec = validateVisualizationSpec({ ...proposal.visualization, dataset: { queryId: "pending" } }, dataset);
      errors.push(...spec.errors.map((item) => error(`proposals[${index}].visualization.${item.path}`, item.message)));
    }
  }
  return { valid: errors.length === 0, errors, warnings: [], dashboard: payload };
}

export function validateAiDashboardCritique(payload) {
  const errors = baseContract(payload, AI_CONTRACTS.dashboardCritique, DASHBOARD_CRITIQUE_KEYS);
  if (!payload?.summary) errors.push(error("summary", "Dashboard critique summary is required."));
  for (const key of ["issues", "recommendations", "proposedLayoutChanges", "proposedAdditions", "proposedRemovals", "cautions"]) {
    if (!Array.isArray(payload?.[key])) errors.push(error(key, `${key} must be an array.`));
  }
  return { valid: errors.length === 0, errors, warnings: [], critique: payload };
}

export function validateAiReportOutline(payload, workspace = {}) {
  const errors = baseContract(payload, AI_CONTRACTS.reportOutline, REPORT_OUTLINE_KEYS);
  if (!payload?.title) errors.push(error("title", "Report title is required."));
  if (!Array.isArray(payload?.sections)) errors.push(error("sections", "Report outline sections must be an array."));
  if ((payload?.sections || []).length > 40) errors.push(error("sections", "Report outline exceeds the 40-section limit."));
  const queryIds = new Set((workspace.queries || []).map((item) => item.id));
  const vizIds = new Set((workspace.visualizations || []).map((item) => item.id));
  const dashboardIds = new Set((workspace.dashboards || []).map((item) => item.id));
  for (const [index, section] of (payload?.sections || []).entries()) {
    if (!REPORT_SECTION_TYPES.includes(section.type)) errors.push(error(`sections[${index}].type`, `Unsupported report section type '${section.type}'.`));
    if (section.visualizationId && !vizIds.has(section.visualizationId)) errors.push(error(`sections[${index}].visualizationId`, "Referenced visualization is missing."));
    if (section.queryId && !queryIds.has(section.queryId)) errors.push(error(`sections[${index}].queryId`, "Referenced query is missing."));
    if (section.dashboardId && !dashboardIds.has(section.dashboardId)) errors.push(error(`sections[${index}].dashboardId`, "Referenced dashboard is missing."));
    if (String(section.draftNarrative || "").length > 4000) errors.push(error(`sections[${index}].draftNarrative`, "Draft narrative is too long."));
  }
  return { valid: errors.length === 0, errors, warnings: [], outline: payload };
}

export function validateAiReportNarrative(payload) {
  const errors = baseContract(payload, AI_CONTRACTS.reportNarrative, REPORT_NARRATIVE_KEYS);
  if (!payload?.headline) errors.push(error("headline", "Narrative headline is required."));
  if (!payload?.summary) errors.push(error("summary", "Narrative summary is required."));
  if (!Array.isArray(payload?.findings)) errors.push(error("findings", "Findings must be an array."));
  if (!Array.isArray(payload?.sourceReferences)) errors.push(error("sourceReferences", "Source references must be an array."));
  return { valid: errors.length === 0, errors, warnings: unsupportedClaimWarnings(payload), narrative: payload };
}

export function validateAiReportCritique(payload) {
  const errors = baseContract(payload, AI_CONTRACTS.reportCritique, REPORT_CRITIQUE_KEYS);
  if (!payload?.summary) errors.push(error("summary", "Report critique summary is required."));
  for (const key of ["issues", "recommendations", "missingElements", "unsupportedClaims", "cautions"]) {
    if (!Array.isArray(payload?.[key])) errors.push(error(key, `${key} must be an array.`));
  }
  return { valid: errors.length === 0, errors, warnings: [], critique: payload };
}

function unsupportedClaimWarnings(payload) {
  const text = JSON.stringify(payload || {}).toLowerCase();
  const warnings = [];
  if (/(caused|because of|statistically significant|significant at)/.test(text)) warnings.push({ path: "summary", message: "Narrative may contain causal or statistical-significance claims that require supporting evidence." });
  return warnings;
}

function baseContract(payload, contract, allowedKeys) {
  const errors = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) errors.push(error("$", "AI response must be an object."));
  for (const key of Object.keys(payload || {})) if (!allowedKeys.has(key)) errors.push(error(key, `Unknown top-level property '${key}'.`));
  if (payload?.contract !== contract) errors.push(error("contract", `Expected contract '${contract}'.`));
  if (payload?.contractVersion !== AI_CONTRACT_VERSION) errors.push(error("contractVersion", "Unsupported AI contract version."));
  if (containsExecutable(payload)) errors.push(error("$", "AI response must not contain functions or executable strings."));
  return errors;
}

function containsExecutable(value) {
  if (typeof value === "function") return true;
  if (typeof value === "string") return /^\s*(function|\(?\s*[\w,\s]*\)?\s*=>|<script\b)/i.test(value);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsExecutable);
}

function expectedType(proposal, name) {
  return proposal.expectedColumns.find((column) => column.name === name)?.dataType || "string";
}

function proposalFields(viz) {
  if (isMapSpec(viz)) return [viz.encoding?.latitude, viz.encoding?.longitude, viz.encoding?.label, viz.encoding?.size, viz.encoding?.color, viz.encoding?.value, viz.encoding?.region, ...(viz.encoding?.tooltip || [])];
  return [viz.encoding?.x, ...(viz.encoding?.y || [])];
}

function error(path, message) {
  return { path, message };
}
