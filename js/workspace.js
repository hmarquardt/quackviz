import { createWorkspace, state } from "./state.js";

export function exportWorkspace() {
  return JSON.stringify(state.workspace, null, 2);
}

export function importWorkspace(text) {
  const parsed = JSON.parse(text);
  if (parsed.version !== 1 || !Array.isArray(parsed.queries) || !Array.isArray(parsed.visualizations)) {
    throw new Error("Unsupported workspace format.");
  }
  state.workspace = { ...createWorkspace(), ...parsed, dashboards: parsed.dashboards || [] };
  return state.workspace;
}

