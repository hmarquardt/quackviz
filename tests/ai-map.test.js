import { AI_CONTRACTS } from "../js/ai-contracts.js";
import { validateAiResponse, validateRegionRepair } from "../js/ai-validate.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const proposal = {
  contract: AI_CONTRACTS.mapProposals,
  contractVersion: 1,
  summary: "Map stores.",
  proposals: [{
    id: "proposal_map",
    title: "Store map",
    question: "Where are stores?",
    description: "Point map.",
    sourceTables: ["stores"],
    confidence: 0.9,
    sql: "SELECT latitude, longitude, revenue FROM stores",
    expectedColumns: [{ name: "latitude", dataType: "latitude", role: "latitude" }, { name: "longitude", dataType: "longitude", role: "longitude" }, { name: "revenue", dataType: "number", role: "size" }],
    visualization: { version: 1, type: "map-proportional-symbol", title: "Store map", dataset: { queryId: null }, encoding: { latitude: { field: "latitude", dataType: "latitude" }, longitude: { field: "longitude", dataType: "longitude" }, size: { field: "revenue", dataType: "number" }, label: null, tooltip: [], color: null, value: null, region: null }, map: { style: "blank", showLegend: true, showTooltip: true } },
    reasoning: { whyThisQuestion: "Location matters.", whyThisMap: "Symbols show magnitude." },
    assumptions: [],
    cautions: [],
  }],
};

export const aiMapTests = [
  { name: "ai-map: valid point proposal", run: () => { const result = validateAiResponse(proposal, { expectedContract: AI_CONTRACTS.mapProposals, knownTables: ["stores"] }); assert(result.valid && result.proposals[0].valid, result.errors[0]?.message || result.proposals[0].errors[0]?.message || "proposal invalid"); } },
  { name: "ai-map: unsafe sql rejected", run: () => { const bad = { ...proposal, proposals: [{ ...proposal.proposals[0], sql: "DROP TABLE stores" }] }; assert(!validateAiResponse(bad, { expectedContract: AI_CONTRACTS.mapProposals, knownTables: ["stores"] }).proposals[0].valid, "unsafe accepted"); } },
  { name: "ai-map: raw style rejected", run: () => { const bad = { ...proposal, proposals: [{ ...proposal.proposals[0], visualization: { ...proposal.proposals[0].visualization, map: { rawStyle: {} } } }] }; assert(!validateAiResponse(bad, { expectedContract: AI_CONTRACTS.mapProposals, knownTables: ["stores"] }).proposals[0].valid, "raw style accepted"); } },
  { name: "ai-map: unknown boundary rejected", run: () => { const bad = { ...proposal, proposals: [{ ...proposal.proposals[0], visualization: { ...proposal.proposals[0].visualization, type: "map-choropleth", encoding: { latitude: null, longitude: null, label: null, tooltip: [], size: null, color: null, value: { field: "revenue", dataType: "number" }, region: { field: "state", dataType: "us-state-abbreviation", boundary: "missing" } } } }] }; assert(!validateAiResponse(bad, { expectedContract: AI_CONTRACTS.mapProposals, knownTables: ["stores"] }).proposals[0].valid, "unknown boundary accepted"); } },
  { name: "ai-map: valid region repair", run: () => { const result = validateRegionRepair({ contract: AI_CONTRACTS.regionRepair, contractVersion: 1, boundaryId: "us-states", mappings: [{ sourceValue: "N. Carolina", boundaryValue: "North Carolina", confidence: 0.98, reason: "Common abbreviation." }], unresolved: [] }); assert(result.valid, result.errors[0]?.message || "repair invalid"); } },
];
