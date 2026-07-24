import { createMapInstance, disposeAllMaps, disposeMapInstance, getMapRendererStatus, renderMapInstance, resizeMapInstance } from "../js/map-renderer.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

class MapMock {
  constructor(options) {
    this.options = options;
    this.sources = new Map();
    this.layers = new Map();
    this.removed = false;
    this.resized = false;
  }
  addControl() {}
  loaded() { return true; }
  once(event, cb) { cb(); }
  setStyle(style) { this.style = style; }
  addSource(id, source) { this.sources.set(id, { ...source, setData: (data) => { this.sources.get(id).data = data; } }); }
  getSource(id) { return this.sources.get(id); }
  addLayer(layer) { this.layers.set(layer.id, layer); }
  getLayer(id) { return this.layers.get(id); }
  fitBounds(bounds) { this.bounds = bounds; }
  resize() { this.resized = true; }
  remove() { this.removed = true; }
}

const maplibregl = { Map: MapMock };
const container = () => ({ textContent: "", innerHTML: "" });
const compiled = { style: { version: 8, sources: {}, layers: [] }, sources: { points: { type: "geojson", data: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-75, 40] }, properties: {} }] } } }, layers: [{ id: "points", type: "circle", source: "points" }] };

export const mapRendererTests = [
  { name: "map-renderer: create instance", run: async () => { globalThis.ResizeObserver = ResizeObserverMock; await createMapInstance(container(), "map_test_1", { maplibregl }); assert(getMapRendererStatus().instanceCount >= 1, "instance missing"); disposeMapInstance("map_test_1"); } },
  { name: "map-renderer: render layers", run: async () => { globalThis.ResizeObserver = ResizeObserverMock; await createMapInstance(container(), "map_test_2", { maplibregl }); await renderMapInstance("map_test_2", compiled); assert(getMapRendererStatus().lastRenderDuration != null, "render not recorded"); disposeMapInstance("map_test_2"); } },
  { name: "map-renderer: multiple instances and dispose all", run: async () => { globalThis.ResizeObserver = ResizeObserverMock; await createMapInstance(container(), "map_test_3", { maplibregl }); await createMapInstance(container(), "map_test_4", { maplibregl }); resizeMapInstance("map_test_3"); disposeAllMaps(); assert(getMapRendererStatus().instanceCount === 0, "instances leaked"); } },
];
