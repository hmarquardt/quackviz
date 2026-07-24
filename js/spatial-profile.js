const STATE_ABBR = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "));

export function inferGeographicSemantic(column, values = []) {
  const name = String(column.name || "").toLowerCase();
  const numeric = values.map(Number).filter(Number.isFinite);
  const strings = values.filter((value) => value != null && value !== "").map((value) => String(value).trim());
  const reasons = [];
  let semanticType = "unknown geography";
  let confidence = 0.2;
  if (/^(lat|latitude|y_lat|geo_lat)$/.test(name) && numeric.length && numeric.every((value) => value >= -90 && value <= 90)) {
    semanticType = "latitude"; confidence = 0.98; reasons.push("Column name indicates latitude.", "Values are within -90 to 90.");
  } else if (/^(lon|lng|longitude|x_lon|geo_lon)$/.test(name) && numeric.length && numeric.every((value) => value >= -180 && value <= 180)) {
    semanticType = "longitude"; confidence = 0.98; reasons.push("Column name indicates longitude.", "Values are within -180 to 180.");
  } else if (/country/.test(name) && strings.every((value) => /^[A-Z]{2}$/i.test(value))) {
    semanticType = "country-code-iso2"; confidence = 0.9; reasons.push("Column name references country.", "Values look like ISO alpha-2 codes.");
  } else if (/country/.test(name) && strings.every((value) => /^[A-Z]{3}$/i.test(value))) {
    semanticType = "country-code-iso3"; confidence = 0.9; reasons.push("Column name references country.", "Values look like ISO alpha-3 codes.");
  } else if (/state/.test(name) && strings.every((value) => STATE_ABBR.has(value.toUpperCase()))) {
    semanticType = "us-state-abbreviation"; confidence = 0.92; reasons.push("Column name references state.", "Values match US state abbreviations.");
  } else if (/state.*fips|fips.*state/.test(name) || (/(^|_)fips$/.test(name) && strings.every((value) => /^\d{2}$/.test(value)))) {
    semanticType = "us-state-fips"; confidence = 0.86; reasons.push("Values look like two-digit state FIPS codes.");
  } else if (/county.*fips|fips.*county/.test(name) || strings.every((value) => /^\d{5}$/.test(value)) && /fips/.test(name)) {
    semanticType = "us-county-fips"; confidence = 0.86; reasons.push("Values look like five-digit county FIPS codes.");
  } else if (/zip|postal/.test(name) && strings.every((value) => /^\d{5}(-\d{4})?$/.test(value))) {
    semanticType = /zip/.test(name) ? "ZIP code" : "postal code"; confidence = 0.86; reasons.push("Values look like postal codes.");
  } else if (/city/.test(name)) {
    semanticType = "city"; confidence = 0.65; reasons.push("Column name references city; no geocoding is performed.");
  } else if (/region|territory|market/.test(name)) {
    semanticType = "region"; confidence = 0.6; reasons.push("Column name references a region.");
  } else if (/geojson/.test(name)) {
    semanticType = "GeoJSON geometry"; confidence = 0.75; reasons.push("Column name references GeoJSON geometry.");
  } else if (/wkt|geometry/.test(name)) {
    semanticType = "WKT"; confidence = 0.7; reasons.push("Column name references geometry text.");
  }
  return { semanticType, semanticConfidence: confidence, semanticReasons: reasons };
}

export function profileCoordinates(rows, latitudeField, longitudeField) {
  const seen = new Set();
  let validPairCount = 0;
  let invalidPairCount = 0;
  let nullPairCount = 0;
  let zeroZeroCount = 0;
  let swappedCoordinateCount = 0;
  const bounds = { minLatitude: Infinity, maxLatitude: -Infinity, minLongitude: Infinity, maxLongitude: -Infinity };
  for (const row of rows || []) {
    const latRaw = row[latitudeField];
    const lonRaw = row[longitudeField];
    if (latRaw == null || lonRaw == null || latRaw === "" || lonRaw === "") { nullPairCount += 1; continue; }
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    const validLat = Number.isFinite(lat) && lat >= -90 && lat <= 90;
    const validLon = Number.isFinite(lon) && lon >= -180 && lon <= 180;
    if (!validLat || !validLon) {
      invalidPairCount += 1;
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) > 90 && Math.abs(lat) <= 180 && Math.abs(lon) <= 90) swappedCoordinateCount += 1;
      continue;
    }
    validPairCount += 1;
    if (lat === 0 && lon === 0) zeroZeroCount += 1;
    seen.add(`${lat.toFixed(6)},${lon.toFixed(6)}`);
    bounds.minLatitude = Math.min(bounds.minLatitude, lat);
    bounds.maxLatitude = Math.max(bounds.maxLatitude, lat);
    bounds.minLongitude = Math.min(bounds.minLongitude, lon);
    bounds.maxLongitude = Math.max(bounds.maxLongitude, lon);
  }
  return {
    totalRows: rows?.length || 0,
    validLatitudeCount: validPairCount,
    validLongitudeCount: validPairCount,
    validPairCount,
    invalidPairCount,
    nullPairCount,
    minLatitude: Number.isFinite(bounds.minLatitude) ? bounds.minLatitude : null,
    maxLatitude: Number.isFinite(bounds.maxLatitude) ? bounds.maxLatitude : null,
    minLongitude: Number.isFinite(bounds.minLongitude) ? bounds.minLongitude : null,
    maxLongitude: Number.isFinite(bounds.maxLongitude) ? bounds.maxLongitude : null,
    boundingBox: Number.isFinite(bounds.minLatitude) ? [bounds.minLongitude, bounds.minLatitude, bounds.maxLongitude, bounds.maxLatitude] : null,
    duplicateCoordinateCount: validPairCount - seen.size,
    distinctCoordinateCount: seen.size,
    zeroZeroCount,
    suspectedSwappedCoordinateCount: swappedCoordinateCount,
    profiledAt: new Date().toISOString(),
  };
}

export function profileRegions(rows, field) {
  const values = (rows || []).map((row) => row[field]).filter((value) => value != null && value !== "");
  const distinct = [...new Set(values.map((value) => String(value).trim()))];
  return { field, valueCount: values.length, distinctCount: distinct.length, values: distinct.slice(0, 100), profiledAt: new Date().toISOString() };
}
