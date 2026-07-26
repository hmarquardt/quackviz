import { filterModels, formatContextLength, modelProviders, normalizeAndSortModels, updateRecentModels } from "../js/ai-models.js";
const assert = (value, message) => { if (!value) throw new Error(message); };
const input = [
  { id: "openai/gpt-10", name: "GPT 10", context_length: 1_000_000 }, { id: "Anthropic/claude-4", name: "Claude 4" },
  { id: "google/gemini-2", name: "Gemini 2" }, { id: "openai/gpt-2", name: "gpt 2" },
  { id: "meta/llama-3.5", name: "Llama 3.5" }, { id: "mistral/mistral-3", name: "Mistral 3" },
  { id: "qwen/qwen-4.1", name: "Qwen 4.1" }, { id: "xai/grok-3", name: "Grok 3" },
  { id: "openai/gpt-4.1", name: "GPT 4.1" }, { id: "orphan" },
];
const models = () => normalizeAndSortModels(input);
export const aiModelTests = [
  { name: "ai-models: deterministic shuffled input", run: () => assert(normalizeAndSortModels([...input].reverse()).map((m) => m.id).join() === models().map((m) => m.id).join(), "arrival order leaked") },
  { name: "ai-models: provider and numeric model order", run: () => { assert(modelProviders(models()).join() === "Anthropic,google,meta,mistral,openai,orphan,qwen,xai", "providers unsorted"); assert(models().filter((m) => m.provider === "openai").map((m) => m.name).join() === "gpt 2,GPT 4.1,GPT 10", "models unsorted"); } },
  { name: "ai-models: stable ID tiebreak", run: () => assert(normalizeAndSortModels([{ id: "p/b", name: "Same" }, { id: "p/a", name: "same" }])[0].id === "p/a", "tiebreak wrong") },
  { name: "ai-models: missing name and provider prefix", run: () => { const value = normalizeAndSortModels([{ id: "model" }])[0]; assert(value.name === "model" && value.provider === "model", "fallback missing"); } },
  { name: "ai-models: favorite recent tiers and overlap", run: () => { const value = normalizeAndSortModels(input, { favoriteModelIds: ["xai/grok-3"], recentModelIds: ["xai/grok-3", "qwen/qwen-4.1"] }); assert(value[0].id === "xai/grok-3" && value[1].id === "qwen/qwen-4.1", "tiers wrong"); } },
  { name: "ai-models: selected preservation", run: () => assert(normalizeAndSortModels(input, { selectedModelId: "google/gemini-2" }).find((m) => m.selected).id === "google/gemini-2", "selected lost") },
  { name: "ai-models: missing selected remains missing", run: () => assert(!normalizeAndSortModels(input, { selectedModelId: "missing/model" }).some((m) => m.selected), "selected invented") },
  { name: "ai-models: search name ID and provider", run: () => { const value = models(); assert(filterModels(value, { search: "claude" }).length === 1 && filterModels(value, { search: "openai/gpt-4.1" }).length === 1 && filterModels(value, { search: "mistral" }).length === 1, "search failed"); } },
  { name: "ai-models: provider filter", run: () => assert(filterModels(models(), { provider: "openai" }).length === 3, "filter failed") },
  { name: "ai-models: context format", run: () => assert(formatContextLength(128000) === "128K" && formatContextLength(1000000) === "1M", "format wrong") },
  { name: "ai-models: input immutable", run: () => { const copy = JSON.stringify(input); normalizeAndSortModels(input); assert(JSON.stringify(input) === copy, "mutated"); } },
  { name: "ai-models: old cache normalization", run: () => assert(normalizeAndSortModels([{ id: "p/x", context_length: 32000 }])[0].contextLength === 32000, "cache failed") },
  { name: "ai-models: recents bounded", run: () => assert(updateRecentModels(Array.from({ length: 12 }, (_, i) => `p/${i}`), "p/new").length === 10, "unbounded") },
];
