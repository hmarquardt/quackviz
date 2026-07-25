# Changelog

## 1.0.0-beta.2 - 2026-07-25

### Fixed

- Added Firefox and WebKit Playwright projects to the checked-in release suite.
- Narrowed the expected Firefox CORS diagnostic to the deliberate blocked-URL test.
- Preserved jsDelivr dependency origins during WebKit tests so DuckDB transitive ESM imports resolve correctly.
- Vendored DuckDB-WASM, ECharts, and MapLibre runtime assets for local core startup.
- Removed invalid properties from blank MapLibre styles and point layers.
- Added missing accessible labels, keyboard access for AI context output, and a valid notification status role.

### Added

- Real Chromium release gates for local CSV, Parquet, ECharts, MapLibre, offline operation, and nested-path hosting.
- Axe release checks for the primary application screens.
- Deterministic version and required vendor-hash preflight checks.

### Verified

- Chromium baseline: 22 passed.
- Firefox baseline before correction: 21 passed, 1 expected-CORS console mismatch.
- WebKit baseline before correction: 22 failed because redirected DuckDB ESM imports resolved against the local test origin.

### Known Limitations

- Safari has not been manually validated; Playwright WebKit is not equivalent to Safari.
- Firefox and WebKit renderer coordination is covered, but the required real WebGL renderer gate remains Chromium-specific.

## 1.0.0-beta.1 - 2026-07-25

### Added

- Public-beta product shell with beta badge, welcome dialog, guided workflow checklist, recent-work shortcuts, command palette, About dialog, and offline in-app help.
- Starter SQL query shortcuts for selected data sources.
- Product-focused browser tests for onboarding state, recent items, command search, help topics, and About metadata.
- Local documentation structure under `docs/` and a public-beta checklist.

### Changed

- Top-level navigation now uses product-stage labels: Data, Analyze, Visualize, Dashboards, Reports, AI, and More.
- Debug, recovery, fixture loading, package tooling, templates, and extension validation are grouped under More instead of competing with the primary workflow.
- AI settings now introduce privacy basics before exposing advanced context and generation controls.
- README is reorganized around user workflows instead of milestone history.

### Fixed

- First-run users now see a clear path from adding data to analysis, visualization, dashboards/reports, and export.
- Footer and metadata now use the beta application version consistently.

### Known Limitations

- This is a beta release: browser memory limits, URL CORS, local-file re-import, pinned CDN runtime dependencies, and browser differences remain visible limitations.
- Visual regression baselines and automated axe checks are not yet fully integrated.

## 0.10.0 - 2026-07-24

### Added

- Primary Data-tab import workspace for local CSV, JSON-array, NDJSON/JSONL, and Parquet files.
- Explicit URL import workflow with scheme validation, CORS/network failure messaging, and cancellation.
- Inline SVG data-URI favicon and concise application description metadata.
- Browser tests for import format detection, table-name generation, import SQL, URL validation, and source metadata hydration.
- Playwright coverage for empty import state, local CSV/JSON/NDJSON import, drag-and-drop, multiple-file import, URL import failure modes, favicon, and Debug-only fixture placement.

### Changed

- The bundled sales fixture moved out of the normal Data Sources panel and into Debug > Developer and Test Data.
- Source metadata now preserves import type, file format, size, URL metadata, import options, sample rows, and unavailable state after reload.
- The visualization builder is hidden outside Visualize mode to reduce first-use clutter.

### Fixed

- New users are no longer presented with the bundled sales fixture as the only apparent data-ingestion path.

### Known Limitations

- Local DuckDB tables are still memory-only after reload; saved metadata is restored and marked unavailable until the source is re-imported.
- URL imports remain subject to the remote server's browser CORS policy.

## 0.9.0 - 2026-07-24

### Added

- Operational hardening primitives for performance spans, bounded task lifecycle tracking, startup capability checks, workspace validation, recovery checkpoints, recovery journal entries, worker message validation, vendor-manifest diagnostics, and sanitized support bundles.
- Development release gate script and README release checklist.
- Browser tests covering the new hardening modules.

### Changed

- Debug metadata now includes startup, performance, worker, recovery, workspace-validation, and vendor-manifest status.
- Self-test coverage now includes capability, vendor, worker, task, performance, validation, recovery, support-bundle, cache, renderer cleanup, and footer-version checks.

### Fixed

- No known regressions in the existing Playwright workflows.

### Known Limitations

- Runtime dependencies are still loaded from pinned CDN URLs in the authoring app. The vendor manifest reports this honestly; full local asset vendoring remains a release-readiness follow-up.
- Worker offloading is limited to a versioned operational worker contract and hash/echo tasks. Existing DuckDB execution remains in DuckDB-WASM's worker path.
