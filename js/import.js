import { LARGE_FILE_THRESHOLDS, SAMPLE_SALES, SUPPORTED_IMPORT_FORMATS, TASK_TIMEOUTS } from "./constants.js";
import { executeSql, registerFileBuffer, tableCount, tableInfo } from "./db.js";
import { escapeIdent, nowIso, uid } from "./utils.js";

const SQL_KEYWORDS = new Set([
  "select", "from", "where", "group", "order", "by", "table", "create", "drop", "insert", "update", "delete", "with",
  "join", "limit", "offset", "and", "or", "not", "null", "true", "false",
]);

const FORMAT_BY_EXTENSION = {
  csv: "csv",
  json: "json",
  geojson: "json",
  ndjson: "ndjson",
  jsonl: "ndjson",
  parquet: "parquet",
  pq: "parquet",
};

export async function loadIncludedSalesSample() {
  return importSample(SAMPLE_SALES.url, SAMPLE_SALES.tableName, SAMPLE_SALES.name, SAMPLE_SALES.fileName);
}

export async function importSample(url, tableName, displayName, fileName) {
  const response = await fetch(url);
  if (!response.ok) throw importError("fixture", "SAMPLE_FETCH_FAILED", `Unable to fetch ${url}: ${response.status} ${response.statusText}`);
  const virtualName = `/${fileName || tableName}.csv`;
  await registerFileBuffer(virtualName, await response.arrayBuffer());
  return importRegisteredSource({
    virtualName,
    tableName,
    format: "csv",
    metadata: {
      name: displayName || tableName,
      sourceType: "fixture",
      fileName: fileName || url.split("/").pop() || "sample.csv",
      sourceUrl: url,
    },
    options: { header: true, replace: true },
  });
}

export async function importRegisteredCsv(virtualName, requestedTableName, metadata = {}) {
  return importRegisteredSource({
    virtualName,
    tableName: requestedTableName,
    format: "csv",
    metadata,
    options: { header: true, replace: true },
  });
}

export function detectImportFormat({ fileName = "", contentType = "", override = "" } = {}) {
  const requested = normalizeFormat(override);
  if (requested && requested !== "auto") {
    if (!SUPPORTED_IMPORT_FORMATS.includes(requested)) {
      return { format: null, source: "override", confidence: 0, warnings: [{ code: "IMPORT_FORMAT_UNSUPPORTED", message: `Unsupported import format: ${override}` }] };
    }
    return { format: requested, source: "override", confidence: 1, warnings: [] };
  }

  const extension = extensionFromName(fileName);
  if (extension && FORMAT_BY_EXTENSION[extension]) {
    return { format: FORMAT_BY_EXTENSION[extension], source: "extension", confidence: 0.95, warnings: [] };
  }

  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (["text/csv", "application/csv", "application/vnd.ms-excel"].includes(type)) return { format: "csv", source: "content-type", confidence: 0.8, warnings: [] };
  if (["application/json", "text/json"].includes(type)) return { format: "json", source: "content-type", confidence: 0.75, warnings: [] };
  if (["application/x-ndjson", "application/jsonl", "application/x-jsonlines"].includes(type)) return { format: "ndjson", source: "content-type", confidence: 0.85, warnings: [] };
  if (["application/vnd.apache.parquet", "application/x-parquet"].includes(type)) return { format: "parquet", source: "content-type", confidence: 0.85, warnings: [] };

  return { format: null, source: "unknown", confidence: 0, warnings: [{ code: "IMPORT_FORMAT_UNSUPPORTED", message: "Choose CSV, JSON, NDJSON/JSONL, or Parquet." }] };
}

export function generateSafeTableName(input, existingNames = []) {
  const rawInput = String(input || "");
  let source = rawInput
    .split(/[\\/]/)
    .pop();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawInput)) source = source.replace(/[?#].*$/, "");
  source = source.replace(/\.[^.]+$/, "");
  let cleaned = source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  const usedFallbackName = !cleaned;
  if (!cleaned) cleaned = "table";
  if (/^[0-9]/.test(cleaned)) cleaned = `table_${cleaned}`;
  if (!usedFallbackName && SQL_KEYWORDS.has(cleaned)) cleaned = `${cleaned}_table`;
  cleaned = cleaned.slice(0, 60).replace(/_+$/g, "") || "table";

  const used = new Set(existingNames.map((name) => String(name).toLowerCase()));
  if (!used.has(cleaned)) return cleaned;
  for (let index = 2; index < 10000; index += 1) {
    const suffix = `_${index}`;
    const candidate = `${cleaned.slice(0, 60 - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${cleaned}_${Date.now()}`;
}

export function buildImportSql({ virtualName, tableName, format, options = {} }) {
  const normalized = normalizeFormat(format);
  if (!SUPPORTED_IMPORT_FORMATS.includes(normalized)) throw importError("import", "IMPORT_FORMAT_UNSUPPORTED", `Unsupported import format: ${format || "(empty)"}`);
  const target = escapeIdent(tableName);
  const path = sqlString(virtualName);
  if (normalized === "csv") {
    const header = options.header === false ? "false" : "true";
    return `CREATE TABLE ${target} AS SELECT * FROM read_csv_auto(${path}, HEADER = ${header})`;
  }
  if (normalized === "json") return `CREATE TABLE ${target} AS SELECT * FROM read_json_auto(${path}, FORMAT = 'array')`;
  if (normalized === "ndjson") return `CREATE TABLE ${target} AS SELECT * FROM read_json_auto(${path}, FORMAT = 'newline_delimited')`;
  return `CREATE TABLE ${target} AS SELECT * FROM read_parquet(${path})`;
}

export async function importLocalFile({ file, tableName, format = "auto", options = {}, signal, onProgress } = {}) {
  if (!file) throw importError("file", "IMPORT_FILE_MISSING", "Choose a local file to import.");
  if (signal?.aborted) throw abortImportError();
  if (file.size === 0) throw importError("file", "IMPORT_EMPTY_FILE", `${file.name || "Selected file"} is empty.`);
  const detected = detectImportFormat({ fileName: file.name, contentType: file.type, override: format });
  if (!detected.format) throw importError("file", "IMPORT_FORMAT_UNSUPPORTED", `Unsupported file format for ${file.name || "selected file"}.`);
  warnLargeFile(file.size, onProgress);
  onProgress?.({ stage: "Reading file", progress: 0.2, fileSize: file.size, format: detected.format });
  const buffer = await file.arrayBuffer();
  if (signal?.aborted) throw abortImportError();
  const virtualName = virtualPath(file.name, detected.format);
  onProgress?.({ stage: "Registering file", progress: 0.35, virtualName });
  await registerFileBuffer(virtualName, buffer);
  return importRegisteredSource({
    virtualName,
    tableName,
    format: detected.format,
    metadata: {
      name: tableName,
      sourceType: "file",
      fileName: file.name,
      fileType: detected.format,
      contentType: file.type || "",
      fileSize: file.size,
    },
    options,
    signal,
    onProgress,
  });
}

export async function importFromUrl({ url, tableName, format = "auto", options = {}, signal, onProgress } = {}) {
  if (signal?.aborted) throw abortImportError();
  const validation = validateImportUrl(url);
  if (!validation.valid) throw importError("url", validation.code, validation.message);
  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs || TASK_TIMEOUTS.importMs);
  const timeoutId = setTimeout(() => controller.abort("timeout"), timeoutMs);
  signal?.addEventListener("abort", () => controller.abort("cancelled"), { once: true });
  try {
    onProgress?.({ stage: "Downloading URL", progress: 0.15, url: validation.url });
    const response = await fetch(validation.url, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) throw importError("url", "IMPORT_HTTP_FAILED", `URL returned HTTP ${response.status} ${response.statusText}.`);
    const contentType = response.headers.get("content-type") || "";
    const detected = detectImportFormat({ fileName: validation.url, contentType, override: format });
    if (!detected.format) throw importError("url", "IMPORT_FORMAT_UNSUPPORTED", "The URL response format is not supported. Choose a manual format if the URL has no extension.");
    const sizeHeader = Number(response.headers.get("content-length"));
    if (Number.isFinite(sizeHeader) && sizeHeader > 0) warnLargeFile(sizeHeader, onProgress);
    const buffer = await response.arrayBuffer();
    if (controller.signal.aborted || signal?.aborted) throw abortImportError(controller.signal.reason === "timeout");
    const virtualName = virtualPath(new URL(validation.url).pathname.split("/").pop() || tableName, detected.format);
    await registerFileBuffer(virtualName, buffer);
    return importRegisteredSource({
      virtualName,
      tableName,
      format: detected.format,
      metadata: {
        name: tableName,
        sourceType: "url",
        sourceUrl: validation.url,
        fileName: new URL(validation.url).pathname.split("/").pop() || "",
        fileType: detected.format,
        contentType,
        fileSize: buffer.byteLength,
        httpStatus: response.status,
        redirected: response.redirected,
      },
      options,
      signal,
      onProgress,
    });
  } catch (error) {
    if (controller.signal.aborted || signal?.aborted) throw abortImportError(controller.signal.reason === "timeout");
    if (error.name === "TypeError") {
      throw importError("url", "IMPORT_CORS_OR_NETWORK_FAILED", "URL could not be fetched. The server may not permit browser cross-origin access.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function importRegisteredSource({ virtualName, tableName, format, metadata = {}, options = {}, signal, onProgress } = {}) {
  if (signal?.aborted) throw abortImportError();
  const normalized = normalizeFormat(format);
  const safeName = options.replace === false
    ? generateSafeTableName(tableName || metadata.fileName || virtualName, options.existingTableNames || [])
    : generateSafeTableName(tableName || metadata.fileName || virtualName);
  const replace = options.replace !== false;
  try {
    onProgress?.({ stage: "Creating table", progress: 0.55, tableName: safeName, format: normalized });
    if (replace) await executeSql(`DROP TABLE IF EXISTS ${escapeIdent(safeName)}`);
    await executeSql(buildImportSql({ virtualName, tableName: safeName, format: normalized, options }));
    if (signal?.aborted) throw abortImportError();
    onProgress?.({ stage: "Inspecting columns", progress: 0.75, tableName: safeName });
    const columns = await tableInfo(safeName);
    const rowCount = await tableCount(safeName);
    const rows = await fetchSampleRows(safeName);
    onProgress?.({ stage: "Finalizing metadata", progress: 1, rowCount, columnCount: columns.length });
    return {
      id: uid("source"),
      name: metadata.name || safeName,
      tableName: safeName,
      sourceType: metadata.sourceType || "file",
      fileName: metadata.fileName || "",
      sourceUrl: metadata.sourceUrl || null,
      fileType: normalized,
      contentType: metadata.contentType || "",
      fileSize: Number(metadata.fileSize || 0),
      httpStatus: metadata.httpStatus || null,
      redirected: Boolean(metadata.redirected),
      rowCount,
      columns,
      sampleRows: rows,
      importedAt: nowIso(),
      availability: "loaded",
      available: true,
      importOptions: { header: options.header !== false, replace },
      warnings: metadata.warnings || [],
      jsonModeling: metadata.jsonModeling || null,
    };
  } catch (error) {
    await cleanupTable(safeName);
    throw enrichImportError(error, normalized);
  }
}

export function validateImportUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, code: "IMPORT_URL_SCHEME_UNSUPPORTED", message: "Only http and https URLs can be imported." };
    }
    if (parsed.username || parsed.password) {
      return { valid: false, code: "IMPORT_URL_CREDENTIALS_REJECTED", message: "URLs with embedded credentials are not supported." };
    }
    return { valid: true, url: parsed.href, warnings: [] };
  } catch {
    return { valid: false, code: "IMPORT_URL_INVALID", message: "Enter a valid http or https URL." };
  }
}

function extensionFromName(fileName) {
  const last = String(fileName || "").split(/[\\/]/).pop().replace(/[?#].*$/, "");
  const match = /\.([^.]+)$/.exec(last);
  return match ? match[1].toLowerCase() : "";
}

function normalizeFormat(format) {
  const value = String(format || "").toLowerCase();
  if (value === "jsonl") return "ndjson";
  return value;
}

function virtualPath(fileName, format) {
  const base = generateSafeTableName(fileName || `import.${format}`);
  return `/${uid("upload")}_${base}.${format === "ndjson" ? "ndjson" : format}`;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function fetchSampleRows(tableName) {
  try {
    const result = await executeSql(`SELECT * FROM ${escapeIdent(tableName)} LIMIT 50`);
    return result.rows || [];
  } catch (error) {
    console.warn("QuackViz sample preview failed", error);
    return [];
  }
}

async function cleanupTable(tableName) {
  try {
    await executeSql(`DROP TABLE IF EXISTS ${escapeIdent(tableName)}`);
  } catch {
    // Best-effort cleanup only; the original import error remains the user-facing failure.
  }
}

function warnLargeFile(bytes, onProgress) {
  if (!Number.isFinite(bytes)) return;
  if (bytes >= LARGE_FILE_THRESHOLDS.acknowledgementBytes) onProgress?.({ stage: "Warning", warning: "This file is larger than 1 GB. Browser memory may be insufficient." });
  else if (bytes >= LARGE_FILE_THRESHOLDS.strongWarningBytes) onProgress?.({ stage: "Warning", warning: "This file is larger than 500 MB. Import may be slow or fail in this browser." });
  else if (bytes >= LARGE_FILE_THRESHOLDS.cautionBytes) onProgress?.({ stage: "Warning", warning: "This file is larger than 100 MB. Consider low-memory mode." });
  else if (bytes >= LARGE_FILE_THRESHOLDS.infoBytes) onProgress?.({ stage: "Warning", warning: "This file is larger than 25 MB. Import may take longer than the sample workflow." });
}

function abortImportError(timedOut = false) {
  return importError("import", timedOut ? "IMPORT_TIMEOUT" : "IMPORT_CANCELLED", timedOut ? "Import timed out before completion." : "Import was cancelled.");
}

function importError(source, code, message, detail = "") {
  const error = new Error(message);
  error.source = source;
  error.code = code;
  error.detail = detail;
  return error;
}

function enrichImportError(error, format) {
  if (error?.code) return error;
  const code = {
    csv: "IMPORT_CSV_PARSE_FAILED",
    json: "IMPORT_JSON_PARSE_FAILED",
    ndjson: "IMPORT_NDJSON_PARSE_FAILED",
    parquet: "IMPORT_PARQUET_READ_FAILED",
  }[format] || "IMPORT_DUCKDB_FAILED";
  return importError("duckdb", code, error?.message || "DuckDB import failed.", error?.stack || "");
}
