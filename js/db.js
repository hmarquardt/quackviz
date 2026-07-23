import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev57.0/+esm";
import { DEPENDENCIES } from "./constants.js";
import { escapeIdent, inferType, normalizeValue } from "./utils.js";

let db = null;
let conn = null;
let worker = null;
let workerUrl = null;
let initPromise = null;
let status = {
  initialized: false,
  initializing: false,
  connection: "not-started",
  selectedBundle: null,
  packageVersion: DEPENDENCIES.duckdbWasm.version,
  runtimeVersion: "unknown",
  error: null,
};

export async function initializeDatabase({ timeoutMs = 20000 } = {}) {
  if (conn) return { ...status, db, conn };
  if (initPromise) return initPromise;
  status = { ...status, initializing: true, connection: "initializing", error: null };
  initPromise = withTimeout(doInitialize(), timeoutMs, "DuckDB initialization timed out.");
  try {
    await initPromise;
    return { ...status, db, conn };
  } catch (error) {
    status = { ...status, initialized: false, initializing: false, connection: "failed", error: error.message };
    return { ...status, db: null, conn: null };
  } finally {
    initPromise = null;
  }
}

async function doInitialize() {
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  status.selectedBundle = `${bundle.mainModule}`;
  workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }));
  worker = new Worker(workerUrl);
  worker.onerror = (event) => {
    status.error = event.message || "DuckDB worker error.";
    status.connection = "worker-error";
  };
  db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();
  status = { ...status, initialized: true, initializing: false, connection: "connected", error: null };
  try {
    const version = await executeSql("SELECT version() AS version");
    status.runtimeVersion = version.rows[0]?.version || "unknown";
  } catch {
    status.runtimeVersion = "unknown";
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function getDatabaseStatus() {
  return { ...status };
}

export async function getConnection() {
  const result = await initializeDatabase();
  if (!result.conn) throw new Error(result.error || "DuckDB is not connected.");
  return result.conn;
}

export async function executeSql(sql) {
  const activeConn = await getConnection();
  const start = performance.now();
  const table = await activeConn.query(sql);
  const runtimeMs = performance.now() - start;
  return { ...arrowToDataset(table), runtimeMs };
}

export async function queryRows(sql) {
  return executeSql(sql);
}

export function arrowToDataset(table) {
  const fields = table?.schema?.fields || [];
  const rawRows = table?.toArray ? table.toArray() : [];
  const columns = fields.map((field) => {
    const duckType = String(field.type);
    return { name: field.name, duckType, inferredType: inferType(rawRows.slice(0, 50).map((row) => normalizeValue(row[field.name])), duckType) };
  });
  const rows = rawRows.map((row) => {
    const out = {};
    for (const column of columns) out[column.name] = normalizeValue(row[column.name]);
    return out;
  });
  return { columns, rows, rowCount: rows.length };
}

export async function registerFileBuffer(name, buffer) {
  const result = await initializeDatabase();
  if (!result.db) throw new Error(result.error || "DuckDB is not available.");
  await result.db.registerFileBuffer(name, new Uint8Array(buffer));
}

export async function registerFile(name, buffer) {
  return registerFileBuffer(name, buffer);
}

export async function tableInfo(tableName) {
  const result = await executeSql(`DESCRIBE ${escapeIdent(tableName)}`);
  return result.rows.map((row) => ({
    name: row.column_name || row.name,
    duckType: row.column_type || row.type || "UNKNOWN",
    nullable: row.null === "YES" || row.nullable !== false,
  }));
}

export async function tableCount(tableName) {
  const result = await executeSql(`SELECT COUNT(*) AS row_count FROM ${escapeIdent(tableName)}`);
  return Number(result.rows[0]?.row_count || 0);
}

export async function tableExists(tableName) {
  try {
    await executeSql(`SELECT 1 FROM ${escapeIdent(tableName)} LIMIT 0`);
    return true;
  } catch {
    return false;
  }
}

export async function cleanupDatabase() {
  if (conn) await conn.close();
  if (db) await db.terminate();
  if (worker) worker.terminate();
  if (workerUrl) URL.revokeObjectURL(workerUrl);
  db = null;
  conn = null;
  worker = null;
  workerUrl = null;
  status = { ...status, initialized: false, initializing: false, connection: "closed" };
}
