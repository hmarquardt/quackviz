import { escapeIdent } from "./utils.js";

export function applyDashboardFilters({ sql, filters = [], columns = [] }) {
  const columnNames = new Set(columns.map((column) => column.name));
  const appliedFilters = [];
  const skippedFilters = [];
  const predicates = [];
  for (const filter of filters.filter((item) => item.enabled !== false)) {
    if (!columnNames.has(filter.field)) {
      skippedFilters.push({ filterId: filter.id, name: filter.name, reason: `Field '${filter.field}' is not present in the query result.` });
      continue;
    }
    const predicate = predicateFor(filter);
    if (!predicate) {
      skippedFilters.push({ filterId: filter.id, name: filter.name, reason: `Operator '${filter.operator}' is not supported for this filter.` });
      continue;
    }
    predicates.push(predicate);
    appliedFilters.push({ filterId: filter.id, name: filter.name, field: filter.field, operator: filter.operator });
  }
  if (!predicates.length) return { sql, appliedFilters, skippedFilters, warnings: [] };
  return {
    sql: `SELECT *\nFROM (\n${String(sql).trim().replace(/;+\s*$/, "")}\n) AS __quackviz_dashboard\nWHERE ${predicates.join(" AND ")}`,
    appliedFilters,
    skippedFilters,
    warnings: [],
  };
}

function predicateFor(filter) {
  const field = escapeIdent(filter.field);
  if (filter.operator === "in") {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    if (!values.length || values.every((value) => value == null || value === "")) return null;
    return `${field} IN (${values.map(literal).join(", ")})`;
  }
  if (filter.operator === "between" && Array.isArray(filter.value) && filter.value.length === 2) return `${field} BETWEEN ${literal(filter.value[0])} AND ${literal(filter.value[1])}`;
  if (filter.operator === "contains" && filter.value) return `CAST(${field} AS VARCHAR) ILIKE ${literal(`%${filter.value}%`)}`;
  if (filter.operator === "is-null") return `${field} IS NULL`;
  if (filter.operator === "not-null") return `${field} IS NOT NULL`;
  if (["=", "!=", ">", ">=", "<", "<="].includes(filter.operator)) return `${field} ${filter.operator} ${literal(filter.value)}`;
  return null;
}

function literal(value) {
  if (value == null) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replaceAll("'", "''")}'`;
}
