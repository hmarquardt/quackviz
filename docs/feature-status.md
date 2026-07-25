# Feature Status

Last verified: 2026-07-25 with QuackViz 1.0.0-beta.2.

| Feature | UI location | Status | Browsers | Automated coverage | Known limitation |
| --- | --- | --- | --- | --- | --- |
| Local CSV import | Data | complete | Chromium, Firefox; WebKit under validation | `e2e/data-import.spec.js` | Source file must be selected again after reload |
| Local JSON and NDJSON import | Data | beta | Chromium, Firefox; WebKit under validation | `e2e/data-import.spec.js` | Nested values follow DuckDB JSON behavior |
| Local Parquet import | Data | beta | Unit covered; release E2E missing | `tests/import.test.js` | Real Parquet release fixture is not yet checked in |
| URL import | Data | beta | Chromium, Firefox; WebKit under validation | `e2e/data-import.spec.js` | Remote server CORS policy applies |
| SQL analysis | Analyze | complete | Chromium, Firefox; WebKit under validation | `e2e/import-query-visualize.spec.js` | Loaded source data is memory-only |
| Charts | Visualize | beta | Chromium, Firefox; WebKit under validation | Browser tests plus mocked renderer E2E | Normal selector currently exposes line and bar |
| Dashboards | Dashboards | beta | Chromium, Firefox; WebKit under validation | `e2e/dashboard.spec.js` | ECharts is mocked in current E2E fixture |
| Reports | Reports | beta | Chromium, Firefox; WebKit under validation | `e2e/report.spec.js` | Browser print provides PDF; no native PDF |
| Maps | Visualize, Dashboards, Reports | experimental | Chromium, Firefox; WebKit under validation | `e2e/map.spec.js` with mocked MapLibre | Real WebGL release scenario pending |
| AI augmentation | AI | beta | Browser independent when provider is reachable | Unit tests and mocked provider | OpenRouter required; SQL never runs silently |
| Portable packages | More | beta | Chromium, Firefox; WebKit under validation | `e2e/packaging.spec.js` | Standalone real-file release test pending |
| Recovery and safe mode | More | beta | Chromium, Firefox; WebKit under validation | `e2e/release-hardening.spec.js` | Common metadata failures only |
| Developer fixtures and contract tools | More | developer-only | Chromium, Firefox, WebKit | Smoke and unit tests | Not a production workflow |

Statuses describe visible, tested behavior. Module existence alone does not qualify a feature as complete.
