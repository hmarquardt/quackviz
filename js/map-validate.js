import { MAP_CATEGORY_WARNING_LIMIT, MAP_CLUSTER_POINT_LIMIT, MAP_POINT_LIMIT, MAP_SPEC_VERSION, MAP_TOOLTIP_FIELD_LIMIT, SUPPORTED_MAP_TYPES } from "./constants.js";
import { boundaryCatalog, loadBoundary } from "./map-boundaries.js";
import { rowsToPointGeoJson } from "./map-data.js";
import { matchRegions } from "./map-match.js";
import { normalizeMapSpec, rawMapTopLevelErrors } from "./map-spec.js";

export async function validateMapSpec(input, dataset = { columns: [], rows: [] }) {
  const errors = [...rawMapTopLevelErrors(input)];
  const warnings = [];
  if (containsExecutable(input)) errors.push({ path: "$", message: "Map specification must not contain functions, script tags, or executable strings." });
  const spec = normalizeMapSpec(input);
  if (spec.version !== MAP_SPEC_VERSION) errors.push({ path: "version", message: `Unsupported map spec version ${spec.version}.` });
  if (!SUPPORTED_MAP_TYPES.includes(spec.type)) errors.push({ path: "type", message: `Unsupported map type '${spec.type}'.` });
  if (!spec.dataset.queryId) errors.push({ path: "dataset.queryId", message: "A saved query reference is required." });
  if ((spec.encoding.tooltip || []).length > MAP_TOOLTIP_FIELD_LIMIT) errors.push({ path: "encoding.tooltip", message: `Tooltip fields are limited to ${MAP_TOOLTIP_FIELD_LIMIT}.` });
  const columns = dataset.columns || [];
  const byName = new Map(columns.map((column) => [column.name, column]));
  const requireField = (ref, path, numeric = false) => {
    if (!ref?.field) { errors.push({ path, message: "Field is required." }); return null; }
    const column = byName.get(ref.field);
    if (!column) errors.push({ path, message: `Field '${ref.field}' does not exist in the result dataset.` });
    if (numeric && column && column.inferredType !== "number" && column.inferredType !== "numeric") errors.push({ path, message: `Field '${ref.field}' must be numeric.` });
    return column;
  };
  if (isPointType(spec.type)) {
    requireField(spec.encoding.latitude, "encoding.latitude.field");
    requireField(spec.encoding.longitude, "encoding.longitude.field");
    if (spec.encoding.size) requireField(spec.encoding.size, "encoding.size.field", true);
    const converted = rowsToPointGeoJson(dataset.rows || [], spec);
    if (!converted.diagnostics.validFeatureCount) errors.push({ path: "encoding.latitude", message: "No valid coordinate pairs were found." });
    if (converted.diagnostics.rejectedRowCount) warnings.push({ path: "coordinates", message: `${converted.diagnostics.rejectedRowCount} rows were rejected for missing or invalid coordinates.` });
    if (converted.diagnostics.suspectedSwappedCoordinateCount) warnings.push({ path: "coordinates", message: `${converted.diagnostics.suspectedSwappedCoordinateCount} rows look like latitude/longitude may be reversed.` });
    const limit = spec.type === "map-clustered-point" || spec.map.cluster ? MAP_CLUSTER_POINT_LIMIT : MAP_POINT_LIMIT;
    if ((dataset.rows || []).length > limit) warnings.push({ path: "rows", message: `Point maps default to ${limit.toLocaleString()} rows; consider limiting SQL or clustering.` });
    if (spec.encoding.color) {
      const values = new Set((dataset.rows || []).map((row) => row[spec.encoding.color.field]).filter((value) => value != null));
      if (values.size > MAP_CATEGORY_WARNING_LIMIT) warnings.push({ path: "encoding.color.field", message: `Category color has ${values.size} values; map legends become hard to read above ${MAP_CATEGORY_WARNING_LIMIT}.` });
    }
  }
  if (spec.type === "map-choropleth") {
    requireField(spec.encoding.region, "encoding.region.field");
    requireField(spec.encoding.value, "encoding.value.field", true);
    const catalog = boundaryCatalog().find((item) => item.id === spec.encoding.region?.boundary);
    if (!catalog) errors.push({ path: "encoding.region.boundary", message: `Unknown boundary '${spec.encoding.region?.boundary}'.` });
    else if (!catalog.keyTypes.includes(spec.encoding.region.dataType)) errors.push({ path: "encoding.region.dataType", message: `Region type '${spec.encoding.region.dataType}' is incompatible with boundary '${catalog.id}'.` });
    else {
      try {
        const boundary = await loadBoundary(catalog.id);
        const match = matchRegions({ rows: dataset.rows || [], regionField: spec.encoding.region.field, regionType: spec.encoding.region.dataType, boundary, approvedMappings: spec.map.approvedMappings });
        if (match.unmatchedDataRegions) warnings.push({ path: "encoding.region.field", message: `${match.unmatchedDataRegions} region values did not match '${catalog.label}'.` });
        if (match.totalDataRegions && match.matchRate < 0.8) warnings.push({ path: "encoding.region.field", message: `Region match rate is ${Math.round(match.matchRate * 100)}%.` });
      } catch (error) {
        errors.push({ path: "encoding.region.boundary", message: error.message });
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings, spec };
}

export function validateMapSpecSync(input, dataset = { columns: [], rows: [] }) {
  const spec = normalizeMapSpec(input);
  const errors = [...rawMapTopLevelErrors(input)];
  if (!SUPPORTED_MAP_TYPES.includes(spec.type)) errors.push({ path: "type", message: `Unsupported map type '${spec.type}'.` });
  if (!spec.dataset.queryId) errors.push({ path: "dataset.queryId", message: "A saved query reference is required." });
  const names = new Set((dataset.columns || []).map((column) => column.name));
  if (isPointType(spec.type)) {
    if (!spec.encoding.latitude?.field) errors.push({ path: "encoding.latitude.field", message: "Latitude field is required." });
    if (!spec.encoding.longitude?.field) errors.push({ path: "encoding.longitude.field", message: "Longitude field is required." });
  }
  if (spec.type === "map-choropleth") {
    if (!spec.encoding.region?.field) errors.push({ path: "encoding.region.field", message: "Region field is required." });
    if (!spec.encoding.value?.field) errors.push({ path: "encoding.value.field", message: "Value field is required." });
    if (!boundaryCatalog().some((boundary) => boundary.id === spec.encoding.region?.boundary)) errors.push({ path: "encoding.region.boundary", message: `Unknown boundary '${spec.encoding.region?.boundary}'.` });
  }
  for (const [key, ref] of Object.entries(spec.encoding)) {
    if (Array.isArray(ref)) continue;
    if (ref?.field && !names.has(ref.field)) errors.push({ path: `encoding.${key}.field`, message: `Field '${ref.field}' does not exist in the result dataset.` });
  }
  return { valid: errors.length === 0, errors, warnings: [], spec };
}

function isPointType(type) {
  return ["map-point", "map-clustered-point", "map-proportional-symbol", "map-category-point"].includes(type);
}

function containsExecutable(value) {
  if (typeof value === "function") return true;
  if (typeof value === "string") return /^\s*(function|\(?\s*[\w,\s]*\)?\s*=>|<script\b)/i.test(value);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsExecutable);
}
