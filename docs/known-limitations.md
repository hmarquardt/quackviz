# Known Limitations

Last verified: 2026-07-25.

| Area | Description | Browsers | Workaround | Severity | Status |
| --- | --- | --- | --- | --- | --- |
| Persistence | Local DuckDB table data is memory-only after reload | All | Re-import the source file; saved analysis metadata remains | High | Planned |
| URL import | Cross-origin loading depends on the remote server's CORS policy | All | Use a CORS-enabled URL or download and import locally | Medium | Inherent browser constraint |
| Offline | Runtime libraries are loaded from pinned CDNs | All | Use a network connection | High | Planned |
| Large data | Browser memory limits vary by device and browser | All | Use reduced import modes and aggregate results | Medium | Ongoing |
| Maps | Remote basemaps require network; image export can be blocked by tile CORS | All | Use a blank/local map and local boundaries | Medium | Ongoing |
| Safari | Safari has not been manually verified; Playwright WebKit is not Safari | Safari | Use current Chromium or Firefox for evaluated workflows | High | Planned |
| Accessibility | Automated axe release coverage is not installed | All | Keyboard and semantic tests cover selected flows | Medium | Planned |
| PDF | Reports use browser Print / Save as PDF | All | Use the browser print dialog | Low | By design |
| Sharing | No server-backed publishing or collaboration | All | Export a standalone app or backup | Low | Out of scope |
