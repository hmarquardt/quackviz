import { APP_VERSION, RECOVERY_LIMITS, WORKSPACE_SCHEMA_VERSION } from "./constants.js";
import { createIntegrity } from "./package-integrity.js";
import { serializeWorkspace } from "./workspace.js";
import { nowIso, uid } from "./utils.js";

export function createRecoveryState() {
  return { checkpoints: [], journal: [], lastCheckpointAt: null, lastJournalAt: null, status: "ready" };
}

export function addJournalEntry(recovery, { workspaceId, operation, objectId = null, status = "committed", detail = "" }) {
  const entry = { id: uid("journal"), workspaceId, operation, objectId, timestamp: nowIso(), appVersion: APP_VERSION, workspaceVersion: WORKSPACE_SCHEMA_VERSION, status, detail };
  recovery.journal = [entry, ...(recovery.journal || [])].slice(0, RECOVERY_LIMITS.journalEntries);
  recovery.lastJournalAt = entry.timestamp;
  return entry;
}

export async function createCheckpoint(recovery, workspace, label = "autosave") {
  const payload = serializeWorkspace(workspace);
  const content = JSON.stringify(payload);
  const integrity = await createIntegrity([{ path: "workspace.json", content }]);
  const checkpoint = { id: uid("checkpoint"), label, workspaceId: workspace.id, createdAt: nowIso(), appVersion: APP_VERSION, workspaceVersion: workspace.version, objectCounts: counts(workspace), integrity, workspace: payload };
  recovery.checkpoints = [checkpoint, ...(recovery.checkpoints || [])].slice(0, RECOVERY_LIMITS.checkpoints);
  recovery.lastCheckpointAt = checkpoint.createdAt;
  return checkpoint;
}

export function restoreCheckpoint(recovery, checkpointId) {
  const checkpoint = (recovery.checkpoints || []).find((item) => item.id === checkpointId);
  if (!checkpoint) throw new Error(`Checkpoint ${checkpointId} not found.`);
  return structuredClone(checkpoint.workspace);
}

export function recoverySummary(recovery) {
  return {
    status: recovery.status || "unknown",
    checkpointCount: recovery.checkpoints?.length || 0,
    lastCheckpoint: recovery.lastCheckpointAt || null,
    journalEntryCount: recovery.journal?.length || 0,
    lastJournalEntry: recovery.journal?.[0] || null,
  };
}

function counts(workspace) {
  return {
    dataSources: workspace.dataSources?.length || 0,
    queries: workspace.queries?.length || 0,
    visualizations: workspace.visualizations?.length || 0,
    dashboards: workspace.dashboards?.length || 0,
    reports: workspace.reports?.length || 0,
  };
}
