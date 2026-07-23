import { APP_VERSION, OPENROUTER } from "./constants.js";
import { fallbackModels } from "./ai-contracts.js";

export async function fetchOpenRouterModels({ apiKey, timeoutMs = 15000 } = {}) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(OPENROUTER.modelsUrl, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: controller.signal,
    });
    const durationMs = Math.round(performance.now() - startedAt);
    if (!response.ok) throw providerError("AI_MODEL_LIST_UNAVAILABLE", response.status, await safeText(response));
    const payload = await response.json();
    const models = (payload.data || []).map((model) => ({
      id: model.id,
      name: model.name || model.id,
      contextLength: model.context_length || null,
      fallback: false,
    })).filter((model) => model.id);
    return { models, refreshedAt: new Date().toISOString(), diagnostics: { httpStatus: response.status, durationMs } };
  } catch (error) {
    return { models: fallbackModels(), refreshedAt: null, error, diagnostics: { httpStatus: null, durationMs: Math.round(performance.now() - startedAt), fallback: true } };
  } finally {
    clearTimeout(timer);
  }
}

export async function requestOpenRouterJson({ apiKey, model, messages, temperature, maxTokens, timeoutMs, abortSignal = null }) {
  if (!apiKey) throw new Error("Missing OpenRouter API key.");
  const startedAt = performance.now();
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (abortSignal) abortSignal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${OPENROUTER.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Title": "QuackViz",
        "HTTP-Referer": location.origin,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        metadata: { appVersion: APP_VERSION },
        messages,
      }),
    });
    const text = await response.text();
    const diagnostics = { httpStatus: response.status, durationMs: Math.round(performance.now() - startedAt), provider: "openrouter", model };
    if (!response.ok) throw providerError("AI_PROVIDER_HTTP_ERROR", response.status, text);
    const payload = JSON.parse(text);
    return {
      content: payload.choices?.[0]?.message?.content || "{}",
      usage: payload.usage || null,
      diagnostics,
    };
  } finally {
    clearTimeout(timer);
    if (abortSignal) abortSignal.removeEventListener("abort", abort);
  }
}

function providerError(code, status, detail) {
  const error = new Error(`OpenRouter request failed with status ${status}.`);
  error.code = code;
  error.httpStatus = status;
  error.detail = detail;
  return error;
}

async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
