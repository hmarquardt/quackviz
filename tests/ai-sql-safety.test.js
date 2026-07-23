import { validateSqlSafety, wrapPreviewSql } from "../js/ai-sql-safety.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ok = (sql) => validateSqlSafety(sql, ["sales"]).ok;
const bad = (sql) => !validateSqlSafety(sql, ["sales"]).ok;

export const aiSqlSafetyTests = [
  { name: "ai-sql: plain SELECT accepted", run: () => assert(ok("SELECT * FROM sales"), "SELECT rejected") },
  { name: "ai-sql: WITH query accepted", run: () => assert(ok("WITH x AS (SELECT * FROM sales) SELECT * FROM x"), "WITH rejected") },
  { name: "ai-sql: trailing semicolon accepted", run: () => assert(ok("SELECT * FROM sales;"), "trailing semicolon rejected") },
  { name: "ai-sql: multiple statements rejected", run: () => assert(bad("SELECT * FROM sales; SELECT 1"), "multiple statements accepted") },
  { name: "ai-sql: DROP rejected", run: () => assert(bad("DROP TABLE sales"), "DROP accepted") },
  { name: "ai-sql: CREATE rejected", run: () => assert(bad("CREATE TABLE x AS SELECT 1"), "CREATE accepted") },
  { name: "ai-sql: COPY rejected", run: () => assert(bad("COPY sales TO 'x.csv'"), "COPY accepted") },
  { name: "ai-sql: INSTALL rejected", run: () => assert(bad("INSTALL httpfs"), "INSTALL accepted") },
  { name: "ai-sql: ATTACH rejected", run: () => assert(bad("ATTACH 'x.db'"), "ATTACH accepted") },
  { name: "ai-sql: PRAGMA rejected", run: () => assert(bad("PRAGMA version"), "PRAGMA accepted") },
  { name: "ai-sql: semicolon inside string", run: () => assert(ok("SELECT ';' AS semi FROM sales"), "semicolon string rejected") },
  { name: "ai-sql: keyword inside quoted string", run: () => assert(ok("SELECT 'DROP' AS word FROM sales"), "quoted keyword rejected") },
  { name: "ai-sql: comments handled", run: () => assert(ok("SELECT * FROM sales -- DROP\nLIMIT 1"), "comment rejected") },
  { name: "ai-sql: excessive query length rejected", run: () => assert(bad(`SELECT '${"x".repeat(21000)}'`), "long query accepted") },
  { name: "ai-sql: preview wrapper", run: () => assert(wrapPreviewSql("SELECT * FROM sales", 10).includes("LIMIT 10"), "wrapper missing limit") },
];
