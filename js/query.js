import { nowIso } from "./utils.js";
import { inferSourceTables } from "./workspace.js";

const BLOCKED = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|COPY\s+TO|INSTALL|LOAD|ATTACH|DETACH|CALL|PRAGMA)\b/i;

export async function runQuery(sql, queryId = null) {
  try {
    const { executeSql } = await import("./db.js");
    const result = await executeSql(sql);
    return {
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
      runtimeMs: Math.round(result.runtimeMs * 10) / 10,
      sql,
      queryId,
      sourceTables: inferSourceTables(sql),
      executedAt: nowIso(),
      error: null,
    };
  } catch (error) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      runtimeMs: 0,
      sql,
      queryId,
      sourceTables: inferSourceTables(sql),
      executedAt: nowIso(),
      error: {
        source: "duckdb",
        operation: "execute-query",
        message: error.message,
        detail: error.stack || "",
        timestamp: nowIso(),
      },
    };
  }
}

export function buildQuerySaveInput({ name, sql, result, existing }) {
  return {
    id: existing?.id,
    name: name || existing?.name || "Untitled query",
    description: existing?.description || "",
    sql,
    parameters: existing?.parameters || [],
    sourceTables: result?.sourceTables || inferSourceTables(sql),
    createdBy: existing?.createdBy || "user",
    lastRunAt: result?.executedAt || existing?.lastRunAt || null,
    runCount: (existing?.runCount || 0) + (result && !result.error ? 1 : 0),
  };
}

export function resultForQuery(state, queryId) {
  return state.currentResult?.queryId === queryId ? state.currentResult : null;
}

export function validateAnalyticalSql(sql) {
  const text = String(sql || "").trim().replace(/;+\s*$/, "");
  const errors = [];
  if (!/^(SELECT|WITH)\b/i.test(text)) errors.push("Only SELECT and WITH queries are allowed.");
  if (BLOCKED.test(text)) errors.push("SQL contains a blocked statement.");
  if (text.includes(";")) errors.push("Multiple SQL statements are blocked.");
  return { valid: errors.length === 0, errors, sql: text };
}

export function previewSql(sql, limit = 500) {
  return `SELECT * FROM (${String(sql || "").replace(/;+\s*$/, "")}) AS quackviz_preview LIMIT ${Number(limit) || 500}`;
}
