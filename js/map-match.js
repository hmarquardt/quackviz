const STATE_NAME_TO_ABBR = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

export function normalizeRegionKey(value, keyType = "region") {
  const raw = String(value ?? "").trim();
  const simple = raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  if (keyType === "us-state-abbreviation") return raw.toUpperCase();
  if (keyType === "us-state-name") return STATE_NAME_TO_ABBR[simple] || simple;
  if (keyType === "us-state-fips") return raw.padStart(2, "0");
  if (keyType === "country-code-iso2") return raw.toUpperCase();
  if (keyType === "country-code-iso3") return raw.toUpperCase();
  if (keyType === "country-name") return simple;
  return simple;
}

export function matchRegions({ rows, regionField, regionType, boundary, approvedMappings = [] }) {
  const mapping = new Map((approvedMappings || []).map((item) => [String(item.sourceValue), item.boundaryValue]));
  const boundaryIndex = new Map();
  for (const feature of boundary.geojson.features || []) {
    for (const key of boundary.catalog.keyTypes || []) {
      const value = boundaryValue(feature.properties, key);
      if (value != null) boundaryIndex.set(normalizeRegionKey(value, key), feature);
    }
  }
  const dataValues = [...new Set((rows || []).map((row) => row[regionField]).filter((value) => value != null && value !== "").map(String))];
  const matches = new Map();
  const unmatchedValues = [];
  for (const value of dataValues) {
    const approved = mapping.get(value);
    const key = normalizeRegionKey(approved || value, regionType);
    const feature = boundaryIndex.get(key);
    if (feature) matches.set(value, feature);
    else unmatchedValues.push(value);
  }
  return {
    totalDataRegions: dataValues.length,
    matchedDataRegions: matches.size,
    unmatchedDataRegions: unmatchedValues.length,
    ambiguousDataRegions: 0,
    boundaryFeatures: boundary.geojson.features.length,
    matchedBoundaryFeatures: new Set([...matches.values()].map((feature) => feature.properties.name || feature.properties.abbr || feature.properties.iso3)).size,
    unmatchedValues,
    matchRate: dataValues.length ? matches.size / dataValues.length : 0,
    matches,
  };
}

function boundaryValue(properties, keyType) {
  if (keyType === "us-state-abbreviation") return properties.abbr;
  if (keyType === "us-state-name") return properties.name;
  if (keyType === "us-state-fips") return properties.fips;
  if (keyType === "country-code-iso2") return properties.iso2;
  if (keyType === "country-code-iso3") return properties.iso3;
  if (keyType === "country-name") return properties.name;
  return properties.name;
}
