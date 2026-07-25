# QuackViz

QuackViz Beta is a static, browser-local analytical workspace for loading local data, querying it with DuckDB-WASM, and turning results into charts, maps, dashboards, reports, and portable local packages.

Current version: `1.0.0-beta.1`  
Build date: `2026-07-25`

## What It Does

Primary workflow:

```text
Add data
-> inspect
-> ask a question or write SQL
-> visualize
-> save
-> combine into a dashboard or report
-> export or share locally
```

QuackViz is local-first. It does not send usage analytics, does not upload data automatically, and does not require AI.

## Beta Status

This is a public-beta readiness build. Workspaces are stored in the browser, browser memory limits apply, and local files may need to be re-imported after reload. Backups are recommended for important work.

Current limitations are documented in [Troubleshooting](docs/troubleshooting.md) and surfaced in the in-app Help.

## Try It Locally

No build step is required for the production app:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/`.

Use a static server instead of `file://` because browser module, worker, WebGL, and DuckDB-WASM restrictions can block runtime loading.

## Load Your Data

Open Data and use:

- Choose files
- Drag and drop
- Import from direct URL

Supported formats:

- CSV
- JSON arrays of objects
- NDJSON / JSONL
- Parquet

URL imports are explicit and subject to the remote server's browser CORS policy. QuackViz cannot bypass CORS and does not proxy through a third party.

Local source data remains in the browser unless the user explicitly sends selected context to an external AI provider.

The bundled sales fixture is available under More > Developer and Test Data for tests, demos, and troubleshooting. It is not the primary data-loading workflow.

## First Analysis

After importing data, inspect the schema and preview rows. Open Analyze to use starter SQL queries for row previews, row counts, null counts, and numeric summaries, or write DuckDB SQL directly.

## Build A Visualization

Run a query, open Visualize, choose chart settings, then save the visualization. Saved visualizations can be added to dashboards and reports.

## Dashboards

Dashboards combine saved visualizations as cards. They support refresh, compatible filters, linked filtering where configured, maps, snapshots, and package export.

Cross-filter bindings apply only to targets with compatible field or parameter bindings.

## Reports

Reports arrange saved visualizations, dashboard snapshots, query tables, text, findings, KPIs, methodology, and source summaries into a narrative.

QuackViz report exports contain snapshots unless explicitly refreshed. Save as PDF uses the browser print system; QuackViz does not generate native PDF files in this milestone.

## Maps

Maps use MapLibre GL JS for point and region-based analysis. Imported user data remains local. Remote basemap providers receive tile requests, not imported datasets.

QuackViz does not silently fuzzy-match region names. Map image export may be limited by third-party tile-server CORS policies.

## AI

AI is optional and uses OpenRouter when configured.

Before sending an AI request, preview the context. Metadata-only mode is the default. Raw sample rows are opt-in. AI-generated SQL is treated as untrusted input and is not silently executed.

Standalone packages never include OpenRouter API keys.

## Export And Backup

QuackViz can export workspace backups, standalone analytical apps, dashboard packages, report packages, visualization packages, and snapshots.

Integrity hashes detect changed files but do not verify who created the package. External-data standalone apps require the user to provide compatible local data.

## Privacy

- No automatic telemetry
- No automatic uploads
- No automatic crash reports
- API keys are excluded from exports, logs, debug reports, and support bundles
- Support bundles exclude API keys and source data by default
- Remote basemaps may make tile requests

## Browser Requirements

QuackViz requires modern browser support for ES modules, WebAssembly, Web Workers, IndexedDB, Web Crypto, File API, Blob URLs, Canvas, and WebGL for maps. Chromium is the primary release browser. Firefox and WebKit smoke coverage may expose browser-specific limitations.

## Running Tests

Browser unit tests:

```text
http://localhost:8080/tests/
```

Playwright is development-only tooling. The deployed QuackViz application remains a static, no-build browser application.

Install development dependencies:

```sh
npm install
npx playwright install chromium
```

Run E2E:

```sh
npm run test:e2e
```

Useful commands:

```sh
npm run test:e2e:ui
npm run test:e2e:headed
npm run test:e2e:debug
npm run test:e2e:report
npm run release:check
```

Traces, screenshots, and videos are retained for failures under `test-results/`; the HTML report is written to `playwright-report/`.

## Architecture

See [docs/architecture.md](docs/architecture.md).

Format contracts and module boundaries remain versioned in source constants and export metadata. Runtime dependency versions are centralized in `js/constants.js`, shown in Debug, reflected in the footer, and included in exports.

## Dependency Versions

- Apache ECharts `6.0.0`
- DuckDB-WASM `1.33.1-dev57.0`
- MapLibre GL JS `5.24.0`

## Known Limitations

- Browser memory limits apply to large files.
- Local DuckDB tables are memory-only after reload and may need re-import.
- URL import depends on CORS.
- Runtime dependencies are still pinned CDN dependencies in the authoring app; the vendor manifest reports this honestly.
- AI requires an external OpenRouter account and explicit configuration.
- No remote databases, streaming, authentication, collaboration, cloud synchronization, or server-backed publishing are implemented.
- Automated axe and full visual-regression baselines are not yet complete.

## Roadmap

Near-term focus should stay on beta hardening: documentation accuracy, accessibility validation, visual-regression baselines, local dependency vendoring, and cross-browser behavior.

## License

See [LICENSE](LICENSE).
