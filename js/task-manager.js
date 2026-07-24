import { nowIso, uid } from "./utils.js";

export function createTaskManager() {
  const tasks = new Map();
  const stats = { created: 0, completed: 0, failed: 0, cancelled: 0, timedOut: 0, obsoleteIgnored: 0 };

  function snapshot(task) {
    return { ...task, children: [...task.children] };
  }

  return {
    create(type, { label = type, timeoutMs = null, parentId = null } = {}) {
      const id = uid("task");
      const task = { id, type, label, status: "running", progress: 0, parentId, children: [], startedAt: nowIso(), updatedAt: nowIso(), error: null, timeoutId: null, cancelled: false };
      if (parentId && tasks.has(parentId)) tasks.get(parentId).children.push(id);
      if (timeoutMs) {
        task.timeoutId = setTimeout(() => {
          if (tasks.get(id)?.status === "running") {
            stats.timedOut += 1;
            tasks.set(id, { ...tasks.get(id), status: "timed-out", updatedAt: nowIso(), error: `Timed out after ${timeoutMs} ms` });
          }
        }, timeoutMs);
      }
      tasks.set(id, task);
      stats.created += 1;
      return snapshot(task);
    },
    progress(id, progress, message = "") {
      const task = tasks.get(id);
      if (!task || task.status !== "running") return null;
      const next = { ...task, progress: Math.max(0, Math.min(1, Number(progress))), message, updatedAt: nowIso() };
      tasks.set(id, next);
      return snapshot(next);
    },
    complete(id, result = null) {
      const task = tasks.get(id);
      if (!task || task.status !== "running") {
        stats.obsoleteIgnored += 1;
        return null;
      }
      clearTimer(task);
      const next = { ...task, status: "complete", progress: 1, result, updatedAt: nowIso() };
      tasks.set(id, next);
      stats.completed += 1;
      return snapshot(next);
    },
    error(id, error) {
      const task = tasks.get(id);
      if (!task || task.status !== "running") {
        stats.obsoleteIgnored += 1;
        return null;
      }
      clearTimer(task);
      const next = { ...task, status: "error", error: error?.message || String(error), updatedAt: nowIso() };
      tasks.set(id, next);
      stats.failed += 1;
      return snapshot(next);
    },
    cancel(id, reason = "Cancelled by user.") {
      const task = tasks.get(id);
      if (!task || !["running", "timed-out"].includes(task.status)) return null;
      clearTimer(task);
      const next = { ...task, status: "cancelled", cancelled: true, error: reason, updatedAt: nowIso() };
      tasks.set(id, next);
      stats.cancelled += 1;
      return snapshot(next);
    },
    cleanup({ keepCompleted = 20 } = {}) {
      const inactive = [...tasks.values()].filter((task) => task.status !== "running").sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      for (const task of inactive.slice(keepCompleted)) tasks.delete(task.id);
    },
    get(id) {
      const task = tasks.get(id);
      return task ? snapshot(task) : null;
    },
    active() {
      return [...tasks.values()].filter((task) => task.status === "running").map(snapshot);
    },
    summary() {
      return { ...stats, activeTaskCount: this.active().length, taskCount: tasks.size };
    },
  };
}

function clearTimer(task) {
  if (task.timeoutId) clearTimeout(task.timeoutId);
}

export const taskManager = createTaskManager();
