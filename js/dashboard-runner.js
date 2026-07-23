import { DASHBOARD_CONCURRENCY_LIMIT } from "./constants.js";
import { runQuery } from "./query.js";
import { validateSqlSafety } from "./ai-sql-safety.js";
import { applyDashboardFilters } from "./dashboard-filters.js";
import { validateVisualizationSpec } from "./viz-spec.js";

const cache = new Map();
let revision = 0;
let lastStats = {
  durationMs: null,
  successful: 0,
  failed: 0,
  cancelled: 0,
  concurrencyLimit: DASHBOARD_CONCURRENCY_LIMIT,
};

export function invalidateDashboardCache() {
  revision += 1;
  cache.clear();
}

export function getDashboardRunnerStatus() {
  return { ...lastStats, cacheEntries: cache.size, revision };
}

export async function refreshDashboard({ dashboard, workspace, loadedTables = new Set(), bypassCache = false, concurrencyLimit = DASHBOARD_CONCURRENCY_LIMIT, signal = null }) {
  const startedAt = performance.now();
  const states = {};
  const cards = dashboard.layout.filter((card) => card.refreshEnabled !== false);
  const queue = cards.slice();
  let successful = 0;
  let failed = 0;
  let cancelled = 0;
  async function worker() {
    while (queue.length) {
      if (signal?.aborted) {
        cancelled += queue.length;
        queue.length = 0;
        return;
      }
      const card = queue.shift();
      states[card.id] = await refreshCard({ dashboard, card, workspace, loadedTables, bypassCache, signal });
      if (states[card.id].status === "ready") successful += 1;
      else if (states[card.id].status === "cancelled") cancelled += 1;
      else failed += 1;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrencyLimit, Math.max(1, cards.length)) }, worker));
  lastStats = { durationMs: Math.round(performance.now() - startedAt), successful, failed, cancelled, concurrencyLimit };
  return { states, ...lastStats };
}

export async function refreshCard({ dashboard, card, workspace, loadedTables = new Set(), bypassCache = false, signal = null, execute = runQuery }) {
  const resolved = resolveCard(card, workspace, loadedTables);
  if (!resolved.ok) return state(card.id, resolved.status, resolved.error);
  const baseSafety = validateSqlSafety(resolved.query.sql, resolved.query.sourceTables || []);
  if (!baseSafety.ok) return state(card.id, "error", baseSafety.errors[0]?.message || "SQL safety failed.");
  const basePreview = await execute(`SELECT * FROM (${baseSafety.sql}) AS __quackviz_filter_probe LIMIT 0`, resolved.query.id);
  if (basePreview.error) return state(card.id, "error", basePreview.error.message);
  const filterResult = applyDashboardFilters({
    sql: baseSafety.sql,
    filters: [...(dashboard.filters || []), ...(card.localFilters || [])],
    columns: basePreview.columns,
  });
  const filteredSafety = validateSqlSafety(filterResult.sql, resolved.query.sourceTables || []);
  if (!filteredSafety.ok) return state(card.id, "error", filteredSafety.errors[0]?.message || "Filtered SQL failed safety checks.", { filterResult });
  const signature = signatureFor({ query: resolved.query, sql: filteredSafety.sql, card, dashboard });
  if (!bypassCache && cache.has(signature)) return { ...cache.get(signature), cached: true };
  if (signal?.aborted) return state(card.id, "cancelled", "Refresh cancelled.");
  const result = await execute(filteredSafety.sql, resolved.query.id);
  if (result.error) return state(card.id, "error", result.error.message, { filterResult, resultSignature: signature });
  const spec = { ...resolved.visualization.spec, dataset: { queryId: resolved.query.id } };
  const specValidation = validateVisualizationSpec(spec, result);
  if (!specValidation.valid) return state(card.id, "error", specValidation.errors[0]?.message || "Visualization spec is invalid.", { filterResult, resultSignature: signature, result });
  const ready = state(card.id, "ready", null, {
    result,
    visualization: resolved.visualization,
    query: resolved.query,
    spec: specValidation.spec,
    runtimeMs: result.runtimeMs,
    rowCount: result.rowCount,
    refreshedAt: result.executedAt,
    resultSignature: signature,
    filterResult,
    cached: false,
  });
  cache.set(signature, ready);
  return ready;
}

export function resolveCard(card, workspace, loadedTables = new Set()) {
  const visualization = workspace.visualizations.find((viz) => viz.id === card.visualizationId);
  if (!visualization) return { ok: false, status: "unavailable", error: "Referenced visualization is missing." };
  const query = workspace.queries.find((item) => item.id === visualization.queryId);
  if (!query) return { ok: false, status: "unavailable", error: "Referenced query is missing." };
  const missingSource = (query.sourceTables || []).find((table) => !loadedTables.has(table));
  if (missingSource) return { ok: false, status: "unavailable", error: `Source table '${missingSource}' is not loaded.` };
  return { ok: true, visualization, query };
}

function state(cardId, status, error = null, extra = {}) {
  return {
    cardId,
    status,
    error,
    runtimeMs: extra.runtimeMs ?? null,
    rowCount: extra.rowCount ?? null,
    refreshedAt: extra.refreshedAt ?? null,
    resultSignature: extra.resultSignature ?? null,
    cached: Boolean(extra.cached),
    ...extra,
  };
}

function signatureFor({ query, sql, card, dashboard }) {
  return JSON.stringify({
    revision,
    queryId: query.id,
    sql,
    dashboardFilters: dashboard.filters || [],
    localFilters: card.localFilters || [],
  });
}
