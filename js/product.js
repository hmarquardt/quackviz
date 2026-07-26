import { APP_VERSION, BUILD_DATE, RELEASE_CHANNEL } from "./constants.js";

export const ONBOARDING_STORAGE_KEYS = {
  welcomeDismissed: "quackviz.onboarding.welcomeDismissed",
  checklistDismissed: "quackviz.onboarding.checklistDismissed",
  sidebarCollapsed: "quackviz.sidebar.collapsed",
};

export const HELP_TOPICS = [
  { id: "getting-started", title: "Getting started", path: "docs/getting-started.md", keywords: ["first run", "workflow", "add data"] },
  { id: "showcase", title: "Showcase examples", path: "docs/showcase.md", keywords: ["examples", "demo", "gapminder", "montreal", "stocks", "iris", "wind"] },
  { id: "importing-data", title: "Importing data", path: "docs/importing-data.md", keywords: ["csv", "json", "parquet", "url", "cors"] },
  { id: "sql", title: "Writing SQL", path: "docs/sql.md", keywords: ["duckdb", "query", "starter"] },
  { id: "visualizations", title: "Building charts", path: "docs/visualizations.md", keywords: ["chart", "echarts", "map"] },
  { id: "dashboards", title: "Dashboards", path: "docs/dashboards.md", keywords: ["cards", "filters", "linked filtering"] },
  { id: "reports", title: "Reports", path: "docs/reports.md", keywords: ["narrative", "export", "snapshot"] },
  { id: "maps", title: "Maps", path: "docs/maps.md", keywords: ["maplibre", "choropleth", "coordinates"] },
  { id: "ai-privacy", title: "AI and privacy", path: "docs/ai-and-privacy.md", keywords: ["openrouter", "metadata", "sample rows"] },
  { id: "packages", title: "Export and backup", path: "docs/packages.md", keywords: ["package", "standalone", "backup"] },
  { id: "recovery", title: "Recovery", path: "docs/recovery.md", keywords: ["checkpoint", "safe mode", "restore"] },
  { id: "shortcuts", title: "Keyboard shortcuts", path: "docs/keyboard-shortcuts.md", keywords: ["command palette", "keyboard"] },
  { id: "troubleshooting", title: "Troubleshooting", path: "docs/troubleshooting.md", keywords: ["cors", "reload", "limits"] },
  { id: "limitations", title: "Beta limitations", path: "docs/troubleshooting.md#beta-limitations", keywords: ["beta", "browser limits", "known limitations"] },
];

export const SHOWCASE_DATASETS = [
  { file: "01_global_development_odyssey.json", title: "Global Development Odyssey", rows: 1704, description: "Historical country development indicators through 2007.", bestFor: "Line charts, vertical bars, and country point maps.", source: "Transformed Gapminder demonstration data", recipe: { title: "Population by country centroid", sql: "SELECT country, continent, latitude, longitude, population FROM table_01_global_development_odyssey WHERE year = 2007", visualization: "Proportional-symbol point map", fields: "Latitude: latitude · Longitude: longitude · Size: population · Color: continent" } },
  { file: "02_montreal_mobility_constellation.json", title: "Montreal Mobility Constellation", rows: 249, description: "Montreal car-sharing availability hotspots.", bestFor: "Clustered, proportional-symbol, and category point maps.", source: "Transformed Plotly Montreal car-sharing data", recipe: { title: "Montreal availability hotspots", sql: "SELECT hotspot_id, latitude, longitude, car_hours, peak_period FROM table_02_montreal_mobility_constellation", visualization: "Clustered or proportional-symbol point map", fields: "Latitude: latitude · Longitude: longitude · Size: car_hours · Color: peak_period" } },
  { file: "03_tech_stock_time_machine.json", title: "Tech Stock Time Machine", rows: 630, description: "Demonstration technology-stock index series.", bestFor: "Multi-series line trends and vertical bars.", source: "Transformed Plotly stock index demonstration data", recipe: { title: "Technology index history", sql: "SELECT date, symbol, index_value FROM table_03_tech_stock_time_machine ORDER BY date, symbol", visualization: "Multi-series line chart", fields: "X: date · Y: index_value · Series: symbol" } },
  { file: "04_iris_morphology_lab.json", title: "Iris Morphology Lab", rows: 150, description: "Fisher iris measurements with derived morphology fields.", bestFor: "Species average vertical bars and numerical summaries.", source: "Transformed Fisher/UCI Iris data", recipe: { title: "Average petal length by species", sql: "SELECT species, AVG(petal_length) AS average_petal_length FROM table_04_iris_morphology_lab GROUP BY species ORDER BY species", visualization: "Vertical bar chart", fields: "X: species · Y: average_petal_length" } },
  { file: "05_wind_rose_observatory.json", title: "Wind Rose Observatory", rows: 128, description: "Wind direction and strength frequencies.", bestFor: "Direction rankings and strength-grouped vertical bars.", source: "Transformed Plotly wind demonstration data", recipe: { title: "Wind frequency by direction", sql: "SELECT direction, SUM(frequency) AS frequency FROM table_05_wind_rose_observatory GROUP BY direction ORDER BY frequency DESC", visualization: "Vertical bar chart", fields: "X: direction · Y: frequency" } },
];

export const KEYBOARD_SHORTCUTS = [
  { keys: "Ctrl/Cmd + Enter", action: "Run the current SQL query" },
  { keys: "Ctrl/Cmd + S", action: "Save the current query or visualization when available" },
  { keys: "Ctrl/Cmd + K", action: "Open search and commands" },
  { keys: "Ctrl/Cmd + O", action: "Go to Add data" },
  { keys: "?", action: "Open Help" },
  { keys: "Escape", action: "Close dialogs and overlays" },
];

export function createOnboardingState({ workspace, welcomeDismissed = false, checklistDismissed = false } = {}) {
  const dataSources = workspace?.dataSources || [];
  const queries = workspace?.queries || [];
  const visualizations = workspace?.visualizations || [];
  return {
    firstRun: !dataSources.length && !queries.length && !visualizations.length,
    welcomeDismissed: Boolean(welcomeDismissed),
    checklistDismissed: Boolean(checklistDismissed),
    steps: [
      { id: "add-data", label: "Add data", complete: dataSources.length > 0, tab: "data" },
      { id: "inspect", label: "Inspect columns", complete: dataSources.some((source) => source.columns?.length), tab: "data" },
      { id: "query", label: "Run or save a query", complete: queries.length > 0, tab: "sql" },
      { id: "visualize", label: "Build a visualization", complete: visualizations.length > 0, tab: "visualize" },
      { id: "combine", label: "Combine into a dashboard or report", complete: Boolean(workspace?.dashboards?.length || workspace?.reports?.length), tab: "dashboard" },
    ],
  };
}

export function recentItems(workspace, limit = 8) {
  const groups = [
    ...(workspace?.dataSources || []).map((item) => recent("Data source", item, item.importedAt || item.updatedAt)),
    ...(workspace?.queries || []).map((item) => recent("Query", item, item.updatedAt || item.createdAt)),
    ...(workspace?.visualizations || []).map((item) => recent("Visualization", item, item.updatedAt || item.createdAt)),
    ...(workspace?.dashboards || []).map((item) => recent("Dashboard", item, item.updatedAt || item.createdAt)),
    ...(workspace?.reports || []).map((item) => recent("Report", item, item.updatedAt || item.createdAt)),
  ];
  return groups
    .filter((item) => item.id && item.name)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, limit);
}

export function buildCommandItems(workspace) {
  const commands = [
    { id: "cmd-add-data", type: "Command", label: "Add data", tab: "data", keywords: ["import", "file", "url"] },
    { id: "cmd-showcase", type: "Command", label: "Browse showcase datasets", action: "showcase", keywords: ["examples", "demo"] },
    { id: "cmd-run-sql", type: "Command", label: "Run SQL", tab: "sql", keywords: ["query", "analyze"] },
    { id: "cmd-new-dashboard", type: "Command", label: "New dashboard", tab: "dashboard", keywords: ["cards"] },
    { id: "cmd-new-report", type: "Command", label: "New report", tab: "report", keywords: ["narrative"] },
    { id: "cmd-ai", type: "Command", label: "Ask AI", tab: "ai", keywords: ["optional", "openrouter"] },
    { id: "cmd-help", type: "Command", label: "Open Help", action: "help", keywords: ["docs", "shortcuts"] },
    { id: "cmd-about", type: "Command", label: "About QuackViz", action: "about", keywords: ["version", "beta"] },
  ];
  commands.push(...SHOWCASE_DATASETS.map((dataset) => ({ id: `cmd-showcase-${dataset.file}`, type: "Showcase", label: `Load ${dataset.title}`, action: "showcase-dataset", showcaseFile: dataset.file, keywords: ["example", "preview"] })));
  const artifacts = recentItems(workspace, 30).map((item) => ({
    id: `artifact-${item.id}`,
    type: item.type,
    label: item.name,
    tab: tabForType(item.type),
    artifactId: item.id,
    keywords: [item.type],
  }));
  const help = HELP_TOPICS.map((topic) => ({
    id: `help-${topic.id}`,
    type: "Help",
    label: topic.title,
    action: "help-topic",
    topicId: topic.id,
    keywords: topic.keywords,
  }));
  return [...commands, ...artifacts, ...help];
}

export function searchCommandItems(items, query, limit = 8) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return items.slice(0, limit);
  return items
    .map((item) => ({ item, score: commandScore(item, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function aboutMetadata() {
  return {
    product: "QuackViz",
    appVersion: APP_VERSION,
    buildDate: BUILD_DATE,
    releaseChannel: RELEASE_CHANNEL,
    localFirst: true,
  };
}

function recent(type, item, updatedAt) {
  return { id: item.id, type, name: item.name || item.title || item.tableName, updatedAt: updatedAt || "" };
}

function tabForType(type) {
  return {
    "Data source": "data",
    Query: "sql",
    Visualization: "visualize",
    Dashboard: "dashboard",
    Report: "report",
  }[type] || "data";
}

function commandScore(item, query) {
  const label = item.label.toLowerCase();
  const type = item.type.toLowerCase();
  const keywords = (item.keywords || []).join(" ").toLowerCase();
  if (label === query) return 100;
  if (label.startsWith(query)) return 70;
  if (label.includes(query)) return 50;
  if (type.includes(query)) return 30;
  if (keywords.includes(query)) return 20;
  return 0;
}
