# Testing

Browser unit tests live under `tests/`.

Playwright end-to-end tests live under `e2e/` and start QuackViz with:

```sh
python3 -m http.server 8080
```

The E2E suite mocks AI provider responses and fails on unexpected page errors, fatal console errors, required asset failures, and DuckDB initialization failures.

`npm run release:check` runs static version/vendor-integrity checks and the complete Chromium, Firefox, and WebKit suite. Required scenarios use real DuckDB-WASM, local files, Parquet, downloads, offline request blocking, and nested-path hosting. The real renderer matrices use imported showcase data and fresh production ECharts or MapLibre instances; mocked coordination tests are not counted as renderer proof.

`npm run rc:check` adds `npm audit` and showcase asset validation before the release gate. Deployment verification, clean/pushed Git state, visual review, and Safari remain manual RC gates.

`npm run test:e2e:axe` runs automated accessibility checks and reports all severities by browser and screen. Serious and critical findings fail the gate; this is not a claim of independent WCAG conformance.

The final 2026-07-25 `npm run rc:check` run exited 0:

- Browser unit tests: 284 passed.
- In-app self-test: 150 passed.
- Chromium: 36 passed.
- Firefox: 32 passed, 4 skipped.
- WebKit: 32 passed, 4 skipped.
- Overall: 100 passed, 8 skipped, 0 failed, 0 flaky.
- Axe: 0 critical, serious, moderate, or minor findings on required screens.

The four skips in each non-Chromium project are the authoritative no-AI workflow, offline/nested-path workflow, dedicated Parquet workflow, and the older Chromium-specific MapLibre smoke. Cross-browser real JSON/DuckDB, line/bar ECharts, and four-type point-map matrices run separately without those skips.
