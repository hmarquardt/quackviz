import { INTERACTION_VERSION } from "./constants.js";
import { nowIso, uid } from "./utils.js";

export const ACTION_TYPES = ["filter", "highlight", "set-parameter", "drill", "detail-table", "map-viewport"];

export function normalizeInteractionBinding(input = {}) {
  const timestamp = nowIso();
  return {
    id: input.id || uid("binding"),
    version: input.version || INTERACTION_VERSION,
    name: input.name || input.title || "Interaction binding",
    source: {
      cardId: input.source?.cardId || input.sourceCardId || null,
      field: input.source?.field || input.sourceField || "",
      eventKinds: Array.isArray(input.source?.eventKinds) ? input.source.eventKinds : (input.eventKinds || ["category"]),
    },
    targets: input.targets || { mode: input.targetMode || "compatible", cardIds: [] },
    action: {
      type: input.action?.type || "filter",
      dashboardField: input.action?.dashboardField || input.source?.field || input.sourceField || "",
      operator: input.action?.operator || "in",
      targetParameter: input.action?.targetParameter || null,
      transform: input.action?.transform || "identity",
    },
    enabled: input.enabled !== false,
    clearBehavior: input.clearBehavior || "restore",
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  };
}

export function validateInteractionBinding(binding, dashboard, workspace) {
  const normalized = normalizeInteractionBinding(binding);
  const errors = [];
  const cardIds = new Set((dashboard.layout || []).map((card) => card.id));
  if (!cardIds.has(normalized.source.cardId)) errors.push({ path: "source.cardId", message: "Source card is missing." });
  if (!normalized.source.field) errors.push({ path: "source.field", message: "Source field is required." });
  if (normalized.source.field && cardIds.has(normalized.source.cardId) && !cardFields(normalized.source.cardId, dashboard, workspace).has(normalized.source.field)) errors.push({ path: "source.field", message: `Source field '${normalized.source.field}' is not available on the source visualization.` });
  if (!ACTION_TYPES.includes(normalized.action.type)) errors.push({ path: "action.type", message: "Unsupported action type." });
  if (normalized.action.type === "set-parameter" && !normalized.action.targetParameter) errors.push({ path: "action.targetParameter", message: "Target parameter is required." });
  for (const targetId of normalized.targets.cardIds || []) if (!cardIds.has(targetId)) errors.push({ path: "targets.cardIds", message: `Target card '${targetId}' is missing.` });
  if (normalized.action.type === "set-parameter") {
    for (const targetId of normalized.targets.cardIds || []) {
      const parameterNames = cardParameters(targetId, dashboard, workspace);
      if (parameterNames.size && !parameterNames.has(normalized.action.targetParameter)) errors.push({ path: "action.targetParameter", message: `Target parameter '${normalized.action.targetParameter}' is not defined on card '${targetId}'.` });
    }
  }
  if ((normalized.targets.cardIds || []).includes(normalized.source.cardId) && normalized.targets.mode !== "self") errors.push({ path: "targets.cardIds", message: "Self-targeting bindings are rejected unless target mode is self." });
  const circular = (dashboard.interactions?.bindings || []).some((other) => other.enabled !== false && other.source?.cardId !== normalized.source.cardId && (other.targets?.cardIds || []).includes(normalized.source.cardId) && (normalized.targets.cardIds || []).includes(other.source.cardId));
  if (circular) errors.push({ path: "targets", message: "Circular binding would create a loop." });
  return { valid: errors.length === 0, errors, binding: normalized };
}

function cardFields(cardId, dashboard, workspace) {
  const card = (dashboard.layout || []).find((item) => item.id === cardId);
  const viz = (workspace.visualizations || []).find((item) => item.id === card?.visualizationId);
  const fields = new Set();
  for (const ref of Object.values(viz?.spec?.encoding || {})) {
    if (Array.isArray(ref)) ref.forEach((item) => item?.field && fields.add(item.field));
    else if (ref?.field) fields.add(ref.field);
  }
  return fields;
}

function cardParameters(cardId, dashboard, workspace) {
  const card = (dashboard.layout || []).find((item) => item.id === cardId);
  const viz = (workspace.visualizations || []).find((item) => item.id === card?.visualizationId);
  const query = (workspace.queries || []).find((item) => item.id === viz?.queryId);
  return new Set((query?.parameters || []).map((parameter) => parameter.name));
}

export function addInteractionBinding(dashboard, binding) {
  dashboard.interactions ||= { bindings: [], parameters: [], drilldowns: [], state: null };
  const normalized = normalizeInteractionBinding(binding);
  dashboard.interactions.bindings.push(normalized);
  dashboard.updatedAt = nowIso();
  return normalized;
}
