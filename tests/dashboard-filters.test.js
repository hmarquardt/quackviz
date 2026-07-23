import { applyDashboardFilters } from "../js/dashboard-filters.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const columns = [{ name: "region" }, { name: "revenue" }, { name: "order_date" }, { name: "active" }, { name: "note" }];
const sql = "SELECT region, revenue, order_date, active, note FROM sales";
const apply = (filter) => applyDashboardFilters({ sql, filters: [{ id: "f", name: "F", enabled: true, ...filter }], columns });

export const dashboardFilterTests = [
  { name: "dashboard-filter: category filter", run: () => assert(apply({ field: "region", operator: "in", value: ["East"] }).sql.includes("IN"), "category failed") },
  { name: "dashboard-filter: multi-category filter", run: () => assert(apply({ field: "region", operator: "in", value: ["East", "West"] }).sql.includes("'West'"), "multi failed") },
  { name: "dashboard-filter: numeric range", run: () => assert(apply({ field: "revenue", operator: "between", value: [1, 5] }).sql.includes("BETWEEN 1 AND 5"), "range failed") },
  { name: "dashboard-filter: date range", run: () => assert(apply({ field: "order_date", operator: "between", value: ["2026-01-01", "2026-02-01"] }).sql.includes("'2026-01-01'"), "date failed") },
  { name: "dashboard-filter: boolean", run: () => assert(apply({ field: "active", operator: "=", value: true }).sql.includes("TRUE"), "boolean failed") },
  { name: "dashboard-filter: null filter", run: () => assert(apply({ field: "note", operator: "is-null" }).sql.includes("IS NULL"), "null failed") },
  { name: "dashboard-filter: unsupported skipped", run: () => assert(apply({ field: "region", operator: "weird", value: "x" }).skippedFilters.length === 1, "unsupported not skipped") },
  { name: "dashboard-filter: safe literal handling", run: () => assert(apply({ field: "region", operator: "in", value: ["O'Reilly"] }).sql.includes("O''Reilly"), "literal unsafe") },
  { name: "dashboard-filter: missing field handled", run: () => assert(apply({ field: "missing", operator: "in", value: ["x"] }).skippedFilters.length === 1, "missing not skipped") },
  { name: "dashboard-filter: input not mutated", run: () => { const filter = { field: "region", operator: "in", value: ["East"] }; const before = JSON.stringify(filter); apply(filter); assert(JSON.stringify(filter) === before, "mutated"); } },
];
