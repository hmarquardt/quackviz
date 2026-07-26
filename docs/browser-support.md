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
