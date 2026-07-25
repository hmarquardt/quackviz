import { APP_VERSION } from "./constants.js";

export { APP_VERSION };

export function uid(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function escapeIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

export function sanitizeTableName(name) {
  const cleaned = String(name)
    .replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const tableName = (/^[a-z_]/.test(cleaned) ? cleaned : `table_${cleaned}`) || "table";
  return ["select", "from", "where", "table", "group", "order"].includes(tableName) ? `${tableName}_table` : tableName;
}

export function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeString(value) {
  if (value == null) return "";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function truncate(value, length = 80) {
  const text = safeString(value);
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

export function formatNumber(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat("en-US", options).format(number);
}

export function normalizeValue(value) {
  if (value == null) return null;
  if (typeof value === "bigint") {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : value.toString();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (typeof value.toISOString === "function") return value.toISOString();
    if (typeof value.toJSON === "function") return normalizeValue(value.toJSON());
    if ("value" in value && Object.keys(value).length <= 2) return normalizeValue(value.value);
    return safeString(value);
  }
  return value;
}

export function inferType(values, duckType = "") {
  const type = String(duckType).toUpperCase();
  if (/(DATE|TIME)/.test(type)) return "date";
  if (/(DECIMAL|DOUBLE|FLOAT|REAL|INT|HUGEINT|UBIGINT|BIGINT|SMALLINT|TINYINT)/.test(type)) return "number";
  const present = values.filter((value) => value != null && value !== "");
  if (present.length && present.every((value) => Number.isFinite(Number(value)))) return "number";
  if (present.length && present.every((value) => !Number.isNaN(Date.parse(value)))) return "date";
  return "string";
}

export function copyText(text) {
  if (!navigator.clipboard) throw new Error("Clipboard API is unavailable.");
  return navigator.clipboard.writeText(text);
}

export function downloadText(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function debounce(fn, ms = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
