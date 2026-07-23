import { validateAnalyticalSql } from "./query.js";
import { validateVisualizationSpec } from "./viz-spec.js";

const OPENROUTER = "https://openrouter.ai/api/v1";

export async function fetchModels(apiKey) {
  const response = await fetch(`${OPENROUTER}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw new Error(`OpenRouter models request failed: ${response.status}`);
  return (await response.json()).data || [];
}

export async function requestAiProposals({ apiKey, model, systemPrompt, workspace, tables, profiles }) {
  const prompt = `Return strict JSON only matching the QuackViz proposal contract. Use SELECT or WITH SQL only. Tables: ${JSON.stringify(tables)} Profiles: ${JSON.stringify(profiles)} Workspace queries: ${JSON.stringify(workspace.queries.map((q) => ({ id: q.id, name: q.name, sql: q.sql })))}.`;
  const response = await fetch(`${OPENROUTER}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "HTTP-Referer": location.href, "X-Title": "QuackViz" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt || "You propose browser-local DuckDB SQL and QuackViz visualization specs. Return JSON only. Never include functions, HTML, JavaScript, or raw ECharts options." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter request failed: ${response.status}`);
  return validateAiProposal(JSON.parse((await response.json()).choices?.[0]?.message?.content || "{}"));
}

export function validateAiProposal(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") errors.push("AI response was not an object.");
  if (!Array.isArray(payload.visualizations)) errors.push("AI response must include visualizations array.");
  for (const [index, viz] of (payload.visualizations || []).entries()) {
    const sql = validateAnalyticalSql(viz.sql || "");
    if (!sql.valid) errors.push(`Proposal ${index + 1} SQL: ${sql.errors.join(" ")}`);
    const spec = validateVisualizationSpec({ ...(viz.spec || {}), dataset: { queryId: "pending" } });
    if (!spec.valid) errors.push(`Proposal ${index + 1} spec: ${spec.errors.join(" ")}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return payload;
}

