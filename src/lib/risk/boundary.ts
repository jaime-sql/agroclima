import boundary from "../../data/el-salvador-boundary.json" with { type: "json" };

/**
 * Natural Earth land polygon. GPS points only: listed places are not checked.
 * A point within EL_SALVADOR_BUFFER_KM of the line still counts as inside.
 */
export const EL_SALVADOR_BUFFER_KM = 1;

type Ring = number[][];

const polygons = boundary.geometry.coordinates as Ring[][];

const KM_PER_DEG_LAT = 110.574;

function kmPerDegLon(latitude: number): number {
  return 111.32 * Math.cos((latitude * Math.PI) / 180);
}

/** Ray cast. Ring positions are [lon, lat]. */
function ringContains(longitude: number, latitude: number, ring: Ring): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [lonA, latA] = ring[index];
    const [lonB, latB] = ring[previous];
    const crosses = latA > latitude !== latB > latitude;
    if (!crosses) continue;
    const edge = ((lonB - lonA) * (latitude - latA)) / (latB - latA) + lonA;
    if (longitude < edge) inside = !inside;
  }
  return inside;
}

function polygonContains(longitude: number, latitude: number, rings: Ring[]): boolean {
  if (!ringContains(longitude, latitude, rings[0])) return false;
  for (const hole of rings.slice(1)) {
    if (ringContains(longitude, latitude, hole)) return false;
  }
  return true;
}

function segmentDistanceKm(
  latitude: number,
  longitude: number,
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
): number {
  const xScale = kmPerDegLon(latitude);
  const pointX = longitude * xScale;
  const pointY = latitude * KM_PER_DEG_LAT;
  const startX = lonA * xScale;
  const startY = latA * KM_PER_DEG_LAT;
  const endX = lonB * xScale;
  const endY = latB * KM_PER_DEG_LAT;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const ratio =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / lengthSquared),
        );
  return Math.hypot(pointX - (startX + ratio * deltaX), pointY - (startY + ratio * deltaY));
}

function ringDistanceKm(latitude: number, longitude: number, ring: Ring): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [lonA, latA] = ring[index];
    const [lonB, latB] = ring[index + 1];
    const distance = segmentDistanceKm(latitude, longitude, latA, lonA, latB, lonB);
    if (distance < best) best = distance;
  }
  return best;
}

/** Kilometres from the land polygon. 0 when the point is inside. */
export function distanceToElSalvadorKm(latitude: number, longitude: number): number {
  if (polygons.some((rings) => polygonContains(longitude, latitude, rings))) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const rings of polygons) {
    for (const ring of rings) {
      const distance = ringDistanceKm(latitude, longitude, ring);
      if (distance < best) best = distance;
    }
  }
  return best;
}

/** `bufferKm` 0 is the land polygon. GPS uses EL_SALVADOR_BUFFER_KM. */
export function insideElSalvador(latitude: number, longitude: number, bufferKm = 0): boolean {
  return distanceToElSalvadorKm(latitude, longitude) <= bufferKm;
}
