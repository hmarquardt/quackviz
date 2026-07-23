export const APP_VERSION = "0.1.0";

export function uid(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function escapeIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
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

export async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

export function debounce(fn, ms = 150) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeRows(table) {
  if (!table) return { rows: [], columns: [] };
  const columns = table.schema.fields.map((field) => ({
    name: field.name,
    type: String(field.type),
  }));
  const rows = table.toArray().map((row) => {
    if (row && typeof row.toJSON === "function") return row.toJSON();
    const out = {};
    for (const column of columns) out[column.name] = row[column.name];
    return out;
  });
  return { rows, columns };
}

export function truncate(value, length = 80) {
  const text = value == null ? "" : String(value);
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

