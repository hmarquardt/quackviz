import { boundaryCatalog, loadBoundary } from "./map-boundaries.js";
import { rowsToPointGeoJson } from "./map-data.js";
import { matchRegions } from "./map-match.js";
import { normalizeMapSpec } from "./map-spec.js";
import { validateMapSpec } from "./map-validate.js";

const PALETTE = ["#167c72", "#4c78a8", "#f58518", "#e45756", "#72b7b2", "#54a24b", "#b279a2", "#ff9da6", "#9d755d", "#bab0ab", "#6f4e7c", "#2f4b7c"];

export async function compileMapSpec(inputSpec, dataset, themeTokens = {}) {
  const validation = await validateMapSpec(inputSpec, dataset);
  if (!validation.valid) {
    const error = new Error("Map spec is invalid.");
    error.validation = validation;
    throw error;
  }
  const spec = normalizeMapSpec(validation.spec);
  if (spec.type === "map-choropleth") return compileChoropleth(spec, dataset, themeTokens, validation.warnings);
  return compilePointMap(spec, dataset, themeTokens, validation.warnings);
}

function compilePointMap(spec, dataset, themeTokens, warnings) {
  const converted = rowsToPointGeoJson(dataset.rows || [], spec);
  const colorField = spec.encoding.color?.field;
  const sizeField = spec.encoding.size?.field;
  const categories = colorField ? [...new Set(converted.geojson.features.map((feature) => feature.properties[colorField]).filter((value) => value != null))].sort() : [];
  const colorExpression = categories.length
    ? ["match", ["to-string", ["get", colorField]], ...categories.flatMap((value, index) => [String(value), PALETTE[index % PALETTE.length]]), themeTokens.accent || PALETTE[0]]
    : themeTokens.accent || PALETTE[0];
  const values = sizeField ? converted.geojson.features.map((feature) => Number(feature.properties[sizeField])).filter(Number.isFinite) : [];
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const circleRadius = sizeField ? ["interpolate", ["linear"], ["coalesce", ["to-number", ["get", sizeField]], min], min, 5, max || min + 1, 22] : 6;
  const cluster = spec.type === "map-clustered-point" || spec.map.cluster;
  return {
    renderer: "maplibre",
    spec,
    style: basemapStyle(spec.map.style, themeTokens),
    sources: {
      quackviz_points: { type: "geojson", data: converted.geojson, cluster, clusterRadius: spec.map.clusterRadius, clusterMaxZoom: spec.map.clusterMaxZoom },
    },
    layers: [
      ...(cluster ? [
        { id: "clusters", type: "circle", source: "quackviz_points", filter: ["has", "point_count"], paint: { "circle-color": themeTokens.accent || "#167c72", "circle-radius": ["step", ["get", "point_count"], 14, 25, 20, 100, 28], "circle-opacity": 0.78 } },
        { id: "cluster-count", type: "symbol", source: "quackviz_points", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 }, paint: { "text-color": "#ffffff" } },
      ] : []),
      { id: "points", type: "circle", source: "quackviz_points", filter: cluster ? ["!", ["has", "point_count"]] : undefined, paint: { "circle-color": colorExpression, "circle-radius": circleRadius, "circle-opacity": 0.78, "circle-stroke-color": themeTokens.background || "#fff", "circle-stroke-width": 1 } },
    ],
    legend: legendFor({ spec, categories, min, max, themeTokens }),
    tooltip: { enabled: spec.map.showTooltip, fields: tooltipFields(spec, dataset.columns || []) },
    diagnostics: converted.diagnostics,
    warnings,
    attribution: "Data layer: local QuackViz result dataset. Basemap: blank/local unless a remote style is selected later.",
  };
}

async function compileChoropleth(spec, dataset, themeTokens, warnings) {
  const boundary = await loadBoundary(spec.encoding.region.boundary);
  const match = matchRegions({ rows: dataset.rows || [], regionField: spec.encoding.region.field, regionType: spec.encoding.region.dataType, boundary, approvedMappings: spec.map.approvedMappings });
  const valueField = spec.encoding.value.field;
  const valueByRegion = new Map((dataset.rows || []).map((row) => [String(row[spec.encoding.region.field]), Number(row[valueField])]));
  const features = boundary.geojson.features.map((feature) => {
    const source = [...match.matches.entries()].find(([, matched]) => matched === feature)?.[0];
    return { ...feature, properties: { ...feature.properties, __quackviz_value: source != null ? valueByRegion.get(source) : null, __quackviz_source: source || null } };
  });
  const values = features.map((feature) => feature.properties.__quackviz_value).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  return {
    renderer: "maplibre",
    spec,
    style: basemapStyle(spec.map.style, themeTokens),
    sources: { quackviz_regions: { type: "geojson", data: { type: "FeatureCollection", features } } },
    layers: [
      { id: "regions", type: "fill", source: "quackviz_regions", paint: { "fill-color": ["interpolate", ["linear"], ["coalesce", ["to-number", ["get", "__quackviz_value"]], min], min, "#d9f0f0", max || min + 1, themeTokens.accent || "#167c72"], "fill-opacity": 0.78 } },
      { id: "region-lines", type: "line", source: "quackviz_regions", paint: { "line-color": themeTokens.border || "#d5dce5", "line-width": 1 } },
    ],
    legend: { type: "continuous", title: spec.encoding.value.label, min, max, format: spec.encoding.value.format || "number" },
    tooltip: { enabled: spec.map.showTooltip, fields: [spec.encoding.region.field, valueField] },
    diagnostics: { regionMatch: { ...match, matches: undefined } },
    warnings,
    attribution: boundary.catalog.attribution,
  };
}

function basemapStyle(style, themeTokens) {
  const background = style === "dark" ? "#101418" : (themeTokens.background || "#ffffff");
  return { version: 8, glyphs: "", sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": background } }] };
}

function tooltipFields(spec, columns) {
  const explicit = spec.encoding.tooltip.map((field) => field.field);
  return explicit.length ? explicit : columns.slice(0, 6).map((column) => column.name);
}

function legendFor({ spec, categories, min, max }) {
  if (categories.length) return { type: "category", title: spec.encoding.color?.label || "Category", items: categories.map((value, index) => ({ value, color: PALETTE[index % PALETTE.length] })) };
  if (spec.encoding.size) return { type: "size", title: spec.encoding.size.label, min, max, scale: "linear" };
  return spec.map.showLegend ? { type: "symbol", title: spec.title } : null;
}
