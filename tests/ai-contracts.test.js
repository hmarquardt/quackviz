import { AI_CONTRACTS } from "../js/ai-contracts.js";
import { parseAiJson, validateAiResponse, validateCritique, validateExplanation, validateRepair } from "../js/ai-validate.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function proposal(overrides = {}) {
  return {
    id: "proposal_monthly_revenue",
    title: "Monthly revenue",
    question: "How is revenue changing over time?",
    description: "Aggregate revenue by month.",
    sourceTables: ["sales"],
    confidence: 0.95,
    sql: "SELECT date_trunc('month', order_date) AS month, SUM(revenue) AS revenue FROM sales GROUP BY 1 ORDER BY 1",
    expectedColumns: [{ name: "month", dataType: "date", role: "x" }, { name: "revenue", dataType: "number", role: "y" }],
    visualization: {
      version: 1,
      type: "line",
      title: "Monthly revenue",
      dataset: { queryId: null },
      encoding: { x: { field: "month", dataType: "date", label: "Month" }, y: [{ field: "revenue", dataType: "number", label: "Revenue" }] },
      options: { tooltip: "axis", orientation: "vertical" },
    },
    reasoning: { whyThisQuestion: "Revenue trend matters.", whyThisChart: "Line charts show trends." },
    assumptions: [],
    cautions: [],
    ...overrides,
  };
}

const response = (proposals = [proposal()]) => ({ contract: AI_CONTRACTS.proposals, contractVersion: 1, summary: "Sales.", proposals });
const validate = (payload) => validateAiResponse(payload, { expectedContract: AI_CONTRACTS.proposals, knownTables: ["sales"] });

export const aiContractTests = [
  { name: "ai-contract: valid proposal response", run: () => assert(validate(response()).valid, "valid rejected") },
  { name: "ai-contract: multiple proposals", run: () => assert(validate(response([proposal(), proposal({ id: "proposal_2", title: "Category revenue" })])).proposals.length === 2, "multiple failed") },
  { name: "ai-contract: missing contract", run: () => assert(!validate({ ...response(), contract: undefined }).valid, "missing contract accepted") },
  { name: "ai-contract: unsupported contract version", run: () => assert(!validate({ ...response(), contractVersion: 99 }).valid, "bad version accepted") },
  { name: "ai-contract: markdown-wrapped JSON", run: () => assert(parseAiJson("```json\n{\"ok\":true}\n```").value.ok, "fence parse failed") },
  { name: "ai-contract: malformed JSON", run: () => assert(!parseAiJson("{").ok, "malformed accepted") },
  { name: "ai-contract: unknown top-level property", run: () => assert(!validate({ ...response(), extra: true }).valid, "extra accepted") },
  { name: "ai-contract: function-like value", run: () => assert(!validate(response([proposal({ description: "() => alert(1)" })])).valid, "function accepted") },
  { name: "ai-contract: missing SQL", run: () => assert(!validate(response([proposal({ sql: "" })])).proposals[0].valid, "missing SQL accepted") },
  { name: "ai-contract: SQL/spec field mismatch", run: () => assert(!validate(response([proposal({ visualization: { ...proposal().visualization, encoding: { ...proposal().visualization.encoding, y: [{ field: "total_sales", dataType: "number", label: "Sales" }] } } })])).proposals[0].valid, "mismatch accepted") },
  { name: "ai-contract: invalid confidence", run: () => assert(!validate(response([proposal({ confidence: 2 })])).proposals[0].valid, "confidence accepted") },
  { name: "ai-contract: one invalid proposal among valid proposals", run: () => { const result = validate(response([proposal(), proposal({ sql: "DROP TABLE sales" })])); assert(result.proposals[0].valid && !result.proposals[1].valid, "independence failed"); } },
  { name: "ai-contract: valid repair contract", run: () => assert(validateRepair({ contract: AI_CONTRACTS.repair, contractVersion: 1, summary: "Fixed", repairedSql: "SELECT 1 AS x", expectedColumns: [], visualization: null, changes: [], assumptions: [], cautions: [] }, ["sales"]).valid, "repair invalid") },
  { name: "ai-contract: valid explanation contract", run: () => assert(validateExplanation({ contract: AI_CONTRACTS.explanation, contractVersion: 1, headline: "Trend", summary: "Summary", findings: [], cautions: [], followUpQuestions: [] }).valid, "explanation invalid") },
  { name: "ai-contract: valid critique contract", run: () => assert(validateCritique({ contract: AI_CONTRACTS.critique, contractVersion: 1, assessment: "Appropriate", issues: [], recommendations: [], alternativeVisualization: null, cautions: [] }).valid, "critique invalid") },
  { name: "ai-contract: invalid spec patch rejected", run: () => assert(!validateCritique({ contract: AI_CONTRACTS.critique, contractVersion: 1, assessment: "Bad", issues: [], recommendations: [{ proposedSpecPatch: { rawECharts: {} } }], alternativeVisualization: null, cautions: [] }).valid, "bad patch accepted") },
];
