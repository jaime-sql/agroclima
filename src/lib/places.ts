/**
 * Representative coffee-zone points (ISC origin zones Apaneca-Ilamatepec
 * and Alotepec), not the user's farm. Elevations are meters.
 * Swap latitude, longitude, and elevation in this object.
 */
export const PLACE_COORDINATES = {
  "santa-ana": { latitude: 13.88, longitude: -89.61, elevation: 1432 },
  ahuachapan: { latitude: 13.855, longitude: -89.835, elevation: 1290 },
  chalatenango: { latitude: 14.33, longitude: -89.16, elevation: 1237 },
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
