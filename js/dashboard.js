import { DASHBOARD_GRID_COLUMNS, DASHBOARD_VERSION } from "./constants.js";
import { normalizeInteractionBinding } from "./interaction-bindings.js";
import { createInteractionState } from "./interaction-state.js";
import { createDrilldown } from "./drilldown.js";
import { normalizeParameter } from "./parameters.js";
import { deepClone, nowIso, uid } from "./utils.js";

export const CARD_SIZES = {
  small: { width: 4, height: 3 },
  medium: { width: 6, height: 4 },
  wide: { width: 8, height: 4 },
  full: { width: 12, height: 5 },
  tall: { width: 6, height: 6 },
};

export function createDashboard(input = {}) {
  const timestamp = nowIso();
  return normalizeDashboard({
    id: uid("dashboard"),
    version: DASHBOARD_VERSION,
    name: "New dashboard",
    description: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: "user",
    layout: [],
    filters: [],
    settings: {
      refreshMode: "manual",
      refreshIntervalSeconds: null,
      showFilterBar: true,
      showDescriptions: false,
      compactCards: false,
      concurrencyLimit: 3,
    },
    interactions: { bindings: [], parameters: [], drilldowns: [], state: null },
    provenance: { createdBy: "user", provider: null, model: null, interactionId: null, createdAt: timestamp },
    ...input,
  });
}

export function normalizeDashboard(input) {
  if (!input || typeof input !== "object") throw new Error("Dashboard must be an object.");
  if (input.version && input.version > DASHBOARD_VERSION) throw new Error(`Unsupported future dashboard version ${input.version}.`);
  const timestamp = nowIso();
  return {
    id: input.id || uid("dashboard"),
    version: DASHBOARD_VERSION,
    name: input.name || "Untitled dashboard",
    description: input.description || "",
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
    createdBy: input.createdBy || input.provenance?.createdBy || "user",
    layout: Array.isArray(input.layout) ? input.layout.map(normalizeCard) : [],
    filters: Array.isArray(input.filters) ? input.filters.map(normalizeFilter) : [],
    settings: {
      refreshMode: input.settings?.refreshMode || "manual",
      refreshIntervalSeconds: input.settings?.refreshIntervalSeconds ?? null,
      showFilterBar: input.settings?.showFilterBar !== false,
      showDescriptions: Boolean(input.settings?.showDescriptions),
      compactCards: Boolean(input.settings?.compactCards),
      concurrencyLimit: Number(input.settings?.concurrencyLimit || 3),
    },
    interactions: {
      bindings: Array.isArray(input.interactions?.bindings) ? input.interactions.bindings.map(normalizeInteractionBinding) : [],
      parameters: Array.isArray(input.interactions?.parameters) ? input.interactions.parameters.map(normalizeParameter) : [],
      drilldowns: Array.isArray(input.interactions?.drilldowns) ? input.interactions.drilldowns.map(createDrilldown) : [],
      state: input.interactions?.state ? createInteractionState(input.interactions.state) : null,
    },
    provenance: {
      createdBy: input.provenance?.createdBy || input.createdBy || "user",
      provider: input.provenance?.provider ?? null,
      model: input.provenance?.model ?? null,
      interactionId: input.provenance?.interactionId ?? null,
      createdAt: input.provenance?.createdAt || input.createdAt || timestamp,
    },
  };
}

export function normalizeCard(card) {
  return {
    id: card.id || uid("card"),
    visualizationId: card.visualizationId || null,
    x: clamp(Number(card.x || 0), 0, DASHBOARD_GRID_COLUMNS - 1),
    y: Math.max(0, Number(card.y || 0)),
    width: clamp(Number(card.width || CARD_SIZES.medium.width), 1, DASHBOARD_GRID_COLUMNS),
    height: clamp(Number(card.height || CARD_SIZES.medium.height), 2, 12),
    titleOverride: card.titleOverride ?? null,
    showTitle: card.showTitle !== false,
    showDescription: Boolean(card.showDescription),
    refreshEnabled: card.refreshEnabled !== false,
    localFilters: Array.isArray(card.localFilters) ? card.localFilters.map(normalizeFilter) : [],
    parameterValues: card.parameterValues || {},
    provenance: card.provenance || null,
  };
}

export function normalizeFilter(filter) {
  return {
    id: filter.id || uid("filter"),
    name: filter.name || filter.field || "Filter",
    field: filter.field || "",
    semanticType: filter.semanticType || "category",
    operator: filter.operator || "in",
    value: filter.value ?? null,
    sourceTables: Array.isArray(filter.sourceTables) ? filter.sourceTables : [],
    appliesTo: filter.appliesTo || { mode: "compatible", cardIds: [] },
    enabled: filter.enabled !== false,
  };
}

export function addDashboard(workspace, dashboard = createDashboard()) {
  const normalized = normalizeDashboard(dashboard);
  workspace.dashboards.push(normalized);
  workspace.active.dashboardId = normalized.id;
  workspace.updatedAt = nowIso();
  return normalized;
}

export function updateDashboard(workspace, dashboardId, patch) {
  const dashboard = findDashboard(workspace, dashboardId);
  Object.assign(dashboard, patch, { updatedAt: nowIso() });
  workspace.updatedAt = nowIso();
  return dashboard;
}

export function duplicateDashboard(workspace, dashboardId) {
  const source = findDashboard(workspace, dashboardId);
  const copy = normalizeDashboard({
    ...deepClone(source),
    id: uid("dashboard"),
    name: `${source.name} copy`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    layout: source.layout.map((card) => ({ ...card, id: uid("card") })),
  });
  workspace.dashboards.push(copy);
  workspace.active.dashboardId = copy.id;
  workspace.updatedAt = nowIso();
  return copy;
}

export function deleteDashboard(workspace, dashboardId) {
  workspace.dashboards = workspace.dashboards.filter((dashboard) => dashboard.id !== dashboardId);
  if (workspace.active.dashboardId === dashboardId) workspace.active.dashboardId = workspace.dashboards[0]?.id || null;
  workspace.updatedAt = nowIso();
}

export function addCard(dashboard, visualizationId, size = "medium") {
  if (!visualizationId) throw new Error("Visualization ID is required.");
  const dims = CARD_SIZES[size] || CARD_SIZES.medium;
  const card = normalizeCard({
    id: uid("card"),
    visualizationId,
    x: 0,
    y: nextY(dashboard.layout),
    width: dims.width,
    height: dims.height,
  });
  dashboard.layout.push(card);
  dashboard.updatedAt = nowIso();
  return card;
}

export function removeCard(dashboard, cardId) {
  dashboard.layout = dashboard.layout.filter((card) => card.id !== cardId);
  dashboard.updatedAt = nowIso();
}

export function duplicateCard(dashboard, cardId) {
  const card = findCard(dashboard, cardId);
  const copy = normalizeCard({ ...deepClone(card), id: uid("card"), y: card.y + 1 });
  dashboard.layout.push(copy);
  dashboard.updatedAt = nowIso();
  return copy;
}

export function moveCard(dashboard, cardId, dx, dy) {
  const card = findCard(dashboard, cardId);
  card.x = clamp(card.x + dx, 0, Math.max(0, DASHBOARD_GRID_COLUMNS - card.width));
  card.y = Math.max(0, card.y + dy);
  dashboard.updatedAt = nowIso();
  return card;
}

export function resizeCard(dashboard, cardId, dw, dh) {
  const card = findCard(dashboard, cardId);
  card.width = clamp(card.width + dw, 1, DASHBOARD_GRID_COLUMNS);
  card.x = clamp(card.x, 0, Math.max(0, DASHBOARD_GRID_COLUMNS - card.width));
  card.height = clamp(card.height + dh, 2, 12);
  dashboard.updatedAt = nowIso();
  return card;
}

export function validateDashboard(dashboard, workspace) {
  const errors = [];
  const vizIds = new Set((workspace.visualizations || []).map((viz) => viz.id));
  for (const [index, card] of (dashboard.layout || []).entries()) {
    if (!vizIds.has(card.visualizationId)) errors.push({ path: `layout.${index}.visualizationId`, message: `Visualization '${card.visualizationId}' does not exist.` });
    if (card.width < 1 || card.width > DASHBOARD_GRID_COLUMNS) errors.push({ path: `layout.${index}.width`, message: "Card width is outside dashboard grid bounds." });
    if (card.x < 0 || card.x + card.width > DASHBOARD_GRID_COLUMNS) errors.push({ path: `layout.${index}.x`, message: "Card x position is outside dashboard grid bounds." });
  }
  return { valid: errors.length === 0, errors };
}

export function findDashboard(workspace, dashboardId = workspace.active.dashboardId) {
  const dashboard = workspace.dashboards.find((item) => item.id === dashboardId);
  if (!dashboard) throw new Error("Dashboard not found.");
  return dashboard;
}

export function findCard(dashboard, cardId) {
  const card = dashboard.layout.find((item) => item.id === cardId);
  if (!card) throw new Error("Dashboard card not found.");
  return card;
}

function nextY(cards) {
  return cards.reduce((max, card) => Math.max(max, card.y + card.height), 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
