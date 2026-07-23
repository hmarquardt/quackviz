# QuackViz

QuackViz is a static, browser-local DuckDB-WASM and Apache ECharts analytical workspace. Current application version: `0.4.0`, build date `2026-07-23`.

## Current Milestone: Dashboards

QuackViz now supports local dashboard workspaces built from saved SQL-backed visualizations.

The dashboard workflow is:

```text
tables and profiles
-> queries
-> visualizations
-> dashboard layout
-> shared filters
-> coordinated DuckDB execution
-> ECharts rendering
-> saved analytical workspace
```

Maps, geographic layers, PDF reports, server sharing, and multi-user collaboration are not implemented.

## Run Locally

No npm install and no build step are required:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/`.

## Run Tests

Start the same static server, then open:

```text
http://localhost:8080/tests/
```

The module tests also run under Node for DOM-free coverage.

## Exact Dependency Versions

- Apache ECharts `6.0.0`
  - `https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.esm.min.js`
- DuckDB-WASM `1.33.1-dev57.0`
  - `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev57.0/+esm`

Pinned versions are centralized in `js/constants.js`, shown in Debug, and reflected in the footer and exports.

## Dashboard Data Model

Dashboards are stored in `workspace.dashboards` and selected through `workspace.active.dashboardId`. A dashboard card references a saved visualization by stable ID; it does not duplicate query or visualization definitions.

Each dashboard includes:

- `layout`: visualization cards with `x`, `y`, `width`, `height`, title flags, refresh settings, and local filters
- `filters`: shared dashboard filters
- `settings`: manual refresh mode, filter bar visibility, compact-card flags, and concurrency limit
- `provenance`: user or AI origin metadata

Existing workspaces without dashboards are migrated with an empty `dashboards` array.

## Layout Model

The dashboard canvas uses CSS Grid with a 12-column desktop layout. Cards support button-based movement and resizing:

- Move left/right/up/down
- Increase/decrease width
- Increase/decrease height
- Duplicate card
- Remove card

Responsive layouts collapse cards on narrower screens. Drag-and-drop is intentionally not included in this milestone.

## Add Visualization Workflow

Create a dashboard, choose a saved visualization, and add it as a card. The same visualization may be added more than once. Deleting a dashboard does not delete underlying queries or visualizations.

## Refresh and Caching

The dashboard runner resolves each card’s visualization and query, applies compatible filters, validates SQL, executes through DuckDB, and returns per-card state:

- `idle`
- `loading`
- `ready`
- `error`
- `unavailable`
- `cancelled`

One failed card does not block the rest. Refresh uses a small concurrency limit and records dashboard refresh stats in Debug. Query results are cached in memory by query/filter/layout signature and invalidated on data reload or explicit refresh.

## Filters

Shared dashboard filters support category, multi-category, numeric/date ranges, boolean equality, null/not-null, and text contains. Card-local filters use the same model internally.

Dashboard filters are applied only when a compatible field binding exists.

QuackViz does not silently rewrite arbitrary SQL to force dashboard filters. The initial implementation safely wraps result queries:

```sql
SELECT *
FROM (
  <original query>
) AS __quackviz_dashboard
WHERE <compatible predicates>
```

If a field is not present in a card result, the filter is skipped and reported.

## Import and Export

Dashboard package export uses:

```json
{
  "format": "quackviz-dashboard",
  "formatVersion": 1,
  "exportedBy": {
    "app": "QuackViz",
    "appVersion": "0.4.0",
    "buildDate": "2026-07-23",
    "exportedAt": "..."
  },
  "dashboard": {},
  "visualizations": [],
  "queries": []
}
```

Packages include referenced visualizations and queries, omit API keys and result datasets, validate future versions, and remap IDs on collision.

## Static Snapshot Export

Dashboard snapshot export creates a self-contained non-interactive HTML snapshot with dashboard title, timestamp, app version/build date, card status, query titles, optional SQL, and runtime metadata. It does not include API keys, source tables, DuckDB databases, or executable AI content.

## AI Dashboards

The AI action catalog includes:

- Build a dashboard
- Critique dashboard

Added contracts:

- `quackviz-ai-dashboard`
- `quackviz-ai-dashboard-critique`

AI dashboard output is validated for contract version, existing visualization IDs, unsafe SQL, visualization specs, layout bounds, excessive card counts, executable content, and unsupported fields. AI dashboard proposals require user approval; QuackViz does not automatically execute or save AI dashboard output.

## Existing AI Safety

OpenRouter API keys remain localStorage-only and are excluded from workspace export, dashboard export, snapshot export, Debug, and AI history. AI-generated SQL still passes through the existing SQL safety pipeline before preview.

## Footer and Deployment Info

The persistent footer shows the canonical app version and build date. Debug, workspace metadata, dashboard packages, snapshots, and AI diagnostics use the same constants. The Dashboard toolbar includes a “Copy deployment info” action with app version, build date, workspace ID, active dashboard ID, and page URL.

## Accessibility and Performance

Dashboard controls are keyboard-accessible buttons and selects. Cards show text state, runtime, row count, and refreshed time. Reduced-motion settings are passed through the chart compiler/renderer. The runner avoids unbounded concurrent queries and keeps result caches in memory only.

## Current Limitations

- Dashboard filters work against result fields; source-column filtering for arbitrary SQL requires explicit future bindings.
- Date-range presets are not yet a rich dedicated control; date filters are supported by the filter model and wrapping layer.
- PNG export per dashboard card is not wired in this milestone UI.
- Browser self-test requires a static server and CDN access.
- Import/export for the broader workspace remains limited compared with the dashboard package export.

## Next Milestone

Recommended focus:

1. Add explicit filter-binding metadata to builder-generated queries.
2. Add richer filter UI for date ranges and per-card local filters.
3. Add card PNG export using the chart instance manager.
4. Add approved AI dashboard creation from validated proposals.
5. Restore broader workspace import/export and visualization package exports.
