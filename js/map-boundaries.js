export const BOUNDARY_CATALOG = [
  {
    id: "us-states",
    label: "US States",
    format: "geojson",
    source: "Built-in simplified sample boundary centroids and boxes",
    license: "Public domain source data simplified for QuackViz tests",
    attribution: "US Census Bureau, simplified",
    version: "2026-07-24-simplified",
    featureCount: 51,
    keyTypes: ["us-state-name", "us-state-abbreviation", "us-state-fips"],
    propertyKeys: { name: "name", abbreviation: "abbr", fips: "fips" },
  },
  {
    id: "world-countries",
    label: "World Countries",
    format: "geojson",
    source: "Built-in simplified country centroids and boxes",
    license: "Natural Earth public domain, simplified placeholder geometry",
    attribution: "Natural Earth, simplified",
    version: "2026-07-24-simplified",
    featureCount: 6,
    keyTypes: ["country-name", "country-code-iso2", "country-code-iso3"],
    propertyKeys: { name: "name", iso2: "iso2", iso3: "iso3" },
  },
  {
    id: "us-counties",
    label: "US Counties",
    format: "geojson",
    source: "Catalog entry only; detailed local file can be vendored later",
    license: "US Census Bureau public domain",
    attribution: "US Census Bureau",
    version: "not-vendored",
    featureCount: 0,
    keyTypes: ["us-county-name", "us-county-fips"],
    propertyKeys: { name: "name", fips: "fips" },
    unavailable: true,
  },
];

const STATE_ROWS = [
  ["01", "AL", "Alabama", -86.8, 32.8], ["02", "AK", "Alaska", -152.4, 64.2], ["04", "AZ", "Arizona", -111.7, 34.2],
  ["05", "AR", "Arkansas", -92.4, 34.9], ["06", "CA", "California", -119.5, 36.8], ["08", "CO", "Colorado", -105.5, 39.0],
  ["09", "CT", "Connecticut", -72.7, 41.6], ["10", "DE", "Delaware", -75.5, 39.0], ["11", "DC", "District of Columbia", -77.0, 38.9],
  ["12", "FL", "Florida", -81.7, 27.8], ["13", "GA", "Georgia", -83.4, 32.7], ["15", "HI", "Hawaii", -157.5, 20.9],
  ["16", "ID", "Idaho", -114.6, 44.1], ["17", "IL", "Illinois", -89.4, 40.0], ["18", "IN", "Indiana", -86.1, 39.9],
  ["19", "IA", "Iowa", -93.5, 42.1], ["20", "KS", "Kansas", -98.4, 38.5], ["21", "KY", "Kentucky", -85.3, 37.5],
  ["22", "LA", "Louisiana", -91.9, 30.9], ["23", "ME", "Maine", -69.2, 45.3], ["24", "MD", "Maryland", -76.8, 39.0],
  ["25", "MA", "Massachusetts", -71.8, 42.3], ["26", "MI", "Michigan", -85.6, 44.3], ["27", "MN", "Minnesota", -94.6, 46.3],
  ["28", "MS", "Mississippi", -89.7, 32.7], ["29", "MO", "Missouri", -92.5, 38.4], ["30", "MT", "Montana", -110.4, 47.0],
  ["31", "NE", "Nebraska", -99.8, 41.5], ["32", "NV", "Nevada", -116.6, 39.3], ["33", "NH", "New Hampshire", -71.6, 43.7],
  ["34", "NJ", "New Jersey", -74.7, 40.1], ["35", "NM", "New Mexico", -106.1, 34.4], ["36", "NY", "New York", -75.5, 42.9],
  ["37", "NC", "North Carolina", -79.0, 35.5], ["38", "ND", "North Dakota", -100.5, 47.5], ["39", "OH", "Ohio", -82.8, 40.3],
  ["40", "OK", "Oklahoma", -97.5, 35.6], ["41", "OR", "Oregon", -120.6, 44.0], ["42", "PA", "Pennsylvania", -77.8, 41.0],
  ["44", "RI", "Rhode Island", -71.6, 41.7], ["45", "SC", "South Carolina", -80.9, 33.8], ["46", "SD", "South Dakota", -100.2, 44.4],
  ["47", "TN", "Tennessee", -86.4, 35.8], ["48", "TX", "Texas", -99.3, 31.5], ["49", "UT", "Utah", -111.7, 39.3],
  ["50", "VT", "Vermont", -72.7, 44.1], ["51", "VA", "Virginia", -78.8, 37.5], ["53", "WA", "Washington", -120.7, 47.4],
  ["54", "WV", "West Virginia", -80.6, 38.6], ["55", "WI", "Wisconsin", -89.8, 44.6], ["56", "WY", "Wyoming", -107.6, 43.0],
];

const COUNTRY_ROWS = [
  ["United States", "US", "USA", -98, 39], ["Canada", "CA", "CAN", -106, 57], ["Mexico", "MX", "MEX", -102, 23],
  ["United Kingdom", "GB", "GBR", -2, 54], ["France", "FR", "FRA", 2, 47], ["Germany", "DE", "DEU", 10, 51],
];

const cache = new Map();
let lastLoad = { boundaryId: null, durationMs: null, error: null };

export function boundaryCatalog() {
  return BOUNDARY_CATALOG.map((item) => ({ ...item }));
}

export function getBoundaryStatus() {
  return { catalogCount: BOUNDARY_CATALOG.length, loadedBoundaryCount: cache.size, ...lastLoad };
}

export async function loadBoundary(boundaryId) {
  const started = performance.now?.() || Date.now();
  const entry = BOUNDARY_CATALOG.find((item) => item.id === boundaryId);
  if (!entry) throw new Error(`Unknown boundary '${boundaryId}'.`);
  if (entry.unavailable) throw new Error(`Boundary '${boundaryId}' is cataloged but not vendored in this milestone.`);
  if (!cache.has(boundaryId)) cache.set(boundaryId, boundaryGeoJson(boundaryId));
  lastLoad = { boundaryId, durationMs: Math.round((performance.now?.() || Date.now()) - started), error: null };
  return { catalog: { ...entry }, geojson: cache.get(boundaryId) };
}

function boundaryGeoJson(boundaryId) {
  const rows = boundaryId === "us-states" ? STATE_ROWS : COUNTRY_ROWS;
  return {
    type: "FeatureCollection",
    features: rows.map((row) => {
      const [fipsOrName, abbrOrIso2, nameOrIso3, lon, lat] = row;
      const isState = boundaryId === "us-states";
      const properties = isState
        ? { fips: fipsOrName, abbr: abbrOrIso2, name: nameOrIso3 }
        : { name: fipsOrName, iso2: abbrOrIso2, iso3: nameOrIso3 };
      return { type: "Feature", properties, geometry: box(lon, lat, isState ? 1.8 : 4) };
    }),
  };
}

function box(lon, lat, span) {
  return { type: "Polygon", coordinates: [[[lon - span, lat - span], [lon + span, lat - span], [lon + span, lat + span], [lon - span, lat + span], [lon - span, lat - span]]] };
}
