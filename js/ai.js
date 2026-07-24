import { OPENROUTER } from "./constants.js";
import { buildSystemPrompt, actionContract } from "./ai-contracts.js";
import { requestOpenRouterJson, fetchOpenRouterModels } from "./ai-client.js";
import { buildAiContext } from "./ai-context.js";
import { parseAiJson, validateAiResponse } from "./ai-validate.js";
import { createProposalState } from "./ai-proposals.js";

export { fetchOpenRouterModels };

export async function runAiAction({ apiKey, action, question, workspace, selectedTables, currentResult, currentSpec, recommendations, settings, abortSignal = null }) {
  if (!settings.enabled) throw categorized("AI_DISABLED", "AI is disabled.");
  if (!apiKey) throw categorized("AI_MISSING_API_KEY", "OpenRouter API key is required.");
  const context = buildAiContext({ workspace, selectedTableNames: selectedTables, result: currentResult, recommendations, settings });
  const expectedContract = actionContract(action);
  const messages = [
    { role: "system", content: buildSystemPrompt(settings.customSystemPrompt) },
    {
      role: "user",
      content: JSON.stringify({
        action,
        expectedContract,
        question: question || "",
        context: context.context,
        currentVisualizationSpec: currentSpec || null,
      }),
    },
  ];
  const response = await requestOpenRouterJson({
    apiKey,
    model: settings.model,
    messages,
    temperature: settings.temperature,
    maxTokens: settings.maxOutputTokens,
    timeoutMs: settings.timeoutMs,
    abortSignal,
  });
  const parsed = parseAiJson(response.content);
  if (!parsed.ok) {
    const error = categorized("AI_JSON_PARSE_FAILURE", parsed.error.message);
    error.diagnostics = response.diagnostics;
    throw error;
  }
  const workspaceContracts = new Set(["quackviz-ai-dashboard", "quackviz-ai-report-outline", "quackviz-ai-package-plan"]);
  const activeDashboard = workspace.dashboards?.find((dashboard) => dashboard.id === workspace.active?.dashboardId) || workspace.dashboards?.[0] || null;
  const interactionDataset = activeDashboard ? { ...activeDashboard, workspace } : {};
  const validationDataset = expectedContract === "quackviz-ai-interactions" ? interactionDataset : workspaceContracts.has(expectedContract) ? workspace : currentResult;
  const validation = validateAiResponse(parsed.value, { expectedContract, knownTables: selectedTables, dataset: validationDataset });
  const result = {
    action,
    provider: OPENROUTER.provider,
    model: settings.model,
    context,
    raw: parsed.value,
    validation,
    usage: response.usage,
    diagnostics: {
      ...response.diagnostics,
      parseSuccess: true,
      contractValidationSuccess: validation.valid,
      contractVersion: parsed.value.contractVersion,
      proposalCount: validation.proposals?.length || 0,
      mapProposalCount: expectedContract === "quackviz-ai-map-proposals" ? validation.proposals?.length || 0 : 0,
      interactionProposalCount: expectedContract === "quackviz-ai-interactions" ? (validation.interactions?.bindings?.length || validation.interactions?.normalizedBindings?.length || 0) : 0,
      packagePlan: expectedContract === "quackviz-ai-package-plan" ? validation.valid : false,
    },
  };
  if (expectedContract === "quackviz-ai-proposals" || expectedContract === "quackviz-ai-map-proposals") result.proposalState = createProposalState(validation);
  return result;
}

function categorized(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
