import { APP_VERSION, BUILD_DATE } from "../js/constants.js";
import { createPerformanceMonitor } from "../js/performance-monitor.js";
import { createTaskManager } from "../js/task-manager.js";
import { detectCapabilities } from "../js/startup-diagnostics.js";
import { observeMemory } from "../js/memory-monitor.js";
import { expectedVendorManifest, validateVendorManifest } from "../js/vendor.js";
import { validateWorkspaceIntegrity, repairWorkspace, migrateWorkspace } from "../js/workspace-validation.js";
import { addJournalEntry, createCheckpoint, createRecoveryState, restoreCheckpoint } from "../js/recovery.js";
import { createSupportBundle } from "../js/support-bundle.js";
import { validateWorkerMessage } from "../js/worker-manager.js";
import { addCard, addDashboard, createDashboard } from "../js/dashboard.js";
import { createReport, addReport, addSection } from "../js/report.js";
import { addOrUpdateQuery, addOrUpdateVisualization, createWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fixtureWorkspace() {
  const workspace = createWorkspace();
  const query = addOrUpdateQuery(workspace, { id: "query_ops", name: "Ops", sql: "SELECT region, revenue FROM sales", sourceTables: ["sales"] });
  const viz = addOrUpdateVisualization(workspace, { id: "viz_ops", name: "Ops Viz", queryId: query.id, spec: { version: 1, type: "bar", title: "Ops", dataset: { queryId: query.id }, encoding: { x: { field: "region" }, y: [{ field: "revenue" }] }, options: { tooltip: "axis", orientation: "vertical" } } });
  const dashboard = addDashboard(workspace, createDashboard({ id: "dashboard_ops" }));
  addCard(dashboard, viz.id);
  const report = addReport(workspace, createReport({ id: "report_ops" }));
  addSection(report, { type: "visualization", source: { visualizationId: viz.id } });
  return workspace;
}

export const operationalTests = [
  { name: "performance: start and finish span", run: () => {
    const monitor = createPerformanceMonitor({ historyLimit: 3 });
    const span = monitor.start("duckdb-query", { queryId: "query_1" });
    const item = span.finish({ rowCount: 2 });
    assert(item.success && monitor.summary().completedCount === 1, "span did not finish");
  } },
  { name: "performance: bounded retention", run: () => {
    const monitor = createPerformanceMonitor({ historyLimit: 2 });
    monitor.start("a").finish();
    monitor.start("b").finish();
    monitor.start("c").finish();
    assert(monitor.summary().recent.length === 2, "history was not bounded");
  } },
  { name: "task-manager: complete and cancel", run: () => {
    const manager = createTaskManager();
    const task = manager.create("import");
    manager.progress(task.id, 0.5);
    manager.complete(task.id);
    const cancel = manager.create("package");
    manager.cancel(cancel.id);
    assert(manager.get(task.id).status === "complete" && manager.get(cancel.id).status === "cancelled", "task lifecycle failed");
  } },
  { name: "task-manager: obsolete result ignored", run: () => {
    const manager = createTaskManager();
    assert(manager.complete("missing") === null && manager.summary().obsoleteIgnored === 1, "obsolete result not tracked");
  } },
  { name: "worker-contract: valid and invalid messages", run: () => {
    assert(validateWorkerMessage({ contract: "quackviz-worker-task", contractVersion: 1, taskId: "task_1", type: "echo" }).valid, "valid worker request rejected");
    assert(!validateWorkerMessage({ contract: "quackviz-worker-task", contractVersion: 2, taskId: "task_1" }).valid, "future worker version accepted");
  } },
  { name: "startup: capability detection reports required fields", run: () => {
    const report = detectCapabilities(window);
    assert(report.appVersion === APP_VERSION && report.requiredCapabilities.some((item) => item.name === "indexedDb"), "capability report incomplete");
  } },
  { name: "memory: unsupported browser memory degrades", run: () => {
    const report = observeMemory({ cacheEntries: 51 });
    assert(report.warnings.length >= 1, "memory warning missing");
  } },
  { name: "vendor: manifest validates current pinned versions", run: () => {
    const validation = validateVendorManifest(expectedVendorManifest());
    assert(validation.valid && validation.warnings.length >= 1, "vendor manifest status wrong");
  } },
  { name: "vendor: release-local requirement fails honestly", run: () => {
    const validation = validateVendorManifest(expectedVendorManifest(), { requireLocal: true });
    assert(!validation.valid && validation.errors.some((error) => error.path.includes(".path")), "non-vendored dependency not reported");
  } },
  { name: "workspace-validation: valid workspace", run: () => {
    assert(validateWorkspaceIntegrity(fixtureWorkspace()).valid, "valid workspace rejected");
  } },
  { name: "workspace-validation: duplicate ID rejected", run: () => {
    const workspace = fixtureWorkspace();
    workspace.queries.push({ ...workspace.queries[0] });
    assert(!validateWorkspaceIntegrity(workspace).valid, "duplicate query id accepted");
  } },
  { name: "workspace-validation: broken visualization reference", run: () => {
    const workspace = fixtureWorkspace();
    workspace.visualizations[0].queryId = "missing";
    assert(!validateWorkspaceIntegrity(workspace).valid, "missing query reference accepted");
  } },
  { name: "workspace-validation: repairable optional field", run: () => {
    const repaired = repairWorkspace({ id: "workspace_ops", version: 1 });
    assert(repaired.repaired && Array.isArray(repaired.workspace.queries), "workspace repair failed");
  } },
  { name: "workspace-migration: dry run and execution", run: () => {
    const workspace = { ...fixtureWorkspace(), version: 0 };
    const dry = migrateWorkspace({ workspace, fromVersion: 0, dryRun: true });
    const executed = migrateWorkspace({ workspace, fromVersion: 0 });
    assert(dry.dryRun && executed.workspace.version === 1, "workspace migration failed");
  } },
  { name: "recovery: checkpoint create and restore", run: async () => {
    const recovery = createRecoveryState();
    const workspace = fixtureWorkspace();
    const checkpoint = await createCheckpoint(recovery, workspace, "test");
    const restored = restoreCheckpoint(recovery, checkpoint.id);
    assert(restored.id === workspace.id && recovery.checkpoints.length === 1, "checkpoint failed");
  } },
  { name: "recovery: journal entry bounded", run: () => {
    const recovery = createRecoveryState();
    const entry = addJournalEntry(recovery, { workspaceId: "workspace_1", operation: "save-query" });
    assert(entry.appVersion === APP_VERSION && recovery.journal.length === 1, "journal failed");
  } },
  { name: "diagnostics: support bundle redacts secrets", run: () => {
    const state = { workspace: fixtureWorkspace(), storageStatus: { indexedDb: "available" }, errors: [{ message: "sk-secret-token", detail: "Authorization: bearer" }] };
    const bundle = createSupportBundle({ state, capabilities: {}, vendorStatus: {}, performanceSummary: {}, workerStatus: {}, recoverySummary: {} });
    const text = JSON.stringify(bundle);
    assert(bundle.appVersion === APP_VERSION && bundle.buildDate === BUILD_DATE && !text.includes("sk-secret-token") && !/authorization/i.test(text), "support bundle leaked secret");
  } },
];
