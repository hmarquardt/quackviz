export function observeMemory({ cacheEntries = 0, echartsInstances = 0, mapInstances = 0, workerCount = 0 } = {}) {
  const memory = performance?.memory ? {
    usedJSHeapSize: performance.memory.usedJSHeapSize,
    totalJSHeapSize: performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
  } : null;
  const warnings = [];
  if (cacheEntries > 50) warnings.push("Result cache has more than 50 entries.");
  if (echartsInstances + mapInstances > 24) warnings.push("Many renderer instances are active.");
  return {
    supported: Boolean(memory),
    memory,
    cacheEntries,
    echartsInstances,
    mapInstances,
    workerCount,
    warnings,
  };
}
