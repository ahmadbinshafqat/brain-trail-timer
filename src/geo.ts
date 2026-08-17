type Position = [number, number];

type GeoJSONLike = {
  type: string;
  coordinates?: unknown;
  geometry?: GeoJSONLike;
  features?: GeoJSONLike[];
};

export function computeDistanceKm(geojson: unknown): number {
  const lines = extractLineStrings(geojson as GeoJSONLike);
  if (lines.length === 0) {
    throw new Error('GeoJSON must contain a LineString or MultiLineString route.');
  }
  let total = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      total += haversineKm(line[i - 1], line[i]);
    }
  }
  return Math.round(total * 1000) / 1000;
}

export function extractLineStrings(obj: GeoJSONLike): Position[][] {
  if (!obj || typeof obj !== 'object') return [];

  if (obj.type === 'Feature' && obj.geometry) {
    return extractLineStrings(obj.geometry);
  }

  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    return obj.features.flatMap((feature) => extractLineStrings(feature));
  }

  if (obj.type === 'LineString' && Array.isArray(obj.coordinates)) {
    return [normalizeLine(obj.coordinates)];
  }

  if (obj.type === 'MultiLineString' && Array.isArray(obj.coordinates)) {
    return obj.coordinates.map((line) => normalizeLine(line));
  }

  return [];
}

function normalizeLine(value: unknown): Position[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map((point) => [Number(point[0]), Number(point[1])] as Position)
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

function haversineKm(a: Position, b: Position): number {
  const earthRadiusKm = 6371;
  const lon1 = toRad(a[0]);
  const lat1 = toRad(a[1]);
  const lon2 = toRad(b[0]);
  const lat2 = toRad(b[1]);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function toRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}
