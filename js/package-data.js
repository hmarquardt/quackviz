import { dataFingerprint } from "./package-integrity.js";
import { html } from "./utils.js";

export function expectedSchemas(workspace, dataSourceIds = []) {
  const selected = dataSourceIds.length ? new Set(dataSourceIds) : null;
  return (workspace.dataSources || []).filter((source) => !selected || selected.has(source.id)).map((source) => ({
    tableName: source.tableName,
    requiredColumns: (source.columns || []).map((column) => ({
      name: column.name,
      compatibleTypes: compatibleTypes(column.duckType),
      semanticType: column.semanticType || null,
    })),
    optionalColumns: [],
    rowCountExpectation: source.rowCount || null,
  }));
}

export function privacyReview(workspace, plan, options = {}) {
  const dataSources = new Set(plan.required?.dataSources || []);
  const warnings = [];
  let freeTextFields = 0;
  let suspectedSensitiveFields = 0;
  let coordinateFields = 0;
  for (const source of workspace.dataSources || []) {
    if (dataSources.size && !dataSources.has(source.id)) continue;
    for (const column of source.columns || []) {
      const name = column.name.toLowerCase();
      if (/(email|phone|address|ssn|social|account|credit|medical|comment|note|name|ip|device)/.test(name)) {
        suspectedSensitiveFields += 1;
        warnings.push({ table: source.tableName, column: column.name, reason: "Column name may contain sensitive data." });
      }
      if (/comment|note|description|message|text/.test(name)) freeTextFields += 1;
      if (["latitude", "longitude"].includes(column.semanticType)) coordinateFields += 1;
    }
  }
  return {
    rawDataIncluded: options.dataMode === "included",
    sampleRowsIncluded: false,
    freeTextFields,
    suspectedSensitiveFields,
    coordinateFields,
    aiHistoryIncluded: Boolean(options.includeAiHistory),
    dataExportEnabled: Boolean(options.capabilities?.dataExport),
    apiKeysExcluded: true,
    warnings,
  };
}

export async function createIncludedData(workspace, plan, tableRows = {}) {
  const data = {};
  for (const source of workspace.dataSources || []) {
    if (!(plan.required?.dataSources || []).includes(source.id)) continue;
    const rows = tableRows[source.tableName] || [];
    const csv = rowsToCsv(rows, (source.columns || []).map((column) => column.name));
    data[source.tableName] = {
      format: "csv",
      tableName: source.tableName,
      columns: source.columns || [],
      rowCount: rows.length || source.rowCount || 0,
      content: csv,
      fingerprint: await dataFingerprint(csv),
    };
  }
  return data;
}

export function createExternalDataRequirements(workspace, plan) {
  return expectedSchemas(workspace, plan.required?.dataSources || []);
}

export function createColumnPrunedExtractPlan(workspace, plan) {
  const queryIds = new Set(plan.required?.queries || []);
  const fieldsByTable = new Map();
  for (const query of workspace.queries || []) {
    if (!queryIds.has(query.id)) continue;
    for (const table of query.sourceTables || []) {
      const fields = fieldsByTable.get(table) || new Set();
      for (const match of query.sql.matchAll(/\b([a-zA-Z_][\w]*)\b/g)) {
        if (!SQL_WORDS.has(match[1].toUpperCase())) fields.add(match[1]);
      }
      fieldsByTable.set(table, fields);
    }
  }
  return [...fieldsByTable.entries()].map(([tableName, fields]) => ({ tableName, columns: [...fields] }));
}

export function createPreAggregatedPlan(workspace, plan) {
  return (workspace.queries || []).filter((query) => (plan.required?.queries || []).includes(query.id)).map((query) => ({
    queryId: query.id,
    tableName: `result_${query.id.replace(/^query_/, "")}`,
    sql: query.sql,
    limitations: ["Source-level refresh is unavailable.", "Filters are limited to materialized result fields."],
  }));
}

export function validateExternalSchema(expected, actual) {
  const errors = [];
  const warnings = [];
  const actualColumns = new Map((actual.columns || []).map((column) => [column.name, String(column.duckType || column.type || "").toUpperCase()]));
  for (const column of expected.requiredColumns || []) {
    const actualType = actualColumns.get(column.name);
    if (!actualType) { errors.push({ path: column.name, message: "Required column is missing." }); continue; }
    if (column.compatibleTypes.length && !column.compatibleTypes.includes(actualType)) warnings.push({ path: column.name, message: `Column type ${actualType} may require conversion.` });
  }
  return { valid: errors.length === 0, errors, warnings };
}

function rowsToCsv(rows, columns) {
  if (!rows.length) return `${columns.join(",")}\n`;
  const keys = columns.length ? columns : Object.keys(rows[0] || {});
  return `${keys.join(",")}\n${rows.map((row) => keys.map((key) => csvCell(row[key])).join(",")).join("\n")}`;
}

function csvCell(value) {
  const text = html(value ?? "").replaceAll("&quot;", "\"").replaceAll("&#39;", "'");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function compatibleTypes(type) {
  const duckType = String(type || "").toUpperCase();
  if (/INT|DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL/.test(duckType)) return ["TINYINT", "SMALLINT", "INTEGER", "BIGINT", "HUGEINT", "FLOAT", "DOUBLE", "REAL", "DECIMAL", "NUMERIC"];
  if (/DATE|TIME/.test(duckType)) return ["DATE", "TIMESTAMP", "TIMESTAMPTZ", "VARCHAR"];
  if (/BOOL/.test(duckType)) return ["BOOLEAN", "VARCHAR"];
  return [duckType || "VARCHAR", "VARCHAR"];
}

const SQL_WORDS = new Set(["SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "AS", "SUM", "ROUND", "DATE_TRUNC", "AND", "OR", "NOT", "NULL", "IS", "IN", "LIMIT"]);
