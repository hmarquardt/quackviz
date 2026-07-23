import { escapeIdent } from "./utils.js";

export function buildQuery({ table, chartType, xField, yField, seriesField, aggregation, sortMode, topN, dateBucket }) {
  const xExpr = dateBucket && dateBucket !== "none" ? `date_trunc('${dateBucket}', ${escapeIdent(xField)})` : escapeIdent(xField);
  const measure = aggregation === "count" ? "COUNT(*)" : `${aggregation.toUpperCase()}(${escapeIdent(yField)})`;
  const yAlias = aggregation === "count" ? "row_count" : `${aggregation}_${yField}`.replace(/\W+/g, "_");
  if (chartType === "histogram") {
    return `WITH stats AS (
  SELECT MIN(${escapeIdent(yField)}) AS min_value, MAX(${escapeIdent(yField)}) AS max_value FROM ${escapeIdent(table)}
)
SELECT histogram_bin, COUNT(*) AS row_count
FROM (
  SELECT CAST(FLOOR(((${escapeIdent(yField)} - min_value) / NULLIF(max_value - min_value, 0)) * 12) AS INTEGER) AS histogram_bin
  FROM ${escapeIdent(table)}
  CROSS JOIN stats
  WHERE ${escapeIdent(yField)} IS NOT NULL
) bins
GROUP BY 1
ORDER BY 1`;
  }
  if (chartType === "boxplot") return `SELECT ${escapeIdent(yField)} FROM ${escapeIdent(table)} WHERE ${escapeIdent(yField)} IS NOT NULL`;
  const selects = [`${xExpr} AS x_value`, `${measure} AS ${escapeIdent(yAlias)}`];
  const groups = ["1"];
  if (seriesField) {
    selects.splice(1, 0, `${escapeIdent(seriesField)} AS series_value`);
    groups.push("2");
  }
  const order = sortMode === "measure-desc" ? `${escapeIdent(yAlias)} DESC` : "1";
  const limit = topN ? `\nLIMIT ${Number(topN)}` : "";
  return `SELECT ${selects.join(", ")}
FROM ${escapeIdent(table)}
GROUP BY ${groups.join(", ")}
ORDER BY ${order}${limit}`;
}

export function specFromBuilder({ queryId, chartType, yField, aggregation, seriesField }) {
  const valueField = chartType === "histogram" ? "row_count" : chartType === "boxplot" ? yField : aggregation === "count" ? "row_count" : `${aggregation}_${yField}`.replace(/\W+/g, "_");
  return {
    version: 1,
    type: chartType,
    title: `${chartType.replaceAll("-", " ")} by ${chartType === "boxplot" ? yField : "x_value"}`,
    dataset: { queryId },
    encoding: {
      x: { field: chartType === "histogram" ? "histogram_bin" : "x_value", dataType: "category", label: chartType === "histogram" ? "Bin" : "X" },
      y: [{ field: valueField, dataType: "number", label: valueField }],
      series: seriesField ? { field: "series_value", dataType: "category", label: seriesField } : null,
      size: null,
      color: null,
    },
    options: { legend: true, tooltip: "axis", zoom: true, stack: chartType === "stacked-bar", labels: false, orientation: chartType === "horizontal-bar" ? "horizontal" : "vertical" },
  };
}
