import { MAP_SPEC_VERSION, SUPPORTED_MAP_TYPES } from "./constants.js";
import { deepClone } from "./utils.js";

const TOP_LEVEL = new Set(["version", "type", "title", "subtitle", "dataset", "encoding", "map"]);

export function isMapSpec(spec) {
  return SUPPORTED_MAP_TYPES.includes(spec?.type);
}

export function defaultMapSpec({ queryId = null, columns = [], type = "map-point" } = {}) {
  const latitude = columns.find((column) => ["latitude"].includes(column.inferredType) || /^(lat|latitude)$/i.test(column.name));
  const longitude = columns.find((column) => ["longitude"].includes(column.inferredType) || /^(lon|lng|longitude)$/i.test(column.name));
  const region = columns.find((column) => /state|country|county|region|fips|zip|postal/i.test(column.name));
  const number = columns.find((column) => column.inferredType === "number" || column.inferredType === "numeric");
  const category = columns.find((column) => ![latitude?.name, longitude?.name, number?.name].includes(column.name));
  const mapType = type === "map-choropleth" || (!latitude && !longitude && region && number) ? "map-choropleth" : type;
  return normalizeMapSpec({
    version: MAP_SPEC_VERSION,
    type: mapType,
    title: mapType === "map-choropleth" ? `${labelFor(number?.name || "Value")} by ${labelFor(region?.name || "Region")}` : "Point map",
    subtitle: "",
    dataset: { queryId },
    encoding: {
      latitude: latitude ? field(latitude, "latitude") : null,
      longitude: longitude ? field(longitude, "longitude") : null,
      label: category ? field(category, "category") : null,
      tooltip: [],
      size: ["map-proportional-symbol", "map-region-symbol"].includes(mapType) && number ? field(number, "number") : null,
      color: mapType === "map-category-point" && category ? field(category, "category") : null,
      value: mapType === "map-choropleth" && number ? field(number, "number") : null,
      region: mapType === "map-choropleth" && region ? { ...field(region, guessRegionType(region)), boundary: "us-states" } : null,
    },
    map: {},
  });
}

export function normalizeMapSpec(input = {}) {
  const spec = deepClone(input);
  return {
    version: spec.version ?? MAP_SPEC_VERSION,
    type: spec.type || "map-point",
    title: typeof spec.title === "string" ? spec.title : "Untitled map",
    subtitle: typeof spec.subtitle === "string" ? spec.subtitle : "",
    dataset: { queryId: spec.dataset?.queryId ?? null },
    encoding: {
      latitude: spec.encoding?.latitude ? normalizeField(spec.encoding.latitude) : null,
      longitude: spec.encoding?.longitude ? normalizeField(spec.encoding.longitude) : null,
      label: spec.encoding?.label ? normalizeField(spec.encoding.label) : null,
      tooltip: Array.isArray(spec.encoding?.tooltip) ? spec.encoding.tooltip.map(normalizeField) : [],
      size: spec.encoding?.size ? normalizeField(spec.encoding.size) : null,
      color: spec.encoding?.color ? normalizeField(spec.encoding.color) : null,
      value: spec.encoding?.value ? normalizeField(spec.encoding.value) : null,
      region: spec.encoding?.region ? { ...normalizeField(spec.encoding.region), boundary: spec.encoding.region.boundary || "us-states" } : null,
    },
    map: {
      style: spec.map?.style || "blank",
      initialView: spec.map?.initialView || "fit-data",
      center: Array.isArray(spec.map?.center) ? spec.map.center.slice(0, 2).map(Number) : null,
      zoom: Number.isFinite(Number(spec.map?.zoom)) ? Number(spec.map.zoom) : null,
      cluster: Boolean(spec.map?.cluster),
      clusterRadius: Number(spec.map?.clusterRadius || 50),
      clusterMaxZoom: Number(spec.map?.clusterMaxZoom || 14),
      showLegend: spec.map?.showLegend !== false,
      showTooltip: spec.map?.showTooltip !== false,
      showScale: spec.map?.showScale !== false,
      classification: spec.map?.classification || "continuous",
      classCount: Number(spec.map?.classCount || 5),
      unmatchedStyle: spec.map?.unmatchedStyle || "muted",
      approvedMappings: Array.isArray(spec.map?.approvedMappings) ? spec.map.approvedMappings : [],
    },
  };
}

export function rawMapTopLevelErrors(input) {
  const errors = [];
  for (const key of Object.keys(input || {})) if (!TOP_LEVEL.has(key)) errors.push({ path: key, message: `Unknown top-level property '${key}'.` });
  return errors;
}

function normalizeField(input) {
  return {
    field: input.field || "",
    dataType: input.dataType || "category",
    label: input.label || labelFor(input.field),
    ...(input.format ? { format: input.format } : {}),
  };
}

function field(column, dataType) {
  return { field: column.name, dataType, label: labelFor(column.name) };
}

function guessRegionType(column) {
  const name = String(column.name || "").toLowerCase();
  if (/fips/.test(name)) return /county/.test(name) ? "us-county-fips" : "us-state-fips";
  if (/state/.test(name)) return "us-state-abbreviation";
  if (/country/.test(name)) return "country-name";
  return "region";
}

function labelFor(fieldName) {
  return String(fieldName || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
