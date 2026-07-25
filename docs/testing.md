# Testing

Browser unit tests live under `tests/`.

Playwright end-to-end tests live under `e2e/` and start QuackViz with:

```sh
python3 -m http.server 8080
```

The E2E suite mocks AI provider responses and fails on unexpected page errors, fatal console errors, required asset failures, and DuckDB initialization failures.

`npm run release:check` runs static version/vendor-integrity checks and the complete Chromium, Firefox, and WebKit suite. Required Chromium scenarios use real DuckDB-WASM, local files, Parquet, ECharts, MapLibre, downloads, offline request blocking, and nested-path hosting. Coordinated renderer tests may still use isolated mocks; those tests are not counted as real-renderer proof.

`npm run test:e2e:axe` runs automated accessibility checks. Serious and critical axe findings fail the gate; this is not a claim of independent WCAG conformance.
