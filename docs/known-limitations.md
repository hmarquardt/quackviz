# Known Limitations

Last verified: 2026-07-26.

| Area | Description | Browsers | Workaround | Severity | Status |
| --- | --- | --- | --- | --- | --- |
| Persistence | Local DuckDB table data is memory-only after reload | All | Re-import the source file; saved analysis metadata remains | High | Planned |
| URL import | Cross-origin loading depends on the remote server's CORS policy | All | Use a CORS-enabled URL or download and import locally | Medium | Inherent browser constraint |
| Offline | Core local analysis works offline; AI, external URL imports, and remote basemaps do not | All | Use local files and a blank map style | Medium | By design |
| Large data | Browser memory limits vary by device and browser | All | Use reduced import modes and aggregate results | Medium | Ongoing |
| Maps | Remote basemaps require network; image export can be blocked by tile CORS | All | Use a blank/local map and local boundaries | Medium | Ongoing |
| Safari | Safari has not been manually verified; Playwright WebKit is not Safari | Safari | Use current Chromium or Firefox for evaluated workflows | High | Planned |
| Accessibility | Automated axe checks cover required screens, but independent WCAG conformance is not established | All | Report remaining issues through the documented support workflow | Medium | Ongoing |
| PDF | Reports use browser Print / Save as PDF | All | Use the browser print dialog | Low | By design |
| Sharing | No server-backed publishing or collaboration | All | Export a standalone app or backup | Low | Out of scope |
| Charts | The stable selector currently exposes line and vertical bar charts | All | Use SQL summaries with the stable types | Medium | Planned |
| World choropleth | The built-in world boundary has six simplified demonstration geometries | All | Use country centroid point maps | High | Planned |
| Showcase hero | The requested scatter, heatmap, KPI-row, and global choropleth hero cannot be built from the current stable line/bar and illustrative-boundary surface | All | Use the documented line, bar, and point-map examples | High | RC blocker |
