import { addOrUpdateQuery, addOrUpdateVisualization } from "./workspace.js";
import { nowIso, uid } from "./utils.js";

export function createProposalState(validation) {
  return {
    summary: validation.summary || "",
    proposals: validation.proposals.map((item, index) => ({
      ...item,
      id: item.proposal.id || uid("proposal"),
      index,
      explain: null,
      preview: null,
      chartOption: null,
      rejected: false,
      repairHistory: [],
      repairAttempts: 0,
    })),
  };
}

export function proposalToBuilderState(proposalState) {
  const proposal = proposalState.proposal;
  return {
    temporaryQuery: {
      id: uid("query_tmp"),
      name: proposal.title,
      sql: proposal.sql,
      createdBy: "ai",
      sourceTables: proposal.sourceTables || [],
      provenance: proposalProvenance(proposalState),
    },
    spec: {
      ...proposal.visualization,
      dataset: { queryId: null },
    },
    provenance: proposalProvenance(proposalState),
  };
}

export function saveAiProposal(workspace, proposalState, { model, interactionId, result }) {
  if (!proposalState.valid) throw new Error("Invalid AI proposal cannot be saved.");
  const proposal = proposalState.proposal;
  const query = addOrUpdateQuery(workspace, {
    name: proposal.title,
    description: "AI-proposed query",
    sql: proposal.sql,
    parameters: [],
    sourceTables: proposal.sourceTables || [],
    createdBy: "ai",
    lastRunAt: result?.executedAt || nowIso(),
    runCount: result ? 1 : 0,
    provenance: {
      provider: "openrouter",
      model,
      proposalId: proposalState.id,
      interactionId,
    },
  });
  const spec = { ...proposal.visualization, dataset: { queryId: query.id } };
  const viz = addOrUpdateVisualization(workspace, {
    name: proposal.title,
    description: proposal.description || "",
    question: proposal.question || "",
    queryId: query.id,
    spec,
    provenance: {
      createdBy: "ai",
      provider: "openrouter",
      model,
      proposalId: proposalState.id,
      interactionId,
      createdAt: nowIso(),
    },
  });
  return { query, viz };
}

export function markRejected(proposalState) {
  proposalState.rejected = true;
  proposalState.status = "rejected";
}

export function addRepair(proposalState, repair) {
  if (proposalState.repairAttempts >= 3) throw new Error("Repair attempt limit reached.");
  proposalState.repairAttempts += 1;
  proposalState.repairHistory.push({ ...repair, repairedAt: nowIso() });
  return proposalState;
}

function proposalProvenance(proposalState) {
  return {
    createdBy: "ai",
    provider: "openrouter",
    proposalId: proposalState.id,
    createdAt: nowIso(),
  };
}
