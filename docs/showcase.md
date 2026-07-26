# QuackViz Showcase

Last verified: 2026-07-26 with QuackViz 1.0.0-beta.5.

Open **Help > Showcase examples** to prepare any dataset in the normal Data import flow. Review the detected JSON format and proposed table name, then press **Import**. The gallery does not bypass validation or silently create saved work.

| Dataset | Rows | Source and intended use |
| --- | ---: | --- |
| Global Development Odyssey | 1,704 | Transformed Gapminder demonstration data. Historical coverage ends in 2007. Use for time trends, ranked bars, and centroid point maps. |
| Montreal Mobility Constellation | 249 | Transformed Plotly Montreal car-sharing data. Use for point, clustered, proportional-symbol, and category-colored maps. |
| Tech Stock Time Machine | 630 | Transformed Plotly stock-index demonstration data. Values are not current investment information. Use for trend lines and ranked bars. |
| Iris Morphology Lab | 150 | Transformed Fisher/UCI Iris measurements. Use for category summaries and comparisons. |
| Wind Rose Observatory | 128 | Transformed Plotly wind-frequency data. Use for direction rankings and grouped bar analysis. |

The source pack adds derived fields for rankings, bands, rolling metrics, ratios, and map-friendly measures. It is demonstration material, not an authoritative current-statistics product.

## Stable Views

The stable non-map chart surface in this beta is line and vertical bar. Scatter, area, pie/donut, histogram, heatmap, box plot, horizontal bar, bubble sizing, and polar charts are not exposed as stable chart types. The supplied SQL cookbook mentions some of those analytical forms as dataset possibilities; it does not imply current QuackViz support.

Stable map views are point, clustered point, proportional-symbol, and category-colored point maps. Global Development Odyssey can use its country centroids for a proportional-symbol map. The built-in world boundary currently contains only six simplified demonstration geometries, so it is not suitable for a credible global choropleth.

## Evaluation Workflow

1. Prepare Global Development Odyssey from Help.
2. Import it as `global_development_odyssey`.
3. Run visible SQL from `examples/showcase/SQL_COOKBOOK.md`.
4. Build a line or vertical bar chart, or a centroid point map.
5. Save the query and visualization through normal workspace controls.
6. Add saved visualizations to a dashboard or report.
7. Export a workspace backup.

The complete original cookbook and source-pack notes are retained under `examples/showcase/`.

The [illustrated Montreal Mobility tutorial](tutorials/montreal-mobility.md) follows the ordinary showcase browser through import, schema inspection, SQL, a real local MapLibre map, visualization saving, and dashboard composition.

## Qualification Status

All five files are ordinary JSON arrays and are validated through the normal import path. Automated release coverage imports Iris data for real line/bar ECharts rendering and Montreal data for real point, clustered, proportional-symbol, and category-colored MapLibre rendering across Chromium, Firefox, and Playwright WebKit.

The requested multi-view hero dashboard and showcase report are not release-qualified. Their scatter/bubble, heatmap, KPI-row, and credible global choropleth requirements exceed the current stable product surface, so QuackViz remains `1.0.0-beta.5`.
