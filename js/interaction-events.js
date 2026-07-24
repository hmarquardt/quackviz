import { INTERACTION_VERSION } from "./constants.js";
import { deepClone, nowIso, uid } from "./utils.js";

export const INTERACTION_KINDS = ["category", "multi-category", "numeric-range", "date-range", "point", "map-feature", "map-region", "legend", "brush", "drill-down", "drill-up", "clear-selection", "parameter-change", "table-row"];
const SEMANTIC_TYPES = ["category", "number", "numeric", "date", "datetime", "boolean", "latitude", "longitude", "region", "us-state-abbreviation", "us-state-name", "us-state-fips", "country-name", "country-code-iso2", "country-code-iso3", "identifier"];

export function createInteractionEvent(input = {}) {
  return normalizeInteractionEvent({
    version: INTERACTION_VERSION,
    id: uid("interaction"),
    type: "selection",
    source: { dashboardId: null, cardId: null, visualizationId: null, renderer: "unknown", ...(input.source || {}) },
    selection: input.selection || {},
    modifiers: { additive: false, subtractive: false, range: false, ...(input.modifiers || {}) },
    timestamp: nowIso(),
    lineage: [],
    ...input,
  });
}

export function normalizeInteractionEvent(input) {
  const event = deepClone(input || {});
  return {
    version: event.version ?? INTERACTION_VERSION,
    id: event.id || uid("interaction"),
    type: event.type || "selection",
    source: {
      dashboardId: event.source?.dashboardId ?? null,
      cardId: event.source?.cardId ?? null,
      visualizationId: event.source?.visualizationId ?? null,
      renderer: event.source?.renderer || "unknown",
    },
    selection: normalizeSelection(event.selection || {}),
    modifiers: {
      additive: Boolean(event.modifiers?.additive),
      subtractive: Boolean(event.modifiers?.subtractive),
      range: Boolean(event.modifiers?.range),
    },
    timestamp: event.timestamp || nowIso(),
    lineage: Array.isArray(event.lineage) ? event.lineage.map((item) => ({ interactionId: item.interactionId, sourceCardId: item.sourceCardId })) : [],
  };
}

export function validateInteractionEvent(input) {
  const errors = [];
  if (containsExecutable(input)) errors.push({ path: "$", message: "Interaction event must not contain executable values." });
  const event = normalizeInteractionEvent(input);
  if (event.version !== INTERACTION_VERSION) errors.push({ path: "version", message: `Unsupported interaction version ${event.version}.` });
  if (!INTERACTION_KINDS.includes(event.selection.kind)) errors.push({ path: "selection.kind", message: `Unsupported interaction kind '${event.selection.kind}'.` });
  if (event.selection.semanticType && !SEMANTIC_TYPES.includes(event.selection.semanticType)) errors.push({ path: "selection.semanticType", message: `Unsupported semantic type '${event.selection.semanticType}'.` });
  if (!event.source.cardId && event.selection.kind !== "parameter-change") errors.push({ path: "source.cardId", message: "Source card is required for selection events." });
  if (["category", "multi-category", "map-region", "legend"].includes(event.selection.kind) && (!event.selection.field || !Array.isArray(event.selection.values))) errors.push({ path: "selection.values", message: "Category-like interactions require a field and values array." });
  if (["numeric-range", "date-range", "brush"].includes(event.selection.kind) && (!event.selection.field || event.selection.min == null || event.selection.max == null)) errors.push({ path: "selection", message: "Range interactions require field, min, and max." });
  return { valid: errors.length === 0, errors, event };
}

export function interactionSignature(input) {
  const event = normalizeInteractionEvent(input);
  return JSON.stringify({ type: event.type, source: event.source, selection: event.selection, modifiers: event.modifiers });
}

function normalizeSelection(selection) {
  return {
    kind: selection.kind || selection.type || "category",
    field: selection.field || "",
    semanticType: selection.semanticType || "category",
    values: Array.isArray(selection.values) ? selection.values.map(scalar) : selection.value == null ? [] : [scalar(selection.value)],
    min: selection.min ?? null,
    max: selection.max ?? null,
    inclusiveMin: selection.inclusiveMin !== false,
    inclusiveMax: selection.inclusiveMax !== false,
    featureId: selection.featureId ?? null,
    coordinates: Array.isArray(selection.coordinates) ? selection.coordinates.slice(0, 2).map(Number) : null,
  };
}

function scalar(value) {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function containsExecutable(value) {
  if (typeof value === "function") return true;
  if (typeof value === "string") return /^\s*(function|\(?\s*[\w,\s]*\)?\s*=>|<script\b)/i.test(value);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsExecutable);
}
