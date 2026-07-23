import { SAMPLE_SALES } from "./constants.js";
import { executeSql, registerFileBuffer, tableCount, tableInfo } from "./db.js";
import { escapeIdent, nowIso, sanitizeTableName, uid } from "./utils.js";

export async function loadIncludedSalesSample() {
  return importSample(SAMPLE_SALES.url, SAMPLE_SALES.tableName, SAMPLE_SALES.name, SAMPLE_SALES.fileName);
}

export async function importSample(url, tableName, displayName, fileName) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`);
  const virtualName = `/${fileName || tableName}.csv`;
  await registerFileBuffer(virtualName, await response.arrayBuffer());
  return importRegisteredCsv(virtualName, tableName, {
    name: displayName || tableName,
    sourceType: "sample",
    fileName: fileName || url.split("/").pop() || "sample.csv",
  });
}

export async function importRegisteredCsv(virtualName, requestedTableName, metadata = {}) {
  const tableName = sanitizeTableName(requestedTableName);
  await executeSql(`DROP TABLE IF EXISTS ${escapeIdent(tableName)}`);
  await executeSql(`CREATE TABLE ${escapeIdent(tableName)} AS SELECT * FROM read_csv_auto('${virtualName}', HEADER=true)`);
  const columns = await tableInfo(tableName);
  const rowCount = await tableCount(tableName);
  return {
    id: uid("source"),
    name: metadata.name || tableName,
    tableName,
    sourceType: metadata.sourceType || "sample",
    fileName: metadata.fileName || "",
    rowCount,
    columns,
    importedAt: nowIso(),
    available: true,
  };
}
