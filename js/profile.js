import { queryRows } from "./db.js";
import { inferGeographicSemantic } from "./spatial-profile.js";
import { escapeIdent } from "./utils.js";

function inferSemanticType(column, profile) {
  const geo = inferGeographicSemantic(column, [profile.min, profile.max, ...(profile.topValues || []).map((item) => item.value)].filter((value) => value != null));
  if (geo.semanticType !== "unknown geography") return geo.semanticType;
  const name = column.name.toLowerCase();
  const type = column.type.toLowerCase();
  if (/lat(itude)?/.test(name)) return "latitude";
  if (/lon(gitude)?|lng/.test(name)) return "longitude";
  if (/url|uri|link/.test(name)) return "URL";
  if (/email/.test(name)) return "email";
  if (/id$|^id|_id$/.test(name)) return "identifier";
  if (/date$|_date|day|month/.test(name) || type.includes("date")) return "date";
  if (/time|timestamp/.test(name) || type.includes("timestamp")) return "datetime";
  if (/price|revenue|sales|cost|profit|amount/.test(name)) return "currency";
  if (/percent|rate|ratio|discount/.test(name)) return "percentage";
  if (type.includes("bool")) return "boolean";
  if (/int|double|float|decimal|number/.test(type)) return "numeric";
  if (profile.distinctRatio != null && profile.distinctRatio < 0.25) return "category";
  if (profile.maxLength > 80) return "free text";
  return "unknown";
}

export async function profileTable(tableName, columns) {
  const profiles = [];
  const quotedTable = escapeIdent(tableName);
  const total = (await queryRows(`SELECT COUNT(*) AS n FROM ${quotedTable}`)).rows[0]?.n || 0;
  for (const column of columns) {
    const field = column.column_name || column.name;
    const type = column.column_type || column.type;
    const q = escapeIdent(field);
    const numeric = /int|double|float|decimal|hugeint|utinyint|smallint|real/i.test(type);
    const stats = await queryRows(`SELECT
      SUM(CASE WHEN ${q} IS NULL THEN 1 ELSE 0 END) AS null_count,
      COUNT(DISTINCT ${q}) AS distinct_count,
      MIN(${q}) AS min_value,
      MAX(${q}) AS max_value,
      ${numeric ? `AVG(${q})` : "NULL"} AS avg_value,
      MAX(length(CAST(${q} AS VARCHAR))) AS max_length
      FROM ${quotedTable}`);
    const top = await queryRows(`SELECT CAST(${q} AS VARCHAR) AS value, COUNT(*) AS count FROM ${quotedTable} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`);
    const row = stats.rows[0] || {};
    const profile = {
      name: field,
      type,
      nullCount: Number(row.null_count || 0),
      distinctCount: Number(row.distinct_count || 0),
      distinctRatio: total ? Number(row.distinct_count || 0) / Number(total) : null,
      min: row.min_value,
      max: row.max_value,
      average: row.avg_value,
      maxLength: Number(row.max_length || 0),
      topValues: top.rows,
    };
    profile.semanticType = inferSemanticType({ name: field, type }, profile);
    const geo = inferGeographicSemantic({ name: field, type }, [profile.min, profile.max, ...top.rows.map((item) => item.value)].filter((value) => value != null));
    profile.semanticConfidence = geo.semanticType === "unknown geography" ? null : geo.semanticConfidence;
    profile.semanticReasons = geo.semanticReasons;
    profiles.push(profile);
  }
  return profiles;
}
