const TYPES = ["vertical-bar", "horizontal-bar", "grouped-bar", "stacked-bar", "line", "area", "scatter", "bubble", "pie", "donut", "heatmap", "histogram", "boxplot"];

export function normalizeVisualizationSpec(spec) {
  const base = {
    version: 1,
    type: "vertical-bar",
    title: "Untitled visualization",
    subtitle: "",
    dataset: { queryId: null },
    encoding: { x: null, y: [], series: null, size: null, color: null },
    options: {
      stack: false,
      normalize: false,
      smooth: false,
      showPoints: true,
      legend: true,
      tooltip: "axis",
      zoom: true,
      labels: false,
      orientation: "vertical",
    },
  };
  return {
    ...base,
    ...spec,
    dataset: { ...base.dataset, ...(spec?.dataset || {}) },
    encoding: { ...base.encoding, ...(spec?.encoding || {}) },
    options: { ...base.options, ...(spec?.options || {}) },
  };
}

export function validateVisualizationSpec(spec) {
  const errors = [];
  const normalized = normalizeVisualizationSpec(spec || {});
  if (normalized.version !== 1) errors.push("Unsupported visualization spec version.");
  if (!TYPES.includes(normalized.type)) errors.push(`Unsupported chart type: ${normalized.type}`);
  if (!normalized.dataset?.queryId) errors.push("Spec must reference a queryId.");
  if (["pie", "donut", "histogram", "boxplot"].includes(normalized.type) === false && !normalized.encoding.x?.field) {
    errors.push("Spec requires an x field.");
  }
  if (!Array.isArray(normalized.encoding.y) || normalized.encoding.y.length === 0) errors.push("Spec requires at least one y field.");
  return { valid: errors.length === 0, errors, spec: normalized };
}

export function chartTypes() {
  return TYPES.slice();
}

