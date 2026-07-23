import { buildAiContext, isSensitiveColumn } from "../js/ai-context.js";
import { DEFAULT_AI_SETTINGS } from "../js/constants.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const workspace = {
  dataSources: [{
    tableName: "sales",
    rowCount: 120,
    columns: [
      { name: "order_date", duckType: "DATE", nullable: true },
      { name: "customer_email", duckType: "VARCHAR", nullable: true },
      { name: "revenue", duckType: "DOUBLE", nullable: true },
    ],
  }],
};

export const aiContextTests = [
  { name: "ai-context: metadata-only context", run: () => assert(buildAiContext({ workspace, selectedTableNames: ["sales"], settings: DEFAULT_AI_SETTINGS }).context.tables[0].columns.length, "metadata missing") },
  { name: "ai-context: sample rows excluded by default", run: () => assert(!JSON.stringify(buildAiContext({ workspace, selectedTableNames: ["sales"], settings: DEFAULT_AI_SETTINGS }).context).includes("\"rows\""), "rows included by default") },
  { name: "ai-context: sensitive column detected", run: () => assert(isSensitiveColumn("customer_email"), "email not sensitive") },
  { name: "ai-context: sensitive columns excluded", run: () => assert(!buildAiContext({ workspace, selectedTableNames: ["sales"], settings: DEFAULT_AI_SETTINGS, excludedColumns: ["sales.customer_email"] }).context.tables[0].columns.some((column) => column.name === "customer_email"), "sensitive not excluded") },
  { name: "ai-context: API key never included", run: () => assert(!JSON.stringify(buildAiContext({ workspace, selectedTableNames: ["sales"], settings: { ...DEFAULT_AI_SETTINGS, apiKey: "secret" } }).context).includes("secret"), "secret leaked") },
  { name: "ai-context: input not mutated", run: () => { const before = JSON.stringify(workspace); buildAiContext({ workspace, selectedTableNames: ["sales"], settings: DEFAULT_AI_SETTINGS }); assert(JSON.stringify(workspace) === before, "workspace mutated"); } },
];
