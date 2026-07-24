import { TASK_TIMEOUTS } from "./constants.js";
import { uid } from "./utils.js";

export const WORKER_CONTRACT_VERSION = 1;

export function validateWorkerMessage(message) {
  const errors = [];
  if (!message || typeof message !== "object") errors.push({ path: "$", message: "Worker message must be an object." });
  if (message?.contract !== "quackviz-worker-task" && message?.contract !== "quackviz-worker-result") errors.push({ path: "contract", message: "Unsupported worker contract." });
  if (message?.contractVersion !== WORKER_CONTRACT_VERSION) errors.push({ path: "contractVersion", message: "Unsupported worker contract version." });
  if (!message?.taskId) errors.push({ path: "taskId", message: "Worker task ID is required." });
  return { valid: errors.length === 0, errors };
}

export function createWorkerManager({ workerUrl = "../workers/data-worker.js", timeoutMs = TASK_TIMEOUTS.workerReadyMs } = {}) {
  let worker = null;
  let status = { supported: typeof Worker !== "undefined", ready: false, workerCount: 0, restartCount: 0, lastError: null };
  const pending = new Map();

  function ensureWorker() {
    if (!status.supported) throw new Error("Web Workers are not available.");
    if (worker) return worker;
    worker = new Worker(workerUrl, { type: "module" });
    status.workerCount = 1;
    worker.onmessage = (event) => {
      const validation = validateWorkerMessage(event.data);
      if (!validation.valid) {
        status.lastError = validation.errors[0]?.message;
        return;
      }
      const pendingTask = pending.get(event.data.taskId);
      if (!pendingTask) return;
      if (event.data.status === "progress") pendingTask.onProgress?.(event.data.payload);
      if (["success", "error", "cancelled"].includes(event.data.status)) {
        clearTimeout(pendingTask.timer);
        pending.delete(event.data.taskId);
        if (event.data.status === "success") pendingTask.resolve(event.data.payload);
        else pendingTask.reject(new Error(event.data.payload?.message || event.data.status));
      }
    };
    worker.onerror = (event) => {
      status.lastError = event.message;
      for (const task of pending.values()) task.reject(new Error(event.message));
      pending.clear();
    };
    return worker;
  }

  return {
    async run(type, payload = {}, { onProgress, taskTimeoutMs = timeoutMs } = {}) {
      const taskId = uid("worker_task");
      const activeWorker = ensureWorker();
      const message = { contract: "quackviz-worker-task", contractVersion: WORKER_CONTRACT_VERSION, taskId, type, payload };
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(taskId);
          reject(new Error(`Worker task ${type} timed out.`));
        }, taskTimeoutMs);
        pending.set(taskId, { resolve, reject, onProgress, timer });
        activeWorker.postMessage(message);
      });
    },
    cancel(taskId) {
      worker?.postMessage({ contract: "quackviz-worker-task", contractVersion: WORKER_CONTRACT_VERSION, taskId, type: "cancel", payload: {} });
    },
    terminate() {
      worker?.terminate();
      worker = null;
      status = { ...status, ready: false, workerCount: 0 };
    },
    restart() {
      this.terminate();
      status.restartCount += 1;
      ensureWorker();
    },
    status() {
      return { ...status, pendingTaskCount: pending.size };
    },
  };
}
