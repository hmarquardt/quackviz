import { AI_CONTRACTS } from "../js/ai-contracts.js";
import { validateAiResponse } from "../js/ai-validate.js";
import { addRepair, createProposalState, proposalToBuilderState, saveAiProposal } from "../js/ai-proposals.js";
import { createWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const response = {
  contract: AI_CONTRACTS.proposals,
  contractVersion: 1,
  summary: "Sales",
  proposals: [{
    id: "proposal_1",
    title: "Monthly revenue",
    question: "Trend?",
    description: "Monthly revenue.",
    sourceTables: ["sales"],
    confidence: 0.9,
    sql: "SELECT 1 AS month, 2 AS revenue FROM sales",
    expectedColumns: [{ name: "month", dataType: "number", role: "x" }, { name: "revenue", dataType: "number", role: "y" }],
    visualization: { version: 1, type: "line", title: "Monthly revenue", dataset: { queryId: null }, encoding: { x: { field: "month", dataType: "number", label: "Month" }, y: [{ field: "revenue", dataType: "number", label: "Revenue" }] }, options: { tooltip: "axis", orientation: "vertical" } },
    reasoning: { whyThisQuestion: "Useful", whyThisChart: "Trend" },
    assumptions: [],
    cautions: [],
  }],
};

function proposalState() {
  return createProposalState(validateAiResponse(response, { expectedContract: AI_CONTRACTS.proposals, knownTables: ["sales"] })).proposals[0];
}

export const aiProposalTests = [
  { name: "ai-proposal: converts to unsaved builder state", run: () => assert(proposalToBuilderState(proposalState()).temporaryQuery.createdBy === "ai", "bad builder") },
  { name: "ai-proposal: saving creates query and visualization", run: () => { const workspace = createWorkspace(); const saved = saveAiProposal(workspace, proposalState(), { model: "m", interactionId: "ai_1" }); assert(saved.viz.queryId === saved.query.id, "relationship missing"); } },
  { name: "ai-proposal: provenance preserved", run: () => { const workspace = createWorkspace(); const saved = saveAiProposal(workspace, proposalState(), { model: "m", interactionId: "ai_1" }); assert(saved.query.provenance.model === "m" && saved.viz.provenance.interactionId === "ai_1", "provenance missing"); } },
  { name: "ai-proposal: API key absent", run: () => { const workspace = createWorkspace(); saveAiProposal(workspace, proposalState(), { model: "m", interactionId: "ai_1", apiKey: "secret" }); assert(!JSON.stringify(workspace).includes("secret"), "api key leaked"); } },
  { name: "ai-proposal: invalid proposal cannot be saved", run: () => { const workspace = createWorkspace(); let failed = false; try { saveAiProposal(workspace, { valid: false, proposal: response.proposals[0] }, { model: "m" }); } catch { failed = true; } assert(failed, "invalid saved"); } },
  { name: "ai-proposal: repair attempt count enforced", run: () => { const state = proposalState(); addRepair(state, { repairedSql: "SELECT 1" }); addRepair(state, { repairedSql: "SELECT 2" }); addRepair(state, { repairedSql: "SELECT 3" }); let failed = false; try { addRepair(state, { repairedSql: "SELECT 4" }); } catch { failed = true; } assert(failed, "limit not enforced"); } },
];
