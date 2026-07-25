export const APP_VERSION = "1.0.0-beta.1";
export const BUILD_DATE = "2026-07-25";
export const RELEASE_CHANNEL = "beta";
export const WORKSPACE_SCHEMA_VERSION = 1;
export const VIZ_SPEC_VERSION = 1;
export const AI_CONTRACT_VERSION = 1;
export const DASHBOARD_VERSION = 1;
export const REPORT_VERSION = 1;
export const MAP_SPEC_VERSION = 1;
export const INTERACTION_VERSION = 1;
export const PACKAGE_FORMAT_VERSION = 1;
export const TEMPLATE_FORMAT_VERSION = 1;
export const EXTENSION_FORMAT_VERSION = 1;
export const EMBED_FORMAT_VERSION = 1;

export const DEPENDENCIES = {
  echarts: {
    packageName: "echarts",
    version: "6.0.0",
    url: "https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.esm.min.js",
  },
  duckdbWasm: {
    packageName: "@duckdb/duckdb-wasm",
    version: "1.33.1-dev57.0",
    url: "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev57.0/+esm",
  },
  maplibre: {
    packageName: "maplibre-gl",
    version: "5.24.0",
    url: "https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/+esm",
    cssUrl: "https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.css",
  },
};

export const STORAGE = {
  dbName: "quackviz",
  dbVersion: 1,
  workspaceStore: "workspaces",
  metaStore: "meta",
  activeWorkspaceKey: "active",
  themePreferenceKey: "quackviz.theme",
  openRouterApiKey: "quackviz.openrouter.apiKey",
  aiModelCache: "quackviz.ai.models",
};

export const SAMPLE_SALES = {
  id: "sample_sales",
  name: "Sample Sales",
  tableName: "sales",
  fileName: "sales.csv",
  url: "samples/sales.csv",
};

export const DEFAULT_SALES_SQL = `SELECT
  date_trunc('month', order_date) AS month,
  ROUND(SUM(revenue), 2) AS revenue
FROM sales
GROUP BY 1
ORDER BY 1;`;

export const SUPPORTED_MAP_TYPES = ["map-point", "map-clustered-point", "map-proportional-symbol", "map-category-point", "map-choropleth", "map-region-symbol"];
export const SUPPORTED_CHART_TYPES = ["line", "bar", ...SUPPORTED_MAP_TYPES];
export const TOOLTIP_MODES = ["axis", "item", false];
export const ORIENTATIONS = ["vertical"];
export const DASHBOARD_GRID_COLUMNS = 12;
export const DASHBOARD_CONCURRENCY_LIMIT = 3;
export const REPORT_CONCURRENCY_LIMIT = 2;
export const MAP_POINT_LIMIT = 10000;
export const MAP_CLUSTER_POINT_LIMIT = 100000;
export const MAP_TOOLTIP_FIELD_LIMIT = 10;
export const MAP_CATEGORY_WARNING_LIMIT = 12;
export const INTERACTION_HISTORY_LIMIT = 100;
export const INTERACTION_MAX_PROPAGATION_DEPTH = 4;
export const PACKAGE_MODES = ["workspace-backup", "standalone", "dashboard-only", "report-only", "visualization", "template", "embed"];
export const PACKAGE_DATA_MODES = ["included", "external", "snapshot-only", "pre-aggregated"];
export const PACKAGE_SIZE_WARNINGS = [25 * 1024 * 1024, 100 * 1024 * 1024, 500 * 1024 * 1024];
export const VENDOR_MANIFEST_URL = "vendor/manifest.json";
export const PERFORMANCE_HISTORY_LIMIT = 100;
export const TASK_TIMEOUTS = {
  dependencyLoadMs: 15000,
  workerReadyMs: 5000,
  duckdbInitMs: 45000,
  queryMs: 30000,
  importMs: 60000,
  packageMs: 60000,
};
export const LARGE_FILE_THRESHOLDS = {
  infoBytes: 25 * 1024 * 1024,
  cautionBytes: 100 * 1024 * 1024,
  strongWarningBytes: 500 * 1024 * 1024,
  acknowledgementBytes: 1024 * 1024 * 1024,
};
export const SUPPORTED_IMPORT_FORMATS = ["csv", "json", "ndjson", "parquet"];
export const IMPORT_FORMAT_LABELS = {
  auto: "Auto detect",
  csv: "CSV",
  json: "JSON array",
  ndjson: "NDJSON / JSONL",
  parquet: "Parquet",
};
export const RESULT_LIMITS = {
  tablePreviewRows: 500,
  visualizationRows: 50000,
  dashboardCardRows: 20000,
  reportTableRows: 50,
};
export const RECOVERY_LIMITS = {
  checkpoints: 4,
  journalEntries: 100,
};

export const OPENROUTER = {
  provider: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  modelsUrl: "https://openrouter.ai/api/v1/models",
  fallbackModels: [
    { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini" },
    { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku" },
    { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
  ],
};

export const DEFAULT_AI_SETTINGS = {
  enabled: false,
  provider: "openrouter",
  model: "openai/gpt-4.1-mini",
  customSystemPrompt: "",
  temperature: 0.2,
  maxOutputTokens: 2500,
  maxSchemaColumns: 60,
  maxProfileValues: 8,
  maxSampleRows: 0,
  maxResultRows: 25,
  timeoutMs: 30000,
  contextMode: "metadata",
};
