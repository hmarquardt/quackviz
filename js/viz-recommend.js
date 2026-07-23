import { buildQuery, specFromBuilder } from "./query-builder.js";

export function recommendVisualizations(tableName, profiles) {
  const nums = profiles.filter((p) => ["numeric", "currency", "percentage", "latitude", "longitude"].includes(p.semanticType));
  const dates = profiles.filter((p) => ["date", "datetime"].includes(p.semanticType));
  const cats = profiles.filter((p) => ["category", "boolean", "identifier"].includes(p.semanticType) || p.distinctRatio < 0.4);
  const recs = [];
  const add = (chartType, confidence, reason, fields, aggregation = "sum") => {
    const sql = buildQuery({ table: tableName, chartType, xField: fields.x, yField: fields.y, seriesField: fields.series, aggregation, sortMode: "measure-desc", topN: chartType.includes("bar") || chartType === "donut" ? 25 : 0, dateBucket: fields.dateBucket || "none" });
    recs.push({ chartType, confidence, reason, fields, aggregation, sql });
  };
  if (dates[0] && nums[0]) add("line", 0.92, "Date plus numeric measure supports trend analysis.", { x: dates[0].name, y: nums[0].name, dateBucket: "month" }, "sum");
  if (cats[0] && nums[0]) add("vertical-bar", 0.86, "Category plus numeric measure supports ranked comparison.", { x: cats[0].name, y: nums[0].name }, "sum");
  if (cats[0] && nums[0] && cats[1]) add("grouped-bar", 0.78, "Two categorical fields plus a measure support grouped comparison.", { x: cats[0].name, y: nums[0].name, series: cats[1].name }, "sum");
  if (nums[0] && nums[1]) add("scatter", 0.82, "Two numeric fields support relationship analysis.", { x: nums[0].name, y: nums[1].name }, "avg");
  if (nums[0] && nums[1] && nums[2]) add("bubble", 0.76, "Three numeric fields support position plus size encoding.", { x: nums[0].name, y: nums[1].name, size: nums[2].name }, "avg");
  if (nums[0]) add("histogram", 0.74, "A single numeric field supports distribution analysis.", { y: nums[0].name }, "count");
  if (cats[0] && cats[1] && nums[0]) add("heatmap", 0.72, "Two categories plus a measure support matrix comparison.", { x: cats[0].name, y: nums[0].name, series: cats[1].name }, "sum");
  if (cats[0] && nums[0] && (cats[0].distinctCount || 99) <= 12) add("donut", 0.65, "Small categorical cardinality can be shown as share of total.", { x: cats[0].name, y: nums[0].name }, "sum");
  return recs.sort((a, b) => b.confidence - a.confidence).map((rec) => ({ ...rec, makeSpec: (queryId) => specFromBuilder({ queryId, chartType: rec.chartType, yField: rec.fields.y, aggregation: rec.aggregation, seriesField: rec.fields.series }) }));
}

