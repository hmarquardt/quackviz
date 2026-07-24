import { AI_CONTRACT_VERSION, APP_VERSION, OPENROUTER, SUPPORTED_CHART_TYPES, VIZ_SPEC_VERSION } from "./constants.js";

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
];

export function buildSystemPrompt(extra = "") {
  return `${extra ? `${extra}\n\n` : ""}You are QuackViz's analytical copilot.
Return JSON only. Do not wrap JSON in Markdown.
Contract version: ${AI_CONTRACT_VERSION}.
Application version: ${APP_VERSION}.
Use DuckDB SQL dialect.
Only read-only analytical SQL is allowed. SQL must begin with SELECT or WITH.
Do not use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, COPY, INSTALL, LOAD, ATTACH, DETACH, CALL, PRAGMA, external URL reads, JavaScript, HTML, ECharts raw options, formatter functions, event handlers, or arbitrary URLs.
Supported QuackViz visualization spec version: ${VIZ_SPEC_VERSION}.
Supported chart types: ${SUPPORTED_CHART_TYPES.join(", ")}.
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
  return AI_CONTRACTS.proposals;
}

export function fallbackModels() {
  return OPENROUTER.fallbackModels.map((model) => ({ ...model, fallback: true }));
}
