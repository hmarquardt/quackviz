import { AI_CONTRACT_VERSION, APP_VERSION, BUILD_DATE } from "./constants.js";

const SENSITIVE = /(name|email|phone|address|birth|dob|ssn|social|account|credit|card|medical|patient|ip_address|ip\b|device|identifier|comment|notes?|free_?text)/i;

export function buildAiContext({ workspace, selectedTableNames, result = null, recommendations = [], settings = {}, excludedColumns = [] }) {
  const excluded = new Set(excludedColumns);
  const selected = new Set(selectedTableNames || []);
  const sensitiveColumns = [];
  const tables = workspace.dataSources
    .filter((source) => !selected.size || selected.has(source.tableName))
    .map((source) => ({
      name: source.tableName,
      rowCount: source.rowCount,
      columns: source.columns.slice(0, settings.maxSchemaColumns || 60).filter((column) => {
        const sensitive = isSensitiveColumn(column.name);
        if (sensitive) sensitiveColumns.push(`${source.tableName}.${column.name}`);
        return !excluded.has(`${source.tableName}.${column.name}`);
      }).map((column) => ({
        name: column.name,
        duckType: column.duckType,
        semanticType: semanticType(column),
        semanticConfidence: semanticConfidence(column),
        nullable: column.nullable,
      })),
    }));
  const context = {
    app: { name: "QuackViz", version: APP_VERSION, buildDate: BUILD_DATE },
    contractVersion: AI_CONTRACT_VERSION,
    privacy: {
      contextMode: settings.contextMode || "metadata",
      sampleRowsIncluded: false,
      sensitiveDetectionIsHeuristic: true,
      sensitiveColumns,
      excludedColumns: [...excluded],
      warning: sensitiveColumns.length ? "Likely sensitive fields were detected. Sample rows are excluded unless explicitly enabled." : "",
    },
    tables,
    deterministicRecommendations: recommendations,
  };
  if (result && settings.includeResultSummary) context.currentResult = summarizeResult(result, settings.maxResultRows || 25);
  return { context, warnings: context.privacy.warning ? [context.privacy.warning] : [], sensitiveColumns };
}

export function summarizeResult(result, maxRows = 25) {
  return {
    columns: result.columns,
    rowCount: result.rowCount,
    runtimeMs: result.runtimeMs,
    sql: result.sql,
    rows: (result.rows || []).slice(0, Math.max(0, maxRows)),
  };
}

export function contextPreview(context) {
  return JSON.stringify(context, null, 2);
}

export function isSensitiveColumn(name) {
  return SENSITIVE.test(String(name || ""));
}

function semanticType(column) {
  const name = String(column.name || "").toLowerCase();
  const type = String(column.duckType || "").toUpperCase();
  if (/date|time/.test(name) || /DATE|TIME/.test(type)) return "date";
  if (/revenue|sales|cost|profit|amount|price/.test(name)) return "currency";
  if (/quantity|count|rate|ratio|margin/.test(name) || /INT|DOUBLE|FLOAT|DECIMAL|NUMERIC/.test(type)) return "number";
  return "category";
}

function semanticConfidence(column) {
  const name = String(column.name || "").toLowerCase();
  if (/date|revenue|sales|cost|profit|quantity|category|region|product/.test(name)) return 0.9;
  return 0.55;
}
