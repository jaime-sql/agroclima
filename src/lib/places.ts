import locations from "../data/locations.json" with { type: "json" };

/**
 * Municipal coordinates for the picker. The only list is src/data/locations.json.
 * lat/lon come from each row's source. elevation_m is optional and is not sent
 * to the forecast. This file does not rank soil, pH, or planting suitability.
 */
export const COORD_TYPES = ["town_centre", "slope_point"] as const;

export type CoordType = (typeof COORD_TYPES)[number];

export type LocationRecord = {
  id: string;
  name: string;
  department: string;
  lat: number;
  lon: number;
  elevation_m?: number;
  coord_type: CoordType;
  source: string;
};

/** Mainland El Salvador, with a small margin around the frontier. */
export const EL_SALVADOR_LATITUDE = { min: 13.1, max: 14.5 } as const;
export const EL_SALVADOR_LONGITUDE = { min: -90.2, max: -87.6 } as const;

export const PRESET_PLACE_IDS = ["santa-ana", "ahuachapan", "chalatenango"] as const;

export const LOCATION_RECORDS = locations as LocationRecord[];

export type Place = {
  id: string;
  name: string;
  department: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  coordType: CoordType;
  source: string;
};

export const PLACES: Place[] = LOCATION_RECORDS.map((record) => ({
  id: record.id,
  name: record.name,
  department: record.department,
  latitude: record.lat,
  longitude: record.lon,
  elevation: typeof record.elevation_m === "number" ? record.elevation_m : null,
  coordType: record.coord_type,
  source: record.source,
}));

export function placeById(id: string): Place | null {
  return PLACES.find((place) => place.id === id) ?? null;
}

/** Nearest municipal point. Squared degrees are enough at this scale. */
export function nearestPlace(latitude: number, longitude: number): Place {
  let best: Place = PLACES[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const place of PLACES) {
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

export function departmentNames(): string[] {
  return [...new Set(PLACES.map((place) => place.department))].sort((left, right) =>
    left.localeCompare(right, "es"),
  );
}

export function placesInDepartment(department: string): Place[] {
  return PLACES.filter((place) => place.department === department).sort((left, right) =>
    left.name.localeCompare(right.name, "es"),
  );
}

export function foldPlaceName(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
}

export function filterPlacesByName(places: readonly Place[], query: string): Place[] {
  const folded = foldPlaceName(query.trim());
  if (!folded) return [...places];
  return places.filter((place) => foldPlaceName(place.name).includes(folded));
}

/** Empty when the locations file can replace the seed without a code change. */
function recordText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function locationRecordErrors(records: readonly LocationRecord[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const id = recordText(record.id);
    if (!id.trim()) errors.push("id vacío");
    else if (seen.has(id)) errors.push(`id repetido: ${id}`);
    else seen.add(id);
    const label = id || "fila";
    if (!recordText(record.name).trim()) errors.push(`${label}: name vacío`);
    if (!recordText(record.department).trim()) errors.push(`${label}: department vacío`);
    if (!recordText(record.source).trim()) errors.push(`${label}: source vacío`);
    if (!COORD_TYPES.includes(record.coord_type)) {
      errors.push(`${label}: coord_type inválido`);
    }
    if (
      typeof record.lat !== "number" ||
      !Number.isFinite(record.lat) ||
      record.lat < EL_SALVADOR_LATITUDE.min ||
      record.lat > EL_SALVADOR_LATITUDE.max
    ) {
      errors.push(`${label}: lat fuera de El Salvador`);
    }
    if (
      typeof record.lon !== "number" ||
      !Number.isFinite(record.lon) ||
      record.lon < EL_SALVADOR_LONGITUDE.min ||
      record.lon > EL_SALVADOR_LONGITUDE.max
    ) {
      errors.push(`${label}: lon fuera de El Salvador`);
    }
    if (record.elevation_m !== undefined && !Number.isFinite(record.elevation_m)) {
      errors.push(`${label}: elevation_m no es un número`);
    }
  }
  return errors;
}
