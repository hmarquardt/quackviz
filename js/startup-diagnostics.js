import { APP_VERSION, BUILD_DATE } from "./constants.js";

const REQUIRED = ["esModules", "webAssembly", "webWorkers", "indexedDb", "fileApi", "canvas", "structuredClone"];
const OPTIONAL = ["webCrypto", "resizeObserver", "blobUrl", "clipboard", "download", "webGl", "opfs"];

export function detectCapabilities(env = globalThis) {
  const doc = env.document;
  const canvas = doc?.createElement ? doc.createElement("canvas") : null;
  const report = {
    appVersion: APP_VERSION,
    buildDate: BUILD_DATE,
    requiredCapabilities: [],
    optionalCapabilities: [],
    missingRequired: [],
    missingOptional: [],
  };
  const values = {
    esModules: true,
    webAssembly: Boolean(env.WebAssembly),
    webWorkers: Boolean(env.Worker),
    indexedDb: Boolean(env.indexedDB),
    webCrypto: Boolean(env.crypto?.subtle),
    resizeObserver: Boolean(env.ResizeObserver),
    fileApi: Boolean(env.File && env.FileReader && env.Blob),
    blobUrl: Boolean(env.URL?.createObjectURL),
    canvas: Boolean(canvas?.getContext),
    webGl: Boolean(canvas?.getContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))),
    structuredClone: Boolean(env.structuredClone),
    clipboard: Boolean(env.navigator?.clipboard),
    download: "download" in (doc?.createElement ? doc.createElement("a") : {}),
    opfs: Boolean(env.navigator?.storage?.getDirectory),
  };
  for (const name of REQUIRED) pushCapability(report, "requiredCapabilities", "missingRequired", name, values[name]);
  for (const name of OPTIONAL) pushCapability(report, "optionalCapabilities", "missingOptional", name, values[name]);
  report.status = report.missingRequired.length ? "unsupported" : report.missingOptional.length ? "degraded" : "ready";
  return report;
}

function pushCapability(report, collection, missing, name, available) {
  report[collection].push({ name, available: Boolean(available) });
  if (!available) report[missing].push(name);
}

export function createStartupTracker() {
  const phases = [];
  const startedAt = performance.now();
  return {
    phase(name, status = "complete", detail = "") {
      phases.push({ name, status, detail, elapsedMs: Number((performance.now() - startedAt).toFixed(2)) });
      return phases[phases.length - 1];
    },
    report() {
      return { status: phases.at(-1)?.status || "loading", currentPhase: phases.at(-1)?.name || "not-started", durationMs: Number((performance.now() - startedAt).toFixed(2)), phases: phases.slice() };
    },
  };
}
