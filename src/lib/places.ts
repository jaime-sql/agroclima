/**
 * Seats of the three departments (GeoNames PPLA), not polygon centroids
 * and not a farm. Retrieved 2026-10-11.
 * Swap these numbers here when the coffee-zone coordinates arrive.
 * Santa Ana 13.98827, -89.55685 — https://www.geonames.org/3583334/santa-ana.html
 * Ahuachapán 13.92403, -89.84344 — https://www.geonames.org/3587426/ahuachapan.html
 * Chalatenango 14.04138, -88.93951 — https://www.geonames.org/3587091/chalatenango.html
 */
export const PLACE_COORDINATES = {
  "santa-ana": { latitude: 13.98827, longitude: -89.55685 },
  ahuachapan: { latitude: 13.92403, longitude: -89.84344 },
  chalatenango: { latitude: 14.04138, longitude: -88.93951 },
} as const;

export const DEPARTMENTS = [
  { id: "santa-ana", name: "Santa Ana", ...PLACE_COORDINATES["santa-ana"] },
  { id: "ahuachapan", name: "Ahuachapán", ...PLACE_COORDINATES.ahuachapan },
  { id: "chalatenango", name: "Chalatenango", ...PLACE_COORDINATES.chalatenango },
] as const;

export type DepartmentId = (typeof DEPARTMENTS)[number]["id"];

export type Place = (typeof DEPARTMENTS)[number];

export function placeById(id: string): Place | null {
  return DEPARTMENTS.find((place) => place.id === id) ?? null;
}

/** Nearest of the three preset seats. Squared degrees are enough at this scale. */
export function nearestPlace(latitude: number, longitude: number): Place {
  let best: Place = DEPARTMENTS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const place of DEPARTMENTS) {
    const latitudeDelta = place.latitude - latitude;
    const longitudeDelta = place.longitude - longitude;
    const distance = latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;
    if (distance < bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }
  return best;
}
