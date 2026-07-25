# QuackViz

QuackViz Beta is a static, browser-local analytical workspace for loading local data, querying it with DuckDB-WASM, and turning results into charts, maps, dashboards, reports, and portable local packages.

Five import-ready public demonstration datasets, their attribution, and a short evaluation workflow are documented in the [showcase guide](docs/showcase.md).

Current version: `1.0.0-beta.2`
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

Current limitations are documented in [Known limitations](docs/known-limitations.md) and surfaced in the in-app Help. See [Feature status](docs/feature-status.md) for the verified product inventory and [Browser support](docs/browser-support.md) for the cross-browser matrix.

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

QuackViz requires modern browser support for ES modules, WebAssembly, Web Workers, IndexedDB, Web Crypto, File API, Blob URLs, Canvas, and WebGL for maps. Chromium is the primary real-renderer release browser. Firefox and WebKit run the coordinated application suite with browser-specific limitations documented separately.

## Running Tests

Browser unit tests:

```text
http://localhost:8080/tests/
```

Playwright is development-only tooling. The deployed QuackViz application remains a static, no-build browser application.

Install development dependencies:

```sh
npm install
npx playwright install chromium firefox webkit
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
npm run rc:check
```

Traces, screenshots, and videos are retained for failures under `test-results/`; the HTML report is written to `playwright-report/`.

The final beta qualification run on 2026-07-25 passed 100 of 108 Playwright cases with 8 documented Firefox/WebKit skips, no failures, and no flaky tests. Automated RC checks are green, but the release remains beta because the requested showcase hero requires chart and boundary capabilities that are not currently stable.

## Architecture

See [docs/architecture.md](docs/architecture.md).

Format contracts and module boundaries remain versioned in source constants and export metadata. Runtime dependency versions are centralized in `js/constants.js`, shown in Debug, reflected in the footer, and included in exports.

## Dependency Versions

- Apache ECharts `6.1.0`
- DuckDB-WASM `1.33.1-dev57.0`
- MapLibre GL JS `5.24.0`
- TopoJSON Client `3.1.0`
- JSZip `3.10.1`

Required runtime files are vendored under `vendor/`; normal startup does not use a public runtime CDN.
The vendor tree is approximately 78 MB. Most of that footprint is the DuckDB-WASM MVP and exception-handling binaries retained for browser capability fallback; no browser binaries, generated caches, or source maps are included.

## Known Limitations

- Browser memory limits apply to large files.
- Local DuckDB tables are memory-only after reload and may need re-import.
- URL import depends on CORS.
- Remote AI requests, URL imports, and remote map tiles still require network access.
- AI requires an external OpenRouter account and explicit configuration.
- No remote databases, streaming, authentication, collaboration, cloud synchronization, or server-backed publishing are implemented.
- Automated axe checks release-gate serious and critical findings; independent WCAG conformance has not been established.

## Roadmap

Near-term focus should stay on beta hardening: Safari validation, visual-regression baselines, and cross-browser renderer behavior.

## License

See [LICENSE](LICENSE).
