import { DEPENDENCIES } from "./constants.js";
import { compileMapSpec } from "./map-compiler.js";
import { adaptMapLibreFeatureClick } from "./selection-adapters.js";

let maplibreModule = null;
const instances = new Map();
const renderGenerations = new Map();
let status = {
  maplibrePackageVersion: DEPENDENCIES.maplibre.version,
  maplibreRuntimeVersion: "not loaded",
  instanceCount: 0,
  lastRenderDuration: null,
  lastExportAt: null,
  error: null,
};

export async function loadMapLibre() {
  if (!maplibreModule) {
    await ensureCss();
    await loadMapLibreScript();
    maplibreModule = globalThis.maplibregl;
    status.maplibreRuntimeVersion = maplibreModule.version || maplibreModule.default?.version || DEPENDENCIES.maplibre.version;
  }
  return maplibreModule.default || maplibreModule;
}

export function getMapInstanceDiagnostics(instanceId) {
  const map = instances.get(instanceId)?.map;
  if (!map) return null;
  const style = map.getStyle?.();
  return {
    runtimeVersion: status.maplibreRuntimeVersion,
    sourceIds: Object.keys(style?.sources || {}),
    layerIds: (style?.layers || []).map((layer) => layer.id),
    featureCount: instances.get(instanceId)?.compiled?.sources?.quackviz_points?.data?.features?.length
      ?? instances.get(instanceId)?.compiled?.sources?.quackviz_regions?.data?.features?.length
      ?? 0,
    removed: Boolean(map._removed),
  };
}

export function getMapRendererStatus() {
  return { ...status, instanceCount: instances.size };
}

export async function createMapInstance(container, instanceId, options = {}) {
  const maplibregl = options.maplibregl || await loadMapLibre();
  const existing = instances.get(instanceId);
  if (existing?.container === container) return existing.map;
  if (existing) disposeMapInstance(instanceId);
  container.textContent = "";
  const map = new maplibregl.Map({
    container,
    style: options.style || blankStyle(),
    center: options.center || [0, 20],
    zoom: options.zoom ?? 1,
    attributionControl: false,
    preserveDrawingBuffer: true,
  });
  if (maplibregl.AttributionControl) map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
  if (maplibregl.ScaleControl) map.addControl(new maplibregl.ScaleControl(), "bottom-left");
  const observer = new ResizeObserver(() => map.resize());
  observer.observe(container);
  instances.set(instanceId, { map, container, observer, compiled: null, handlers: [] });
  return map;
}

export async function renderMapInstance(instanceId, compiledMap, isCurrent = () => true) {
  const entry = instances.get(instanceId);
  if (!entry) throw new Error(`Map instance '${instanceId}' does not exist.`);
  const started = performance.now?.() || Date.now();
  const map = entry.map;
  await mapReady(map);
  if (!isCurrent()) return false;
  if (map.setStyle) {
    await replaceStyle(map, compiledMap.style);
    if (!isCurrent()) return false;
  }
  for (const [id, source] of Object.entries(compiledMap.sources || {})) {
    if (map.getSource?.(id)) map.getSource(id).setData?.(source.data);
    else map.addSource(id, source);
  }
  for (const layer of compiledMap.layers || []) {
    if (!map.getLayer?.(layer.id)) map.addLayer(layer);
  }
  fitCompiledMap(map, compiledMap);
  entry.compiled = compiledMap;
  status.lastRenderDuration = Math.round((performance.now?.() || Date.now()) - started);
  status.error = null;
  return true;
}

export function resizeMapInstance(instanceId) {
  instances.get(instanceId)?.map.resize();
}

export function waitForMapIdle(instanceId, timeoutMs = 5000) {
  const map = instances.get(instanceId)?.map;
  if (!map) return Promise.reject(new Error(`Map instance '${instanceId}' does not exist.`));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Map instance '${instanceId}' did not become idle within ${timeoutMs} ms.`)), timeoutMs);
    map.once("idle", () => {
      clearTimeout(timeout);
      resolve();
    });
    map.triggerRepaint?.();
  });
}

export function disposeMapInstance(instanceId) {
  const entry = instances.get(instanceId);
  if (!entry) return;
  for (const handler of entry.handlers || []) entry.map.off?.("click", handler.layerId, handler.fn);
  entry.observer.disconnect();
  entry.map.remove();
  instances.delete(instanceId);
}

export function disposeAllMaps() {
  for (const id of [...instances.keys()]) disposeMapInstance(id);
}

export async function renderMapVisualization(element, spec, dataset, themeTokens, instanceId = "map_main", interaction = null) {
  const generation = (renderGenerations.get(instanceId) || 0) + 1;
  renderGenerations.set(instanceId, generation);
  const isCurrent = () => renderGenerations.get(instanceId) === generation;
  try {
    const compiled = await compileMapSpec(spec, dataset, themeTokens);
    if (!isCurrent()) return compiled;
    await createMapInstance(element, instanceId, { style: compiled.style, center: spec.map?.center || undefined, zoom: spec.map?.zoom ?? undefined });
    if (!isCurrent()) return compiled;
    const rendered = await renderMapInstance(instanceId, compiled, isCurrent);
    if (!rendered) return compiled;
    bindMapInteraction(instanceId, spec, interaction);
    return compiled;
  } catch (error) {
    status.error = error.message;
    disposeMapInstance(instanceId);
    element.innerHTML = `<div class="empty-state">Map failed to render: ${escapeHtml(error.message)}</div>`;
    throw error;
  }
}

function bindMapInteraction(instanceId, spec, interaction) {
  const entry = instances.get(instanceId);
  if (!entry?.map) return;
  for (const handler of entry.handlers || []) entry.map.off?.("click", handler.layerId, handler.fn);
  entry.handlers = [];
  if (!interaction?.onEvent) return;
  const field = spec.encoding?.region?.field || spec.encoding?.label?.field || spec.encoding?.color?.field;
  if (!field) return;
  const kind = spec.encoding?.region?.field ? "map-region" : "map-feature";
  const layerIds = (entry.compiled?.layers || []).filter((layer) => ["circle", "fill"].includes(layer.type)).map((layer) => layer.id);
  for (const layerId of layerIds) {
    const fn = (payload) => {
      try {
        const feature = payload?.features?.[0];
        if (feature) interaction.onEvent(adaptMapLibreFeatureClick(feature, interaction.source || {}, field, kind));
      } catch (error) {
        interaction.onError?.(error);
      }
    };
    entry.map.on?.("click", layerId, fn);
    entry.handlers.push({ layerId, fn });
  }
}

export function exportMapImage(instanceId) {
  const entry = instances.get(instanceId);
  if (!entry) throw new Error(`Map instance '${instanceId}' does not exist.`);
  try {
    const dataUrl = entry.map.getCanvas().toDataURL("image/png");
    status.lastExportAt = new Date().toISOString();
    return dataUrl;
  } catch (error) {
    status.error = error.message;
    throw new Error(`Map image export failed. Tile CORS or WebGL settings may prevent export: ${error.message}`);
  }
}

function fitCompiledMap(map, compiled) {
  const features = Object.values(compiled.sources || {}).flatMap((source) => source.data?.features || []);
  const coords = features.flatMap((feature) => coordinates(feature.geometry));
  if (!coords.length || !map.fitBounds) return;
  const bounds = coords.reduce((box, [lon, lat]) => [Math.min(box[0], lon), Math.min(box[1], lat), Math.max(box[2], lon), Math.max(box[3], lat)], [Infinity, Infinity, -Infinity, -Infinity]);
  if (bounds.every(Number.isFinite)) map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 28, maxZoom: 10, duration: 0 });
}

function coordinates(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "Polygon") return geometry.coordinates.flat();
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
  return [];
}

function mapReady(map) {
  if (!map.once || map.loaded?.()) return Promise.resolve();
  return new Promise((resolve) => map.once("load", resolve));
}

function replaceStyle(map, style) {
  if (!map.once) {
    map.setStyle(style);
    return Promise.resolve();
  }
  const ready = new Promise((resolve) => map.once("style.load", resolve));
  map.setStyle(style);
  return map.isStyleLoaded?.() ? Promise.resolve() : ready;
}

function blankStyle() {
  return { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#fff" } }] };
}

async function ensureCss() {
  const href = new URL(DEPENDENCIES.maplibre.cssUrl, import.meta.url).href;
  if (typeof document === "undefined" || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadMapLibreScript() {
  if (globalThis.maplibregl) return Promise.resolve();
  const src = new URL(DEPENDENCIES.maplibre.url, import.meta.url).href;
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Local MapLibre dependency failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Local MapLibre dependency failed to load."));
    document.head.appendChild(script);
  });
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
