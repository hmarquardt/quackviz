import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev57.0/+esm";
import { normalizeRows } from "./utils.js";
import { state } from "./state.js";

let db = null;
let conn = null;
let workerUrl = null;

export async function initDuckDb() {
  if (db && conn) return { db, conn };
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);
  db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();
  state.diagnostics.opfs = Boolean(navigator.storage?.getDirectory);
  try {
    state.diagnostics.duckdbVersion = (await queryRows("SELECT version() AS version")).rows[0]?.version || "unknown";
  } catch {
    state.diagnostics.duckdbVersion = "unknown";
  }
  return { db, conn };
}

export async function queryRows(sql) {
  await initDuckDb();
  const start = performance.now();
  const table = await conn.query(sql);
  const runtimeMs = Math.round(performance.now() - start);
  return { ...normalizeRows(table), runtimeMs };
}

export async function explain(sql) {
  return queryRows(`EXPLAIN ${sql.replace(/;+\s*$/, "")}`);
}

export async function registerFile(name, buffer) {
  await initDuckDb();
  await db.registerFileBuffer(name, new Uint8Array(buffer));
}

export async function tableInfo(tableName) {
  return queryRows(`DESCRIBE "${tableName.replaceAll('"', '""')}"`);
}

export async function tableCount(tableName) {
  const result = await queryRows(`SELECT COUNT(*) AS row_count FROM "${tableName.replaceAll('"', '""')}"`);
  return Number(result.rows[0]?.row_count || 0);
}

export async function listTables() {
  const result = await queryRows("SHOW TABLES");
  return result.rows.map((row) => row.name || row.table_name || Object.values(row)[0]).filter(Boolean);
}
