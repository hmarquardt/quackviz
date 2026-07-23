import { AI_CONTRACT_VERSION, APP_VERSION, OPENROUTER, SUPPORTED_CHART_TYPES, VIZ_SPEC_VERSION } from "./constants.js";

export const AI_CONTRACTS = {
  proposals: "quackviz-ai-proposals",
  repair: "quackviz-ai-repair",
  explanation: "quackviz-ai-result-explanation",
  critique: "quackviz-ai-chart-critique",
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
  return AI_CONTRACTS.proposals;
}

export function fallbackModels() {
  return OPENROUTER.fallbackModels.map((model) => ({ ...model, fallback: true }));
}
