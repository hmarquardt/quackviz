# QuackViz

QuackViz is a static, browser-local visual analytics studio built around DuckDB-WASM and Apache ECharts 6. It imports local data, profiles tables, runs SQL in the browser, and saves SQL-backed visualization artifacts.

## MVP Capabilities

- Import CSV, JSON, NDJSON, and Parquet into local DuckDB-WASM.
- Browse tables, row counts, columns, DuckDB types, samples, and profile statistics.
- Run SQL with Ctrl/Cmd+Enter, show runtime and row counts, copy SQL, and save queries.
- Build SQL-backed charts for vertical bar, horizontal bar, grouped bar, stacked bar, line, area, scatter, bubble, pie, donut, heatmap, histogram, and box plot.
- Save visualizations as durable artifacts that reference saved queries.
- Persist workspace metadata in IndexedDB and settings/API key in localStorage.
- Export/import workspace JSON, export visualization-spec JSON, and export charts as PNG.
- Generate deterministic local recommendations.
- Request OpenRouter AI proposals as validated JSON containing SQL plus QuackViz specs.
- Switch dark/light themes and inspect debug/capability information.

## Architecture

The central model is:

```text
data source -> SQL query -> result dataset -> visualization specification -> ECharts rendering
```

The canonical visualization format is a constrained QuackViz JSON spec. Raw ECharts options are produced only by `js/viz-compiler.js`.

## File Structure

```text
index.html
css/app.css
js/app.js
js/state.js
js/db.js
js/import.js
js/profile.js
js/query.js
js/query-builder.js
js/viz-spec.js
js/viz-compiler.js
js/viz-renderer.js
js/viz-recommend.js
js/ai.js
js/storage.js
js/workspace.js
js/ui.js
js/utils.js
samples/sales.csv
samples/telemetry.csv
vendor/echarts/
vendor/duckdb/
```

## Run Locally

No install or build is required. Serve the directory with any static server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

Push this repository to GitHub, enable Pages for the main branch root, and open the published URL. The app is static and backend-free. DuckDB-WASM and ECharts are currently loaded from pinned CDN URLs, so Pages deployments need outbound browser access to jsDelivr.

## Dependency Versions

- Apache ECharts `6.0.0`, loaded from `https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.min.js`
- DuckDB-WASM `1.33.1-dev57.0`, loaded from `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev57.0/+esm`

The `vendor/` directories are reserved for local vendoring of these pinned assets.

## Privacy Model

Imported data is processed in the browser. Workspace metadata, saved queries, visualization specs, and cached profile metadata are stored locally. Large source datasets are not redundantly stored in IndexedDB by QuackViz.

## AI Data Sharing

AI is disabled by default. When enabled, QuackViz sends schema/profile metadata to OpenRouter. Raw sample rows are not sent by default. The API key is stored only in localStorage. AI SQL is validated as analytical `SELECT`/`WITH` SQL, checked with `EXPLAIN`, previewed with a limit, and never silently saved or executed as a durable artifact.

## Workspace Format

```js
{
  version: 1,
  dataSources: [],
  queries: [],
  visualizations: [],
  dashboards: [],
  active: {
    dataSourceId: null,
    queryId: null,
    visualizationId: null,
    dashboardId: null
  },
  settings: {}
}
```

`dashboards` is reserved for the next product stage.

## Visualization Spec Format

Specs are versioned, JSON-serializable, validated, and compiled into ECharts options:

```json
{
  "version": 1,
  "type": "line",
  "title": "Monthly revenue",
  "dataset": { "queryId": "query_monthly_revenue" },
  "encoding": {
    "x": { "field": "month", "dataType": "date", "label": "Month" },
    "y": [{ "field": "revenue", "dataType": "number", "label": "Revenue" }],
    "series": null
  },
  "options": { "smooth": true, "legend": true, "tooltip": "axis", "zoom": true }
}
```

## Current Limitations

- Imported DuckDB tables exist for the current page session; reload restores saved metadata, queries, and visualizations, but source files may need to be imported again unless the browser/DuckDB OPFS setup retains them.
- AI repair is represented by the same structured proposal path; a dedicated repair button can be added next.
- The manual builder covers common SQL shaping, not every possible ECharts encoding.

## Near-Term Roadmap

1. Dashboard layouts
2. Report generation
3. Map visualizations
4. Additional ECharts chart types
5. Shared filters
6. Parameterized queries
7. AI-generated dashboards
8. AI chart critique and refinement
9. Cross-filtering
10. Portable standalone HTML exports

