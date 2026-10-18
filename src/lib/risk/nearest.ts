/** Pins farther than this are not highlighted. The Data Engineer limit is still pending. */
export const NEAREST_PIN_KM = 25;

const EARTH_KM = 6371;

export function distanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latA = toRadians(latitudeA);
  const latB = toRadians(latitudeB);
  const deltaLat = latB - latA;
  const deltaLon = toRadians(longitudeB - longitudeA);
  const chord =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(chord)));
}

export type PinPoint = {
  id: string;
  latitude: number;
  longitude: number;
};

/** The closest pin at or within NEAREST_PIN_KM. Null when every pin is farther. */
export function nearestPin(
  latitude: number,
  longitude: number,
  places: readonly PinPoint[],
  limitKm = NEAREST_PIN_KM,
): { id: string; distanceKm: number } | null {
  let best: { id: string; distanceKm: number } | null = null;
  for (const place of places) {
    const distance = distanceKm(latitude, longitude, place.latitude, place.longitude);
    if (!best || distance < best.distanceKm) best = { id: place.id, distanceKm: distance };
  }
  if (!best || best.distanceKm > limitKm) return null;
  return best;
}
