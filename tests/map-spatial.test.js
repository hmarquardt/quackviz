import { rowsToPointGeoJson } from "../js/map-data.js";
import { matchRegions, normalizeRegionKey } from "../js/map-match.js";
import { inferGeographicSemantic, profileCoordinates, profileRegions } from "../js/spatial-profile.js";
import { loadBoundary } from "../js/map-boundaries.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rows = [
  { latitude: "40.1", longitude: "-75.2", segment: "A" },
  { latitude: 41, longitude: -76, segment: "B" },
  { latitude: null, longitude: -77, segment: "C" },
  { latitude: 120, longitude: 45, segment: "D" },
  { latitude: 0, longitude: 0, segment: "E" },
  { latitude: 40.1, longitude: -75.2, segment: "A" },
];

const spec = { encoding: { latitude: { field: "latitude" }, longitude: { field: "longitude" } } };

export const mapSpatialTests = [
  { name: "spatial: latitude semantic detection", run: () => assert(inferGeographicSemantic({ name: "latitude", type: "DOUBLE" }, [40, 41]).semanticType === "latitude", "lat not detected") },
  { name: "spatial: longitude semantic detection", run: () => assert(inferGeographicSemantic({ name: "lng", type: "DOUBLE" }, [-75, -76]).semanticType === "longitude", "lng not detected") },
  { name: "spatial: state abbreviation detection", run: () => assert(inferGeographicSemantic({ name: "state", type: "VARCHAR" }, ["CA", "NY"]).semanticType === "us-state-abbreviation", "state not detected") },
  { name: "spatial: free text false positive avoided", run: () => assert(inferGeographicSemantic({ name: "comment", type: "VARCHAR" }, ["near the river"]).semanticType === "unknown geography", "free text misdetected") },
  { name: "spatial: coordinate profile", run: () => { const profile = profileCoordinates(rows, "latitude", "longitude"); assert(profile.validPairCount === 4 && profile.invalidPairCount === 1 && profile.nullPairCount === 1, "profile counts wrong"); } },
  { name: "spatial: duplicate and zero coordinates", run: () => { const profile = profileCoordinates(rows, "latitude", "longitude"); assert(profile.duplicateCoordinateCount === 1 && profile.zeroZeroCount === 1, "duplicate or zero count wrong"); } },
  { name: "spatial: rows to geojson", run: () => { const result = rowsToPointGeoJson(rows, spec); assert(result.geojson.features.length === 4 && result.diagnostics.rejectedRowCount === 2, "geojson conversion wrong"); } },
  { name: "spatial: input not mutated", run: () => { const before = JSON.stringify(rows); rowsToPointGeoJson(rows, spec); assert(JSON.stringify(rows) === before, "rows mutated"); } },
  { name: "spatial: region profile", run: () => assert(profileRegions([{ state: "CA" }, { state: "CA" }, { state: "NY" }], "state").distinctCount === 2, "region profile wrong") },
  { name: "spatial: region normalization", run: () => assert(normalizeRegionKey("California", "us-state-name") === "CA", "state name not normalized") },
  { name: "spatial: state abbreviation matching", run: async () => { const boundary = await loadBoundary("us-states"); const match = matchRegions({ rows: [{ state: "CA" }, { state: "NY" }], regionField: "state", regionType: "us-state-abbreviation", boundary }); assert(match.matchRate === 1, "abbr match failed"); } },
  { name: "spatial: unmatched value reported", run: async () => { const boundary = await loadBoundary("us-states"); const match = matchRegions({ rows: [{ state: "N. Carolina" }], regionField: "state", regionType: "us-state-name", boundary }); assert(match.unmatchedDataRegions === 1, "unmatched not reported"); } },
  { name: "spatial: approved mapping", run: async () => { const boundary = await loadBoundary("us-states"); const match = matchRegions({ rows: [{ state: "N. Carolina" }], regionField: "state", regionType: "us-state-name", boundary, approvedMappings: [{ sourceValue: "N. Carolina", boundaryValue: "North Carolina" }] }); assert(match.matchRate === 1, "approved mapping failed"); } },
];
