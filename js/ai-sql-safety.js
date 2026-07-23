import { inferSourceTables } from "./workspace.js";

const BLOCKED = new Set(["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "REPLACE", "MERGE", "COPY", "EXPORT", "IMPORT", "INSTALL", "LOAD", "ATTACH", "DETACH", "CALL", "PRAGMA", "VACUUM", "CHECKPOINT", "SET", "RESET", "SECRET", "FORCE", "TRUNCATE"]);
const EXTERNAL = /\b(read_csv|read_json|read_parquet|read_text|httpfs|https?:\/\/|s3:\/\/|gcs:\/\/|azure:\/\/)\b/i;

export function validateSqlSafety(sql, knownTables = []) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeSql(sql, errors);
  if (!normalized) return { ok: false, sql: "", errors, warnings, sourceTables: [] };
  const tokens = tokenizeSql(normalized);
  const first = tokens.find((token) => token.type === "word")?.value.toUpperCase();
  if (!["SELECT", "WITH"].includes(first)) errors.push({ code: "AI_SQL_NOT_READ_ONLY", message: "SQL must begin with SELECT or WITH." });
  for (const token of tokens) {
    if (token.type === "word" && BLOCKED.has(token.value.toUpperCase())) {
      errors.push({ code: "AI_SQL_BLOCKED_KEYWORD", message: `Blocked SQL keyword: ${token.value.toUpperCase()}.` });
    }
  }
  if (hasMultipleStatements(normalized)) errors.push({ code: "AI_SQL_MULTIPLE_STATEMENTS", message: "Multiple SQL statements are not allowed." });
  if (EXTERNAL.test(stripStringsAndComments(normalized))) errors.push({ code: "AI_SQL_EXTERNAL_ACCESS", message: "External file, URL, or extension access is blocked." });
  const sourceTables = inferSourceTables(normalized);
  const known = new Set(knownTables);
  for (const table of sourceTables) {
    if (known.size && !known.has(table)) warnings.push({ code: "AI_SQL_UNKNOWN_TABLE", message: `Referenced table '${table}' is not in selected workspace metadata.` });
  }
  return { ok: errors.length === 0, sql: normalized, errors, warnings, sourceTables };
}

export function normalizeSql(sql, errors = []) {
  if (typeof sql !== "string") {
    errors.push({ code: "AI_SQL_NOT_STRING", message: "SQL must be a string." });
    return "";
  }
  let text = sql.trim();
  if (!text) errors.push({ code: "AI_SQL_EMPTY", message: "SQL is empty." });
  if (text.includes("\0")) errors.push({ code: "AI_SQL_NULL_BYTE", message: "SQL contains a null byte." });
  if (text.length > 20000) errors.push({ code: "AI_SQL_TOO_LONG", message: "SQL is too long." });
  if (text.endsWith(";") && !hasMultipleStatements(text)) text = text.slice(0, -1).trim();
  return errors.length ? "" : text;
}

export function wrapPreviewSql(sql, limit = 500) {
  const normalized = normalizeSql(sql);
  return `SELECT * FROM (\n${normalized}\n) AS __quackviz_ai_preview\nLIMIT ${Math.max(1, Math.min(Number(limit) || 500, 5000))}`;
}

export async function explainSql(sql) {
  const { executeSql } = await import("./db.js");
  const startedAt = performance.now();
  try {
    const result = await executeSql(`EXPLAIN ${normalizeSql(sql)}`);
    return { ok: true, plan: result.rows.map((row) => Object.values(row).join(" ")).join("\n"), runtimeMs: Math.round(performance.now() - startedAt), error: null };
  } catch (error) {
    return { ok: false, plan: "", runtimeMs: Math.round(performance.now() - startedAt), error: error.message };
  }
}

export async function previewSql(sql, limit = 500) {
  const { executeSql } = await import("./db.js");
  try {
    const result = await executeSql(wrapPreviewSql(sql, limit));
    return { ok: true, result, error: null };
  } catch (error) {
    return { ok: false, result: null, error: error.message };
  }
}

function hasMultipleStatements(sql) {
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  let sawSemicolon = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") { blockComment = false; i += 1; }
      continue;
    }
    if (!quote && ch === "-" && next === "-") { lineComment = true; i += 1; continue; }
    if (!quote && ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (quote) {
      if (ch === quote && next === quote) { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === ";") {
      if (sawSemicolon || sql.slice(i + 1).trim()) return true;
      sawSemicolon = true;
    }
  }
  return false;
}

function tokenizeSql(sql) {
  const stripped = stripStringsAndComments(sql);
  return [...stripped.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map((match) => ({ type: "word", value: match[0] }));
}

function stripStringsAndComments(sql) {
  let out = "";
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; out += " "; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i += 1; } out += " "; continue; }
    if (!quote && ch === "-" && next === "-") { lineComment = true; i += 1; out += " "; continue; }
    if (!quote && ch === "/" && next === "*") { blockComment = true; i += 1; out += " "; continue; }
    if (quote) {
      if (ch === quote && next === quote) { i += 1; }
      else if (ch === quote) quote = null;
      out += " ";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; out += " "; continue; }
    out += ch;
  }
  return out;
}
