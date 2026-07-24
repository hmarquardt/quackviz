import { createInteractionEvent, validateInteractionEvent } from "./interaction-events.js";

export function adaptEChartsClick(payload, source, field) {
  const value = payload?.name ?? payload?.value?.[field] ?? payload?.data?.[field];
  return validated(createInteractionEvent({ source: { ...source, renderer: "echarts" }, selection: { kind: "category", field, semanticType: "category", values: [value] } }));
}

export function adaptEChartsBrush(payload, source, field) {
  const range = payload?.range || payload?.areas?.[0]?.coordRange;
  return validated(createInteractionEvent({ source: { ...source, renderer: "echarts" }, selection: { kind: "numeric-range", field, semanticType: "number", min: range?.[0], max: range?.[1] }, modifiers: { range: true } }));
}

export function adaptEChartsLegend(payload, source, field) {
  const selected = Object.entries(payload?.selected || {}).filter(([, enabled]) => enabled).map(([name]) => name);
  return validated(createInteractionEvent({ source: { ...source, renderer: "echarts" }, selection: { kind: "legend", field, semanticType: "category", values: selected } }));
}

export function adaptMapLibreFeatureClick(feature, source, field, kind = "map-region") {
  const value = feature?.properties?.[field];
  return validated(createInteractionEvent({ source: { ...source, renderer: "maplibre" }, selection: { kind, field, semanticType: kind === "map-region" ? "region" : "category", values: [value], featureId: feature?.id ?? feature?.properties?.id ?? null, coordinates: feature?.geometry?.type === "Point" ? feature.geometry.coordinates : null } }));
}

export function adaptTableRowSelection(row, source, field) {
  return validated(createInteractionEvent({ source: { ...source, renderer: "table" }, selection: { kind: "table-row", field, semanticType: "identifier", values: [row?.[field]] } }));
}

function validated(event) {
  const validation = validateInteractionEvent(event);
  if (!validation.valid) {
    const error = new Error(validation.errors[0]?.message || "Invalid interaction event.");
    error.validation = validation;
    throw error;
  }
  return validation.event;
}
