import { PERFORMANCE_HISTORY_LIMIT } from "./constants.js";
import { nowIso, uid } from "./utils.js";

function safeNow() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

export function createPerformanceMonitor({ historyLimit = PERFORMANCE_HISTORY_LIMIT } = {}) {
  const spans = new Map();
  const history = [];
  const counters = new Map();
  const warnings = [];

  function record(item) {
    history.unshift(item);
    if (history.length > historyLimit) history.length = historyLimit;
    if (item.durationMs > 1000) warnings.unshift({ operation: item.name, durationMs: item.durationMs, timestamp: item.finishedAt });
    if (warnings.length > 20) warnings.length = 20;
  }

  return {
    start(name, metadata = {}) {
      const id = uid("span");
      const startedAtMs = safeNow();
      const span = {
        id,
        name,
        metadata: structuredCloneSafe(metadata),
        startedAt: nowIso(),
        finish(extra = {}) {
          if (!spans.has(id)) return spans.get(id)?.record || null;
          const durationMs = Number((safeNow() - startedAtMs).toFixed(2));
          const item = {
            id,
            name,
            metadata: structuredCloneSafe(metadata),
            extra: structuredCloneSafe(extra),
            success: extra.success !== false,
            durationMs,
            startedAt: span.startedAt,
            finishedAt: nowIso(),
          };
          spans.delete(id);
          record(item);
          return item;
        },
        error(error, extra = {}) {
          return span.finish({ ...extra, success: false, error: error?.message || String(error) });
        },
      };
      spans.set(id, span);
      return span;
    },
    increment(name, amount = 1) {
      counters.set(name, (counters.get(name) || 0) + amount);
      return counters.get(name);
    },
    clear() {
      spans.clear();
      history.length = 0;
      counters.clear();
      warnings.length = 0;
    },
    summary() {
      const completed = history.slice();
      const queries = completed.filter((item) => item.name.includes("query"));
      const averageQueryDuration = queries.length ? Number((queries.reduce((sum, item) => sum + item.durationMs, 0) / queries.length).toFixed(2)) : null;
      const slowestRecentQuery = queries.slice().sort((a, b) => b.durationMs - a.durationMs)[0] || null;
      return {
        activeSpanCount: spans.size,
        completedCount: completed.length,
        counters: Object.fromEntries(counters),
        averageQueryDuration,
        slowestRecentQuery,
        lastImportDuration: lastDuration(completed, "import"),
        lastQueryDuration: lastDuration(completed, "query"),
        lastPackageBuildDuration: lastDuration(completed, "package"),
        workerStartupDuration: lastDuration(completed, "worker"),
        longTaskCount: warnings.length,
        lastPerformanceWarning: warnings[0] || null,
        recent: completed.slice(0, 10),
      };
    },
  };
}

function lastDuration(history, token) {
  return history.find((item) => item.name.includes(token))?.durationMs ?? null;
}

function structuredCloneSafe(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value ?? null));
  }
}

export const performanceMonitor = createPerformanceMonitor();
