import { buildImportSql, detectImportFormat, generateSafeTableName, validateImportUrl } from "../js/import.js";
import { hydrateWorkspace } from "../js/workspace.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export const importTests = [
  { name: "import: detects CSV extension", run: () => assert(detectImportFormat({ fileName: "orders.csv" }).format === "csv", "csv not detected") },
  { name: "import: detects JSON extension", run: () => assert(detectImportFormat({ fileName: "orders.json" }).format === "json", "json not detected") },
  { name: "import: detects NDJSON extension", run: () => assert(detectImportFormat({ fileName: "events.ndjson" }).format === "ndjson", "ndjson not detected") },
  { name: "import: detects JSONL extension", run: () => assert(detectImportFormat({ fileName: "events.jsonl" }).format === "ndjson", "jsonl not detected") },
  { name: "import: detects Parquet extension", run: () => assert(detectImportFormat({ fileName: "metrics.parquet" }).format === "parquet", "parquet not detected") },
  { name: "import: detects uppercase extension", run: () => assert(detectImportFormat({ fileName: "ORDERS.CSV" }).format === "csv", "uppercase extension not detected") },
  { name: "import: detects URL path with query parameters", run: () => assert(detectImportFormat({ fileName: "https://example.com/orders.csv?download=1" }).format === "csv", "url extension not detected") },
  { name: "import: uses content-type hint", run: () => assert(detectImportFormat({ contentType: "application/x-ndjson; charset=utf-8" }).format === "ndjson", "content type not detected") },
  { name: "import: manual override wins", run: () => assert(detectImportFormat({ fileName: "orders.csv", override: "json" }).format === "json", "override ignored") },
  { name: "import: unsupported extension reports warning", run: () => { const result = detectImportFormat({ fileName: "orders.xlsx" }); assert(result.format === null && result.warnings.length, "unsupported extension accepted"); } },
  { name: "import: detection input not mutated", run: () => { const input = { fileName: "orders.csv", contentType: "text/csv" }; detectImportFormat(input); assert(input.fileName === "orders.csv" && input.contentType === "text/csv", "input mutated"); } },

  { name: "import: safe table name handles spaces", run: () => assert(generateSafeTableName("Sales 2026.csv") === "sales_2026", "spaces not normalized") },
  { name: "import: safe table name handles punctuation", run: () => assert(generateSafeTableName("sales!@#2026.csv") === "sales_2026", "punctuation not normalized") },
  { name: "import: safe table name handles unicode", run: () => assert(generateSafeTableName("Révenue.csv") === "revenue", "unicode not normalized") },
  { name: "import: safe table name handles leading number", run: () => assert(generateSafeTableName("123-results.parquet") === "table_123_results", "leading number not handled") },
  { name: "import: safe table name handles empty filename", run: () => assert(generateSafeTableName("") === "table", "empty name not handled") },
  { name: "import: safe table name handles duplicate names", run: () => assert(generateSafeTableName("sales.csv", ["sales"]) === "sales_2", "duplicate not handled") },
  { name: "import: safe table name handles SQL keyword", run: () => assert(generateSafeTableName("select.csv") === "select_table", "keyword not handled") },
  { name: "import: safe table name truncates long name", run: () => assert(generateSafeTableName("a".repeat(90) + ".csv").length <= 60, "long name not truncated") },

  { name: "import: CSV SQL uses DuckDB CSV reader", run: () => assert(buildImportSql({ virtualName: "/orders.csv", tableName: "orders", format: "csv" }).includes("read_csv_auto"), "csv reader missing") },
  { name: "import: JSON array SQL uses DuckDB JSON reader", run: () => assert(buildImportSql({ virtualName: "/orders.json", tableName: "orders", format: "json" }).includes("FORMAT = 'array'"), "json array option missing") },
  { name: "import: NDJSON SQL uses newline-delimited reader", run: () => assert(buildImportSql({ virtualName: "/events.ndjson", tableName: "events", format: "ndjson" }).includes("newline_delimited"), "ndjson option missing") },
  { name: "import: JSONL SQL uses newline-delimited reader", run: () => assert(buildImportSql({ virtualName: "/events.jsonl", tableName: "events", format: "jsonl" }).includes("newline_delimited"), "jsonl option missing") },
  { name: "import: Parquet SQL uses DuckDB parquet reader", run: () => assert(buildImportSql({ virtualName: "/telemetry.parquet", tableName: "telemetry", format: "parquet" }).includes("read_parquet"), "parquet reader missing") },
  { name: "import: import SQL quotes identifiers", run: () => assert(buildImportSql({ virtualName: "/orders.csv", tableName: "select", format: "csv" }).startsWith('CREATE TABLE "select"'), "identifier not quoted") },
  { name: "import: import SQL rejects unsupported reader", run: () => { let rejected = false; try { buildImportSql({ virtualName: "/x", tableName: "x", format: "sqlite" }); } catch { rejected = true; } assert(rejected, "unsupported format accepted"); } },

  { name: "import: validates HTTPS URLs", run: () => assert(validateImportUrl("https://example.com/data.csv").valid, "https rejected") },
  { name: "import: validates HTTP URLs", run: () => assert(validateImportUrl("http://example.com/data.csv").valid, "http rejected") },
  { name: "import: rejects javascript scheme", run: () => assert(!validateImportUrl("javascript:alert(1)").valid, "javascript accepted") },
  { name: "import: rejects data scheme", run: () => assert(!validateImportUrl("data:text/csv,a,b").valid, "data accepted") },
  { name: "import: rejects file scheme", run: () => assert(!validateImportUrl("file:///tmp/data.csv").valid, "file accepted") },
  { name: "import: rejects malformed URL", run: () => assert(!validateImportUrl("not a url").valid, "malformed url accepted") },
  { name: "import: rejects URL credentials", run: () => assert(!validateImportUrl("https://user:pass@example.com/data.csv").valid, "credentials accepted") },

  { name: "import: source metadata round trip", run: () => {
    const workspace = hydrateWorkspace({ version: 1, dataSources: [{ id: "source_1", name: "Orders", tableName: "orders", sourceType: "url", sourceUrl: "https://example.com/orders.csv", fileType: "csv", fileSize: 100, rowCount: 2, columns: [{ name: "id", duckType: "INTEGER" }], sampleRows: [{ id: 1 }] }] });
    const source = workspace.dataSources[0];
    assert(source.sourceType === "url" && source.fileType === "csv" && source.fileSize === 100 && source.availability === "unavailable", "metadata not hydrated");
  } },
];
