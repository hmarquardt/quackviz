import { AI_CONTRACT_VERSION, APP_VERSION, OPENROUTER, SUPPORTED_CHART_TYPES, SUPPORTED_MAP_TYPES, VIZ_SPEC_VERSION } from "./constants.js";

export const AI_CONTRACTS = {
  proposals: "quackviz-ai-proposals",
  repair: "quackviz-ai-repair",
  explanation: "quackviz-ai-result-explanation",
  critique: "quackviz-ai-chart-critique",
  dashboard: "quackviz-ai-dashboard",
  dashboardCritique: "quackviz-ai-dashboard-critique",
  reportOutline: "quackviz-ai-report-outline",
  reportNarrative: "quackviz-ai-report-narrative",
  reportCritique: "quackviz-ai-report-critique",
  mapProposals: "quackviz-ai-map-proposals",
  regionRepair: "quackviz-ai-region-repair",
  interactions: "quackviz-ai-interactions",
  interactionCritique: "quackviz-ai-interaction-critique",
};

export const AI_ACTIONS = [
  { id: "explore-dataset", label: "Explore dataset" },
  { id: "generate-visualizations", label: "Generate visualization proposals" },
  { id: "generate-sql", label: "Generate SQL" },
  { id: "explain-result", label: "Explain current result" },
  { id: "critique-visualization", label: "Critique visualization" },
  { id: "improve-visualization", label: "Improve visualization" },
  { id: "repair-sql", label: "Repair failed SQL" },
  { id: "explain-sql", label: "Explain SQL" },
  { id: "build-dashboard", label: "Build a dashboard" },
  { id: "critique-dashboard", label: "Critique dashboard" },
  { id: "build-report-outline", label: "Build report outline" },
  { id: "draft-report-narrative", label: "Draft report narrative" },
  { id: "critique-report", label: "Critique report" },
  { id: "suggest-maps", label: "Suggest maps" },
  { id: "build-map", label: "Build map" },
  { id: "explain-spatial-pattern", label: "Explain spatial pattern" },
  { id: "repair-map-sql", label: "Repair map SQL" },
  { id: "repair-region-matching", label: "Repair region matching" },
  { id: "critique-map", label: "Critique current map" },
  { id: "improve-map", label: "Improve current map" },
  { id: "suggest-interactions", label: "Suggest dashboard interactions" },
  { id: "suggest-drilldowns", label: "Suggest drill-downs" },
  { id: "suggest-parameters", label: "Suggest parameters" },
  { id: "critique-interactions", label: "Critique interaction design" },
  { id: "repair-binding", label: "Repair broken interaction" },
];

export function buildSystemPrompt(extra = "") {
  return `${extra ? `${extra}\n\n` : ""}You are QuackViz's analytical copilot.
Return JSON only. Do not wrap JSON in Markdown.
Contract version: ${AI_CONTRACT_VERSION}.
Application version: ${APP_VERSION}.
Use DuckDB SQL dialect.
Only read-only analytical SQL is allowed. SQL must begin with SELECT or WITH.
Do not use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, COPY, INSTALL, LOAD, ATTACH, DETACH, CALL, PRAGMA, external URL reads, JavaScript, HTML, ECharts raw options, formatter functions, event handlers, or arbitrary URLs.
Interaction proposals must be declarative bindings, typed parameters, or drill-down definitions only. Do not return JavaScript callbacks, raw SQL fragments as parameter values, or event handler code.
Supported QuackViz visualization spec version: ${VIZ_SPEC_VERSION}.
Supported chart types: ${SUPPORTED_CHART_TYPES.join(", ")}.
Supported map types: ${SUPPORTED_MAP_TYPES.join(", ")}.
Map specs must be constrained QuackViz map specs, not raw MapLibre styles or layers. Do not return remote tile URLs.
SQL aliases must match expectedColumns and visualization encoding fields.
Every proposal must include assumptions, cautions, sourceTables, confidence, reasoning, SQL, expectedColumns, and a QuackViz visualization spec when a visualization is requested.
Prefer 3 to 6 high-value proposals over many shallow proposals.`;
}

export function actionContract(action) {
  if (action === "repair-sql") return AI_CONTRACTS.repair;
  if (action === "explain-result") return AI_CONTRACTS.explanation;
  if (action === "critique-visualization" || action === "improve-visualization") return AI_CONTRACTS.critique;
  if (action === "build-dashboard") return AI_CONTRACTS.dashboard;
  if (action === "critique-dashboard") return AI_CONTRACTS.dashboardCritique;
  if (action === "build-report-outline") return AI_CONTRACTS.reportOutline;
  if (action === "draft-report-narrative") return AI_CONTRACTS.reportNarrative;
  if (action === "critique-report") return AI_CONTRACTS.reportCritique;
  if (["suggest-maps", "build-map"].includes(action)) return AI_CONTRACTS.mapProposals;
  if (action === "repair-region-matching") return AI_CONTRACTS.regionRepair;
  if (["explain-spatial-pattern", "repair-map-sql", "critique-map", "improve-map"].includes(action)) return AI_CONTRACTS.mapProposals;
  if (["suggest-interactions", "suggest-drilldowns", "suggest-parameters", "repair-binding"].includes(action)) return AI_CONTRACTS.interactions;
  if (action === "critique-interactions") return AI_CONTRACTS.interactionCritique;
  return AI_CONTRACTS.proposals;
}

export function fallbackModels() {
  return OPENROUTER.fallbackModels.map((model) => ({ ...model, fallback: true }));
}
