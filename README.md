# QuackViz

QuackViz is a static, browser-local DuckDB-WASM and Apache ECharts analytical workspace. Current application version: `0.3.0`, build date `2026-07-23`.

## Current Milestone: Structured AI Augmentation

QuackViz now includes a structured OpenRouter-backed analytical copilot. AI output is treated as untrusted input. QuackViz does not silently execute AI-generated SQL.

The AI workflow is:

```text
table metadata and schema context
-> OpenRouter structured JSON response
-> contract validation
-> SQL safety validation
-> explicit EXPLAIN / limited preview
-> visualization-spec validation
-> ECharts preview
-> optional builder transfer or save
```

Dashboards, maps, reports, cross-filtering, background agents, and autonomous execution are not implemented.

## Run Locally

No npm install and no build step are required:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/`.

Use a static server rather than `file://` because ES modules, DuckDB-WASM workers, and browser storage APIs require a normal browser origin.

## Run Tests

Start the same static server, then open:

```text
http://localhost:8080/tests/
```

The browser test page uses mocked/static AI payloads only. It does not make billable provider calls.

## Exact Dependency Versions

Pinned versions are centralized in `js/constants.js`, shown in Debug, and used by runtime imports:

- Apache ECharts `6.0.0`
  - `https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.esm.min.js`
- DuckDB-WASM `1.33.1-dev57.0`
  - `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev57.0/+esm`

## OpenRouter Setup

Open the AI tab, enable AI, paste an OpenRouter API key, choose or refresh a model, preview the context, then run an AI action. The key is stored only in localStorage and is excluded from workspace export, debug output, AI history, and UI logs.

Model discovery uses `https://openrouter.ai/api/v1/models`. If the endpoint fails, QuackViz shows a pinned fallback list and does not block the rest of the app.

## Supported AI Actions

- Explore dataset
- Generate visualization proposals
- Generate SQL
- Explain current result
- Critique visualization
- Improve visualization
- Repair failed SQL
- Explain SQL

The active UI currently exposes the shared structured request flow and proposal lifecycle. Result explanation, critique, improve, and repair use separate validators/contracts and are ready for structured responses, but their richer editing/patch application flows remain intentionally constrained.

## Structured Contracts

Added versioned contracts:

- `quackviz-ai-proposals`
- `quackviz-ai-repair`
- `quackviz-ai-result-explanation`
- `quackviz-ai-chart-critique`

The validator rejects malformed JSON, unsupported contract versions, unknown top-level properties, function-like values, script tags, raw ECharts options by omission, invalid confidence, unsafe SQL, unknown source tables, and visualization fields that do not match expected SQL output.

## Privacy Model

By default QuackViz sends schema-first context only:

- App and contract version
- Selected table names
- Row counts
- Column names
- DuckDB types
- Heuristic semantic types and confidence
- Sensitive-field warnings and exclusions

Raw sample rows are opt-in through the context mode controls. When sample rows are enabled, the UI warns that rows will be sent to the selected external AI provider. Sensitive-field detection is heuristic, not a guarantee.

Likely sensitive columns include names, email, phone, address, date of birth, account numbers, credit cards, medical identifiers, IP/device identifiers, and free-text comments.

## SQL Safety Pipeline

AI SQL passes through defensive lexical gates:

1. Trim and normalize one trailing semicolon.
2. Reject empty SQL, null bytes, and excessive length.
3. Reject multiple statements while accounting for comments and quoted strings.
4. Allow only `SELECT` and `WITH`.
5. Block destructive or environment-changing keywords such as `DROP`, `CREATE`, `COPY`, `INSTALL`, `ATTACH`, and `PRAGMA`.
6. Block obvious external-file and URL access.
7. Compare referenced tables with workspace metadata where practical.
8. Run `EXPLAIN` only after explicit user action.
9. Run limited preview through a safe wrapper only after explicit user action.

These checks are defensive controls, not a formal SQL sandbox.

## Proposal Lifecycle

Each proposal card shows title, question, description, chart type, source tables, confidence, validation status, and actions:

- Inspect
- Validate
- Preview data
- Preview chart
- Open in builder
- Save
- Copy SQL
- Copy proposal JSON
- Reject

Opening a proposal in the builder loads an unsaved AI-generated query and spec. Saving creates durable query and visualization objects with OpenRouter/model/proposal provenance.

## AI History and Diagnostics

AI interaction metadata is stored with the workspace and capped to recent entries. Stored history includes action, provider, model, selected tables, context mode, sample-row flag, summary, proposal IDs, usage, diagnostics, status, and sanitized errors. It excludes API keys, authorization headers, and raw sensitive rows.

Debug includes AI enabled state, selected provider/model, model-list refresh time, interaction count, last action duration/status, contract version, proposal count, parse/safety errors, sample-row mode, sensitive warnings, and whether a key is configured.

## Existing Manual Workflow

The first vertical slice remains:

```text
sample CSV -> DuckDB-WASM table -> SQL query -> result dataset -> QuackViz spec -> ECharts option -> rendered chart -> saved query/visualization metadata
```

DuckDB tables are in memory for this milestone. Reload restores workspace metadata but may require reloading the sample table.

## Version and Footer

The canonical version and build date live in `js/constants.js`. The same constants feed workspace metadata, Debug, AI request metadata, tests, and the footer.

## Current Limitations

- OPFS DuckDB persistence is not implemented.
- Only the included sales sample is wired into the active import UI.
- Only line and vertical bar chart specs are supported.
- AI repair, explanation, and critique contracts are validated, but application of critique patches is intentionally limited.
- Automated tests mock AI outputs and do not call OpenRouter.
- Browser self-test requires running the app from a static server with DuckDB/ECharts CDN access.

## Next Milestone

Recommended focus:

1. Restore and harden broader manual import/export affordances.
2. Add richer result-explanation and critique detail panels.
3. Add approved spec-patch application for visualization improvements.
4. Extend deterministic recommendations and pass them into AI context.
5. Consider OPFS persistence or explicit source-file reattachment.
