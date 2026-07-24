# QuackViz

QuackViz is a static, browser-local DuckDB-WASM, Apache ECharts, and MapLibre GL JS analytical workspace. Current application version: `0.8.0`, build date `2026-07-24`.

## Current Milestone: Portable Analytical Apps

QuackViz now includes a unified portable package format, standalone analytical app export, embedded artifact configuration, reusable templates, and declarative extension validation. The existing import, profiling, SQL, visualization, AI, dashboard, report, map, interaction, persistence, export, tests, diagnostics, and footer workflows remain in place.

The portable-app workflow is:

```text
workspace
-> select artifacts and data
-> validate references and privacy
-> create portable package
-> open in standalone or embedded mode
-> interact locally
-> optionally reopen in QuackViz for editing
```

Remote database connectivity, real-time streaming, collaboration, authentication, cloud synchronization, arbitrary callbacks, arbitrary JavaScript plugins, and server-hosted publishing are not implemented.

## Run Locally

No npm install and no build step are required:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/`. Use a static server instead of `file://` because browser module, WebGL, and DuckDB-WASM restrictions can block runtime loading.

## Run Tests

Start the same static server, then open:

```text
http://localhost:8080/tests/
```

The DOM-free module tests can also be run under Node. Automated tests use mocked/local data and do not make billable AI calls.

### Playwright End-to-End Tests

Playwright is development-only tooling. It is not required by the deployed QuackViz application, which remains a static no-build app that can run from a normal web server.

Install the test dependency and Chromium browser once:

```sh
npm install --save-dev @playwright/test
npx playwright install chromium
```

Run the E2E suite:

```sh
npm run test:e2e
```

Useful variants:

```sh
npm run test:e2e:ui
npm run test:e2e:headed
npm run test:e2e:debug
npm run test:e2e:report
```

The Playwright config starts QuackViz with:

```sh
python3 -m http.server 8080
```

and uses `http://127.0.0.1:8080` as the base URL. If a server is already running on port `8080`, Playwright reuses it instead of starting another instance.

Traces, screenshots, and videos are retained only for failures under `test-results/`; the HTML report is written to `playwright-report/`. These paths, along with `node_modules/`, are ignored by Git.

E2E tests mock OpenRouter responses and do not make real AI provider requests. ECharts and MapLibre are mocked at the browser module boundary for deterministic rendering checks; DuckDB-WASM remains real so import and SQL workflows are exercised through the actual database path.

The tests wait for explicit application-ready, DuckDB-ready, and render-ready state exposed by the app for automation. Unexpected page errors, fatal console errors, failed required local asset requests, DuckDB initialization failures, and worker initialization failures fail the test run. The small warning whitelist is documented in `e2e/fixtures.js`.

## Exact Dependency Versions

- Apache ECharts `6.0.0`
  - `https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.esm.min.js`
- DuckDB-WASM `1.33.1-dev57.0`
  - `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev57.0/+esm`
- MapLibre GL JS `5.24.0`
  - `https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/+esm`
  - `https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.css`

Pinned versions are centralized in `js/constants.js`, shown in Debug, reflected in the persistent footer, and included in workspace, dashboard, report, AI, and map export metadata.

## Interaction Model

Interaction events are versioned plain objects. They record source dashboard/card/visualization IDs, renderer type, typed selection payload, modifiers, timestamp, and lineage.

Supported event kinds include:

- Category and multi-category selection
- Numeric and date ranges
- Point, table-row, legend, brush, map-feature, and map-region selection
- Drill-down, drill-up, clear-selection, and parameter-change events

Events are validated before publishing. Renderer-native event objects are not persisted; adapters extract only scalar values needed by QuackViz.

## Binding Model

Dashboards persist declarative interaction bindings under `dashboard.interactions.bindings`.

Bindings define:

- Source card, source field, and event kinds
- Target mode: compatible, explicit card IDs, all except source, or self where explicitly allowed
- Action: filter, highlight, set parameter, drill, detail table, or map viewport
- Clear behavior and enabled state

Self-targeting and circular bindings are rejected unless explicitly safe. Skipped targets are surfaced with reasons.

Cross-filter bindings apply only to targets with compatible field or parameter bindings.

## Cross-Filtering and Linked Highlighting

Cross-filtering uses typed filter objects and the existing safe dashboard-filter wrapper. It does not concatenate raw interaction strings into SQL.

Linked highlighting may update a chart without re-running its SQL query.

The current UI includes a compact dashboard interaction toolbar for creating a simple field binding, applying a typed selection, clearing interactions, and inspecting active filter/highlight state. This is intentionally minimal for the milestone; richer binding editors can build on the same model.

## Parameters

Saved queries may define typed parameters:

- String
- Number
- Integer
- Boolean
- Date
- Datetime
- Category
- Multi-category

The placeholder syntax is:

```sql
SELECT *
FROM sales
WHERE order_date >= {{ start_date }}
  AND region IN {{ regions }};
```

QuackViz interaction parameters are typed values, not raw SQL fragments.

Parameter compilation uses trusted literal encoders for strings, numbers, booleans, dates, datetimes, and multi-value lists. Parameters cannot become identifiers, operators, table names, sort directions, or arbitrary expressions.

## Drill-Down and Breadcrumbs

The drill-down module supports declarative drill definitions, hierarchy state, drill-up/reset behavior, and breadcrumbs such as:

```text
All > East > Furniture
```

Same-visualization drill-down is supported only when explicit hierarchy metadata exists. QuackViz does not rewrite arbitrary hand-written SQL to invent drill dimensions.

## Selective Refresh

Interaction resolution determines affected cards, highlighted cards, and skipped cards. Filter and parameter actions refresh only cards requiring query changes. Highlight-only actions avoid DuckDB execution when the current result already contains the compatible field.

The dashboard runner includes interaction filters and active parameters in its result-cache signature, so repeated selections can reuse cached results while source, query, filter, parameter, and workspace revisions still invalidate safely.

## AI Interaction Proposals

The AI action catalog now includes:

- Suggest dashboard interactions
- Suggest drill-downs
- Suggest parameters
- Critique interaction design
- Repair broken interaction

Added contracts:

- `quackviz-ai-interactions`
- `quackviz-ai-interaction-critique`

AI interaction output is validated against the active dashboard. Unknown card IDs, unknown fields, unsupported transforms, circular bindings, arbitrary JavaScript, event-handler code, executable-looking strings, and raw SQL fragments as parameter values are rejected. AI changes require user approval and are not automatically activated.

## Map Interactions

MapLibre feature-click adapters can emit typed map-region and map-feature interaction events. Map viewport filtering is not enabled by default. Cluster clicks remain navigation unless an explicit binding is added later.

## Table Interactions

Table-row selection adapters emit typed table-row events containing selected scalar values. Cell content is treated as data and is not allowed to become raw SQL.

## Supported Map Types

The constrained map spec supports:

- Point map
- Clustered point map
- Proportional-symbol map
- Category-colored point map
- Choropleth map
- Region-symbol overlay, reserved in the spec and validated as a supported map type

Unsupported future map types such as heatmap, hexbin, flow, route, polygon, line, raster, and terrain are not exposed as working controls.

## MapLibre and Basemaps

MapLibre GL JS is lazy-loaded only when a map renders. The default style is a blank local background, so imported data can render without a remote basemap.

Imported user data remains local. Remote basemap providers receive tile requests, not the imported dataset.

The current built-in styles are:

- Blank local background
- Default light background
- Default dark background

The architecture keeps style URLs centralized and allows future vendoring under:

```text
vendor/
  maplibre/
  boundaries/
```

No Mapbox-hosted APIs or Mapbox access token are required.

## Geographic Semantic Detection

Spatial profiling detects:

- Latitude
- Longitude
- Country names and ISO alpha-2/alpha-3 codes
- US state names, abbreviations, and FIPS codes
- US county FIPS-like values
- ZIP/postal codes
- City and region fields
- GeoJSON/WKT-like geometry fields

Generic `x` and `y` are not classified as coordinates by name alone. Coordinate detection requires supporting value ranges and more specific field names.

Detected columns may store:

```js
{
  semanticType: "latitude",
  semanticConfidence: 0.98,
  semanticReasons: ["Column name indicates latitude.", "Values are within -90 to 90."]
}
```

## Spatial Profiling

Coordinate profiles compute:

- Valid, invalid, null, and rejected coordinate-pair counts
- Bounding boxes
- Duplicate coordinate counts
- Zero/zero points
- Suspected swapped coordinates

Region profiles compute distinct values and feed exact-match diagnostics against available boundaries.

## Coordinate Validation

Coordinate normalization accepts numeric values and unambiguous numeric strings. It rejects nulls, empty strings, `NaN`, infinities, arrays, objects, latitudes outside `-90..90`, and longitudes outside `-180..180`.

Invalid rows are reported, not silently clamped. Suspected latitude/longitude reversal is warned about; QuackViz does not automatically swap coordinates.

## Boundary Catalog

The built-in boundary catalog includes:

- `us-states`
  - Attribution: US Census Bureau, simplified
  - Supported keys: US state name, abbreviation, FIPS
  - Current geometry: simplified local boxes suitable for validation and map workflow tests, not detailed cartography
- `world-countries`
  - Attribution: Natural Earth, simplified
  - Supported keys: country name, ISO alpha-2, ISO alpha-3
  - Current geometry: simplified local boxes for a small starter set
- `us-counties`
  - Cataloged but not vendored in this milestone

Detailed boundary files can be vendored later without changing the saved map spec format.

## Region Matching

Region matching is exact after normalization. Supported strategies include:

- US state abbreviation
- US state name
- US state FIPS
- Country ISO alpha-2
- Country ISO alpha-3
- Exact normalized country/name matching
- Explicit approved mappings

QuackViz does not silently fuzzy-match region names.

Unmatched values and low match rates are shown as warnings. AI region-repair proposals must be approved before mappings are used.

## Choropleth Classification

The current compiler supports continuous choropleth coloring with theme-aware colors and raw values in tooltip metadata. Equal interval, quantile, and manual breaks are reserved in the map spec but not fully exposed in the UI yet.

## Deterministic Map Recommendations

Local recommendations are generated for:

- Latitude + longitude -> point map
- Latitude + longitude + many rows -> clustered point map
- Latitude + longitude + numeric field -> proportional-symbol map
- Latitude + longitude + category field -> category-colored point map
- Region + numeric field -> choropleth map

Recommendations explain why a map adds value and avoid map suggestions when geographic confidence is weak.

## AI Map Proposals

The AI action catalog includes:

- Suggest maps
- Build map
- Explain spatial pattern
- Repair map SQL
- Repair region matching
- Critique current map
- Improve current map

Added contracts:

- `quackviz-ai-map-proposals`
- `quackviz-ai-region-repair`

AI map proposals are validated for contract version, read-only SQL, supported map type, expected-column alignment, known source tables, known boundary IDs, and no executable content. Raw MapLibre styles, JavaScript, HTML, event handlers, and AI-provided remote tile URLs are rejected.

AI-generated map SQL uses the existing SQL safety pipeline. AI proposals require approval and never execute automatically.

## Map Builder

The existing visualization builder now exposes contextual map controls for map types:

- Latitude and longitude fields
- Region and value fields
- Label, color, and size fields
- Boundary
- Basemap
- Clustering
- Legend
- Export map package

Generated SQL remains visible and editable in the SQL workspace.

## Dashboard and Report Integration

Maps are saved as normal visualization objects with `map-*` specs. Dashboard cards resolve saved map visualizations through the existing dashboard runner, then render them through the MapLibre map manager. ECharts and MapLibre cards can coexist.

Report visualization sections can reference saved maps. Report exports keep source references and snapshots. Current report map snapshots use the report snapshot path; detailed live map image capture is still limited by browser/WebGL/CORS behavior.

## Map Image Export

MapLibre instances are created with `preserveDrawingBuffer` so PNG export can work where the browser and source configuration permit it.

Map image export may be limited by third-party tile-server CORS policies.

When export fails, QuackViz surfaces the error instead of silently producing a blank image. Data-layer-only export is a future improvement.

## Portable Map Packages

Map visualization package export uses:

```json
{
  "format": "quackviz-visualization",
  "formatVersion": 1,
  "exportedBy": {
    "app": "QuackViz",
    "appVersion": "0.8.0",
    "buildDate": "2026-07-24"
  },
  "query": {},
  "visualization": {},
  "boundaries": [],
  "approvedMappings": []
}
```

Large boundary files are not embedded by default.

## Portable Package Format

The unified package format is:

```json
{
  "format": "quackviz-package",
  "formatVersion": 1,
  "manifest": {},
  "workspace": {},
  "artifacts": {},
  "data": {},
  "assets": {},
  "extensions": []
}
```

Supported package modes:

- Full workspace backup
- Standalone analytical app
- Dashboard-only package
- Report-only package
- Visualization package
- Template package
- Embedded artifact package

Supported data modes:

- `included`: package contains CSV table payloads and data fingerprints
- `external`: package contains schema requirements and import expectations
- `snapshot-only`: package contains artifacts/snapshots but cannot refresh queries
- `pre-aggregated`: package materializes saved-query result plans and limits source-level refresh

The package manifest includes app version, build date, workspace schema version, artifact counts, table counts, entry points, capabilities, dependencies, boundaries, extension IDs, privacy review, integrity records, data fingerprints, and known limitations.

Standalone packages never include OpenRouter API keys.

## Dependency Resolution

The dependency resolver walks selected artifacts and includes required relationships:

```text
selected dashboard
-> cards
-> visualizations
-> queries
-> source tables
-> map boundaries
-> interaction bindings
```

Reports resolve visualization, query, and dashboard snapshot sources. Missing dependencies are reported rather than silently omitted. Optional references, such as hidden report sections, are reported separately.

## Data Minimization

Package planning supports:

- Full required source tables
- External schema-only requirements
- Column-pruned extract plans
- Pre-aggregated query-result plans
- Snapshot-only packages
- Sensitive-field warnings

Column-pruned and pre-aggregated modes are represented as safe packaging plans in this milestone. They do not silently rewrite arbitrary SQL or discard required fields.

External-data standalone apps require the user to provide compatible local data.

## Standalone Runtime

Standalone export creates a self-contained static HTML runtime with an embedded package payload and a deliberate viewing boundary. It does not expose the authoring UI, OpenRouter settings, workspace reset controls, extension installation, or query creation controls.

Default runtime capabilities are conservative:

- View dashboards, reports, and visualizations
- Filters, cross-filtering, and drill-down metadata can be enabled by manifest capability
- Query editing is disabled
- AI is disabled
- Data export is disabled unless explicitly permitted

The standalone footer includes machine-readable runtime metadata:

```html
<footer
  data-quackviz-runtime-version="0.8.0"
  data-quackviz-package-version="1">
</footer>
```

The runtime uses relative paths and is intended for normal static hosting, including Python `http.server` and GitHub Pages project paths.

## Embedded Mode

Embed export creates a constrained config:

```json
{
  "format": "quackviz-embed",
  "formatVersion": 1,
  "artifactType": "visualization",
  "artifactId": "viz_monthly_revenue",
  "theme": "system",
  "height": 480,
  "capabilities": {
    "filters": false,
    "downloadImage": true,
    "showMetadata": false,
    "emitSelectionValues": false
  }
}
```

Embed snippets use iframes. Optional `postMessage` handling uses a versioned message contract and rejects wrong origins, unsupported message types, disabled capabilities, and raw SQL payloads. Selection values are not emitted to the parent page by default.

## Templates

Templates are data-free reusable structures. Built-ins currently include:

- Executive sales dashboard
- Time-series operations dashboard
- Data-quality review
- Geographic performance overview
- Experiment-results report
- Telemetry monitoring dashboard

Template application inspects semantic roles, shows proposed mappings, marks ambiguous or missing roles, and requires approval before artifacts are created. Templates do not silently bind fields based only on similar names.

## Declarative Extensions

QuackViz extensions are declarative and cannot contain executable JavaScript.

Supported extension contribution types include:

- Chart definition
- Visualization recommendation rule
- Semantic-type rule
- Formatting preset
- Report section preset
- Template pack
- Boundary catalog entry
- Color-scale preset
- Query-builder aggregate definition

Extensions are parsed, validated, and can be installed, enabled, disabled, or removed from the local registry. Raw ECharts options, raw MapLibre layers, event handlers, remote boundary URLs, unknown compiler families, executable-looking strings, and protected built-in ID overrides are rejected.

## Integrity Hashes

Packages include SHA-256 hashes for critical files such as manifest, workspace, artifacts, and data payloads. Import inspection can verify available hashes and report missing or mismatched files.

Integrity hashes detect changed files but do not verify who created the package.

## Package Privacy Review

Before export, QuackViz records privacy metadata:

- Raw data included
- Free-text field count
- Suspected sensitive field count
- Geographic coordinate field count
- AI history inclusion
- Data export capability
- API keys excluded

Sensitive detection is conservative and name-based; it is not a guarantee that all sensitive data has been found.

## AI Package Assistance

AI package actions are advisory only:

- Recommend package mode
- Recommend data-minimization strategy
- Draft standalone app description
- Suggest entry dashboard
- Suggest template mappings
- Critique package privacy and usability

The `quackviz-ai-package-plan` contract rejects unknown artifact IDs, unsupported package modes, unsupported data modes, raw SQL capabilities, arbitrary external URLs, JavaScript, shell commands, API keys, and executable extension content. AI package plans require user approval and do not export automatically.

## DuckDB Spatial Extension

DuckDB’s spatial extension is not required for this milestone. Latitude/longitude maps and region joins work without it. WKT/GeoJSON detection is present, but full geometry rendering and spatial predicates are reserved for a later milestone unless DuckDB-WASM spatial loading proves reliable in static-browser tests.

## Privacy and AI Safety

OpenRouter API keys remain localStorage-only and are excluded from workspace export, dashboard export, report export, map export, snapshots, Debug, and AI history. AI output is treated as untrusted input.

QuackViz does not silently execute AI-generated SQL.

## Footer and Versioning

The persistent footer shows the canonical app version and build date. Debug, workspace metadata, dashboard exports, report exports, map exports, interaction diagnostics, package manifests, template metadata, extension diagnostics, standalone runtime metadata, and AI diagnostics use the same constants. “Copy deployment info” includes app version, build date, workspace ID, active dashboard ID, active map visualization ID, active interaction count, active drill path, and page URL.

## Accessibility and Performance

Map views include nonvisual diagnostics: feature count, rejected rows, coordinate/profile summaries, region-match diagnostics, legend metadata, tooltip field lists, and attribution. The visual map is not claimed to be fully equivalent for screen readers.

Default limits:

- Raw point map warning above 10,000 points
- Clustered point map warning above 100,000 points
- Tooltip fields limited to 10
- Category legend warning above 12 categories

## Current Limitations

- Built-in boundaries are simplified local geometries for validation/workflow, not detailed cartographic boundary files.
- US counties are cataloged but not vendored.
- TopoJSON conversion is not needed yet because built-in boundaries are GeoJSON.
- Equal interval, quantile, and manual choropleth breaks are reserved but not fully implemented.
- Map image export depends on browser/WebGL/CORS behavior.
- Report map snapshots still use the report snapshot mechanism and may not capture live MapLibre tiles.
- The first interaction UI is intentionally compact: it supports simple field bindings and selection application, while advanced binding editing and visual keyboard selection affordances are reserved for follow-up work.
- Drill-through detail tables and same-visualization query regeneration have model support but only limited UI exposure in this milestone.
- Cross-filter compatibility is based on declared visualization encodings and result fields. QuackViz does not silently rewrite arbitrary SQL to force dashboard filters.
- Portable packages are exported as JSON and standalone apps as self-contained HTML. A ZIP container is not added in this milestone to preserve the no-install/no-build dependency model.
- Standalone runtime rendering is intentionally presentation-oriented; full DuckDB-backed refresh from included data is represented by package data contracts and runtime metadata, with deeper runtime query execution reserved for a follow-up.
- Column-pruned and pre-aggregated exports are packaging plans in this milestone, not full Parquet materialization.
- Extension persistence is local in runtime state for now; richer user-extension management can build on the declarative validator.
- No geocoding service is included.
- No routing, streaming, collaboration, or remote database connectivity is included.
- Browser self-test requires a static server and CDN access for DuckDB/ECharts/MapLibre runtime paths.

## Next Milestone

Recommended focus:

1. Add a ZIP container with optional vendored runtime assets while preserving no-build authoring.
2. Execute packaged included-data queries in the standalone runtime with DuckDB-WASM.
3. Add a package import inspector modal with selective optional-component import.
4. Expand template application into a full mapping-and-approval workflow.
5. Persist the declarative extension registry in IndexedDB and surface conflict resolution UI.
