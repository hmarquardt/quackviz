# QuackViz

QuackViz is a static, browser-local DuckDB-WASM and Apache ECharts analytical workspace. Current application version: `0.5.0`, build date `2026-07-23`.

## Current Milestone: Reports

QuackViz now supports section-based report authoring on top of the existing import, profiling, SQL, visualization, AI, dashboard, filter, persistence, diagnostics, and export foundation.

The report workflow is:

```text
queries and visualizations
-> dashboards and findings
-> report sections
-> narrative editing
-> validated export
-> portable analytical artifact
```

Maps, geographic layers, native PDF generation, PowerPoint generation, server-side publishing, and multi-user collaboration are not implemented.

## Run Locally

No npm install and no build step are required:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/`. Use a static server instead of `file://` because browser module and worker restrictions can block DuckDB-WASM and ES modules.

## Run Tests

Start the same static server, then open:

```text
http://localhost:8080/tests/
```

The DOM-free module tests can also be run under Node. Automated tests use mocked/local data and do not make billable AI calls.

## Exact Dependency Versions

- Apache ECharts `6.0.0`
  - `https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.esm.min.js`
- DuckDB-WASM `1.33.1-dev57.0`
  - `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev57.0/+esm`

Pinned versions are centralized in `js/constants.js`, shown in Debug, reflected in the persistent footer, and included in workspace, dashboard, AI, and report export metadata.

## Report Data Model

Reports are stored in `workspace.reports` and selected through `workspace.active.reportId`. Existing workspaces are migrated with an empty reports collection.

Each report includes:

- `id`, `version`, `name`, `title`, `subtitle`, `description`, timestamps, and creator metadata
- `settings` for theme inheritance, page size, orientation, SQL/provenance display, table row-count display, and static-versus-interactive HTML export preference
- `sections`, each with a stable section ID, source references, editable narrative content, snapshot metadata, and provenance
- `metadata` containing the canonical app version and build date

Deleting a report does not delete the underlying queries, visualizations, dashboards, or data sources.

## Supported Section Types

The report model supports:

- Cover
- Heading
- Text
- Finding
- KPI
- Visualization
- Dashboard snapshot
- Query table
- SQL
- Divider
- Appendix
- Methodology
- Data-source summary

Sections can be added, duplicated, removed, hidden, moved up/down, moved to the top/bottom, edited, and refreshed when dynamic.

## Refresh and Staleness

Dynamic sections resolve saved sources and refresh independently:

- Visualization sections resolve a saved visualization and its saved query.
- Dashboard snapshot sections resolve the referenced dashboard and refresh its cards through the dashboard runner.
- Query-table sections execute a saved query with a conservative row limit.
- KPI sections execute a saved query and warn when it returns more than one row.
- Data-source summary sections generate local metadata without raw source rows.

One failed section does not block the rest of the report. Report refresh uses a bounded concurrency limit and records status in Debug.

QuackViz report exports contain snapshots unless explicitly refreshed.

Sections preserve live source references and snapshot metadata. A section is marked stale when the referenced query, visualization, or dashboard changes after the snapshot.

## Narrative Editing

Report narrative is stored as editable text. The current renderer supports safe Markdown-lite paragraphs and code-friendly text containers; arbitrary HTML is not accepted as a report section format.

AI-generated narrative remains editable and is treated as untrusted text.

## AI Reports

The AI action catalog includes:

- Build report outline
- Draft report narrative
- Critique report

Added contracts:

- `quackviz-ai-report-outline`
- `quackviz-ai-report-narrative`
- `quackviz-ai-report-critique`

AI report output is validated for contract version, section types, existing source IDs, section count, narrative length, executable content, and unsupported fields. AI narrative validation warns about causal or statistical-significance claims that require supporting evidence.

AI changes require user review. QuackViz does not automatically create, save, or execute report content from AI output.

## Claim Discipline

AI report prompts and validators are designed around these rules:

- Use only provided results and metadata.
- Avoid causal claims unless supported.
- Avoid statistical-significance claims unless a test result is provided.
- Distinguish observation from inference.
- Mention truncation, missing data, and incomplete periods where relevant.
- Avoid inventing business context.

## HTML Export

HTML report export creates a self-contained static document with:

- Embedded CSS
- Report title, subtitle, sections, tables, captions, and metadata
- Embedded snapshot images when available
- Canonical app version and build date
- Print-friendly styles

HTML exports omit API keys, active AI settings, raw source tables, external scripts, and the editable QuackViz application UI. Interactive ECharts export remains disabled; static snapshots are the default.

## Markdown Export

Markdown export includes:

- Report title and subtitle
- Generation metadata and QuackViz version
- Section headings and narrative
- Tables
- SQL source placeholders when SQL visibility is enabled
- Image data URIs when section snapshots contain images

Markdown is portable text; image handling depends on whether the section has an embedded snapshot image.

## Report Package Export

The package export currently produces a portable JSON object containing the files that would form a report package:

```text
report/index.html
report/report.md
report/manifest.json
```

The manifest uses:

```json
{
  "format": "quackviz-report-package",
  "formatVersion": 1,
  "generatedBy": {
    "app": "QuackViz",
    "appVersion": "0.5.0",
    "buildDate": "2026-07-23"
  }
}
```

No ZIP dependency is added in this milestone, so the UI downloads the package-file manifest as JSON rather than a binary `.zip`. Raw source data is excluded by default.

## Print and PDF Workflow

The Report workspace includes `Print / Save as PDF`, which invokes the browser print dialog.

“Save as PDF” uses the browser print system; QuackViz does not generate native PDF files in this milestone.

The print stylesheet hides application controls, keeps sections readable, repeats table headers where browsers support it, and defaults to print-friendly output.

## Report Import and Export

Report JSON export uses:

```json
{
  "format": "quackviz-report",
  "formatVersion": 1,
  "exportedBy": {
    "app": "QuackViz",
    "appVersion": "0.5.0",
    "buildDate": "2026-07-23",
    "exportedAt": "..."
  },
  "report": {},
  "referencedVisualizations": [],
  "referencedQueries": [],
  "referencedDashboards": []
}
```

Imports validate future versions, normalize reports, remap colliding report IDs, preserve section source references, and exclude API keys. Referenced query, visualization, and dashboard definitions are included in export metadata but are not fully merged on import yet.

## Broken Sources

Broken or unavailable report sections remain visible. A section can become broken when a query, visualization, dashboard, source table, SQL query, chart spec, or snapshot is missing or invalid. The report preview shows the section state and keeps any previous snapshot unless refreshed.

## Dashboards and Filters

The dashboard milestone remains functional. Dashboards support saved visualization cards, CSS-grid layout, bounded coordinated refresh, in-memory result caching, shared filters, local filters, dashboard package export/import, snapshot HTML export, AI dashboard proposals, and AI dashboard critique.

Dashboard filters are applied only when a compatible field binding exists.

QuackViz does not silently rewrite arbitrary SQL to force dashboard filters.

## Privacy and AI Safety

OpenRouter API keys remain localStorage-only and are excluded from workspace export, dashboard export, report export, snapshots, Debug, and AI history. AI output is treated as untrusted input. AI-generated SQL still passes through the existing SQL safety pipeline before preview or use.

QuackViz does not silently execute AI-generated SQL.

## Footer and Versioning

The persistent footer shows the canonical app version and build date. Debug, workspace metadata, dashboard exports, dashboard snapshots, report metadata, HTML export, Markdown export, report package manifests, and AI diagnostics use the same constants.

The Report workspace includes a `Copy report metadata` action. The Dashboard toolbar retains `Copy deployment info`.

## Accessibility and Performance

Report outline controls are keyboard-accessible buttons. Sections expose headings, table captions, image alt text, status text, and non-color-only state labels. Reduced-motion settings continue to flow through chart rendering paths.

The report workspace is designed for dozens of sections without refreshing queries on every narrative edit. Dynamic refresh is explicit and bounded.

## Current Limitations

- Chart image capture for report visualization sections currently uses a static placeholder snapshot unless a section already has an image data URL.
- Report package export is a JSON package-file representation, not a binary ZIP.
- Report JSON import does not fully merge referenced queries, visualizations, or dashboards into the workspace yet.
- Markdown export includes SQL source placeholders rather than full SQL text unless the section snapshot/source has been enriched.
- Native PDF generation is not implemented; use browser print.
- AI report actions are validated, but automatic report creation from AI outline proposals is not wired as a one-click flow yet.
- Browser self-test requires a static server and CDN access for DuckDB/ECharts runtime paths.

## Next Milestone

Recommended focus:

1. Add real chart-image capture from ECharts instances into report snapshots.
2. Add a pinned ZIP dependency or native multi-file download flow for binary report packages.
3. Fully merge referenced queries, visualizations, and dashboards during report import.
4. Add richer Markdown-lite editing controls and source-inspection UI.
5. Wire approved AI report outlines into an unsaved editable report draft.
