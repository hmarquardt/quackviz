# Manual Safari Checklist

Safari manual validation has not been performed because interactive Safari control is unavailable in the agent execution environment. Playwright WebKit is useful coverage but is not a Safari result.

Record Safari version, macOS version, date, deployment URL, and reviewer. Use a clean profile, then verify:

- [ ] Startup completes without console errors
- [ ] Inline favicon and beta.3 version appear
- [ ] Showcase gallery opens and loads JSON
- [ ] Local CSV imports through the visible file picker
- [ ] Schema and preview are correct
- [ ] SQL executes in DuckDB-WASM
- [ ] Real ECharts line and bar charts render
- [ ] Local blank-style MapLibre point map renders
- [ ] Visualization saves and appears on a dashboard
- [ ] Workspace metadata survives reload
- [ ] Local source honestly shows “needs re-import” after reload
- [ ] Workspace backup downloads
- [ ] Help and About dialogs work and restore focus
- [ ] Sidebar expands and collapses
- [ ] Three notifications remain readable and do not cover controls
- [ ] Footer is reachable and shows the canonical version

Capture screenshots and record failures in `usability-findings.md`. Do not mark Safari supported from this checklist until a named reviewer completes it.

