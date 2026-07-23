import { OPENROUTER } from "./constants.js";
import { nowIso, uid } from "./utils.js";

export function makeInteraction({ action, model, selectedTables, contextMode, sampleRowsIncluded, userQuestion }) {
  return {
    id: uid("ai"),
    timestamp: nowIso(),
    action,
    provider: OPENROUTER.provider,
    model,
    selectedTables,
    contextMode,
    sampleRowsIncluded,
    userQuestion: userQuestion || "",
    summary: "",
    proposalIds: [],
    usage: null,
    diagnostics: {},
    status: "pending",
    error: null,
  };
}

export function sanitizeInteraction(interaction) {
  const clone = JSON.parse(JSON.stringify(interaction || {}));
  delete clone.apiKey;
  delete clone.authorization;
  delete clone.headers;
  delete clone.rawRows;
  return clone;
}
