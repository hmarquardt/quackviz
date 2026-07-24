# QuackViz

QuackViz is a static, browser-local DuckDB-WASM, Apache ECharts, and MapLibre GL JS analytical workspace. Current application version: `0.7.0`, build date `2026-07-24`.

## Current Milestone: Coordinated Interactions

QuackViz now includes declarative dashboard interactions for cross-filtering, linked highlighting, typed query parameters, drill-down state, interaction history, and structured AI interaction proposals. The existing import, profiling, SQL, visualization, AI, dashboard, report, map, persistence, export, tests, diagnostics, and footer workflows remain in place.

The interaction workflow is:

```text
user selects a mark, category, range, or region
-> QuackViz emits a typed interaction event
-> dashboard resolves compatible bindings
-> parameter and filter state updates
-> affected SQL queries are safely compiled or wrapped
-> DuckDB refreshes affected cards
-> charts and maps update
-> interaction lineage remains visible and reversible
```

Remote database connectivity, real-time streaming, collaboration, authentication, cloud synchronization, arbitrary callbacks, and AI-generated event handlers are not implemented.

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
    "appVersion": "0.7.0",
    "buildDate": "2026-07-24"
  },
  "query": {},
  "visualization": {},
  "boundaries": [],
  "approvedMappings": []
}
```

Large boundary files are not embedded by default.

## DuckDB Spatial Extension

DuckDB’s spatial extension is not required for this milestone. Latitude/longitude maps and region joins work without it. WKT/GeoJSON detection is present, but full geometry rendering and spatial predicates are reserved for a later milestone unless DuckDB-WASM spatial loading proves reliable in static-browser tests.

## Privacy and AI Safety

OpenRouter API keys remain localStorage-only and are excluded from workspace export, dashboard export, report export, map export, snapshots, Debug, and AI history. AI output is treated as untrusted input.

QuackViz does not silently execute AI-generated SQL.

## Footer and Versioning

The persistent footer shows the canonical app version and build date. Debug, workspace metadata, dashboard exports, report exports, map exports, interaction diagnostics, and AI diagnostics use the same constants. “Copy deployment info” includes app version, build date, workspace ID, active dashboard ID, active map visualization ID, active interaction count, active drill path, and page URL.

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
- No geocoding service is included.
- No routing, streaming, collaboration, or remote database connectivity is included.
- Browser self-test requires a static server and CDN access for DuckDB/ECharts/MapLibre runtime paths.

## Next Milestone

Recommended focus:

1. Build a richer interaction authoring inspector with compatibility previews per card.
2. Add direct renderer-to-dashboard event wiring for live ECharts and MapLibre clicks.
3. Expand drill-through detail panels and parameter controls in the dashboard UI.
4. Add accessible keyboard alternatives for common chart selections.
5. Add advanced map/report interaction coverage once the binding editor stabilizes.
