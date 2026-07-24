import { SUPPORTED_MAP_TYPES } from "./constants.js";

export function recommendMaps(columns = [], rows = []) {
  const lat = columns.find((column) => column.inferredType === "latitude" || /^(lat|latitude)$/i.test(column.name));
  const lon = columns.find((column) => column.inferredType === "longitude" || /^(lon|lng|longitude)$/i.test(column.name));
  const numeric = columns.find((column) => ["number", "numeric"].includes(column.inferredType));
  const category = columns.find((column) => ![lat?.name, lon?.name, numeric?.name].includes(column.name));
  const region = columns.find((column) => /state|country|county|region|fips/i.test(column.name));
  const recs = [];
  if (lat && lon) {
    recs.push({ type: "map-point", title: "Point map", reason: "Latitude and longitude fields can show the spatial distribution of rows." });
    if (rows.length > 1000) recs.push({ type: "map-clustered-point", title: "Clustered point map", reason: "Many coordinate rows benefit from clustering to reduce overlap." });
    if (numeric) recs.push({ type: "map-proportional-symbol", title: "Proportional symbol map", reason: `Numeric field '${numeric.name}' can size symbols while preserving location.` });
    if (category) recs.push({ type: "map-category-point", title: "Category-colored point map", reason: `Category field '${category.name}' can reveal spatial segmentation.` });
  }
  if (region && numeric) recs.push({ type: "map-choropleth", title: "Choropleth map", reason: `Region field '${region.name}' and numeric field '${numeric.name}' can map aggregated regional values.` });
  return recs.filter((rec) => SUPPORTED_MAP_TYPES.includes(rec.type));
}
