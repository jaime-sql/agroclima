import { DEPARTMENTS, type DepartmentId } from "./weather/openmeteo.ts";

export { DEPARTMENTS, type DepartmentId };

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
