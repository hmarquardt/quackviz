# QuackViz Showcase Pack

Five import-ready JSON datasets designed specifically to demonstrate chart diversity,
geospatial analysis, SQL aggregation, dashboards, and report generation.

## Files

- `01_global_development_odyssey.json` — 1,704 rows
- `02_montreal_mobility_constellation.json` — 249 rows
- `03_tech_stock_time_machine.json` — 630 rows
- `04_iris_morphology_lab.json` — 150 rows
- `05_wind_rose_observatory.json` — 128 rows
- `showcase_catalog.json` — metadata and suggested hero views
- `SQL_COOKBOOK.md` — ready-to-run QuackViz queries

## Source datasets

These files are transformed from public demonstration datasets distributed with
Plotly Express:

- Gapminder country-year data
- Montreal car-sharing availability
- Technology stock index series
- Fisher/UCI Iris measurements
- Wind direction and strength frequencies

Transformations add derived fields for rankings, bands, rolling metrics, map symbol
sizes, ratios, and dashboard-friendly measures. No random values were added.

Gapminder coverage ends in 2007. The stock values are demonstration index data,
not current prices or investment information. See `docs/showcase.md` for the
chart and map types that the current QuackViz beta exposes as stable.

## Import note

Each data file is a top-level JSON array of flat records, suitable for QuackViz JSON import.
Import each as a separate table using the filename stem as the table name.
