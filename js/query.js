const BLOCKED = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|COPY\s+TO|INSTALL|LOAD|ATTACH|DETACH|CALL|PRAGMA)\b/i;

export function validateAnalyticalSql(sql) {
  const text = sql.trim().replace(/;+\s*$/, "");
  const errors = [];
  if (!/^(SELECT|WITH)\b/i.test(text)) errors.push("Only SELECT and WITH queries are allowed for AI SQL.");
  if (BLOCKED.test(text)) errors.push("SQL contains a blocked statement.");
  if (text.includes(";")) errors.push("Multiple SQL statements are blocked.");
  return { valid: errors.length === 0, errors, sql: text };
}

export function previewSql(sql, limit = 500) {
  return `SELECT * FROM (${sql.replace(/;+\s*$/, "")}) AS quackviz_preview LIMIT ${Number(limit) || 500}`;
}

