import { APP_VERSION, EMBED_FORMAT_VERSION } from "./constants.js";
import { deepClone } from "./utils.js";

const ALLOWED_TYPES = ["visualization", "dashboard", "report"];
const ALLOWED_MESSAGES = ["ready", "resize", "set-filter", "clear-filter", "set-parameter", "export-image", "selection-changed", "error"];

export function createEmbedConfig(input = {}) {
  return {
    format: "quackviz-embed",
    formatVersion: EMBED_FORMAT_VERSION,
    artifactType: input.artifactType || "visualization",
    artifactId: input.artifactId || null,
    theme: ["system", "light", "dark"].includes(input.theme) ? input.theme : "system",
    height: Number(input.height || 480),
    capabilities: {
      filters: false,
      downloadImage: true,
      showMetadata: false,
      emitSelectionValues: false,
      ...(input.capabilities || {}),
    },
    metadata: { appVersion: APP_VERSION },
  };
}

export function validateEmbedConfig(config, workspace = {}) {
  const cfg = createEmbedConfig(config);
  const errors = [];
  if (config?.format !== "quackviz-embed") errors.push({ path: "format", message: "Unsupported embed format." });
  if (cfg.formatVersion !== EMBED_FORMAT_VERSION) errors.push({ path: "formatVersion", message: "Unsupported embed version." });
  if (!ALLOWED_TYPES.includes(cfg.artifactType)) errors.push({ path: "artifactType", message: "Unsupported artifact type." });
  if (!artifactExists(cfg, workspace)) errors.push({ path: "artifactId", message: "Referenced artifact is missing." });
  if (cfg.capabilities.rawSql) errors.push({ path: "capabilities.rawSql", message: "Embed mode does not accept raw SQL." });
  return { valid: errors.length === 0, errors, config: cfg };
}

export function validateEmbedMessage(message, { allowedOrigin, origin, config } = {}) {
  const errors = [];
  const payload = deepClone(message || {});
  if (allowedOrigin && origin !== allowedOrigin) errors.push({ path: "origin", message: "Message origin is not allowed." });
  if (payload.format !== "quackviz-embed-message") errors.push({ path: "format", message: "Unsupported embed message format." });
  if (payload.version !== EMBED_FORMAT_VERSION) errors.push({ path: "version", message: "Unsupported embed message version." });
  if (!ALLOWED_MESSAGES.includes(payload.type)) errors.push({ path: "type", message: "Unsupported embed message type." });
  if (payload.type === "set-filter" && config?.capabilities?.filters === false) errors.push({ path: "type", message: "Filters are disabled for this embed." });
  if (payload.payload?.sql) errors.push({ path: "payload.sql", message: "Embed messages cannot carry raw SQL." });
  return { valid: errors.length === 0, errors, message: payload };
}

export function createIframeSnippet(config, basePath = "./quackviz-embed/") {
  const cfg = createEmbedConfig(config);
  const src = `${basePath}index.html#artifact=${encodeURIComponent(cfg.artifactId || "")}&type=${encodeURIComponent(cfg.artifactType)}`;
  return `<iframe src="${src}" title="QuackViz ${cfg.artifactType}" height="${cfg.height}" loading="lazy"></iframe>`;
}

function artifactExists(config, workspace) {
  if (!config.artifactId) return false;
  if (config.artifactType === "dashboard") return (workspace.dashboards || []).some((item) => item.id === config.artifactId);
  if (config.artifactType === "report") return (workspace.reports || []).some((item) => item.id === config.artifactId);
  return (workspace.visualizations || []).some((item) => item.id === config.artifactId);
}
