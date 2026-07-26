const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

export function formatContextLength(value) {
  const length = Number(value);
  if (!Number.isFinite(length) || length <= 0) return "";
  if (length >= 1_000_000) return `${trim(length / 1_000_000)}M`;
  return `${trim(length / 1_000)}K`;
}

export function normalizeAndSortModels(models, { selectedModelId = null, favoriteModelIds = [], recentModelIds = [] } = {}) {
  const favorites = new Set(favoriteModelIds);
  const recents = new Map(recentModelIds.map((id, index) => [id, index]));
  const normalized = (Array.isArray(models) ? models : []).map((input) => {
    const model = { ...input };
    const id = String(model.id || "").trim();
    if (!id) return null;
    const provider = String(model.provider || id.split("/")[0] || "Other").trim();
    const name = String(model.name || id.split("/").at(-1) || id).trim();
    const contextLength = Number(model.contextLength ?? model.context_length) || null;
    return {
      ...model,
      id,
      name,
      provider,
      contextLength,
      fallback: Boolean(model.fallback),
      favorite: favorites.has(id),
      recentIndex: recents.has(id) ? recents.get(id) : null,
      selected: id === selectedModelId,
      searchText: `${provider} ${name} ${id} ${formatContextLength(contextLength)}`.toLocaleLowerCase(),
    };
  }).filter(Boolean);
  return normalized.sort((left, right) => {
    const leftTier = left.favorite ? 0 : left.recentIndex !== null ? 1 : 2;
    const rightTier = right.favorite ? 0 : right.recentIndex !== null ? 1 : 2;
    return leftTier - rightTier
      || (leftTier === 1 ? left.recentIndex - right.recentIndex : 0)
      || collator.compare(left.provider, right.provider)
      || collator.compare(left.name, right.name)
      || collator.compare(left.id, right.id);
  });
}

export function filterModels(models, { search = "", provider = "all" } = {}) {
  const term = search.trim().toLocaleLowerCase();
  return models.filter((model) => (
    (provider === "all" || model.provider === provider)
    && (!term || model.searchText.includes(term))
  ));
}

export function modelProviders(models) {
  return [...new Set(models.map((model) => model.provider))].sort(collator.compare);
}

export function modelOptionLabel(model) {
  const context = formatContextLength(model.contextLength);
  return `${model.name} — ${model.id}${context ? ` · ${context}` : ""}`;
}

export function updateRecentModels(ids, modelId, limit = 10) {
  return [modelId, ...(ids || []).filter((id) => id !== modelId)].filter(Boolean).slice(0, limit);
}

function trim(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}
