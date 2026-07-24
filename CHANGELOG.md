# Changelog

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
