# Browser Support

Last verified: 2026-07-25 with Playwright 1.61.1.

| Feature | Chromium | Firefox | Playwright WebKit | Safari |
| --- | --- | --- | --- | --- |
| Startup | supported | supported | supported with limitations | not tested |
| DuckDB-WASM | supported | supported | supported with limitations | not tested |
| Local file import | supported | supported | supported with limitations | not tested |
| URL import | supported | supported | supported with limitations | not tested |
| IndexedDB | supported | supported | supported with limitations | not tested |
| ECharts | supported with mocked release coverage | supported with mocked release coverage | supported with limitations | not tested |
| MapLibre | supported with mocked release coverage | supported with mocked release coverage | supported with limitations | not tested |
| Downloads and packages | supported | supported | supported with limitations | not tested |
| Offline core | not supported | not supported | not supported | not tested |

Playwright WebKit is not equivalent to macOS Safari. The 2026-07-25 baseline exposed a redirected ESM dependency-origin difference; the test harness now preserves the CDN origin explicitly. Runtime dependencies remain CDN-pinned, so offline analytical startup is not supported.
