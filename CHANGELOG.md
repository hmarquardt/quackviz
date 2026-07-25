# Changelog

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
