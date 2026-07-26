# Browser Support

Last verified: 2026-07-25 with Playwright 1.61.1.

| Feature | Chromium | Firefox | Playwright WebKit | Safari |
| --- | --- | --- | --- | --- |
| Startup | supported | supported | supported with limitations | not tested |
| DuckDB-WASM | supported | supported | supported | not tested |
| Local file import | supported | supported | supported with limitations | not tested |
| URL import | supported | supported | supported with limitations | not tested |
| IndexedDB | supported | supported | supported with limitations | not tested |
| ECharts | supported with real line/bar coverage | supported with real line/bar coverage | supported with real line/bar coverage | not tested |
| MapLibre | supported with real four-type point-map coverage | supported with real four-type point-map coverage | supported with real four-type point-map coverage | not tested |
| Downloads and packages | supported | supported | supported with limitations | not tested |
| Offline core | supported | supported with limitations | supported with limitations | not tested |

Playwright WebKit is not equivalent to macOS Safari. Safari 18.6 is installed, but manual validation was not performed because interactive Safari operation is unavailable in the agent execution environment. Required DuckDB-WASM, ECharts, and MapLibre files are local; remote AI, URL imports, and remote basemaps remain network-dependent.

Final beta.3 totals on 2026-07-25 were Chromium 41 passed; Firefox 37 passed and 4 skipped; WebKit 37 passed and 4 skipped. The skips are dedicated Chromium release scenarios, not failures of the cross-browser real renderer matrices.

## Cross-Browser Skip Review

The following four tests are skipped in both Firefox and WebKit (eight skips total):

| Test | Why skipped | Classification | Equivalent coverage | User-visible consequence | Review |
| --- | --- | --- | --- | --- | --- |
| Authoritative no-AI workflow | This long release orchestration owns Chromium-only download and reload assertions. | Test organization | Firefox/WebKit run real JSON/CSV import, DuckDB query, line/bar rendering, dashboard persistence, and package component tests. | None identified in covered features. | Reconsider after splitting orchestration from capability checks. |
| Offline and nested-path workflow | The dedicated server/request interception harness is Chromium-only. | Test-environment | Static path checks are browser-neutral; normal Firefox/WebKit startup uses local vendor assets. | Offline/nested-path confidence is strongest in Chromium. | Keep as a narrow beta limitation. |
| Dedicated Parquet workflow | The release fixture lifecycle and download cleanup are Chromium-only. | Test organization | Parquet unit/self-tests run; cross-browser DuckDB imports use CSV/JSON. | Firefox/WebKit Parquet E2E confidence is lower. | Candidate for a focused post-beta cross-browser test. |
| Legacy MapLibre smoke | Superseded Chromium-specific smoke test remains gated. | Test organization | The real four-type MapLibre matrix, including point and clustered point maps, runs in Firefox and WebKit. | None for the covered point-map modes. | Remove the legacy restriction when the smoke test is retired. |

These skips do not establish Safari support. Manual Safari validation remains a beta gate; use [the checklist](manual-safari-checklist.md).
