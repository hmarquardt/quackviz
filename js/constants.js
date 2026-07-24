export const APP_VERSION = "0.6.0";
export const BUILD_DATE = "2026-07-24";
export const WORKSPACE_SCHEMA_VERSION = 1;
export const VIZ_SPEC_VERSION = 1;
export const AI_CONTRACT_VERSION = 1;
export const DASHBOARD_VERSION = 1;
export const REPORT_VERSION = 1;
export const MAP_SPEC_VERSION = 1;

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
