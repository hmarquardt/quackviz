import { addDataSource } from "./state.js";
import { escapeIdent, nowIso, uid } from "./utils.js";
import { queryRows, registerFile, tableCount, tableInfo } from "./db.js";

function tableNameFromFile(name) {
  return name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^(\d)/, "t_$1");
}

export async function importFile(file) {
  const tableName = tableNameFromFile(file.name);
  const virtualName = `/${uid("file")}_${file.name}`;
  await registerFile(virtualName, await file.arrayBuffer());
  await importVirtualFile(virtualName, tableName, file.name);
  return tableName;
}

export async function importSample(url, tableName) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url}`);
  const virtualName = `/${tableName}.csv`;
  await registerFile(virtualName, await response.arrayBuffer());
  await importVirtualFile(virtualName, tableName, url);
  return tableName;
}

async function importVirtualFile(virtualName, tableName, displayName) {
  const lower = virtualName.toLowerCase();
  const escaped = escapeIdent(tableName);
  await queryRows(`DROP TABLE IF EXISTS ${escaped}`);
  if (lower.endsWith(".parquet") || lower.endsWith(".pq")) {
    await queryRows(`CREATE TABLE ${escaped} AS SELECT * FROM read_parquet('${virtualName}')`);
  } else if (lower.endsWith(".json") || lower.endsWith(".ndjson")) {
    await queryRows(`CREATE TABLE ${escaped} AS SELECT * FROM read_json_auto('${virtualName}')`);
  } else {
    await queryRows(`CREATE TABLE ${escaped} AS SELECT * FROM read_csv_auto('${virtualName}', HEADER=true)`);
  }
  const columns = await tableInfo(tableName);
  const rowCount = await tableCount(tableName);
  addDataSource({ id: uid("source"), name: displayName, tableName, rowCount, columns: columns.rows, importedAt: nowIso() });
}

