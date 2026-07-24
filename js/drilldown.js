import { uid } from "./utils.js";

export function createDrilldown(input = {}) {
  return {
    id: input.id || uid("drill"),
    name: input.name || input.title || "Drill-down",
    triggerField: input.triggerField || "",
    target: input.target || { type: "detail-table", queryId: null, visualizationId: null },
    parameterBindings: Array.isArray(input.parameterBindings) ? input.parameterBindings : [],
    breadcrumbLabelField: input.breadcrumbLabelField || input.triggerField || "",
    enabled: input.enabled !== false,
    hierarchy: Array.isArray(input.hierarchy) ? input.hierarchy : [],
    currentLevel: Number(input.currentLevel || 0),
    path: Array.isArray(input.path) ? input.path.map((item) => ({ ...item })) : [],
  };
}

export function buildBreadcrumb(path = []) {
  return ["All", ...path.map((item) => item.label || item.value)].join(" > ");
}

export function drillDown(drill, value) {
  const next = createDrilldown(drill);
  const level = next.hierarchy[next.currentLevel] || { field: next.triggerField, label: next.triggerField };
  return {
    ...next,
    path: [...next.path, { field: level.field, label: String(value), value }],
    currentLevel: Math.min(next.currentLevel + 1, Math.max(0, next.hierarchy.length - 1)),
  };
}

export function drillUp(drill) {
  const next = createDrilldown(drill);
  return {
    ...next,
    path: next.path.slice(0, -1),
    currentLevel: Math.max(0, next.currentLevel - 1),
  };
}

export function resetDrill(drill) {
  return { ...createDrilldown(drill), currentLevel: 0, path: [] };
}
