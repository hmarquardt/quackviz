import { DEPENDENCIES } from "./constants.js";
import { compileMapSpec } from "./map-compiler.js";
import { adaptMapLibreFeatureClick } from "./selection-adapters.js";

let maplibreModule = null;
const instances = new Map();
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
    maplibreModule = await import(DEPENDENCIES.maplibre.url);
    status.maplibreRuntimeVersion = maplibreModule.version || maplibreModule.default?.version || "unknown";
  }
  return maplibreModule.default || maplibreModule;
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

export async function renderMapInstance(instanceId, compiledMap) {
  const entry = instances.get(instanceId);
  if (!entry) throw new Error(`Map instance '${instanceId}' does not exist.`);
  const started = performance.now?.() || Date.now();
  const map = entry.map;
  await mapReady(map);
  if (map.setStyle) {
    map.setStyle(compiledMap.style);
    await mapReady(map);
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
}

export function resizeMapInstance(instanceId) {
  instances.get(instanceId)?.map.resize();
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
  try {
    const compiled = await compileMapSpec(spec, dataset, themeTokens);
    await createMapInstance(element, instanceId, { style: compiled.style, center: spec.map?.center || undefined, zoom: spec.map?.zoom ?? undefined });
    await renderMapInstance(instanceId, compiled);
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

function blankStyle() {
  return { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#fff" } }] };
}

async function ensureCss() {
  if (typeof document === "undefined" || document.querySelector(`link[href="${DEPENDENCIES.maplibre.cssUrl}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = DEPENDENCIES.maplibre.cssUrl;
  document.head.appendChild(link);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
