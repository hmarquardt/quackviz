# Architecture

QuackViz is a static, no-build browser application using plain HTML, CSS, and ES modules.

Major local modules own import, DuckDB-WASM execution, workspace state, visualization specs, chart/map rendering, dashboards, reports, AI contracts, packaging, recovery, and diagnostics.

The production app does not require npm. Playwright is development-only tooling.
