# QuackViz First-Time-User Test Plan

Status: ready to run; no participant sessions have been recorded.

## Participants

Recruit 3–5 people who have not worked on QuackViz. Include a spreadsheet user, a SQL/data user, a general computer user, a developer or analyst, and where possible one person unfamiliar with DuckDB or browser-local applications. Do not collect sensitive personal information.

Use the deployed beta in a clean browser profile. The observer may explain that this is a usability test of the product, not of the participant. Do not coach unless the participant is fully blocked; record every intervention.

## Tasks

1. **Understand:** “What do you think this application does? Where do you think your data goes?”
2. **Load data:** “Load one of the showcase datasets.” Do not identify the showcase control.
3. **Inspect:** “Find the number of rows and identify three columns.”
4. **Analyze:** “Run a query that summarizes the data.” Starter queries or recipes are allowed.
5. **Visualize:** “Create and save a useful chart or map.”
6. **Dashboard:** “Create a dashboard and add the saved visualization.”
7. **Backup:** “Create a backup of the workspace.”
8. **Recovery understanding:** “What do you think happens to a local file after the browser reloads?”
9. **Help:** “Find help explaining URL import limitations.”
10. **Confidence:** “Would you trust this application with an ordinary local dataset? Why or why not?”

## Observation Record

For each participant record:

- Browser, operating system, and relevant background
- Time to understand the product, locate showcase data, import, run the first query, create a visualization, and create a dashboard
- Task result: complete, complete with intervention, or incomplete
- Wrong turns, help requests, and intervention points
- Confusing terms, overlooked controls, misunderstood errors, and layout problems
- Confidence and usefulness ratings from 1–5

Do not mark a task complete when the application state does not prove completion. Use [the feedback form](usability-feedback-form.md) after the tasks and add actionable observations to [the findings register](usability-findings.md).

## Issue Priority

- **P0:** data loss, security problem, or unusable core workflow
- **P1:** blocks a common task
- **P2:** significant confusion or repeated friction
- **P3:** cosmetic or low-frequency issue

Fix every P0 and P1 before RC qualification. Fix repeated P2 findings that affect the primary workflow. Do not use feature expansion as a substitute for correcting the observed workflow.

