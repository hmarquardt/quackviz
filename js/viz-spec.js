import { ORIENTATIONS, SUPPORTED_CHART_TYPES, TOOLTIP_MODES, VIZ_SPEC_VERSION } from "./constants.js";
import { defaultMapSpec, isMapSpec, normalizeMapSpec } from "./map-spec.js";
import { validateMapSpecSync } from "./map-validate.js";
import { deepClone } from "./utils.js";

const TOP_LEVEL = new Set(["version", "type", "title", "subtitle", "dataset", "encoding", "options"]);

export function defaultVisualizationSpec({ queryId = null, columns = [], type = "line" } = {}) {
  if (String(type).startsWith("map-")) return defaultMapSpec({ queryId, columns, type });
  const x = columns.find((column) => column.inferredType === "date") || columns.find((column) => column.inferredType !== "number") || columns[0];
  const y = columns.find((column) => column.inferredType === "number" && column.name !== x?.name) || columns.find((column) => column.inferredType === "number");
  return normalizeVisualizationSpec({
    version: VIZ_SPEC_VERSION,
    type,
    title: y ? `${labelFor(y.name)} by ${labelFor(x?.name || "x")}` : "Untitled visualization",
    subtitle: "",
    dataset: { queryId },
    encoding: {
      x: x ? { field: x.name, dataType: x.inferredType, label: labelFor(x.name) } : null,
      y: y ? [{ field: y.name, dataType: y.inferredType, label: labelFor(y.name), format: /revenue|cost|profit/i.test(y.name) ? "currency" : "number" }] : [],
      series: null,
      size: null,
      color: null,
    },
    options: { smooth: true, showPoints: false, zoom: true, legend: false },
  });
}

export function normalizeVisualizationSpec(input) {
  if (isMapSpec(input)) return normalizeMapSpec(input);
  const spec = deepClone(input || {});
  return {
    version: spec.version ?? VIZ_SPEC_VERSION,
    type: spec.type || "line",
    title: typeof spec.title === "string" ? spec.title : "Untitled visualization",
    subtitle: typeof spec.subtitle === "string" ? spec.subtitle : "",
    dataset: { queryId: spec.dataset?.queryId ?? null },
    encoding: {
      x: spec.encoding?.x ? normalizeField(spec.encoding.x) : null,
      y: Array.isArray(spec.encoding?.y) ? spec.encoding.y.map(normalizeField) : [],
      series: spec.encoding?.series ? normalizeField(spec.encoding.series) : null,
      size: spec.encoding?.size ? normalizeField(spec.encoding.size) : null,
      color: spec.encoding?.color ? normalizeField(spec.encoding.color) : null,
    },
    options: {
      stack: Boolean(spec.options?.stack),
      normalize: Boolean(spec.options?.normalize),
      smooth: spec.options?.smooth !== false,
      showPoints: Boolean(spec.options?.showPoints),
      legend: Boolean(spec.options?.legend),
      tooltip: spec.options?.tooltip ?? "axis",
      zoom: spec.options?.zoom !== false,
      labels: Boolean(spec.options?.labels),
      orientation: spec.options?.orientation || "vertical",
    },
  };
}

function normalizeField(field) {
  return {
    field: field.field || "",
    dataType: field.dataType || "string",
    label: field.label || labelFor(field.field || ""),
    ...(field.format ? { format: field.format } : {}),
  };
}

export function validateVisualizationSpec(input, dataset = { columns: [] }) {
  if (isMapSpec(input)) return validateMapSpecSync(input, dataset);
  const errors = [];
  if (containsExecutable(input)) errors.push({ path: "$", message: "Specification must not contain functions or executable strings." });
  for (const key of Object.keys(input || {})) {
    if (!TOP_LEVEL.has(key)) errors.push({ path: key, message: `Unknown top-level property '${key}'.` });
  }
  if (input && "title" in input && typeof input.title !== "string") errors.push({ path: "title", message: "Title must be a string." });
  validateRawOptions(input?.options, errors);
  const spec = normalizeVisualizationSpec(input);
  if (spec.version !== VIZ_SPEC_VERSION) errors.push({ path: "version", message: `Unsupported visualization spec version ${spec.version}.` });
  if (!SUPPORTED_CHART_TYPES.includes(spec.type)) errors.push({ path: "type", message: `Unsupported chart type '${spec.type}'.` });
  if (!spec.dataset.queryId) errors.push({ path: "dataset.queryId", message: "A saved query reference is required." });
  if (!spec.encoding.x?.field) errors.push({ path: "encoding.x.field", message: "X encoding is required." });
  if (!Array.isArray(spec.encoding.y) || spec.encoding.y.length === 0) errors.push({ path: "encoding.y", message: "At least one Y encoding is required." });
  validateOptions(spec, errors);
  validateFields(spec, dataset.columns || [], errors);
  return { valid: errors.length === 0, errors, spec };
}

function validateRawOptions(options, errors) {
  if (!options || typeof options !== "object") return;
  for (const key of ["stack", "normalize", "smooth", "showPoints", "legend", "zoom", "labels"]) {
    if (key in options && typeof options[key] !== "boolean") errors.push({ path: `options.${key}`, message: `${key} must be a boolean.` });
  }
  if ("tooltip" in options && !TOOLTIP_MODES.includes(options.tooltip)) errors.push({ path: "options.tooltip", message: "Tooltip must be 'axis', 'item', or false." });
  if ("orientation" in options && !ORIENTATIONS.includes(options.orientation)) errors.push({ path: "options.orientation", message: "Only vertical orientation is supported in this milestone." });
}

function validateOptions(spec, errors) {
  for (const key of ["stack", "normalize", "smooth", "showPoints", "legend", "zoom", "labels"]) {
    if (typeof spec.options[key] !== "boolean") errors.push({ path: `options.${key}`, message: `${key} must be a boolean.` });
  }
  if (!TOOLTIP_MODES.includes(spec.options.tooltip)) errors.push({ path: "options.tooltip", message: "Tooltip must be 'axis', 'item', or false." });
  if (!ORIENTATIONS.includes(spec.options.orientation)) errors.push({ path: "options.orientation", message: "Only vertical orientation is supported in this milestone." });
}

function validateFields(spec, columns, errors) {
  const byName = new Map(columns.map((column) => [column.name, column]));
  const check = (ref, path, numeric = false) => {
    if (!ref?.field) return;
    const column = byName.get(ref.field);
    if (!column) {
      errors.push({ path, message: `Field '${ref.field}' does not exist in the result dataset.` });
      return;
    }
    if (numeric && column.inferredType !== "number") errors.push({ path, message: `Field '${ref.field}' must be numeric for ${spec.type} charts.` });
  };
  check(spec.encoding.x, "encoding.x.field");
  spec.encoding.y.forEach((field, index) => check(field, `encoding.y.${index}.field`, true));
}

function containsExecutable(value) {
  if (typeof value === "function") return true;
  if (typeof value === "string") return /^\s*(function|\(?\s*[\w,\s]*\)?\s*=>)/.test(value);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsExecutable);
}

function labelFor(field) {
  return String(field || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function chartTypes() {
  return SUPPORTED_CHART_TYPES.slice();
}
