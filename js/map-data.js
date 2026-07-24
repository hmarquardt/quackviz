export function rowsToPointGeoJson(rows, spec) {
  const latField = spec.encoding.latitude?.field;
  const lonField = spec.encoding.longitude?.field;
  const features = [];
  const rejectedRows = [];
  let nullCoordinateCount = 0;
  let invalidCoordinateCount = 0;
  let suspectedSwappedCoordinateCount = 0;
  (rows || []).forEach((row, index) => {
    const latRaw = row[latField];
    const lonRaw = row[lonField];
    if (latRaw == null || lonRaw == null || latRaw === "" || lonRaw === "") {
      nullCoordinateCount += 1;
      rejectedRows.push({ index, reason: "null-coordinate" });
      return;
    }
    const latitude = Number(latRaw);
    const longitude = Number(lonRaw);
    const valid = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
    if (!valid) {
      invalidCoordinateCount += 1;
      if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) > 90 && Math.abs(latitude) <= 180 && Math.abs(longitude) <= 90) suspectedSwappedCoordinateCount += 1;
      rejectedRows.push({ index, reason: "invalid-coordinate", latitude: latRaw, longitude: lonRaw });
      return;
    }
    features.push({
      type: "Feature",
      id: index,
      geometry: { type: "Point", coordinates: [longitude, latitude] },
      properties: safeProperties(row),
    });
  });
  return {
    geojson: { type: "FeatureCollection", features },
    diagnostics: {
      totalRows: rows?.length || 0,
      validFeatureCount: features.length,
      rejectedRowCount: rejectedRows.length,
      nullCoordinateCount,
      invalidCoordinateCount,
      suspectedSwappedCoordinateCount,
      rejectedRows: rejectedRows.slice(0, 100),
    },
  };
}

export function dataExtent(features) {
  const coords = (features || []).map((feature) => feature.geometry?.coordinates).filter(Boolean);
  if (!coords.length) return null;
  return coords.reduce((box, [lon, lat]) => [Math.min(box[0], lon), Math.min(box[1], lat), Math.max(box[2], lon), Math.max(box[3], lat)], [Infinity, Infinity, -Infinity, -Infinity]);
}

function safeProperties(row) {
  const properties = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") properties[key] = value;
    else properties[key] = String(value);
  }
  return properties;
}
