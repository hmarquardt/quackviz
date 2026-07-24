import { INTERACTION_HISTORY_LIMIT } from "./constants.js";
import { normalizeInteractionEvent } from "./interaction-events.js";
import { nowIso } from "./utils.js";

export function createInteractionState(input = {}) {
  return {
    activeSelections: Array.isArray(input.activeSelections) ? input.activeSelections.map(normalizeInteractionEvent) : [],
    activeFilters: Array.isArray(input.activeFilters) ? input.activeFilters : [],
    activeHighlights: Array.isArray(input.activeHighlights) ? input.activeHighlights : [],
    activeParameters: input.activeParameters || {},
    drillPath: Array.isArray(input.drillPath) ? input.drillPath : [],
    history: Array.isArray(input.history) ? input.history.slice(0, INTERACTION_HISTORY_LIMIT) : [],
    restoreLastState: Boolean(input.restoreLastState),
  };
}

export function applyInteractionResolution(state, event, resolution) {
  const next = createInteractionState(state);
  next.activeSelections = event.selection.kind === "clear-selection" ? [] : [normalizeInteractionEvent(event)];
  next.activeFilters = resolution.filters || [];
  next.activeHighlights = resolution.highlights || [];
  next.activeParameters = { ...next.activeParameters, ...(resolution.parameters || {}) };
  next.history.unshift({
    id: event.id,
    type: event.selection.kind,
    sourceCardId: event.source.cardId,
    summary: summarizeEvent(event),
    affectedCardIds: resolution.affectedCardIds || [],
    skippedCardIds: (resolution.skippedTargets || []).map((item) => item.cardId),
    timestamp: event.timestamp,
    clearedAt: null,
  });
  next.history = next.history.slice(0, INTERACTION_HISTORY_LIMIT);
  return next;
}

export function clearInteractionState(state) {
  return { ...createInteractionState(state), activeSelections: [], activeFilters: [], activeHighlights: [], activeParameters: {}, drillPath: [], history: (state.history || []).map((item) => ({ ...item, clearedAt: item.clearedAt || nowIso() })) };
}

export function summarizeEvent(event) {
  if (event.selection.values?.length) return `${event.selection.field} = ${event.selection.values.join(", ")}`;
  if (event.selection.min != null) return `${event.selection.field} between ${event.selection.min} and ${event.selection.max}`;
  return event.selection.kind;
}
